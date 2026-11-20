import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  Eye,
  Edit,
  Archive,
  Phone,
  Calendar,
  CreditCard,
  FileText,
  Activity,
  Dumbbell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowLeft,
  MessageCircle,
  Smartphone,
  CalendarCheck2,
  Cake,
  DollarSign,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import {
  formatCurrency,
  formatDate,
  exportToCSV,
  buildWhatsAppLink,
  openExternalLink,
  toLocalDateKey,
  nowStamp,
  canAccessSection,
  copyToClipboard,
  getChargeDisplayStatus,
  STATUS_LABELS,
} from '../../lib/utils';
import { StatCard, Avatar, ProgressBar, Pill } from '../common/Insights';
import { buildRows } from './PresenceView';
import { computeMovementLevel } from '../../lib/evaluation';
import { LEVEL_LABEL } from '../../lib/pilatesCatalog';
import { buildPortalLink } from '../../lib/portal';
import { format } from 'date-fns';
import { Patient, Appointment, Charge, WorkoutPlan, ClinicalRecord, Plan } from '../../types';
import { Modal } from '../common/Modal';
import { PresenceSheetPanel } from './PresenceView';
import { EvaluationsPanel } from './EvaluationsView';
import { PainChart } from '../common/PainChart';
import { useToast } from '../common/Toast';

