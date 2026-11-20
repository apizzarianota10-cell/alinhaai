export type UserRole = 'admin' | 'receptionist' | 'professional';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export type PatientStatus = 'ativo' | 'inativo' | 'arquivado';

export interface Patient {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  cpf?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  /** Name of a ServiceArea (defaults: Pilates, Fisioterapia, Quiropraxia, Reabilitação) */
  modality: string;
  responsibleProfessionalId: string;
  status: PatientStatus;
  administrativeNotes?: string;
  clinicalAlerts?: string[]; // e.g. "Hérnia discal L4-L5", "Labirintite"
  activePlanId?: string;
  sessionsTotal: number;
  sessionsCompleted: number;
  sessionsRemaining: number;
  sessionsCancelled: number;
  sessionsReplaced: number;
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  councilRegistration: string; // e.g. CREFITO 123456-F
  role: UserRole;
  status: 'ativo' | 'inativo';
  color: string; // calendar badge
  availableDays: number[]; // 0=dom, 1=seg, 2=ter...
  workingHours: {
    start: string; // "07:00"
    end: string; // "20:00"
    lunchStart?: string; // "12:00"
    lunchEnd?: string; // "13:00"
  };
}

export type AppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'realizado'
  | 'cancelado'
  | 'faltou'
  | 'reagendado';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  modality: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  /** Students allowed in this slot (group modalities such as Pilates). 1 or missing = individual */
  capacity?: number;
  status: AppointmentStatus;
  isRecurrent: boolean;
  recurrenceId?: string;
  recurrenceRule?: 'weekly_1x' | 'weekly_2x' | 'weekly_3x' | 'custom';
  notes?: string;
  attendanceId?: string;
  cancellationReason?: string;
  replacementForAppointmentId?: string;
}

export interface Plan {
  id: string;
  name: string;
  priceCents: number; // in cents (e.g. 35000 = R$ 350,00)
  sessionsCount: number;
  frequencyPerWeek: number;
  validityDays: number;
  durationMinutes: number;
  replacementConditions: string;
  description: string;
  active: boolean;
  /** ServiceArea ids this plan covers (missing = Pilates only, as before areas existed) */
  areaIds?: string[];
  /** Individual sessions or a class with up to maxStudents per slot */
  format?: 'individual' | 'turma';
  maxStudents?: number;
}

export type FinancialStatus =
  | 'pendente'
  | 'pago'
  | 'parcialmente_pago'
  | 'vencido'
  | 'cancelado'
  | 'estornado';

export type PaymentMethod =
  | 'pix'
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'transferencia';

export interface PaymentReceipt {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  date: string; // ISO
  receiptNumber?: string;
  receivedBy: string;
  notes?: string;
}

export interface Charge {
  id: string;
  patientId: string;
  patientName: string;
  description: string;
  originalAmountCents: number;
  discountCents: number;
  surchargeCents: number;
  finalAmountCents: number;
  paidAmountCents: number;
  dueDate: string; // YYYY-MM-DD
  status: FinancialStatus;
  category: 'mensalidade' | 'pacote' | 'avulsa' | 'outro';
  planId?: string;
  payments: PaymentReceipt[];
  createdAt: string;
  updatedAt: string;
  refundedAt?: string; // YYYY-MM-DD
  refundedAmountCents?: number;
  auditTrail: {
    date: string;
    author: string;
    action: string;
  }[];
}

export interface Expense {
  id: string;
  description: string;
  category:
    | 'aluguel'
    | 'energia'
    | 'agua'
    | 'internet'
    | 'equipamentos'
    | 'manutencao'
    | 'materiais'
    | 'funcionarios'
    | 'outras';
  amountCents: number;
  dueDate: string;
  paymentDate?: string;
  isPaid: boolean;
  paymentMethod?: PaymentMethod;
  beneficiary: string;
  receiptUrl?: string;
}

export type ExerciseCategory =
  | 'Pilates Reformer'
  | 'Pilates Step Chair'
  | 'Pilates Solo'
  | 'Pilates Cadillac'
  | 'Pilates Barrel'
  | 'Mobilidade'
  | 'Alongamento'
  | 'Fortalecimento'
  | 'Exercícios terapêuticos';

/** Progression block of the Pilates repertoire */
export type ExerciseLevel = 'basico' | 'intermediario' | 'avancado';

export interface VisualStep {
  step: number;
  title: string;
  description: string;
  imageUrl?: string;
  positionType: 'inicial' | 'intermediaria' | 'final';
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: 'Reformer' | 'Step Chair' | 'Cadillac' | 'Solo / Mat' | 'Barrel' | 'Acessórios' | 'Nenhum';
  bodyRegion: 'Tronco & Core' | 'Membros Superiores' | 'Membros Inferiores' | 'Coluna' | 'Corpo Inteiro';
  /** Optional on stored data saved before levels existed; read through getExerciseLevel() */
  level?: ExerciseLevel;
  objective: string;
  shortDescription: string;
  instructions: string[];
  variations: string[];
  contraindications?: string[];
  steps: VisualStep[];
  videoUrl?: string;
  /** Animated GIF built from the 3 step images */
  gifUrl?: string;
  /** Where the step images come from */
  mediaSource?: 'foto' | 'ilustracao' | 'upload';
  mediaCredit?: string;
  animationSvgType?: 'reformer_movement' | 'chair_stretch' | 'mat_teaser' | 'spine_mobility';
  reviewedByProfessional: boolean;
  isFavorite?: boolean;
}

export interface WorkoutItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  equipment: string;
  sets: number;
  reps: string; // e.g. "10" or "8-12"
  resistanceSprings?: string; // e.g. "1 mola vermelha + 1 azul"
  durationSeconds?: number;
  restSeconds?: number;
  observations?: string;
}

