/**
 * Auth store (zustand).
 *
 * Holds the signed-in customer and the auth status that gates the whole app
 * (see the auth guard in `app/_layout.tsx`). Frontend-first: `login` accepts a
 * partial profile and seeds sensible defaults — no real OTP/social auth yet; the
 * backend (Supabase Auth: phone OTP + LINE/Apple/Google) lands later behind this
 * same interface.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type AuthUser = {
  name: string;
  /** Thai mobile number, display-formatted (e.g. "081-234-5678"). */
  phone: string;
  email: string;
  avatar: string;
};

export type AuthStatus = 'unauthenticated' | 'authenticated';

/** Profile used to seed a freshly signed-in user (mock). */
const DEFAULT_USER: AuthUser = {
  name: 'คุณอู้ฟู่',
  phone: '',
  email: '',
  avatar: 'https://i.pravatar.cc/300?img=47',
};

export type AuthState = {
  status: AuthStatus;
  user: AuthUser;
  /** Sign in, merging any known fields (e.g. the phone from OTP) over defaults. */
  login: (patch?: Partial<AuthUser>) => void;
  /** Patch the signed-in profile (edit profile screen). */
  updateProfile: (patch: Partial<AuthUser>) => void;
  /** Sign out and return to the login gate. */
  logout: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      status: 'unauthenticated',
      user: DEFAULT_USER,

      login: (patch) =>
        set({ status: 'authenticated', user: { ...DEFAULT_USER, ...patch } }),

      updateProfile: (patch) =>
        set((state) => ({ user: { ...state.user, ...patch } })),

      logout: () => set({ status: 'unauthenticated', user: DEFAULT_USER }),
    }),
    {
      name: 'oofoo-auth',
      storage: zustandStorage,
      partialize: (state) => ({ status: state.status, user: state.user }),
    },
  ),
);
