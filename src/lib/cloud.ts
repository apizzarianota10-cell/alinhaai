import { createClient, SupabaseClient, Session, RealtimeChannel } from '@supabase/supabase-js';
import { applyRemoteSnapshot, readLocalSnapshot, setRemoteWriteHook, SYNCED_KEYS } from './storage';
import {
  DEFAULT_SETTINGS,
  INITIAL_EXERCISES,
  INITIAL_PLANS,
} from './constants';
import { UserRole } from '../types';

/**
 * Cloud mode (Supabase): enabled when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 * Without them the app keeps working as a local demo (data only in this browser).
 *
 * The app keeps reading/writing localStorage synchronously; this module mirrors every write of a
 * shared key to the `clinic_state` table and applies changes made on other computers in real time.
 * Conflict policy: last write per key wins.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudEnabled = !!(url && anonKey && !url.includes('sua-instancia'));
export const supabase: SupabaseClient | null = isCloudEnabled ? createClient(url!, anonKey!) : null;

export interface Membership {
  clinicId: string;
  clinicName: string;
  role: UserRole;
  displayName: string;
  email: string;
}

const CURRENT_USER_KEY = 'pilatesflow_current_user';
const PENDING_RETRY_MS = 10_000;

let channel: RealtimeChannel | null = null;
let activeClinicId: string | null = null;
let myUserId: string | null = null;
const pending = new Map<string, unknown>();
let flushTimer: number | null = null;
let retryTimer: number | null = null;

type SyncStatus = 'synced' | 'saving' | 'offline';
let status: SyncStatus = 'synced';
const statusListeners = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  statusListeners.forEach((l) => l(s));
};
export const getSyncStatus = () => status;
export function onSyncStatus(listener: (s: SyncStatus) => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

async function flush() {
  flushTimer = null;
  if (!supabase || !activeClinicId || pending.size === 0) return;
  const rows = Array.from(pending.entries()).map(([key, value]) => ({
    clinic_id: activeClinicId,
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: myUserId,
  }));
  const batch = new Map(pending);
  pending.clear();
  setStatus('saving');
  const { error } = await supabase.from('clinic_state').upsert(rows);
  if (error) {
    // keep the newest value for each key and try again later
    batch.forEach((v, k) => !pending.has(k) && pending.set(k, v));
    setStatus('offline');
    if (!retryTimer) {
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        flush();
      }, PENDING_RETRY_MS);
    }
    return;
  }
  setStatus(pending.size ? 'saving' : 'synced');
  if (pending.size) scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) window.clearTimeout(flushTimer);
  // short debounce: typing in a form produces one upload, not one per keystroke
  flushTimer = window.setTimeout(flush, 400);
}

window.addEventListener('online', () => pending.size && flush());
window.addEventListener('beforeunload', (e) => {
  if (pending.size) {
    flush();
    e.preventDefault();
  }
});

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(translateAuthError(error.message));
  return { needsConfirmation: !data.session };
}

export async function updatePassword(password: string) {
  const { error } = await supabase!.auth.updateUser({ password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signOut() {
  await flush();
  stopSync();
  await supabase?.auth.signOut();
  // don't leave patient data behind on a shared computer
  SYNCED_KEYS.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem('pilatesflow_active_attendance');
}

export async function getMemberships(): Promise<Membership[]> {
  const session = await getSession();
  if (!supabase || !session) return [];
  const { data, error } = await supabase
    .from('clinic_members')
    .select('clinic_id, role, display_name, email, clinics(name)')
    .eq('user_id', session.user.id);
  if (error) throw new Error(error.message);
  return (data || []).map((m: any) => ({
    clinicId: m.clinic_id,
    clinicName: m.clinics?.name || 'Clínica',
    role: m.role,
    displayName: m.display_name,
    email: m.email,
  }));
}

/** Creates a clinic. `importLocal` uploads this browser's data; otherwise it starts empty (catalogue kept). */
export async function createClinic(clinicName: string, adminName: string, importLocal: boolean): Promise<string> {
  const session = await getSession();
  const { data, error } = await supabase!.rpc('create_clinic', { clinic_name: clinicName, admin_name: adminName });
  if (error) throw new Error(error.message);
  const clinicId = data as string;

  const snapshot: Record<string, unknown> = importLocal
    ? readLocalSnapshot()
    : {
        pilatesflow_patients: [],
        pilatesflow_appointments: [],
        pilatesflow_charges: [],
        pilatesflow_expenses: [],
        pilatesflow_workout_plans: [],
        pilatesflow_clinical_records: {},
        pilatesflow_attendances: [],
        pilatesflow_presence: [],
        pilatesflow_evaluation_templates: [],
        pilatesflow_evaluations: [],
        pilatesflow_plans: INITIAL_PLANS,
        pilatesflow_exercises: INITIAL_EXERCISES,
        pilatesflow_professionals: [
          {
            id: session!.user.id,
            name: adminName,
            email: session!.user.email || '',
            phone: '',
            specialty: 'Fisioterapeuta',
            councilRegistration: '',
            role: 'admin',
            status: 'ativo',
            color: '#426B5B',
            availableDays: [1, 2, 3, 4, 5],
            workingHours: { start: '07:00', end: '19:00' },
          },
        ],
      };
  const settings = (snapshot.pilatesflow_settings as object) || DEFAULT_SETTINGS;
  snapshot.pilatesflow_settings = { ...settings, clinicName };

  const rows = Object.entries(snapshot).map(([key, value]) => ({
    clinic_id: clinicId,
    key,
    value,
    updated_by: session!.user.id,
  }));
  const { error: upErr } = await supabase!.from('clinic_state').upsert(rows);
  if (upErr) throw new Error(upErr.message);
  return clinicId;
}

