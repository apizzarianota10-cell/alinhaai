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
  isGroupModality,
  STATUS_LABELS,
} from '../../lib/utils';
import { Appointment, Patient, Professional, AppointmentStatus } from '../../types';
import { Modal } from '../common/Modal';
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

  return (
    <div className="space-y-4">
      {/* Top Header & Calendar Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Agenda de Atendimentos
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Aulas individuais e turmas de Pilates por profissional, com controle de vagas e de conflitos de horário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Professional filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={filterProfessionalId}
              onChange={(e) => setFilterProfessionalId(e.target.value)}
              className="bg-transparent border-0 text-[#17231D] dark:text-[#F1F5F3] focus:ring-0 cursor-pointer font-medium"
            >
              <option value="all" className="dark:bg-[#17231D]">Todos os Profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-[#17231D]">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Modality filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-xs">
            <select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              className="bg-transparent border-0 text-[#17231D] dark:text-[#F1F5F3] focus:ring-0 cursor-pointer font-medium"
            >
              <option value="all" className="dark:bg-[#17231D]">Todas as Modalidades</option>
              {(settings.serviceAreas || []).map((a) => (
                <option key={a.id} value={a.name} className="dark:bg-[#17231D]">
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#F8FAF9] dark:bg-[#111A15] p-1 border border-[#E5EAE7] dark:border-[#273830] rounded-lg">
            <button
              onClick={() => setViewMode('day')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-[#17231D] text-[#426B5B] dark:text-[#5A8E7A] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-[#17231D] text-[#426B5B] dark:text-[#5A8E7A] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-[#17231D] text-[#426B5B] dark:text-[#5A8E7A] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              Mês
            </button>
          </div>

          {/* New Appointment Button */}
          <button
            onClick={() => handleOpenNewModal()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Navigation Controls Bar */}
      <div className="p-3 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (viewMode === 'day') setSelectedDate(subDays(selectedDate, 1));
              else if (viewMode === 'week') setSelectedDate(addDays(selectedDate, -7));
              else setSelectedDate(addMonths(selectedDate, -1));
            }}
            className="p-1.5 rounded-lg border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-[#64748B]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 text-xs font-semibold border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
          >
            Hoje
          </button>

          <button
            onClick={() => {
              if (viewMode === 'day') setSelectedDate(addDays(selectedDate, 1));
              else if (viewMode === 'week') setSelectedDate(addDays(selectedDate, 7));
              else setSelectedDate(addMonths(selectedDate, 1));
            }}
            className="p-1.5 rounded-lg border border-[#E5EAE7] dark:border-[#273830] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] text-[#64748B]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="ml-2 font-bold text-sm text-[#17231D] dark:text-[#F1F5F3] capitalize">
            {viewMode === 'day'
              ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
              : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[#64748B]">Confirmado</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[#64748B]">Em Atendimento</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[#64748B]">Realizado</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-[#64748B]">Cancelado / Falta</span>
          </span>
        </div>
      </div>

      {/* CALENDAR BODY */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl overflow-x-auto shadow-xs">
          <div className="min-w-[800px]">
            {/* Days Header */}
            {(() => {
              const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
              const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i)); // Seg - Sab

              return (
                <div className="grid grid-cols-7 border-b border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9]/80 dark:bg-[#111A15]">
                  <div className="p-3 text-center border-r border-[#E5EAE7] dark:border-[#273830] text-xs font-semibold text-[#64748B]">
                    Horário
                  </div>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={`p-3 text-center border-r border-[#E5EAE7] dark:border-[#273830] last:border-r-0 ${
                          isToday ? 'bg-[#E9F1EC] dark:bg-[#1F332A]' : ''
                        }`}
                      >
                        <p className="text-[11px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8]">
                          {format(day, 'EEE', { locale: ptBR })}
                        </p>
                        <p
                          className={`text-sm font-extrabold mt-0.5 ${
                            isToday ? 'text-[#426B5B] dark:text-[#5A8E7A]' : 'text-[#17231D] dark:text-[#F1F5F3]'
                          }`}
                        >
                          {format(day, 'dd/MM')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Time Rows */}
            <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {timeSlots.map((time) => {
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i));

                return (
                  <div key={time} className="grid grid-cols-7 min-h-[64px]">
                    <div className="p-2 border-r border-[#E5EAE7] dark:border-[#273830] text-center font-mono text-xs text-[#64748B] bg-[#F8FAF9]/40 dark:bg-[#111A15]/40 flex items-center justify-center">
                      {time}
                    </div>

                    {weekDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const matchAppts = filteredAppointments.filter(
                        (a) => a.date === dayStr && a.startTime.startsWith(time.split(':')[0])
                      );

                      return (
                        <div
                          key={dayStr}
                          onClick={() => matchAppts.length === 0 && handleOpenNewModal(dayStr, time)}
                          className="p-1 border-r border-[#E5EAE7] dark:border-[#273830] last:border-r-0 hover:bg-[#F8FAF9]/50 dark:hover:bg-[#111A15]/50 transition-colors cursor-pointer relative"
                        >
                          {matchAppts.map((appt) => (
                            <div
                              key={appt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAppointmentDetailModal(appt);
                              }}
                              className={`p-1.5 rounded-lg border text-xs shadow-xs mb-1 transition-transform hover:scale-[1.02] cursor-pointer ${
                                appt.status === 'confirmado'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                                  : appt.status === 'em_atendimento'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 animate-pulse'
                                  : appt.status === 'realizado'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold leading-tight">
                                <span className="truncate">{appt.patientName}</span>
                                <span className="text-[10px] font-mono">{appt.startTime}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                                <span className="truncate">{appt.professionalName.split(' ')[1] || appt.professionalName}</span>
                                <span className="font-medium capitalize">{appt.modality}</span>
                              </div>
                            </div>
                          ))}
                          {renderClassButtons(matchAppts, dayStr, true)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs">
          <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
            {timeSlots.map((time) => {
              const dayStr = format(selectedDate, 'yyyy-MM-dd');
              const match = filteredAppointments.filter(
                (a) => a.date === dayStr && a.startTime.startsWith(time.split(':')[0])
              );

              return (
                <div key={time} className="py-3 flex items-start gap-4">
                  <span className="font-mono text-xs font-bold text-[#64748B] w-14 pt-1">
                    {time}
                  </span>
                  <div className="flex-1">
                    {match.length > 0 ? (
                      <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {match.map((appt) => (
                          <div
                            key={appt.id}
                            onClick={() => setAppointmentDetailModal(appt)}
                            className="p-3 rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9] dark:bg-[#111A15] hover:border-[#426B5B] transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">
                                  {appt.patientName}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                    appt.status === 'confirmado'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                      : appt.status === 'realizado'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : appt.status === 'em_atendimento'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                      : appt.status === 'cancelado' || appt.status === 'faltou'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  {STATUS_LABELS[appt.status] || appt.status}
                                </span>
                              </div>
                              <p className="text-xs text-[#64748B] mt-0.5">
                                {appt.startTime} às {appt.endTime} • Prof. {appt.professionalName} ({appt.modality})
                              </p>
                            </div>
                            {(isStartable(appt) || appt.status === 'em_atendimento') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartAttendance(appt);
                                }}
                                className="px-3 py-1.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{appt.status === 'em_atendimento' ? 'Continuar' : 'Atender'}</span>
                              </button>
                            )}
                          </div>
                        ))}
                        </div>
                        {renderClassButtons(match, dayStr, false)}
                      </>
                    ) : (
                      <button
                        onClick={() => handleOpenNewModal(dayStr, time)}
                        className="text-xs text-slate-400 hover:text-[#426B5B] py-1 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Disponível para agendamento</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-4 shadow-xs">
          {(() => {
            const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
            const monthDays = eachDayOfInterval({ start, end });

            return (
              <div className="grid grid-cols-7 gap-1">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-bold text-[#64748B]">
                    {d}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayAppts = filteredAppointments.filter((a) => a.date === dayStr);
                  const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dayStr}
                      onClick={() => {
                        setSelectedDate(day);
                        setViewMode('day');
                      }}
                      className={`min-h-[85px] p-2 border border-[#E5EAE7] dark:border-[#273830] rounded-lg transition-colors cursor-pointer ${
                        !isCurrentMonth ? 'opacity-40 bg-slate-50 dark:bg-slate-900/40' : 'bg-white dark:bg-[#17231D]'
                      } ${isToday ? 'border-[#426B5B] ring-1 ring-[#426B5B]' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? 'text-[#426B5B]' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {dayAppts.length > 0 && (
                          <span className="text-[10px] font-bold bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] px-1.5 rounded-full">
                            {dayAppts.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-1 overflow-hidden">
                        {dayAppts.slice(0, 2).map((a) => (
                          <div
                            key={a.id}
                            className="text-[10px] truncate px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {a.startTime} {a.patientName.split(' ')[0]}
                          </div>
                        ))}
                        {dayAppts.length > 2 && (
                          <span className="text-[9px] text-[#64748B] block">
                            +{dayAppts.length - 2} mais
                          </span>
                        )}
                      </div>
                    </div>
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
                          {p.name} ({p.sessionsRemaining} sessões restantes)
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
                      {p.name} ({p.sessionsRemaining} sessões restantes)
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
