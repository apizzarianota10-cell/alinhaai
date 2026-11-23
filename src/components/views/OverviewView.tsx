import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Cake,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Play,
  MessageCircle,
  CreditCard,
  ClipboardCheck,
  Dumbbell,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { addDays, addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  formatCurrency,
  getBirthdayAlerts,
  buildWhatsAppLink,
  openExternalLink,
  buildBirthdayMessage,
  toLocalDateKey,
  isChargeActive,
  getChargeDisplayStatus,
  STATUS_LABELS,
  canAccessSection,
  isGroupModality,
} from '../../lib/utils';
import { Patient, Appointment, Charge, Expense } from '../../types';
import { StatCard, Avatar, Pill, Card, AlertTone } from '../common/Insights';
import { IncomeExpenseChart, MonthSeries } from '../common/IncomeExpenseChart';

interface OverviewViewProps {
  onNavigate: (section: string, payload?: any) => void;
  onOpenBirthdayPopup: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate, onOpenBirthdayPopup }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState(clinicStorage.getSettings());
  const [greeted, setGreeted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      setPatients(clinicStorage.getPatients());
      setAppointments(clinicStorage.getAppointments());
      setCharges(clinicStorage.getCharges());
      setExpenses(clinicStorage.getExpenses());
      setSettings(clinicStorage.getSettings());
      setGreeted(new Set(clinicStorage.getBirthdayGreetings().map((g) => g.patientId)));
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const role = clinicStorage.getCurrentUser().role;
  const canSeeFinance = canAccessSection('financial', role);
  const canSeeClinical = canAccessSection('evaluations', role);
  const userName = clinicStorage.getCurrentUser().name.split(' (')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayStr = toLocalDateKey();
  const monthKey = todayStr.slice(0, 7);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const isActiveAppt = (a: Appointment) => a.status !== 'cancelado' && a.status !== 'reagendado';

  // ───────── today ─────────
  const today = appointments.filter((a) => a.date === todayStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayActive = today.filter(isActiveAppt);
  const doneToday = today.filter((a) => a.status === 'realizado').length;
  const inProgress = today.filter((a) => a.status === 'em_atendimento').length;
  const toConfirm = today.filter((a) => a.status === 'agendado').length;

  // one row per booking, classes grouped
  type Row = { key: string; appts: Appointment[]; first: Appointment; isClass: boolean };
  const rows: Row[] = Object.values(
    today.reduce<Record<string, Appointment[]>>((acc, a) => {
      const key = isGroupModality(a.modality) && isActiveAppt(a) ? `c|${a.professionalId}|${a.startTime}|${a.durationMinutes}` : a.id;
      (acc[key] = acc[key] || []).push(a);
      return acc;
    }, {})
  ).map((appts) => ({ key: appts[0].id, appts, first: appts[0], isClass: appts.length > 1 }));

  // ───────── month indicators ─────────
  const monthAppts = appointments.filter((a) => a.date.startsWith(monthKey) && a.date <= todayStr);
  const monthDone = monthAppts.filter((a) => a.status === 'realizado').length;
  const monthMissed = monthAppts.filter((a) => a.status === 'faltou').length;
  const freq = monthDone + monthMissed > 0 ? Math.round((monthDone / (monthDone + monthMissed)) * 100) : null;

  const activePatients = patients.filter((p) => p.status === 'ativo');
  const newThisMonth = patients.filter((p) => (p.createdAt || '').startsWith(monthKey)).length;
  const renewals = activePatients.filter((p) => p.sessionsRemaining <= 2);

  const activeCharges = charges.filter(isChargeActive);
  const paidIn = (key: string) =>
    activeCharges.reduce((s, c) => s + c.payments.filter((p) => toLocalDateKey(p.date).startsWith(key)).reduce((t, p) => t + p.amountCents, 0), 0);
  const paidOut = (key: string) => expenses.filter((e) => e.isPaid && (e.paymentDate || e.dueDate).startsWith(key)).reduce((s, e) => s + e.amountCents, 0);
  const monthIn = paidIn(monthKey);
  const prevIn = paidIn(format(addMonths(new Date(), -1), 'yyyy-MM'));
  const inDelta = prevIn > 0 ? Math.round(((monthIn - prevIn) / prevIn) * 100) : null;
  const overdue = charges.filter((c) => getChargeDisplayStatus(c, todayStr) === 'vencido');
  const overdueCents = overdue.reduce((s, c) => s + Math.max(0, c.finalAmountCents - (c.paidAmountCents || 0)), 0);

  const series: MonthSeries[] = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(new Date(), i - 5);
    const key = format(d, 'yyyy-MM');
    return { key, label: format(d, 'MMM', { locale: ptBR }), inC: paidIn(key), outC: paidOut(key) };
  });

  // next 7 days occupancy
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i);
    const key = format(d, 'yyyy-MM-dd');
    const list = appointments.filter((a) => a.date === key && isActiveAppt(a));
    return { key, d, count: list.length, confirmed: list.filter((a) => a.status === 'confirmado' || a.status === 'realizado').length };
  });
  const weekMax = Math.max(1, ...week.map((w) => w.count));

  // ───────── pending actions ─────────
  const birthdays = getBirthdayAlerts(patients, new Date(), settings.leapYearFeb29Rule).filter((b) => b.daysUntil <= 3);
  const birthdaysToGreet = birthdays.filter((b) => !greeted.has(b.patientId));
  const evaluated = new Set(clinicStorage.getEvaluations().map((e) => e.patientId));
  const notEvaluated = activePatients.filter((p) => !evaluated.has(p.id));
  const noWorkout = activePatients.filter((p) => !clinicStorage.getWorkoutPlanByPatientId(p.id));

  type Todo = { key: string; icon: React.ElementType; tone: AlertTone; title: string; detail: string; count: number; go: () => void };
  const todos: Todo[] = [
    canSeeFinance && overdue.length > 0 && {
      key: 'overdue',
      icon: DollarSign,
      tone: 'rose' as const,
      title: 'Cobranças vencidas',
      detail: `${formatCurrency(overdueCents)} • ${[...new Set(overdue.map((c) => c.patientName.split(' ')[0]))].join(', ')}`,
      count: overdue.length,
      go: () => onNavigate('financial'),
    },
    renewals.length > 0 && {
      key: 'renew',
      icon: CreditCard,
      tone: 'rose' as const,
      title: 'Planos acabando',
      detail: renewals.map((p) => `${p.name.split(' ')[0]} (${p.sessionsRemaining})`).join(', '),
      count: renewals.length,
      go: () => onNavigate('patients'),
    },
    toConfirm > 0 && {
      key: 'confirm',
      icon: Clock,
      tone: 'blue' as const,
      title: 'Sessões a confirmar hoje',
      detail: today.filter((a) => a.status === 'agendado').map((a) => `${a.startTime} ${a.patientName.split(' ')[0]}`).join(', '),
      count: toConfirm,
      go: () => onNavigate('schedule'),
    },
    birthdaysToGreet.length > 0 && {
      key: 'bday',
      icon: Cake,
      tone: 'amber' as const,
      title: 'Aniversários para parabenizar',
      detail: birthdaysToGreet.map((b) => `${b.patientName.split(' ')[0]} (${b.daysUntil === 0 ? 'hoje' : `em ${b.daysUntil}d`})`).join(', '),
      count: birthdaysToGreet.length,
      go: () => onNavigate('birthdays'),
    },
    canSeeClinical && notEvaluated.length > 0 && {
      key: 'eval',
      icon: ClipboardCheck,
      tone: 'amber' as const,
      title: 'Alunos sem avaliação',
      detail: notEvaluated.map((p) => p.name.split(' ')[0]).join(', '),
      count: notEvaluated.length,
      go: () => onNavigate('evaluations'),
    },
    noWorkout.length > 0 && {
      key: 'workout',
      icon: Dumbbell,
      tone: 'slate' as const,
      title: 'Alunos sem ficha de treino',
      detail: noWorkout.map((p) => p.name.split(' ')[0]).join(', '),
      count: noWorkout.length,
      go: () => onNavigate('planning'),
    },
  ].filter(Boolean) as Todo[];

  const summary = [
    `${todayActive.length} sessão(ões) hoje`,
    inProgress ? `${inProgress} em atendimento` : null,
    todos.length ? `${todos.reduce((n, t) => n + t.count, 0)} pendências` : 'tudo em dia',
  ]
    .filter(Boolean)
    .join(' • ');

  const statusTone = (s: string): AlertTone =>
    s === 'realizado' ? 'green' : s === 'confirmado' ? 'blue' : s === 'em_atendimento' ? 'amber' : s === 'faltou' || s === 'cancelado' ? 'rose' : 'slate';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#426B5B] dark:text-[#7FB39F]">
            {cap(format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR }))}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            {greeting}, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">{summary}</p>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2">
          <button
            onClick={() => onNavigate('schedule', { action: 'new' })}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
          >
            <Calendar className="w-4 h-4" /> <span>Agendar</span>
          </button>
          <button
            onClick={() => onNavigate('patients', { action: 'new' })}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-xs sm:text-sm font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" /> <span>Paciente</span>
          </button>
          {canSeeFinance && (
            <button
              onClick={() => onNavigate('financial', { action: 'new_charge' })}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-xs sm:text-sm font-semibold rounded-lg"
            >
              <DollarSign className="w-4 h-4" /> <span>Cobrança</span>
            </button>
          )}
        </div>
      </div>

      {/* Birthday banner */}
      {birthdays.length > 0 && (
        <div className="p-3 sm:p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/20 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <Cake className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-sm text-amber-900 dark:text-amber-200">
                {birthdays[0].daysUntil === 0
                  ? `Hoje é o aniversário de ${birthdays[0].patientName} (${birthdays[0].age} anos)`
                  : `${birthdays[0].patientName} faz aniversário em ${birthdays[0].daysUntil} dia(s)`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300/90">
                {birthdays.length} aniversário(s) nos próximos 3 dias • {birthdays.length - birthdaysToGreet.length} já parabenizado(s)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {greeted.has(birthdays[0].patientId) ? (
              <span className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Parabenizado
              </span>
            ) : (
              <button
                onClick={() => {
                  const b = birthdays[0];
                  openExternalLink(buildWhatsAppLink(b.whatsapp, buildBirthdayMessage(settings, b.patientName)));
                  clinicStorage.markBirthdayGreeted(b.patientId, userName);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold rounded-lg"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Parabenizar
              </button>
            )}
            <button onClick={onOpenBirthdayPopup} className="px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/60 hover:bg-amber-300 rounded-lg">
              Ver todos
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Sessões hoje"
          value={
            <span>
              {doneToday}
              <span className="text-sm font-semibold text-[#64748B]">/{todayActive.length} realizadas</span>
            </span>
          }
          hint={`${inProgress} em atendimento • ${toConfirm} a confirmar`}
          icon={Calendar}
          tone="blue"
          onClick={() => onNavigate('schedule')}
        />
        <StatCard
          label="Frequência do mês"
          value={freq === null ? '—' : `${freq}%`}
          hint={freq === null ? 'sem sessões encerradas no mês' : `${monthDone} presenças • ${monthMissed} falta(s)`}
          icon={CheckCircle2}
          tone={freq === null || freq >= 80 ? 'green' : freq >= 60 ? 'amber' : 'rose'}
          onClick={() => onNavigate('presence')}
        />
        {canSeeFinance ? (
          <StatCard
            label="Recebido no mês"
            value={<span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(monthIn)}</span>}
            hint={overdueCents ? `${formatCurrency(overdueCents)} vencido` : inDelta === null ? 'sem base no mês anterior' : `${inDelta >= 0 ? '▲' : '▼'} ${Math.abs(inDelta)}% vs. mês anterior`}
            icon={TrendingUp}
            onClick={() => onNavigate('financial')}
          />
        ) : (
          <StatCard label="Avaliações pendentes" value={notEvaluated.length} hint="alunos ativos sem avaliação" icon={ClipboardCheck} tone="amber" onClick={() => onNavigate('evaluations')} />
        )}
        <StatCard
          label="Pacientes ativos"
          value={activePatients.length}
          hint={`${newThisMonth} novo(s) no mês • ${renewals.length} para renovar`}
          icon={Users}
          tone="slate"
          onClick={() => onNavigate('patients')}
        />
      </div>

      {/* Today + pending */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" /> Agenda de hoje
            </span>
          }
          action={
            <button onClick={() => onNavigate('schedule')} className="text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline flex items-center gap-0.5">
              Abrir agenda <ArrowUpRight className="w-3 h-3" />
            </button>
          }
          className="lg:col-span-2"
        >
          {rows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#64748B]">Nenhuma sessão agendada para hoje.</p>
              <button onClick={() => onNavigate('schedule', { action: 'new' })} className="mt-2 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
                + Agendar sessão
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {rows.map((r) => {
                const a = r.first;
                const isNow = nowMin >= toMin(a.startTime) && nowMin < toMin(a.startTime) + (a.durationMinutes || 50);
                const startable = r.appts.find((x) => x.status === 'agendado' || x.status === 'confirmado' || x.status === 'em_atendimento');
                const p = patients.find((x) => x.id === a.patientId);
                return (
                  <li key={r.key} className={`py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 ${isNow ? 'bg-[#E9F1EC]/60 dark:bg-[#1F332A]/60 -mx-3 px-3 rounded-lg' : ''}`}>
                    <span className="w-12 shrink-0">
                      <span className={`block font-mono text-xs font-bold ${isNow ? 'text-[#426B5B] dark:text-[#7FB39F]' : ''}`}>{a.startTime}</span>
                      {isNow && <span className="block text-[9px] font-bold uppercase text-rose-600">agora</span>}
                    </span>
                    <Avatar name={r.isClass ? a.modality : a.patientName} size="sm" />
                    <div className="flex-1 min-w-[9rem]">
                      <p className="text-sm font-semibold leading-tight">
                        {r.isClass ? `Turma de ${a.modality} (${r.appts.length})` : a.patientName}
                      </p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {r.isClass ? r.appts.map((x) => x.patientName.split(' ')[0]).join(', ') : a.modality} • {a.professionalName}
                        {!r.isClass && p?.clinicalAlerts?.[0] && (
                          <span className="text-amber-700 dark:text-amber-400"> • ⚠ {p.clinicalAlerts[0]}</span>
                        )}
                      </p>
                    </div>
                    {!r.isClass && <Pill tone={statusTone(a.status)}>{STATUS_LABELS[a.status] || a.status}</Pill>}
                    {startable && (
                      <button
                        onClick={() => onNavigate('attendance', { appointmentId: startable.id, patientId: startable.patientId })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg"
                      >
                        <Play className="w-3 h-3 fill-current" /> {startable.status === 'em_atendimento' ? 'Continuar' : 'Atender'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Pendências
            </span>
          }
          action={<span className="text-[11px] text-[#64748B]">{todos.reduce((s, t) => s + t.count, 0)} item(ns)</span>}
        >
          {todos.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#64748B] flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tudo em dia!
            </p>
          ) : (
            <ul className="space-y-2">
              {todos.map((t) => (
                <li key={t.key}>
                  <button onClick={t.go} className="w-full flex items-start gap-3 p-2.5 rounded-lg border border-[#E5EAE7] dark:border-[#273830] hover:border-[#426B5B] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-left">
                    <span
                      className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                        {
                          rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300',
                          amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300',
                          blue: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300',
                          green: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600',
                          slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                        }[t.tone]
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{t.title}</span>
                        <Pill tone={t.tone}>{t.count}</Pill>
                      </span>
                      <span className="block text-[11px] text-[#64748B] truncate">{t.detail}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8] self-center" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {canSeeFinance && (
          <Card
            title="Receitas × despesas (6 meses)"
            className="lg:col-span-2"
            action={
              <button onClick={() => onNavigate('financial')} className="text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline flex items-center gap-0.5">
                Financeiro <ArrowUpRight className="w-3 h-3" />
              </button>
            }
          >
            <IncomeExpenseChart series={series} />
          </Card>
        )}
        <Card title="Próximos 7 dias" className={canSeeFinance ? '' : 'lg:col-span-3'}>
          <ul className="space-y-2.5">
            {week.map((w, i) => (
              <li key={w.key}>
                <button
                  onClick={() => onNavigate('schedule')}
                  className="w-full grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 text-xs text-left hover:opacity-80"
                  title={`${w.count} sessão(ões), ${w.confirmed} confirmada(s)`}
                >
                  <span className={i === 0 ? 'font-bold text-[#426B5B] dark:text-[#7FB39F]' : 'text-[#475569] dark:text-[#9AA8B6]'}>
                    {i === 0 ? 'Hoje' : cap(format(w.d, 'EEE dd', { locale: ptBR }))}
                  </span>
                  <span className="h-2 rounded-full bg-[#E5EAE7] dark:bg-[#273830] overflow-hidden">
                    <span className="block h-full rounded-full bg-[#13875E] dark:bg-[#2FA877]" style={{ width: `${(w.count / weekMax) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold">{w.count || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[#64748B]">
            {week.reduce((s, w) => s + w.count, 0)} sessões agendadas na semana • {week.reduce((s, w) => s + w.confirmed, 0)} confirmadas
          </p>
        </Card>
      </div>
    </div>
  );
};
