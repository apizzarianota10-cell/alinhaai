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

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Central de Relatórios Profissionais
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Emissão de relatórios clínicos, financeiros e de frequência com exportação para CSV e documento timbrado para impressão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] transition-colors"
          >
            <Printer className="w-4 h-4 text-[#426B5B]" />
            <span>Visualizar Impressão</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-transform active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Report Controls & Filters */}
      <div className="p-4 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-[#64748B] dark:text-[#94A3B8]">Tipo de Relatório:</span>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            className="bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-3 py-1.5 font-bold text-[#17231D] dark:text-[#F1F5F3]"
          >
            <option value="atendimentos">Atendimentos & Sessões Realizadas</option>
            <option value="pacientes">Pacientes & Saldo de Planos</option>
            {['admin', 'receptionist'].includes(clinicStorage.getCurrentUser().role) && (
              <option value="financeiro">Financeiro (Receitas & Cobranças)</option>
            )}
            <option value="frequencia">Assiduidade & Taxa de Presença</option>
            <option value="aniversariantes">Radar de Aniversariantes & Relacionamento</option>
          </select>

          <span className="font-bold text-[#64748B] dark:text-[#94A3B8] ml-2">Período:</span>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-2.5 py-1.5 font-medium text-[#17231D] dark:text-[#F1F5F3]"
          >
            <option value="mes_atual">Mês Vigente</option>
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="ano">Ano Completo</option>
          </select>
        </div>

        <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Total de registros: <span className="font-bold text-[#17231D] dark:text-[#F1F5F3]">
            {reportType === 'atendimentos' && filteredAppointments.length}
            {reportType === 'pacientes' && patients.length}
            {reportType === 'financeiro' && filteredCharges.length}
            {reportType === 'frequencia' && filteredAppointments.length}
            {reportType === 'aniversariantes' && birthdayAlerts.length}
          </span>
        </div>
      </div>

      {/* REPORT CONTENT DISPLAY */}
      <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
        {reportType === 'atendimentos' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3.5">Data & Hora</th>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Profissional</th>
                <th className="p-3.5">Modalidade</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#64748B]">
                    Nenhum atendimento encontrado para o período selecionado.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
                    <td className="p-3.5 font-mono text-[#17231D] dark:text-[#F1F5F3]">
                      {formatDate(a.date)} às {a.startTime}
                    </td>
                    <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">{a.patientName}</td>
                    <td className="p-3.5 text-[#64748B] dark:text-[#94A3B8]">{a.professionalName}</td>
                    <td className="p-3.5 font-semibold text-[#17231D] dark:text-[#F1F5F3]">{a.modality}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.status === 'realizado'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : a.status === 'agendado'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {reportType === 'pacientes' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Data de Nascimento</th>
                <th className="p-3.5">Telefone</th>
                <th className="p-3.5">Sessões Restantes</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
                  <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">{p.name}</td>
                  <td className="p-3.5 text-[#64748B] dark:text-[#94A3B8]">{formatDate(p.birthDate)}</td>
                  <td className="p-3.5 font-mono text-[#17231D] dark:text-[#F1F5F3]">{p.phone}</td>
                  <td className="p-3.5 font-bold text-[#426B5B] dark:text-[#5A8E7A]">
                    {p.sessionsRemaining} de {p.sessionsTotal} ({p.sessionsCompleted} realizadas)
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'financeiro' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Descrição</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Valor Total</th>
                <th className="p-3.5">Valor Pago</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {filteredCharges.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
                  <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">{c.patientName}</td>
                  <td className="p-3.5 text-[#64748B] dark:text-[#94A3B8]">{c.description}</td>
                  <td className="p-3.5 font-mono text-[#17231D] dark:text-[#F1F5F3]">{formatDate(c.dueDate)}</td>
                  <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">{formatCurrency(c.finalAmountCents)}</td>
                  <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(c.paidAmountCents)}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        getChargeDisplayStatus(c, today) === 'pago'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : getChargeDisplayStatus(c, today) === 'pendente' || c.status === 'parcialmente_pago'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {STATUS_LABELS[getChargeDisplayStatus(c, today)]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'frequencia' && (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg border border-[#E5EAE7] dark:border-[#273830]">
                <span className="text-[11px] text-[#64748B]">Sessões Realizadas</span>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{totalAttended}</p>
              </div>
              <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg border border-[#E5EAE7] dark:border-[#273830]">
                <span className="text-[11px] text-[#64748B]">Agendadas / Confirmadas</span>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{totalScheduled}</p>
              </div>
              <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg border border-[#E5EAE7] dark:border-[#273830]">
                <span className="text-[11px] text-[#64748B]">Canceladas / Faltas</span>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{totalCancelled} / {totalMissed}</p>
              </div>
              <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg border border-[#E5EAE7] dark:border-[#273830]">
                <span className="text-[11px] text-[#64748B]">Taxa de Assiduidade</span>
                <p className="text-lg font-bold text-[#426B5B] dark:text-[#5A8E7A]">{attendanceRate}%</p>
              </div>
            </div>

            <table className="w-full text-left text-xs mt-3">
              <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Profissional</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Justificativa / Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                {filteredAppointments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
                    <td className="p-3 font-mono">{formatDate(a.date)}</td>
                    <td className="p-3 font-bold text-[#17231D] dark:text-[#F1F5F3]">{a.patientName}</td>
                    <td className="p-3 text-[#64748B]">{a.professionalName}</td>
                    <td className="p-3 font-semibold uppercase text-[10px]">{STATUS_LABELS[a.status] || a.status}</td>
                    <td className="p-3 text-[#64748B]">{a.cancellationReason || a.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'aniversariantes' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Data de Nascimento</th>
                <th className="p-3.5">Próximo Aniversário</th>
                <th className="p-3.5">Idade</th>
                <th className="p-3.5">Telefone / WhatsApp</th>
                <th className="p-3.5">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {birthdayAlerts.map((b) => (
                <tr key={b.patientId} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
                  <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">{b.patientName}</td>
                  <td className="p-3.5 font-mono text-[#64748B]">{formatDate(b.birthDate)}</td>
                  <td className="p-3.5 font-semibold text-amber-700 dark:text-amber-400">{b.nextBirthday}</td>
                  <td className="p-3.5 font-bold">{b.age} anos</td>
                  <td className="p-3.5 font-mono">{b.whatsapp}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        b.daysUntil === 0
                          ? 'bg-amber-100 text-amber-900 font-extrabold animate-pulse'
                          : b.daysUntil === 1
                          ? 'bg-orange-100 text-orange-900 font-bold'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {b.daysUntil === 0 ? 'Hoje!' : b.daysUntil === 1 ? 'Amanhã' : `Em ${b.daysUntil} dias`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
