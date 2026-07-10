/**
 * Auth store (zustand) — backed by Supabase Auth via the auth repository.
 *
 * `status`/`user` derive from the Supabase session (persisted by supabase-js in
 * AsyncStorage), not from this store. `initialize()` hydrates the current
 * session and subscribes to sign-in/out; it's called once from the root layout,
 * which also gates `ready` on `hydrated` so the auth gate doesn't flash. Login
 * happens via phone OTP (startPhoneOtp → verifyPhoneOtp); the subscription then
 * flips `status` and the gate routes into the app.
 */

import { create } from 'zustand';

import { authRepo, reactivateIfNeeded, type Profile } from '@/lib/data/auth';

export type AuthUser = {
  name: string;
  /** Display phone, e.g. "+66812345678". */
  phone: string;
  email: string;
  avatar: string;
};

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

// Empty → the UI falls back to the bundled default avatar (see lib/avatar.ts).
const FALLBACK_AVATAR = '';
const GUEST: AuthUser = { name: 'คุณอู้ฟู่', phone: '', email: '', avatar: FALLBACK_AVATAR };

function toUser(p: Profile | null): AuthUser {
  if (!p) return GUEST;
  return {
    name: p.displayName || GUEST.name,
    phone: p.phone ? `+${p.phone}` : '',
    email: p.email,
    avatar: p.avatarPath ?? FALLBACK_AVATAR,
  };
}

export type AuthState = {
  status: AuthStatus;
  /** Initial session hydration finished (root layout gates `ready` on this). */
  hydrated: boolean;
  /** Supabase auth user id of the signed-in account (null when signed out). */
  userId: string | null;
  user: AuthUser;
  /** Hydrate the session + subscribe to auth changes (call once on startup). */
  initialize: () => void;
  /** Send a phone OTP (phone in E.164 without '+', e.g. "66812345678"). */
  startPhoneOtp: (phoneE164: string) => Promise<void>;
  /** Verify the OTP; the auth subscription flips status on success. */
  verifyPhoneOtp: (phoneE164: string, code: string) => Promise<void>;
  /** Register with email + password. needsVerify=true → a code was emailed. */
  signUpEmail: (email: string, password: string) => Promise<{ needsVerify: boolean }>;
  /** Confirm signup with the emailed 6-digit code; subscription flips status. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /** Sign in with email + password; subscription flips status on success. */
  signInEmail: (email: string, password: string) => Promise<void>;
  /** Re-send the signup confirmation code. */
  resendEmailCode: (email: string) => Promise<void>;
  /** Re-fetch the profile row (e.g. after an edit elsewhere). */
  refreshProfile: () => Promise<void>;
  /** Patch the profile (name/avatar persist via RPC; rest optimistic). */
  updateProfile: (patch: Partial<AuthUser>) => Promise<void>;
  /** Sign out and return to the login gate. */
  logout: () => Promise<void>;
};

/** Module-level guard so initialize() subscribes at most once. */
let unsubscribe: (() => void) | null = null;

async function loadUser(): Promise<AuthUser> {
  const profile = await authRepo.fetchProfile().catch(() => null);
  return toUser(profile);
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  hydrated: false,
  userId: null,
  user: GUEST,

  initialize: () => {
    if (unsubscribe) return;

    authRepo
      .getSession()
      .then(async (session) => {
        if (session) {
          set({ status: 'authenticated', userId: session.user.id, user: await loadUser(), hydrated: true });
        } else {
          set({ status: 'unauthenticated', userId: null, user: GUEST, hydrated: true });
        }
      })
      .catch(() => set({ status: 'unauthenticated', userId: null, user: GUEST, hydrated: true }));

    // IMPORTANT: do NOT call other supabase methods synchronously inside the
    // onAuthStateChange callback — it runs under the auth lock and awaiting
    // getUser()/queries there can deadlock (login hangs). Flip status now and
    // defer the profile fetch to a later tick.
    unsubscribe = authRepo.onAuthChange((session) => {
      if (session) {
        set({ status: 'authenticated', userId: session.user.id });
        setTimeout(() => {
          // A fresh sign-in on a "deleted" (deactivated) account reactivates it
          // (proof of identity + intent to return) before the profile loads.
          void reactivateIfNeeded().then(() => loadUser().then((user) => set({ user })));
        }, 0);
      } else {
        set({ status: 'unauthenticated', userId: null, user: GUEST });
      }
    });
  },

  startPhoneOtp: (phoneE164) => authRepo.startPhoneOtp(phoneE164),

  verifyPhoneOtp: async (phoneE164, code) => {
    await authRepo.verifyPhoneOtp(phoneE164, code);
    // onAuthChange flips status → authenticated.
  },

  signUpEmail: (email, password) => authRepo.signUpEmail(email, password),
  verifyEmailCode: async (email, code) => {
    await authRepo.verifyEmailCode(email, code);
    // onAuthChange flips status → authenticated.
  },
  signInEmail: async (email, password) => {
    await authRepo.signInEmail(email, password);
    // onAuthChange flips status → authenticated.
  },
  resendEmailCode: (email) => authRepo.resendEmailCode(email),

  refreshProfile: async () => {
    set({ user: await loadUser() });
  },

  updateProfile: async (patch) => {
    await authRepo.updateProfile({
      displayName: patch.name,
      avatarPath: patch.avatar,
      email: patch.email,
    });
    // Merge only fields we actually persist (name/avatar/email). `phone` is the
    // verified login identity and is not editable here.
    const persisted: Partial<AuthUser> = {};
    if (patch.name !== undefined) persisted.name = patch.name;
    if (patch.avatar !== undefined) persisted.avatar = patch.avatar;
    if (patch.email !== undefined) persisted.email = patch.email;
    set((s) => ({ user: { ...s.user, ...persisted } }));
  },

  logout: async () => {
    await authRepo.signOut();
    set({ status: 'unauthenticated', userId: null, user: GUEST });
  },
}));
