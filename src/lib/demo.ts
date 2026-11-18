import { clinicStorage, SYNCED_KEYS } from './storage';
import { isCloudEnabled } from './cloud';

/**
 * Try-before-signup demo (cloud mode only): the visitor explores the demo clinic for a limited time.
 * Demo data lives only in this browser's local cache; cloud sync is never started, so nothing reaches
 * the real database, and everything is wiped when the demo ends.
 */
export const DEMO_DURATION_MS = 5 * 60 * 1000;
const DEMO_KEY = 'pilatesflow_demo_started_at';

export function getDemoStartedAt(): number | null {
  const raw = localStorage.getItem(DEMO_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export const isDemoActive = () => getDemoStartedAt() !== null;

export function demoRemainingMs(): number {
  const start = getDemoStartedAt();
  return start === null ? 0 : Math.max(0, start + DEMO_DURATION_MS - Date.now());
}

export function startDemo(): void {
  clinicStorage.resetToDemoData(); // no sync hook is active before login, so this stays local
  clinicStorage.setCurrentUserRole('admin');
  localStorage.setItem(DEMO_KEY, String(Date.now()));
  window.location.hash = '#/overview';
  window.location.reload();
}

export function endDemo(): void {
  localStorage.removeItem(DEMO_KEY);
  SYNCED_KEYS.forEach((k) => localStorage.removeItem(k));
  ['pilatesflow_current_user', 'pilatesflow_active_attendance', 'pilatesflow_bday_dismissed_date'].forEach((k) =>
    localStorage.removeItem(k)
  );
  window.location.hash = '';
  window.location.reload();
}

/** Logged-in cloud session (not the local demo and not the cloud-less build) */
export const isCloudSession = () => isCloudEnabled && !isDemoActive();
