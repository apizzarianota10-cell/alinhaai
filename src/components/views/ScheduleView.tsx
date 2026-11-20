import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle,
  Check,
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  CalendarDays,
  Filter,
  Users,
  Minus,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clinicStorage } from '../../lib/storage';
import {
  checkScheduleConflict,
  describeScheduleConflict,
  formatDate,
  getClassInfo,
  buildWhatsAppLink,
  isGroupModality,
  STATUS_LABELS,
} from '../../lib/utils';
import { Appointment, Patient, Professional, AppointmentStatus } from '../../types';
import { Modal } from '../common/Modal';
import { StatCard, Avatar, ProgressBar, Card } from '../common/Insights';
import { useToast } from '../common/Toast';

interface ScheduleViewProps {
  onNavigate: (section: string, payload?: any) => void;
  initialAction?: string;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onNavigate, initialAction }) => {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // phones open on the day view: the 7-column week grid needs sideways scrolling there
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week'
  );
  const [filterProfessionalId, setFilterProfessionalId] = useState<string>('all');
  const [filterModality, setFilterModality] = useState<string>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentDetailModal, setAppointmentDetailModal] = useState<Appointment | null>(null);
  const [cancelModalAppt, setCancelModalAppt] = useState<Appointment | null>(null);
  const [cancelPresetReason, setCancelPresetReason] = useState<string>('Aviso prévio do paciente (>24h)');
  const [cancelCustomReason, setCancelCustomReason] = useState<string>('');

  // Form State
  const [formPatientId, setFormPatientId] = useState('');
  const [formProfessionalId, setFormProfessionalId] = useState('');
  const [formModality, setFormModality] = useState('Pilates');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formDuration, setFormDuration] = useState(50);
  const [formNotes, setFormNotes] = useState('');
  const [formIsRecurrent, setFormIsRecurrent] = useState(false);
  const [formRecurrenceRule, setFormRecurrenceRule] = useState<'weekly_1x' | 'weekly_2x' | 'weekly_3x'>('weekly_2x');
  const [formConflictError, setFormConflictError] = useState<string | null>(null);
  // Pilates classes: students per slot and the students being booked together
  const [formCapacity, setFormCapacity] = useState(1);
  const [formPatientIds, setFormPatientIds] = useState<string[]>([]);
  const [studentToAdd, setStudentToAdd] = useState('');

  const [settings, setSettings] = useState(clinicStorage.getSettings());

  // new bookings in a group modality pick several students; editing keeps one booking = one student
  const isGroupMode = !selectedAppointment && isGroupModality(formModality);
  const formSlot = {
    professionalId: formProfessionalId,
    date: formDate,
    startTime: formStartTime,
    durationMinutes: formDuration,
    modality: formModality,
  };
  const formClass = getClassInfo(appointments, formSlot, selectedAppointment?.id);
  const formStudentsBooking = isGroupMode ? formPatientIds.length : 1;
  const formFreeSpots = formCapacity - formClass.students.length - formStudentsBooking;

  // picking a slot that already holds a class adopts that class's capacity
  useEffect(() => {
    if (!isModalOpen || selectedAppointment || !isGroupModality(formModality)) return;
    const info = getClassInfo(appointments, formSlot);
    if (info.students.length > 0) setFormCapacity((prev) => Math.max(prev, info.capacity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, formProfessionalId, formDate, formStartTime, formDuration, formModality]);

  useEffect(() => {
    const load = () => {
      setAppointments(clinicStorage.getAppointments());
      // Only active patients can be booked; archived/inactive ones stay visible in existing appointments
      const pts = clinicStorage.getPatients().filter((p) => p.status === 'ativo');
      setPatients(pts);
      // Reception staff are users of the system, not bookable professionals
      const profs = clinicStorage
        .getProfessionals()
        .filter((p) => p.status === 'ativo' && p.role !== 'receptionist');
      setProfessionals(profs);
      setSettings(clinicStorage.getSettings());

      // functional updates: the closure value would always be '' and reset the user's choice
      setFormPatientId((prev) => prev || pts[0]?.id || '');
      setFormProfessionalId((prev) => prev || profs[0]?.id || '');
    };

    load();
    if (initialAction === 'new') {
      handleOpenNewModal();
    }
    return clinicStorage.subscribe(load);
  }, [initialAction]);

  const filteredAppointments = appointments.filter((appt) => {
    if (filterProfessionalId !== 'all' && appt.professionalId !== filterProfessionalId) {
      return false;
    }
    if (filterModality !== 'all' && appt.modality !== filterModality) {
      return false;
    }
    return true;
  });

  /** `classOf` pre-fills the slot of an existing class to add more students to it */
  function handleOpenNewModal(dateStr?: string, timeStr?: string, classOf?: Appointment) {
    setSelectedAppointment(null);
    setFormDate(dateStr || format(selectedDate, 'yyyy-MM-dd'));
    setFormStartTime(timeStr || '08:00');
    setFormDuration(classOf?.durationMinutes || clinicStorage.getSettings().defaultSessionDurationMinutes || 50);
    setFormNotes('');
    setFormIsRecurrent(false);
    setFormConflictError(null);
    setFormPatientIds([]);
    setStudentToAdd('');
    setFormCapacity(classOf?.capacity || 1);
    if (classOf) {
      setFormProfessionalId(classOf.professionalId);
      setFormModality(classOf.modality);
    } else if (filterProfessionalId !== 'all') setFormProfessionalId(filterProfessionalId);
    setIsModalOpen(true);
  }

  const handleOpenEditModal = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setFormPatientId(appt.patientId);
    setFormProfessionalId(appt.professionalId);
    setFormModality(appt.modality);
    setFormDate(appt.date);
    setFormStartTime(appt.startTime);
    setFormDuration(appt.durationMinutes);
    setFormNotes(appt.notes || '');
    setFormIsRecurrent(appt.isRecurrent);
    setFormCapacity(getClassInfo(appointments, appt).capacity);
    setFormConflictError(null);
    setAppointmentDetailModal(null);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormConflictError(null);

    // Editing may keep a patient/professional that is no longer in the "active" lists
    const findPatient = (id: string) => patients.find((p) => p.id === id) || clinicStorage.getPatientById(id);
    const students = (isGroupMode ? formPatientIds : [formPatientId]).map(findPatient).filter((p): p is Patient => !!p);
    const professional =
      professionals.find((p) => p.id === formProfessionalId) ||
      clinicStorage.getProfessionals().find((p) => p.id === formProfessionalId);

    if (students.length === 0 || !professional) {
      showToast(isGroupMode ? 'Adicione pelo menos 1 aluno.' : 'Selecione paciente e profissional válidos', 'error');
      return;
    }
    if (!formDuration || formDuration < 10) {
      showToast('Informe uma duração válida (mínimo 10 minutos).', 'error');
      return;
    }

    const groupClass = isGroupModality(formModality);
    const capacity = groupClass ? Math.max(1, formCapacity || 1) : undefined;
    const slotCheck = (existing: Appointment[], date: string, patientId: string, id?: string) =>
      checkScheduleConflict(existing, {
        id,
        professionalId: professional.id,
        date,
        startTime: formStartTime,
        durationMinutes: formDuration,
        modality: formModality,
        patientId,
        capacity,
      });

    // Validate every student on the chosen date before saving anything
    let existing = clinicStorage.getAppointments();
    const pending: Appointment[] = [];
    for (const student of students) {
      const conflict = slotCheck([...existing, ...pending], formDate, student.id, selectedAppointment?.id);
      if (conflict.hasConflict) {
        setFormConflictError(describeScheduleConflict(conflict, professional.name, student.name));
        return;
      }
      // placeholder so the next student counts this one as a classmate
      pending.push({
        ...formSlot,
        id: `pending-${student.id}`,
        patientId: student.id,
        patientName: student.name,
        professionalName: professional.name,
        endTime: '',
        status: 'agendado',
        isRecurrent: false,
        capacity,
      });
    }

    // Calculate end time
    const [h, m] = formStartTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + formDuration;
    const endTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

    const baseId = Date.now();
    const skipped = new Set<string>();
    let created = 0;

    students.forEach((student, i) => {
      const apptData: Appointment = {
        id: selectedAppointment ? selectedAppointment.id : `apt-${baseId}-${i}`,
        patientId: student.id,
        patientName: student.name,
        professionalId: professional.id,
        professionalName: professional.name,
        modality: formModality,
        date: formDate,
        startTime: formStartTime,
        endTime,
        durationMinutes: formDuration,
        capacity,
        status: selectedAppointment ? selectedAppointment.status : 'agendado',
        isRecurrent: formIsRecurrent,
        recurrenceRule: formIsRecurrent ? formRecurrenceRule : undefined,
        notes: formNotes,
      };
      clinicStorage.saveAppointment(apptData);
      existing = [...existing.filter((a) => a.id !== apptData.id), apptData];
      created++;

      // Recurring series: 4 weeks following the chosen frequency.
      // 1x = same weekday; 2x = chosen day + 2 days later; 3x = chosen day + 2 + 4 days later (Sundays skipped).
      if (!selectedAppointment && formIsRecurrent) {
        const baseDate = parseISO(formDate);
        const offsetsPerWeek = formRecurrenceRule === 'weekly_3x' ? [0, 2, 4] : formRecurrenceRule === 'weekly_2x' ? [0, 2] : [0];
        for (let w = 0; w < 4; w++) {
          for (const off of offsetsPerWeek) {
            if (w === 0 && off === 0) continue; // the base appointment already saved above
            let next = addDays(baseDate, w * 7 + off);
            if (next.getDay() === 0) next = addDays(next, 1);
            const nextDateStr = format(next, 'yyyy-MM-dd');
            if (slotCheck(existing, nextDateStr, student.id).hasConflict) {
              skipped.add(`${formatDate(nextDateStr, 'dd/MM')}${students.length > 1 ? ` (${student.name.split(' ')[0]})` : ''}`);
              continue;
            }
            const occurrence: Appointment = {
              ...apptData,
              id: `apt-${baseId}-${i}-${w}-${off}`,
              date: nextDateStr,
              recurrenceId: apptData.id,
            };
            clinicStorage.saveAppointment(occurrence);
            existing = [...existing, occurrence];
            created++;
          }
        }
      }
    });

    // keep the whole class on the same capacity
    if (groupClass) {
      getClassInfo(existing, formSlot)
        .students.filter((a) => (a.capacity || 1) !== capacity)
        .forEach((a) => clinicStorage.saveAppointment({ ...a, capacity }));
    }

    const who = students.length > 1 ? `${students.length} alunos` : students[0].name;
    if (selectedAppointment) showToast('Agendamento atualizado!', 'success');
    else if (skipped.size)
      showToast(`${created} sessões criadas para ${who}. Datas com conflito ou turma cheia ignoradas: ${[...skipped].join(', ')}.`, 'info');
    else showToast(formIsRecurrent ? `Série criada: ${created} sessões para ${who}!` : `Agendamento criado para ${who}!`, 'success');
    setIsModalOpen(false);
  };

  const handleUpdateStatus = (apptId: string, status: AppointmentStatus) => {
    if (status === 'cancelado') {
      const target = appointments.find((a) => a.id === apptId) || appointmentDetailModal;
      if (target) {
        setCancelModalAppt(target);
        setCancelPresetReason('Aviso prévio do paciente (>24h)');
        setCancelCustomReason('');
        return;
      }
    }
    if (status === 'faltou') {
      const target = appointments.find((a) => a.id === apptId);
      const result = clinicStorage.registerMissedSession(apptId, 'faltou');
      showToast(
        result.sessionConsumed
          ? 'Falta registrada. 1 sessão foi descontada do plano (regra da clínica).'
          : 'Falta registrada.',
        'info'
      );
      if (appointmentDetailModal?.id === apptId) setAppointmentDetailModal({ ...appointmentDetailModal, status });
      if (target && result.replacementAllowed) openReplacementModal(target);
      return;
    }
    clinicStorage.updateAppointmentStatus(apptId, status);
    showToast(`Status atualizado para: ${STATUS_LABELS[status] || status}`, 'info');
    if (appointmentDetailModal && appointmentDetailModal.id === apptId) {
      setAppointmentDetailModal({ ...appointmentDetailModal, status });
    }
  };

  const handleConfirmCancellation = () => {
    if (!cancelModalAppt) return;
    const finalReason = cancelCustomReason.trim()
      ? `${cancelPresetReason} - ${cancelCustomReason.trim()}`
      : cancelPresetReason;

    const result = clinicStorage.registerMissedSession(cancelModalAppt.id, 'cancelado', finalReason);
    showToast(
      result.replacementAllowed
        ? 'Cancelado dentro do prazo: o paciente tem direito a reposição.'
        : result.sessionConsumed
        ? `Cancelado fora do prazo (< ${settings.cancellationNoticeHours}h): 1 sessão descontada.`
        : 'Agendamento cancelado com registro de motivo.',
      'info'
    );
    if (appointmentDetailModal && appointmentDetailModal.id === cancelModalAppt.id) {
      setAppointmentDetailModal({
        ...appointmentDetailModal,
        status: 'cancelado',
        cancellationReason: finalReason,
      });
    }
    if (result.replacementAllowed) openReplacementModal(cancelModalAppt);
    setCancelModalAppt(null);
  };

  // ---------------- Reposição (replacement session)
  const [replacementFor, setReplacementFor] = useState<Appointment | null>(null);
  const [repDate, setRepDate] = useState('');
  const [repTime, setRepTime] = useState('08:00');
  const [repProfessionalId, setRepProfessionalId] = useState('');
  const [repError, setRepError] = useState<string | null>(null);

  function openReplacementModal(original: Appointment) {
    setAppointmentDetailModal(null);
    setReplacementFor(original);
    setRepDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    setRepTime(original.startTime);
    setRepProfessionalId(original.professionalId);
    setRepError(null);
  }

  const handleBookReplacement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacementFor) return;
    const professional = clinicStorage.getProfessionals().find((p) => p.id === repProfessionalId);
    if (!professional) return;

    const max = settings.maxReplacementsPerMonth;
    const used = clinicStorage.countReplacementsInMonth(replacementFor.patientId, repDate.slice(0, 7));
    if (max > 0 && used >= max) {
      setRepError(
        `Limite de ${max} reposição(ões) por mês atingido para ${replacementFor.patientName} em ${formatDate(repDate, 'MM/yyyy')}.`
      );
      return;
    }
    const conflict = checkScheduleConflict(clinicStorage.getAppointments(), {
      professionalId: professional.id,
      date: repDate,
      startTime: repTime,
      durationMinutes: replacementFor.durationMinutes,
      // a Pilates make-up session may join a class with free spots
      modality: replacementFor.modality,
      patientId: replacementFor.patientId,
    });
    if (conflict.hasConflict) {
      setRepError(describeScheduleConflict(conflict, professional.name, replacementFor.patientName));
      return;
    }
    const [h, m] = repTime.split(':').map(Number);
    const endMin = h * 60 + m + replacementFor.durationMinutes;
    clinicStorage.bookReplacement(replacementFor, {
      ...replacementFor,
      id: `apt-${Date.now()}`,
      professionalId: professional.id,
      professionalName: professional.name,
      date: repDate,
      startTime: repTime,
      endTime: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
      status: 'agendado',
      // joins the target slot as-is: a class keeps its own capacity, an empty slot is individual
      capacity: undefined,
      isRecurrent: false,
      recurrenceId: undefined,
      recurrenceRule: undefined,
      cancellationReason: undefined,
      notes: `Reposição da sessão de ${formatDate(replacementFor.date, 'dd/MM')}`,
    });
    showToast(`Reposição agendada para ${formatDate(repDate, 'dd/MM')} às ${repTime}.`, 'success');
    setReplacementFor(null);
  };

  const handleStartAttendance = (appt: Appointment) => {
    setAppointmentDetailModal(null);
    onNavigate('attendance', { appointmentId: appt.id, patientId: appt.patientId });
  };

  // Hourly rows follow the clinic's opening hours (and stretch to cover any booking outside them)
  const timeSlots = (() => {
    const openH = parseInt(settings.openingHour || '07', 10) || 7;
    const closeH = parseInt(settings.closingHour || '20', 10) || 20;
    const hours = filteredAppointments.map((a) => parseInt(a.startTime, 10));
    const first = Math.min(openH, ...hours);
    const last = Math.max(closeH - 1, ...hours);
    return Array.from({ length: last - first + 1 }, (_, i) => `${String(first + i).padStart(2, '0')}:00`);
  })();

  const isStartable = (a: Appointment) => a.status === 'agendado' || a.status === 'confirmado';

  /** "+ aluno (2/4)" buttons for each class in a calendar cell that still has free spots */
  const renderClassButtons = (cellAppts: Appointment[], dayStr: string, compact: boolean) => {
    const seen = new Set<string>();
    return cellAppts
      .filter((a) => isGroupModality(a.modality) && a.status !== 'cancelado' && a.status !== 'reagendado')
      .filter((a) => {
        const key = `${a.professionalId}|${a.startTime}|${a.durationMinutes}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((cls) => {
        const info = getClassInfo(appointments, cls);
        const free = info.capacity - info.students.length;
        const label = `${info.students.length}/${info.capacity}`;
        return free > 0 ? (
          <button
            key={`${cls.professionalId}-${cls.startTime}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenNewModal(dayStr, cls.startTime, cls);
            }}
            title={`Adicionar aluno à turma das ${cls.startTime}`}
            className={`w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-[#426B5B]/50 text-[#426B5B] dark:text-[#7FB39F] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] font-semibold ${
              compact ? 'text-[10px] py-1' : 'text-xs py-2 mt-2'
            }`}
          >
            <Plus className="w-3 h-3" /> aluno ({label})
          </button>
        ) : info.capacity > 1 ? (
          <span
            key={`${cls.professionalId}-${cls.startTime}`}
            className={`block text-center font-semibold text-rose-600 dark:text-rose-400 ${compact ? 'text-[10px]' : 'text-xs mt-2'}`}
          >
            Turma cheia ({label})
          </span>
        ) : null;
      });
  };

  // ───────────── presentation helpers ─────────────
  const STATUS_STYLE: Record<string, { bar: string; chip: string; dot: string; soft: string }> = {
    agendado: {
      bar: 'bg-slate-400',
      dot: 'bg-slate-400',
      chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      soft: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700',
    },
    confirmado: {
      bar: 'bg-blue-500',
      dot: 'bg-blue-500',
      chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
      soft: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
    },
    em_atendimento: {
      bar: 'bg-amber-500',
      dot: 'bg-amber-500',
      chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      soft: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800',
    },
    realizado: {
      bar: 'bg-emerald-500',
      dot: 'bg-emerald-500',
      chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      soft: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
    },
    faltou: {
      bar: 'bg-rose-500',
      dot: 'bg-rose-500',
      chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
      soft: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
    },
  };
  STATUS_STYLE.cancelado = STATUS_STYLE.faltou;
  STATUS_STYLE.reagendado = STATUS_STYLE.agendado;
  const st = (s: string) => STATUS_STYLE[s] || STATUS_STYLE.agendado;

  const patientMap = new Map(clinicStorage.getPatients().map((p) => [p.id, p]));
  const isActive = (a: Appointment) => a.status !== 'cancelado' && a.status !== 'reagendado';
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  /** One calendar block: a single booking, or every student of a class at the same slot */
  type Block = { key: string; appts: Appointment[]; isClass: boolean; capacity: number; first: Appointment };
  const toBlocks = (list: Appointment[]): Block[] => {
    const map = new Map<string, Appointment[]>();
    list.forEach((a) => {
      const key =
        isGroupModality(a.modality) && isActive(a)
          ? `cls|${a.date}|${a.professionalId}|${a.startTime}|${a.durationMinutes}|${a.modality}`
          : `one|${a.id}`;
      map.set(key, [...(map.get(key) || []), a]);
    });
    return [...map.entries()]
      .map(([key, appts]) => {
        const first = appts[0];
        const capacity = key.startsWith('cls') ? getClassInfo(appointments, first).capacity : 1;
        return { key, appts, isClass: key.startsWith('cls') && (capacity > 1 || appts.length > 1), capacity, first };
      })
      .sort((a, b) => a.first.startTime.localeCompare(b.first.startTime) || a.first.professionalName.localeCompare(b.first.professionalName));
  };

  // period shown by the current view (feeds the indicator cards)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const periodRange: [string, string] =
    viewMode === 'day'
      ? [format(selectedDate, 'yyyy-MM-dd'), format(selectedDate, 'yyyy-MM-dd')]
      : viewMode === 'week'
      ? [format(weekStart, 'yyyy-MM-dd'), format(addDays(weekStart, 6), 'yyyy-MM-dd')]
      : [format(startOfMonth(selectedDate), 'yyyy-MM-dd'), format(endOfMonth(selectedDate), 'yyyy-MM-dd')];
  const periodAppts = filteredAppointments.filter((a) => a.date >= periodRange[0] && a.date <= periodRange[1]);
  const kpi = {
    total: periodAppts.filter(isActive).length,
    confirmed: periodAppts.filter((a) => a.status === 'confirmado').length,
    pending: periodAppts.filter((a) => a.status === 'agendado').length,
    done: periodAppts.filter((a) => a.status === 'realizado').length,
    missed: periodAppts.filter((a) => a.status === 'faltou' || a.status === 'cancelado').length,
  };
  const periodWord = viewMode === 'day' ? (isSameDay(selectedDate, new Date()) ? 'hoje' : 'no dia') : viewMode === 'week' ? 'na semana' : 'no mês';

  const reminderLink = (a: Appointment) => {
    const p = patientMap.get(a.patientId);
    const phone = p?.whatsapp || p?.phone;
    if (!phone) return null;
    const when = a.date === todayStr ? 'hoje' : formatDate(a.date, "EEEE, dd/MM");
    return buildWhatsAppLink(
      phone,
      `Olá, ${a.patientName.split(' ')[0]}! Passando para lembrar da sua sessão de ${a.modality} ${when} às ${a.startTime} na ${settings.clinicName}. Podemos confirmar?`
    );
  };

  const goPeriod = (dir: -1 | 1) => {
    if (viewMode === 'day') setSelectedDate(dir < 0 ? subDays(selectedDate, 1) : addDays(selectedDate, 1));
    else if (viewMode === 'week') setSelectedDate(addDays(selectedDate, 7 * dir));
    else setSelectedDate(addMonths(selectedDate, dir));
  };
  const periodLabel =
    viewMode === 'day'
      ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
      : viewMode === 'week'
      ? `${format(weekStart, 'dd MMM', { locale: ptBR })} – ${format(addDays(weekStart, 5), "dd MMM yyyy", { locale: ptBR })}`
      : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  /** Card of one block in the day view */
  const renderDayBlock = (b: Block) => {
    const a = b.first;
    const end = a.endTime;
    const isNow = a.date === todayStr && nowMin >= toMin(a.startTime) && nowMin < toMin(a.startTime) + (a.durationMinutes || 50);
    const s = st(b.isClass ? (b.appts.every((x) => x.status === 'realizado') ? 'realizado' : 'confirmado') : a.status);
    const free = b.capacity - b.appts.filter(isActive).length;
    return (
      <article
        key={b.key}
        className={`relative flex rounded-xl border bg-white dark:bg-[#141F19] overflow-hidden ${
          isNow ? 'border-[#426B5B] ring-1 ring-[#426B5B]' : 'border-[#E5EAE7] dark:border-[#273830]'
        }`}
      >
        <span className={`w-1.5 shrink-0 ${s.bar}`} aria-hidden />
        <div className="flex-1 min-w-0 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">
              {a.startTime} – {end}
            </span>
            <span className="text-[#64748B]">{a.durationMinutes} min</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[#E9F1EC] dark:bg-[#1F332A] text-[#345648] dark:text-[#9CCBB8] font-semibold">{a.modality}</span>
            {b.isClass && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" /> Turma {b.appts.filter(isActive).length}/{b.capacity}
              </span>
            )}
            {!b.isClass && <span className={`px-1.5 py-0.5 rounded-md font-semibold ${s.chip}`}>{STATUS_LABELS[a.status] || a.status}</span>}
            {isNow && <span className="px-1.5 py-0.5 rounded-md bg-[#426B5B] text-white font-bold animate-pulse">Agora</span>}
            <span className="ml-auto flex items-center gap-1.5 text-[#64748B]">
              <Avatar name={a.professionalName.replace(/^(Dra?\.|Prof\.)\s*/i, '')} size="sm" />
              <span className="hidden sm:inline truncate max-w-[10rem]">{a.professionalName}</span>
            </span>
          </div>

          {b.isClass ? (
            <div className="space-y-2">
              <ProgressBar value={b.appts.filter(isActive).length} max={b.capacity} tone={free > 0 ? 'blue' : 'amber'} label="Vagas da turma" />
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {b.appts.map((x) => (
                  <li key={x.id}>
                    <button
                      onClick={() => setAppointmentDetailModal(x)}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-left"
                    >
                      <Avatar name={x.patientName} size="sm" />
                      <span className="flex-1 min-w-0 text-xs font-semibold truncate">{x.patientName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${st(x.status).chip}`}>{STATUS_LABELS[x.status] || x.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {free > 0 && (
                <button
                  onClick={() => handleOpenNewModal(a.date, a.startTime, a)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar aluno ({free} vaga{free > 1 ? 's' : ''})
                </button>
              )}
            </div>
          ) : (
            (() => {
              const p = patientMap.get(a.patientId);
              const link = reminderLink(a);
              return (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button onClick={() => setAppointmentDetailModal(a)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
                    <Avatar name={a.patientName} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm truncate">{a.patientName}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#64748B]">
                        {p && (
                          <span className={p.sessionsRemaining <= 2 ? 'text-rose-600 font-semibold' : ''}>
                            {p.sessionsRemaining} {p.sessionsRemaining === 1 ? 'sessão restante' : 'sessões restantes'}
                          </span>
                        )}
                        {p?.clinicalAlerts && p.clinicalAlerts.length > 0 && (
                          <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400" title={p.clinicalAlerts.join(' • ')}>
                            <AlertTriangle className="w-3 h-3" /> {p.clinicalAlerts[0]}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {a.status === 'agendado' && (
                      <button
                        onClick={() => handleUpdateStatus(a.id, 'confirmado')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirmar
                      </button>
                    )}
                    {link && (isStartable(a) || a.status === 'agendado') && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Enviar lembrete pelo WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> <span className="sm:hidden lg:inline">Lembrete</span>
                      </a>
                    )}
                    {(isStartable(a) || a.status === 'em_atendimento') && (
                      <button
                        onClick={() => handleStartAttendance(a)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> {a.status === 'em_atendimento' ? 'Continuar' : 'Atender'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </article>
    );
  };

  /** Compact block for week / month grids */
  const renderMiniBlock = (b: Block, dense = false) => {
    const a = b.first;
    const s = st(b.isClass ? 'confirmado' : a.status);
    return (
      <button
        key={b.key}
        onClick={(e) => {
          e.stopPropagation();
          if (b.isClass) {
            setSelectedDate(parseISO(a.date));
            setViewMode('day');
          } else setAppointmentDetailModal(a);
        }}
        title={b.appts.map((x) => x.patientName).join(', ')}
        className={`w-full flex text-left rounded-md border overflow-hidden mb-1 hover:shadow-sm transition-shadow ${s.soft}`}
      >
        <span className={`w-1 shrink-0 ${s.bar}`} aria-hidden />
        <span className={`flex-1 min-w-0 ${dense ? 'px-1 py-0.5' : 'px-1.5 py-1'}`}>
          <span className="flex items-center justify-between gap-1 text-[10px] font-mono text-[#64748B]">
            <span>{a.startTime}</span>
            {b.isClass && <span className="font-sans font-bold text-amber-700 dark:text-amber-300">{b.appts.filter(isActive).length}/{b.capacity}</span>}
          </span>
          <span className="block text-[11px] font-semibold truncate text-[#17231D] dark:text-[#F1F5F3]">
            {b.isClass ? `Turma ${a.modality}` : a.patientName}
          </span>
          {!dense && (
            <span className="block text-[10px] text-[#64748B] truncate">
              {b.isClass ? b.appts.map((x) => x.patientName.split(' ')[0]).join(', ') : a.professionalName.split(' ').slice(0, 2).join(' ')}
            </span>
          )}
        </span>
      </button>
    );
  };

  const viewBtn = (v: typeof viewMode, label: string) => (
    <button
      onClick={() => setViewMode(v)}
      aria-pressed={viewMode === v}
      className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
        viewMode === v ? 'bg-white dark:bg-[#17231D] text-[#426B5B] dark:text-[#7FB39F] shadow-xs' : 'text-[#64748B]'
      }`}
    >
      {label}
    </button>
  );
  const selectCls =
    'w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]';

  const dayStr = format(selectedDate, 'yyyy-MM-dd');
  const dayAppts = filteredAppointments.filter((a) => a.date === dayStr);
  const dayBlocks = toBlocks(dayAppts);
  const upcoming = dayStr === todayStr ? dayBlocks.find((b) => toMin(b.first.startTime) >= nowMin && b.appts.some((x) => isStartable(x))) : undefined;
  const team = [...new Set(dayAppts.filter(isActive).map((a) => a.professionalId))].map((id) => {
    const list = dayAppts.filter((a) => a.professionalId === id && isActive(a)).sort((x, y) => x.startTime.localeCompare(y.startTime));
    return { id, name: list[0].professionalName, count: toBlocks(list).length, students: list.length, from: list[0].startTime, to: list[list.length - 1].endTime };
  });

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3] flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Agenda
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Aulas individuais e turmas por profissional, com controle de vagas, confirmação e lembretes.
          </p>
        </div>
        <button
          onClick={() => handleOpenNewModal()}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 bg-[#426B5B] hover:bg-[#345648] text-white text-sm font-semibold rounded-lg shadow-sm transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo agendamento
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => goPeriod(-1)} aria-label="Anterior" className="p-2 rounded-lg border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-[#64748B]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 text-xs font-semibold border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] rounded-lg"
            >
              Hoje
            </button>
            <button onClick={() => goPeriod(1)} aria-label="Próximo" className="p-2 rounded-lg border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-[#64748B]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="font-bold text-sm sm:text-base capitalize flex-1 min-w-[10rem]">{periodLabel}</span>
          <div className="w-full sm:w-auto flex items-center bg-[#F8FAF9] dark:bg-[#111A15] p-1 border border-[#E5EAE7] dark:border-[#273830] rounded-lg">
            {viewBtn('day', 'Dia')}
            {viewBtn('week', 'Semana')}
            {viewBtn('month', 'Mês')}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#273830]">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <Filter className="hidden sm:block w-3.5 h-3.5 text-[#64748B]" />
            <select value={filterProfessionalId} onChange={(e) => setFilterProfessionalId(e.target.value)} aria-label="Profissional" className={selectCls}>
              <option value="all">Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={filterModality} onChange={(e) => setFilterModality(e.target.value)} aria-label="Modalidade" className={selectCls}>
              <option value="all">Todas as modalidades</option>
              {(settings.serviceAreas || []).map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#64748B]">
            {[
              ['agendado', 'A confirmar'],
              ['confirmado', 'Confirmado'],
              ['em_atendimento', 'Em atendimento'],
              ['realizado', 'Realizado'],
              ['faltou', 'Falta / cancelado'],
            ].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${st(k).dot}`} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Indicators of the period on screen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={`Sessões ${periodWord}`} value={kpi.total} hint={`${toBlocks(periodAppts.filter(isActive)).length} horários ocupados`} icon={CalendarDays} />
        <StatCard
          label="Confirmadas"
          value={kpi.confirmed}
          hint={`${kpi.pending} aguardando confirmação`}
          icon={Check}
          tone="blue"
        />
        <StatCard
          label="Realizadas"
          value={kpi.done}
          hint={kpi.total ? `${Math.round((kpi.done / kpi.total) * 100)}% do ${viewMode === 'day' ? 'dia' : viewMode === 'week' ? 'período' : 'mês'}` : '—'}
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard label="Faltas e cancelamentos" value={kpi.missed} hint={kpi.missed ? 'veja reposições no detalhe' : 'nenhuma no período'} icon={X} tone="rose" />
      </div>

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-4 items-start">
          <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-3 sm:p-4 shadow-xs">
            {(() => {
              // hours with bookings get their cards; runs of empty hours collapse into one "livre" row
              const rows: React.ReactNode[] = [];
              let freeStart: string | null = null;
              let freeEnd = '';
              const flushFree = () => {
                if (!freeStart) return;
                const start = freeStart;
                rows.push(
                  <div key={`free-${start}`} className="flex items-center gap-3 py-2">
                    <span className="w-12 shrink-0 font-mono text-[11px] text-[#94A3B8]">{start}</span>
                    <div className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-[#E5EAE7] dark:border-[#273830]">
                      <span className="text-xs text-[#94A3B8]">
                        Livre {start === freeEnd ? '' : `${start} – ${freeEnd}`}
                      </span>
                      <button
                        onClick={() => handleOpenNewModal(dayStr, start)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agendar
                      </button>
                    </div>
                  </div>
                );
                freeStart = null;
              };
              timeSlots.forEach((time) => {
                const hourBlocks = dayBlocks.filter((b) => b.first.startTime.startsWith(time.slice(0, 2)));
                const h = parseInt(time, 10);
                const nowHere = dayStr === todayStr && Math.floor(nowMin / 60) === h;
                if (hourBlocks.length === 0 && !nowHere) {
                  if (!freeStart) freeStart = time;
                  freeEnd = `${String(h + 1).padStart(2, '0')}:00`;
                  return;
                }
                flushFree();
                rows.push(
                  <div key={time} className="flex gap-3 py-2">
                    <div className="w-12 shrink-0 pt-1">
                      <span className={`font-mono text-xs font-bold ${nowHere ? 'text-[#426B5B] dark:text-[#7FB39F]' : 'text-[#64748B]'}`}>{time}</span>
                      {nowHere && (
                        <span className="mt-1 block text-[9px] font-bold uppercase text-white bg-rose-500 rounded px-1 text-center">
                          {format(new Date(), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      {hourBlocks.length === 0 ? (
                        <div className="flex items-center gap-2 py-2">
                          <span className="h-px flex-1 bg-rose-400" />
                          <button onClick={() => handleOpenNewModal(dayStr, time)} className="text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
                            + Agendar agora
                          </button>
                        </div>
                      ) : (
                        hourBlocks.map(renderDayBlock)
                      )}
                    </div>
                  </div>
                );
              });
              flushFree();
              return <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">{rows}</div>;
            })()}
          </div>

          {/* side panel */}
          <aside className="space-y-4">
            <Card title="Próximo atendimento">
              {upcoming ? (
                <button onClick={() => setAppointmentDetailModal(upcoming.first)} className="w-full flex items-center gap-3 text-left">
                  <Avatar name={upcoming.isClass ? upcoming.first.modality : upcoming.first.patientName} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">
                      {upcoming.isClass ? `Turma ${upcoming.first.modality} (${upcoming.appts.length})` : upcoming.first.patientName}
                    </span>
                    <span className="block text-[11px] text-[#64748B]">
                      {upcoming.first.startTime} • em {toMin(upcoming.first.startTime) - nowMin} min • {upcoming.first.professionalName}
                    </span>
                  </span>
                </button>
              ) : (
                <p className="text-xs text-[#64748B]">{dayStr === todayStr ? 'Nenhum atendimento pendente hoje.' : 'Disponível apenas para o dia de hoje.'}</p>
              )}
            </Card>
            <Card title="Equipe no dia">
              {team.length === 0 ? (
                <p className="text-xs text-[#64748B]">Sem atendimentos neste dia.</p>
              ) : (
                <ul className="space-y-3">
                  {team.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5">
                      <Avatar name={t.name.replace(/^(Dra?\.|Prof\.)\s*/i, '')} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{t.name}</p>
                        <p className="text-[11px] text-[#64748B]">
                          {t.from} – {t.to} • {t.count} horário(s) • {t.students} aluno(s)
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
          <div className="min-w-[860px]">
            {(() => {
              const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i)); // Mon–Sat
              return (
                <>
                  <div className="grid grid-cols-[4rem_repeat(6,minmax(0,1fr))] border-b border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9]/80 dark:bg-[#111A15] sticky top-0 z-[1]">
                    <div className="p-3" />
                    {weekDays.map((day) => {
                      const isToday = isSameDay(day, new Date());
                      const dStr = format(day, 'yyyy-MM-dd');
                      const count = filteredAppointments.filter((a) => a.date === dStr && isActive(a)).length;
                      return (
                        <button
                          key={dStr}
                          onClick={() => {
                            setSelectedDate(day);
                            setViewMode('day');
                          }}
                          className={`p-2.5 text-center border-l border-[#E5EAE7] dark:border-[#273830] hover:bg-[#E9F1EC]/60 dark:hover:bg-[#1F332A]/60 ${
                            isToday ? 'bg-[#E9F1EC] dark:bg-[#1F332A]' : ''
                          }`}
                        >
                          <p className="text-[11px] uppercase font-bold text-[#64748B]">{format(day, 'EEE', { locale: ptBR })}</p>
                          <p className={`text-lg font-extrabold leading-tight ${isToday ? 'text-[#426B5B] dark:text-[#7FB39F]' : ''}`}>{format(day, 'dd')}</p>
                          <p className="text-[10px] text-[#64748B]">{count ? `${count} sessão(ões)` : 'livre'}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
                    {timeSlots.map((time) => {
                      const h = parseInt(time, 10);
                      return (
                        <div key={time} className="grid grid-cols-[4rem_repeat(6,minmax(0,1fr))] min-h-[60px]">
                          <div className="p-2 text-right font-mono text-[11px] text-[#64748B]">{time}</div>
                          {weekDays.map((day) => {
                            const dStr = format(day, 'yyyy-MM-dd');
                            const isToday = dStr === todayStr;
                            const nowHere = isToday && Math.floor(nowMin / 60) === h;
                            const cellBlocks = toBlocks(filteredAppointments.filter((a) => a.date === dStr && a.startTime.startsWith(time.slice(0, 2))));
                            return (
                              <div
                                key={dStr}
                                onClick={() => cellBlocks.length === 0 && handleOpenNewModal(dStr, time)}
                                className={`relative p-1 border-l border-[#E5EAE7] dark:border-[#273830] cursor-pointer group ${
                                  isToday ? 'bg-[#E9F1EC]/30 dark:bg-[#1F332A]/30' : ''
                                } hover:bg-[#F8FAF9] dark:hover:bg-[#111A15]/60`}
                              >
                                {nowHere && (
                                  <span
                                    className="absolute left-0 right-0 h-0.5 bg-rose-500 z-[1] pointer-events-none"
                                    style={{ top: `${((nowMin % 60) / 60) * 100}%` }}
                                    aria-label="Agora"
                                  />
                                )}
                                {cellBlocks.map((b) => renderMiniBlock(b))}
                                {cellBlocks.length === 0 && (
                                  <span className="hidden group-hover:flex items-center justify-center h-full text-[#94A3B8]">
                                    <Plus className="w-4 h-4" />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-2 sm:p-4 shadow-xs">
          {(() => {
            const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
            const monthDays = eachDayOfInterval({ start, end });
            return (
              <div className="grid grid-cols-7 gap-1">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="p-2 text-center text-[11px] font-bold uppercase text-[#64748B]">
                    {d}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const list = filteredAppointments.filter((a) => a.date === dStr);
                  const blocks = toBlocks(list);
                  const active = list.filter(isActive).length;
                  const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={dStr}
                      onClick={() => {
                        setSelectedDate(day);
                        setViewMode('day');
                      }}
                      className={`min-h-[64px] sm:min-h-[96px] p-1 sm:p-1.5 text-left border rounded-lg transition-colors hover:border-[#426B5B] ${
                        !isCurrentMonth ? 'opacity-40' : ''
                      } ${isToday ? 'border-[#426B5B] ring-1 ring-[#426B5B] bg-[#E9F1EC]/40 dark:bg-[#1F332A]/40' : 'border-[#E5EAE7] dark:border-[#273830]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? 'text-[#426B5B] dark:text-[#7FB39F]' : ''}`}>{format(day, 'd')}</span>
                        {active > 0 && <span className="text-[10px] font-bold text-[#64748B]">{active}</span>}
                      </div>
                      {/* phones: status dots; larger screens: first bookings */}
                      <div className="sm:hidden mt-1 flex flex-wrap gap-0.5">
                        {list.slice(0, 6).map((a) => (
                          <span key={a.id} className={`w-1.5 h-1.5 rounded-full ${st(a.status).dot}`} />
                        ))}
                      </div>
                      <div className="hidden sm:block mt-1">
                        {blocks.slice(0, 2).map((b) => renderMiniBlock(b, true))}
                        {blocks.length > 2 && <span className="text-[10px] text-[#64748B]">+{blocks.length - 2} horário(s)</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* APPOINTMENT DETAILS & QUICK ACTIONS MODAL */}
      {appointmentDetailModal && (
        <Modal
          isOpen={true}
          onClose={() => setAppointmentDetailModal(null)}
          title={`Atendimento: ${appointmentDetailModal.patientName}`}
          description={`${formatDate(appointmentDetailModal.date, "EEEE, dd/MM/yyyy")} • ${appointmentDetailModal.startTime} às ${appointmentDetailModal.endTime}`}
        >
          {(() => {
            const patient = patients.find((p) => p.id === appointmentDetailModal.patientId);

            return (
              <div className="space-y-4">
                {/* Status indicator */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830]">
                  <div>
                    <span className="text-xs text-[#64748B] block">Status Atual:</span>
                    <span className="font-bold text-sm uppercase text-[#17231D] dark:text-[#F1F5F3]">
                      {STATUS_LABELS[appointmentDetailModal.status] || appointmentDetailModal.status}
                    </span>
                    {appointmentDetailModal.cancellationReason && (
                      <span className="block text-[11px] text-[#64748B] mt-0.5">
                        Motivo: {appointmentDetailModal.cancellationReason}
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 ${isStartable(appointmentDetailModal) ? '' : 'hidden'}`}>
                    <button
                      onClick={() => handleUpdateStatus(appointmentDetailModal.id, 'confirmado')}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(appointmentDetailModal.id, 'faltou')}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-100 text-rose-800 hover:bg-rose-200"
                    >
                      Faltou
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(appointmentDetailModal.id, 'cancelado')}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                {/* Patient Clinical & Plan Snapshot */}
                {patient && (
                  <div className="p-3.5 rounded-xl border border-[#E5EAE7] dark:border-[#273830] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">Modalidade:</span>
                      <span className="font-semibold">{appointmentDetailModal.modality}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">Sessões Restantes no Plano:</span>
                      <span className="font-bold text-[#426B5B] dark:text-[#5A8E7A]">
                        {patient.sessionsRemaining} de {patient.sessionsTotal} contratadas
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">WhatsApp:</span>
                      <span className="font-semibold">{patient.whatsapp}</span>
                    </div>
                    {patient.clinicalAlerts && patient.clinicalAlerts.length > 0 && (
                      <div className="pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
                        <span className="text-[11px] font-bold text-amber-600 block">
                          Alertas Clínicos Autorizados:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.clinicalAlerts.map((alt, i) => (
                            <span key={i} className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                              {alt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const pid = appointmentDetailModal.patientId;
                        setAppointmentDetailModal(null);
                        onNavigate('patients', { selectedPatientId: pid });
                      }}
                      className="px-3 py-2 text-xs font-semibold border border-[#E5EAE7] dark:border-[#273830] rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#111A15] text-[#17231D] dark:text-[#F1F5F3]"
                    >
                      Perfil 360°
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(appointmentDetailModal)}
                      className="px-3 py-2 text-xs font-semibold border border-[#E5EAE7] dark:border-[#273830] rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#111A15] text-[#17231D] dark:text-[#F1F5F3]"
                    >
                      Editar Horário
                    </button>
                    {(appointmentDetailModal.status === 'cancelado' || appointmentDetailModal.status === 'faltou') &&
                      !appointments.some((a) => a.replacementForAppointmentId === appointmentDetailModal.id) && (
                        <button
                          type="button"
                          onClick={() => openReplacementModal(appointmentDetailModal)}
                          className="px-3 py-2 text-xs font-semibold border border-[#426B5B] text-[#426B5B] dark:text-[#7FB39F] rounded-lg hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]"
                        >
                          Agendar Reposição
                        </button>
                      )}
                  </div>

                  {(isStartable(appointmentDetailModal) || appointmentDetailModal.status === 'em_atendimento') && (
                    <button
                      type="button"
                      onClick={() => handleStartAttendance(appointmentDetailModal)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-transform active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{appointmentDetailModal.status === 'em_atendimento' ? 'Continuar Atendimento' : 'Iniciar Atendimento'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* CREATE / EDIT APPOINTMENT MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
          description="Validação de conflitos de horário com o profissional."
        >
          <form onSubmit={handleSaveAppointment} className="space-y-4">
            {formConflictError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formConflictError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Profissional Responsável
                </label>
                <select
                  value={formProfessionalId}
                  onChange={(e) => setFormProfessionalId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                  required
                >
                  {professionals.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({pr.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Modalidade
                </label>
                <select
                  value={formModality}
                  onChange={(e) => {
                    setFormModality(e.target.value);
                    // new class bookings start from the area's suggested students per slot
                    const area = settings.serviceAreas?.find((a) => a.name === e.target.value);
                    if (!selectedAppointment && area?.allowsGroups) setFormCapacity(area.defaultCapacity || 1);
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                >
                  {(settings.serviceAreas || [])
                    .filter((a) => a.active || a.name === formModality)
                    .map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                        {a.allowsGroups ? ' (individual ou turma)' : ''}
                      </option>
                    ))}
                  {/* editing a booking whose area was renamed/removed keeps its original modality */}
                  {!settings.serviceAreas?.some((a) => a.name === formModality) && (
                    <option value={formModality}>{formModality}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Students per slot (Pilates classes) */}
            {isGroupModality(formModality) && (
              <div className="p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9] dark:bg-[#111A15] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" />
                  <div>
                    <span className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3]">Alunos por horário</span>
                    <span className="block text-[11px] text-[#64748B]">
                      {formCapacity === 1 ? 'Aula individual' : `Turma de até ${formCapacity} alunos`}
                      {formClass.students.length > 0 && ` • ${formClass.students.length} já agendado(s)`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Diminuir alunos por horário"
                    onClick={() => setFormCapacity((c) => Math.max(1, c - 1))}
                    className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D]"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    aria-label="Alunos por horário"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-14 h-10 sm:h-8 text-center text-sm font-bold bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar alunos por horário"
                    onClick={() => setFormCapacity((c) => Math.min(20, c + 1))}
                    className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Patient(s) */}
            {isGroupMode ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3]">Alunos</label>
                  <span className={`text-[11px] font-semibold ${formFreeSpots < 0 ? 'text-rose-600' : 'text-[#64748B]'}`}>
                    {formFreeSpots < 0
                      ? `${-formFreeSpots} acima do limite`
                      : `${formFreeSpots} vaga${formFreeSpots === 1 ? '' : 's'} livre${formFreeSpots === 1 ? '' : 's'}`}
                  </span>
                </div>

                {formClass.students.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formClass.students.map((s) => (
                      <span key={s.id} className="px-2 py-1 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {s.patientName} • já na turma
                      </span>
                    ))}
                  </div>
                )}

                {formPatientIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formPatientIds.map((id) => {
                      const p = patients.find((x) => x.id === id);
                      return (
                        <span key={id} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-[#E9F1EC] dark:bg-[#1F332A] text-[#345648] dark:text-[#9CCBB8]">
                          {p?.name || id}
                          <button
                            type="button"
                            aria-label={`Remover ${p?.name || 'aluno'}`}
                            onClick={() => setFormPatientIds((ids) => ids.filter((x) => x !== id))}
                            className="p-1 rounded-full hover:bg-black/10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={studentToAdd}
                    onChange={(e) => setStudentToAdd(e.target.value)}
                    aria-label="Aluno para adicionar"
                    className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                  >
                    <option value="">Selecione um aluno…</option>
                    {patients
                      .filter((p) => !formPatientIds.includes(p.id) && !formClass.students.some((s) => s.patientId === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sessionsRemaining} {p.sessionsRemaining === 1 ? 'sessão restante' : 'sessões restantes'})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!studentToAdd || formFreeSpots <= 0}
                    onClick={() => {
                      setFormPatientIds((ids) => [...ids, studentToAdd]);
                      setStudentToAdd('');
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>
                {formFreeSpots <= 0 && formPatientIds.length > 0 && (
                  <p className="text-[11px] text-[#64748B]">Turma completa. Aumente "Alunos por horário" para incluir mais.</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Paciente
                </label>
                <select
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sessionsRemaining} {p.sessionsRemaining === 1 ? 'sessão restante' : 'sessões restantes'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Horário de Início
                </label>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                  Duração (minutos)
                </label>
                <input
                  type="number"
                  min="30"
                  max="120"
                  step="5"
                  value={formDuration}
                  onChange={(e) => setFormDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                  required
                />
              </div>
            </div>

            {/* Recurrence Options */}
            {!selectedAppointment && (
              <div className="p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9] dark:bg-[#111A15] space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsRecurrent}
                    onChange={(e) => setFormIsRecurrent(e.target.checked)}
                    className="rounded text-[#426B5B] focus:ring-[#426B5B]"
                  />
                  <span>Agendamento Recorrente (Criar série fixa de 4 semanas)</span>
                </label>

                {formIsRecurrent && (
                  <div className="pl-6 pt-1">
                    <select
                      value={formRecurrenceRule}
                      onChange={(e) => setFormRecurrenceRule(e.target.value as any)}
                      className="text-xs bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-lg px-2.5 py-1.5"
                    >
                      <option value="weekly_1x">1x por semana no mesmo dia e horário</option>
                      <option value="weekly_2x">2x por semana (dia escolhido + 2 dias depois)</option>
                      <option value="weekly_3x">3x por semana (ex.: Seg / Qua / Sex)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#17231D] dark:text-[#F1F5F3] mb-1">
                Observações
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ex: Paciente com dor lombar leve, focar em alongamento..."
                rows={2}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Agendamento
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* REPLACEMENT (REPOSIÇÃO) MODAL */}
      {replacementFor && (
        <Modal
          isOpen={true}
          onClose={() => setReplacementFor(null)}
          title={`Agendar reposição: ${replacementFor.patientName}`}
          description={`Sessão original: ${formatDate(replacementFor.date, 'dd/MM/yyyy')} às ${replacementFor.startTime}`}
        >
          <form onSubmit={handleBookReplacement} className="space-y-4">
            <div className="p-3 rounded-lg bg-[#E9F1EC] dark:bg-[#1F332A] text-xs text-[#345648] dark:text-[#9CCBB8]">
              Reposições usadas em {formatDate(repDate || format(new Date(), 'yyyy-MM-dd'), 'MM/yyyy')}:{' '}
              <strong>
                {clinicStorage.countReplacementsInMonth(replacementFor.patientId, (repDate || '').slice(0, 7))} de{' '}
                {settings.maxReplacementsPerMonth}
              </strong>{' '}
              (limite definido em Configurações).
            </div>
            {repError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{repError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Data</label>
                <input
                  type="date"
                  value={repDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setRepDate(e.target.value);
                    setRepError(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Horário</label>
                <input
                  type="time"
                  value={repTime}
                  onChange={(e) => {
                    setRepTime(e.target.value);
                    setRepError(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Profissional</label>
                <select
                  value={repProfessionalId}
                  onChange={(e) => {
                    setRepProfessionalId(e.target.value);
                    setRepError(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                >
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setReplacementFor(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Agendar depois
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
              >
                Confirmar reposição
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CANCELLATION REASON MODAL (No window.prompt) */}
      {cancelModalAppt && (
        <Modal
          isOpen={true}
          onClose={() => setCancelModalAppt(null)}
          title="Cancelar Atendimento"
          description={`Registro de cancelamento auditado para ${cancelModalAppt.patientName} em ${cancelModalAppt.date} às ${cancelModalAppt.startTime}.`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#17231D] dark:text-[#F1F5F3] mb-2">
                Motivo Principal do Cancelamento:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Aviso prévio do paciente (>24h)',
                  'Imprevisto de saúde / Atestado',
                  'Viagem / Trabalho',
                  'Imprevisto pessoal de última hora',
                  'Desmarcação por parte da clínica',
                  'Outro motivo',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelPresetReason(reason)}
                    className={`p-2.5 rounded-lg text-xs text-left border transition-all ${
                      cancelPresetReason === reason
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
                Observação Complementar (Opcional):
              </label>
              <textarea
                value={cancelCustomReason}
                onChange={(e) => setCancelCustomReason(e.target.value)}
                placeholder="Ex: Paciente solicitou reagendamento para próxima semana..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
