/**
 * Auth repository — the seam between the app and Supabase Auth + identity RPCs.
 * Stores/screens call these functions; only this module (and lib/supabase)
 * touch `supabase` directly. See docs/11 §3 (repository seam) / §6 (auth slice).
 */

import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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

// Self-service account deletion was removed (owner decision 2026-07-10):
// the app offers sign-out only; PDPA deletion requests are handled by the shop
// directly. The delete_my_account/reactivate_my_account RPCs were dropped (0040).

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
  if (Platform.OS === 'web') {
    // Full-page redirect; on return detectSessionInUrl completes the PKCE
    // exchange and onAuthStateChange flips the gate. The origin must be in
    // Supabase's Redirect URLs allowlist.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return true; // the page is navigating away
  }

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

/**
 * Native Sign in with Apple (iOS only) — App Store guideline 4.8 requires it
 * alongside Google login. Uses the OS account sheet, then exchanges the
 * identity token directly (signInWithIdToken — no browser and no nonce; the
 * nonce is only for the web JS flow per Supabase's Apple guide). The auth
 * store's onAuthStateChange picks up the session like every other sign-in.
 * Requires the bundle id (com.oofoo.shop) in the Apple provider's Client IDs
 * in Supabase. Returns false if the user dismissed the sheet.
 */
export async function signInWithAppleNative(): Promise<boolean> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('NO_IDENTITY_TOKEN');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false; // user dismissed
    throw e;
  }
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
  onAuthChange(cb: (session: Session | null, event: string) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => cb(session, event));
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

  /** Register with email + password. Returns needsVerify=true when the project
   *  requires email confirmation (no session yet → a 6-digit code was emailed). */
  async signUpEmail(email: string, password: string): Promise<{ needsVerify: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw error;
    return { needsVerify: !data.session };
  },

  /** Confirm a signup with the 6-digit code sent to the email. */
  async verifyEmailCode(email: string, code: string): Promise<Session> {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    if (error) throw error;
    if (!data.session) throw new Error('NO_SESSION');
    return data.session;
  },

  /** Sign in an existing account with email + password. */
  async signInEmail(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  },

  /** Re-send the signup confirmation code. */
  async resendEmailCode(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /** Set a new password on the signed-in account (email-login only). */
  async changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  /** Load the app_users profile row for the signed-in user (RLS → own row). */
  async fetchProfile(): Promise<Profile | null> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await supabase
      .from('app_users')
      .select('id, display_name, email, phone, avatar_path')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    return {
      id: auth.user.id,
      displayName: data?.display_name ?? '',
      // Contact phone (editable) wins; phone-login users fall back to the
      // auth phone (same E.164-without-'+' format).
      phone: data?.phone ?? auth.user.phone ?? '',
      email: data?.email ?? auth.user.email ?? '',
      avatarPath: data?.avatar_path ?? null,
    };
  },

  async updateProfile(patch: {
    displayName?: string;
    avatarPath?: string;
    email?: string;
    /** E.164 without '+' ("66812345678"); '' clears the contact phone. */
    phone?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('update_profile', {
      p_display_name: patch.displayName ?? undefined,
      p_avatar_path: patch.avatarPath ?? undefined,
      p_locale: undefined,
      p_phone: patch.phone ?? undefined,
    });
    if (error) throw error;
    // Email lives on the auth user (app_users.email is null for phone-OTP signups,
    // so fetchProfile falls back to the auth email and reflects this).
    if (patch.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: patch.email });
      if (emailError) throw emailError;
    }
  },

  /** Is a LINE account linked to the signed-in user (order notifications)? */
  async getLineLinked(): Promise<boolean> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;
    const { data } = await supabase
      .from('app_users')
      .select('line_user_id')
      .eq('id', auth.user.id)
      .maybeSingle();
    return !!data?.line_user_id;
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

  async withdrawConsent(purpose: string): Promise<void> {
    const { error } = await supabase.rpc('withdraw_consent', { p_purpose: purpose });
    if (error) throw error;
  },
};
