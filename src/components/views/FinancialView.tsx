import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Calendar,
  Layers,
  History,
  TrendingUp,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import {
  formatCurrency,
  formatDate,
  exportToCSV,
  toLocalDateKey,
  nowStamp,
  parseBRLToCents,
  copyToClipboard,
  getChargeDisplayStatus,
  isChargeActive,
  STATUS_LABELS,
  printElement,
} from '../../lib/utils';
import { Charge, Expense, PaymentMethod, Patient, Plan } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

interface FinancialViewProps {
  onNavigate: (section: string, payload?: any) => void;
  action?: string;
  patientId?: string;
}

export const FinancialView: React.FC<FinancialViewProps> = ({ onNavigate, action: initialAction, patientId: initialPatientId }) => {
  const { showToast } = useToast();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentUser, setCurrentUser] = useState(clinicStorage.getCurrentUser());

  // Active view tab
  const [activeTab, setActiveTab] = useState<'receber' | 'pagar' | 'fluxo' | 'fechamento'>('receber');

  // Modal states
  const [isNewChargeModalOpen, setIsNewChargeModalOpen] = useState(false);
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [selectedChargeForPayment, setSelectedChargeForPayment] = useState<Charge | null>(null);
  const [receiptModal, setReceiptModal] = useState<Charge | null>(null);
  const [refundModalCharge, setRefundModalCharge] = useState<Charge | null>(null);
  const [refundPresetReason, setRefundPresetReason] = useState<string>('Desistência do plano / Devolução de saldo');
  const [refundCustomReason, setRefundCustomReason] = useState<string>('');

  // New Charge form
  const [formPatientId, setFormPatientId] = useState('');
  const [formDescription, setFormDescription] = useState('Mensalidade Pilates (Ciclo Atual)');
  const [formAmountReais, setFormAmountReais] = useState('420,00');
  const [formDueDate, setFormDueDate] = useState(toLocalDateKey());
  const [formCategory, setFormCategory] = useState<Charge['category']>('mensalidade');

  // Receive Payment form (multi-payment support)
  const [payAmountReais, setPayAmountReais] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');
  const [payNotes, setPayNotes] = useState('');

  // New Expense form
  const [expDescription, setExpDescription] = useState('');
  const [expCategory, setExpCategory] = useState<Expense['category']>('manutencao');
  const [expAmountReais, setExpAmountReais] = useState('150,00');
  const [expDueDate, setExpDueDate] = useState(toLocalDateKey());
  const [expBeneficiary, setExpBeneficiary] = useState('');
  const [closingDate, setClosingDate] = useState(toLocalDateKey());
  const [chargeFilter, setChargeFilter] = useState<'todas' | 'abertas' | 'vencidas' | 'pagas'>('todas');

  useEffect(() => {
    const load = () => {
      setCharges(clinicStorage.getCharges());
      setExpenses(clinicStorage.getExpenses());
      const pts = clinicStorage.getPatients().filter((p) => p.status !== 'arquivado');
      setPatients(pts);
      setPlans(clinicStorage.getPlans());
      setCurrentUser(clinicStorage.getCurrentUser());

      // functional update: the closure value is always '' and would reset the selected patient
      setFormPatientId((prev) => prev || pts[0]?.id || '');
    };
    load();
    if (initialPatientId) setFormPatientId(initialPatientId);
    if (initialAction === 'new_charge') {
      setIsNewChargeModalOpen(true);
    }
    return clinicStorage.subscribe(load);
  }, [initialAction, initialPatientId]);

  const today = toLocalDateKey();

  // Financial aggregates (refunded / cancelled charges no longer count as revenue or receivable)
  const activeCharges = charges.filter(isChargeActive);
  const totalReceivedCents = activeCharges.reduce((acc, c) => acc + (c.paidAmountCents || 0), 0);
  const totalPendingCents = activeCharges.reduce(
    (acc, c) => acc + Math.max(0, c.finalAmountCents - (c.paidAmountCents || 0)),
    0
  );
  const overdueCount = charges.filter((c) => getChargeDisplayStatus(c, today) === 'vencido').length;

  const visibleCharges = charges.filter((c) => {
    const st = getChargeDisplayStatus(c, today);
    if (chargeFilter === 'abertas') return st === 'pendente' || st === 'parcialmente_pago' || st === 'vencido';
    if (chargeFilter === 'vencidas') return st === 'vencido';
    if (chargeFilter === 'pagas') return st === 'pago';
    return true;
  });
  const totalPaidExpensesCents = expenses.filter((e) => e.isPaid).reduce((acc, e) => acc + e.amountCents, 0);
  const totalPendingExpensesCents = expenses.filter((e) => !e.isPaid).reduce((acc, e) => acc + e.amountCents, 0);
  const cashBalanceCents = totalReceivedCents - totalPaidExpensesCents;

  const handleCreateCharge = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find((p) => p.id === formPatientId);
    if (!patient) {
      showToast('Selecione um paciente.', 'error');
      return;
    }

    const amountCents = parseBRLToCents(formAmountReais);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      showToast('Valor inválido. Use o formato 420,00.', 'error');
      return;
    }

    const newCharge: Charge = {
      id: `chg-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      description: formDescription,
      originalAmountCents: amountCents,
      discountCents: 0,
      surchargeCents: 0,
      finalAmountCents: amountCents,
      paidAmountCents: 0,
      dueDate: formDueDate,
      status: 'pendente',
      category: formCategory,
      payments: [],
      createdAt: toLocalDateKey(),
      updatedAt: toLocalDateKey(),
      auditTrail: [
        {
          date: nowStamp(),
          author: currentUser.name,
          action: `Cobrança de ${formatCurrency(amountCents)} criada.`,
        },
      ],
    };

    clinicStorage.saveCharge(newCharge);
    showToast('Cobrança emitida com sucesso!', 'success');
    setIsNewChargeModalOpen(false);
  };

  const handleOpenPaymentModal = (chg: Charge) => {
    setSelectedChargeForPayment(chg);
    const remainingCents = chg.finalAmountCents - chg.paidAmountCents;
    setPayAmountReais((remainingCents / 100).toFixed(2).replace('.', ','));
    setPayMethod('pix');
    setPayNotes('');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargeForPayment) return;

    const amountCents = parseBRLToCents(payAmountReais);
    const remainingCents = selectedChargeForPayment.finalAmountCents - selectedChargeForPayment.paidAmountCents;

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      showToast('Informe um valor válido maior que zero (ex.: 200,00).', 'error');
      return;
    }
    if (amountCents > remainingCents) {
      showToast(`O valor excede o saldo restante de ${formatCurrency(remainingCents)}.`, 'error');
      return;
    }

    const updated = clinicStorage.recordPayment(selectedChargeForPayment.id, {
      amountCents,
      method: payMethod,
      notes: payNotes,
      receivedBy: currentUser.name,
    });

    if (updated) {
      showToast(
        updated.status === 'pago'
          ? 'Cobrança quitada totalmente!'
          : 'Recebimento parcial registrado com sucesso!',
        'success'
      );
    }

    setSelectedChargeForPayment(null);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseBRLToCents(expAmountReais);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      showToast('Valor inválido. Use o formato 150,00.', 'error');
      return;
    }

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      description: expDescription,
      category: expCategory,
      amountCents,
      dueDate: expDueDate,
      isPaid: false,
      beneficiary: expBeneficiary,
    };

    clinicStorage.saveExpense(newExpense);
    showToast('Despesa cadastrada!', 'success');
    setIsNewExpenseModalOpen(false);
    setExpDescription('');
    setExpBeneficiary('');
  };

  const handlePayExpense = (exp: Expense) => {
    const updated: Expense = {
      ...exp,
      isPaid: true,
      paymentDate: toLocalDateKey(),
      paymentMethod: 'pix',
    };
    clinicStorage.saveExpense(updated);
    showToast(`Despesa "${exp.description}" marcada como paga!`, 'success');
  };

  const handleConfirmRefund = () => {
    if (!refundModalCharge) return;
    const finalReason = refundCustomReason.trim()
      ? `${refundPresetReason} - ${refundCustomReason.trim()}`
      : refundPresetReason;
    clinicStorage.refundCharge(refundModalCharge.id, finalReason, currentUser.name);
    showToast('Estorno registrado com sucesso na trilha de auditoria!', 'success');
    setRefundModalCharge(null);
  };

  const handleCopyReceiptText = async (chg: Charge) => {
    const methods = chg.payments.map((p) => p.method.replace('_', ' ').toUpperCase()).join(' + ') || 'PIX';
    const clinicName = clinicStorage.getSettings().clinicName;
    const text = `*COMPROVANTE DE ${chg.status === 'pago' ? 'QUITAÇÃO' : 'PAGAMENTO PARCIAL'} - ${clinicName.toUpperCase()}*\n\n` +
      `Paciente: ${chg.patientName}\n` +
      `Descrição: ${chg.description}\n` +
      `Valor Quitado: ${formatCurrency(chg.paidAmountCents)}\n` +
      `Forma de Pagamento: ${methods}\n` +
      `Identificador: ${chg.id}\n\n` +
      `Agradecemos pela preferência e dedicação à sua saúde!`;

    const ok = await copyToClipboard(text);
    showToast(ok ? 'Comprovante copiado para envio pelo WhatsApp!' : 'Não foi possível copiar o comprovante.', ok ? 'success' : 'error');
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Gestão Financeira Profissional
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Controle de mensalidades, contas a pagar, múltiplos recebimentos (Pix/Dinheiro) e fluxo de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9]"
          >
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
            <span>Nova Despesa</span>
          </button>
          <button
            onClick={() => setIsNewChargeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Cobrança</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs">
          <span className="text-xs font-semibold text-[#64748B]">Total Recebido (Efetivo)</span>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(totalReceivedCents)}
          </p>
          <span className="text-[10px] text-[#64748B]">Valores já quitados em caixa</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs">
          <span className="text-xs font-semibold text-[#64748B]">Contas a Receber (Pendente)</span>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(totalPendingCents)}
          </p>
          <span className="text-[10px] text-[#64748B]">Previsão a ser recebida</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs">
          <span className="text-xs font-semibold text-[#64748B]">Despesas Pagas</span>
          <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(totalPaidExpensesCents)}
          </p>
          <span className="text-[10px] text-[#64748B]">
            Pendente: {formatCurrency(totalPendingExpensesCents)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs">
          <span className="text-xs font-semibold text-[#64748B]">Saldo Líquido de Caixa</span>
          <p
            className={`text-xl sm:text-2xl font-bold mt-1 ${
              cashBalanceCents >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            {formatCurrency(cashBalanceCents)}
          </p>
          <span className="text-[10px] text-[#64748B]">Receitas - Despesas Pagas</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#E5EAE7] dark:border-[#273830] flex items-center gap-1 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('receber')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'receber'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          <span>Contas a Receber ({charges.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pagar')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'pagar'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
          <span>Contas a Pagar ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fluxo')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'fluxo'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Fluxo de Caixa Consolidado</span>
        </button>

        <button
          onClick={() => setActiveTab('fechamento')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'fechamento'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Fechamento Diário & Mensal</span>
        </button>
      </div>

      {/* TAB 1: CONTAS A RECEBER */}
      {activeTab === 'receber' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-[#E5EAE7] dark:border-[#273830] text-xs">
            {(
              [
                ['todas', 'Todas'],
                ['abertas', 'Em aberto'],
                ['vencidas', `Vencidas${overdueCount ? ` (${overdueCount})` : ''}`],
                ['pagas', 'Pagas'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChargeFilter(key)}
                className={`px-3 py-1 rounded-full border font-semibold transition-colors ${
                  chargeFilter === key
                    ? 'bg-[#426B5B] border-[#426B5B] text-white'
                    : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6] hover:border-[#426B5B]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Descrição</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Valor Total</th>
                <th className="p-3.5">Valor Pago</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {visibleCharges.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748B]">
                    Nenhuma cobrança neste filtro.
                  </td>
                </tr>
              )}
              {visibleCharges.map((chg) => {
                const displayStatus = getChargeDisplayStatus(chg, today);
                return (
                <tr key={chg.id} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] transition-colors">
                  <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">
                    {chg.patientName}
                  </td>
                  <td className="p-3.5 text-[#64748B]">{chg.description}</td>
                  <td className="p-3.5 font-mono">{formatDate(chg.dueDate)}</td>
                  <td className="p-3.5 font-bold">{formatCurrency(chg.finalAmountCents)}</td>
                  <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(chg.paidAmountCents)}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        displayStatus === 'pago'
                          ? 'bg-emerald-100 text-emerald-800'
                          : displayStatus === 'parcialmente_pago'
                          ? 'bg-amber-100 text-amber-800'
                          : displayStatus === 'vencido' || displayStatus === 'estornado'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {STATUS_LABELS[displayStatus] || displayStatus}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isChargeActive(chg) && chg.status !== 'pago' && (
                        <button
                          onClick={() => handleOpenPaymentModal(chg)}
                          className="px-2.5 py-1 bg-[#426B5B] hover:bg-[#345648] text-white text-[11px] font-semibold rounded-md shadow-xs"
                        >
                          Receber
                        </button>
                      )}
                      {chg.payments.length > 0 && (
                        <button
                          onClick={() => setReceiptModal(chg)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
                          title="Ver comprovante de quitação"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(chg.status === 'pago' || chg.status === 'parcialmente_pago') && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundModalCharge(chg);
                            setRefundPresetReason('Desistência do plano / Devolução de saldo');
                            setRefundCustomReason('');
                          }}
                          className="px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded font-semibold"
                          title="Registrar estorno auditado"
                        >
                          Estornar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: CONTAS A PAGAR */}
      {activeTab === 'pagar' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3.5">Descrição</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Favorecido</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Valor</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] transition-colors">
                  <td className="p-3.5 font-bold text-[#17231D] dark:text-[#F1F5F3]">{exp.description}</td>
                  <td className="p-3.5 capitalize text-[#64748B]">{exp.category}</td>
                  <td className="p-3.5 text-[#64748B]">{exp.beneficiary}</td>
                  <td className="p-3.5 font-mono">{formatDate(exp.dueDate)}</td>
                  <td className="p-3.5 font-bold text-rose-700 dark:text-rose-400">
                    {formatCurrency(exp.amountCents)}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        exp.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {exp.isPaid ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {!exp.isPaid && (
                      <button
                        onClick={() => handlePayExpense(exp)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold rounded-md shadow-xs"
                      >
                        Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: FLUXO DE CAIXA CONSOLIDADO */}
      {activeTab === 'fluxo' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
            <h3 className="text-xs font-bold uppercase text-[#64748B]">Demonstrativo de Fluxo de Caixa</h3>
            <button
              onClick={() => {
                // Real cash movements only: each payment on its own date, refunds and paid expenses as outflows
                const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
                const csvData = [
                  ...charges.flatMap((c) =>
                    c.payments.map((p) => ({
                      Data: toLocalDateKey(p.date),
                      Tipo: 'Entrada',
                      Descricao: `${c.patientName} - ${c.description}`,
                      Forma: p.method,
                      Valor: money(p.amountCents),
                    }))
                  ),
                  ...charges
                    .filter((c) => c.status === 'estornado')
                    .map((c) => ({
                      Data: c.refundedAt || c.updatedAt.slice(0, 10),
                      Tipo: 'Saída (estorno)',
                      Descricao: `${c.patientName} - ${c.description}`,
                      Forma: '-',
                      Valor: `-${money(c.refundedAmountCents ?? c.paidAmountCents)}`,
                    })),
                  ...expenses
                    .filter((e) => e.isPaid)
                    .map((e) => ({
                      Data: e.paymentDate || e.dueDate,
                      Tipo: 'Saída (despesa)',
                      Descricao: e.description,
                      Forma: e.paymentMethod || '-',
                      Valor: `-${money(e.amountCents)}`,
                    })),
                ].sort((a, b) => a.Data.localeCompare(b.Data));
                if (csvData.length === 0) {
                  showToast('Nenhuma movimentação para exportar.', 'info');
                  return;
                }
                exportToCSV(csvData, 'fluxo_de_caixa_pilatesflow');
                showToast('Fluxo de caixa exportado em CSV!', 'success');
              }}
              className="text-xs text-[#426B5B] dark:text-[#5A8E7A] font-semibold hover:underline flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Demonstrativo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                Entradas Realizadas
              </span>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {formatCurrency(totalReceivedCents)}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Cobranças quitadas de planos, pacotes e sessões avulsas.
              </p>
            </div>

            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">
                Saídas Efetivadas
              </span>
              <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">
                {formatCurrency(totalPaidExpensesCents)}
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                Aluguel, manutenção de molas, água, energia e insumos da clínica.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FECHAMENTO DIÁRIO & MENSAL */}
      {activeTab === 'fechamento' && (() => {
        const daily = clinicStorage.getDailyClosing(closingDate);
        return (
          <div className="print-area bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
              <div>
                <h3 className="text-xs font-bold uppercase text-[#64748B]">
                  Fechamento & Conferência de Caixa
                </h3>
                <p className="text-xs text-[#17231D] dark:text-[#F1F5F3] font-semibold mt-0.5">
                  Auditoria de recebimentos e saídas por forma de pagamento
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B]">Data de Fechamento:</span>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border rounded-lg bg-[#F8FAF9] dark:bg-[#111A15]"
                />
                <button
                  type="button"
                  onClick={() => printElement(document.querySelector('.print-area'), `Fechamento de caixa - ${formatDate(closingDate, 'dd-MM-yyyy')}`)}
                  className="px-3 py-1 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Imprimir Fechamento</span>
                </button>
              </div>
            </div>

            {/* Daily Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold uppercase">
                  Recebido no Dia
                </span>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                  {formatCurrency(daily.totalInCents)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                <span className="text-xs text-rose-800 dark:text-rose-300 font-semibold uppercase">
                  Saídas no Dia
                </span>
                <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">
                  {formatCurrency(daily.totalOutCents)}
                </p>
                {daily.refundsCents > 0 && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                    inclui {formatCurrency(daily.refundsCents)} em estornos
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold uppercase">
                  Saldo Líquido da Data
                </span>
                <p className={`text-2xl font-bold mt-1 ${daily.netCents >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(daily.netCents)}
                </p>
              </div>
            </div>

            {/* Breakdown by Payment Method */}
            <div className="border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold uppercase text-[#64748B] block">
                Composição por Método de Pagamento:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg">
                  <span className="text-[#64748B] block">Pix:</span>
                  <span className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">
                    {formatCurrency(daily.byMethod.pix)}
                  </span>
                </div>
                <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg">
                  <span className="text-[#64748B] block">Dinheiro em Espécie:</span>
                  <span className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">
                    {formatCurrency(daily.byMethod.dinheiro)}
                  </span>
                </div>
                <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg">
                  <span className="text-[#64748B] block">Cartão Crédito / Débito:</span>
                  <span className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">
                    {formatCurrency(daily.byMethod.cartao)}
                  </span>
                </div>
                <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg">
                  <span className="text-[#64748B] block">Transferência:</span>
                  <span className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">
                    {formatCurrency(daily.byMethod.transferencia)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RECEIVE PAYMENT MODAL (Supports Multi-Payment) */}
      {selectedChargeForPayment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedChargeForPayment(null)}
          title={`Receber Pagamento: ${selectedChargeForPayment.patientName}`}
          description={`Cobrança: ${selectedChargeForPayment.description}`}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Valor Total da Cobrança:</span>
                <span className="font-bold">{formatCurrency(selectedChargeForPayment.finalAmountCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Já Recebido Anteriormente:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(selectedChargeForPayment.paidAmountCents)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Saldo Restante a Quitar:</span>
                <span className="text-amber-600">
                  {formatCurrency(selectedChargeForPayment.finalAmountCents - selectedChargeForPayment.paidAmountCents)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Valor Deste Recebimento (R$) *
              </label>
              <input
                type="text"
                value={payAmountReais}
                onChange={(e) => setPayAmountReais(e.target.value)}
                placeholder="Ex: 200,00"
                className="w-full text-base font-bold px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Permite recebimentos parciais fracionados (ex: R$ 100 Pix + R$ 100 Dinheiro).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Forma de Pagamento *</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg font-medium"
              >
                <option value="pix">Pix (Chave Clínica)</option>
                <option value="dinheiro">Dinheiro em Espécie</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="transferencia">Transferência Bancária</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Comprovante / Observação</label>
              <input
                type="text"
                placeholder="Ex: Código de transação Pix ou comprovante em dinheiro..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setSelectedChargeForPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Confirmar Recebimento
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* NEW CHARGE MODAL */}
      {isNewChargeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewChargeModalOpen(false)}
          title="Nova Cobrança de Paciente"
          description="Gere uma fatura ou cobrança de plano para o paciente."
        >
          <form onSubmit={handleCreateCharge} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Paciente *</label>
              <select
                value={formPatientId}
                onChange={(e) => setFormPatientId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Descrição *</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Valor (R$) *</label>
                <input
                  type="text"
                  value={formAmountReais}
                  onChange={(e) => setFormAmountReais(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Vencimento *</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsNewChargeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Gerar Cobrança
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* NEW EXPENSE MODAL */}
      {isNewExpenseModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewExpenseModalOpen(false)}
          title="Nova Despesa da Clínica"
          description="Cadastre despesas operacionais, manutenção de aparelhos ou fornecedores."
        >
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Descrição da Despesa *</label>
              <input
                type="text"
                placeholder="Ex: Troca de molas Reformer 1 e 2"
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Categoria</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                >
                  <option value="aluguel">Aluguel</option>
                  <option value="energia">Energia</option>
                  <option value="agua">Água</option>
                  <option value="internet">Internet</option>
                  <option value="equipamentos">Equipamentos</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="materiais">Materiais</option>
                  <option value="funcionarios">Funcionários</option>
                  <option value="outras">Outras</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Valor (R$) *</label>
                <input
                  type="text"
                  value={expAmountReais}
                  onChange={(e) => setExpAmountReais(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Favorecido / Fornecedor</label>
                <input
                  type="text"
                  placeholder="Ex: Pilates & Cia"
                  value={expBeneficiary}
                  onChange={(e) => setExpBeneficiary(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  value={expDueDate}
                  onChange={(e) => setExpDueDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsNewExpenseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Despesa
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECEIPT MODAL */}
      {receiptModal && (
        <Modal
          isOpen={true}
          onClose={() => setReceiptModal(null)}
          title="Comprovante de Quitação & Trilha de Auditoria"
          description={`Identificador: ${receiptModal.id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">Total Quitado</span>
              <p className="text-2xl font-bold text-emerald-900">
                {formatCurrency(receiptModal.paidAmountCents)}
              </p>
              <p className="text-[#64748B]">Paciente: {receiptModal.patientName}</p>
            </div>

            <div>
              <span className="font-bold block mb-2 text-[#64748B] uppercase text-[11px]">
                Recebimentos Registrados:
              </span>
              <div className="divide-y border rounded-lg">
                {receiptModal.payments.map((p) => (
                  <div key={p.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{formatCurrency(p.amountCents)} ({p.method.toUpperCase()})</p>
                      <p className="text-[11px] text-[#64748B]">
                        {formatDate(p.date, "dd/MM/yyyy 'às' HH:mm")} • Recebido por: {p.receivedBy}
                      </p>
                      {p.notes && <p className="text-[11px] text-slate-500 italic">{p.notes}</p>}
                    </div>
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.receiptNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="font-bold block mb-2 text-[#64748B] uppercase text-[11px]">
                Trilha de Auditoria:
              </span>
              <ul className="text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                {receiptModal.auditTrail.map((tr, i) => (
                  <li key={i}>
                    • <strong>{tr.date}</strong> ({tr.author}): {tr.action}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => handleCopyReceiptText(receiptModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-semibold hover:bg-emerald-100"
              >
                Copiar Comprovante (WhatsApp)
              </button>

              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="px-4 py-1.5 bg-[#426B5B] text-white text-xs font-semibold rounded-lg hover:bg-[#345648]"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ESTORNO AUDITADO MODAL (No window.prompt) */}
      {refundModalCharge && (
        <Modal
          isOpen={true}
          onClose={() => setRefundModalCharge(null)}
          title="Registrar Estorno Financeiro"
          description={`Devolução e estorno auditado para ${refundModalCharge.patientName} (${formatCurrency(refundModalCharge.paidAmountCents)}).`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#17231D] dark:text-[#F1F5F3] mb-2">
                Motivo do Estorno:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Desistência do plano / Devolução de saldo',
                  'Cobrança lançada em duplicidade',
                  'Erro operacional de valor',
                  'Desacordo comercial / Insatisfação',
                  'Outro motivo justificado',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRefundPresetReason(reason)}
                    className={`p-2.5 rounded-lg text-xs text-left border transition-all ${
                      refundPresetReason === reason
                        ? 'border-[#426B5B] bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A] font-bold shadow-2xs'
                        : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] hover:border-slate-400'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                Detalhamento Auditável (Opcional):
              </label>
              <textarea
                value={refundCustomReason}
                onChange={(e) => setRefundCustomReason(e.target.value)}
                placeholder="Ex: Devolução via chave Pix do paciente aprovada pela gerência..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setRefundModalCharge(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Confirmar Estorno
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
