import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  Users,
  DollarSign,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Cake,
  TrendingUp,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { startOfWeek, endOfWeek } from 'date-fns';
import {
  formatCurrency,
  formatDate,
  exportToCSV,
  getBirthdayAlerts,
  toLocalDateKey,
  isChargeActive,
  getChargeDisplayStatus,
  STATUS_LABELS,
  printElement,
} from '../../lib/utils';
import { Patient, Appointment, Charge, Expense, Professional, BirthdayAlert } from '../../types';
import { Modal } from '../common/Modal';
import { StatCard, Pill, Card, AlertTone } from '../common/Insights';
import { useToast } from '../common/Toast';

export const ReportsView: React.FC = () => {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [settings, setSettings] = useState(clinicStorage.getSettings());
  const [birthdayAlerts, setBirthdayAlerts] = useState<BirthdayAlert[]>([]);

  // Report Type Selection
  const [reportType, setReportType] = useState<
    'atendimentos' | 'pacientes' | 'financeiro' | 'frequencia' | 'aniversariantes'
  >('atendimentos');

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'mes_atual' | 'hoje' | 'semana' | 'ano'>('mes_atual');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      const pts = clinicStorage.getPatients();
      const appts = clinicStorage.getAppointments();
      const chgs = clinicStorage.getCharges();
      const exps = clinicStorage.getExpenses();
      const profs = clinicStorage.getProfessionals();
      const stgs = clinicStorage.getSettings();

      setPatients(pts);
      setAppointments(appts);
      setCharges(chgs);
      setExpenses(exps);
      setProfessionals(profs);
      setSettings(stgs);

      const bdays = getBirthdayAlerts(pts, new Date(), stgs.leapYearFeb29Rule);
      setBirthdayAlerts(bdays);
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  // Period window (local dates, YYYY-MM-DD strings compare chronologically)
  const today = toLocalDateKey();
  const inPeriod = (dateStr: string) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (periodFilter === 'hoje') return d === today;
    if (periodFilter === 'semana') {
      const start = toLocalDateKey(startOfWeek(new Date(), { weekStartsOn: 1 }));
      const end = toLocalDateKey(endOfWeek(new Date(), { weekStartsOn: 1 }));
      return d >= start && d <= end;
    }
    if (periodFilter === 'mes_atual') return d.startsWith(today.slice(0, 7));
    return d.startsWith(today.slice(0, 4)); // ano
  };

  const filteredAppointments = appointments
    .filter((a) => inPeriod(a.date))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const filteredCharges = charges.filter((c) => inPeriod(c.dueDate));

  // Frequency statistics: only past/closed sessions count towards the attendance rate
  const totalAttended = filteredAppointments.filter((a) => a.status === 'realizado').length;
  const totalScheduled = filteredAppointments.filter((a) => a.status === 'agendado' || a.status === 'confirmado').length;
  const totalCancelled = filteredAppointments.filter((a) => a.status === 'cancelado').length;
  const totalMissed = filteredAppointments.filter((a) => a.status === 'faltou').length;
  const attendanceBase = totalAttended + totalMissed;
  const attendanceRate = attendanceBase > 0 ? Math.round((totalAttended / attendanceBase) * 100) : 100;
  const periodRevenueCents = charges
    .filter(isChargeActive)
    .flatMap((c) => c.payments)
    .filter((p) => inPeriod(toLocalDateKey(p.date)))
    .reduce((sum, p) => sum + p.amountCents, 0);

  const handleExportCSV = () => {
    if (reportType === 'atendimentos') {
      const data = filteredAppointments.map((a) => ({
        Data: a.date,
        Horario: a.startTime,
        Paciente: a.patientName,
        Profissional: a.professionalName,
        Modalidade: a.modality,
        Status: a.status,
      }));
      exportToCSV(data, `relatorio_atendimentos_${periodFilter}`);
    } else if (reportType === 'pacientes') {
      const data = patients.map((p) => ({
        Nome: p.name,
        CPF: p.cpf || '-',
        Nascimento: p.birthDate,
        Telefone: p.phone,
        Status: p.status,
        Modalidade: p.modality,
        SessoesRestantes: p.sessionsRemaining,
        SessoesTotal: p.sessionsTotal,
        SessoesConcluidas: p.sessionsCompleted,
      }));
      exportToCSV(data, `relatorio_pacientes_${periodFilter}`);
    } else if (reportType === 'financeiro') {
      const data = filteredCharges.map((c) => ({
        Paciente: c.patientName,
        Descricao: c.description,
        Vencimento: c.dueDate,
        ValorTotal: (c.finalAmountCents / 100).toFixed(2),
        ValorPago: (c.paidAmountCents / 100).toFixed(2),
        Status: getChargeDisplayStatus(c, today),
        MetodoPagamento: c.payments?.[0]?.method || '-',
      }));
      exportToCSV(data, `relatorio_financeiro_${periodFilter}`);
    } else if (reportType === 'frequencia') {
      const data = filteredAppointments.map((a) => ({
        Data: a.date,
        Horario: a.startTime,
        Paciente: a.patientName,
        Profissional: a.professionalName,
        Status: a.status,
        Justificativa: a.cancellationReason || a.notes || '-',
      }));
      exportToCSV(data, `relatorio_frequencia_${periodFilter}`);
    } else if (reportType === 'aniversariantes') {
      const data = birthdayAlerts.map((b) => ({
        Paciente: b.patientName,
        DataNascimento: b.birthDate,
        ProximoAniversario: b.nextBirthday,
        DiasRestantes: b.daysUntil,
        IdadeACompletar: b.age,
        Telefone: b.whatsapp,
      }));
      exportToCSV(data, `relatorio_aniversariantes_${periodFilter}`);
    }
    showToast('Exportação concluída com sucesso!', 'success');
  };

  // ───────────── presentation ─────────────
  const canSeeFinance = ['admin', 'receptionist'].includes(clinicStorage.getCurrentUser().role);
  const REPORTS = [
    { id: 'atendimentos' as const, label: 'Atendimentos', desc: 'Sessões do período', icon: Calendar },
    { id: 'pacientes' as const, label: 'Pacientes', desc: 'Planos e saldo de sessões', icon: Users },
    ...(canSeeFinance ? [{ id: 'financeiro' as const, label: 'Financeiro', desc: 'Cobranças e recebimentos', icon: DollarSign }] : []),
    { id: 'frequencia' as const, label: 'Frequência', desc: 'Presenças, faltas e cancelamentos', icon: CheckCircle2 },
    { id: 'aniversariantes' as const, label: 'Aniversários', desc: 'Próximos aniversários', icon: Cake },
  ];
  const PERIODS = [
    ['hoje', 'Hoje'],
    ['semana', 'Esta semana'],
    ['mes_atual', 'Este mês'],
    ['ano', 'Este ano'],
  ] as const;

  const apptTone = (s: string): AlertTone =>
    s === 'realizado' ? 'green' : s === 'confirmado' ? 'blue' : s === 'em_atendimento' ? 'amber' : s === 'faltou' || s === 'cancelado' ? 'rose' : 'slate';
  const chargeTone = (s: string): AlertTone => (s === 'pago' ? 'green' : s === 'parcialmente_pago' || s === 'pendente' ? 'amber' : s === 'vencido' || s === 'estornado' ? 'rose' : 'slate');

  type Col<T> = { h: string; cell: (r: T) => React.ReactNode; className?: string };
  const pill = (tone: AlertTone, text: string) => <Pill tone={tone}>{text}</Pill>;

  // one definition drives the table (desktop) and the cards (phones)
  const report = (() => {
    if (reportType === 'atendimentos')
      return {
        rows: filteredAppointments as any[],
        kpis: [
          { label: 'Sessões no período', value: filteredAppointments.filter((a) => a.status !== 'cancelado' && a.status !== 'reagendado').length, icon: Calendar, tone: 'blue' as const },
          { label: 'Realizadas', value: totalAttended, icon: CheckCircle2, tone: 'green' as const },
          { label: 'A realizar', value: totalScheduled, icon: Clock, tone: 'slate' as const },
          { label: 'Faltas / cancelamentos', value: `${totalMissed} / ${totalCancelled}`, icon: Activity, tone: 'rose' as const },
        ],
        cols: [
          { h: 'Data e hora', cell: (a: Appointment) => <span className="font-mono">{formatDate(a.date)} {a.startTime}</span> },
          { h: 'Paciente', cell: (a: Appointment) => <b>{a.patientName}</b> },
          { h: 'Profissional', cell: (a: Appointment) => a.professionalName },
          { h: 'Modalidade', cell: (a: Appointment) => a.modality },
          { h: 'Status', cell: (a: Appointment) => pill(apptTone(a.status), STATUS_LABELS[a.status] || a.status) },
        ] as Col<any>[],
        empty: 'Nenhum atendimento no período.',
      };
    if (reportType === 'pacientes')
      return {
        rows: patients as any[],
        kpis: [
          { label: 'Pacientes', value: patients.length, icon: Users, tone: 'slate' as const },
          { label: 'Ativos', value: patients.filter((p) => p.status === 'ativo').length, icon: CheckCircle2, tone: 'green' as const },
          { label: 'Sessões a realizar', value: patients.filter((p) => p.status === 'ativo').reduce((s, p) => s + p.sessionsRemaining, 0), icon: Calendar, tone: 'blue' as const },
          { label: 'Precisam renovar', value: patients.filter((p) => p.status === 'ativo' && p.sessionsRemaining <= 2).length, icon: TrendingUp, tone: 'rose' as const },
        ],
        cols: [
          { h: 'Paciente', cell: (p: Patient) => <b>{p.name}</b> },
          { h: 'Nascimento', cell: (p: Patient) => formatDate(p.birthDate) },
          { h: 'Telefone', cell: (p: Patient) => <span className="font-mono">{p.phone}</span> },
          {
            h: 'Sessões',
            cell: (p: Patient) => (
              <span className={p.sessionsRemaining <= 2 ? 'text-rose-600 font-bold' : 'font-semibold'}>
                {p.sessionsRemaining} de {p.sessionsTotal} <span className="text-[#64748B] font-normal">({p.sessionsCompleted} realizadas)</span>
              </span>
            ),
          },
          { h: 'Status', cell: (p: Patient) => pill(p.status === 'ativo' ? 'green' : p.status === 'inativo' ? 'amber' : 'slate', STATUS_LABELS[p.status] || p.status) },
        ] as Col<any>[],
        empty: 'Nenhum paciente cadastrado.',
      };
    if (reportType === 'financeiro') {
      const billed = filteredCharges.filter(isChargeActive).reduce((s, c) => s + c.finalAmountCents, 0);
      const open = filteredCharges.filter(isChargeActive).reduce((s, c) => s + Math.max(0, c.finalAmountCents - (c.paidAmountCents || 0)), 0);
      const late = filteredCharges.filter((c) => getChargeDisplayStatus(c, today) === 'vencido').length;
      return {
        rows: filteredCharges as any[],
        kpis: [
          { label: 'Faturado (vencimentos)', value: formatCurrency(billed), icon: DollarSign, tone: 'slate' as const },
          { label: 'Recebido no período', value: formatCurrency(periodRevenueCents), icon: CheckCircle2, tone: 'green' as const },
          { label: 'Em aberto', value: formatCurrency(open), icon: Clock, tone: 'amber' as const },
          { label: 'Vencidas', value: late, icon: Activity, tone: 'rose' as const },
        ],
        cols: [
          { h: 'Paciente', cell: (c: Charge) => <b>{c.patientName}</b> },
          { h: 'Descrição', cell: (c: Charge) => c.description },
          { h: 'Vencimento', cell: (c: Charge) => <span className="font-mono">{formatDate(c.dueDate)}</span> },
          { h: 'Valor', cell: (c: Charge) => <b>{formatCurrency(c.finalAmountCents)}</b>, className: 'text-right' },
          { h: 'Pago', cell: (c: Charge) => formatCurrency(c.paidAmountCents), className: 'text-right' },
          { h: 'Status', cell: (c: Charge) => pill(chargeTone(getChargeDisplayStatus(c, today)), STATUS_LABELS[getChargeDisplayStatus(c, today)]) },
        ] as Col<any>[],
        empty: 'Nenhuma cobrança com vencimento no período.',
      };
    }
    if (reportType === 'frequencia')
      return {
        rows: filteredAppointments as any[],
        kpis: [
          { label: 'Taxa de presença', value: attendanceBase ? `${attendanceRate}%` : '—', icon: TrendingUp, tone: 'green' as const },
          { label: 'Presenças', value: totalAttended, icon: CheckCircle2, tone: 'blue' as const },
          { label: 'Faltas', value: totalMissed, icon: Activity, tone: 'rose' as const },
          { label: 'Cancelamentos', value: totalCancelled, icon: Clock, tone: 'amber' as const },
        ],
        cols: [
          { h: 'Data', cell: (a: Appointment) => <span className="font-mono">{formatDate(a.date)}</span> },
          { h: 'Paciente', cell: (a: Appointment) => <b>{a.patientName}</b> },
          { h: 'Profissional', cell: (a: Appointment) => a.professionalName },
          { h: 'Status', cell: (a: Appointment) => pill(apptTone(a.status), STATUS_LABELS[a.status] || a.status) },
          { h: 'Observações', cell: (a: Appointment) => <span className="text-[#64748B]">{a.cancellationReason || a.notes || '—'}</span> },
        ] as Col<any>[],
        empty: 'Nenhuma sessão no período.',
      };
    return {
      rows: birthdayAlerts as any[],
      kpis: [
        { label: 'Hoje', value: birthdayAlerts.filter((b) => b.daysUntil === 0).length, icon: Cake, tone: 'amber' as const },
        { label: 'Próximos 7 dias', value: birthdayAlerts.filter((b) => b.daysUntil <= 7).length, icon: Calendar, tone: 'blue' as const },
        { label: 'Próximos 30 dias', value: birthdayAlerts.filter((b) => b.daysUntil <= 30).length, icon: Clock, tone: 'slate' as const },
        { label: 'Com data cadastrada', value: birthdayAlerts.length, icon: Users, tone: 'green' as const },
      ],
      cols: [
        { h: 'Paciente', cell: (b: BirthdayAlert) => <b>{b.patientName}</b> },
        { h: 'Nascimento', cell: (b: BirthdayAlert) => formatDate(b.birthDate) },
        { h: 'Próximo aniversário', cell: (b: BirthdayAlert) => b.nextBirthday },
        { h: 'Idade', cell: (b: BirthdayAlert) => `${b.age} anos` },
        { h: 'WhatsApp', cell: (b: BirthdayAlert) => <span className="font-mono">{b.whatsapp}</span> },
        { h: 'Prazo', cell: (b: BirthdayAlert) => pill(b.daysUntil === 0 ? 'amber' : b.daysUntil <= 7 ? 'blue' : 'slate', b.daysUntil === 0 ? 'Hoje' : b.daysUntil === 1 ? 'Amanhã' : `Em ${b.daysUntil} dias`) },
      ] as Col<any>[],
      empty: 'Nenhum paciente com data de nascimento.',
    };
  })();
  const usesPeriod = reportType !== 'pacientes' && reportType !== 'aniversariantes';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Relatórios
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">Escolha o relatório e o período, confira o resumo e exporte em CSV ou imprima em PDF.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button
            onClick={() => setPrintModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
          >
            <Printer className="w-4 h-4 text-[#426B5B]" /> Imprimir / PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Report picker */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:overflow-visible">
        {REPORTS.map((r) => {
          const on = r.id === reportType;
          return (
            <button
              key={r.id}
              onClick={() => setReportType(r.id)}
              aria-pressed={on}
              className={`shrink-0 w-44 lg:w-auto text-left p-3 rounded-xl border transition-colors ${
                on ? 'border-[#426B5B] bg-[#E9F1EC] dark:bg-[#1F332A]' : 'border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:border-[#426B5B]'
              }`}
            >
              <r.icon className={`w-5 h-5 ${on ? 'text-[#426B5B] dark:text-[#7FB39F]' : 'text-[#64748B]'}`} />
              <span className="block mt-1.5 text-sm font-bold">{r.label}</span>
              <span className="block text-[11px] text-[#64748B]">{r.desc}</span>
            </button>
          );
        })}
      </div>

      {usesPeriod && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
          {PERIODS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriodFilter(v)}
              aria-pressed={periodFilter === v}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                periodFilter === v ? 'bg-[#426B5B] border-[#426B5B] text-white' : 'bg-white dark:bg-[#17231D] border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {report.kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      <Card title={`${REPORTS.find((r) => r.id === reportType)?.label} • ${report.rows.length} registro(s)`}>
        {report.rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#64748B]">{report.empty}</p>
        ) : (
          <>
            {/* phones: cards */}
            <ul className="md:hidden -m-3 divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {report.rows.map((row, i) => (
                <li key={row.id || row.patientId || i} className="p-3 space-y-1.5">
                  <div className="text-sm">{report.cols[0].cell(row)}</div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {report.cols.slice(1).map((c) => (
                      <React.Fragment key={c.h}>
                        <dt className="text-[#64748B]">{c.h}</dt>
                        <dd className="text-right">{c.cell(row)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            {/* larger screens: table */}
            <div className="hidden md:block -m-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] dark:bg-[#111A15] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    {report.cols.map((c) => (
                      <th key={c.h} className={`px-4 py-3 ${c.className || ''}`}>
                        {c.h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                  {report.rows.map((row, i) => (
                    <tr key={row.id || row.patientId || i} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
                      {report.cols.map((c) => (
                        <td key={c.h} className={`px-4 py-2.5 ${c.className || ''}`}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* PRINTABLE PDF MODAL */}
      {printModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setPrintModalOpen(false)}
          title="Relatório Formatado para Impressão / PDF"
          description="Documento oficial com timbre, cabeçalho e rodapé da clínica."
          maxWidth="4xl"
        >
          <div className="print-area p-6 bg-white text-black font-sans space-y-4 border rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-bold uppercase">{settings.clinicName}</h2>
                <p className="text-xs text-gray-500">{settings.slogan}</p>
                <p className="text-[11px] text-gray-400 mt-1">{settings.address} • Tel: {settings.phone}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">RELATÓRIO CLÍNICO DE GESTÃO</p>
                <p className="text-gray-500">Emissão: {formatDate(new Date().toISOString(), 'dd/MM/yyyy HH:mm')}</p>
                <p className="text-gray-500">Fuso: {settings.timeZone}</p>
              </div>
            </div>

            {/* Metrics summary */}
            <div className="grid grid-cols-4 gap-3 p-3 bg-gray-50 rounded border text-xs text-center">
              <div>
                <span className="text-gray-500">Pacientes Ativos</span>
                <p className="text-base font-bold text-emerald-900">{patients.filter((p) => p.status === 'ativo').length}</p>
              </div>
              <div>
                <span className="text-gray-500">Atendimentos Registrados</span>
                <p className="text-base font-bold text-blue-900">{filteredAppointments.length}</p>
              </div>
              <div>
                <span className="text-gray-500">Taxa de Presença</span>
                <p className="text-base font-bold text-emerald-900">{attendanceRate}%</p>
              </div>
              <div>
                <span className="text-gray-500">Recebido no Período</span>
                <p className="text-base font-bold text-emerald-900">
                  {formatCurrency(periodRevenueCents)}
                </p>
              </div>
            </div>

            {/* Detail table inside printable document */}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-gray-100 border-b font-bold text-gray-700">
                  {reportType === 'atendimentos' && (
                    <tr>
                      <th className="p-2">Data/Hora</th>
                      <th className="p-2">Paciente</th>
                      <th className="p-2">Profissional</th>
                      <th className="p-2">Modalidade</th>
                      <th className="p-2">Status</th>
                    </tr>
                  )}
                  {reportType === 'pacientes' && (
                    <tr>
                      <th className="p-2">Paciente</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">Saldo Sessões</th>
                      <th className="p-2">Status</th>
                    </tr>
                  )}
                  {reportType === 'financeiro' && (
                    <tr>
                      <th className="p-2">Paciente</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2">Vencimento</th>
                      <th className="p-2">Valor</th>
                      <th className="p-2">Status</th>
                    </tr>
                  )}
                  {reportType === 'frequencia' && (
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Paciente</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Observações</th>
                    </tr>
                  )}
                  {reportType === 'aniversariantes' && (
                    <tr>
                      <th className="p-2">Paciente</th>
                      <th className="p-2">Data Nasc.</th>
                      <th className="p-2">Próximo Aniversário</th>
                      <th className="p-2">Telefone</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportType === 'atendimentos' &&
                    filteredAppointments.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2">{formatDate(a.date)} {a.startTime}</td>
                        <td className="p-2 font-medium">{a.patientName}</td>
                        <td className="p-2 text-gray-600">{a.professionalName}</td>
                        <td className="p-2">{a.modality}</td>
                        <td className="p-2 uppercase font-bold text-[10px]">{STATUS_LABELS[a.status] || a.status}</td>
                      </tr>
                    ))}
                  {reportType === 'pacientes' &&
                    patients.map((p) => (
                      <tr key={p.id}>
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2 font-mono">{p.phone}</td>
                        <td className="p-2">{p.sessionsRemaining} de {p.sessionsTotal}</td>
                        <td className="p-2 uppercase font-bold text-[10px]">{STATUS_LABELS[p.status] || p.status}</td>
                      </tr>
                    ))}
                  {reportType === 'financeiro' &&
                    filteredCharges.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2 font-medium">{c.patientName}</td>
                        <td className="p-2">{c.description}</td>
                        <td className="p-2 font-mono">{formatDate(c.dueDate)}</td>
                        <td className="p-2 font-bold">{formatCurrency(c.finalAmountCents)} (pago {formatCurrency(c.paidAmountCents)})</td>
                        <td className="p-2 uppercase font-bold text-[10px]">{STATUS_LABELS[getChargeDisplayStatus(c, today)]}</td>
                      </tr>
                    ))}
                  {reportType === 'frequencia' &&
                    filteredAppointments.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2">{formatDate(a.date)}</td>
                        <td className="p-2 font-medium">{a.patientName}</td>
                        <td className="p-2 uppercase font-bold text-[10px]">{STATUS_LABELS[a.status] || a.status}</td>
                        <td className="p-2 text-gray-500">{a.cancellationReason || a.notes || '-'}</td>
                      </tr>
                    ))}
                  {reportType === 'aniversariantes' &&
                    birthdayAlerts.map((b) => (
                      <tr key={b.patientId}>
                        <td className="p-2 font-medium">{b.patientName}</td>
                        <td className="p-2">{formatDate(b.birthDate)}</td>
                        <td className="p-2">{b.nextBirthday} ({b.age} anos)</td>
                        <td className="p-2 font-mono">{b.whatsapp}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-600">
              * Relatório gerado a partir de registros auditados do sistema clínico PilatesFlow em conformidade com as diretrizes do COFFITO/CREFITO.
            </p>

            <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-gray-500">
              <div className="border-t border-gray-400 pt-1">
                Responsável Técnico / Fisioterapeuta
              </div>
              <div className="border-t border-gray-400 pt-1">
                Administração da Clínica
              </div>
            </div>

            <div className="pt-4 text-center border-t text-[10px] text-gray-400">
              Documento gerado eletronicamente sob diretrizes de sigilo profissional e LGPD
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              onClick={() => printElement(document.querySelector('.print-area'), `Relatório ${reportType} - ${toLocalDateKey()}`)}
              className="px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Imprimir Relatório
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