interface PatientsViewProps {
  onNavigate: (section: string, payload?: any) => void;
  selectedPatientId?: string;
  action?: string;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  onNavigate,
  selectedPatientId: initialPatientId,
  action: initialAction,
}) => {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [professionals, setProfessionals] = useState(clinicStorage.getProfessionals());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo' | 'arquivado'>('todos');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [renewOnly, setRenewOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'nome' | 'sessoes' | 'recentes' | 'proxima'>('nome');

  // Active view: List vs Detail Profile (derived from the live list so edits/renewals show at once)
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const activePatient = patients.find((p) => p.id === activePatientId) || null;
  const setActivePatient = (p: Patient | null) => setActivePatientId(p ? p.id : null);
  const [profileTab, setProfileTab] = useState<
    'resumo' | 'agenda' | 'plano' | 'pagamentos' | 'avaliacao' | 'fichas' | 'evolucao' | 'historico' | 'documentos' | 'presenca'
  >('resumo');

  // Modal states
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientToArchive, setPatientToArchive] = useState<Patient | null>(null);
  const [portalLink, setPortalLink] = useState<string | null>(null);

  // Document modal states
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<'laudo' | 'exame' | 'foto_postural' | 'termo'>('laudo');
  const [docFileName, setDocFileName] = useState('');

  // Form states
  const [formName, setFormName] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('1990-01-01');
  const [formCpf, setFormCpf] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formCity, setFormCity] = useState('Recife');
  const [formState, setFormState] = useState('PE');
  const [formEmergencyName, setFormEmergencyName] = useState('');
  const [formEmergencyPhone, setFormEmergencyPhone] = useState('');
  const [formModality, setFormModality] = useState<string>('Pilates');
  const [formResponsibleProfId, setFormResponsibleProfId] = useState('');
  const [formPlanId, setFormPlanId] = useState('');
  const [formAdminNotes, setFormAdminNotes] = useState('');
  const [formAlertsInput, setFormAlertsInput] = useState('');

  // CSV Import state
  const [csvPreview, setCsvPreview] = useState<Partial<Patient>[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      setPatients(clinicStorage.getPatients());
      setPlans(clinicStorage.getPlans().filter((pl) => pl.active));
      setProfessionals(clinicStorage.getProfessionals());
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  // Navigation payload is applied once — not on every storage notification
  useEffect(() => {
    if (initialPatientId) {
      setActivePatientId(initialPatientId);
      setProfileTab('resumo');
    }
  }, [initialPatientId]);

  useEffect(() => {
    if (initialAction === 'new') openNewModal();
  }, [initialAction]);

  function openNewModal() {
    setEditingPatient(null);
    setFormName('');
    setFormBirthDate('1990-01-01');
    setFormCpf('');
    setFormPhone('(81) 9');
    setFormWhatsapp('(81) 9');
    setFormEmail('');
    setFormStreet('');
    setFormNumber('');
    setFormNeighborhood('');
    setFormEmergencyName('');
    setFormEmergencyPhone('');
    setFormCity('Recife');
    setFormState('PE');
    setFormModality('Pilates');
    const profs = clinicStorage.getProfessionals().filter((p) => p.role !== 'receptionist');
    setFormResponsibleProfId(profs[0]?.id || '');
    setFormPlanId(clinicStorage.getPlans().find((pl) => pl.active)?.id || '');
    setFormAdminNotes('');
    setFormAlertsInput('');
    setIsNewPatientModalOpen(true);
  }

  const openEditModal = (p: Patient) => {
    setEditingPatient(p);
    setFormName(p.name);
    setFormBirthDate(p.birthDate);
    setFormCpf(p.cpf || '');
    setFormPhone(p.phone);
    setFormWhatsapp(p.whatsapp);
    setFormEmail(p.email);
    setFormStreet(p.address.street);
    setFormNumber(p.address.number);
    setFormNeighborhood(p.address.neighborhood);
    setFormCity(p.address.city);
    setFormState(p.address.state);
    setFormEmergencyName(p.emergencyContact.name);
    setFormEmergencyPhone(p.emergencyContact.phone);
    setFormModality(p.modality);
    setFormResponsibleProfId(p.responsibleProfessionalId);
    setFormPlanId(p.activePlanId || (plans[0]?.id || ''));
    setFormAdminNotes(p.administrativeNotes || '');
    setFormAlertsInput(p.clinicalAlerts ? p.clinicalAlerts.join(', ') : '');
    setIsNewPatientModalOpen(true);
  };

  const handleSavePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPhone.replace(/\D/g, '').length < 10) {
      showToast('Informe o nome e um telefone com DDD (mínimo 10 dígitos).', 'error');
      return;
    }
    if (formBirthDate > toLocalDateKey()) {
      showToast('A data de nascimento não pode estar no futuro.', 'error');
      return;
    }
    const cpfDigits = formCpf.replace(/\D/g, '');
    if (cpfDigits && cpfDigits.length !== 11) {
      showToast('CPF deve ter 11 dígitos.', 'error');
      return;
    }
    if (
      cpfDigits &&
      patients.some((p) => p.id !== editingPatient?.id && p.cpf && p.cpf.replace(/\D/g, '') === cpfDigits)
    ) {
      showToast('Já existe um paciente cadastrado com este CPF.', 'error');
      return;
    }

    const selectedPlan = plans.find((pl) => pl.id === formPlanId);
    const sessionsTotal = selectedPlan ? selectedPlan.sessionsCount : 8;

    const patientData: Patient = {
      id: editingPatient ? editingPatient.id : `pat-${Date.now()}`,
      name: formName.trim(),
      birthDate: formBirthDate,
      cpf: formCpf.trim(),
      phone: formPhone.trim(),
      whatsapp: formWhatsapp.trim() || formPhone.trim(),
      email: formEmail.trim(),
      address: {
        ...editingPatient?.address,
        street: formStreet,
        number: formNumber,
        neighborhood: formNeighborhood,
        city: formCity,
        state: formState,
        zipCode: editingPatient?.address.zipCode || '',
      },
      emergencyContact: {
        name: formEmergencyName,
        phone: formEmergencyPhone,
        relationship: editingPatient?.emergencyContact.relationship || 'Contato de Emergência',
      },
      createdAt: editingPatient ? editingPatient.createdAt : toLocalDateKey(),
      modality: formModality,
      responsibleProfessionalId: formResponsibleProfId,
      status: editingPatient ? editingPatient.status : 'ativo',
      administrativeNotes: formAdminNotes,
      clinicalAlerts: formAlertsInput ? formAlertsInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
      activePlanId: formPlanId,
      sessionsTotal: editingPatient ? editingPatient.sessionsTotal : sessionsTotal,
      sessionsCompleted: editingPatient ? editingPatient.sessionsCompleted : 0,
      sessionsRemaining: editingPatient ? editingPatient.sessionsRemaining : sessionsTotal,
      sessionsCancelled: editingPatient ? editingPatient.sessionsCancelled : 0,
      sessionsReplaced: editingPatient ? editingPatient.sessionsReplaced : 0,
    };

    clinicStorage.savePatient(patientData);
    showToast(editingPatient ? 'Paciente atualizado!' : 'Paciente cadastrado com sucesso!', 'success');
    setIsNewPatientModalOpen(false);
  };

  const handleReactivatePatient = (patient: Patient) => {
    clinicStorage.savePatient({ ...patient, status: 'ativo' });
    showToast(`${patient.name} reativado(a).`, 'success');
  };

  // Renewal adds the plan's sessions and issues the matching charge, so finance and balance stay aligned
  const handleRenewPlan = (patient: Patient) => {
    const plan = clinicStorage.getPlans().find((pl) => pl.id === patient.activePlanId) || plans[0];
    if (!plan) {
      showToast('Cadastre um plano em Configurações antes de renovar.', 'error');
      return;
    }
    clinicStorage.renewPatientPlan(patient.id, plan.id, plan.sessionsCount);
    const author = clinicStorage.getCurrentUser().name;
    clinicStorage.saveCharge({
      id: `chg-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      description: `Renovação - ${plan.name}`,
      originalAmountCents: plan.priceCents,
      discountCents: 0,
      surchargeCents: 0,
      finalAmountCents: plan.priceCents,
      paidAmountCents: 0,
      dueDate: toLocalDateKey(),
      status: 'pendente',
      category: 'mensalidade',
      planId: plan.id,
      payments: [],
      createdAt: toLocalDateKey(),
      updatedAt: toLocalDateKey(),
      auditTrail: [{ date: nowStamp(), author, action: `Cobrança gerada na renovação do plano ${plan.name}.` }],
    });
    showToast(
      `Plano renovado: +${plan.sessionsCount} sessões e cobrança de ${formatCurrency(plan.priceCents)} gerada.`,
      'success'
    );
  };

  const handleArchivePatient = (patient: Patient) => {
    setPatientToArchive(patient);
  };

  const handleConfirmArchive = () => {
    if (!patientToArchive) return;
    clinicStorage.deletePatient(patientToArchive.id);
    showToast(`Paciente ${patientToArchive.name} arquivado. Prontuários preservados.`, 'info');
    if (activePatient?.id === patientToArchive.id) {
      setActivePatient(null);
    }
    setPatientToArchive(null);
  };

  // CSV Import handling
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string).replace(/^﻿/, '');
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setCsvError('Arquivo CSV vazio ou sem cabeçalhos.');
          return;
        }

        // Excel em pt-BR exporta com ";" — detecta o separador pela linha de cabeçalho
        const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
        const splitRow = (row: string) => {
          const out: string[] = [];
          let cur = '';
          let quoted = false;
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '"' && row[i + 1] === '"') {
              cur += '"';
              i++;
            } else if (ch === '"') quoted = !quoted;
            else if (ch === sep && !quoted) {
              out.push(cur.trim());
              cur = '';
            } else cur += ch;
          }
          out.push(cur.trim());
          return out;
        };
        // dd/mm/aaaa -> aaaa-mm-dd
        const toIsoDate = (v: string) => {
          const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (br) return `${br[3]}-${br[2]}-${br[1]}`;
          return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
        };

        const parsed: Partial<Patient>[] = [];
        let skipped = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = splitRow(lines[i]);
          if (!cols[0] || !cols[1]) {
            skipped++;
            continue;
          }
          parsed.push({
            name: cols[0],
            phone: cols[1],
            birthDate: toIsoDate(cols[2] || '') || '1990-01-01',
            email: cols[3] || '',
            cpf: cols[4] || '',
            modality: 'Pilates',
            status: 'ativo',
          });
        }

        setCsvPreview(parsed);
        if (skipped) setCsvError(`${skipped} linha(s) sem nome ou telefone foram ignoradas.`);
      } catch (err) {
        setCsvError('Erro ao processar CSV. Verifique a formatação.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = () => {
    if (csvPreview.length === 0) return;
    const defaultProf = professionals[0]?.id || 'prof-1';
    const defaultPlan = plans[0]?.id || 'plan-2';

    const newPatientsList: Patient[] = csvPreview.map((item, idx) => ({
      id: `pat-csv-${Date.now()}-${idx}`,
      name: item.name || 'Paciente',
      birthDate: item.birthDate || '1990-01-01',
      cpf: item.cpf || '',
      phone: item.phone || '(81) 99999-9999',
      whatsapp: item.phone || '(81) 99999-9999',
      email: item.email || '',
      address: {
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
      },
      emergencyContact: {
        name: '',
        phone: '',
        relationship: '',
      },
      createdAt: toLocalDateKey(),
      modality: 'Pilates',
      responsibleProfessionalId: defaultProf,
      status: 'ativo',
      activePlanId: defaultPlan,
      sessionsTotal: 8,
      sessionsCompleted: 0,
      sessionsRemaining: 8,
      sessionsCancelled: 0,
      sessionsReplaced: 0,
    }));

    const count = clinicStorage.importPatients(newPatientsList);
    showToast(`${count} pacientes importados com sucesso sem duplicações!`, 'success');
    setIsCsvModalOpen(false);
    setCsvPreview([]);
  };

  const handleExportCSV = () => {
    const dataToExport = patients.map((p) => ({
      Nome: p.name,
      Nascimento: p.birthDate,
      Telefone: p.phone,
      WhatsApp: p.whatsapp,
      Email: p.email,
      CPF: p.cpf || '',
      Modalidade: p.modality,
      Status: p.status,
      SessoesRestantes: p.sessionsRemaining,
    }));
    exportToCSV(dataToExport, `pacientes_pilatesflow_${format(new Date(), 'yyyyMMdd')}`);
    showToast('Exportação CSV iniciada!', 'success');
  };

  const filteredPatients = patients.filter((p) => {
    if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, '');
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        // digits-only match so "81 98877" finds "(81) 98877-1122" and CPF with or without dots
        (qDigits.length >= 3 &&
          [p.cpf || '', p.phone, p.whatsapp].some((v) => v.replace(/\D/g, '').includes(qDigits)))
      );
    }
    return true;
  });

  // ───────────── derived information for the list and the profile ─────────────
  const todayKey = toLocalDateKey();
  const allAppointments = clinicStorage.getAppointments();
  const allPlans = clinicStorage.getPlans();
  const allCharges = clinicStorage.getCharges();
  const ageOf = (birth?: string) =>
    birth ? Math.floor((Date.now() - new Date(birth + 'T00:00:00').getTime()) / 31557600000) : undefined;

  const insightOf = (p: Patient) => {
    const next = allAppointments
      .filter((a) => a.patientId === p.id && a.date >= todayKey && (a.status === 'agendado' || a.status === 'confirmado'))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
    return {
      age: ageOf(p.birthDate),
      next,
      planName: allPlans.find((pl) => pl.id === p.activePlanId)?.name,
      professional: professionals.find((pr) => pr.id === p.responsibleProfessionalId)?.name,
      alerts: p.clinicalAlerts?.length || 0,
      overdue: allCharges.filter((c) => c.patientId === p.id && getChargeDisplayStatus(c, todayKey) === 'vencido').length,
    };
  };

  const profileInsights = (p: Patient) => {
    const rows = buildRows(p.id, clinicStorage.getPresenceSheet(p.id));
    const attended = rows.filter((r) => r.mark !== 'F').length;
    const lastEval = clinicStorage.getEvaluations(p.id)[0];
    const lv = lastEval ? computeMovementLevel(lastEval.sections, lastEval.values) : null;
    const open = allCharges.filter((c) => c.patientId === p.id && ['pendente', 'parcialmente_pago', 'vencido'].includes(getChargeDisplayStatus(c, todayKey)));
    const overdueCents = open
      .filter((c) => getChargeDisplayStatus(c, todayKey) === 'vencido')
      .reduce((s, c) => s + (c.finalAmountCents - (c.paidAmountCents || 0)), 0);
    return {
      freq: rows.length ? Math.round((attended / rows.length) * 100) : null,
      absences: rows.length - attended,
      lastEval,
      level: lv ? LEVEL_LABEL[lv.level] : null,
      overdueCents,
      openCount: open.length,
    };
  };

  const counts = {
    ativo: patients.filter((p) => p.status === 'ativo').length,
    inativo: patients.filter((p) => p.status === 'inativo').length,
    arquivado: patients.filter((p) => p.status === 'arquivado').length,
  };
  const newThisMonth = patients.filter((p) => (p.createdAt || '').slice(0, 7) === todayKey.slice(0, 7)).length;
  const needRenewal = patients.filter((p) => p.status === 'ativo' && p.sessionsRemaining <= 2).length;
  const todayCount = allAppointments.filter((a) => a.date === todayKey && a.status !== 'cancelado' && a.status !== 'reagendado').length;
  const patientsWithAlerts = patients.filter((p) => p.status === 'ativo' && (p.clinicalAlerts?.length || 0) > 0).length;
  const birthdaysThisMonth = patients.filter((p) => p.status !== 'arquivado' && p.birthDate?.slice(5, 7) === todayKey.slice(5, 7)).length;

  const listPatients = filteredPatients
    .filter((p) => (modalityFilter === 'all' || p.modality === modalityFilter) && (!renewOnly || p.sessionsRemaining <= 2))
    .sort((a, b) => {
      if (sortBy === 'sessoes') return a.sessionsRemaining - b.sessionsRemaining;
      if (sortBy === 'recentes') return (b.createdAt || '').localeCompare(a.createdAt || '');
      if (sortBy === 'proxima') {
        const na = insightOf(a).next;
        const nb = insightOf(b).next;
        return (na ? na.date + na.startTime : '9999').localeCompare(nb ? nb.date + nb.startTime : '9999');
      }
      return a.name.localeCompare(b.name);
    });

  const StatusPill: React.FC<{ status: Patient['status'] }> = ({ status }) => (
    <Pill tone={status === 'ativo' ? 'green' : status === 'inativo' ? 'amber' : 'slate'}>
      {status === 'ativo' ? 'Ativo' : status === 'inativo' ? 'Inativo' : 'Arquivado'}
    </Pill>
  );

  return (
    <div className="space-y-4">
      {/* If an active patient profile is selected, show the profile view */}
      {activePatient ? (
        <div className="space-y-4">
          {/* Back button and profile actions */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setActivePatient(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Pacientes</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(activePatient)}
                className="flex items-center gap-1 px-3 py-1.5 border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-xs font-semibold hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
              >
                <Edit className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Editar dados</span>
                <span className="sm:hidden">Editar</span>
              </button>
              {activePatient.status === 'arquivado' ? (
                <button
                  onClick={() => handleReactivatePatient(activePatient)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reativar
                </button>
              ) : (
                <button
                  onClick={() => handleArchivePatient(activePatient)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Archive className="w-3.5 h-3.5" /> Arquivar
                </button>
              )}
            </div>
          </div>

          {(() => {
            const info = insightOf(activePatient);
            const prof = profileInsights(activePatient);
            return (
              <>
                {/* Patient header */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <Avatar name={activePatient.name} size="lg" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-bold text-[#17231D] dark:text-[#F1F5F3]">{activePatient.name}</h2>
                          <StatusPill status={activePatient.status} />
                        </div>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {[
                            info.age !== undefined && `${info.age} anos (${formatDate(activePatient.birthDate)})`,
                            activePatient.modality,
                            info.professional && `Prof. ${info.professional}`,
                            activePatient.createdAt && `paciente desde ${formatDate(activePatient.createdAt.slice(0, 10), 'MM/yyyy')}`,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                        {activePatient.clinicalAlerts && activePatient.clinicalAlerts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {activePatient.clinicalAlerts.map((alt, i) => (
                              <Pill key={i} tone="amber">
                                <AlertTriangle className="w-3 h-3" /> {alt}
                              </Pill>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:flex gap-2">
                      <button
                        onClick={() => onNavigate('schedule', { action: 'new' })}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E5EAE7] dark:border-[#273830] text-xs font-bold rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
                      >
                        <Calendar className="w-4 h-4" /> Agendar
                      </button>
                      <button
                        onClick={async () => {
                          const link = await buildPortalLink(activePatient.id);
                          if (link) setPortalLink(link);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#426B5B] text-[#426B5B] dark:text-[#7FB39F] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] text-xs font-bold rounded-lg"
                      >
                        <Smartphone className="w-4 h-4" /> Portal
                      </button>
                      <button
                        onClick={() =>
                          openExternalLink(
                            buildWhatsAppLink(activePatient.whatsapp || activePatient.phone, `Olá ${activePatient.name.split(' ')[0]}, tudo bem? Equipe da clínica falando.`)
                          )
                        }
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold rounded-lg shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* indicators */}
                  <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-[#E5EAE7] dark:border-[#273830] text-xs">
                    <div>
                      <dt className="text-[#64748B]">Sessões restantes</dt>
                      <dd className={`text-lg font-bold ${activePatient.sessionsRemaining <= 2 ? 'text-rose-600' : ''}`}>
                        {activePatient.sessionsRemaining} <span className="text-xs font-semibold text-[#64748B]">de {activePatient.sessionsTotal}</span>
                      </dd>
                      <ProgressBar
                        value={activePatient.sessionsRemaining}
                        max={Math.max(1, activePatient.sessionsTotal)}
                        tone={activePatient.sessionsRemaining <= 2 ? 'rose' : 'blue'}
                        label="Sessões restantes"
                      />
                      <span className="text-[10px] text-[#64748B]">{activePatient.sessionsCompleted} realizadas</span>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Frequência</dt>
                      <dd className="text-lg font-bold">{prof.freq === null ? '—' : `${prof.freq}%`}</dd>
                      <ProgressBar value={prof.freq ?? 0} label="Frequência" />
                      <span className="text-[10px] text-[#64748B]">{prof.absences} falta(s) registrada(s)</span>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Próxima sessão</dt>
                      <dd className="text-sm font-bold mt-1">{info.next ? `${formatDate(info.next.date, 'dd/MM')} às ${info.next.startTime}` : '—'}</dd>
                      <span className="text-[10px] text-[#64748B]">{info.next?.professionalName || 'Nada agendado'}</span>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Última avaliação</dt>
                      <dd className="text-sm font-bold mt-1">{prof.lastEval ? formatDate(prof.lastEval.date) : '—'}</dd>
                      <span className="text-[10px] text-[#64748B]">{prof.level ? `Nível ${prof.level}` : prof.lastEval ? 'sem nível' : 'nunca avaliado'}</span>
                    </div>
                    <div className="col-span-2 lg:col-span-1">
                      <dt className="text-[#64748B]">Financeiro</dt>
                      <dd className={`text-sm font-bold mt-1 ${prof.overdueCents > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {prof.overdueCents > 0 ? `${formatCurrency(prof.overdueCents)} vencido` : 'Em dia'}
                      </dd>
                      <span className="text-[10px] text-[#64748B]">
                        {prof.openCount > 0 ? `${prof.openCount} cobrança(s) em aberto` : 'nenhuma cobrança em aberto'}
                      </span>
                    </div>
                  </dl>
                </div>
              </>
            );
          })()}

          {/* Profile tabs */}
          <div className="border-b border-[#E5EAE7] dark:border-[#273830] flex items-center gap-1 overflow-x-auto text-xs font-semibold -mx-1 px-1 [scrollbar-width:none]">
            {[
              { id: 'resumo', label: 'Resumo', icon: Users },
              { id: 'agenda', label: 'Agenda', icon: Calendar },
              { id: 'plano', label: 'Plano', icon: CreditCard },
              { id: 'pagamentos', label: 'Pagamentos', icon: DollarSign },
              { id: 'avaliacao', label: 'Avaliação', icon: FileText },
              { id: 'fichas', label: 'Fichas de treino', icon: Dumbbell },
              { id: 'evolucao', label: 'Evolução', icon: Activity },
              { id: 'presenca', label: 'Presença', icon: CalendarCheck2 },
              { id: 'historico', label: 'Histórico', icon: Clock },
              { id: 'documentos', label: 'Documentos', icon: FolderOpen },
            ]
              // LGPD: clinical data only for clinical roles, payments only for roles with finance access
              .filter((tab) => {
                const role = clinicStorage.getCurrentUser().role;
                if (['avaliacao', 'evolucao', 'documentos'].includes(tab.id)) return canAccessSection('records', role);
                if (tab.id === 'pagamentos') return canAccessSection('financial', role);
                return true;
              })
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = profileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setProfileTab(tab.id as any)}
                    aria-selected={isActive}
                    role="tab"
                    className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-[#426B5B] text-[#426B5B] dark:text-[#7FB39F]'
                        : 'border-transparent text-[#64748B] hover:text-[#17231D] dark:hover:text-[#F1F5F3]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
          </div>

          {/* TAB 1: RESUMO */}
          {profileTab === 'resumo' &&
            (() => {
              const info = insightOf(activePatient);
              const upcomingAppts = clinicStorage
                .getAppointments()
                .filter((a) => a.patientId === activePatient.id && a.date >= toLocalDateKey() && (a.status === 'agendado' || a.status === 'confirmado'))
                .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
                .slice(0, 4);
              const plan = clinicStorage.getPlans().find((pl) => pl.id === activePatient.activePlanId);
              const a = activePatient.address;
              const card = 'p-4 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl space-y-3';
              const title = 'text-xs font-bold uppercase text-[#64748B] tracking-wider';
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className={card}>
                    <div className="flex items-center justify-between">
                      <h3 className={title}>Próximas sessões</h3>
                      <button onClick={() => onNavigate('schedule', { action: 'new' })} className="text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
                        + Agendar
                      </button>
                    </div>
                    {upcomingAppts.length === 0 ? (
                      <p className="text-xs text-[#64748B]">Nenhuma sessão agendada.</p>
                    ) : (
                      <ul className="space-y-2">
                        {upcomingAppts.map((ap) => (
                          <li key={ap.id} className="flex items-center gap-3 text-xs">
                            <span className="w-11 shrink-0 rounded-lg bg-[#E9F1EC] dark:bg-[#1F332A] text-center py-1">
                              <span className="block font-extrabold text-sm leading-tight">{formatDate(ap.date, 'dd')}</span>
                              <span className="block text-[9px] uppercase font-bold text-[#64748B]">{formatDate(ap.date, 'MMM')}</span>
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-semibold">
                                {ap.startTime} – {ap.endTime}
                              </span>
                              <span className="block text-[11px] text-[#64748B] truncate">
                                {ap.modality} • {ap.professionalName}
                              </span>
                            </span>
                            <Pill tone={ap.status === 'confirmado' ? 'blue' : 'slate'}>{ap.status === 'confirmado' ? 'Confirmado' : 'A confirmar'}</Pill>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className={card}>
                    <h3 className={title}>Plano atual</h3>
                    {plan ? (
                      <>
                        <div>
                          <p className="text-sm font-bold">{plan.name}</p>
                          <p className="text-[11px] text-[#64748B]">
                            {formatCurrency(plan.priceCents)} • {plan.frequencyPerWeek}x/semana • {plan.durationMinutes} min • validade {plan.validityDays} dias
                          </p>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-[#64748B]">Sessões usadas</span>
                            <span className="font-bold">
                              {activePatient.sessionsTotal - activePatient.sessionsRemaining} de {activePatient.sessionsTotal}
                            </span>
                          </div>
                          <ProgressBar
                            value={activePatient.sessionsTotal - activePatient.sessionsRemaining}
                            max={Math.max(1, activePatient.sessionsTotal)}
                            tone={activePatient.sessionsRemaining <= 2 ? 'rose' : 'blue'}
                            label="Sessões usadas"
                          />
                        </div>
                        {activePatient.sessionsRemaining <= 2 && activePatient.status !== 'arquivado' && (
                          <button onClick={() => handleRenewPlan(activePatient)} className="w-full px-3 py-2 text-xs font-bold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg">
                            Renovar plano
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-[#64748B]">Sem plano vinculado. Edite o cadastro para escolher um plano.</p>
                    )}
                  </div>

                  <div className={card}>
                    <h3 className={title}>Atalhos</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Nova avaliação', icon: FileText, onClick: () => onNavigate('evaluations', { patientId: activePatient.id }) },
                        { label: 'Ficha de treino', icon: Dumbbell, onClick: () => onNavigate('planning', { patientId: activePatient.id }) },
                        { label: 'Presença', icon: CalendarCheck2, onClick: () => setProfileTab('presenca') },
                        { label: 'Prontuário', icon: Activity, onClick: () => onNavigate('records', { patientId: activePatient.id }) },
                      ].map((s) => (
                        <button
                          key={s.label}
                          onClick={s.onClick}
                          className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] hover:border-[#426B5B] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-left"
                        >
                          <s.icon className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" />
                          <span className="text-xs font-semibold">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${card} lg:col-span-2`}>
                    <h3 className={title}>Dados pessoais e contato</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {[
                        ['E-mail', activePatient.email || '—'],
                        ['CPF', activePatient.cpf || '—'],
                        ['Telefone', activePatient.phone || '—'],
                        ['WhatsApp', activePatient.whatsapp || '—'],
                        ['Endereço', a ? [a.street && `${a.street}, ${a.number}`, a.neighborhood, a.city && `${a.city}/${a.state}`].filter(Boolean).join(' - ') || '—' : '—'],
                        [
                          'Emergência',
                          activePatient.emergencyContact?.name
                            ? `${activePatient.emergencyContact.name}${activePatient.emergencyContact.relationship && !activePatient.emergencyContact.name.includes(activePatient.emergencyContact.relationship) ? ` (${activePatient.emergencyContact.relationship})` : ''} • ${activePatient.emergencyContact.phone}`
                            : '—',
                        ],
                      ].map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-[11px] text-[#64748B]">{k}</dt>
                          <dd className="font-medium break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className={card}>
                    <h3 className={title}>Observações</h3>
                    <p className="text-xs text-[#17231D] dark:text-[#F1F5F3] whitespace-pre-wrap">
                      {activePatient.administrativeNotes || 'Nenhuma observação administrativa cadastrada.'}
                    </p>
                    {info.alerts > 0 && (
                      <div className="pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">Alertas clínicos</p>
                        <ul className="list-disc pl-4 text-xs space-y-0.5">
                          {activePatient.clinicalAlerts!.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* TAB 2: AGENDA */}
          {profileTab === 'agenda' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase text-[#64748B]">
                  Agendamentos deste Paciente
                </h3>
                <button
                  onClick={() => onNavigate('schedule', { action: 'new' })}
                  className="px-2.5 py-1 bg-[#426B5B] text-white text-xs font-semibold rounded-md"
                >
                  Novo Agendamento
                </button>
              </div>
              {(() => {
                const appts = clinicStorage
                  .getAppointments()
                  .filter((a) => a.patientId === activePatient.id)
                  .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
                if (appts.length === 0) {
                  return <p className="text-xs text-[#64748B] py-4">Nenhum agendamento encontrado.</p>;
                }
                return (
                  <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                    {appts.map((a) => (
                      <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold">{formatDate(a.date)} às {a.startTime}</span>
                          <span className="text-[#64748B] ml-2">• Prof: {a.professionalName} ({a.modality})</span>
                        </div>
                        <Pill
                          tone={
                            a.status === "realizado" ? "green" : a.status === "confirmado" ? "blue" : a.status === "faltou" || a.status === "cancelado" ? "rose" : a.status === "em_atendimento" ? "amber" : "slate"
                          }
                        >
                          {STATUS_LABELS[a.status] || a.status}
                        </Pill>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: PLANO */}
          {profileTab === 'plano' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE7] dark:border-[#273830]">
                <h3 className="text-xs font-bold uppercase text-[#64748B]">Contrato & Saldo de Sessões</h3>
                <button
                  type="button"
                  onClick={() => handleRenewPlan(activePatient)}
                  className="px-3 py-1.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Renovar Ciclo (+{plans.find((pl) => pl.id === activePatient.activePlanId)?.sessionsCount ?? plans[0]?.sessionsCount ?? 0} sessões)
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200">
                  <span className="text-xs text-emerald-800">Contratadas</span>
                  <p className="text-xl font-bold text-emerald-900">{activePatient.sessionsTotal}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200">
                  <span className="text-xs text-blue-800">Realizadas</span>
                  <p className="text-xl font-bold text-blue-900">{activePatient.sessionsCompleted}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200">
                  <span className="text-xs text-amber-800">Restantes</span>
                  <p className="text-xl font-bold text-amber-900">{activePatient.sessionsRemaining}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-700">Canceladas / Repostas</span>
                  <p className="text-xl font-bold text-slate-800">{activePatient.sessionsCancelled} / {activePatient.sessionsReplaced}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PAGAMENTOS */}
          {profileTab === 'pagamentos' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase text-[#64748B]">Histórico Financeiro do Paciente</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('financial', { action: 'new_charge', patientId: activePatient.id })}
                  className="px-2.5 py-1 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-md"
                >
                  Emitir Cobrança
                </button>
              </div>
              {(() => {
                const patientCharges = clinicStorage.getCharges().filter((c) => c.patientId === activePatient.id);
                if (patientCharges.length === 0) {
                  return <p className="text-xs text-[#64748B] py-4">Nenhuma cobrança registrada.</p>;
                }
                return (
                  <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                    {patientCharges.map((chg) => (
                      <div key={chg.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold">{chg.description}</p>
                          <p className="text-[11px] text-[#64748B]">Vencimento: {formatDate(chg.dueDate)} • Criado em {formatDate(chg.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{formatCurrency(chg.finalAmountCents)}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${chg.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {chg.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 5: AVALIACAO CLINICA */}
          {profileTab === 'avaliacao' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-[#64748B]">Anamnese e Avaliação Postural</h3>
                <button
                  onClick={() => onNavigate('records', { patientId: activePatient.id })}
                  className="text-xs text-[#426B5B] dark:text-[#5A8E7A] font-semibold hover:underline"
                >
                  Abrir Prontuário Completo
                </button>
              </div>
              {(() => {
                const record = clinicStorage.getClinicalRecord(activePatient.id);
                return (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg">
                      <span className="font-bold block text-[#17231D] dark:text-[#F1F5F3]">Queixa Principal:</span>
                      <p className="text-[#64748B] mt-0.5">{record.anamnesis.mainComplaint || 'Não preenchido'}</p>
                    </div>
                    <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] rounded-lg">
                      <span className="font-bold block text-[#17231D] dark:text-[#F1F5F3]">Avaliação Postural & Testes:</span>
                      <p className="text-[#64748B] mt-0.5">{record.initialEvaluation.posturalAssessment || 'Não preenchido'}</p>
                    </div>
                  </div>
                );
              })()}
              <div className="pt-4 border-t border-[#E5EAE7] dark:border-[#273830]">
                <EvaluationsPanel patient={activePatient} />
              </div>
            </div>
          )}

          {/* TAB 10: CONTROLE DE PRESENÇA */}
          {profileTab === 'presenca' && <PresenceSheetPanel patient={activePatient} compact />}

          {/* TAB 6: FICHAS DE EXERCICIOS */}
          {profileTab === 'fichas' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase text-[#64748B]">Fichas de Treino Cadastradas</h3>
                <button
                  onClick={() => onNavigate('planning', { patientId: activePatient.id })}
                  className="px-2.5 py-1 bg-[#426B5B] text-white text-xs font-semibold rounded-md"
                >
                  Construir Nova Ficha
                </button>
              </div>
              {(() => {
                const plansList = clinicStorage.getWorkoutPlans().filter((w) => w.patientId === activePatient.id);
                if (plansList.length === 0) {
                  return <p className="text-xs text-[#64748B] py-4">Nenhuma ficha planejada para este paciente.</p>;
                }
                return (
                  <div className="space-y-2">
                    {plansList.map((wp) => (
                      <div key={wp.id} className="p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs">{wp.title}</p>
                          <p className="text-[11px] text-[#64748B]">Objetivo: {wp.professionalGoal}</p>
                        </div>
                        <button
                          onClick={() => onNavigate('planning', { patientId: activePatient.id })}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 rounded"
                        >
                          Ver / Editar Ficha
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 7: EVOLUCAO */}
          {profileTab === 'evolucao' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase text-[#64748B]">Evolução da Dor (EVA)</h3>
              <PainChart patientId={activePatient.id} />
              <h3 className="text-xs font-bold uppercase text-[#64748B] pt-3">Linha do Tempo de Evoluções Clínicas</h3>
              {(() => {
                const record = clinicStorage.getClinicalRecord(activePatient.id);
                if (record.evolutions.length === 0) {
                  return <p className="text-xs text-[#64748B] py-4">Nenhuma evolução registrada ainda.</p>;
                }
                return (
                  <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                    {record.evolutions.map((evo) => (
                      <div key={evo.id} className="py-3 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span>{evo.professionalName} ({evo.professionalCouncil})</span>
                          <span className="text-[#64748B] font-mono">{formatDate(evo.date, "dd/MM/yyyy 'às' HH:mm")}</span>
                        </div>
                        <p className="whitespace-pre-line text-[#17231D] dark:text-[#F1F5F3]">{evo.content}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 8: HISTORICO */}
          {profileTab === 'historico' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase text-[#64748B] mb-3">Histórico de Sessões Concluídas</h3>
              {(() => {
                const finished = clinicStorage.getAppointments().filter(
                  (a) => a.patientId === activePatient.id && a.status === 'realizado'
                );
                if (finished.length === 0) {
                  return <p className="text-xs text-[#64748B] py-4">Nenhum atendimento finalizado registrado até o momento.</p>;
                }
                return (
                  <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                    {finished.map((f) => (
                      <div key={f.id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold">{formatDate(f.date)} ({f.startTime} - {f.endTime})</span>
                        <span className="text-[#64748B]">Conduzido por: {f.professionalName}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 9: DOCUMENTOS */}
          {profileTab === 'documentos' && (
            <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase text-[#64748B]">Anexos e Exames Clínicos</h3>
                <button
                  type="button"
                  onClick={() => {
                    setDocTitle('');
                    setDocType('laudo');
                    setDocFileName('');
                    setIsAddDocModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-md shadow-2xs"
                >
                  Anexar Novo Documento
                </button>
              </div>
              {(() => {
                const record = clinicStorage.getClinicalRecord(activePatient.id);
                if (!record.attachments || record.attachments.length === 0) {
                  return <p className="text-xs text-[#64748B] py-4">Nenhum documento ou laudo anexado.</p>;
                }
                return (
                  <div className="space-y-2">
                    {record.attachments.map((att) => (
                      <div key={att.id} className="p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold">{att.title}</p>
                          <p className="text-[11px] text-[#64748B]">{att.fileName} • {att.date}</p>
                        </div>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium text-[10px]">
                          {att.type.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : (
        /* PATIENTS LIST */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3] flex items-center gap-2">
                <Users className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Pacientes
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
                Cadastro, plano, agenda e situação de cada paciente em um só lugar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
              >
                <Upload className="w-4 h-4 text-[#426B5B]" /> Importar
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
              >
                <Download className="w-4 h-4 text-[#426B5B]" /> Exportar
              </button>
              <button
                onClick={openNewModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" /> Novo paciente
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Pacientes ativos"
              value={counts.ativo}
              hint={`${newThisMonth} novo(s) este mês`}
              icon={Users}
              onClick={() => setStatusFilter('ativo')}
            />
            <StatCard
              label="Precisam renovar"
              value={needRenewal}
              hint="até 2 sessões restantes"
              icon={CreditCard}
              tone="rose"
              onClick={() => {
                setStatusFilter('ativo');
                setRenewOnly(true);
              }}
            />
            <StatCard
              label="Sessões hoje"
              value={todayCount}
              hint={patientsWithAlerts ? `${patientsWithAlerts} paciente(s) ativo(s) com alerta clínico` : 'abrir a agenda do dia'}
              icon={Calendar}
              tone="blue"
              onClick={() => onNavigate('schedule')}
            />
            <StatCard
              label="Aniversariantes do mês"
              value={birthdaysThisMonth}
              hint="ver central de aniversários"
              icon={Cake}
              tone="amber"
              onClick={() => onNavigate('birthdays')}
            />
          </div>

          {/* Filters */}
          <div className="p-3 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF, telefone ou e-mail…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar paciente"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 md:flex gap-2">
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  aria-label="Modalidade"
                  className="text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-2.5 py-2 font-semibold"
                >
                  <option value="all">Todas as modalidades</option>
                  {[...new Set(patients.map((p) => p.modality))].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="Ordenar"
                  className="text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-2.5 py-2 font-semibold"
                >
                  <option value="nome">Ordenar: nome</option>
                  <option value="sessoes">Menos sessões restantes</option>
                  <option value="recentes">Cadastro mais recente</option>
                  <option value="proxima">Próxima sessão</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['todos', 'Todos'],
                  ['ativo', 'Ativos'],
                  ['inativo', 'Inativos'],
                  ['arquivado', 'Arquivados'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  aria-pressed={statusFilter === v}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    statusFilter === v
                      ? 'bg-[#426B5B] border-[#426B5B] text-white'
                      : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
                  }`}
                >
                  {l} <span className="opacity-70">{v === 'todos' ? patients.length : counts[v]}</span>
                </button>
              ))}
              <button
                onClick={() => setRenewOnly(!renewOnly)}
                aria-pressed={renewOnly}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  renewOnly ? 'bg-rose-600 border-rose-600 text-white' : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
                }`}
              >
                Precisam renovar
              </button>
            </div>
          </div>

          {listPatients.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-dashed border-[#E5EAE7] dark:border-[#273830] text-sm text-[#64748B]">
              Nenhum paciente encontrado com esses filtros.
            </div>
          ) : (
            <>
              {/* phones: cards */}
              <ul className="md:hidden space-y-2">
                {listPatients.map((p) => {
                  const info = insightOf(p);
                  return (
                    <li key={p.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActivePatient(p)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setActivePatient(p))}
                        className="p-3 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] space-y-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{p.name}</p>
                            <p className="text-[11px] text-[#64748B] truncate">
                              {[info.age !== undefined && `${info.age} anos`, p.modality, info.planName].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                          <StatusPill status={p.status} />
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-[#64748B]">Sessões restantes</span>
                            <span className={`font-bold ${p.sessionsRemaining <= 2 ? 'text-rose-600' : ''}`}>
                              {p.sessionsRemaining} de {p.sessionsTotal}
                            </span>
                          </div>
                          <ProgressBar value={p.sessionsRemaining} max={Math.max(1, p.sessionsTotal)} tone={p.sessionsRemaining <= 2 ? 'rose' : 'blue'} label="Sessões restantes" />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-[#64748B]">
                            Próxima: <b className="text-[#17231D] dark:text-[#F1F5F3]">{info.next ? `${formatDate(info.next.date, 'dd/MM')} ${info.next.startTime}` : '—'}</b>
                          </span>
                          <div className="flex gap-1">
                            {info.alerts > 0 && (
                              <Pill tone="rose" title={p.clinicalAlerts?.join(' • ')}>
                                <AlertTriangle className="w-3 h-3" /> {info.alerts}
                              </Pill>
                            )}
                            {info.overdue > 0 && <Pill tone="amber">{info.overdue} cobrança(s) vencida(s)</Pill>}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* larger screens: table */}
              <div className="hidden md:block bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Paciente</th>
                      <th className="px-3 py-3">Contato</th>
                      <th className="px-3 py-3 w-44">Plano / sessões</th>
                      <th className="px-3 py-3">Próxima sessão</th>
                      <th className="px-3 py-3">Profissional</th>
                      <th className="px-3 py-3">Situação</th>
                      <th className="px-3 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                    {listPatients.map((p) => {
                      const info = insightOf(p);
                      return (
                        <tr key={p.id} onClick={() => setActivePatient(p)} className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] transition-colors cursor-pointer">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={p.name} size="sm" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#17231D] dark:text-[#F1F5F3] truncate">{p.name}</p>
                                <p className="text-[11px] text-[#64748B]">
                                  {info.age !== undefined ? `${info.age} anos` : '—'} • {p.modality}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{p.whatsapp || p.phone}</p>
                            <p className="text-[11px] text-[#64748B] truncate max-w-[12rem]">{p.email || '—'}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-[11px] font-semibold truncate max-w-[11rem]">{info.planName || 'Sem plano'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <ProgressBar value={p.sessionsRemaining} max={Math.max(1, p.sessionsTotal)} tone={p.sessionsRemaining <= 2 ? 'rose' : 'blue'} label="Sessões restantes" />
                              <span className={`text-[11px] font-bold whitespace-nowrap ${p.sessionsRemaining <= 2 ? 'text-rose-600' : ''}`}>
                                {p.sessionsRemaining}/{p.sessionsTotal}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono">{info.next ? `${formatDate(info.next.date, 'dd/MM')} ${info.next.startTime}` : '—'}</td>
                          <td className="px-3 py-3 text-[11px]">{info.professional || '—'}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              <StatusPill status={p.status} />
                              {p.status === 'ativo' && p.sessionsRemaining <= 2 && <Pill tone="rose">Renovar</Pill>}
                              {info.alerts > 0 && (
                                <Pill tone="amber" title={p.clinicalAlerts?.join(' • ')}>
                                  <AlertTriangle className="w-3 h-3" /> {info.alerts}
                                </Pill>
                              )}
                              {info.overdue > 0 && <Pill tone="rose">Cobrança vencida</Pill>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openExternalLink(buildWhatsAppLink(p.whatsapp || p.phone, `Olá ${p.name.split(' ')[0]}, tudo bem? Equipe da ${clinicStorage.getSettings().clinicName} falando.`))}
                                className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="WhatsApp"
                                aria-label={`WhatsApp de ${p.name}`}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditModal(p)} className="p-1.5 rounded-md text-[#64748B] hover:bg-slate-100 dark:hover:bg-[#1F332A]" title="Editar" aria-label={`Editar ${p.name}`}>
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => setActivePatient(p)} className="p-1.5 rounded-md text-[#64748B] hover:bg-slate-100 dark:hover:bg-[#1F332A]" title="Abrir perfil" aria-label={`Abrir perfil de ${p.name}`}>
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* NEW / EDIT PATIENT MODAL */}
      {isNewPatientModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewPatientModalOpen(false)}
          title={editingPatient ? 'Editar Paciente' : 'Novo Cadastro de Paciente'}
          description="Preencha os dados cadastrais, clínicos e contratuais."
          maxWidth="3xl"
        >
          <form onSubmit={handleSavePatient} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Data de Nascimento *</label>
                <input
                  type="date"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Telefone Principal *</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">CPF</label>
                <input
                  type="text"
                  value={formCpf}
                  onChange={(e) => setFormCpf(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">E-mail</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <fieldset className="p-3 rounded-xl border border-[#E5EAE7] dark:border-[#273830] space-y-3">
              <legend className="px-1 text-xs font-bold text-[#64748B]">Endereço</legend>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <input
                  placeholder="Rua / Avenida"
                  value={formStreet}
                  onChange={(e) => setFormStreet(e.target.value)}
                  className="sm:col-span-4 w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
                <input
                  placeholder="Número"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  className="sm:col-span-2 w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
                <input
                  placeholder="Bairro"
                  value={formNeighborhood}
                  onChange={(e) => setFormNeighborhood(e.target.value)}
                  className="sm:col-span-3 w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
                <input
                  placeholder="Cidade"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="sm:col-span-2 w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
                <input
                  placeholder="UF"
                  maxLength={2}
                  value={formState}
                  onChange={(e) => setFormState(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Contato de Emergência</label>
                <input
                  placeholder="Nome (parentesco)"
                  value={formEmergencyName}
                  onChange={(e) => setFormEmergencyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Telefone de Emergência</label>
                <input
                  value={formEmergencyPhone}
                  onChange={(e) => setFormEmergencyPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Profissional Responsável</label>
                <select
                  value={formResponsibleProfId}
                  onChange={(e) => setFormResponsibleProfId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                >
                  {professionals
                    .filter((pr) => pr.role !== 'receptionist')
                    .map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Modalidade Inicial</label>
                <select
                  value={formModality}
                  onChange={(e) => setFormModality(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                >
                  {clinicStorage
                    .getServiceAreas()
                    .filter((a) => a.active || a.name === formModality)
                    .map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Plano Inicial</label>
                <select
                  value={formPlanId}
                  onChange={(e) => setFormPlanId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                >
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} - {formatCurrency(pl.priceCents)} ({pl.sessionsCount} sessões)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Alertas Clínicos Autorizados (Separar por vírgula)
              </label>
              <input
                type="text"
                placeholder="Ex: Hérnia discal L5-S1, Labirintite, Encurtamento de cadeia posterior"
                value={formAlertsInput}
                onChange={(e) => setFormAlertsInput(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Observações Administrativas</label>
              <textarea
                value={formAdminNotes}
                onChange={(e) => setFormAdminNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsNewPatientModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Paciente
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CSV IMPORT MODAL */}
      {isCsvModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCsvModalOpen(false)}
          title="Importação de Pacientes via CSV"
          description="Selecione um arquivo CSV com as colunas: Nome, Telefone, Nascimento, Email, CPF."
        >
          <div className="space-y-4">
            {csvError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200">
                {csvError}
              </div>
            )}

            <div className="border-2 border-dashed border-[#E5EAE7] dark:border-[#273830] rounded-xl p-6 text-center">
              <Upload className="w-8 h-8 text-[#426B5B] mx-auto mb-2" />
              <p className="text-xs font-medium text-[#17231D] dark:text-[#F1F5F3]">
                Clique para selecionar seu arquivo .csv
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                className="mt-3 text-xs mx-auto block"
              />
            </div>

            {csvPreview.length > 0 && (
              <div>
                <span className="text-xs font-bold block mb-2">
                  Pré-visualização ({csvPreview.length} registros prontos para validação):
                </span>
                <div className="max-h-48 overflow-y-auto border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-xs divide-y divide-[#E5EAE7]">
                  {csvPreview.map((item, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-[#64748B]">{item.phone} • {item.birthDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={csvPreview.length === 0}
                onClick={handleConfirmCsvImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm disabled:opacity-50"
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* NEW DOCUMENT / ATTACHMENT MODAL */}
      {isAddDocModalOpen && activePatient && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddDocModalOpen(false)}
          title="Anexar Documento ao Prontuário"
          description={`Upload e vinculação de laudo ou exame ao histórico de ${activePatient.name}.`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!docTitle.trim()) return;
              clinicStorage.addClinicalAttachment(activePatient.id, {
                title: docTitle.trim(),
                type: docType,
                fileName: docFileName.trim() || `${docTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
              });
              showToast('Documento anexado com sucesso ao prontuário!', 'success');
              setIsAddDocModalOpen(false);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                Título do Documento *
              </label>
              <input
                type="text"
                placeholder="Ex: Ressonância Magnética Lombar L4-L5"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                >
                  <option value="laudo">Laudo Radiológico / Médico</option>
                  <option value="exame">Exame Complementar</option>
                  <option value="foto_postural">Foto / Avaliação Postural</option>
                  <option value="termo">Termo / Contrato Assinado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Nome do Arquivo (Simulado)
                </label>
                <input
                  type="text"
                  placeholder="laudo_lombar_2026.pdf"
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsAddDocModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Anexo
              </button>
            </div>
          </form>
        </Modal>
      )}

      {portalLink && activePatient && (
        <Modal
          isOpen={true}
          onClose={() => setPortalLink(null)}
          title="Portal do paciente"
          description={`Link pessoal de ${activePatient.name} — válido por 60 dias.`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              O paciente vê pelo celular o saldo de sessões, as próximas sessões e a ficha de exercícios com as
              demonstrações animadas. Não inclui prontuário, alertas clínicos nem dados financeiros.
            </p>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
              O link é um retrato de agora: se a agenda ou a ficha mudarem, gere e envie um novo. Envie apenas para o
              próprio paciente — quem tiver o link consegue abrir a página.
            </div>
            <input
              readOnly
              value={portalLink}
              onFocus={(e) => e.target.select()}
              className="w-full px-3 py-2 font-mono text-[11px] bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <a
                href={portalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 border border-[#E5EAE7] dark:border-[#273830] rounded-lg font-semibold"
              >
                Pré-visualizar
              </a>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(portalLink);
                  showToast(ok ? 'Link copiado!' : 'Não foi possível copiar.', ok ? 'success' : 'error');
                }}
                className="px-3 py-2 border border-[#E5EAE7] dark:border-[#273830] rounded-lg font-semibold"
              >
                Copiar link
              </button>
              <button
                onClick={() =>
                  openExternalLink(
                    buildWhatsAppLink(
                      activePatient.whatsapp || activePatient.phone,
                      `Olá ${activePatient.name.split(' ')[0]}! Aqui está sua área de paciente, com suas próximas sessões e sua ficha de exercícios: ${portalLink}`
                    )
                  )
                }
                className="px-3 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg font-bold flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Enviar por WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ARCHIVE PATIENT CONFIRMATION MODAL */}
      {patientToArchive && (
        <Modal
          isOpen={true}
          onClose={() => setPatientToArchive(null)}
          title="Arquivar Paciente"
          description="Confirmação de arquivamento seguro."
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold">Atenção:</p>
              <p className="mt-1">
                Você está arquivando o cadastro de <strong>{patientToArchive.name}</strong>.
                Todo o histórico clínico, evoluções e prontuários serão preservados de forma imutável conforme a LGPD e normas do COFFITO.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setPatientToArchive(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                Confirmar Arquivamento
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
