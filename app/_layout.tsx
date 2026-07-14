import {
  Mitr_300Light,
  Mitr_400Regular,
  Mitr_500Medium,
  Mitr_600SemiBold,
  useFonts,
} from '@expo-google-fonts/mitr';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteShell } from '@/components/web/SiteShell';
import { supabase } from '@/lib/supabase/client';
import { ThemeProvider } from '@/theme/theme-provider';
import '@/lib/webAlertPolyfill';
import '@/lib/webFocusStyle';
import { useAuth } from '@/store/auth';
import { useLock } from '@/store/lock';

// Keep the splash screen visible until the fonts have loaded.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Re-lock grace period. Locking on EVERY background made in-app detours
 * require the PIN again: the image picker (slip/avatar) and the Google OAuth
 * browser both background the app for a few seconds.
 */
const LOCK_GRACE_MS = 2 * 60 * 1000;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Mitr_300Light,
    Mitr_400Regular,
    Mitr_500Medium,
    Mitr_600SemiBold,
  });

  // Auth + app-lock state drive a declarative gate (no imperative navigation,
  // so we never hit the "navigate before mounting" race). Exactly one of the
  // guarded blocks below is active at a time.
  const isAuthed = useAuth((s) => s.status === 'authenticated');
  const authHydrated = useAuth((s) => s.hydrated);
  const userId = useAuth((s) => s.userId);
  const initAuth = useAuth((s) => s.initialize);
  const hydrated = useLock((s) => s.hydrated);
  const onboarded = useLock((s) => s.onboarded);
  const hasPin = useLock((s) => s.hasPin);
  const locked = useLock((s) => s.locked);
  const hydrate = useLock((s) => s.hydrate);
  const lock = useLock((s) => s.lock);
  const ensurePinOwner = useLock((s) => s.ensurePinOwner);

  // Hydrate persisted lock state + Supabase auth session once on startup.
  useEffect(() => {
    hydrate();
    initAuth();
  }, [hydrate, initAuth]);

  // Web: complete the Google OAuth PKCE return manually (detectSessionInUrl
  // is off so it can't swallow LINE's ?code= — see lib/supabase/client.ts).
  // LINE's callback path handles its own code. Google redirects back to the
  // site origin (not a dedicated route), so on any failure — cancelled
  // consent, a rejected exchange — there's no screen of our own to show an
  // error on; stash it in the auth store and let the login screen (which is
  // what re-mounts, since the user isn't authenticated yet) surface it once.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (window.location.pathname.startsWith('/line-callback')) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    // `error` is the OAuth2 machine code ('access_denied', ...); `error_description`
    // is a freeform human string — only `error` is safe to compare against.
    const errorCode = params.get('error');
    if (!code && !errorCode) return;

    const fail = () =>
      useAuth.getState().setSocialCallbackError(errorCode === 'access_denied' ? 'GOOGLE_CANCELLED' : 'GOOGLE_FAILED');

    void (async () => {
      try {
        if (errorCode) {
          fail();
          return;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code!);
        if (error) fail();
      } catch {
        fail();
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
  }, []);

  // Web: a tab from a previous deploy requests route chunks that no longer
  // exist (hashed filenames change per deploy) and dies with a white screen.
  // Metro loads async chunks via <script> tags, so the failure surfaces as an
  // UNCAUGHT ERROR ("Requiring unknown module …" / "Unexpected token '<'"),
  // not only as a rejected dynamic import — listen on both channels and
  // reload once to pick up the fresh index.html.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const STALE_RE =
      /Requiring unknown module|Unexpected token '<'|dynamically imported module|Importing a module script|ChunkLoadError/i;
    const reloadOnce = (msg: string) => {
      if (!STALE_RE.test(msg)) return;
      if (sessionStorage.getItem('oofoo-chunk-reload') === '1') return; // avoid loops
      sessionStorage.setItem('oofoo-chunk-reload', '1');
      location.reload();
    };
    const onRejection = (e: PromiseRejectionEvent) =>
      reloadOnce(String((e.reason as { message?: string })?.message ?? e.reason ?? ''));
    const onError = (e: ErrorEvent) => reloadOnce(String(e.message ?? ''));
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    // A successful boot means the current bundle is live — arm the guard again.
    sessionStorage.removeItem('oofoo-chunk-reload');
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  // The PIN belongs to an account, not the device: if another account's PIN is
  // still stored here (account switch / phone-OTP era), clear it so this
  // account gets the setup flow instead of a lock it can never pass.
  useEffect(() => {
    if (userId && hydrated) void ensurePinOwner(userId);
  }, [userId, hydrated, ensurePinOwner]);

  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away > LOCK_GRACE_MS) lock();
      }
    });
    return () => sub.remove();
  }, [lock]);

  const ready = (loaded || error) && hydrated && authHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  // The PIN app-lock rides on the OS keychain (expo-secure-store), which has
  // no web backend — on web the browser session is the lock, so skip it.
  const lockSupported = Platform.OS !== 'web';
  const showOnboarding = !onboarded;
  const showLogin = onboarded && !isAuthed;
  const showSetup = onboarded && isAuthed && lockSupported && !hasPin;
  const showLock = onboarded && isAuthed && lockSupported && hasPin && locked;
  const showApp = onboarded && isAuthed && (!lockSupported || (hasPin && !locked));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SiteShell>
          <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={showOnboarding}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>

            <Stack.Protected guard={showLogin}>
              <Stack.Screen name="login" />
            </Stack.Protected>

            <Stack.Protected guard={showSetup}>
              <Stack.Screen name="lock/setup" />
            </Stack.Protected>

            <Stack.Protected guard={showLock}>
              <Stack.Screen name="lock/index" />
            </Stack.Protected>

            <Stack.Protected guard={showApp}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[id]" />
              <Stack.Screen name="address/index" />
              <Stack.Screen name="address/picker" />
              <Stack.Screen name="checkout/index" />
              <Stack.Screen name="order/[id]" />
              <Stack.Screen name="chat" />
              <Stack.Screen name="account/edit" />
              <Stack.Screen name="account/password" />
              <Stack.Screen name="account/settings" />
              <Stack.Screen name="account/language" />
              <Stack.Screen name="account/legal" />
              <Stack.Screen name="notifications" />
            </Stack.Protected>

            {/* Outside the auth gate (LAST — never the fallback route): LINE
                OAuth returns here both signed-in (link) and signed-out
                (login). Web-only route. */}
            <Stack.Screen name="line-callback" />
          </Stack>
          </ErrorBoundary>
          </SiteShell>
          <StatusBar style="dark" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
