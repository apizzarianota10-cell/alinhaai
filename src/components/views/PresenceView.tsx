import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Plus, Printer, Trash2, Search, CheckCircle2, RotateCcw, XCircle, Download, ArrowLeft, Loader2, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { formatDate, printElement, STATUS_LABELS } from '../../lib/utils';
import { StatCard, Avatar, ProgressBar, Pill, Card, daysBetween, AlertTone } from '../common/Insights';
import { downloadPresencePdf, downloadPresenceOverviewPdf, PresenceSummary } from '../../lib/pdf';
import { Appointment, ManualPresenceEntry, Patient, Plan, PresenceMark, PresenceSheet } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

const SESSIONS_PER_BLOCK = 10;
const BLOCKS_PER_CYCLE = 3; // 30 sessions, then reavaliação

type Row = { key: string; date: string; mark: PresenceMark; source: 'agenda' | 'manual'; manualId?: string; note?: string };

const MARK_LABEL: Record<PresenceMark, string> = { P: 'Presença', C: 'Compensação', F: 'Falta' };
const MARK_STYLE: Record<PresenceMark, string> = {
  P: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
  C: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300',
  F: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
};

/** Attendance rows from the agenda (realizado → P, reposição realizada → C, faltou → F) plus manual entries */
export function buildRows(patientId: string, sheet: PresenceSheet): Row[] {
  const fromAgenda: Row[] = clinicStorage
    .getAppointments()
    .filter((a) => a.patientId === patientId && (a.status === 'realizado' || a.status === 'faltou'))
    .map((a) => ({
      key: a.id,
      date: a.date,
      mark: a.status === 'faltou' ? 'F' : a.replacementForAppointmentId ? 'C' : 'P',
      source: 'agenda',
    }));
  const manual: Row[] = sheet.manualEntries.map((m) => ({
    key: m.id,
    date: m.date,
    mark: m.mark,
    source: 'manual',
    manualId: m.id,
    note: m.note,
  }));
  return [...fromAgenda, ...manual].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** One patient's sheet — used by the Presença section and inside the patient profile */
export const PresenceSheetPanel: React.FC<{ patient: Patient; compact?: boolean }> = ({ patient, compact }) => {
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<PresenceSheet>(() => clinicStorage.getPresenceSheet(patient.id));
  const [rows, setRows] = useState<Row[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addMark, setAddMark] = useState<PresenceMark>('P');
  const [addNote, setAddNote] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const settings = clinicStorage.getSettings();

  useEffect(() => {
    const load = () => {
      const s = clinicStorage.getPresenceSheet(patient.id);
      setSheet(s);
      setRows(buildRows(patient.id, s));
      setNotesDraft(s.notes);
    };
    load();
    return clinicStorage.subscribe(load);
  }, [patient.id]);

  const attended = rows.filter((r) => r.mark !== 'F');
  const absences = rows.filter((r) => r.mark === 'F');
  const cycleSize = SESSIONS_PER_BLOCK * BLOCKS_PER_CYCLE;
  const cycles = Math.max(1, Math.ceil((attended.length + 1) / cycleSize));

  const saveNote = (key: string) => {
    if ((sheet.notes[key] || '') === (notesDraft[key] || '')) return;
    clinicStorage.savePresenceSheet({ ...sheet, notes: { ...sheet.notes, [key]: notesDraft[key] || '' } });
    showToast('Anotação salva.', 'success');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ManualPresenceEntry = { id: `pres-${Date.now()}`, date: addDate, mark: addMark, note: addNote.trim() || undefined };
    clinicStorage.savePresenceSheet({ ...sheet, manualEntries: [...sheet.manualEntries, entry] });
    showToast(`${MARK_LABEL[addMark]} registrada em ${formatDate(addDate, 'dd/MM')}.`, 'success');
    setIsAddOpen(false);
    setAddNote('');
  };

  const removeManual = (id: string) => {
    clinicStorage.savePresenceSheet({ ...sheet, manualEntries: sheet.manualEntries.filter((m) => m.id !== id) });
    showToast('Registro manual removido.', 'info');
  };

  const sheetId = `presence-${patient.id}`;
  const noteBox = (key: string, label: string) => (
    <div className="mt-2 space-y-1">
      <label htmlFor={`${sheetId}-${key}`} className="block text-[11px] font-semibold text-[#17231D] dark:text-[#F1F5F3]">
        {label}
      </label>
      <textarea
        id={`${sheetId}-${key}`}
        rows={3}
        value={notesDraft[key] || ''}
        onChange={(e) => setNotesDraft({ ...notesDraft, [key]: e.target.value })}
        onBlur={() => saveNote(key)}
        placeholder="Escreva aqui…"
        className="w-full text-xs px-2.5 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg print:border-0 print:border-b print:rounded-none"
      />
    </div>
  );

  const plan = clinicStorage.getPlans().find((pl) => pl.id === patient.activePlanId);
  const professional = clinicStorage.getProfessionals().find((pr) => pr.id === patient.responsibleProfessionalId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextAppt = clinicStorage
    .getAppointments()
    .filter((a) => a.patientId === patient.id && a.date >= todayStr && (a.status === 'agendado' || a.status === 'confirmado'))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  const marked = rows.length;
  const freq = marked ? Math.round((attended.length / marked) * 100) : null;
  const cyclePos = attended.length % 30 || (attended.length ? 30 : 0);

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] flex flex-col lg:flex-row gap-4">
          <div className="flex items-center gap-3 lg:w-72">
            <Avatar name={patient.name} size="lg" />
            <div className="min-w-0">
              <p className="font-bold text-base truncate">{patient.name}</p>
              <p className="text-[11px] text-[#64748B] truncate">{[plan?.name, patient.modality].filter(Boolean).join(' • ')}</p>
              {professional && <p className="text-[11px] text-[#64748B] truncate">Prof. {professional.name}</p>}
            </div>
          </div>
          <dl className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <dt className="text-[#64748B]">Frequência</dt>
              <dd className="text-lg font-bold">{freq === null ? '—' : `${freq}%`}</dd>
              <ProgressBar value={freq ?? 0} label="Frequência" />
            </div>
            <div>
              <dt className="text-[#64748B]">Ciclo atual</dt>
              <dd className="text-lg font-bold">{cyclePos}/30</dd>
              <ProgressBar value={cyclePos} max={30} tone="blue" label="Ciclo" />
            </div>
            <div>
              <dt className="text-[#64748B]">Sessões restantes</dt>
              <dd className={`text-lg font-bold ${patient.sessionsRemaining <= 2 ? 'text-rose-600' : ''}`}>{patient.sessionsRemaining}</dd>
              <span className="text-[10px] text-[#64748B]">{patient.sessionsCompleted || 0} realizadas no total</span>
            </div>
            <div>
              <dt className="text-[#64748B]">Próxima sessão</dt>
              <dd className="text-sm font-bold mt-1">{nextAppt ? `${formatDate(nextAppt.date, 'dd/MM')} às ${nextAppt.startTime}` : '—'}</dd>
              <span className="text-[10px] text-[#64748B]">{nextAppt?.professionalName || 'Nada agendado'}</span>
            </div>
          </dl>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className={`px-2 py-1 rounded-full ${MARK_STYLE.P}`}>P {rows.filter((r) => r.mark === 'P').length}</span>
          <span className={`px-2 py-1 rounded-full ${MARK_STYLE.C}`}>C {rows.filter((r) => r.mark === 'C').length}</span>
          <span className={`px-2 py-1 rounded-full ${MARK_STYLE.F}`}>Faltas {absences.length}</span>
          {compact && (
            <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {patient.sessionsRemaining} {patient.sessionsRemaining === 1 ? 'sessão restante' : 'sessões restantes'} no plano
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Registrar
          </button>
          <button
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await downloadPresencePdf(patient, rows, { ...sheet.notes, ...notesDraft }, settings);
              } catch (e) {
                console.error(e);
                showToast('Não foi possível gerar o PDF.', 'error');
              } finally {
                setPdfBusy(false);
              }
            }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold border border-[#426B5B] text-[#426B5B] dark:text-[#7FB39F] rounded-lg hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] disabled:opacity-50"
          >
            {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar PDF
          </button>
          <button
            onClick={() => printElement(document.getElementById(sheetId), `Controle de Presença — ${patient.name}`)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold border border-[#E5EAE7] dark:border-[#273830] rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
        </div>
      </div>

      {/* Printable sheet */}
      <div id={sheetId} className="rounded-2xl border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] p-3 sm:p-5 space-y-4">
        <header className="text-center space-y-0.5">
          <h2 className="text-base sm:text-lg font-bold">Controle de Presença</h2>
          <p className="text-xs font-semibold">{patient.name}</p>
          <p className="text-[11px] text-[#64748B]">{settings.clinicName}</p>
        </header>

        <div
          className={`grid gap-4 ${
            compact ? 'grid-cols-1' : cycles > 1 ? 'grid-cols-1 lg:grid-cols-[1fr_1fr_12rem]' : 'grid-cols-1 md:grid-cols-[1fr_12rem]'
          }`}
        >
          {Array.from({ length: cycles }, (_, c) => {
            const cycleRows = attended.slice(c * cycleSize, (c + 1) * cycleSize);
            return (
              <section key={c} className="border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-3" aria-label={`Ciclo ${c + 1}`}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
                  Presenças / Compensações — ciclo {c + 1}
                </h3>
                {Array.from({ length: BLOCKS_PER_CYCLE }, (_, b) => {
                  const start = b * SESSIONS_PER_BLOCK;
                  const blockRows = cycleRows.slice(start, start + SESSIONS_PER_BLOCK);
                  // show the empty lines of the current block, like the paper form
                  if (blockRows.length === 0 && start > cycleRows.length) return null;
                  return (
                    <div key={b} className="mb-3">
                      <ol className="space-y-0.5">
                        {Array.from({ length: SESSIONS_PER_BLOCK }, (_, i) => {
                          const r = blockRows[i];
                          const n = start + i + 1;
                          return (
                            <li key={i} className="flex items-center gap-2 text-xs py-0.5 border-b border-dashed border-[#E5EAE7] dark:border-[#273830]">
                              <span className="w-6 text-right font-mono text-[#94A3B8]">{n}.</span>
                              <span className="w-20 font-mono">{r ? formatDate(r.date, 'dd/MM/yyyy') : '__/__/____'}</span>
                              <span className="flex gap-1 font-bold">
                                <span className={`px-1.5 rounded ${r?.mark === 'P' ? MARK_STYLE.P : 'text-[#CBD5E1] dark:text-[#475569]'}`}>P</span>
                                <span className={`px-1.5 rounded ${r?.mark === 'C' ? MARK_STYLE.C : 'text-[#CBD5E1] dark:text-[#475569]'}`}>C</span>
                              </span>
                              {r?.source === 'manual' && (
                                <button
                                  onClick={() => removeManual(r.manualId!)}
                                  className="ml-auto p-1 text-[#94A3B8] hover:text-rose-600 print:hidden"
                                  aria-label={`Remover registro de ${formatDate(r.date, 'dd/MM')}`}
                                  title="Registro manual — remover"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                      {noteBox(`c${c + 1}-b${b + 1}`, 'Percepção do paciente em relação à sua evolução')}
                    </div>
                  );
                })}
                {cycleRows.length >= cycleSize - SESSIONS_PER_BLOCK && noteBox(`c${c + 1}-reav`, 'Reavaliação')}
              </section>
            );
          })}

          <aside className="border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-3" aria-label="Faltas">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">Faltas</h3>
            {absences.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">Nenhuma falta registrada.</p>
            ) : (
              <ul className="space-y-1">
                {absences.map((r) => (
                  <li key={r.key} className="flex items-center gap-2 text-xs py-0.5 border-b border-dashed border-[#E5EAE7] dark:border-[#273830]">
                    <span className="font-mono">{formatDate(r.date, 'dd/MM/yyyy')}</span>
                    {r.source === 'manual' && (
                      <button
                        onClick={() => removeManual(r.manualId!)}
                        className="ml-auto p-1 text-[#94A3B8] hover:text-rose-600 print:hidden"
                        aria-label={`Remover falta de ${formatDate(r.date, 'dd/MM')}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <footer className="text-center text-[10px] text-[#64748B] pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
          {[settings.address, settings.phone && `Telefone: ${settings.phone}`, settings.email && `E-mail: ${settings.email}`]
            .filter(Boolean)
            .join(' • ')}
        </footer>
      </div>

      <p className="text-[11px] text-[#64748B] print:hidden">
        Sessões marcadas como <b>realizadas</b> na agenda entram como P, reposições realizadas como C e faltas na coluna Faltas.
        Use “Registrar” para lançar sessões fora da agenda.
      </p>

      {isAddOpen && (
        <Modal isOpen={true} onClose={() => setIsAddOpen(false)} title="Registrar presença" description={patient.name} maxWidth="md">
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Data</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                required
                className="w-full text-sm px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
            <fieldset>
              <legend className="block text-xs font-semibold mb-1.5">Tipo</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['P', CheckCircle2],
                    ['C', RotateCcw],
                    ['F', XCircle],
                  ] as const
                ).map(([m, Icon]) => (
                  <label
                    key={m}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                      addMark === m ? 'bg-[#426B5B] border-[#426B5B] text-white' : 'border-[#E5EAE7] dark:border-[#273830]'
                    }`}
                  >
                    <input type="radio" name="mark" className="sr-only" checked={addMark === m} onChange={() => setAddMark(m)} />
                    <Icon className="w-4 h-4" />
                    {MARK_LABEL[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="block text-xs font-semibold mb-1">Observação (opcional)</label>
              <input
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-xs font-semibold text-[#64748B] rounded-lg">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg">
                Registrar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

type Period = 'mes' | '30d' | 'tudo';
const PERIOD_LABEL: Record<Period, string> = { mes: 'Este mês', '30d': 'Últimos 30 dias', tudo: 'Todo o período' };
type SortKey = 'nome' | 'frequencia' | 'faltas' | 'ultima';

const todayKey = () => new Date().toISOString().slice(0, 10);
function periodStart(p: Period): string {
  const now = new Date();
  if (p === 'mes') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  if (p === '30d') return new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  return '0000-00-00';
}

type StudentAlert = { label: string; tone: AlertTone; title: string };

/** Everything the overview shows about one student */
function summarize(p: Patient, period: Period, plans: Plan[], appts: Appointment[]): PresenceSummary & { alertsDetail: StudentAlert[] } {
  const rows = buildRows(p.id, clinicStorage.getPresenceSheet(p.id));
  const from = periodStart(period);
  const today = todayKey();
  const inPeriod = rows.filter((r) => r.date >= from && r.date <= today);
  const P = inPeriod.filter((r) => r.mark === 'P').length;
  const C = inPeriod.filter((r) => r.mark === 'C').length;
  const F = inPeriod.filter((r) => r.mark === 'F').length;
  const attended = rows.filter((r) => r.mark !== 'F');
  const cyclePos = attended.length % 30 || (attended.length ? 30 : 0);
  const last = attended[attended.length - 1]?.date;
  const next = appts
    .filter((a) => a.patientId === p.id && a.date >= today && (a.status === 'agendado' || a.status === 'confirmado'))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];

  const alertsDetail: StudentAlert[] = [];
  if (attended.length > 0 && cyclePos >= 27)
    alertsDetail.push({
      label: cyclePos === 30 ? 'Reavaliar' : `Reavaliação em ${30 - cyclePos}`,
      tone: 'amber',
      title: 'A cada 30 sessões o aluno deve ser reavaliado',
    });
  if (p.status === 'ativo' && p.sessionsRemaining <= 2)
    alertsDetail.push({
      label: p.sessionsRemaining === 0 ? 'Plano esgotado' : `Plano: ${p.sessionsRemaining} restante${p.sessionsRemaining > 1 ? 's' : ''}`,
      tone: 'rose',
      title: 'Renovação do plano',
    });
  if (F >= 2) alertsDetail.push({ label: `${F} faltas`, tone: 'rose', title: `Faltas em: ${PERIOD_LABEL[period].toLowerCase()}` });
  if (last && daysBetween(last, today) > 14 && !next)
    alertsDetail.push({ label: `Ausente há ${daysBetween(last, today)} dias`, tone: 'slate', title: 'Sem presença e sem sessão agendada' });

  return {
    patient: p,
    P,
    C,
    F,
    freq: P + C + F > 0 ? Math.round(((P + C) / (P + C + F)) * 100) : null,
    cyclePos,
    last,
    next: next ? `${next.date} ${next.startTime}` : undefined,
    planName: plans.find((pl) => pl.id === p.activePlanId)?.name,
    alerts: alertsDetail.map((a) => a.label),
    alertsDetail,
  };
}

/** Today's booked sessions with one-tap Presente / Falta */
const TodayRollCall: React.FC = () => {
  const { showToast } = useToast();
  const [items, setItems] = useState<Appointment[]>([]);
  useEffect(() => {
    const load = () =>
      setItems(
        clinicStorage
          .getAppointments()
          .filter((a) => a.date === todayKey() && a.status !== 'cancelado' && a.status !== 'reagendado')
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const done = items.filter((a) => a.status === 'realizado').length;
  const missed = items.filter((a) => a.status === 'faltou').length;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" /> Chamada de hoje
        </span>
      }
      action={
        <span className="text-[11px] text-[#64748B]">
          {done} presentes • {missed} faltas • {items.length - done - missed} a confirmar
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="text-xs text-[#64748B] py-4 text-center">Nenhuma sessão agendada para hoje.</p>
      ) : (
        <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
          {items.map((a) => {
            const open = a.status === 'agendado' || a.status === 'confirmado' || a.status === 'em_atendimento';
            return (
              <li key={a.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-12 font-mono text-xs font-bold text-[#426B5B] dark:text-[#7FB39F]">{a.startTime}</span>
                <Avatar name={a.patientName} size="sm" />
                <div className="flex-1 min-w-[9rem]">
                  <p className="text-sm font-semibold leading-tight">{a.patientName}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {a.modality} • {a.professionalName}
                  </p>
                </div>
                {open ? (
                  <div className="flex gap-1.5 ml-auto">
                    <button
                      onClick={() => {
                        if (clinicStorage.markAppointmentPresent(a.id)) showToast(`Presença de ${a.patientName.split(' ')[0]} registrada.`, 'success');
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Presente
                    </button>
                    <button
                      onClick={() => {
                        const r = clinicStorage.registerMissedSession(a.id, 'faltou');
                        showToast(r.sessionConsumed ? 'Falta registrada (1 sessão descontada, regra da clínica).' : 'Falta registrada.', 'info');
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Falta
                    </button>
                  </div>
                ) : (
                  <span className="ml-auto">
                    <Pill tone={a.status === 'realizado' ? 'green' : 'rose'}>{STATUS_LABELS[a.status] || a.status}</Pill>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export const PresenceView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [summaries, setSummaries] = useState<ReturnType<typeof summarize>[]>([]);
  const [selectedId, setSelectedId] = useState<string>(patientId || '');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('mes');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [sort, setSort] = useState<SortKey>('nome');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const load = () => {
      const pts = clinicStorage.getPatients().filter((p) => p.status !== 'arquivado');
      const plans = clinicStorage.getPlans();
      const appts = clinicStorage.getAppointments();
      setPatients(pts);
      setSummaries(pts.map((p) => summarize(p, period, plans, appts)));
    };
    load();
    return clinicStorage.subscribe(load);
  }, [period]);
  useEffect(() => {
    if (patientId) setSelectedId(patientId);
  }, [patientId]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = summaries.filter((s) => s.patient.name.toLowerCase().includes(q) && (!onlyAlerts || s.alertsDetail.length > 0));
    const by: Record<SortKey, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      nome: (a, b) => a.patient.name.localeCompare(b.patient.name),
      frequencia: (a, b) => (a.freq ?? 101) - (b.freq ?? 101),
      faltas: (a, b) => b.F - a.F,
      ultima: (a, b) => (a.last || '').localeCompare(b.last || ''),
    };
    return [...list].sort(by[sort]);
  }, [summaries, q, onlyAlerts, sort]);
  const selected = patients.find((p) => p.id === selectedId) || null;

  const totals = summaries.reduce((t, s) => ({ P: t.P + s.P, C: t.C + s.C, F: t.F + s.F }), { P: 0, C: 0, F: 0 });
  const overallFreq = totals.P + totals.C + totals.F > 0 ? Math.round(((totals.P + totals.C) / (totals.P + totals.C + totals.F)) * 100) : null;
  const withAlerts = summaries.filter((s) => s.alertsDetail.length > 0).length;
  const active = summaries.filter((s) => s.patient.status === 'ativo').length;
  const repeatAbsent = summaries.filter((s) => s.F >= 2).length;

  const handleOverviewPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadPresenceOverviewPdf(filtered, clinicStorage.getSettings(), `${PERIOD_LABEL[period]} - ${filtered.length} alunos - gerado em ${formatDate(todayKey())}`);
    } catch (e) {
      console.error(e);
      showToast('Não foi possível gerar o PDF.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
      on ? 'bg-[#426B5B] border-[#426B5B] text-white' : 'bg-white dark:bg-[#141F19] border-[#E5EAE7] dark:border-[#263730] text-[#64748B] dark:text-[#9AA8B6]'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Controle de Presença
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Frequência, chamada do dia e alertas de todos os alunos. Toque em um aluno para abrir a folha completa.
          </p>
        </div>
        {!selected && (
          <button
            onClick={handleOverviewPdf}
            disabled={pdfBusy || filtered.length === 0}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg disabled:opacity-50"
          >
            {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar PDF
          </button>
        )}
      </div>

      {selected ? (
        <div className="space-y-3">
          <button onClick={() => setSelectedId('')} className="flex items-center gap-1 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
            <ArrowLeft className="w-4 h-4" /> Todos os alunos
          </button>
          <PresenceSheetPanel key={selected.id} patient={selected} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} className={chip(period === p)}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Frequência média"
              value={overallFreq === null ? '—' : `${overallFreq}%`}
              hint={overallFreq === null ? 'Sem registros no período' : `${totals.P + totals.C} presenças de ${totals.P + totals.C + totals.F} sessões`}
              icon={TrendingUp}
              tone={overallFreq === null || overallFreq >= 80 ? 'green' : overallFreq >= 60 ? 'amber' : 'rose'}
            />
            <StatCard label="Presenças" value={totals.P + totals.C} hint={`${totals.P} regulares • ${totals.C} compensações`} icon={CheckCircle2} tone="blue" />
            <StatCard label="Faltas" value={totals.F} hint={`${repeatAbsent} aluno(s) com 2+ faltas`} icon={XCircle} tone="rose" />
            <StatCard
              label="Alunos com alerta"
              value={withAlerts}
              hint={`de ${active} ativos • reavaliação, plano, faltas`}
              icon={AlertTriangle}
              tone="amber"
              onClick={() => setOnlyAlerts(true)}
            />
          </div>

          <TodayRollCall />

          <Card
            title="Alunos"
            action={<span className="text-[11px] text-[#64748B]">{filtered.length} de {summaries.length}</span>}
          >
            <div className="flex flex-col md:flex-row gap-2 md:items-center mb-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar aluno…"
                  aria-label="Buscar aluno"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOnlyAlerts(!onlyAlerts)} aria-pressed={onlyAlerts} className={chip(onlyAlerts)}>
                  Só com alertas
                </button>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Ordenar"
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
                >
                  <option value="nome">Ordenar: nome</option>
                  <option value="frequencia">Menor frequência</option>
                  <option value="faltas">Mais faltas</option>
                  <option value="ultima">Ausentes há mais tempo</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#64748B]">Nenhum aluno encontrado.</p>
            ) : (
              <>
                {/* phones: cards */}
                <ul className="md:hidden space-y-2">
                  {filtered.map((s) => (
                    <li key={s.patient.id}>
                      <button
                        onClick={() => setSelectedId(s.patient.id)}
                        className="w-full text-left p-3 rounded-xl border border-[#E5EAE7] dark:border-[#263730] bg-[#F8FAF9] dark:bg-[#111A15] space-y-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.patient.name} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{s.patient.name}</p>
                            <p className="text-[11px] text-[#64748B] truncate">{[s.planName, s.patient.modality].filter(Boolean).join(' • ')}</p>
                          </div>
                          <span className="text-right">
                            <span className="block text-base font-bold">{s.freq === null ? '—' : `${s.freq}%`}</span>
                            <span className="block text-[10px] text-[#64748B]">frequência</span>
                          </span>
                        </div>
                        <ProgressBar value={s.freq ?? 0} label="Frequência" />
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                          <span className={`rounded-lg py-1 font-semibold ${MARK_STYLE.P}`}>P {s.P}</span>
                          <span className={`rounded-lg py-1 font-semibold ${MARK_STYLE.C}`}>C {s.C}</span>
                          <span className={`rounded-lg py-1 font-semibold ${MARK_STYLE.F}`}>F {s.F}</span>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          <dt className="text-[#64748B]">Ciclo</dt>
                          <dd className="text-right font-semibold">{s.cyclePos}/30</dd>
                          <dt className="text-[#64748B]">Última presença</dt>
                          <dd className="text-right font-semibold">{s.last ? formatDate(s.last, 'dd/MM') : '—'}</dd>
                          <dt className="text-[#64748B]">Próxima sessão</dt>
                          <dd className="text-right font-semibold">{s.next ? formatDate(s.next.slice(0, 10), 'dd/MM') + ' ' + s.next.slice(11) : '—'}</dd>
                          <dt className="text-[#64748B]">Sessões restantes</dt>
                          <dd className="text-right font-semibold">{s.patient.sessionsRemaining}</dd>
                        </dl>
                        {s.alertsDetail.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {s.alertsDetail.map((a) => (
                              <Pill key={a.label} tone={a.tone} title={a.title}>
                                {a.label}
                              </Pill>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* larger screens: table */}
                <div className="hidden md:block overflow-x-auto -mx-3 sm:-mx-4">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8FAF9] dark:bg-[#111A15] text-[#64748B] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="text-left px-4 py-2.5">Aluno</th>
                        <th className="text-left px-3 py-2.5 w-36">Frequência</th>
                        <th className="px-2 py-2.5">P / C / F</th>
                        <th className="text-left px-3 py-2.5 w-28">Ciclo</th>
                        <th className="px-3 py-2.5">Última presença</th>
                        <th className="px-3 py-2.5">Próxima sessão</th>
                        <th className="px-3 py-2.5">Restantes</th>
                        <th className="text-left px-3 py-2.5">Alertas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#263730]">
                      {filtered.map((s) => (
                        <tr
                          key={s.patient.id}
                          onClick={() => setSelectedId(s.patient.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedId(s.patient.id))}
                          tabIndex={0}
                          className="cursor-pointer hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] focus:outline-none focus:bg-[#E9F1EC] dark:focus:bg-[#1F332A]"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={s.patient.name} size="sm" />
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{s.patient.name}</p>
                                <p className="text-[11px] text-[#64748B] truncate">{[s.planName, s.patient.modality].filter(Boolean).join(' • ')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={s.freq ?? 0} label="Frequência" />
                              <span className="w-9 text-right font-bold">{s.freq === null ? '—' : `${s.freq}%`}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <span className={`px-1.5 rounded font-bold ${MARK_STYLE.P}`}>{s.P}</span>{' '}
                            <span className={`px-1.5 rounded font-bold ${MARK_STYLE.C}`}>{s.C}</span>{' '}
                            <span className={`px-1.5 rounded font-bold ${MARK_STYLE.F}`}>{s.F}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={s.cyclePos} max={30} tone="blue" label="Ciclo de 30 sessões" />
                              <span className="font-mono text-[11px]">{s.cyclePos}/30</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {s.last ? (
                              <>
                                <span className="font-mono">{formatDate(s.last)}</span>
                                <span className="block text-[10px] text-[#64748B]">há {daysBetween(s.last, todayKey())} dia(s)</span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono">
                            {s.next ? `${formatDate(s.next.slice(0, 10), 'dd/MM')} ${s.next.slice(11)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold">{s.patient.sessionsRemaining}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {s.alertsDetail.length === 0 ? (
                                <Pill tone="green">Em dia</Pill>
                              ) : (
                                s.alertsDetail.map((a) => (
                                  <Pill key={a.label} tone={a.tone} title={a.title}>
                                    {a.label}
                                  </Pill>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
