import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  Copy,
  Printer,
  Edit,
  User,
  Dumbbell,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { EXERCISE_LEVELS, getExerciseLevel } from '../../lib/pilatesCatalog';
import { formatDate, toLocalDateKey, printElement } from '../../lib/utils';

/** "Segunda" -> "Segunda-feira"; "Sábado" stays as is */
const dayLabel = (day: string) => (day === 'Sábado' ? day : `${day}-feira`);
import { WorkoutPlan, WorkoutItem, Patient, Exercise } from '../../types';
import { Modal } from '../common/Modal';
import { StatCard, Avatar } from '../common/Insights';
import { useToast } from '../common/Toast';

interface PlanningViewProps {
  onNavigate: (section: string, payload?: any) => void;
  patientId?: string;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ onNavigate, patientId: initialPatientId }) => {
  const { showToast } = useToast();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentUser, setCurrentUser] = useState(clinicStorage.getCurrentUser());

  // Filter / Active Plan
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || 'all');
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [printPlan, setPrintPlan] = useState<WorkoutPlan | null>(null);
  const [planToDeleteId, setPlanToDeleteId] = useState<string | null>(null);

  // Form states for builder
  const [formPatientId, setFormPatientId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formGoal, setFormGoal] = useState('');
  const [activeTabDay, setActiveTabDay] = useState<
    'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado'
  >('Segunda');
  const [currentDayItems, setCurrentDayItems] = useState<Record<string, WorkoutItem[]>>({
    Segunda: [],
    Terça: [],
    Quarta: [],
    Quinta: [],
    Sexta: [],
    Sábado: [],
  });

  // Modal to add exercise item
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [addExId, setAddExId] = useState('');
  const [addSets, setAddSets] = useState(3);
  const [addReps, setAddReps] = useState('10');
  const [addSprings, setAddSprings] = useState('1 mola vermelha');
  const [addObs, setAddObs] = useState('');
  const [settingsClinicName, setSettingsClinicName] = useState(clinicStorage.getSettings().clinicName);
  const [withImages, setWithImages] = useState(true);

  /** Prints only the plan; the title becomes the suggested PDF file name */
  const printPlanDocument = (plan: WorkoutPlan, asPdf: boolean) => {
    printElement(
      document.querySelector('.print-area'),
      asPdf ? `Ficha - ${plan.patientName} - ${formatDate(plan.updatedAt, 'dd-MM-yyyy')}` : undefined
    );
  };

  useEffect(() => {
    const load = () => {
      const plans = clinicStorage.getWorkoutPlans();
      setWorkoutPlans(plans);
      const pts = clinicStorage.getPatients().filter((p) => p.status !== 'arquivado');
      setPatients(pts);
      const exs = clinicStorage.getExercises();
      setExercises(exs);
      setCurrentUser(clinicStorage.getCurrentUser());
      setSettingsClinicName(clinicStorage.getSettings().clinicName);
      // functional update: the closure value would always be '' and reset the chosen exercise
      setAddExId((prev) => (prev && exs.some((e) => e.id === prev) ? prev : exs[0]?.id || ''));
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  useEffect(() => {
    if (initialPatientId && initialPatientId !== 'all') setSelectedPatientId(initialPatientId);
  }, [initialPatientId]);

  const openNewPlanModal = (forPatient?: unknown) => {
    setEditingPlan(null);
    setActiveTabDay('Segunda');
    // a specific student (from "sem ficha"), else the patient currently filtered, else the first one
    const defaultPat =
      typeof forPatient === 'string' ? forPatient : selectedPatientId !== 'all' ? selectedPatientId : patients[0]?.id || '';
    setFormPatientId(defaultPat);
    const patName = patients.find((p) => p.id === defaultPat)?.name || 'Paciente';
    setFormTitle(`Ficha de Pilates Individual - ${patName}`);
    setFormGoal('Alinhamento postural, descompressão axial e fortalecimento do powerhouse.');
    setCurrentDayItems({
      Segunda: [],
      Terça: [],
      Quarta: [],
      Quinta: [],
      Sexta: [],
      Sábado: [],
    });
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (plan: WorkoutPlan) => {
    setEditingPlan(plan);
    setFormPatientId(plan.patientId);
    setFormTitle(plan.title);
    setFormGoal(plan.professionalGoal);
    const dayMap: Record<string, WorkoutItem[]> = {
      Segunda: [],
      Terça: [],
      Quarta: [],
      Quinta: [],
      Sexta: [],
      Sábado: [],
    };
    plan.weeklyDays.forEach((wd) => {
      dayMap[wd.day] = [...wd.items];
    });
    setCurrentDayItems(dayMap);
    setIsPlanModalOpen(true);
  };

  const handleDuplicatePlan = (plan: WorkoutPlan) => {
    // The copy starts inactive so the patient keeps a single active plan during attendance
    const duplicated: WorkoutPlan = {
      ...plan,
      id: `wk-${Date.now()}`,
      title: `${plan.title} (Cópia)`,
      active: false,
      createdAt: toLocalDateKey(),
      updatedAt: toLocalDateKey(),
    };
    clinicStorage.saveWorkoutPlan(duplicated);
    showToast('Ficha duplicada (inativa). Ative-a quando quiser usá-la nos atendimentos.', 'success');
  };

  // Only one active plan per patient: it's the one loaded when an attendance starts
  const handleActivatePlan = (plan: WorkoutPlan) => {
    clinicStorage
      .getWorkoutPlans()
      .filter((w) => w.patientId === plan.patientId && w.id !== plan.id && w.active)
      .forEach((w) => clinicStorage.saveWorkoutPlan({ ...w, active: false }));
    clinicStorage.saveWorkoutPlan({ ...plan, active: true, updatedAt: toLocalDateKey() });
    showToast('Ficha ativada para os próximos atendimentos.', 'success');
  };

  const handleDeletePlan = (id: string) => {
    setPlanToDeleteId(id);
  };

  const handleConfirmDeletePlan = () => {
    if (!planToDeleteId) return;
    clinicStorage.deleteWorkoutPlan(planToDeleteId);
    showToast('Ficha de exercícios removida com sucesso.', 'info');
    setPlanToDeleteId(null);
  };

  const handleAddExerciseToCurrentDay = (e: React.FormEvent) => {
    e.preventDefault();
    const ex = exercises.find((item) => item.id === addExId);
    if (!ex) return;

    const newItem: WorkoutItem = {
      id: `wi-${Date.now()}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      equipment: ex.equipment,
      sets: addSets,
      reps: addReps,
      resistanceSprings: addSprings,
      restSeconds: 30,
      observations: addObs,
    };

    setCurrentDayItems((prev) => ({
      ...prev,
      [activeTabDay]: [...(prev[activeTabDay] || []), newItem],
    }));

    setIsAddExerciseModalOpen(false);
    setAddObs('');
    showToast(`Exercício adicionado a ${activeTabDay}!`, 'success');
  };

  const handleRemoveExerciseFromDay = (day: string, itemId: string) => {
    setCurrentDayItems((prev) => ({
      ...prev,
      [day]: prev[day].filter((i) => i.id !== itemId),
    }));
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find((p) => p.id === formPatientId);
    if (!patient) {
      showToast('Selecione um paciente', 'error');
      return;
    }
    if (!Object.values(currentDayItems).some((items) => items.length > 0)) {
      showToast('Adicione ao menos um exercício em algum dia da semana.', 'error');
      return;
    }

    const daysList = (['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const).map(
      (day) => ({
        day,
        enabled: (currentDayItems[day] || []).length > 0,
        items: currentDayItems[day] || [],
      })
    );

    const savedPlan: WorkoutPlan = {
      id: editingPlan ? editingPlan.id : `wk-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      title: formTitle,
      professionalGoal: formGoal,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdAt: editingPlan ? editingPlan.createdAt : toLocalDateKey(),
      updatedAt: toLocalDateKey(),
      weeklyDays: daysList,
      active: editingPlan ? editingPlan.active : true,
      notes: editingPlan?.notes,
    };

    clinicStorage.saveWorkoutPlan(savedPlan);
    // A new plan becomes the patient's active one
    if (!editingPlan) {
      clinicStorage
        .getWorkoutPlans()
        .filter((w) => w.patientId === patient.id && w.id !== savedPlan.id && w.active)
        .forEach((w) => clinicStorage.saveWorkoutPlan({ ...w, active: false }));
    }
    showToast('Ficha de exercícios salva com sucesso!', 'success');
    setIsPlanModalOpen(false);
  };

  const filteredPlans = workoutPlans.filter((wp) => {
    if (selectedPatientId !== 'all' && wp.patientId !== selectedPatientId) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      {(() => {
        const active = workoutPlans.filter((w) => w.active);
        const activePatients = patients.filter((p) => p.status === 'ativo');
        const withPlan = new Set(active.map((w) => w.patientId));
        const missing = activePatients.filter((p) => !withPlan.has(p.id));
        const prescribed = active.reduce((n, w) => n + w.weeklyDays.reduce((m, d) => m + (d.enabled ? d.items.length : 0), 0), 0);
        return (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3] flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Fichas de treino
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">Fichas semanais por aluno: exercícios, aparelhos, molas, séries e repetições.</p>
              </div>
              <button
                onClick={() => openNewPlanModal()}
                className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" /> Nova ficha
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Fichas ativas" value={active.length} hint={`${workoutPlans.length - active.length} arquivada(s)`} icon={ClipboardList} />
              <StatCard
                label="Alunos com ficha"
                value={`${activePatients.length ? Math.round((withPlan.size / activePatients.length) * 100) : 0}%`}
                hint={`${withPlan.size} de ${activePatients.length} alunos ativos`}
                icon={Users}
                tone="blue"
              />
              <StatCard label="Exercícios prescritos" value={prescribed} hint="somando os dias das fichas ativas" icon={Dumbbell} tone="slate" />
              <StatCard label="Sem ficha" value={missing.length} hint={missing.length ? 'alunos ativos aguardando ficha' : 'todos com ficha'} icon={AlertTriangle} tone={missing.length ? 'amber' : 'green'} />
            </div>

            {missing.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">Alunos ativos sem ficha de treino</p>
                <div className="flex flex-wrap gap-2">
                  {missing.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openNewPlanModal(p.id)}
                      className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] hover:border-[#426B5B] text-xs font-semibold"
                      title="Criar ficha"
                    >
                      <Avatar name={p.name} size="sm" /> {p.name.split(' ').slice(0, 2).join(' ')}
                      <Plus className="w-3.5 h-3.5 text-[#426B5B] dark:text-[#7FB39F]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Filter by patient */}
      <div className="p-3 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#64748B] font-semibold shrink-0">Aluno:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            aria-label="Filtrar por aluno"
            className="flex-1 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-2.5 py-1.5 font-medium"
          >
            <option value="all">Todos os alunos</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-[#64748B]">{filteredPlans.length} ficha(s)</span>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {filteredPlans.length === 0 ? (
          <div className="p-8 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl text-center text-[#64748B] text-xs">
            Nenhuma ficha encontrada para o filtro selecionado.
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A]">
                      Paciente: {plan.patientName}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      Criada em {formatDate(plan.createdAt)} por {plan.createdByName}
                    </span>
                    {plan.active ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Ativa
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivatePlan(plan)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-[#E5EAE7] dark:border-[#273830] text-[#64748B] hover:border-[#426B5B] hover:text-[#426B5B]"
                        title="Usar esta ficha nos próximos atendimentos"
                      >
                        Inativa · Ativar
                      </button>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-[#17231D] dark:text-[#F1F5F3] mt-1">
                    {plan.title}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    <strong className="text-[#17231D] dark:text-[#F1F5F3]">Objetivo:</strong> {plan.professionalGoal}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintPlan(plan)}
                    className="p-2 border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-slate-600 hover:bg-slate-50"
                    title="Visualizar Impressão / PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicatePlan(plan)}
                    className="p-2 border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-slate-600 hover:bg-slate-50"
                    title="Duplicar ficha"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditPlanModal(plan)}
                    className="p-2 border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-slate-600 hover:bg-slate-50"
                    title="Editar ficha"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-2 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekly schedule overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {plan.weeklyDays
                  .filter((d) => d.enabled)
                  .map((d) => (
                    <div
                      key={d.day}
                      className="p-3 rounded-xl bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830]"
                    >
                      <span className="text-xs font-bold text-[#426B5B] dark:text-[#5A8E7A] block mb-2 uppercase">
                        {dayLabel(d.day)} ({d.items.length} exercícios)
                      </span>
                      <ul className="text-xs space-y-1.5 divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                        {d.items.map((item, idx) => (
                          <li key={idx} className="pt-1.5 first:pt-0">
                            <p className="font-semibold text-[#17231D] dark:text-[#F1F5F3] truncate">
                              {item.exerciseName}
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              {item.sets}x {item.reps} {item.resistanceSprings ? `• ${item.resistanceSprings}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE / EDIT PLAN BUILDER MODAL */}
      {isPlanModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPlanModalOpen(false)}
          title={editingPlan ? 'Editar Ficha Individual' : 'Nova Ficha Individual de Pilates'}
          description="Distribua os exercícios pelos dias da semana com parâmetros biomecânicos."
          maxWidth="4xl"
        >
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Paciente *</label>
                <select
                  value={formPatientId}
                  onChange={(e) => {
                    setFormPatientId(e.target.value);
                    const pat = patients.find((p) => p.id === e.target.value);
                    if (pat) setFormTitle(`Ficha de Pilates Individual - ${pat.name}`);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.modality})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Título da Ficha *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Objetivo Profissional *</label>
              <input
                type="text"
                placeholder="Ex: Fortalecimento de paravertebrais e descompressão lombar..."
                value={formGoal}
                onChange={(e) => setFormGoal(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
            </div>

            {/* Weekly Days Tabs */}
            <div className="border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 bg-[#F8FAF9] dark:bg-[#111A15] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#64748B]">Distribuição Semanal</span>
                <button
                  type="button"
                  onClick={() => setIsAddExerciseModalOpen(true)}
                  className="px-3 py-1 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Exercício em {activeTabDay}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 border-b border-[#E5EAE7] dark:border-[#273830] overflow-x-auto text-xs">
                {(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const).map((day) => {
                  const count = (currentDayItems[day] || []).length;
                  const isActive = activeTabDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setActiveTabDay(day)}
                      className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? 'border-[#426B5B] text-[#426B5B] dark:text-[#5A8E7A]'
                          : 'border-transparent text-[#64748B]'
                      }`}
                    >
                      <span>{day}</span>
                      {count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Items in active day */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(currentDayItems[activeTabDay] || []).length === 0 ? (
                  <p className="text-xs text-[#64748B] text-center py-6">
                    Nenhum exercício planejado para {activeTabDay}. Clique no botão acima para adicionar.
                  </p>
                ) : (
                  (currentDayItems[activeTabDay] || []).map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white dark:bg-[#17231D] rounded-lg border border-[#E5EAE7] dark:border-[#273830] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{item.exerciseName}</span>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{item.equipment}</span>
                        </div>
                        <p className="text-[#64748B] text-[11px] mt-0.5">
                          {item.sets} séries de {item.reps} {item.resistanceSprings ? `• ${item.resistanceSprings}` : ''}
                          {item.observations ? ` • Obs: ${item.observations}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveExerciseFromDay(activeTabDay, item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Planejamento
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ADD EXERCISE TO DAY MODAL */}
      {isAddExerciseModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddExerciseModalOpen(false)}
          title={`Adicionar Exercício em ${activeTabDay}`}
          description="Selecione um exercício do catálogo e defina os parâmetros biomecânicos."
          maxWidth="lg"
        >
          <form onSubmit={handleAddExerciseToCurrentDay} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Exercício do Catálogo *</label>
              <select
                value={addExId}
                onChange={(e) => setAddExId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              >
                {EXERCISE_LEVELS.map((lv) => (
                  <optgroup key={lv.id} label={`Bloco ${lv.label}`}>
                    {exercises
                      .filter((ex) => getExerciseLevel(ex) === lv.id)
                      .map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name} ({ex.equipment})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {(() => {
                const ex = exercises.find((e) => e.id === addExId);
                const preview = ex?.gifUrl || ex?.steps[0]?.imageUrl;
                return preview ? (
                  <div className="mt-2 flex gap-3 items-start p-2 rounded-lg bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830]">
                    <img src={preview} alt={ex!.name} className="w-32 aspect-[3/2] object-cover rounded-md" />
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{ex!.objective}</p>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Séries</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={addSets}
                  onChange={(e) => setAddSets(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Repetições</label>
                <input
                  type="text"
                  placeholder="Ex: 10 ou 8-12"
                  value={addReps}
                  onChange={(e) => setAddReps(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Resistência / Molas (Pilates)</label>
              <input
                type="text"
                placeholder="Ex: 2 molas vermelhas + 1 azul ou 1 mola preta na pos. 2"
                value={addSprings}
                onChange={(e) => setAddSprings(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Orientações Especiais / Observações</label>
              <input
                type="text"
                placeholder="Ex: Alinhamento da pelve no retorno excêntrico..."
                value={addObs}
                onChange={(e) => setAddObs(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsAddExerciseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Inserir Exercício
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PRINT VIEW MODAL */}
      {printPlan && (
        <Modal
          isOpen={true}
          onClose={() => setPrintPlan(null)}
          title="Ficha Pronta para Impressão / PDF"
          description="Layout estruturado para prescrição clínica."
          maxWidth="3xl"
        >
          <div className="print-area p-6 bg-white text-black space-y-4 font-sans border rounded-xl">
            <div className="border-b pb-3 text-center">
              <h2 className="text-lg font-bold">{settingsClinicName}</h2>
              <p className="text-xs text-gray-600">Prescrição e Planejamento Individualizado de Exercícios</p>
            </div>

            <div className="grid grid-cols-2 text-xs border p-3 rounded bg-gray-50">
              <div>
                <p><strong>Paciente:</strong> {printPlan.patientName}</p>
                <p><strong>Ficha:</strong> {printPlan.title}</p>
              </div>
              <div className="text-right">
                <p><strong>Responsável:</strong> {printPlan.createdByName}</p>
                <p><strong>Data de Emissão:</strong> {formatDate(printPlan.updatedAt)}</p>
              </div>
            </div>

            <p className="text-xs"><strong>Objetivo Terapêutico:</strong> {printPlan.professionalGoal}</p>

            <div className="space-y-3 pt-2">
              {printPlan.weeklyDays
                .filter((d) => d.enabled)
                .map((d) => (
                  <div key={d.day} className="border p-3 rounded">
                    <h4 className="font-bold text-xs uppercase text-emerald-900 border-b pb-1 mb-2">
                      {dayLabel(d.day)}
                    </h4>
                    <div className="divide-y">
                      {d.items.map((it, idx) => {
                        const ex = exercises.find((e) => e.id === it.exerciseId);
                        const images = withImages ? (ex?.steps || []).map((s) => s.imageUrl).filter(Boolean) : [];
                        return (
                          <div key={idx} className="py-2 avoid-break">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs">
                              <span className="font-bold">
                                {idx + 1}. {it.exerciseName}{' '}
                                <span className="font-normal text-gray-500">({it.equipment})</span>
                              </span>
                              <span>
                                <strong>{it.sets}x {it.reps}</strong>
                                {it.resistanceSprings ? ` • ${it.resistanceSprings}` : ''}
                              </span>
                            </div>
                            {it.observations && <p className="text-[11px] text-gray-600 mt-0.5">Obs.: {it.observations}</p>}
                            {images.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {images.slice(0, 3).map((src, i) => (
                                  <figure key={i}>
                                    <img src={src} alt="" className="w-full aspect-[3/2] object-cover rounded border" />
                                    <figcaption className="text-[9px] text-gray-500 text-center mt-0.5">
                                      {ex?.steps[i]?.title}
                                    </figcaption>
                                  </figure>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>

            <div className="pt-8 text-center border-t text-xs text-gray-500">
              ___________________________________________<br />
              {printPlan.createdByName} • Responsável Técnico
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={withImages}
                onChange={(e) => setWithImages(e.target.checked)}
                className="accent-[#426B5B]"
              />
              Incluir as 3 imagens de cada exercício
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => printPlanDocument(printPlan, false)}
                className="px-4 py-2 border border-[#E5EAE7] dark:border-[#273830] text-xs font-bold rounded-lg"
              >
                Imprimir
              </button>
              <button
                onClick={() => printPlanDocument(printPlan, true)}
                className="px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Baixar PDF
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#64748B] mt-2">
            "Baixar PDF" abre a janela de impressão: escolha <strong>Salvar como PDF</strong> como destino.
          </p>
        </Modal>
      )}

      {/* DELETE PLAN CONFIRMATION MODAL */}
      {planToDeleteId && (
        <Modal
          isOpen={true}
          onClose={() => setPlanToDeleteId(null)}
          title="Excluir Ficha de Exercícios"
          description="Confirmação de exclusão do planejamento."
        >
          <div className="space-y-4">
            <p className="text-xs text-[#17231D] dark:text-[#F1F5F3]">
              Deseja realmente remover esta ficha de exercícios? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setPlanToDeleteId(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePlan}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Sim, Excluir Ficha
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
