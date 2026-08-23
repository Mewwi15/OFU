/**
 * Auth repository — the seam between the app and Supabase Auth + identity RPCs.
 * Stores/screens call these functions; only this module (and lib/supabase)
 * touch `supabase` directly. See docs/11 §3 (repository seam) / §6 (auth slice).
 */

import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
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
 * In-flight/settled PKCE exchanges, keyed by the auth code.
 *
 * A code is single-use. On native the redirect can arrive TWICE — once as the
 * `openAuthSessionAsync` promise resolving, and once as the OS handing the deep
 * link to expo-router (/auth-callback) — and whichever loses would exchange a
 * burnt code and report a failure over a sign-in that actually worked. Both
 * paths go through here, so the second caller awaits the first one's promise
 * instead of racing it: one code, one exchange, one answer.
 *
 * Entries are kept after settling (not deleted): a late duplicate must resolve
 * from the same result rather than re-burn the code. A handful of short strings
 * per app run.
 */
const codeExchanges = new Map<string, Promise<boolean>>();

/**
 * Exchange an OAuth `code` for a session — at most once per code, no matter how
 * many callers ask. Resolves true when a session exists; rejects with Supabase's
 * error if the exchange genuinely failed.
 */
export function exchangeAuthCodeOnce(code: string): Promise<boolean> {
  const existing = codeExchanges.get(code);
  if (existing) return existing;
  const p = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) throw error;
    return true;
  });
  codeExchanges.set(code, p);
  return p;
}

/**
 * Finish an OAuth redirect from its full return URL: prefer the PKCE `code`,
 * fall back to implicit-flow tokens in the hash. Shared by the browser-session
 * path and the /auth-callback route so the parsing rules can't drift apart.
 * Throws the provider's `error` param if the user was bounced back with one.
 */
export async function completeOAuthRedirect(returnUrl: string): Promise<boolean> {
  const url = new URL(returnUrl);
  const providerError = url.searchParams.get('error');
  if (providerError) throw new Error(providerError);

  const code = url.searchParams.get('code');
  if (code) return exchangeAuthCodeOnce(code);

  // Implicit flow returns tokens in the URL hash fragment instead.
  const params = new URLSearchParams(returnUrl.split('#')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return true;
  }
  return false;
}

/**
 * Social sign-in via Supabase OAuth (PKCE). Opens the provider in an auth
 * browser session, then exchanges the returned code for a session. The auth
 * store's onAuthStateChange picks the session up and flips the gate.
 * Returns false if the user dismissed the browser.
 *
 * Requires the provider to be enabled in Supabase with its keys, and the
 * redirect URL (myrnapp://auth-callback) to be allow-listed.
 */
/**
 * Native Google Sign-In (Android) — the OS account sheet, no browser tab, no
 * deep link, no relaunch. This is the root fix for the login that used to
 * crawl (and before the watchdog, hang forever): the Chrome round-trip let
 * Android kill and cold-boot the app mid-login, and supabase-js's auth lock
 * could wedge on the way back in. The native sheet never leaves the process.
 *
 * OTA-safety: this JS also ships to store builds that predate the native
 * module (Android 1.0.1). The require is lazy and failure falls back to the
 * browser flow, so old binaries keep their old behaviour instead of crashing.
 *
 * Server side: Supabase validates the idToken's audience, so the Web client id
 * below must be listed in Supabase → Auth → Providers → Google → Client IDs.
 * (Same trick as Apple's com.oofoo.shop.) The id itself is public by design.
 */
const GOOGLE_WEB_CLIENT_ID =
  '129235146060-0riu39sbql9ocuoffg2dmo3ap96h7c7n.apps.googleusercontent.com';

export type GoogleNativeResult = 'success' | 'cancelled' | 'unavailable';

export async function signInWithGoogleNative(): Promise<GoogleNativeResult> {
  if (Platform.OS !== 'android') return 'unavailable';
  let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: module absent in pre-1.0.2 binaries
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    return 'unavailable'; // old binary without the native module — caller falls back
  }
  try {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type === 'cancelled') return 'cancelled';
    const idToken = res.data?.idToken;
    if (!idToken) throw new Error('NO_ID_TOKEN');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return 'success'; // onAuthStateChange flips the gate like every other sign-in
  } catch (e) {
    const code = (e as { code?: string }).code;
    // User backed out of the sheet — not an error, not a fallback trigger.
    if (code === 'SIGN_IN_CANCELLED' || code === '12501') return 'cancelled';
    // Genuine failure (Play Services missing, audience misconfig, network):
    // let the caller decide; browser flow is the safety net.
    throw e;
  }
}

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

  // Still the primary path — SDK 54 intends the browser session to hand the
  // redirect straight back here. /auth-callback is the fallback for when the OS
  // routes the deep link into expo-router instead (which is what happens on a
  // standalone build), and `completeOAuthRedirect` dedupes the two.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return false; // dismissed

  return completeOAuthRedirect(result.url);
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
/** Outcome of a native Apple sign-in, so the UI can tell a user-cancel apart
 *  from a real failure (and surface a safe code for the latter). */
export type AppleSignInResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'failed'; code: string };

/**
 * A short, token-free code for diagnostics/telemetry. NEVER include the
 * identity token or any credential — only the provider's own error code or a
 * clipped message word, so a failure is reportable without leaking secrets.
 */
function appleDiagnosticCode(e: unknown): string {
  const err = e as { code?: string; status?: number; message?: string } | null;
  if (err?.code) return String(err.code).slice(0, 40);
  if (typeof err?.status === 'number') return `HTTP_${err.status}`;
  const msg = err?.message ?? '';
  // First token of the message, alphanumerics only, capped — no free text/PII.
  return (msg.match(/[A-Za-z0-9_]+/)?.[0] ?? 'UNKNOWN').slice(0, 40);
}

export async function signInWithAppleNative(): Promise<AppleSignInResult> {
  try {
    // Cryptographic nonce (replay protection; GoTrue may also require it):
    // Apple receives SHA-256(rawNonce) baked into the identity token, and
    // Supabase receives the raw value and re-hashes it to verify.
    const bytes = await Crypto.getRandomBytesAsync(16);
    const rawNonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { ok: false, reason: 'failed', code: 'NO_IDENTITY_TOKEN' };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { ok: false, reason: 'failed', code: appleDiagnosticCode(error) };
    if (!data.session) return { ok: false, reason: 'failed', code: 'NO_SESSION' };

    // Apple returns the name ONLY on the first sign-in; a returning user gets
    // null here, which is normal — not a failure. Persist the name once and
    // never overwrite a stored name with a later null.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const hasStoredName = !!(data.user?.user_metadata as { full_name?: string } | undefined)?.full_name;
    if (name && !hasStoredName) {
      await supabase.auth.updateUser({ data: { full_name: name } }).catch(() => {
        /* name is a nicety; a failed metadata write must not fail the sign-in */
      });
    }
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'failed', code: appleDiagnosticCode(e) };
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
