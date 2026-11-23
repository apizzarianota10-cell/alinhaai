import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Info,
  Dumbbell,
  FileCheck,
  ArrowRight,
  Search,
  TrendingDown,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { formatDate, toLocalDateKey } from '../../lib/utils';
import { Patient, Appointment, WorkoutPlan, AttendanceRecord, Exercise } from '../../types';
import { Modal } from '../common/Modal';
import { StatCard, Avatar, Pill, Card } from '../common/Insights';
import { useToast } from '../common/Toast';

interface AttendanceViewProps {
  onNavigate: (section: string, payload?: any) => void;
  appointmentId?: string;
  patientId?: string;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  onNavigate,
  appointmentId: initialApptId,
  patientId: initialPatientId,
}) => {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentUser, setCurrentUser] = useState(clinicStorage.getCurrentUser());
  const [allCatalogExercises, setAllCatalogExercises] = useState<Exercise[]>([]);

  // Active session state
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(initialApptId || '');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || '');
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);

  // Live session timer state
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  // Add Exercise Modal state
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState<string>('todos');
  const [selectedExerciseToAdd, setSelectedExerciseToAdd] = useState<Exercise | null>(null);
  const [addSets, setAddSets] = useState<number>(3);
  const [addReps, setAddReps] = useState<string>('10 repetições');
  const [addSprings, setAddSprings] = useState<string>('1 Vermelha');

  // Form / Conduct states
  const [painBefore, setPainBefore] = useState<number>(0);
  const [painAfter, setPainAfter] = useState<number>(0);
  const [intercurrences, setIntercurrences] = useState<string>('');
  const [clinicalEvolutionText, setClinicalEvolutionText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // The form is hydrated from storage only once per session; later storage notifications
  // (any write anywhere in the app) must not wipe what the professional is typing.
  const hydratedSessionId = React.useRef<string | null>(null);
  const autoStartedApptId = React.useRef<string | null>(null);

  useEffect(() => {
    const load = () => {
      const appts = clinicStorage.getAppointments();
      setAppointments(appts);
      setPatients(clinicStorage.getPatients());
      setCurrentUser(clinicStorage.getCurrentUser());
      setAllCatalogExercises(clinicStorage.getExercises());

      const ongoing = clinicStorage.getActiveAttendance();
      setActiveSession(ongoing);
      if (ongoing && hydratedSessionId.current !== ongoing.id) {
        hydratedSessionId.current = ongoing.id;
        setSelectedAppointmentId(ongoing.appointmentId);
        setSelectedPatientId(ongoing.patientId);
        setPainBefore(ongoing.painScaleBefore);
        setPainAfter(ongoing.painScaleAfter);
        setIntercurrences(ongoing.intercurrences || '');
        setClinicalEvolutionText(ongoing.clinicalEvolution || '');
        setIsTimerPaused(false);
        setSessionSeconds(
          ongoing.startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(ongoing.startedAt)) / 1000)) : 0
        );
      }
    };
    load();

    // Arriving from the agenda with an appointment: start it once (never re-start a finished one)
    if (initialApptId && !clinicStorage.getActiveAttendance() && autoStartedApptId.current !== initialApptId) {
      autoStartedApptId.current = initialApptId;
      const target = clinicStorage.getAppointments().find((a) => a.id === initialApptId);
      if (target && (target.status === 'agendado' || target.status === 'confirmado')) {
        startSession(target);
      } else if (target) {
        showToast(`Este agendamento está "${target.status.replace('_', ' ')}" e não pode ser iniciado.`, 'info');
      }
    }
    return clinicStorage.subscribe(load);
  }, [initialApptId]);

  useEffect(() => {
    if (!activeSession || isTimerPaused) return;
    const interval = window.setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession?.id, isTimerPaused]);

  // Persist the clinical fields so a reload or navigation doesn't lose them
  const persistDraft = (patch: Partial<AttendanceRecord>) => {
    const current = clinicStorage.getActiveAttendance();
    if (current) clinicStorage.setActiveAttendance({ ...current, ...patch });
  };

  const updateExercises = (
    mutate: (list: AttendanceRecord['completedExercises']) => AttendanceRecord['completedExercises']
  ) => {
    if (!activeSession) return;
    const updated = { ...activeSession, completedExercises: mutate(activeSession.completedExercises.map((e) => ({ ...e }))) };
    setActiveSession(updated);
    clinicStorage.setActiveAttendance(updated);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startSession = (appt: Appointment) => {
    if (clinicStorage.getActiveAttendance()) {
      showToast('Já existe um atendimento em andamento. Finalize ou descarte antes de iniciar outro.', 'error');
      return;
    }
    const workoutPlan = clinicStorage.getWorkoutPlanByPatientId(appt.patientId);

    // Get exercises from workout plan or default list
    let exercisesList: AttendanceRecord['completedExercises'] = [];
    if (workoutPlan && workoutPlan.weeklyDays.length > 0) {
      // Find today's day of week
      const currentDayOfWeek = new Date().getDay(); // 0=sun, 1=mon, 2=tue...
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const todayName = dayNames[currentDayOfWeek];
      const matchingDay = workoutPlan.weeklyDays.find((d) => d.day === todayName && d.enabled) || workoutPlan.weeklyDays.find((d) => d.enabled);

      if (matchingDay && matchingDay.items.length > 0) {
        exercisesList = matchingDay.items.map((item) => ({
          workoutItemId: item.id,
          exerciseName: item.exerciseName,
          completed: false,
          adapted: false,
          actualSets: item.sets,
          actualReps: item.reps,
        }));
      }
    }

    // Fallback exercises if none in workout plan
    if (exercisesList.length === 0) {
      exercisesList = [
        {
          workoutItemId: 'fallback-1',
          exerciseName: 'Footwork no Reformer (Aquecimento)',
          completed: false,
          adapted: false,
          actualSets: 3,
          actualReps: '10 cada apoio',
        },
        {
          workoutItemId: 'fallback-2',
          exerciseName: 'The Hundred (Ativação Core)',
          completed: false,
          adapted: false,
          actualSets: 1,
          actualReps: '100 ciclos',
        },
        {
          workoutItemId: 'fallback-3',
          exerciseName: 'Shoulder Bridge & Articulação Lombar',
          completed: false,
          adapted: false,
          actualSets: 3,
          actualReps: '10 repetições',
        },
      ];
    }

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      appointmentId: appt.id,
      patientId: appt.patientId,
      patientName: appt.patientName,
      professionalId: appt.professionalId,
      professionalName: appt.professionalName,
      modality: appt.modality,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: 'em_andamento',
      workoutPlanId: workoutPlan?.id,
      completedExercises: exercisesList,
      painScaleBefore: 0,
      painScaleAfter: 0,
      intercurrences: '',
      clinicalEvolution: `Sessão conduzida com foco em estabilização e controle motor. Paciente apresentou boa tolerância mecânica aos movimentos prescritos.`,
      conductedBy: clinicStorage.getCurrentUser().name,
      startedAt: new Date().toISOString(),
      previousAppointmentStatus: appt.status,
    };

    clinicStorage.setActiveAttendance(newRecord);
    clinicStorage.updateAppointmentStatus(appt.id, 'em_atendimento');
    showToast(`Atendimento individual de ${appt.patientName} iniciado!`, 'success');
  };

  const handleToggleExerciseDone = (index: number) => {
    updateExercises((list) => {
      list[index].completed = !list[index].completed;
      return list;
    });
  };

  const handleToggleExerciseAdapted = (index: number) => {
    updateExercises((list) => {
      list[index].adapted = !list[index].adapted;
      return list;
    });
  };

  const handleAdaptationNote = (index: number, note: string) => {
    updateExercises((list) => {
      list[index].adaptationNote = note;
      return list;
    });
  };

  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const handleConfirmDiscard = () => {
    clinicStorage.discardActiveAttendance();
    hydratedSessionId.current = null;
    setIsDiscardModalOpen(false);
    showToast('Atendimento descartado. O agendamento voltou ao status anterior.', 'info');
  };

  const handleFinalizeSession = () => {
    if (!activeSession) return;
    if (isSubmitting) return;
    if (!clinicalEvolutionText.trim()) {
      showToast('Registre a evolução clínica antes de finalizar.', 'error');
      return;
    }

    setIsSubmitting(true);

    const finalizedRecord: AttendanceRecord = {
      ...activeSession,
      painScaleBefore: painBefore,
      painScaleAfter: painAfter,
      intercurrences,
      clinicalEvolution: clinicalEvolutionText,
      status: 'finalizado',
      completedAt: new Date().toISOString(),
    };

    // Execute complete clinical finalization workflow
    clinicStorage.finalizeAttendance(finalizedRecord);

    showToast('Atendimento individual finalizado! Saldo de sessões e evolução do prontuário atualizados!', 'success');
    hydratedSessionId.current = null;
    setIsSubmitting(false);

    // Navigate to overview to view updated KPIs
    onNavigate('overview');
  };

  const handleConfirmAddExercise = () => {
    if (!activeSession || !selectedExerciseToAdd) return;
    updateExercises((list) => [
      ...list,
      {
        workoutItemId: `adhoc-${Date.now()}`,
        exerciseName: `${selectedExerciseToAdd.name} (${selectedExerciseToAdd.equipment})`,
        completed: false,
        adapted: false,
        actualSets: addSets,
        actualReps: addReps,
        actualSprings: addSprings,
      },
    ]);
    showToast(`Exercício ${selectedExerciseToAdd.name} adicionado ao atendimento!`, 'success');
    setIsAddExerciseModalOpen(false);
  };

  const currentPatient = patients.find((p) => p.id === (activeSession ? activeSession.patientId : selectedPatientId));
  const activeWorkoutPlan = currentPatient ? clinicStorage.getWorkoutPlanByPatientId(currentPatient.id) : undefined;
  // Startable appointments: today first, then upcoming, in chronological order
  const todayKey = toLocalDateKey();
  const todayAppointments = appointments
    .filter((a) => (a.status === 'agendado' || a.status === 'confirmado') && a.date >= todayKey)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const filteredCatalogExercises = allCatalogExercises.filter((ex) => {
    if (selectedCatalogCategory !== 'todos') {
      const matchCat = ex.category.toLowerCase().includes(selectedCatalogCategory.toLowerCase());
      const matchEq = ex.equipment.toLowerCase().includes(selectedCatalogCategory.toLowerCase());
      if (!matchCat && !matchEq) return false;
    }
    if (searchCatalogQuery.trim()) {
      const q = searchCatalogQuery.toLowerCase();
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.equipment.toLowerCase().includes(q) ||
        ex.bodyRegion.toLowerCase().includes(q) ||
        ex.objective.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Atendimentos
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Fila do dia e condução ao vivo: exercícios, adaptações, escala de dor e evolução clínica.
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center gap-2">
            {/* Live Stopwatch */}
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-lg shadow-2xs text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-[#426B5B] dark:text-[#5A8E7A]" />
              <span className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{formatTimer(sessionSeconds)}</span>
              <button
                type="button"
                onClick={() => setIsTimerPaused(!isTimerPaused)}
                className="p-1 rounded hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] text-[#64748B]"
                title={isTimerPaused ? 'Retomar cronômetro' : 'Pausar cronômetro'}
              >
                {isTimerPaused ? <Play className="w-3 h-3 fill-current text-emerald-600" /> : <Pause className="w-3 h-3 text-amber-600" />}
              </button>
            </div>

            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Sessão em Andamento
            </span>
          </div>
        )}
      </div>

      {/* If no session active, show the attendance desk */}
      {!activeSession ? (
        (() => {
          const finished = clinicStorage.getAttendances().filter((r) => r.status === 'finalizado');
          const doneToday = appointments.filter((a) => a.date === todayKey && a.status === 'realizado').length;
          const inMonth = finished.filter((r) => (r.date || '').startsWith(todayKey.slice(0, 7)));
          const relief = inMonth.length ? inMonth.reduce((s, r) => s + (r.painScaleBefore - r.painScaleAfter), 0) / inMonth.length : null;
          const queueToday = todayAppointments.filter((a) => a.date === todayKey);
          const upcoming = todayAppointments.filter((a) => a.date !== todayKey).slice(0, 6);
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
          const toMin = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          const nextUp = queueToday.find((a) => toMin(a.startTime) + (a.durationMinutes || 50) > nowMin);

          const Row: React.FC<{ appt: Appointment; showDate?: boolean }> = ({ appt, showDate }) => {
            const p = patients.find((x) => x.id === appt.patientId);
            const plan = clinicStorage.getWorkoutPlanByPatientId(appt.patientId);
            const exercises = plan ? plan.weeklyDays.reduce((n, d) => n + (d.enabled ? d.items.length : 0), 0) : 0;
            const isNext = nextUp?.id === appt.id;
            return (
              <li className={`p-3 flex flex-wrap items-center gap-x-3 gap-y-2 ${isNext ? 'bg-[#E9F1EC]/60 dark:bg-[#1F332A]/60' : ''}`}>
                <span className="w-14 shrink-0">
                  <span className="block font-mono text-sm font-bold">{appt.startTime}</span>
                  <span className="block text-[10px] text-[#64748B]">{showDate ? formatDate(appt.date, 'dd/MM') : isNext ? 'próximo' : `${appt.durationMinutes} min`}</span>
                </span>
                <Avatar name={appt.patientName} size="sm" />
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm font-semibold leading-tight">{appt.patientName}</p>
                  <p className="text-[11px] text-[#64748B] truncate">
                    {appt.modality} • {appt.professionalName}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {plan ? <Pill tone="blue">Ficha: {exercises} exercício(s)</Pill> : <Pill tone="slate">Sem ficha de treino</Pill>}
                    {p?.clinicalAlerts?.[0] && (
                      <Pill tone="amber" title={p.clinicalAlerts.join(' • ')}>
                        <AlertTriangle className="w-3 h-3" /> {p.clinicalAlerts[0]}
                      </Pill>
                    )}
                    {p && p.sessionsRemaining <= 1 && <Pill tone="rose">{p.sessionsRemaining === 1 ? "1 sessão restante" : "Plano esgotado"}</Pill>}
                  </div>
                </div>
                <button
                  onClick={() => startSession(appt)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Iniciar
                </button>
              </li>
            );
          };

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="A atender hoje" value={queueToday.length} hint={nextUp ? `próximo: ${nextUp.startTime} ${nextUp.patientName.split(' ')[0]}` : 'nenhum pendente'} icon={Clock} tone="blue" />
                <StatCard label="Realizados hoje" value={doneToday} hint={`${finished.filter((r) => r.date === todayKey).length} com registro de evolução`} icon={CheckCircle2} />
                <StatCard label="Atendimentos no mês" value={inMonth.length} hint="finalizados com evolução registrada" icon={Activity} tone="slate" />
                <StatCard
                  label="Alívio médio de dor"
                  value={relief === null ? '—' : `${relief >= 0 ? '−' : '+'}${Math.abs(relief).toFixed(1).replace('.', ',')}`}
                  hint="pontos na escala EVA (início → fim) no mês"
                  icon={TrendingDown}
                  tone="green"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <div className="lg:col-span-2 space-y-4">
                  <Card title="Fila de hoje" action={<span className="text-[11px] text-[#64748B]">{queueToday.length} sessão(ões)</span>}>
                    {queueToday.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm text-[#64748B]">Nenhum atendimento pendente para hoje.</p>
                        <button onClick={() => onNavigate('schedule', { action: 'new' })} className="mt-2 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
                          + Agendar sessão
                        </button>
                      </div>
                    ) : (
                      <ul className="-m-3 sm:-m-4 divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                        {queueToday.map((a) => (
                          <Row key={a.id} appt={a} />
                        ))}
                      </ul>
                    )}
                  </Card>
                  {upcoming.length > 0 && (
                    <Card title="Próximos dias">
                      <ul className="-m-3 sm:-m-4 divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                        {upcoming.map((a) => (
                          <Row key={a.id} appt={a} showDate />
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>

                <Card title="Atendimentos recentes">
                  {finished.length === 0 ? (
                    <p className="text-xs text-[#64748B] py-6 text-center">Os atendimentos finalizados aparecem aqui, com a evolução da dor.</p>
                  ) : (
                    <ul className="space-y-3">
                      {finished.slice(0, 6).map((r) => {
                        const diff = r.painScaleBefore - r.painScaleAfter;
                        return (
                          <li key={r.id} className="flex items-start gap-2.5">
                            <Avatar name={r.patientName} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{r.patientName}</p>
                              <p className="text-[11px] text-[#64748B]">
                                {formatDate(r.date, 'dd/MM')} • {r.completedExercises.filter((e) => e.completed).length} exercício(s) • {r.professionalName.split(' ').slice(0, 2).join(' ')}
                              </p>
                            </div>
                            <span className="text-right">
                              <span className="block text-[11px] font-mono">
                                EVA {r.painScaleBefore}→{r.painScaleAfter}
                              </span>
                              <Pill tone={diff > 0 ? 'green' : diff < 0 ? 'rose' : 'slate'}>{diff > 0 ? `−${diff}` : diff < 0 ? `+${-diff}` : '='}</Pill>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          );
        })()
      ) : (
        /* LIVE ATTENDANCE CONDUCTOR INTERFACE */
        <div className="space-y-4">
          {/* Patient Clinical Header Banner */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#426B5B] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {activeSession.patientName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#17231D] dark:text-[#F1F5F3]">
                    {activeSession.patientName}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
                    {activeSession.modality}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Horário: {activeSession.startTime} às {activeSession.endTime} • Conduzido por: {activeSession.conductedBy}
                </p>
              </div>
            </div>

            {currentPatient && (
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-[#64748B] block">Saldo de Sessões:</span>
                  <span className="font-bold text-[#426B5B] dark:text-[#5A8E7A]">
                    {currentPatient.sessionsRemaining} de {currentPatient.sessionsTotal}
                  </span>
                </div>
                {currentPatient.clinicalAlerts && currentPatient.clinicalAlerts.length > 0 && (
                  <div className="border-l border-[#E5EAE7] dark:border-[#273830] pl-4">
                    <span className="text-[11px] font-bold text-amber-600 block">Alertas:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {currentPatient.clinicalAlerts.map((alt, i) => (
                        <span key={i} className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-medium">
                          {alt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main 2-Column Conductor Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Exercise Checklist (2 cols) */}
            <div className="lg:col-span-2 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
                  <h3 className="text-xs font-bold uppercase text-[#17231D] dark:text-[#F1F5F3] tracking-wider">
                    Exercícios da Sessão
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#64748B]">
                    {activeSession.completedExercises.filter((e) => e.completed).length} de {activeSession.completedExercises.length} concluídos
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (allCatalogExercises.length > 0) {
                        setSelectedExerciseToAdd(allCatalogExercises[0]);
                      }
                      setIsAddExerciseModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A] rounded-lg hover:bg-[#d6e5dc]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Exercício</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {activeSession.completedExercises.map((ex, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      ex.completed
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9]/50 dark:bg-[#111A15]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleExerciseDone(idx)}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                            ex.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white hover:border-[#426B5B]'
                          }`}
                        >
                          {ex.completed && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${ex.completed ? 'text-emerald-950 dark:text-emerald-200 line-through opacity-80' : 'text-[#17231D] dark:text-[#F1F5F3]'}`}>
                            {ex.exerciseName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-[#64748B] mt-1">
                            <span className="flex items-center gap-1">
                              Séries:
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={ex.actualSets || 3}
                                onChange={(e) =>
                                  updateExercises((list) => {
                                    list[idx].actualSets = Math.max(1, Number(e.target.value) || 1);
                                    return list;
                                  })
                                }
                                className="w-12 px-1 py-0.5 text-xs text-center border rounded bg-white dark:bg-[#17231D]"
                              />
                            </span>
                            <span className="flex items-center gap-1">
                              Reps:
                              <input
                                type="text"
                                value={ex.actualReps ?? ''}
                                onChange={(e) =>
                                  updateExercises((list) => {
                                    list[idx].actualReps = e.target.value;
                                    return list;
                                  })
                                }
                                className="w-16 px-1 py-0.5 text-xs text-center border rounded bg-white dark:bg-[#17231D]"
                              />
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Adaptation Toggle */}
                        <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ex.adapted}
                            onChange={() => handleToggleExerciseAdapted(idx)}
                            className="rounded text-[#426B5B] focus:ring-[#426B5B]"
                          />
                          <span>Adaptado</span>
                        </label>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => {
                            updateExercises((list) => list.filter((_, i) => i !== idx));
                            showToast('Exercício removido da sessão.', 'info');
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Remover exercício da sessão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Adaptation input field if checked */}
                    {ex.adapted && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Descreva a adaptação biomecânica realizada (ex: reduziu mola, apoio na bola...)"
                          value={ex.adaptationNote || ''}
                          onChange={(e) => handleAdaptationNote(idx, e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-[#17231D] border border-amber-300 dark:border-amber-800 rounded-md"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Pain Scale, Intercurrences & Finalize Button */}
            <div className="space-y-4">
              {/* Pain Scale (EVA) */}
              <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase text-[#17231D] dark:text-[#F1F5F3] tracking-wider">
                  Escala Analógica Visual de Dor (EVA)
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Dor no Início da Sessão:</span>
                      <span className="font-bold text-[#426B5B] dark:text-[#5A8E7A]">{painBefore}/10</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={painBefore}
                      onChange={(e) => {
                        setPainBefore(Number(e.target.value));
                        persistDraft({ painScaleBefore: Number(e.target.value) });
                      }}
                      className="w-full accent-[#426B5B]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Dor no Término da Sessão:</span>
                      <span className="font-bold text-emerald-600">{painAfter}/10</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={painAfter}
                      onChange={(e) => {
                        setPainAfter(Number(e.target.value));
                        persistDraft({ painScaleAfter: Number(e.target.value) });
                      }}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Intercurrences & Clinical Notes */}
              <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase text-[#17231D] dark:text-[#F1F5F3] tracking-wider">
                  Evolução do Prontuário
                </h3>

                <div>
                  <label className="block text-xs font-semibold mb-1">Intercorrências (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Leve tontura ao levantar, dor súbita..."
                    value={intercurrences}
                    onChange={(e) => setIntercurrences(e.target.value)}
                    onBlur={() => persistDraft({ intercurrences })}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Registro de Evolução Clínica *</label>
                  <textarea
                    rows={4}
                    value={clinicalEvolutionText}
                    onChange={(e) => setClinicalEvolutionText(e.target.value)}
                    onBlur={() => persistDraft({ clinicalEvolution: clinicalEvolutionText })}
                    placeholder="Descreva a resposta do paciente, ganhos motores e recomendações..."
                    className="w-full text-xs px-2.5 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                    required
                  />
                </div>

                {/* Finalize Button with Double-Click Protection */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalizeSession}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#426B5B] hover:bg-[#345648] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
                >
                  <FileCheck className="w-5 h-5" />
                  <span>{isSubmitting ? 'Finalizando...' : 'Finalizar Atendimento'}</span>
                </button>
                <p className="text-[11px] text-[#64748B] text-center">
                  Deduz 1 sessão do plano, salva evolução no prontuário e atualiza o dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDiscardModalOpen(true)}
                  className="w-full py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Descartar atendimento (iniciado por engano)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDiscardModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDiscardModalOpen(false)}
          title="Descartar atendimento"
          description="Nenhuma sessão será descontada e nada será gravado no prontuário."
          maxWidth="md"
        >
          <p className="text-xs">
            O agendamento de <strong>{activeSession?.patientName}</strong> volta ao status anterior e poderá ser
            iniciado novamente depois.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setIsDiscardModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirmDiscard}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
            >
              Descartar
            </button>
          </div>
        </Modal>
      )}

      {/* ADD EXERCISE TO ATTENDANCE MODAL */}
      {isAddExerciseModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddExerciseModalOpen(false)}
          title="Adicionar Exercício ao Atendimento"
          description="Selecione um exercício do catálogo clínico e ajuste as séries e repetições."
        >
          <div className="space-y-4">
            {/* Search & Category Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou equipamento..."
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {['todos', 'Reformer', 'Step Chair', 'Solo', 'Mobilidade', 'Alongamento'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCatalogCategory(cat)}
                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                      selectedCatalogCategory === cat
                        ? 'bg-[#426B5B] text-white border-[#426B5B]'
                        : 'bg-white dark:bg-[#17231D] text-[#64748B] border-[#E5EAE7] dark:border-[#273830] hover:border-slate-400'
                    }`}
                  >
                    {cat === 'todos' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercise Selection List */}
            <div className="max-h-48 overflow-y-auto divide-y divide-[#E5EAE7] dark:divide-[#273830] border border-[#E5EAE7] dark:border-[#273830] rounded-xl">
              {filteredCatalogExercises.length === 0 ? (
                <p className="text-xs text-center py-4 text-[#64748B]">Nenhum exercício encontrado.</p>
              ) : (
                filteredCatalogExercises.map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => setSelectedExerciseToAdd(ex)}
                    className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      selectedExerciseToAdd?.id === ex.id
                        ? 'bg-[#E9F1EC] dark:bg-[#1F332A] text-[#17231D] dark:text-[#F1F5F3] font-semibold'
                        : 'hover:bg-[#F8FAF9] dark:hover:bg-[#111A15]'
                    }`}
                  >
                    <div>
                      <p className="font-bold">{ex.name}</p>
                      <p className="text-[11px] text-[#64748B]">{ex.equipment} • {ex.category}</p>
                    </div>
                    {selectedExerciseToAdd?.id === ex.id && (
                      <CheckCircle2 className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Parameters for the exercise */}
            {selectedExerciseToAdd && (
              <div className="p-3 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-xl space-y-3">
                <p className="text-xs font-bold text-[#426B5B] dark:text-[#5A8E7A]">
                  Configurar Prescrição: {selectedExerciseToAdd.name}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Séries</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={addSets}
                      onChange={(e) => setAddSets(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Repetições</label>
                    <input
                      type="text"
                      value={addReps}
                      onChange={(e) => setAddReps(e.target.value)}
                      placeholder="10 repetições"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Carga / Molas</label>
                    <input
                      type="text"
                      value={addSprings}
                      onChange={(e) => setAddSprings(e.target.value)}
                      placeholder="Ex: 1 Vermelha"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsAddExerciseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedExerciseToAdd}
                onClick={handleConfirmAddExercise}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm disabled:opacity-50"
              >
                Adicionar à Sessão
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
