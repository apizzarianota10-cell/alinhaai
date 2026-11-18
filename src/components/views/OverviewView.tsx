import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Cake,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  FileSpreadsheet,
  MessageCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { clinicStorage } from '../../lib/storage';
import { format, subMonths } from 'date-fns';
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
} from '../../lib/utils';
import { Patient, Appointment, Charge, Expense, BirthdayAlert } from '../../types';

interface OverviewViewProps {
  onNavigate: (section: string, payload?: any) => void;
  onOpenBirthdayPopup: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate, onOpenBirthdayPopup }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState(clinicStorage.getSettings());

  useEffect(() => {
    const load = () => {
      setPatients(clinicStorage.getPatients());
      setAppointments(clinicStorage.getAppointments());
      setCharges(clinicStorage.getCharges());
      setExpenses(clinicStorage.getExpenses());
      setSettings(clinicStorage.getSettings());
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const todayStr = toLocalDateKey();
  const todayAppointments = appointments
    .filter((a) => a.date === todayStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const activeCharges = charges.filter(isChargeActive);

  // Indicators calculation
  const totalPatients = patients.length;
  const activePatients = patients.filter((p) => p.status === 'ativo').length;
  const inactivePatients = patients.filter((p) => p.status !== 'ativo').length;

  const scheduledToday = todayAppointments.filter((a) => a.status === 'agendado' || a.status === 'confirmado').length;
  const inProgressToday = todayAppointments.filter((a) => a.status === 'em_atendimento').length;
  const completedToday = todayAppointments.filter((a) => a.status === 'realizado').length;
  const cancelledToday = todayAppointments.filter((a) => a.status === 'cancelado').length;
  const missedToday = todayAppointments.filter((a) => a.status === 'faltou').length;

  const totalReceivedCents = activeCharges.reduce((acc, c) => acc + (c.paidAmountCents || 0), 0);
  const totalPendingCents = activeCharges.reduce((acc, c) => acc + Math.max(0, c.finalAmountCents - (c.paidAmountCents || 0)), 0);
  const overdueCharges = charges.filter((c) => getChargeDisplayStatus(c, todayStr) === 'vencido');
  const totalExpensesCents = expenses.filter((e) => e.isPaid).reduce((acc, e) => acc + e.amountCents, 0);
  const netCashflowCents = totalReceivedCents - totalExpensesCents;

  const birthdayAlerts = getBirthdayAlerts(patients, new Date(), settings.leapYearFeb29Rule);
  const upcomingBirthdays = birthdayAlerts.filter((b) => b.daysUntil <= 3);

  // Patients with sessions ending soon (<= 1)
  const expiringPatients = patients.filter((p) => p.status === 'ativo' && p.sessionsRemaining <= 1);

  // Chart 1: Revenue by Payment Method
  const paymentMethodMap: Record<string, number> = {};
  activeCharges.forEach((c) => {
    c.payments.forEach((p) => {
      paymentMethodMap[p.method] = (paymentMethodMap[p.method] || 0) + p.amountCents;
    });
  });
  const paymentMethodData = Object.entries(paymentMethodMap).map(([method, val]) => ({
    name:
      method === 'pix'
        ? 'Pix'
        : method === 'dinheiro'
        ? 'Dinheiro'
        : method === 'cartao_credito'
        ? 'Cartão Crédito'
        : method === 'cartao_debito'
        ? 'Cartão Débito'
        : 'Outros',
    value: val / 100,
  }));
  const PIE_COLORS = ['#426B5B', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

  // Chart 2: real cash movements of the last 6 months (payments received vs. expenses paid)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = subMonths(new Date(), 5 - i);
    const key = format(monthDate, 'yyyy-MM');
    const receitas = activeCharges.reduce(
      (sum, c) =>
        sum + c.payments.filter((p) => toLocalDateKey(p.date).startsWith(key)).reduce((s, p) => s + p.amountCents, 0),
      0
    );
    const despesas = expenses
      .filter((e) => e.isPaid && (e.paymentDate || e.dueDate).startsWith(key))
      .reduce((s, e) => s + e.amountCents, 0);
    const label = format(monthDate, 'MMM', { locale: ptBR });
    return { month: label.charAt(0).toUpperCase() + label.slice(1), receitas: receitas / 100, despesas: despesas / 100 };
  });

  const handleStartAttendanceFromCard = (appt: Appointment) => {
    onNavigate('attendance', { appointmentId: appt.id, patientId: appt.patientId });
  };

  const handleSendWhatsAppBday = (alert: BirthdayAlert) => {
    openExternalLink(buildWhatsAppLink(alert.whatsapp, buildBirthdayMessage(settings, alert.patientName)));
  };

  const role = clinicStorage.getCurrentUser().role;
  const canSeeFinance = canAccessSection('financial', role);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#426B5B] dark:text-[#7FB39F]">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            {greeting}, {clinicStorage.getCurrentUser().name.split(' (')[0]}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Visão integrada de atendimentos, pacientes, faturamento e alertas em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('patients', { action: 'new' })}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Paciente</span>
          </button>
          <button
            onClick={() => onNavigate('schedule', { action: 'new' })}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#E9F1EC] dark:bg-[#1F332A] hover:bg-[#d6e5dc] text-[#426B5B] dark:text-[#5A8E7A] text-xs sm:text-sm font-semibold rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
          {canSeeFinance && <button
            onClick={() => onNavigate('financial', { action: 'new_charge' })}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F8FAF9] dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] text-[#17231D] dark:text-[#F1F5F3] text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Nova Cobrança</span>
          </button>}
          <button
            onClick={() => onNavigate('reports')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F8FAF9] dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] text-[#17231D] dark:text-[#F1F5F3] text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Gerar Relatório</span>
          </button>
        </div>
      </div>

      {/* Birthday Spotlight Banner (if any birthday today or in 3 days) */}
      {upcomingBirthdays.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Cake className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-900 dark:text-amber-200">
                  {upcomingBirthdays[0].daysUntil === 0
                    ? `Hoje é o aniversário de ${upcomingBirthdays[0].patientName}!`
                    : `Aniversário próximo: ${upcomingBirthdays[0].patientName} em ${upcomingBirthdays[0].daysUntil} dia(s)!`}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  {upcomingBirthdays[0].age} anos
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                Total de {upcomingBirthdays.length} paciente(s) com aniversário no radar de 3 dias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => handleSendWhatsAppBday(upcomingBirthdays[0])}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Enviar Parabéns (WhatsApp)</span>
            </button>
            <button
              onClick={onOpenBirthdayPopup}
              className="px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/60 hover:bg-amber-300 rounded-lg transition-colors"
            >
              Ver Todos
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pacientes */}
        <div
          onClick={() => onNavigate('patients')}
          className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs hover:border-[#426B5B] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Pacientes
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#E9F1EC] dark:bg-[#1F332A] flex items-center justify-center text-[#426B5B] dark:text-[#5A8E7A]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#17231D] dark:text-[#F1F5F3]">
              {totalPatients}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">
              {activePatients} ativos
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            {inactivePatients} inativo(s) ou arquivado(s)
          </p>
        </div>

        {/* Card 2: Atendimentos Hoje */}
        <div
          onClick={() => onNavigate('schedule')}
          className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs hover:border-[#426B5B] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Sessões Hoje
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#17231D] dark:text-[#F1F5F3]">
              {todayAppointments.length}
            </span>
            <span className="text-xs text-blue-600 font-semibold">
              {completedToday} realizadas
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            {scheduledToday} agendadas • {inProgressToday} em curso
          </p>
        </div>

        {/* Cards 3 & 4: financial figures only for roles with access to the financial module */}
        {canSeeFinance && (<>
        {/* Card 3: Receita Recebida no Mês */}
        <div
          onClick={() => onNavigate('financial')}
          className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs hover:border-[#426B5B] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Receita Efetiva
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(totalReceivedCents)}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            Pendente: {formatCurrency(totalPendingCents)}
          </p>
        </div>

        {/* Card 4: Resultado Financeiro */}
        <div
          onClick={() => onNavigate('financial')}
          className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs hover:border-[#426B5B] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Resultado de Caixa
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-bold ${
                netCashflowCents >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-600'
              }`}
            >
              {formatCurrency(netCashflowCents)}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            Despesas Pagas: {formatCurrency(totalExpensesCents)}
          </p>
        </div>
        </>)}
      </div>

      {/* Main Row: Today's Schedule Table & Clinical/Administrative Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Today's Schedule (2 cols wide on desktop) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#E5EAE7] dark:border-[#273830] flex items-center justify-between bg-[#F8FAF9]/50 dark:bg-[#111A15]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
              <h2 className="text-sm font-bold text-[#17231D] dark:text-[#F1F5F3]">
                Visão do Dia • Atendimentos Individuais
              </h2>
            </div>
            <button
              onClick={() => onNavigate('schedule')}
              className="text-xs font-semibold text-[#426B5B] dark:text-[#5A8E7A] hover:underline flex items-center gap-1"
            >
              <span>Ver agenda completa</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830] overflow-y-auto max-h-[380px]">
            {todayAppointments.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] text-xs">
                Nenhum agendamento marcado para hoje.
              </div>
            ) : (
              todayAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-3.5 flex items-center justify-between hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-[#17231D] dark:text-[#F1F5F3] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {appt.startTime}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-[#17231D] dark:text-[#F1F5F3]">
                          {appt.patientName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A]">
                          {appt.modality}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Prof: {appt.professionalName}
                        {appt.notes ? ` • ${appt.notes}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        appt.status === 'confirmado'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                          : appt.status === 'em_atendimento'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse'
                          : appt.status === 'realizado'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {STATUS_LABELS[appt.status] || appt.status}
                    </span>

                    {(appt.status === 'agendado' || appt.status === 'confirmado' || appt.status === 'em_atendimento') && (
                      <button
                        onClick={() => handleStartAttendanceFromCard(appt)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#426B5B] hover:bg-[#345648] text-white text-[11px] font-semibold rounded-md transition-transform active:scale-95 shadow-xs"
                        title="Conduzir atendimento individual agora"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="hidden sm:inline">Iniciar</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Administrative & Clinical Alerts */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-[#17231D] dark:text-[#F1F5F3] uppercase tracking-wider">
                  Alertas & Pendências
                </h3>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {/* Alert: Sessions finishing */}
              {expiringPatients.length > 0 ? (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                      Sessões Acabando (Renovação)
                    </span>
                    <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">
                      {expiringPatients.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                    {expiringPatients.map((p) => `${p.name} (${p.sessionsRemaining} rest.)`).join(', ')}
                  </p>
                </div>
              ) : null}

              {/* Alert: Overdue charges */}
              {canSeeFinance && overdueCharges.length > 0 && (
                <button
                  onClick={() => onNavigate('financial')}
                  className="w-full text-left p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">Cobranças Vencidas</span>
                    <span className="text-[10px] font-bold bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100 px-1.5 py-0.5 rounded">
                      {overdueCharges.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                    {overdueCharges.map((c) => c.patientName.split(' ')[0]).join(', ')}
                  </p>
                </button>
              )}

              {/* Alert: Pending payments */}
              {canSeeFinance && totalPendingCents > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Mensalidades Pendentes
                    </span>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
                      {formatCurrency(totalPendingCents)}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    Cobranças em aberto aguardando recebimento no mês.
                  </p>
                </div>
              )}

              {/* Today's cancellations or absences */}
              {missedToday > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Faltas Registradas Hoje
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {missedToday}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    Consulte as regras de reposição em Configurações.
                  </p>
                </div>
              )}

              {expiringPatients.length === 0 && overdueCharges.length === 0 && totalPendingCents === 0 && missedToday === 0 && (
                <div className="py-4 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                  Tudo em dia por aqui.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid (financial) */}
      {canSeeFinance && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Receitas e Despesas Mensais */}
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-bold text-[#17231D] dark:text-[#F1F5F3] uppercase tracking-wider mb-4">
            Receitas x Despesas — últimos 6 meses (R$)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  formatter={(val: any) => [
                    formatCurrency(Number(val || 0) * 100),
                    '',
                  ]}
                  contentStyle={{
                    backgroundColor: '#17231D',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="receitas" fill="#426B5B" name="Receita" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="#E11D48" name="Despesa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Receita por Forma de Pagamento */}
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-bold text-[#17231D] dark:text-[#F1F5F3] uppercase tracking-wider mb-4">
            Distribuição de Receita por Forma de Pagamento
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            {paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [
                      formatCurrency(Number(val || 0) * 100),
                      'Valor',
                    ]}
                    contentStyle={{
                      backgroundColor: '#17231D',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-[#64748B]">Nenhum pagamento registrado ainda</p>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
};
