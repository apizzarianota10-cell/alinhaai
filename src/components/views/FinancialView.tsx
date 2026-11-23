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
  ChevronLeft,
  ChevronRight,
  Search,
  MessageCircle,
  LayoutDashboard,
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
  buildWhatsAppLink,
} from '../../lib/utils';
import { Charge, Expense, PaymentMethod, Patient, Plan } from '../../types';
import { Modal } from '../common/Modal';
import { StatCard, Avatar, ProgressBar, Pill, Card } from '../common/Insights';
import { format, addMonths, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  const [activeTab, setActiveTab] = useState<'visao' | 'receber' | 'pagar' | 'fluxo' | 'fechamento'>('visao');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [chargeSearch, setChargeSearch] = useState('');
  const [expenseFilter, setExpenseFilter] = useState<'todas' | 'pendentes' | 'pagas'>('todas');

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

  // all real cash movements (each payment on its date, refunds and paid expenses as outflows)
  const exportCashFlow = () => {
    const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
    const csvData = [
      ...charges.flatMap((c) =>
        c.payments.map((p) => ({ Data: toLocalDateKey(p.date), Tipo: 'Entrada', Descricao: `${c.patientName} - ${c.description}`, Forma: p.method, Valor: money(p.amountCents) }))
      ),
      ...charges
        .filter((c) => c.status === 'estornado')
        .map((c) => ({ Data: c.refundedAt || c.updatedAt.slice(0, 10), Tipo: 'Saída (estorno)', Descricao: `${c.patientName} - ${c.description}`, Forma: '-', Valor: `-${money(c.refundedAmountCents ?? c.paidAmountCents)}` })),
      ...expenses
        .filter((e) => e.isPaid)
        .map((e) => ({ Data: e.paymentDate || e.dueDate, Tipo: 'Saída (despesa)', Descricao: e.description, Forma: e.paymentMethod || '-', Valor: `-${money(e.amountCents)}` })),
    ].sort((a, b) => a.Data.localeCompare(b.Data));
    if (csvData.length === 0) {
      showToast('Nenhuma movimentação para exportar.', 'info');
      return;
    }
    exportToCSV(csvData, 'fluxo_de_caixa_pilatesflow');
    showToast('Fluxo de caixa exportado em CSV!', 'success');
  };

  // ───────────── month-based analytics ─────────────
  const monthKeyOf = (d: Date) => format(d, 'yyyy-MM');
  const monthKey = monthKeyOf(month);
  const monthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  const prevKey = monthKeyOf(addMonths(month, -1));

  const payments = charges.flatMap((c) =>
    c.payments.map((p) => ({ date: toLocalDateKey(p.date), amount: p.amountCents, method: p.method, charge: c }))
  );
  const refunds = charges
    .filter((c) => c.status === 'estornado')
    .map((c) => ({ date: c.refundedAt || c.updatedAt.slice(0, 10), amount: c.refundedAmountCents ?? c.paidAmountCents, charge: c }));
  const paidExpenses = expenses.filter((e) => e.isPaid).map((e) => ({ date: e.paymentDate || e.dueDate, amount: e.amountCents, e }));

  const inOf = (key: string) =>
    payments.filter((p) => p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0) -
    refunds.filter((r) => r.date.startsWith(key)).reduce((s, r) => s + r.amount, 0);
  const outOf = (key: string) => paidExpenses.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
  const outstanding = (c: Charge) => Math.max(0, c.finalAmountCents - (c.paidAmountCents || 0));

  const monthIn = inOf(monthKey);
  const monthOut = outOf(monthKey);
  const prevIn = inOf(prevKey);
  const result = monthIn - monthOut;
  const receivableMonth = activeCharges.filter((c) => c.dueDate.startsWith(monthKey) && outstanding(c) > 0);
  const receivableMonthCents = receivableMonth.reduce((s, c) => s + outstanding(c), 0);
  const overdueCharges = charges.filter((c) => getChargeDisplayStatus(c, today) === 'vencido' && outstanding(c) > 0);
  const overdueCents = overdueCharges.reduce((s, c) => s + outstanding(c), 0);
  const pendingExpMonth = expenses.filter((e) => !e.isPaid && e.dueDate.startsWith(monthKey));
  const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const inDelta = delta(monthIn, prevIn);

  // last 6 months ending at the selected one
  const series = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(month, i - 5);
    const key = monthKeyOf(d);
    return { key, label: format(d, 'MMM', { locale: ptBR }), inC: Math.max(0, inOf(key)), outC: outOf(key) };
  });

  const METHOD_LABEL: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito', transferencia: 'Transferência', boleto: 'Boleto' };
  const byMethod = Object.entries(
    payments
      .filter((p) => p.date.startsWith(monthKey))
      .reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.method]: (acc[p.method] || 0) + p.amount }), {})
  ).sort((a, b) => b[1] - a[1]);

  // overdue grouped by patient (for collection)
  const debtors = Object.values(
    overdueCharges.reduce<Record<string, { id: string; name: string; total: number; count: number; oldest: string }>>((acc, c) => {
      const cur = acc[c.patientId] || { id: c.patientId, name: c.patientName, total: 0, count: 0, oldest: c.dueDate };
      cur.total += outstanding(c);
      cur.count += 1;
      if (c.dueDate < cur.oldest) cur.oldest = c.dueDate;
      acc[c.patientId] = cur;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);
  const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const dueSoon = activeCharges
    .filter((c) => c.dueDate >= today && c.dueDate <= in7 && outstanding(c) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const daysFrom = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
  const dueText = (c: Charge, st: string) => {
    if (st === 'pago' || st === 'estornado') return null;
    const n = daysFrom(c.dueDate);
    return n < 0 ? `vencida há ${-n} dia${n === -1 ? '' : 's'}` : n === 0 ? 'vence hoje' : `vence em ${n} dia${n === 1 ? '' : 's'}`;
  };
  const phoneOf = (patientId: string) => {
    const p = clinicStorage.getPatientById(patientId);
    return p?.whatsapp || p?.phone || '';
  };
  const collectLink = (patientId: string, name: string, total: number, oldest: string) =>
    buildWhatsAppLink(
      phoneOf(patientId),
      `Olá, ${name.split(' ')[0]}! Tudo bem? Consta em aberto ${formatCurrency(total)} referente à mensalidade com vencimento em ${formatDate(oldest)}. Posso te enviar a chave Pix para regularizar? Obrigado!`
    );

  const CHARGE_CATEGORY: Record<string, string> = { mensalidade: 'Mensalidade', pacote: 'Pacote', avulsa: 'Avulsa', outro: 'Outro' };
  const EXPENSE_CATEGORY: Record<string, string> = {
    aluguel: 'Aluguel',
    energia: 'Energia',
    agua: 'Água',
    internet: 'Internet',
    equipamentos: 'Equipamentos',
    manutencao: 'Manutenção',
    materiais: 'Materiais',
    funcionarios: 'Funcionários',
    outras: 'Outras',
  };

  const q = chargeSearch.trim().toLowerCase();
  const listCharges = visibleCharges
    .filter((c) => !q || c.patientName.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    .sort((a, b) => {
      const oa = outstanding(a) > 0 && isChargeActive(a) ? 0 : 1;
      const ob = outstanding(b) > 0 && isChargeActive(b) ? 0 : 1;
      return oa - ob || (oa === 0 ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate));
    });
  const listExpenses = expenses
    .filter((e) => (expenseFilter === 'todas' ? true : expenseFilter === 'pendentes' ? !e.isPaid : e.isPaid))
    .sort((a, b) => (a.isPaid === b.isPaid ? a.dueDate.localeCompare(b.dueDate) : a.isPaid ? 1 : -1));

  const statusTone = (st: string): 'green' | 'amber' | 'rose' | 'slate' =>
    st === 'pago' ? 'green' : st === 'parcialmente_pago' ? 'amber' : st === 'vencido' || st === 'estornado' ? 'rose' : 'slate';

  /** Grouped bars, one axis, 2 validated series; hover shows both values, table view available */
  const IncomeChart: React.FC = () => {
    const [hover, setHover] = useState<number | null>(null);
    const [asTable, setAsTable] = useState(false);
    const max = Math.max(1, ...series.flatMap((s) => [s.inC, s.outC]));
    const nice = (() => {
      const step = Math.pow(10, Math.floor(Math.log10(max)));
      return Math.ceil(max / step) * step;
    })();
    const W = 600;
    const H = 220;
    const padL = 48;
    const padB = 26;
    const plotH = H - padB - 12;
    const groupW = (W - padL) / series.length;
    const barW = Math.min(26, groupW / 3.2);
    const y = (v: number) => 12 + plotH - (v / nice) * plotH;
    const compact = (c: number) => (c >= 100000 ? `${(c / 100000).toFixed(c % 100000 ? 1 : 0).replace('.', ',')}k` : `${Math.round(c / 100)}`);
    // rounded top, square base anchored to the baseline
    const bar = (x: number, v: number) => {
      const top = y(v);
      const h = 12 + plotH - top;
      if (h <= 0) return '';
      const r = Math.min(4, h, barW / 2);
      return `M${x},${12 + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${12 + plotH} Z`;
    };
    const active = hover ?? series.length - 1;
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-4 text-[11px] text-[#475569] dark:text-[#9AA8B6]" aria-label="Legenda">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#13875E] dark:bg-[#2FA877]" /> Receitas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#C9730A] dark:bg-[#C98212]" /> Despesas
            </span>
          </div>
          <button onClick={() => setAsTable(!asTable)} className="text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
            {asTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>
        {asTable ? (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[#64748B]">
              <tr>
                <th className="text-left py-1.5">Mês</th>
                <th className="text-right py-1.5">Receitas</th>
                <th className="text-right py-1.5">Despesas</th>
                <th className="text-right py-1.5">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {series.map((s) => (
                <tr key={s.key}>
                  <td className="py-1.5 capitalize">{s.label}</td>
                  <td className="py-1.5 text-right font-semibold">{formatCurrency(s.inC)}</td>
                  <td className="py-1.5 text-right font-semibold">{formatCurrency(s.outC)}</td>
                  <td className={`py-1.5 text-right font-bold ${s.inC - s.outC < 0 ? 'text-rose-600' : ''}`}>{formatCurrency(s.inC - s.outC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Receitas e despesas dos últimos 6 meses" onMouseLeave={() => setHover(null)}>
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line x1={padL} x2={W} y1={y(nice * t)} y2={y(nice * t)} className="stroke-[#E5EAE7] dark:stroke-[#273830]" strokeWidth={1} />
                  <text x={padL - 6} y={y(nice * t) + 3} textAnchor="end" className="fill-[#94A3B8] text-[10px]">
                    {compact(nice * t)}
                  </text>
                </g>
              ))}
              {series.map((s, i) => {
                const gx = padL + i * groupW + groupW / 2;
                const isActive = i === active;
                return (
                  <g key={s.key} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} className="cursor-pointer">
                    {/* hit target larger than the marks */}
                    <rect x={padL + i * groupW} y={0} width={groupW} height={H} fill="transparent" />
                    {isActive && <rect x={padL + i * groupW + 4} y={8} width={groupW - 8} height={plotH + 8} rx={6} className="fill-[#F1F5F3] dark:fill-[#1F332A]" />}
                    <path d={bar(gx - barW - 1, s.inC)} className="fill-[#13875E] dark:fill-[#2FA877]" />
                    <path d={bar(gx + 1, s.outC)} className="fill-[#C9730A] dark:fill-[#C98212]" />
                    <text x={gx} y={H - 8} textAnchor="middle" className={`text-[11px] capitalize ${isActive ? 'fill-[#17231D] dark:fill-[#F1F5F3] font-bold' : 'fill-[#64748B]'}`}>
                      {s.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="font-bold capitalize">{series[active].label}:</span>
              <span>
                Receitas <b>{formatCurrency(series[active].inC)}</b>
              </span>
              <span>
                Despesas <b>{formatCurrency(series[active].outC)}</b>
              </span>
              <span>
                Resultado <b className={series[active].inC - series[active].outC < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>{formatCurrency(series[active].inC - series[active].outC)}</b>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabBtn = (id: typeof activeTab, label: string, Icon: React.ElementType, count?: number) => (
    <button
      onClick={() => setActiveTab(id)}
      role="tab"
      aria-selected={activeTab === id}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
        activeTab === id ? 'bg-white dark:bg-[#17231D] text-[#426B5B] dark:text-[#7FB39F] shadow-xs' : 'text-[#64748B] hover:text-[#17231D] dark:hover:text-[#F1F5F3]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
      {count !== undefined && count > 0 && <span className="px-1.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 text-[10px]">{count}</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3] flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Financeiro
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">Recebimentos, inadimplência, despesas e caixa da clínica, mês a mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
          >
            <ArrowDownRight className="w-4 h-4 text-[#C9730A]" /> Nova despesa
          </button>
          <button
            onClick={() => setIsNewChargeModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova cobrança
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior" className="p-2 rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[10rem] text-center font-bold text-sm">{monthLabel}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês" className="p-2 rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
          <ChevronRight className="w-4 h-4" />
        </button>
        {monthKey !== today.slice(0, 7) && (
          <button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E5EAE7] dark:border-[#273830]">
            Mês atual
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Recebido no mês"
          value={<span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(monthIn)}</span>}
          hint={inDelta === null ? 'sem base no mês anterior' : `${inDelta >= 0 ? '▲' : '▼'} ${Math.abs(inDelta)}% vs. mês anterior`}
          icon={ArrowUpRight}
        />
        <StatCard
          label="A receber no mês"
          value={<span className="text-amber-600 dark:text-amber-400">{formatCurrency(receivableMonthCents)}</span>}
          hint={overdueCents ? `${formatCurrency(overdueCents)} vencido (${overdueCharges.length})` : `${receivableMonth.length} cobrança(s) em aberto`}
          icon={Clock}
          tone="amber"
          onClick={() => {
            setActiveTab('receber');
            setChargeFilter(overdueCents ? 'vencidas' : 'abertas');
          }}
        />
        <StatCard
          label="Despesas do mês"
          value={formatCurrency(monthOut)}
          hint={pendingExpMonth.length ? `${pendingExpMonth.length} a pagar: ${formatCurrency(pendingExpMonth.reduce((s, e) => s + e.amountCents, 0))}` : 'nenhuma pendente no mês'}
          icon={ArrowDownRight}
          tone="rose"
          onClick={() => setActiveTab('pagar')}
        />
        <StatCard
          label="Resultado do mês"
          value={<span className={result < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>{formatCurrency(result)}</span>}
          hint={monthIn > 0 ? `margem de ${Math.round((result / monthIn) * 100)}%` : 'recebido − despesas pagas'}
          icon={TrendingUp}
          tone={result < 0 ? 'rose' : 'green'}
        />
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-[#F1F5F3] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] overflow-x-auto [scrollbar-width:none]">
        {tabBtn('visao', 'Visão geral', LayoutDashboard)}
        {tabBtn('receber', 'A receber', ArrowUpRight, overdueCount)}
        {tabBtn('pagar', 'A pagar', ArrowDownRight, expenses.filter((e) => !e.isPaid && e.dueDate < today).length)}
        {tabBtn('fluxo', 'Fluxo de caixa', TrendingUp)}
        {tabBtn('fechamento', 'Fechamento', Calendar)}
      </div>

      {/* VISÃO GERAL */}
      {activeTab === 'visao' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="Receitas × despesas (6 meses)" className="lg:col-span-2">
            <IncomeChart />
          </Card>
          <Card title="Recebido por forma de pagamento">
            {byMethod.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center">Nenhum recebimento em {format(month, 'MMMM', { locale: ptBR })}.</p>
            ) : (
              <ul className="space-y-3">
                {byMethod.map(([m, v]) => (
                  <li key={m}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">{METHOD_LABEL[m] || m}</span>
                      <span className="text-[#475569] dark:text-[#9AA8B6]">
                        {formatCurrency(v)} • {Math.round((v / Math.max(1, monthIn)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#E5EAE7] dark:bg-[#273830] overflow-hidden">
                      <div className="h-full rounded-full bg-[#13875E] dark:bg-[#2FA877]" style={{ width: `${(v / byMethod[0][1]) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Inadimplência"
            className="lg:col-span-2"
            action={<span className="text-[11px] text-[#64748B]">{debtors.length ? `${formatCurrency(overdueCents)} em ${debtors.length} aluno(s)` : 'em dia'}</span>}
          >
            {debtors.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Nenhuma cobrança vencida.
              </p>
            ) : (
              <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                {debtors.map((d) => (
                  <li key={d.id} className="py-2.5 flex flex-wrap items-center gap-3">
                    <Avatar name={d.name} size="sm" />
                    <div className="flex-1 min-w-[9rem]">
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {d.count} cobrança(s) • mais antiga vencida há {-daysFrom(d.oldest)} dias
                      </p>
                    </div>
                    <span className="text-sm font-bold text-rose-600">{formatCurrency(d.total)}</span>
                    <div className="flex gap-1.5">
                      <a
                        href={collectLink(d.id, d.name, d.total, d.oldest)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Cobrar
                      </a>
                      <button
                        onClick={() => {
                          const first = overdueCharges.find((c) => c.patientId === d.id);
                          if (first) handleOpenPaymentModal(first);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#426B5B] hover:bg-[#345648]"
                      >
                        Receber
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Vencimentos em 7 dias" action={<span className="text-[11px] text-[#64748B]">{formatCurrency(dueSoon.reduce((s, c) => s + outstanding(c), 0))}</span>}>
            {dueSoon.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center">Nenhum vencimento nos próximos 7 dias.</p>
            ) : (
              <ul className="space-y-2">
                {dueSoon.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 text-xs">
                    <span className="w-11 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-center py-1">
                      <span className="block font-extrabold text-sm leading-tight">{formatDate(c.dueDate, 'dd')}</span>
                      <span className="block text-[9px] font-bold uppercase">{formatDate(c.dueDate, 'MMM')}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{c.patientName}</span>
                      <span className="block text-[11px] text-[#64748B] truncate">{c.description}</span>
                    </span>
                    <span className="font-bold">{formatCurrency(outstanding(c))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* A RECEBER */}
      {activeTab === 'receber' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xs">
          <div className="p-3 border-b border-[#E5EAE7] dark:border-[#273830] flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={chargeSearch}
                onChange={(e) => setChargeSearch(e.target.value)}
                placeholder="Buscar aluno ou descrição…"
                aria-label="Buscar cobrança"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
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
                  aria-pressed={chargeFilter === key}
                  className={`px-3 py-1.5 rounded-full border font-semibold ${
                    chargeFilter === key ? 'bg-[#426B5B] border-[#426B5B] text-white' : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {listCharges.length === 0 ? (
            <p className="p-8 text-center text-xs text-[#64748B]">Nenhuma cobrança neste filtro.</p>
          ) : (
            <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {listCharges.map((chg) => {
                const st = getChargeDisplayStatus(chg, today);
                const due = dueText(chg, st);
                const paidPct = chg.finalAmountCents ? Math.round(((chg.paidAmountCents || 0) / chg.finalAmountCents) * 100) : 0;
                return (
                  <li key={chg.id} className="p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]/60">
                    <div className="flex items-center gap-3 md:w-[32%] min-w-0">
                      <Avatar name={chg.patientName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{chg.patientName}</p>
                        <p className="text-[11px] text-[#64748B] truncate">
                          {CHARGE_CATEGORY[chg.category] || chg.category} • {chg.description}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:flex-1 md:grid-cols-[7rem_1fr_7rem] gap-3 items-center text-xs">
                      <div>
                        <p className="font-mono">{formatDate(chg.dueDate)}</p>
                        {due && <p className={`text-[10px] ${due.startsWith('vencida') ? 'text-rose-600 font-semibold' : 'text-[#64748B]'}`}>{due}</p>}
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold">{formatCurrency(chg.finalAmountCents)}</span>
                          <span className="text-[11px] text-[#64748B]">pago {formatCurrency(chg.paidAmountCents || 0)}</span>
                        </div>
                        <ProgressBar value={paidPct} tone={st === 'estornado' ? 'rose' : paidPct >= 100 ? 'green' : paidPct > 0 ? 'amber' : 'blue'} label="Valor pago" />
                      </div>
                      <div className="col-span-3 md:col-span-1 flex md:justify-center">
                        <Pill tone={statusTone(st)}>{STATUS_LABELS[st] || st}</Pill>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 md:justify-end md:w-44">
                      {isChargeActive(chg) && chg.status !== 'pago' && (
                        <button onClick={() => handleOpenPaymentModal(chg)} className="flex-1 md:flex-none px-3 py-1.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg">
                          Receber
                        </button>
                      )}
                      {st === 'vencido' && (
                        <a
                          href={collectLink(chg.patientId, chg.patientName, outstanding(chg), chg.dueDate)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Cobrar pelo WhatsApp"
                          aria-label={`Cobrar ${chg.patientName} pelo WhatsApp`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      {chg.payments.length > 0 && (
                        <button onClick={() => setReceiptModal(chg)} className="p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100 dark:hover:bg-[#1F332A]" title="Comprovante" aria-label="Comprovante">
                          <Receipt className="w-4 h-4" />
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
                          className="px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg font-semibold"
                          title="Registrar estorno auditado"
                        >
                          Estornar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* A PAGAR */}
      {activeTab === 'pagar' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xs">
          <div className="p-3 border-b border-[#E5EAE7] dark:border-[#273830] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(
                [
                  ['todas', 'Todas'],
                  ['pendentes', `A pagar (${expenses.filter((e) => !e.isPaid).length})`],
                  ['pagas', 'Pagas'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setExpenseFilter(key)}
                  aria-pressed={expenseFilter === key}
                  className={`px-3 py-1.5 rounded-full border font-semibold ${
                    expenseFilter === key ? 'bg-[#426B5B] border-[#426B5B] text-white' : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#64748B]">
              Pendente total: <b className="text-[#17231D] dark:text-[#F1F5F3]">{formatCurrency(totalPendingExpensesCents)}</b>
            </span>
          </div>
          {listExpenses.length === 0 ? (
            <p className="p-8 text-center text-xs text-[#64748B]">Nenhuma despesa neste filtro.</p>
          ) : (
            <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {listExpenses.map((exp) => {
                const n = daysFrom(exp.dueDate);
                return (
                  <li key={exp.id} className="p-3 md:px-4 flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[#C9730A] dark:text-[#C98212] flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-[10rem]">
                      <p className="text-sm font-semibold">{exp.description}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {EXPENSE_CATEGORY[exp.category] || exp.category} • {exp.beneficiary || '—'}
                      </p>
                    </div>
                    <div className="text-xs w-28">
                      <p className="font-mono">{formatDate(exp.dueDate)}</p>
                      {!exp.isPaid && (
                        <p className={`text-[10px] ${n < 0 ? 'text-rose-600 font-semibold' : 'text-[#64748B]'}`}>
                          {n < 0 ? `vencida há ${-n} dias` : n === 0 ? 'vence hoje' : `vence em ${n} dias`}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-bold w-28 text-right">{formatCurrency(exp.amountCents)}</span>
                    <div className="flex items-center gap-2 w-28 justify-end">
                      {exp.isPaid ? (
                        <Pill tone="green">Paga</Pill>
                      ) : (
                        <button onClick={() => handlePayExpense(exp)} className="px-3 py-1.5 bg-[#C9730A] hover:bg-[#A85F08] text-white text-xs font-semibold rounded-lg">
                          Pagar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* FLUXO DE CAIXA (extrato do mês) */}
      {activeTab === 'fluxo' &&
        (() => {
          const moves = [
            ...payments.filter((p) => p.date.startsWith(monthKey)).map((p) => ({ date: p.date, desc: `${p.charge.patientName} • ${p.charge.description}`, kind: METHOD_LABEL[p.method] || p.method, v: p.amount })),
            ...refunds.filter((r) => r.date.startsWith(monthKey)).map((r) => ({ date: r.date, desc: `Estorno • ${r.charge.patientName}`, kind: 'Estorno', v: -r.amount })),
            ...paidExpenses.filter((x) => x.date.startsWith(monthKey)).map((x) => ({ date: x.date, desc: x.e.description, kind: EXPENSE_CATEGORY[x.e.category] || x.e.category, v: -x.amount })),
          ].sort((a, b) => a.date.localeCompare(b.date));
          let running = 0;
          return (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xs">
              <div className="p-3 border-b border-[#E5EAE7] dark:border-[#273830] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>
                    Entradas <b className="text-emerald-700 dark:text-emerald-400">{formatCurrency(moves.filter((m) => m.v > 0).reduce((s, m) => s + m.v, 0))}</b>
                  </span>
                  <span>
                    Saídas <b className="text-[#C9730A] dark:text-[#C98212]">{formatCurrency(-moves.filter((m) => m.v < 0).reduce((s, m) => s + m.v, 0))}</b>
                  </span>
                  <span>
                    Saldo do mês <b className={result < 0 ? 'text-rose-600' : ''}>{formatCurrency(moves.reduce((s, m) => s + m.v, 0))}</b>
                  </span>
                </div>
                <button onClick={exportCashFlow} className="text-xs text-[#426B5B] dark:text-[#7FB39F] font-semibold hover:underline flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar (CSV)
                </button>
              </div>
              {moves.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#64748B]">Nenhuma movimentação em {monthLabel}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead className="bg-[#F8FAF9] dark:bg-[#111A15] text-[10px] uppercase text-[#64748B]">
                      <tr>
                        <th className="text-left px-4 py-2.5">Data</th>
                        <th className="text-left px-3 py-2.5">Descrição</th>
                        <th className="text-left px-3 py-2.5">Forma / categoria</th>
                        <th className="text-right px-3 py-2.5">Valor</th>
                        <th className="text-right px-4 py-2.5">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                      {moves.map((m, i) => {
                        running += m.v;
                        return (
                          <tr key={i}>
                            <td className="px-4 py-2 font-mono">{formatDate(m.date, 'dd/MM')}</td>
                            <td className="px-3 py-2">{m.desc}</td>
                            <td className="px-3 py-2 text-[#64748B]">{m.kind}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${m.v < 0 ? 'text-[#C9730A] dark:text-[#C98212]' : 'text-emerald-700 dark:text-emerald-400'}`}>
                              {m.v < 0 ? '−' : '+'} {formatCurrency(Math.abs(m.v))}
                            </td>
                            <td className={`px-4 py-2 text-right font-bold ${running < 0 ? 'text-rose-600' : ''}`}>{formatCurrency(running)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

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
