import React, { useState, useEffect } from 'react';
import {
  FileText,
  User,
  Plus,
  ShieldCheck,
  Clock,
  Paperclip,
  Check,
  AlertCircle,
  Calendar,
  Lock,
  MessageSquare,
  FileCheck,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { formatDate } from '../../lib/utils';
import { Patient, ClinicalRecord, ClinicalEvolutionEntry } from '../../types';
import { Modal } from '../common/Modal';
import { PainChart } from '../common/PainChart';
import { useToast } from '../common/Toast';

interface ClinicalRecordsViewProps {
  onNavigate: (section: string, payload?: any) => void;
  patientId?: string;
}

export const ClinicalRecordsView: React.FC<ClinicalRecordsViewProps> = ({
  onNavigate,
  patientId: initialPatientId,
}) => {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || '');
  const [record, setRecord] = useState<ClinicalRecord | null>(null);
  const [currentUser, setCurrentUser] = useState(clinicStorage.getCurrentUser());

  // Editing tabs inside record
  const [activeTab, setActiveTab] = useState<'evolucao' | 'anamnese' | 'avaliacao' | 'documentos'>('evolucao');

  // Adendum modal state
  const [selectedEvoForAdendum, setSelectedEvoForAdendum] = useState<string | null>(null);
  const [adendumText, setAdendumText] = useState('');

  // New evolution modal state
  const [isNewEvoModalOpen, setIsNewEvoModalOpen] = useState(false);
  const [newEvoContent, setNewEvoContent] = useState('');

  // Anamnese & Initial Evaluation state for editing
  const [anamneseForm, setAnamneseForm] = useState({
    mainComplaint: '',
    historyOfPresentIllness: '',
    pastMedicalHistory: '',
    medications: '',
    surgeriesAndInjuries: '',
    lifestyleHabits: '',
  });

  const [evaluationForm, setEvaluationForm] = useState({
    posturalAssessment: '',
    flexibilityAndMobility: '',
    strengthEvaluation: '',
    palpationNotes: '',
    specificTests: '',
    clinicalGoals: '',
  });

  // Forms are hydrated only when the patient changes: storage notifications must not erase unsaved edits
  const hydratedFor = React.useRef<string | null>(null);

  useEffect(() => {
    const load = () => {
      const pts = clinicStorage.getPatients();
      setPatients(pts);
      setCurrentUser(clinicStorage.getCurrentUser());

      const targetId = selectedPatientId || initialPatientId || pts[0]?.id || '';
      if (targetId) {
        if (targetId !== selectedPatientId) setSelectedPatientId(targetId);
        const rec = clinicStorage.getClinicalRecord(targetId);
        setRecord(rec);
        if (hydratedFor.current !== targetId) {
          hydratedFor.current = targetId;
          setAnamneseForm(rec.anamnesis);
          setEvaluationForm(rec.initialEvaluation);
        }
      }
    };
    load();
    return clinicStorage.subscribe(load);
  }, [selectedPatientId, initialPatientId]);

  const isDirty =
    !!record &&
    (JSON.stringify(anamneseForm) !== JSON.stringify(record.anamnesis) ||
      JSON.stringify(evaluationForm) !== JSON.stringify(record.initialEvaluation));

  const handleSelectPatient = (id: string) => {
    if (isDirty && !window.confirm('Há alterações não salvas na anamnese/avaliação. Trocar de paciente mesmo assim?')) {
      return;
    }
    setSelectedPatientId(id);
  };

  const handleSaveAnamnese = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    const updated: ClinicalRecord = {
      ...record,
      anamnesis: anamneseForm,
    };
    clinicStorage.saveClinicalRecord(updated);
    setRecord(updated);
    showToast('Anamnese clínica salva com sucesso!', 'success');
  };

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    const updated: ClinicalRecord = {
      ...record,
      initialEvaluation: evaluationForm,
    };
    clinicStorage.saveClinicalRecord(updated);
    setRecord(updated);
    showToast('Avaliação postural salva com sucesso!', 'success');
  };

  const handleSaveNewEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !newEvoContent.trim()) return;

    const council = clinicStorage.getProfessionals().find((p) => p.id === currentUser.id)?.councilRegistration;
    const newEntry: ClinicalEvolutionEntry = {
      id: `evo-${Date.now()}`,
      date: new Date().toISOString(),
      professionalName: currentUser.name,
      professionalCouncil: council && council !== '-' ? council : 'CREFITO',
      content: newEvoContent.trim(),
    };

    clinicStorage.addEvolutionEntry(record.patientId, newEntry);
    setNewEvoContent('');
    setIsNewEvoModalOpen(false);
    showToast('Nova evolução adicionada ao prontuário!', 'success');
  };

  const handleAddAdendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !selectedEvoForAdendum || !adendumText.trim()) return;

    clinicStorage.addEvolutionAdendum(
      record.patientId,
      selectedEvoForAdendum,
      adendumText.trim(),
      currentUser.name
    );

    setSelectedEvoForAdendum(null);
    setAdendumText('');
    showToast('Adendo formal registrado na evolução!', 'success');
  };

  const currentPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Prontuário Eletrônico & Evoluções Clínicas
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Linha do tempo imutável de evoluções, adendos assinados e segurança em saúde (LGPD).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Auditoria Ativa</span>
          </div>
        </div>
      </div>

      {/* Patient Selector Bar */}
      <div className="p-3 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-[#64748B] whitespace-nowrap">Paciente Ativo:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => handleSelectPatient(e.target.value)}
            className="w-full sm:w-72 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-3 py-1.5 text-xs font-bold text-[#17231D] dark:text-[#F1F5F3]"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.modality})
              </option>
            ))}
          </select>
        </div>

        {currentPatient && (
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <span>Nascimento: <strong>{formatDate(currentPatient.birthDate)}</strong></span>
            <span>•</span>
            <span>Tel: <strong>{currentPatient.phone}</strong></span>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="border-b border-[#E5EAE7] dark:border-[#273830] flex items-center gap-1 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('evolucao')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'evolucao'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Evolução Cronológica ({record?.evolutions.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('anamnese')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'anamnese'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Anamnese</span>
        </button>

        <button
          onClick={() => setActiveTab('avaliacao')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'avaliacao'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Avaliação Postural & Testes</span>
        </button>

        <button
          onClick={() => setActiveTab('documentos')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'documentos'
              ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
              : 'border-transparent text-[#64748B]'
          }`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Documentos & Laudos ({record?.attachments?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: EVOLUCAO CRONOLOGICA */}
      {activeTab === 'evolucao' && (
        <div className="space-y-4">
          {selectedPatientId && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-2">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Evolução da Dor (EVA)</span>
              <PainChart patientId={selectedPatientId} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Histórico Inalterável de Atendimentos
            </span>
            <button
              onClick={() => setIsNewEvoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Inserir Nova Evolução</span>
            </button>
          </div>

          <div className="space-y-3">
            {record?.evolutions && record.evolutions.length > 0 ? (
              record.evolutions.map((evo) => (
                <div
                  key={evo.id}
                  className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-2 relative"
                >
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E5EAE7] dark:border-[#273830]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17231D] dark:text-[#F1F5F3]">
                        {evo.professionalName}
                      </span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                        {evo.professionalCouncil}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[#64748B] font-mono text-[11px]">
                        {formatDate(evo.date, "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                      <button
                        onClick={() => setSelectedEvoForAdendum(evo.id)}
                        className="text-xs text-[#426B5B] dark:text-[#5A8E7A] font-semibold hover:underline flex items-center gap-1"
                        title="Adicionar adendo auditável"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Adendo</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#17231D] dark:text-[#F1F5F3] whitespace-pre-line leading-relaxed">
                    {evo.content}
                  </p>

                  {/* Registered signed adendums */}
                  {evo.adendums && evo.adendums.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        Adendos Posteriores Auditados:
                      </span>
                      {evo.adendums.map((ad) => (
                        <div
                          key={ad.id}
                          className="p-2 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold text-amber-900 dark:text-amber-300">
                            <span>Autor: {ad.author}</span>
                            <span>{formatDate(ad.date, "dd/MM/yyyy 'às' HH:mm")}</span>
                          </div>
                          <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1">{ad.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl text-center text-[#64748B] text-xs">
                Nenhuma evolução clínica registrada até o momento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANAMNESE */}
      {activeTab === 'anamnese' && (
        <form onSubmit={handleSaveAnamnese} className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
            <h3 className="text-xs font-bold uppercase text-[#64748B]">
              Anamnese Inicial
              {isDirty && <span className="ml-2 normal-case text-amber-600 dark:text-amber-400">• alterações não salvas</span>}
            </h3>
            <button
              type="submit"
              className="px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Salvar Anamnese
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Queixa Principal *</label>
              <textarea
                rows={2}
                value={anamneseForm.mainComplaint}
                onChange={(e) => setAnamneseForm({ ...anamneseForm, mainComplaint: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                placeholder="Motivo da busca pelo Pilates/Fisioterapia..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">História da Doença Atual (HDA)</label>
              <textarea
                rows={2}
                value={anamneseForm.historyOfPresentIllness}
                onChange={(e) => setAnamneseForm({ ...anamneseForm, historyOfPresentIllness: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Antecedentes Médicos / Diagnósticos</label>
                <input
                  type="text"
                  value={anamneseForm.pastMedicalHistory}
                  onChange={(e) => setAnamneseForm({ ...anamneseForm, pastMedicalHistory: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Medicamentos em Uso</label>
                <input
                  type="text"
                  value={anamneseForm.medications}
                  onChange={(e) => setAnamneseForm({ ...anamneseForm, medications: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Cirurgias e Lesões Prévias</label>
                <input
                  type="text"
                  value={anamneseForm.surgeriesAndInjuries}
                  onChange={(e) => setAnamneseForm({ ...anamneseForm, surgeriesAndInjuries: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Hábitos de Vida & Práticas Corporais</label>
                <input
                  type="text"
                  value={anamneseForm.lifestyleHabits}
                  onChange={(e) => setAnamneseForm({ ...anamneseForm, lifestyleHabits: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: AVALIACAO POSTURAL */}
      {activeTab === 'avaliacao' && (
        <form onSubmit={handleSaveEvaluation} className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
            <h3 className="text-xs font-bold uppercase text-[#64748B]">
              Avaliação Postural e Funcional
              {isDirty && <span className="ml-2 normal-case text-amber-600 dark:text-amber-400">• alterações não salvas</span>}
            </h3>
            <button
              type="submit"
              className="px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Salvar Avaliação
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Inspeção e Avaliação Postural</label>
              <textarea
                rows={2}
                value={evaluationForm.posturalAssessment}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, posturalAssessment: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                placeholder="Plano frontal, sagital e desvios encontrados..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Flexibilidade e Mobilidade Articular</label>
                <input
                  type="text"
                  value={evaluationForm.flexibilityAndMobility}
                  onChange={(e) => setEvaluationForm({ ...evaluationForm, flexibilityAndMobility: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Força e Estabilização de Core</label>
                <input
                  type="text"
                  value={evaluationForm.strengthEvaluation}
                  onChange={(e) => setEvaluationForm({ ...evaluationForm, strengthEvaluation: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Palpação</label>
                <input
                  type="text"
                  value={evaluationForm.palpationNotes}
                  onChange={(e) => setEvaluationForm({ ...evaluationForm, palpationNotes: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Testes Específicos</label>
                <input
                  type="text"
                  value={evaluationForm.specificTests}
                  onChange={(e) => setEvaluationForm({ ...evaluationForm, specificTests: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Objetivos Terapêuticos Traçados</label>
              <textarea
                rows={2}
                value={evaluationForm.clinicalGoals}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, clinicalGoals: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: DOCUMENTOS */}
      {activeTab === 'documentos' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-[#64748B]">Anexos e Laudos Médicos</h3>
          {record?.attachments && record.attachments.length > 0 ? (
            <div className="space-y-2">
              {record.attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-[#426B5B]" />
                    <div>
                      <p className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{att.title}</p>
                      <p className="text-[11px] text-[#64748B]">{att.fileName} • Data: {att.date}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-800 uppercase">
                    {att.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#64748B] py-6 text-center">Nenhum laudo anexado.</p>
          )}
        </div>
      )}

      {/* NEW EVOLUTION MODAL */}
      {isNewEvoModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewEvoModalOpen(false)}
          title="Nova Evolução no Prontuário"
          description="O registro será assinado digitalmente com carimbo de data e hora."
        >
          <form onSubmit={handleSaveNewEvolution} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Descrição Clínica *</label>
              <textarea
                rows={5}
                value={newEvoContent}
                onChange={(e) => setNewEvoContent(e.target.value)}
                placeholder="Descreva conduta adotada, exercícios realizados, resposta analgésica e orientações..."
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsNewEvoModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar no Prontuário
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ADENDUM MODAL */}
      {selectedEvoForAdendum && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEvoForAdendum(null)}
          title="Inserir Adendo Formal à Evolução"
          description="Registros clínicos consolidados não podem ser modificados. O adendo é anexado com trilha de auditoria."
        >
          <form onSubmit={handleAddAdendum} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Texto do Adendo *</label>
              <textarea
                rows={3}
                value={adendumText}
                onChange={(e) => setAdendumText(e.target.value)}
                placeholder="Informação complementar, esclarecimento ou observação posterior..."
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setSelectedEvoForAdendum(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Assinar Adendo
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
