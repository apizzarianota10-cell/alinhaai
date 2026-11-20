import React, { useState, useEffect } from 'react';
import {
  Cake,
  MessageCircle,
  Search,
  PartyPopper,
  Copy,
  CheckCircle2,
  CalendarDays,
  Gift,
  Pencil,
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clinicStorage } from '../../lib/storage';
import {
  getBirthdayAlerts,
  buildWhatsAppLink,
  openExternalLink,
  copyToClipboard,
  buildBirthdayMessage,
} from '../../lib/utils';
import { BirthdayAlert, Patient } from '../../types';
import { useToast } from '../common/Toast';
import { StatCard, Avatar, Pill, Card } from '../common/Insights';

interface BirthdaysViewProps {
  onNavigate: (section: string, payload?: any) => void;
}

const weekday = (d: Date) => { const w = format(d, "EEEE", { locale: ptBR }); return w.charAt(0).toUpperCase() + w.slice(1); };

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const BirthdaysView: React.FC<BirthdaysViewProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [settings, setSettings] = useState(clinicStorage.getSettings());
  const [alerts, setAlerts] = useState<BirthdayAlert[]>([]);
  const [greeted, setGreeted] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  useEffect(() => {
    const load = () => {
      const pts = clinicStorage.getPatients();
      setPatients(pts);
      const stg = clinicStorage.getSettings();
      setSettings(stg);
      setAlerts(getBirthdayAlerts(pts, new Date(), stg.leapYearFeb29Rule));
      setGreeted(new Set(clinicStorage.getBirthdayGreetings().map((g) => g.patientId)));
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const send = (patientId: string, name: string, phone: string) => {
    openExternalLink(buildWhatsAppLink(phone, buildBirthdayMessage(settings, name)));
    clinicStorage.markBirthdayGreeted(patientId, clinicStorage.getCurrentUser().name);
    showToast(`WhatsApp aberto para ${name.split(' ')[0]}. Marcado como parabenizado.`, 'success');
  };
  const copy = async (name: string) => {
    const ok = await copyToClipboard(buildBirthdayMessage(settings, name));
    showToast(ok ? 'Mensagem copiada! Cole no WhatsApp.' : 'Não foi possível copiar a mensagem.', ok ? 'success' : 'error');
  };
  const toggleGreeted = (patientId: string) => {
    if (greeted.has(patientId)) clinicStorage.unmarkBirthdayGreeted(patientId);
    else clinicStorage.markBirthdayGreeted(patientId, clinicStorage.getCurrentUser().name);
  };

  const q = search.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const visible = alerts.filter((a) => matches(a.patientName)).sort((a, b) => a.daysUntil - b.daysUntil);
  const todayList = visible.filter((a) => a.daysUntil === 0);
  const upcoming = visible.filter((a) => a.daysUntil > 0 && a.daysUntil <= 30);
  const week = alerts.filter((a) => a.daysUntil >= 0 && a.daysUntil <= 7).length;

  const year = new Date().getFullYear();
  const monthOf = (p: Patient) => parseInt(p.birthDate.split('-')[1], 10) - 1;
  const listed = patients.filter((p) => p.birthDate && p.status !== 'arquivado');
  const perMonth = MONTHS.map((_, m) => listed.filter((p) => monthOf(p) === m).length);
  const maxPerMonth = Math.max(1, ...perMonth);
  const thisMonth = new Date().getMonth();
  // birthdays already reached this year (incl. today) vs. how many of those were congratulated
  const todayMD = format(new Date(), 'MM-dd');
  const reached = listed.filter((p) => p.status === 'ativo' && p.birthDate.slice(5) <= todayMD);
  const greetedReached = reached.filter((p) => greeted.has(p.id)).length;

  const monthList = listed
    .filter((p) => monthOf(p) === selectedMonth && matches(p.name))
    .sort((a, b) => a.birthDate.slice(8).localeCompare(b.birthDate.slice(8)));

  const DateBadge: React.FC<{ date: Date; highlight?: boolean }> = ({ date, highlight }) => (
    <span
      className={`w-12 shrink-0 rounded-lg text-center py-1 ${
        highlight ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
      }`}
    >
      <span className="block text-base font-extrabold leading-tight">{format(date, 'dd')}</span>
      <span className="block text-[9px] font-bold uppercase">{format(date, 'MMM', { locale: ptBR })}</span>
    </span>
  );

  const Actions: React.FC<{ id: string; name: string; phone: string; strong?: boolean }> = ({ id, name, phone, strong }) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => copy(name)} className="p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F3] dark:hover:bg-[#1F332A]" title="Copiar mensagem" aria-label={`Copiar mensagem para ${name}`}>
        <Copy className="w-4 h-4" />
      </button>
      {greeted.has(id) ? (
        <button
          onClick={() => toggleGreeted(id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          title="Desmarcar"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Parabenizado
        </button>
      ) : (
        <button
          onClick={() => send(id, name, phone)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
            strong ? 'bg-[#25D366] hover:bg-[#20ba5a] text-white' : 'border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Parabenizar
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cake className="w-6 h-6 text-amber-500" /> Aniversariantes
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Quem faz aniversário, quem já foi parabenizado e o planejamento do ano.
          </p>
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente…"
            aria-label="Buscar paciente"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Hoje" value={alerts.filter((a) => a.daysUntil === 0).length} hint={todayList.length ? todayList.map((a) => a.patientName.split(' ')[0]).join(', ') : 'nenhum aniversário hoje'} icon={PartyPopper} tone="amber" />
        <StatCard label="Próximos 7 dias" value={week} hint="contando hoje" icon={CalendarDays} tone="blue" />
        <StatCard label={`Em ${MONTHS[thisMonth].toLowerCase()}`} value={perMonth[thisMonth]} hint={`${listed.length} pacientes com data cadastrada`} icon={Gift} />
        <StatCard
          label={`Parabenizados em ${year}`}
          value={`${greetedReached}/${reached.length}`}
          hint={reached.length ? `${Math.round((greetedReached / reached.length) * 100)}% dos aniversários até hoje` : 'nenhum aniversário ainda'}
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      {/* Today */}
      {todayList.length > 0 && (
        <section className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
              <PartyPopper className="w-6 h-6 text-amber-100" />
            </span>
            <div>
              <p className="text-[11px] uppercase font-extrabold tracking-wider text-amber-100">Aniversário hoje</p>
              <h2 className="text-lg sm:text-xl font-black leading-tight">
                {todayList.length === 1 ? `${todayList[0].patientName} faz ${todayList[0].age} anos!` : `${todayList.length} pacientes fazem aniversário hoje!`}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {todayList.map((b) => (
              <div key={b.patientId} className="p-3 rounded-xl bg-white/15 border border-white/25 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={b.patientName} />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{b.patientName}</p>
                    <p className="text-xs text-amber-100">
                      {b.age} anos • {b.whatsapp || b.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copy(b.patientName)}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30"
                    title="Copiar mensagem"
                    aria-label="Copiar mensagem"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {greeted.has(b.patientId) ? (
                    <button
                      onClick={() => toggleGreeted(b.patientId)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-emerald-700 text-xs font-bold"
                      title="Desmarcar"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Parabenizado
                    </button>
                  ) : (
                    <button
                      onClick={() => send(b.patientId, b.patientName, b.whatsapp || b.phone)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold rounded-lg shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" /> Enviar parabéns
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
        {/* Upcoming 30 days */}
        <Card title="Próximos 30 dias" action={<span className="text-[11px] text-[#64748B]">{upcoming.length} aniversário(s)</span>}>
          {upcoming.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">Nenhum aniversário nos próximos 30 dias.</p>
          ) : (
            <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {upcoming.map((b) => {
                const date = addDays(new Date(), b.daysUntil);
                return (
                  <li key={b.patientId} className="py-2.5 flex flex-wrap items-center gap-3">
                    <DateBadge date={date} highlight={b.daysUntil === 1} />
                    <div className="flex-1 min-w-[10rem]">
                      <p className="text-sm font-semibold">{b.patientName}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {weekday(date)} • fará {b.age} anos
                      </p>
                    </div>
                    <Pill tone={b.daysUntil === 1 ? 'amber' : b.daysUntil <= 7 ? 'blue' : 'slate'}>
                      {b.daysUntil === 1 ? 'Amanhã' : `Em ${b.daysUntil} dias`}
                    </Pill>
                    <Actions id={b.patientId} name={b.patientName} phone={b.whatsapp || b.phone} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Message preview */}
        <Card
          title="Mensagem de parabéns"
          action={
            <button onClick={() => onNavigate('settings')} className="flex items-center gap-1 text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
              <Pencil className="w-3 h-3" /> Editar
            </button>
          }
        >
          <div className="rounded-xl rounded-tl-sm bg-[#DCF8C6] dark:bg-[#1F3B2A] text-[#17231D] dark:text-[#E7F5EC] p-3 text-xs leading-relaxed shadow-xs">
            {buildBirthdayMessage(settings, (todayList[0] || upcoming[0])?.patientName || 'Maria Oliveira')}
          </div>
          <p className="text-[11px] text-[#64748B] mt-2">
            Usa o nome do paciente e da clínica automaticamente. Aniversário em 29/02 em ano não bissexto:{' '}
            {settings.leapYearFeb29Rule === 'feb28' ? '28/02' : '01/03'}.
          </p>
        </Card>
      </div>

      {/* Year planner */}
      <Card title={`Planejamento de ${year}`}>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 mb-4" role="tablist" aria-label="Mês">
          {MONTHS.map((m, i) => {
            const on = i === selectedMonth;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={on}
                onClick={() => setSelectedMonth(i)}
                className={`flex flex-col items-center justify-end gap-1 h-20 rounded-lg p-1 border transition-colors ${
                  on ? 'border-[#426B5B] bg-[#E9F1EC] dark:bg-[#1F332A]' : 'border-transparent hover:bg-[#F8FAF9] dark:hover:bg-[#111A15]'
                }`}
              >
                <span className="text-[10px] font-bold text-[#64748B]">{perMonth[i] || ''}</span>
                <span
                  className={`w-4 rounded-sm ${i === thisMonth ? 'bg-amber-500' : 'bg-[#426B5B]/70 dark:bg-[#7FB39F]/70'}`}
                  style={{ height: `${(perMonth[i] / maxPerMonth) * 36 + 2}px` }}
                  aria-hidden
                />
                <span className={`text-[10px] font-semibold uppercase ${on ? 'text-[#426B5B] dark:text-[#7FB39F]' : 'text-[#64748B]'}`}>{m.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>

        {monthList.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#64748B]">Nenhum paciente faz aniversário em {MONTHS[selectedMonth]}.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {monthList.map((p) => {
              const [by, , d] = p.birthDate.split('-').map(Number);
              const date = new Date(year, selectedMonth, d);
              const passed = format(date, 'MM-dd') < todayMD;
              return (
                <li
                  key={p.id}
                  className={`p-2.5 rounded-xl border border-[#E5EAE7] dark:border-[#273830] flex flex-wrap items-center gap-3 ${passed && !greeted.has(p.id) ? 'opacity-70' : ''}`}
                >
                  <DateBadge date={date} highlight={format(date, 'MM-dd') === todayMD} />
                  <div className="flex-1 min-w-[8rem]">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      {weekday(date)} • {year - by} anos
                      {p.status !== 'ativo' && ' • inativo'}
                    </p>
                  </div>
                  {passed && greeted.has(p.id) ? (
                    <button onClick={() => toggleGreeted(p.id)} title="Desmarcar">
                      <Pill tone="green">
                        <CheckCircle2 className="w-3 h-3" /> Parabenizado
                      </Pill>
                    </button>
                  ) : passed ? (
                    <div className="flex items-center gap-1.5">
                      <Pill tone="slate">Passou</Pill>
                      <button
                        onClick={() => toggleGreeted(p.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#64748B] border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F1F5F3] dark:hover:bg-[#1F332A]"
                        title="Marcar como parabenizado"
                        aria-label={`Marcar ${p.name} como parabenizado`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marcar
                      </button>
                    </div>
                  ) : (
                    <Actions id={p.id} name={p.name} phone={p.whatsapp || p.phone} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};
