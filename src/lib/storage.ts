import {
  Patient,
  Professional,
  Plan,
  Appointment,
  Charge,
  Expense,
  Exercise,
  WorkoutPlan,
  ClinicalRecord,
  ClinicSettings,
  UserProfile,
  UserRole,
  PaymentReceipt,
  PaymentMethod,
  AttendanceRecord,
  ClinicalEvolutionEntry,
  ServiceArea,
} from '../types';
import {
  INITIAL_PATIENTS,
  INITIAL_PROFESSIONALS,
  INITIAL_PLANS,
  INITIAL_APPOINTMENTS,
  INITIAL_CHARGES,
  INITIAL_EXPENSES,
  INITIAL_EXERCISES,
  INITIAL_WORKOUT_PLANS,
  INITIAL_CLINICAL_RECORDS,
  INITIAL_ATTENDANCES,
  DEFAULT_SETTINGS,
  DEFAULT_SERVICE_AREAS,
} from './constants';
import { withExerciseMedia } from './exerciseMedia';
import { toLocalDateKey, nowStamp, formatCurrency, setGroupModalities } from './utils';

const STORAGE_KEYS = {
  PATIENTS: 'pilatesflow_patients',
  PROFESSIONALS: 'pilatesflow_professionals',
  PLANS: 'pilatesflow_plans',
  APPOINTMENTS: 'pilatesflow_appointments',
  CHARGES: 'pilatesflow_charges',
  EXPENSES: 'pilatesflow_expenses',
  EXERCISES: 'pilatesflow_exercises',
  WORKOUT_PLANS: 'pilatesflow_workout_plans',
  CLINICAL_RECORDS: 'pilatesflow_clinical_records',
  SETTINGS: 'pilatesflow_settings',
  CURRENT_USER: 'pilatesflow_current_user',
  ACTIVE_ATTENDANCE: 'pilatesflow_active_attendance',
  BIRTHDAY_POPUP_DISMISSED: 'pilatesflow_bday_dismissed_date',
  ATTENDANCES: 'pilatesflow_attendances',
};

/** Clinic data shared between devices/users (sync + backup). Per-device state is left out. */
export const SYNCED_KEYS = [
  STORAGE_KEYS.PATIENTS,
  STORAGE_KEYS.PROFESSIONALS,
  STORAGE_KEYS.PLANS,
  STORAGE_KEYS.APPOINTMENTS,
  STORAGE_KEYS.CHARGES,
  STORAGE_KEYS.EXPENSES,
  STORAGE_KEYS.EXERCISES,
  STORAGE_KEYS.WORKOUT_PLANS,
  STORAGE_KEYS.CLINICAL_RECORDS,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.ATTENDANCES,
];

const BACKUP_APP_ID = 'pilatesflow-backup';
const BACKUP_VERSION = 1;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Set by the cloud sync module: every local write of a shared key is forwarded to it */
let remoteWriteHook: ((key: string, value: unknown) => void) | null = null;
export function setRemoteWriteHook(hook: ((key: string, value: unknown) => void) | null) {
  remoteWriteHook = hook;
}

/** Replace local data with a snapshot coming from the cloud (does not echo back to the cloud) */
export function applyRemoteSnapshot(snapshot: Record<string, unknown>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (SYNCED_KEYS.includes(key)) localStorage.setItem(key, JSON.stringify(value));
  }
  notify();
}

/** Current local value of every shared key (used for the first upload to an empty cloud clinic) */
export function readLocalSnapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SYNCED_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) out[key] = JSON.parse(raw);
  }
  return out;
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error notifying listener:', e);
    }
  });
}

function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/** Returns false when the browser refuses the write (e.g. storage quota exceeded) */
function setItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (remoteWriteHook && SYNCED_KEYS.includes(key)) remoteWriteHook(key, value);
    notify();
    return true;
  } catch (e) {
    console.error('Storage error:', e);
    return false;
  }
}

