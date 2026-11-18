import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInCalendarDays, setYear, isBefore, addYears, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BirthdayAlert, Patient, Appointment, Charge, ClinicSettings, UserRole } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Local calendar date as YYYY-MM-DD.
 * (toISOString() is UTC: in Brazil after 21h it already returns tomorrow's date.)
 */
export function toLocalDateKey(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'yyyy-MM-dd');
}

/** Local timestamp "YYYY-MM-DD HH:mm" used in audit trails */
export function nowStamp(): string {
  return format(new Date(), 'yyyy-MM-dd HH:mm');
}

/**
 * Parse a BRL amount typed by the user ("1.234,56", "420", "99.90") into cents.
 * Returns NaN when the text is not a valid positive-or-zero amount.
 */
export function parseBRLToCents(text: string): number {
  const raw = (text || '').replace(/[R$\s]/g, '');
  if (!raw) return NaN;
  let normalized = raw;
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if ((raw.match(/\./g) || []).length > 1) {
    normalized = raw.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(parseFloat(normalized) * 100);
}

/** Fill the birthday template ({nome} / {clinica} may appear more than once) */
export function buildBirthdayMessage(settings: ClinicSettings, patientName: string): string {
  return settings.birthdayMessageTemplate
    .replaceAll('{nome}', patientName.split(' ')[0])
    .replaceAll('{clinica}', settings.clinicName);
}

/** Status shown to the user: pending/partial charges past the due date are overdue */
export function getChargeDisplayStatus(charge: Charge, today: string = toLocalDateKey()): Charge['status'] {
  if ((charge.status === 'pendente' || charge.status === 'parcialmente_pago') && charge.dueDate < today) {
    return 'vencido';
  }
  return charge.status;
}

/** Charges that still count as revenue / receivable */
export function isChargeActive(charge: Charge): boolean {
  return charge.status !== 'estornado' && charge.status !== 'cancelado';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  receptionist: 'Recepção',
  professional: 'Profissional',
};

/** Sections each role may open (single source for Sidebar and App guard) */
export const SECTION_ROLES: Record<string, UserRole[] | undefined> = {
  financial: ['admin', 'receptionist'],
  professionals: ['admin'],
  settings: ['admin'],
  records: ['admin', 'professional'],
};

export function canAccessSection(section: string, role: UserRole): boolean {
  const allowed = SECTION_ROLES[section];
  return !allowed || allowed.includes(role);
}

export const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
  reagendado: 'Reagendado',
  pendente: 'Pendente',
  pago: 'Pago',
  parcialmente_pago: 'Parcial',
  vencido: 'Vencido',
  estornado: 'Estornado',
  ativo: 'Ativo',
  inativo: 'Inativo',
  arquivado: 'Arquivado',
};

/**
 * Format cents to BRL currency string (e.g. 15000 -> "R$ 150,00")
 */
