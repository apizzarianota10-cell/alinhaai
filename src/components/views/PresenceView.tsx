import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Plus, Printer, Trash2, Search, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { formatDate, printElement } from '../../lib/utils';
import { ManualPresenceEntry, Patient, PresenceMark, PresenceSheet } from '../../types';
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
function buildRows(patientId: string, sheet: PresenceSheet): Row[] {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className={`px-2 py-1 rounded-full ${MARK_STYLE.P}`}>P {rows.filter((r) => r.mark === 'P').length}</span>
          <span className={`px-2 py-1 rounded-full ${MARK_STYLE.C}`}>C {rows.filter((r) => r.mark === 'C').length}</span>
          <span className={`px-2 py-1 rounded-full ${MARK_STYLE.F}`}>Faltas {absences.length}</span>
          <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {patient.sessionsRemaining} sessões restantes no plano
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Registrar
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

export const PresenceView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string>(patientId || '');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = () => setPatients(clinicStorage.getPatients().filter((p) => p.status !== 'arquivado'));
    load();
    return clinicStorage.subscribe(load);
  }, []);
  useEffect(() => {
    if (patientId) setSelectedId(patientId);
  }, [patientId]);

  const filtered = useMemo(
    () => patients.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [patients, search]
  );
  const selected = patients.find((p) => p.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarCheck2 className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Controle de Presença
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
          Presenças, compensações e faltas de cada aluno, com a percepção de evolução a cada 10 sessões e reavaliação a cada 30.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno…"
              aria-label="Buscar aluno"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
            />
          </div>
          {/* phones: compact select; larger screens: list */}
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Aluno"
            className="lg:hidden w-full px-3 py-2 text-sm bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
          >
            <option value="">Selecione um aluno…</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ul className="hidden lg:block max-h-[70vh] overflow-y-auto rounded-xl border border-[#E5EAE7] dark:border-[#263730] bg-white dark:bg-[#141F19] divide-y divide-[#E5EAE7] dark:divide-[#263730]">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2.5 text-xs ${
                    p.id === selectedId ? 'bg-[#E9F1EC] dark:bg-[#1F332A] font-bold text-[#345648] dark:text-[#9CCBB8]' : 'hover:bg-[#F8FAF9] dark:hover:bg-[#111A15]'
                  }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {selected ? (
            <PresenceSheetPanel key={selected.id} patient={selected} />
          ) : (
            <div className="p-10 text-center rounded-xl border border-dashed border-[#E5EAE7] dark:border-[#263730] text-sm text-[#64748B]">
              Selecione um aluno para ver o controle de presença.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
