/**
 * Web-only session inactivity guard.
 *
 * On native, the PIN lock re-challenges after backgrounding. On web there is
 * no PIN — expo-secure-store has no web backend (see app/_layout.tsx's
 * `lockSupported = Platform.OS !== 'web'`) — so a signed-in session just sits
 * in localStorage indefinitely (Supabase's own refresh token keeps it alive
 * far longer than any single visit). On a shared/public computer that means
 * whoever uses the browser next inherits the previous customer's account,
 * addresses, and order history. This is a separate, purely web-side control:
 * sign out after a period with no real interaction.
 */
import { Platform } from 'react-native';

const LAST_ACTIVE_KEY = 'oofoo-web-last-active-at';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000;

function markActive() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable (private mode) — guard just never fires, fails open */
  }
}

function idleForTooLong(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) > IDLE_TIMEOUT_MS;
  } catch {
    return false;
  }
}

/**
 * Wires activity tracking (pointer/keyboard resets the clock) + a periodic +
 * tab-refocus idle check. Call once from the root layout (web only) —
 * no-ops on native. Returns a cleanup function.
 *
 * Deliberately does NOT call markActive() on install. The root layout
 * reinstalls this whenever `isAuthed` changes (auth resolves asynchronously,
 * so the very first install always runs before we know if there's really a
 * session to protect) — if install itself reset the clock, the *first*,
 * not-yet-authenticated install would stamp "now" over the evidence of a
 * long-idle previous session, and the *second* install (once we actually
 * know the user is authenticated) would then read back a falsely-fresh
 * timestamp it had no chance to check. Resetting the clock is caller-driven
 * instead (real interaction, or explicitly via markWebActive() right after
 * a confirmed sign-in) — see app/_layout.tsx.
 */
export function installWebIdleGuard(onIdle: () => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  // Report staleness from whatever timestamp already exists, untouched —
  // a closed-then-reopened tab (or a computer waking from sleep) is exactly
  // the shared-computer case this guards against.
  if (idleForTooLong()) onIdle();

  const onActivity = () => markActive();
  const check = () => {
    if (idleForTooLong()) onIdle();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') check();
  };

  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Catches "left the tab open and visible but walked away" — visibilitychange
  // alone only fires on tab-switch/return, not on a still-focused idle tab.
  const interval = window.setInterval(check, CHECK_INTERVAL_MS);

  return () => {
    window.removeEventListener('pointerdown', onActivity);
    window.removeEventListener('keydown', onActivity);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.clearInterval(interval);
  };
}

/** Explicitly reset the activity clock — call right after a confirmed sign-in. */
export function markWebActive(): void {
  markActive();
}