/** Loads the clinic data into the local cache and starts two-way sync */
export async function startSync(membership: Membership): Promise<void> {
  const session = await getSession();
  if (!supabase || !session) throw new Error('Sessão expirada');
  myUserId = session.user.id;
  activeClinicId = membership.clinicId;

  const { data, error } = await supabase.from('clinic_state').select('key, value').eq('clinic_id', membership.clinicId);
  if (error) throw new Error(error.message);
  const snapshot: Record<string, unknown> = {};
  (data || []).forEach((row: any) => (snapshot[row.key] = row.value));
  // keys missing in the cloud start empty — never fall back to another clinic's or the demo's data
  const emptyDefaults: Record<string, unknown> = {
    pilatesflow_patients: [],
    pilatesflow_professionals: [],
    pilatesflow_appointments: [],
    pilatesflow_charges: [],
    pilatesflow_expenses: [],
    pilatesflow_workout_plans: [],
    pilatesflow_clinical_records: {},
    pilatesflow_attendances: [],
    pilatesflow_presence: [],
    pilatesflow_evaluation_templates: [],
    pilatesflow_evaluations: [],
    pilatesflow_plans: INITIAL_PLANS,
    pilatesflow_exercises: INITIAL_EXERCISES,
    pilatesflow_settings: { ...DEFAULT_SETTINGS, clinicName: membership.clinicName },
  };
  SYNCED_KEYS.forEach((k) => {
    if (!(k in snapshot)) snapshot[k] = emptyDefaults[k];
  });

  localStorage.setItem(
    CURRENT_USER_KEY,
    JSON.stringify({ id: session.user.id, name: membership.displayName, email: membership.email, role: membership.role })
  );
  applyRemoteSnapshot(snapshot);

  setRemoteWriteHook((key, value) => {
    pending.set(key, value);
    setStatus('saving');
    scheduleFlush();
  });

  channel?.unsubscribe();
  channel = supabase
    .channel(`clinic-${membership.clinicId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clinic_state', filter: `clinic_id=eq.${membership.clinicId}` },
      (payload: any) => {
        const row = payload.new;
        if (!row?.key || row.updated_by === myUserId || pending.has(row.key)) return;
        applyRemoteSnapshot({ [row.key]: row.value });
      }
    )
    .subscribe();
}

export function stopSync() {
  setRemoteWriteHook(null);
  channel?.unsubscribe();
  channel = null;
  activeClinicId = null;
  pending.clear();
}

export const getActiveClinicId = () => activeClinicId;

export async function listMembers(clinicId: string) {
  const { data, error } = await supabase!
    .from('clinic_members')
    .select('user_id, role, display_name, email')
    .eq('clinic_id', clinicId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as { user_id: string; role: UserRole; display_name: string; email: string }[];
}

export async function addMember(clinicId: string, email: string, role: UserRole, name: string) {
  const { error } = await supabase!.rpc('add_clinic_member', {
    cid: clinicId,
    member_email: email,
    member_role: role,
    member_name: name,
  });
  if (error) {
    if (error.message.includes('USER_NOT_FOUND')) {
      throw new Error('Nenhuma conta com este e-mail. Peça para a pessoa criar a conta na tela de login primeiro.');
    }
    throw new Error(error.message);
  }
}

export async function removeMember(clinicId: string, userId: string) {
  const { error } = await supabase!.from('clinic_members').delete().eq('clinic_id', clinicId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('already registered')) return 'Já existe uma conta com este e-mail. Use "Entrar".';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  return message;
}
