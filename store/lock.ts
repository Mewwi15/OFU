/**
 * App-lock store (zustand).
 *
 * Drives the three entry states beyond plain auth:
 *  - onboarding  — has the user seen the Get Started intro? (first launch)
 *  - app lock    — a 6-digit PIN (+ optional biometric) that gates the app on
 *                  every cold start / return-from-background for a known account
 *
 * The PIN lives in the OS keychain via expo-secure-store (hardware-encrypted);
 * the non-secret flags live in AsyncStorage. State is hydrated manually on
 * startup (`hydrate`) since SecureStore is async — the root layout holds the
 * splash until `hydrated` is true. Frontend-first: the PIN is verified locally;
 * a server-side check can slot in behind `verifyPin` later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const PIN_KEY = 'oofoo-pin';
const ONBOARDED_KEY = 'oofoo-onboarded';
const BIOMETRIC_KEY = 'oofoo-biometric';
/** auth user id the stored PIN belongs to (PIN is per-account, not per-device). */
const PIN_OWNER_KEY = 'oofoo-pin-owner';

export const PIN_LENGTH = 6;

export type LockState = {
  /** True once startup hydration from storage has finished. */
  hydrated: boolean;
  /** Has the user completed the Get Started intro? */
  onboarded: boolean;
  /** Is an app-lock PIN set? */
  hasPin: boolean;
  /** Has the user opted into biometric unlock? */
  biometricEnabled: boolean;
  /** Is the app currently locked (PIN required to proceed)? */
  locked: boolean;

  hydrate: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Persist a new PIN and leave the app unlocked. */
  setPin: (pin: string) => Promise<void>;
  /** Compare an entered PIN against the stored one; unlocks on match. */
  verifyPin: (pin: string) => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  /** Mark the app unlocked (e.g. after a successful biometric prompt). */
  unlock: () => void;
  /** Re-lock the app (e.g. on return from background). */
  lock: () => void;
  /** Clear PIN + biometric (on sign-out). Onboarding stays done. */
  resetLock: () => Promise<void>;
  /**
   * Bind the stored PIN to the signed-in account. If the device holds a PIN
   * set by a DIFFERENT (or unknown) account, clear it so the new account gets
   * the setup flow instead of a lock screen it can never pass. Call whenever
   * the authenticated user id becomes known.
   */
  ensurePinOwner: (userId: string) => Promise<void>;
};

async function readPin(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_KEY);
  } catch {
    return null;
  }
}

export const useLock = create<LockState>((set, get) => ({
  hydrated: false,
  onboarded: false,
  hasPin: false,
  biometricEnabled: false,
  locked: false,

  hydrate: async () => {
    const [onboarded, biometric, pin] = await Promise.all([
      AsyncStorage.getItem(ONBOARDED_KEY),
      AsyncStorage.getItem(BIOMETRIC_KEY),
      readPin(),
    ]);
    const hasPin = pin != null && pin.length > 0;
    set({
      hydrated: true,
      onboarded: onboarded === '1',
      biometricEnabled: biometric === '1',
      hasPin,
      // A known account starts locked until the PIN / biometric is cleared.
      locked: hasPin,
    });
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    set({ onboarded: true });
  },

  setPin: async (pin) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
    set({ hasPin: true, locked: false });
  },

  verifyPin: async (pin) => {
    const stored = await readPin();
    const ok = stored != null && stored === pin;
    if (ok) set({ locked: false });
    return ok;
  },

  setBiometricEnabled: async (enabled) => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? '1' : '0');
    set({ biometricEnabled: enabled });
  },

  unlock: () => set({ locked: false }),

  lock: () => {
    if (get().hasPin) set({ locked: true });
  },

  resetLock: async () => {
    await SecureStore.deleteItemAsync(PIN_KEY).catch(() => {});
    await AsyncStorage.setItem(BIOMETRIC_KEY, '0');
    set({ hasPin: false, biometricEnabled: false, locked: false });
  },

  ensurePinOwner: async (userId) => {
    const owner = await AsyncStorage.getItem(PIN_OWNER_KEY);
    if (owner === userId) return;
    // Signing in already proved identity — a leftover PIN from another account
    // (e.g. the phone-OTP era, or a shared device) must not lock this one out.
    if (get().hasPin) await get().resetLock();
    await AsyncStorage.setItem(PIN_OWNER_KEY, userId);
  },
}));