export const clinicStorage = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // RESET TO COMPLETE DEMO ENVIRONMENT (goes through setItem so a connected cloud clinic is reset too)
  resetToDemoData(): void {
    if (typeof window === 'undefined') return;
    setItem(STORAGE_KEYS.PATIENTS, INITIAL_PATIENTS);
    setItem(STORAGE_KEYS.PROFESSIONALS, INITIAL_PROFESSIONALS);
    setItem(STORAGE_KEYS.PLANS, INITIAL_PLANS);
    setItem(STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS);
    setItem(STORAGE_KEYS.CHARGES, INITIAL_CHARGES);
    setItem(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
    setItem(STORAGE_KEYS.EXERCISES, INITIAL_EXERCISES);
    setItem(STORAGE_KEYS.WORKOUT_PLANS, INITIAL_WORKOUT_PLANS);
    setItem(STORAGE_KEYS.CLINICAL_RECORDS, INITIAL_CLINICAL_RECORDS);
    setItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    setItem(STORAGE_KEYS.ATTENDANCES, INITIAL_ATTENDANCES);
    localStorage.removeItem(STORAGE_KEYS.BIRTHDAY_POPUP_DISMISSED);
    notify();
  },

  // BACKUP / RESTORE
  exportBackup(): string {
    return JSON.stringify(
      {
        app: BACKUP_APP_ID,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        clinicName: this.getSettings().clinicName,
        data: readLocalSnapshot(),
      },
      null,
      2
    );
  },

  /** Validates and restores a backup file. Returns a summary or throws a readable error. */
  importBackup(json: string): { patients: number; appointments: number; exportedAt: string } {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('O arquivo não é um JSON válido.');
    }
    if (!parsed || parsed.app !== BACKUP_APP_ID || typeof parsed.data !== 'object') {
      throw new Error('Este arquivo não é um backup do PilatesFlow.');
    }
    if (parsed.version > BACKUP_VERSION) {
      throw new Error('Backup criado por uma versão mais nova do sistema.');
    }
    const data = parsed.data as Record<string, unknown>;
    const mustBeArrays = SYNCED_KEYS.filter(
      (k) => k !== STORAGE_KEYS.SETTINGS && k !== STORAGE_KEYS.CLINICAL_RECORDS
    );
    for (const key of mustBeArrays) {
      if (key in data && !Array.isArray(data[key])) throw new Error(`Backup corrompido (${key}).`);
    }
    if (!Array.isArray(data[STORAGE_KEYS.PATIENTS])) throw new Error('Backup sem lista de pacientes.');

    for (const key of SYNCED_KEYS) {
      if (key in data) setItem(key, data[key]);
    }
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ATTENDANCE);
    notify();
    return {
      patients: (data[STORAGE_KEYS.PATIENTS] as unknown[]).length,
      appointments: ((data[STORAGE_KEYS.APPOINTMENTS] as unknown[]) || []).length,
      exportedAt: parsed.exportedAt,
    };
  },

  // USER / RBAC
  getCurrentUser(): UserProfile {
    return getItem<UserProfile>(STORAGE_KEYS.CURRENT_USER, {
      id: 'prof-1',
      name: 'Dra. Camila Sampaio',
      email: 'camila.sampaio@pilatesmovimento.com.br',
      role: 'admin',
    });
  },

  setCurrentUserRole(role: UserRole): void {
    const names = {
      admin: 'Dra. Camila Sampaio (Administradora)',
      receptionist: 'Juliana Vasconcelos (Recepcionista)',
      professional: 'Dr. Rodrigo Mendonça (Profissional)',
    };
    const emails = {
      admin: 'camila.sampaio@pilatesmovimento.com.br',
      receptionist: 'recepcao@pilatesmovimento.com.br',
      professional: 'rodrigo.mendonca@pilatesmovimento.com.br',
    };
    const profIds = {
      admin: 'prof-1',
      receptionist: 'prof-3',
      professional: 'prof-2',
    };
    setItem(STORAGE_KEYS.CURRENT_USER, {
      id: profIds[role],
      name: names[role],
      email: emails[role],
      role,
    });
  },

  // SETTINGS
  getSettings(): ClinicSettings {
    // First visit: follow the operating system theme
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const fallback: ClinicSettings = { ...DEFAULT_SETTINGS, theme: prefersDark ? 'dark' : 'light' };
    const settings = { ...fallback, ...getItem<Partial<ClinicSettings>>(STORAGE_KEYS.SETTINGS, {}) };
    const areas: ServiceArea[] = settings.serviceAreas?.length ? settings.serviceAreas : DEFAULT_SERVICE_AREAS;
    setGroupModalities(areas.filter((a) => a.allowsGroups).map((a) => a.name));
    return { ...settings, serviceAreas: areas };
  },

  /** Areas the clinic offers; active ones feed the agenda and plan forms */
  getServiceAreas(onlyActive = false): ServiceArea[] {
    const areas = this.getSettings().serviceAreas || DEFAULT_SERVICE_AREAS;
    return onlyActive ? areas.filter((a) => a.active) : areas;
  },

  saveServiceAreas(areas: ServiceArea[]): void {
    this.saveSettings({ ...this.getSettings(), serviceAreas: areas });
  },

  saveSettings(settings: ClinicSettings): void {
    setItem(STORAGE_KEYS.SETTINGS, settings);
  },

  // BIRTHDAY POPUP STATE
  isBirthdayPopupDismissedToday(): boolean {
    const dismissedDate = getItem<string | null>(STORAGE_KEYS.BIRTHDAY_POPUP_DISMISSED, null);
    return dismissedDate === toLocalDateKey();
  },

  dismissBirthdayPopupForToday(): void {
    setItem(STORAGE_KEYS.BIRTHDAY_POPUP_DISMISSED, toLocalDateKey());
  },

  // PATIENTS
  getPatients(): Patient[] {
    return getItem<Patient[]>(STORAGE_KEYS.PATIENTS, INITIAL_PATIENTS);
  },

  getPatientById(id: string): Patient | undefined {
    return this.getPatients().find((p) => p.id === id);
  },

  savePatient(patient: Patient): void {
    const patients = this.getPatients();
    const idx = patients.findIndex((p) => p.id === patient.id);
    if (idx >= 0) {
      patients[idx] = patient;
    } else {
      patients.unshift(patient);
    }
    setItem(STORAGE_KEYS.PATIENTS, patients);
  },

  deletePatient(id: string): void {
    // Soft archive rather than hard destroy to protect clinical integrity
    const patients = this.getPatients();
    const idx = patients.findIndex((p) => p.id === id);
    if (idx >= 0) {
      patients[idx].status = 'arquivado';
      setItem(STORAGE_KEYS.PATIENTS, patients);
    }
  },

  importPatients(newPatients: Patient[]): number {
    const existing = this.getPatients();
    const existingCpfOrNames = new Set(existing.map((p) => p.cpf || p.name.toLowerCase()));
    const validToAdd: Patient[] = [];

    for (const p of newPatients) {
      const key = p.cpf || p.name.toLowerCase();
      if (!existingCpfOrNames.has(key)) {
        validToAdd.push(p);
        existingCpfOrNames.add(key);
      }
    }

    if (validToAdd.length > 0) {
      setItem(STORAGE_KEYS.PATIENTS, [...validToAdd, ...existing]);
    }
    return validToAdd.length;
  },

  // PROFESSIONALS
  getProfessionals(): Professional[] {
    return getItem<Professional[]>(STORAGE_KEYS.PROFESSIONALS, INITIAL_PROFESSIONALS);
  },

  saveProfessional(prof: Professional): void {
    const profs = this.getProfessionals();
    const idx = profs.findIndex((p) => p.id === prof.id);
    if (idx >= 0) {
      profs[idx] = prof;
    } else {
      profs.push(prof);
    }
    setItem(STORAGE_KEYS.PROFESSIONALS, profs);
  },

  // PLANS
  getPlans(): Plan[] {
    return getItem<Plan[]>(STORAGE_KEYS.PLANS, INITIAL_PLANS);
  },

  savePlan(plan: Plan): void {
    const plans = this.getPlans();
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = plan;
    } else {
      plans.push(plan);
    }
    setItem(STORAGE_KEYS.PLANS, plans);
  },

  deletePlan(id: string): void {
    setItem(STORAGE_KEYS.PLANS, this.getPlans().filter((p) => p.id !== id));
  },

  // APPOINTMENTS
  getAppointments(): Appointment[] {
    return getItem<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS);
  },

  saveAppointment(appt: Appointment): void {
    const appts = this.getAppointments();
    const idx = appts.findIndex((a) => a.id === appt.id);
    if (idx >= 0) {
      appts[idx] = appt;
    } else {
      appts.push(appt);
    }
    setItem(STORAGE_KEYS.APPOINTMENTS, appts);
  },

  updateAppointmentStatus(id: string, status: Appointment['status'], reason?: string): void {
    const appts = this.getAppointments();
    const appt = appts.find((a) => a.id === id);
    if (appt) {
      appt.status = status;
      if (reason) appt.cancellationReason = reason;
      setItem(STORAGE_KEYS.APPOINTMENTS, appts);
    }
  },

  deleteAppointment(id: string): void {
    const appts = this.getAppointments().filter((a) => a.id !== id);
    setItem(STORAGE_KEYS.APPOINTMENTS, appts);
  },

  // CHARGES & FINANCIAL
  getCharges(): Charge[] {
    return getItem<Charge[]>(STORAGE_KEYS.CHARGES, INITIAL_CHARGES);
  },

  saveCharge(charge: Charge): void {
    const charges = this.getCharges();
    const idx = charges.findIndex((c) => c.id === charge.id);
    if (idx >= 0) {
      charges[idx] = charge;
    } else {
      charges.unshift(charge);
    }
    setItem(STORAGE_KEYS.CHARGES, charges);
  },

  recordPayment(
    chargeId: string,
    payment: {
      amountCents: number;
      method: PaymentMethod;
      notes?: string;
      receiptNumber?: string;
      receivedBy: string;
    }
  ): Charge | null {
    const charges = this.getCharges();
    const charge = charges.find((c) => c.id === chargeId);
    if (!charge) return null;

    const receipt: PaymentReceipt = {
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amountCents: payment.amountCents,
      method: payment.method,
      date: new Date().toISOString(),
      receiptNumber: payment.receiptNumber || `REC-${Math.floor(100000 + Math.random() * 900000)}`,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
    };

    charge.payments.push(receipt);
    charge.paidAmountCents += payment.amountCents;
    charge.updatedAt = new Date().toISOString();

    if (charge.paidAmountCents >= charge.finalAmountCents) {
      charge.status = 'pago';
    } else if (charge.paidAmountCents > 0) {
      charge.status = 'parcialmente_pago';
    }

    charge.auditTrail.push({
      date: nowStamp(),
      author: payment.receivedBy,
      action: `Recebimento de ${formatCurrency(payment.amountCents)} registrado via ${payment.method}`,
    });

    setItem(STORAGE_KEYS.CHARGES, charges);
    return charge;
  },

  // EXPENSES
  getExpenses(): Expense[] {
    return getItem<Expense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  },

  saveExpense(expense: Expense): void {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex((e) => e.id === expense.id);
    if (idx >= 0) {
      expenses[idx] = expense;
    } else {
      expenses.unshift(expense);
    }
    setItem(STORAGE_KEYS.EXPENSES, expenses);
  },

  deleteExpense(id: string): void {
    const expenses = this.getExpenses().filter((e) => e.id !== id);
    setItem(STORAGE_KEYS.EXPENSES, expenses);
  },

  // EXERCISES
  getExercises(): Exercise[] {
    const stored = getItem<Exercise[]>(STORAGE_KEYS.EXERCISES, INITIAL_EXERCISES);
    // Clinics saved before a catalogue update keep their edits (favourites, own photos) and
    // receive the new catalogue exercises and level tags. Catalogue items can't be deleted in the UI.
    const catalogue = new Map(INITIAL_EXERCISES.map((e) => [e.id, e]));
    const storedIds = new Set(stored.map((e) => e.id));
    const merged = [
      ...stored.map((e) => (e.level || !catalogue.has(e.id) ? e : { ...e, level: catalogue.get(e.id)!.level })),
      ...INITIAL_EXERCISES.filter((e) => !storedIds.has(e.id)),
    ];
    return merged.map(withExerciseMedia);
  },

  saveExercise(exercise: Exercise): boolean {
    const exercises = this.getExercises();
    const idx = exercises.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      exercises[idx] = exercise;
    } else {
      exercises.unshift(exercise);
    }
    return setItem(STORAGE_KEYS.EXERCISES, exercises);
  },

  deleteExercise(id: string): void {
    setItem(
      STORAGE_KEYS.EXERCISES,
      this.getExercises().filter((e) => e.id !== id)
    );
  },

  toggleFavoriteExercise(id: string): void {
    const exercises = this.getExercises();
    const ex = exercises.find((e) => e.id === id);
    if (ex) {
      ex.isFavorite = !ex.isFavorite;
      setItem(STORAGE_KEYS.EXERCISES, exercises);
    }
  },

  // WORKOUT PLANS
  getWorkoutPlans(): WorkoutPlan[] {
    return getItem<WorkoutPlan[]>(STORAGE_KEYS.WORKOUT_PLANS, INITIAL_WORKOUT_PLANS);
  },

  getWorkoutPlanByPatientId(patientId: string): WorkoutPlan | undefined {
    return this.getWorkoutPlans().find((w) => w.patientId === patientId && w.active);
  },

  saveWorkoutPlan(plan: WorkoutPlan): void {
    const plans = this.getWorkoutPlans();
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = plan;
    } else {
      plans.unshift(plan);
    }
    setItem(STORAGE_KEYS.WORKOUT_PLANS, plans);
  },

  deleteWorkoutPlan(id: string): void {
    const plans = this.getWorkoutPlans().filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.WORKOUT_PLANS, plans);
  },

  // CLINICAL RECORDS
  getClinicalRecord(patientId: string): ClinicalRecord {
    const records = getItem<Record<string, ClinicalRecord>>(
      STORAGE_KEYS.CLINICAL_RECORDS,
      INITIAL_CLINICAL_RECORDS
    );
    if (records[patientId]) {
      return records[patientId];
    }
    // Return empty clinical record template
    return {
      id: `rec-${patientId}`,
      patientId,
      anamnesis: {
        mainComplaint: '',
        historyOfPresentIllness: '',
        pastMedicalHistory: '',
        medications: '',
        surgeriesAndInjuries: '',
        lifestyleHabits: '',
      },
      initialEvaluation: {
        posturalAssessment: '',
        flexibilityAndMobility: '',
        strengthEvaluation: '',
        palpationNotes: '',
        specificTests: '',
        clinicalGoals: '',
      },
      evolutions: [],
      attachments: [],
    };
  },

  saveClinicalRecord(record: ClinicalRecord): void {
    const records = getItem<Record<string, ClinicalRecord>>(
      STORAGE_KEYS.CLINICAL_RECORDS,
      INITIAL_CLINICAL_RECORDS
    );
    records[record.patientId] = record;
    setItem(STORAGE_KEYS.CLINICAL_RECORDS, records);
  },

  addEvolutionEntry(patientId: string, entry: ClinicalEvolutionEntry): void {
    const record = this.getClinicalRecord(patientId);
    record.evolutions.unshift(entry);
    this.saveClinicalRecord(record);
  },

  addEvolutionAdendum(patientId: string, evolutionId: string, adendumText: string, author: string): void {
    const record = this.getClinicalRecord(patientId);
    const evo = record.evolutions.find((e) => e.id === evolutionId);
    if (evo) {
      if (!evo.adendums) evo.adendums = [];
      evo.adendums.push({
        id: `ad-${Date.now()}`,
        date: new Date().toISOString(),
        author,
        text: adendumText,
      });
      this.saveClinicalRecord(record);
    }
  },

  // ACTIVE ATTENDANCE & FINALIZE FLOW
  getActiveAttendance(): AttendanceRecord | null {
    return getItem<AttendanceRecord | null>(STORAGE_KEYS.ACTIVE_ATTENDANCE, null);
  },

  setActiveAttendance(attendance: AttendanceRecord | null): void {
    setItem(STORAGE_KEYS.ACTIVE_ATTENDANCE, attendance);
  },

  /** Discard a session started by mistake: the appointment goes back to its previous status */
  discardActiveAttendance(): void {
    const active = this.getActiveAttendance();
    if (!active) return;
    if (active.appointmentId) {
      this.updateAppointmentStatus(active.appointmentId, active.previousAppointmentStatus || 'agendado');
    }
    this.setActiveAttendance(null);
  },

  /**
   * FLUXO COMPLETO: Finalize live attendance
   * 1. Updates attendance status to 'finalizado'
   * 2. Marks appointment status as 'realizado'
   * 3. Decrements 1 session from patient's remaining sessions and increments completed sessions
   * 4. Logs a clinical evolution entry into the patient's record
   * 5. Clears active attendance
   */
  finalizeAttendance(record: AttendanceRecord): void {
    // 1. Mark appointment as realizado
    if (record.appointmentId) {
      this.updateAppointmentStatus(record.appointmentId, 'realizado');
    }

    // 2. Decrement patient session
    const patient = this.getPatientById(record.patientId);
    if (patient) {
      patient.sessionsCompleted = (patient.sessionsCompleted || 0) + 1;
      patient.sessionsRemaining = Math.max(0, (patient.sessionsRemaining || 0) - 1);
      this.savePatient(patient);
    }

    // 3. Add to clinical record evolution timeline
    const performedSummary = record.completedExercises
      .filter((e) => e.completed)
      .map((e) => `${e.exerciseName}${e.adapted ? ` (Adaptado: ${e.adaptationNote || 'ajuste'})` : ''}`)
      .join(', ');

    const evolutionText = [
      `Atendimento de ${record.modality} realizado com sucesso.`,
      `Escala de dor (EVA): Inicial ${record.painScaleBefore}/10 -> Final ${record.painScaleAfter}/10.`,
      performedSummary ? `Exercícios realizados: ${performedSummary}.` : '',
      record.intercurrences ? `Intercorrências: ${record.intercurrences}` : '',
      record.clinicalEvolution ? `Observações clínicas: ${record.clinicalEvolution}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const currentUser = this.getCurrentUser();
    const council = this.getProfessionals().find((p) => p.id === record.professionalId)?.councilRegistration;
    const evolutionEntry: ClinicalEvolutionEntry = {
      id: `evo-${Date.now()}`,
      attendanceId: record.id,
      date: new Date().toISOString(),
      professionalName: record.conductedBy || currentUser.name,
      professionalCouncil: council && council !== '-' ? council : 'CREFITO',
      content: evolutionText,
    };

    this.addEvolutionEntry(record.patientId, evolutionEntry);

    // 4. Keep the finished attendance (pain scale history, exercises done)
    setItem(STORAGE_KEYS.ATTENDANCES, [record, ...this.getAttendances().filter((a) => a.id !== record.id)]);

    // 5. Clear active attendance
    this.setActiveAttendance(null);
  },

  getAttendances(): AttendanceRecord[] {
    return getItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCES, INITIAL_ATTENDANCES);
  },

  /**
   * Pain scale (EVA 0-10) per session, oldest first.
   * Uses finished attendances; older sessions are recovered from the evolution text
   * ("Escala de dor (EVA): Inicial X/10 -> Final Y/10").
   */
  getPainHistory(patientId: string): { date: string; before: number; after: number; source: 'atendimento' | 'prontuario' }[] {
    const fromAttendances = this.getAttendances()
      .filter((a) => a.patientId === patientId && a.status === 'finalizado')
      .map((a) => ({
        date: a.completedAt || a.date,
        before: a.painScaleBefore,
        after: a.painScaleAfter,
        source: 'atendimento' as const,
        attendanceId: a.id,
      }));
    const known = new Set(fromAttendances.map((a) => a.attendanceId));
    const fromRecord = this.getClinicalRecord(patientId)
      .evolutions.filter((e) => !e.attendanceId || !known.has(e.attendanceId))
      .map((e) => {
        const m = e.content.match(/EVA\)?:?\s*Inicial\s*(\d+(?:[.,]\d+)?)\s*\/\s*10\s*->\s*Final\s*(\d+(?:[.,]\d+)?)/i);
        return m
          ? {
              date: e.date,
              before: parseFloat(m[1].replace(',', '.')),
              after: parseFloat(m[2].replace(',', '.')),
              source: 'prontuario' as const,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return [...fromAttendances.map(({ attendanceId, ...rest }) => rest), ...fromRecord].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  },

  // ABSENCES & REPLACEMENTS (reposições)

  /** Replacement sessions already booked for the patient in the given month (YYYY-MM) */
  countReplacementsInMonth(patientId: string, monthKey: string): number {
    return this.getAppointments().filter(
      (a) =>
        a.patientId === patientId &&
        !!a.replacementForAppointmentId &&
        a.status !== 'cancelado' &&
        a.date.startsWith(monthKey)
    ).length;
  },

  /** Hours between now and the appointment start (negative when it already started) */
  hoursUntilAppointment(appt: Appointment): number {
    const start = new Date(`${appt.date}T${appt.startTime}:00`);
    return (start.getTime() - Date.now()) / 36e5;
  },

  /**
   * Registers an absence or a cancellation applying the clinic rules:
   * - cancellation with enough notice: session kept, patient is entitled to a replacement;
   * - absence or late cancellation: the session is consumed (when the clinic rule says so).
   * Returns whether the patient may book a replacement.
   */
  registerMissedSession(
    apptId: string,
    kind: 'faltou' | 'cancelado',
    reason?: string
  ): { replacementAllowed: boolean; sessionConsumed: boolean } {
    const appt = this.getAppointments().find((a) => a.id === apptId);
    if (!appt) return { replacementAllowed: false, sessionConsumed: false };
    const settings = this.getSettings();
    const withNotice = kind === 'cancelado' && this.hoursUntilAppointment(appt) >= settings.cancellationNoticeHours;
    const clinicCancelled = kind === 'cancelado' && /cl[ií]nica/i.test(reason || '');
    const sessionConsumed = !withNotice && !clinicCancelled && settings.absenceConsumesSession !== false;

    this.updateAppointmentStatus(apptId, kind, reason);
    const patient = this.getPatientById(appt.patientId);
    if (patient) {
      if (kind === 'cancelado') patient.sessionsCancelled = (patient.sessionsCancelled || 0) + 1;
      if (sessionConsumed) patient.sessionsRemaining = Math.max(0, (patient.sessionsRemaining || 0) - 1);
      this.savePatient(patient);
    }
    return { replacementAllowed: withNotice || clinicCancelled, sessionConsumed };
  },

  /** Books a replacement session linked to the missed appointment */
  bookReplacement(original: Appointment, replacement: Appointment): void {
    this.saveAppointment({ ...replacement, replacementForAppointmentId: original.id });
    const patient = this.getPatientById(original.patientId);
    if (patient) {
      patient.sessionsReplaced = (patient.sessionsReplaced || 0) + 1;
      this.savePatient(patient);
    }
  },

  addClinicalAttachment(
    patientId: string,
    attachment: {
      title: string;
      type: 'exame' | 'laudo' | 'foto_postural' | 'termo';
      fileName: string;
      url?: string;
    }
  ): void {
    const record = this.getClinicalRecord(patientId);
    if (!record.attachments) record.attachments = [];
    record.attachments.unshift({
      id: `att-${Date.now()}`,
      title: attachment.title,
      type: attachment.type,
      date: toLocalDateKey(),
      fileName: attachment.fileName,
      url: attachment.url || '#',
    });
    this.saveClinicalRecord(record);
  },

  renewPatientPlan(patientId: string, planId: string, sessionsToAdd: number): void {
    const patient = this.getPatientById(patientId);
    if (patient) {
      patient.activePlanId = planId;
      patient.sessionsTotal = (patient.sessionsTotal || 0) + sessionsToAdd;
      patient.sessionsRemaining = (patient.sessionsRemaining || 0) + sessionsToAdd;
      this.savePatient(patient);
    }
  },

  refundCharge(chargeId: string, reason: string, author: string): void {
    const charges = this.getCharges();
    const charge = charges.find((c) => c.id === chargeId);
    if (charge && charge.status !== 'estornado') {
      charge.status = 'estornado';
      charge.updatedAt = new Date().toISOString();
      charge.refundedAt = toLocalDateKey();
      charge.refundedAmountCents = charge.paidAmountCents;
      charge.auditTrail.push({
        date: nowStamp(),
        author,
        action: `Estorno de ${formatCurrency(charge.paidAmountCents)} realizado: ${reason}`,
      });
      setItem(STORAGE_KEYS.CHARGES, charges);
    }
  },

  getDailyClosing(dateStr: string) {
    const charges = this.getCharges();
    const expenses = this.getExpenses();
    // Refunds leave the cash register on the day they are made
    const refundsCents = charges
      .filter((c) => c.status === 'estornado' && c.refundedAt === dateStr)
      .reduce((sum, c) => sum + (c.refundedAmountCents ?? c.paidAmountCents), 0);

    let totalPixCents = 0;
    let totalCashCents = 0;
    let totalCardCents = 0;
    let totalTransferCents = 0;
    let totalInCents = 0;

    charges.forEach((c) => {
      c.payments.forEach((p) => {
        // payment dates are UTC ISO strings: compare by local calendar day
        if (toLocalDateKey(p.date) === dateStr) {
          totalInCents += p.amountCents;
          if (p.method === 'pix') totalPixCents += p.amountCents;
          else if (p.method === 'dinheiro') totalCashCents += p.amountCents;
          else if (p.method === 'cartao_credito' || p.method === 'cartao_debito') totalCardCents += p.amountCents;
          else totalTransferCents += p.amountCents;
        }
      });
    });

    const expensesPaidOnDate = expenses.filter((e) => e.isPaid && e.paymentDate === dateStr);
    const totalOutCents = expensesPaidOnDate.reduce((sum, e) => sum + e.amountCents, 0) + refundsCents;

    return {
      date: dateStr,
      totalInCents,
      totalOutCents,
      refundsCents,
      netCents: totalInCents - totalOutCents,
      byMethod: {
        pix: totalPixCents,
        dinheiro: totalCashCents,
        cartao: totalCardCents,
        transferencia: totalTransferCents,
      },
    };
  },
};