export function formatCurrency(cents: number): string {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format date string (YYYY-MM-DD or ISO) to Brazilian standard
 */
export function formatDate(dateString: string, formatStr: string = 'dd/MM/yyyy'): string {
  if (!dateString) return '-';
  try {
    const date = dateString.includes('T') ? parseISO(dateString) : new Date(dateString + 'T00:00:00');
    if (!isValid(date)) return '-';
    return format(date, formatStr, { locale: ptBR });
  } catch {
    return dateString;
  }
}

/**
 * Calculate birthday alerts for all patients
 */
export function getBirthdayAlerts(
  patients: Patient[],
  referenceDate: Date = new Date(),
  leapYearRule: 'feb28' | 'mar01' = 'feb28'
): BirthdayAlert[] {
  const alerts: BirthdayAlert[] = [];
  const currentYear = referenceDate.getFullYear();

  for (const patient of patients) {
    if (!patient.birthDate || patient.status === 'inativo' || patient.status === 'arquivado') continue;

    try {
      const parts = patient.birthDate.split('-');
      if (parts.length !== 3) continue;

      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
      const birthDay = parseInt(parts[2], 10);

      // Handle February 29th
      let targetDay = birthDay;
      let targetMonth = birthMonth;
      const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

      if (birthMonth === 1 && birthDay === 29 && !isLeap(currentYear)) {
        if (leapYearRule === 'mar01') {
          targetMonth = 2; // March
          targetDay = 1;
        } else {
          targetMonth = 1; // February
          targetDay = 28;
        }
      }

      let nextBday = new Date(currentYear, targetMonth, targetDay);

      // If already passed this year, look at next year
      const todayAtMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      if (isBefore(nextBday, todayAtMidnight)) {
        const nextYear = currentYear + 1;
        let nextTargetDay = birthDay;
        let nextTargetMonth = birthMonth;
        if (birthMonth === 1 && birthDay === 29 && !isLeap(nextYear)) {
          if (leapYearRule === 'mar01') {
            nextTargetMonth = 2;
            nextTargetDay = 1;
          } else {
            nextTargetMonth = 1;
            nextTargetDay = 28;
          }
        }
        nextBday = new Date(nextYear, nextTargetMonth, nextTargetDay);
      }

      const daysUntil = differenceInCalendarDays(nextBday, todayAtMidnight);
      const age = nextBday.getFullYear() - birthYear;

      let alertLevel: BirthdayAlert['alertLevel'] = 'upcoming';
      if (daysUntil === 0) alertLevel = 'today';
      else if (daysUntil === 1) alertLevel = 'tomorrow';
      else if (daysUntil <= 3) alertLevel = 'soon';

      alerts.push({
        patientId: patient.id,
        patientName: patient.name,
        birthDate: patient.birthDate,
        phone: patient.phone,
        whatsapp: patient.whatsapp || patient.phone,
        nextBirthday: format(nextBday, "dd 'de' MMMM", { locale: ptBR }),
        daysUntil,
        age,
        alertLevel,
      });
    } catch (e) {
      console.error('Error calculating birthday for', patient.name, e);
    }
  }

  // Sort by closest birthday
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Generate WhatsApp message URL
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Check if an appointment causes schedule conflict
 */
export function checkScheduleConflict(
  existingAppointments: Appointment[],
  newAppt: {
    id?: string;
    professionalId: string;
    date: string;
    startTime: string; // "08:00"
    durationMinutes: number;
  }
): { hasConflict: boolean; conflictingWith?: Appointment } {
  const [newH, newM] = newAppt.startTime.split(':').map(Number);
  const newStartMinutes = newH * 60 + newM;
  const newEndMinutes = newStartMinutes + newAppt.durationMinutes;

  for (const appt of existingAppointments) {
    if (appt.id === newAppt.id) continue;
    if (appt.professionalId !== newAppt.professionalId) continue;
    if (appt.date !== newAppt.date) continue;
    if (appt.status === 'cancelado' || appt.status === 'reagendado') continue;

    const [h, m] = appt.startTime.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + (appt.durationMinutes || 50);

    // Overlap condition: start1 < end2 && end1 > start2
    if (newStartMinutes < endMinutes && newEndMinutes > startMinutes) {
      return { hasConflict: true, conflictingWith: appt };
    }
  }

  return { hasConflict: false };
}

/**
 * Convert data array to CSV string
 */
export function exportToCSV<T extends Record<string, any>>(data: T[], filename: string): void {
  if (!data.length) return;
  // ";" is the separator Excel expects in pt-BR locales (where "," is the decimal mark)
  const SEP = ';';
  const headers = Object.keys(data[0]);
  const rows = data.map((obj) =>
    headers
      .map((header) => {
        const val = obj[header];
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      })
      .join(SEP)
  );

  // Blob instead of an encodeURI'd data: URL \u2014 a "#" in any cell used to truncate the file
  const blob = new Blob(['\uFEFF' + [headers.join(SEP), ...rows].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Safely copy text to clipboard with fallback for iframes
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.warn('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Print only the given document (default: the open .print-area).
 * `title` becomes the suggested file name when the user picks "Salvar como PDF".
 */
export async function printElement(element?: Element | null, title?: string): Promise<void> {
  const source = element || document.querySelector('.print-area');
  if (!source) {
    window.print();
    return;
  }
  const root = document.createElement('div');
  root.className = 'print-root';
  root.appendChild(source.cloneNode(true));
  document.body.appendChild(root);

  // wait for images (exercise frames) so they appear in the PDF
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );

  const previousTitle = document.title;
  if (title) document.title = title;
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    document.title = previousTitle;
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/**
 * Open external link safely without violating iframe window.open restrictions
 */
export function openExternalLink(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
