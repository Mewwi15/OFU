/**
 * Auth repository — the seam between the app and Supabase Auth + identity RPCs.
 * Stores/screens call these functions; only this module (and lib/supabase)
 * touch `supabase` directly. See docs/11 §3 (repository seam) / §6 (auth slice).
 */

import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase/client';

// Lets the auth browser tab close itself and hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

/** The signed-in identity (for the account screen). */
export type AccountIdentity = {
  id: string;
  /** 'google' | 'phone' | … (auth provider used to sign in). */
  provider: string;
  email: string | null;
  phone: string | null;
};

export async function getAccountIdentity(): Promise<AccountIdentity | null> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  return {
    id: u.id,
    provider: (u.app_metadata?.provider as string) ?? 'phone',
    email: u.email ?? null,
    phone: u.phone ?? null,
  };
}

/** PDPA erasure: anonymize the account on the backend, then sign out. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

/** OAuth providers Supabase supports natively (LINE needs a custom flow). */
export type OAuthProvider = 'google' | 'apple';

/**
 * Social sign-in via Supabase OAuth (PKCE). Opens the provider in an auth
 * browser session, then exchanges the returned code for a session. The auth
 * store's onAuthStateChange picks the session up and flips the gate.
 * Returns false if the user dismissed the browser.
 *
 * Requires the provider to be enabled in Supabase with its keys, and the
 * redirect URL (myrnapp://auth-callback) to be allow-listed.
 */
export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('NO_OAUTH_URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return false; // dismissed

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
    return true;
  }
  // Fallback: implicit flow returns tokens in the URL hash fragment.
  const params = new URLSearchParams(result.url.split('#')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) throw setErr;
    return true;
  }
  return false;
}

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
