import { clinicStorage } from './storage';
import { toLocalDateKey } from './utils';

/**
 * Patient portal snapshot. It travels compressed inside the link (#/portal/<data>), so it must stay small
 * and carry only what the patient should see: no clinical notes, alerts, CPF or financial details of others.
 */
export interface PortalSnapshot {
  v: 1;
  generatedAt: string;
  expiresAt: string;
  clinic: { name: string; whatsapp: string; phone: string; address: string };
  patient: { firstName: string; sessionsRemaining: number; sessionsTotal: number; sessionsCompleted: number };
  appointments: { date: string; start: string; end: string; professional: string; modality: string; status: string }[];
  plan?: {
    title: string;
    goal: string;
    days: {
      day: string;
      items: { name: string; equipment: string; sets: number; reps: string; springs?: string; obs?: string; gif?: string; image?: string }[];
    }[];
  };
}

const PORTAL_VALID_DAYS = 60;

export function buildPortalSnapshot(patientId: string): PortalSnapshot | null {
  const patient = clinicStorage.getPatientById(patientId);
  if (!patient) return null;
  const settings = clinicStorage.getSettings();
  const today = toLocalDateKey();
  const exercises = clinicStorage.getExercises();
  // only static catalogue media fits in a link (uploaded photos are data: URLs, far too large)
  const isStatic = (url?: string) => !!url && !url.startsWith('data:');

  const appointments = clinicStorage
    .getAppointments()
    .filter((a) => a.patientId === patientId && a.date >= today && (a.status === 'agendado' || a.status === 'confirmado'))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 12)
    .map((a) => ({
      date: a.date,
      start: a.startTime,
      end: a.endTime,
      professional: a.professionalName,
      modality: a.modality,
      status: a.status,
    }));

  const wp = clinicStorage.getWorkoutPlanByPatientId(patientId);
  const plan = wp
    ? {
        title: wp.title,
        goal: wp.professionalGoal,
        days: wp.weeklyDays
          .filter((d) => d.enabled && d.items.length > 0)
          .map((d) => ({
            day: d.day,
            items: d.items.map((it) => {
              const ex = exercises.find((e) => e.id === it.exerciseId);
              return {
                name: it.exerciseName,
                equipment: it.equipment,
                sets: it.sets,
                reps: it.reps,
                springs: it.resistanceSprings || undefined,
                obs: it.observations || undefined,
                gif: isStatic(ex?.gifUrl) ? ex!.gifUrl : undefined,
                image: isStatic(ex?.steps[0]?.imageUrl) ? ex!.steps[0].imageUrl : undefined,
              };
            }),
          })),
      }
    : undefined;

  const expires = new Date();
  expires.setDate(expires.getDate() + PORTAL_VALID_DAYS);

  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
    clinic: { name: settings.clinicName, whatsapp: settings.whatsapp, phone: settings.phone, address: settings.address },
    patient: {
      firstName: patient.name.split(' ')[0],
      sessionsRemaining: patient.sessionsRemaining,
      sessionsTotal: patient.sessionsTotal,
      sessionsCompleted: patient.sessionsCompleted,
    },
    appointments,
    plan,
  };
}

// ---- compact encoding: JSON -> deflate -> base64url

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodePortal(snapshot: PortalSnapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snapshot));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodePortal(data: string): Promise<PortalSnapshot> {
  const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (parsed?.v !== 1) throw new Error('invalid');
  return parsed as PortalSnapshot;
}

export async function buildPortalLink(patientId: string): Promise<string | null> {
  const snapshot = buildPortalSnapshot(patientId);
  if (!snapshot) return null;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/portal/${await encodePortal(snapshot)}`;
}
