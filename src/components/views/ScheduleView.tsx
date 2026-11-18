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
import { checkScheduleConflict, formatDate, STATUS_LABELS } from '../../lib/utils';
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
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
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

  const [settings, setSettings] = useState(clinicStorage.getSettings());

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

  function handleOpenNewModal(dateStr?: string, timeStr?: string) {
    setSelectedAppointment(null);
    setFormDate(dateStr || format(selectedDate, 'yyyy-MM-dd'));
    setFormStartTime(timeStr || '08:00');
    setFormDuration(clinicStorage.getSettings().defaultSessionDurationMinutes || 50);
    setFormNotes('');
    setFormIsRecurrent(false);
    setFormConflictError(null);
    if (filterProfessionalId !== 'all') setFormProfessionalId(filterProfessionalId);
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
    setFormConflictError(null);
    setAppointmentDetailModal(null);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormConflictError(null);

    // Editing may keep a patient/professional that is no longer in the "active" lists
    const patient =
      patients.find((p) => p.id === formPatientId) || clinicStorage.getPatientById(formPatientId);
    const professional =
      professionals.find((p) => p.id === formProfessionalId) ||
      clinicStorage.getProfessionals().find((p) => p.id === formProfessionalId);

    if (!patient || !professional) {
      showToast('Selecione paciente e profissional válidos', 'error');
      return;
    }
    if (!formDuration || formDuration < 10) {
      showToast('Informe uma duração válida (mínimo 10 minutos).', 'error');
      return;
    }

    // Server-level Conflict detection rule
    const conflictResult = checkScheduleConflict(appointments, {
      id: selectedAppointment?.id,
      professionalId: formProfessionalId,
      date: formDate,
      startTime: formStartTime,
      durationMinutes: formDuration,
    });

    if (conflictResult.hasConflict) {
      setFormConflictError(
        `Conflito de horário detectado! O profissional ${professional.name} já possui o atendimento de ${conflictResult.conflictingWith?.patientName} às ${conflictResult.conflictingWith?.startTime}.`
      );
      return;
    }

    // Calculate end time
    const [h, m] = formStartTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + formDuration;
    const endH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const endM = String(totalMinutes % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    const apptData: Appointment = {
      id: selectedAppointment ? selectedAppointment.id : `apt-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      professionalId: professional.id,
      professionalName: professional.name,
      modality: formModality,
      date: formDate,
      startTime: formStartTime,
      endTime,
      durationMinutes: formDuration,
      status: selectedAppointment ? selectedAppointment.status : 'agendado',
      isRecurrent: formIsRecurrent,
      recurrenceRule: formIsRecurrent ? formRecurrenceRule : undefined,
      notes: formNotes,
    };

    clinicStorage.saveAppointment(apptData);

    // Recurring series: 4 weeks following the chosen frequency.
    // 1x = same weekday; 2x = chosen day + 2 days later; 3x = chosen day + 2 + 4 days later (Sundays skipped).
    if (!selectedAppointment && formIsRecurrent) {
      const baseDate = parseISO(formDate);
      const offsetsPerWeek = formRecurrenceRule === 'weekly_3x' ? [0, 2, 4] : formRecurrenceRule === 'weekly_2x' ? [0, 2] : [0];
      let created = 0;
      const skipped: string[] = [];
      let existing = clinicStorage.getAppointments();
      for (let w = 0; w < 4; w++) {
        for (const off of offsetsPerWeek) {
          if (w === 0 && off === 0) continue; // the base appointment already saved above
          let next = addDays(baseDate, w * 7 + off);
          if (next.getDay() === 0) next = addDays(next, 1);
          const nextDateStr = format(next, 'yyyy-MM-dd');
          const conflict = checkScheduleConflict(existing, {
            professionalId: professional.id,
            date: nextDateStr,
            startTime: formStartTime,
            durationMinutes: formDuration,
          });
          if (conflict.hasConflict) {
            skipped.push(formatDate(nextDateStr, 'dd/MM'));
            continue;
          }
          const occurrence: Appointment = {
            ...apptData,
            id: `apt-${Date.now()}-${w}-${off}`,
            date: nextDateStr,
            recurrenceId: apptData.id,
          };
          clinicStorage.saveAppointment(occurrence);
          existing = [...existing, occurrence];
          created++;
        }
      }
      showToast(
        skipped.length
          ? `Série criada com ${created + 1} sessões. Datas com conflito ignoradas: ${skipped.join(', ')}.`
          : `Série recorrente criada com ${created + 1} sessões!`,
        skipped.length ? 'info' : 'success'
      );
    } else {
      showToast(selectedAppointment ? 'Agendamento atualizado!' : 'Agendamento criado com sucesso!', 'success');
    }
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
    });
    if (conflict.hasConflict) {
      setRepError(`Conflito: ${professional.name} já atende ${conflict.conflictingWith?.patientName} às ${conflict.conflictingWith?.startTime}.`);
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

  return (
    <div className="space-y-4">
      {/* Top Header & Calendar Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Agenda de Atendimentos Individuais
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Organização individual por profissional com prevenção ativa de sobreposição de horários.
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
              <option value="Pilates" className="dark:bg-[#17231D]">Pilates</option>
              <option value="Fisioterapia" className="dark:bg-[#17231D]">Fisioterapia</option>
              <option value="Quiropraxia" className="dark:bg-[#17231D]">Quiropraxia</option>
              <option value="Reabilitação" className="dark:bg-[#17231D]">Reabilitação</option>
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
          title={selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento Individual'}
          description="Validação de conflitos de horário com o profissional."
        >
          <form onSubmit={handleSaveAppointment} className="space-y-4">
            {formConflictError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formConflictError}</span>
              </div>
            )}

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
                  onChange={(e) => setFormModality(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg text-[#17231D] dark:text-[#F1F5F3]"
                >
                  <option value="Pilates">Pilates Clínico Individual</option>
                  <option value="Fisioterapia">Fisioterapia Traumato-Ortopédica</option>
                  <option value="Quiropraxia">Quiropraxia & Ajuste Postural</option>
                  <option value="Reabilitação">Reabilitação de Coluna</option>
                </select>
              </div>
            </div>

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