export interface WorkoutPlan {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  professionalGoal: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  weeklyDays: {
    day: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado';
    enabled: boolean;
    items: WorkoutItem[];
  }[];
  active: boolean;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  modality: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'em_andamento' | 'finalizado' | 'cancelado';
  workoutPlanId?: string;
  completedExercises: {
    workoutItemId: string;
    exerciseName: string;
    completed: boolean;
    adapted: boolean;
    adaptationNote?: string;
    actualSets?: number;
    actualReps?: string;
    actualSprings?: string;
  }[];
  painScaleBefore: number; // 0-10 (EVA)
  painScaleAfter: number; // 0-10 (EVA)
  intercurrences?: string;
  clinicalEvolution: string;
  conductedBy: string;
  startedAt?: string; // ISO — keeps the session timer correct after a reload
  previousAppointmentStatus?: AppointmentStatus; // restored if the session is discarded
  completedAt?: string;
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  anamnesis: {
    mainComplaint: string;
    historyOfPresentIllness: string;
    pastMedicalHistory: string;
    medications: string;
    surgeriesAndInjuries: string;
    lifestyleHabits: string;
  };
  initialEvaluation: {
    posturalAssessment: string;
    flexibilityAndMobility: string;
    strengthEvaluation: string;
    palpationNotes: string;
    specificTests: string;
    clinicalGoals: string;
  };
  evolutions: ClinicalEvolutionEntry[];
  attachments: {
    id: string;
    title: string;
    type: 'exame' | 'laudo' | 'foto_postural' | 'termo';
    date: string;
    fileName: string;
    url: string;
  }[];
}

export interface ClinicalEvolutionEntry {
  id: string;
  attendanceId?: string;
  date: string; // ISO
  professionalName: string;
  professionalCouncil: string;
  content: string;
  adendums?: {
    id: string;
    date: string;
    author: string;
    text: string;
  }[];
}

export interface BirthdayAlert {
  patientId: string;
  patientName: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  nextBirthday: string; // formatted date
  daysUntil: number; // 0 = today, 1 = tomorrow, 2 = 2 days, 3 = 3 days
  age: number;
  alertLevel: 'today' | 'tomorrow' | 'soon' | 'upcoming';
  dismissedForToday?: boolean;
}

export interface ClinicSettings {
  clinicName: string;
  slogan: string;
  cnpj?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  workingDays: string[];
  openingHour: string;
  closingHour: string;
  defaultSessionDurationMinutes: number;
  cancellationNoticeHours: number;
  maxReplacementsPerMonth: number;
  /** Absence / late cancellation consumes a session from the plan (default true) */
  absenceConsumesSession?: boolean;
  birthdayMessageTemplate: string;
  leapYearFeb29Rule: 'feb28' | 'mar01';
  theme: 'light' | 'dark';
  timeZone: string;
  /** Service areas offered by the clinic (agenda modalities, plan coverage). Missing = defaults */
  serviceAreas?: ServiceArea[];
}

/** A service area / modality the clinic offers (Pilates, Fisioterapia, RPG…) */
export interface ServiceArea {
  id: string;
  name: string;
  /** Several students may share the same slot (classes) */
  allowsGroups: boolean;
  /** Suggested "alunos por horário" when booking this area */
  defaultCapacity?: number;
  active: boolean;
}

// ───────────────────────── Controle de Presença ─────────────────────────

/** P = presença, C = compensação (reposição), F = falta */
export type PresenceMark = 'P' | 'C' | 'F';

/** Paper-style entry added by hand (sessions that are not in the agenda) */
export interface ManualPresenceEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mark: PresenceMark;
  note?: string;
}

/** Per-patient attendance sheet: manual entries and the notes written every 10 sessions */
export interface PresenceSheet {
  patientId: string;
  manualEntries: ManualPresenceEntry[];
  /**
   * Free-text notes keyed by position: `c{cycle}-b{block}` = "Percepção do paciente" after each
   * 10 sessions, `c{cycle}-reav` = reavaliação after 30 sessions.
   */
  notes: Record<string, string>;
  updatedAt?: string;
}

// ───────────────────────── Avaliação ─────────────────────────

export type EvaluationFieldType =
  | 'text' // short answer
  | 'textarea' // long answer
  | 'number'
  | 'date'
  | 'yesno' // Sim / Não (+ optional detail)
  | 'select' // one of the options
  | 'scale' // movement score (feeds the suggested level)
  | 'pain'; // 0-10 (EVA)

export interface EvaluationField {
  id: string;
  label: string;
  type: EvaluationFieldType;
  options?: string[];
  unit?: string;
  /** yes/no questions that ask "Qual?" / "Locais:" when the answer is yes */
  detailLabel?: string;
}

export interface EvaluationSection {
  id: string;
  title: string;
  fields: EvaluationField[];
}

export interface EvaluationTemplate {
  id: string;
  name: string;
  sections: EvaluationSection[];
  /** Name of the PDF the template was imported from */
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

/** A filled-in evaluation. The template is copied so later template edits don't change old records */
export interface EvaluationRecord {
  id: string;
  patientId: string;
  patientName: string;
  templateId: string;
  templateName: string;
  sections: EvaluationSection[];
  /** field id -> answer ("Sim"/"Não" for yesno, number as string for scale/pain) */
  values: Record<string, string>;
  /** detail answer of yes/no fields, keyed by field id */
  details?: Record<string, string>;
  date: string; // YYYY-MM-DD
  professionalId: string;
  professionalName: string;
  createdAt: string;
  updatedAt: string;
}
