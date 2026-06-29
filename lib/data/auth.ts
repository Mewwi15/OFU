/**
 * Auth repository — the seam between the app and Supabase Auth + identity RPCs.
 * Stores/screens call these functions; only this module (and lib/supabase)
 * touch `supabase` directly. See docs/11 §3 (repository seam) / §6 (auth slice).
 */

import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

export type Profile = {
  id: string;
  displayName: string;
  /** E.164 without '+', e.g. "66812345678". */
  phone: string;
  email: string;
  avatarPath: string | null;
};

/** Thai 10-digit local number (081-234-5678 → 0812345678) → E.164 "66812345678". */
export function toE164Thai(localDigits: string): string {
  const d = localDigits.replace(/\D/g, '').replace(/^0/, '');
  return `66${d}`;
}

export const authRepo = {
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** Subscribe to sign-in/out; returns an unsubscribe fn. */
  onAuthChange(cb: (session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },

  async startPhoneOtp(phoneE164: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
    if (error) throw error;
  },

  async verifyPhoneOtp(phoneE164: string, code: string): Promise<Session> {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneE164,
      token: code,
      type: 'sms',
    });
    if (error) throw error;
    if (!data.session) throw new Error('NO_SESSION');
    return data.session;
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /** Load the app_users profile row for the signed-in user (RLS → own row). */
  async fetchProfile(): Promise<Profile | null> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await supabase
      .from('app_users')
      .select('id, display_name, email, avatar_path')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    return {
      id: auth.user.id,
      displayName: data?.display_name ?? '',
      phone: auth.user.phone ?? '',
      email: data?.email ?? auth.user.email ?? '',
      avatarPath: data?.avatar_path ?? null,
    };
  },

  async updateProfile(patch: {
    displayName?: string;
    avatarPath?: string;
    email?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('update_profile', {
      p_display_name: patch.displayName ?? undefined,
      p_avatar_path: patch.avatarPath ?? undefined,
      p_locale: undefined,
    });
    if (error) throw error;
    // Email lives on the auth user (app_users.email is null for phone-OTP signups,
    // so fetchProfile falls back to the auth email and reflects this).
    if (patch.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: patch.email });
      if (emailError) throw emailError;
    }
  },

  async getConsentStatus(): Promise<Record<string, boolean>> {
    const { data, error } = await supabase.rpc('get_consent_status');
    if (error) throw error;
    return (data ?? {}) as Record<string, boolean>;
  },

  async grantConsent(purpose: string, policyVersion?: string): Promise<void> {
    const { error } = await supabase.rpc('grant_consent', {
      p_purpose: purpose,
      p_policy_version: policyVersion ?? undefined,
    });
    if (error) throw error;
  },
};
