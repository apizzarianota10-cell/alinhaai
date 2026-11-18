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
} from '../../lib/utils';
import { buildPortalLink } from '../../lib/portal';
import { format } from 'date-fns';
import { Patient, Appointment, Charge, WorkoutPlan, ClinicalRecord, Plan } from '../../types';
import { Modal } from '../common/Modal';
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

  // Active view: List vs Detail Profile (derived from the live list so edits/renewals show at once)
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const activePatient = patients.find((p) => p.id === activePatientId) || null;
  const setActivePatient = (p: Patient | null) => setActivePatientId(p ? p.id : null);
  const [profileTab, setProfileTab] = useState<
    'resumo' | 'agenda' | 'plano' | 'pagamentos' | 'avaliacao' | 'fichas' | 'evolucao' | 'historico' | 'documentos'
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
  const [formModality, setFormModality] = useState<'Pilates' | 'Fisioterapia' | 'Quiropraxia' | 'Reabilitação'>('Pilates');
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

  return (
    <div className="space-y-4">
      {/* If an active patient profile is selected, show the 9-tab profile view */}
      {activePatient ? (
        <div className="space-y-4">
          {/* Back button and profile banner */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActivePatient(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#426B5B] dark:text-[#5A8E7A] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para lista de pacientes</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(activePatient)}
                className="flex items-center gap-1 px-3 py-1.5 border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar Dados</span>
              </button>
              {activePatient.status === 'arquivado' ? (
                <button
                  onClick={() => handleReactivatePatient(activePatient)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Reativar</span>
                </button>
              ) : (
                <button
                  onClick={() => handleArchivePatient(activePatient)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Arquivar</span>
                </button>
              )}
            </div>
          </div>

          {/* Patient Overview Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#426B5B] text-white flex items-center justify-center font-bold text-xl uppercase shadow-md">
                {activePatient.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-[#17231D] dark:text-[#F1F5F3]">
                    {activePatient.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A] capitalize">
                    {activePatient.status}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Nascimento: {formatDate(activePatient.birthDate)} • Tel: {activePatient.phone} • WhatsApp: {activePatient.whatsapp}
                </p>
                {activePatient.clinicalAlerts && activePatient.clinicalAlerts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activePatient.clinicalAlerts.map((alt, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-medium">
                        ⚠️ {alt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 md:border-l border-[#E5EAE7] dark:border-[#273830] pt-3 md:pt-0 md:pl-5">
              <div className="text-left md:text-right">
                <span className="text-[11px] text-[#64748B] block">Saldo de Sessões:</span>
                <span className="text-lg font-bold text-[#426B5B] dark:text-[#5A8E7A]">
                  {activePatient.sessionsRemaining} de {activePatient.sessionsTotal}
                </span>
                <span className="text-[10px] text-[#64748B] block mt-0.5">
                  ({activePatient.sessionsCompleted} realizadas)
                </span>
              </div>
              <button
                onClick={async () => {
                  const link = await buildPortalLink(activePatient.id);
                  if (link) setPortalLink(link);
                }}
                className="px-3 py-2 border border-[#426B5B] text-[#426B5B] dark:text-[#7FB39F] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] text-xs font-bold rounded-lg flex items-center gap-1.5"
              >
                <Smartphone className="w-4 h-4" />
                <span>Portal do paciente</span>
              </button>
              <button
                onClick={() =>
                  openExternalLink(
                    buildWhatsAppLink(
                      activePatient.whatsapp,
                      `Olá ${activePatient.name.split(' ')[0]}, tudo bem? Equipe da clínica falando.`
                    )
                  )
                }
                className="px-3 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* 9 Profile Tabs */}
          <div className="border-b border-[#E5EAE7] dark:border-[#273830] flex items-center gap-1 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'resumo', label: '1. Resumo', icon: Users },
              { id: 'agenda', label: '2. Agenda', icon: Calendar },
              { id: 'plano', label: '3. Plano Contratado', icon: CreditCard },
              { id: 'pagamentos', label: '4. Pagamentos', icon: CreditCard },
              { id: 'avaliacao', label: '5. Avaliação Clínica', icon: FileText },
              { id: 'fichas', label: '6. Fichas de Exercícios', icon: Dumbbell },
              { id: 'evolucao', label: '7. Evolução', icon: Activity },
              { id: 'historico', label: '8. Histórico', icon: Clock },
              { id: 'documentos', label: '9. Documentos', icon: FolderOpen },
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
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
                      : 'border-transparent text-[#64748B] hover:text-[#17231D]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: RESUMO */}
          {profileTab === 'resumo' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl space-y-3">
                <h3 className="text-xs font-bold uppercase text-[#64748B] tracking-wider">
                  Dados Pessoais & Contato
                </h3>
                <div className="text-xs space-y-2">
                  <p><span className="text-[#64748B]">E-mail:</span> {activePatient.email || '-'}</p>
                  <p><span className="text-[#64748B]">CPF:</span> {activePatient.cpf || '-'}</p>
                  <p><span className="text-[#64748B]">Telefone:</span> {activePatient.phone}</p>
                  <p><span className="text-[#64748B]">WhatsApp:</span> {activePatient.whatsapp}</p>
                  <p><span className="text-[#64748B]">Endereço:</span> {activePatient.address.street}, {activePatient.address.number} - {activePatient.address.neighborhood}, {activePatient.address.city}/{activePatient.address.state}</p>
                  <p><span className="text-[#64748B]">Emergência:</span> {activePatient.emergencyContact.name} ({activePatient.emergencyContact.phone})</p>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl space-y-3">
                <h3 className="text-xs font-bold uppercase text-[#64748B] tracking-wider">
                  Observações Administrativas
                </h3>
                <p className="text-xs text-[#17231D] dark:text-[#F1F5F3]">
                  {activePatient.administrativeNotes || 'Nenhuma observação administrativa cadastrada.'}
                </p>
              </div>
            </div>
          )}

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
                const appts = clinicStorage.getAppointments().filter((a) => a.patientId === activePatient.id);
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
                        <span className="px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-800 uppercase text-[10px]">
                          {a.status}
                        </span>
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
            </div>
          )}

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
        /* PATIENTS TABLE & ACTIONS */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
                Gestão de Pacientes
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
                Cadastro completo, histórico clínico, contratos e importação/exportação segura.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9]"
              >
                <Upload className="w-4 h-4 text-[#426B5B]" />
                <span>Importar CSV</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold rounded-lg hover:bg-[#F8FAF9]"
              >
                <Download className="w-4 h-4 text-[#426B5B]" />
                <span>Exportar</span>
              </button>
              <button
                onClick={openNewModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Paciente</span>
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-3 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-[#64748B]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-2.5 py-1.5 font-medium"
              >
                <option value="todos">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
                <option value="arquivado">Arquivados</option>
              </select>
            </div>
          </div>

          {/* Patients Table */}
          <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAF9] dark:bg-[#111A15] border-b border-[#E5EAE7] dark:border-[#273830] text-[#64748B] uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Paciente</th>
                  <th className="p-3.5">Telefone / WhatsApp</th>
                  <th className="p-3.5">Modalidade</th>
                  <th className="p-3.5">Sessões Restantes</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#64748B]">
                      Nenhum paciente encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setActivePatient(p)}
                      className="hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] transition-colors cursor-pointer"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A] font-bold flex items-center justify-center shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{p.name}</p>
                            <p className="text-[11px] text-[#64748B]">Nasc: {formatDate(p.birthDate)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-[#17231D] dark:text-[#F1F5F3] font-medium">
                        {p.whatsapp || p.phone}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px]">
                          {p.modality}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              p.sessionsRemaining <= 1 ? 'text-rose-600' : 'text-[#426B5B] dark:text-[#5A8E7A]'
                            }`}
                          >
                            {p.sessionsRemaining} de {p.sessionsTotal}
                          </span>
                          {p.sessionsRemaining <= 1 && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-1.5 py-0.2 rounded">
                              Renovar
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.status === 'ativo'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActivePatient(p)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
                            title="Ver Perfil 360°"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  onChange={(e) => setFormModality(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                >
                  <option value="Pilates">Pilates Clínico Individual</option>
                  <option value="Fisioterapia">Fisioterapia</option>
                  <option value="Quiropraxia">Quiropraxia</option>
                  <option value="Reabilitação">Reabilitação de Coluna</option>
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
