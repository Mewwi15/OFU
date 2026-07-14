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

import { authRepo, type Profile } from '@/lib/data/auth';

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
  /** Patch the profile (name/avatar/phone persist via RPC; rest optimistic). */
  updateProfile: (patch: Partial<AuthUser>) => Promise<void>;
  /** Set a new password for the signed-in (email-login) account. */
  changePassword: (newPassword: string) => Promise<void>;
  /** Sign out and return to the login gate. */
  logout: () => Promise<void>;
  /**
   * Set by the root layout's web OAuth-return handler when the Google PKCE
   * exchange fails or the provider redirects back with an error param — the
   * redirect is a full page load (back to `/`), so this is the only way to
   * hand the failure to whatever the login screen re-mounts as. The login
   * screen renders it as a persistent banner and clears it back to null when
   * the user dismisses it or starts a fresh social sign-in attempt.
   */
  socialCallbackError: string | null;
  setSocialCallbackError: (msg: string | null) => void;
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
  socialCallbackError: null,
  setSocialCallbackError: (msg) => set({ socialCallbackError: msg }),

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
          void loadUser().then((user) => set({ user }));
          // PDPA consent on EVERY sign-in path — only the email forms used to
          // grant it, so Google/Apple logins hit CONSENT_REQUIRED at
          // place_order. grant_consent is latest-row-wins; re-granting on
          // each sign-in is harmless.
          void authRepo.grantConsent('data_processing', 'v1').catch(() => {});
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
    // `phone` arrives as E.164 without '+' ("66812345678") or '' to clear;
    // the display form ("+66…") is derived below like toUser() does.
    await authRepo.updateProfile({
      displayName: patch.name,
      avatarPath: patch.avatar,
      email: patch.email,
      phone: patch.phone,
    });
    const persisted: Partial<AuthUser> = {};
    if (patch.name !== undefined) persisted.name = patch.name;
    if (patch.avatar !== undefined) persisted.avatar = patch.avatar;
    if (patch.email !== undefined) persisted.email = patch.email;
    if (patch.phone !== undefined) persisted.phone = patch.phone ? `+${patch.phone}` : '';
    set((s) => ({ user: { ...s.user, ...persisted } }));
  },

  changePassword: (newPassword) => authRepo.changePassword(newPassword),

  logout: async () => {
    await authRepo.signOut();
    set({ status: 'unauthenticated', userId: null, user: GUEST });
  },
}));
