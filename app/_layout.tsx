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
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { CartFlyLayer } from '@/components/shop/CartFlyLayer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteShell } from '@/components/web/SiteShell';
import { supabase } from '@/lib/supabase/client';
import { installWebIdleGuard, markWebActive } from '@/lib/webIdleGuard';
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
  const initAuth = useAuth((s) => s.initialize);
  const hydrated = useLock((s) => s.hydrated);
  const onboarded = useLock((s) => s.onboarded);
  const hasPin = useLock((s) => s.hasPin);
  const hydrate = useLock((s) => s.hydrate);
  const resetLock = useLock((s) => s.resetLock);

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

  // Web: there's no PIN lock to re-challenge after a period away (see
  // lockSupported below — expo-secure-store has no web backend), so a
  // signed-in session otherwise sits in localStorage indefinitely. On a
  // shared/public computer that hands the next person the previous
  // customer's account. Sign out after real inactivity — see lib/webIdleGuard.
  // Re-installs when `isAuthed` flips: the mount-time staleness check races
  // session hydration (auth.uid() resolves asynchronously, so `status` often
  // still reads 'loading' at the exact synchronous instant this first runs)
  // — re-running once isAuthed is actually known closes that gap instead of
  // silently missing a stale session on a freshly (re)opened tab.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return installWebIdleGuard(() => {
      if (useAuth.getState().status === 'authenticated') {
        void useAuth.getState().logout();
      }
    });
  }, [isAuthed]);

  // Reset the activity clock right when a session is confirmed authenticated
  // — see webIdleGuard's own doc comment for why installWebIdleGuard itself
  // deliberately never does this on install.
  useEffect(() => {
    if (Platform.OS === 'web' && isAuthed) markWebActive();
  }, [isAuthed]);

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

  /* ★ ล้าง PIN ที่ค้างอยู่ในเครื่องทิ้ง ★ คนที่เคยตั้งไว้ก่อนเลิกใช้ ยังมีรหัสเก็บอยู่ใน
     ที่เก็บความลับของเครื่อง ถ้าไม่ล้าง มันจะค้างอยู่อย่างนั้นไปตลอดโดยไม่มีทางเอาออก
     (หน้าตั้ง/ปลดล็อกถูกถอดออกไปแล้ว) — ล้างครั้งเดียวตอนเปิดแอปครั้งถัดไป */
  useEffect(() => {
    if (hydrated && hasPin) void resetLock();
  }, [hydrated, hasPin, resetLock]);

  const ready = (loaded || error) && hydrated && authHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  /* ★ เลิกใช้ PIN ★ เจ้าของสั่ง 5 ก.ย. 2026 "ยกเลิกใช้พินด้วยครับ มันดูซับซ้อน" —
     ร้านชำไม่ใช่แอปธนาคาร ด่านที่ลูกค้าต้องผ่านก่อนซื้อของยิ่งน้อยยิ่งดี และตอนนี้เข้าด้วย
     เบอร์+OTP แล้ว ซึ่งเป็นการยืนยันตัวตนที่แน่นกว่ารหัส 6 หลักที่ตั้งเองอยู่แล้ว
     เหลือแค่สองด่าน: ยังไม่เคยเปิดแอป → แนะนำตัว · ยังไม่ล็อกอิน → หน้าเข้าสู่ระบบ */
  const showOnboarding = !onboarded;
  const showLogin = onboarded && !isAuthed;
  const showApp = onboarded && isAuthed;

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

            <Stack.Protected guard={showApp}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[id]" />
              {/* ทั้งสองโหมดมีแถบล่างของตัวเอง (app/<โหมด>/_layout.tsx) จึงลงทะเบียน
                  เป็นกลุ่มเดียว ไม่ใช่ทีละหน้า */}
              <Stack.Screen name="delivery" />
              <Stack.Screen name="online" />
              {/* เต็มจอ ไม่ใช่โมดัลอีกต่อไป (เจ้าของสั่ง 3 ก.ย. 2026 "ทำให้หน้าเต็มจอไปเลย")
                  โมดัลเดิมเผยให้เห็นขอบจอด้านหลังโปร่งแสง ซึ่งขัดกับพื้นไล่สีส้มเต็มจอ
                  ที่เพิ่มเข้ามาพร้อมกัน — ไล่สีจะดูมีกรอบขาวแทรกอยู่รอบขอบถ้ายังเป็นโมดัล */}
              <Stack.Screen name="delivery-check" />
              <Stack.Screen name="online-check" />
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
              <Stack.Screen name="account/store-credit" />
              <Stack.Screen name="notifications" />
            </Stack.Protected>

            {/* Outside the auth gate (LAST — never the fallback route): LINE
                OAuth returns here both signed-in (link) and signed-out
                (login). Web-only route. */}
            <Stack.Screen name="line-callback" />

            {/* Also outside the gate, and that is the whole point: Google's
                deep link (myrnapp://auth-callback?code=…) arrives while the
                user is still signed out, so behind `showLogin` only /login
                exists and the OS-delivered link hit "Unmatched Route" with the
                code unread. Native OAuth return. */}
            <Stack.Screen name="auth-callback" />
          </Stack>
          </ErrorBoundary>
          {/* ★ นอก Stack ★ รูปสินค้าที่บินเข้าตะกร้าต้องวาดทับทุกหน้าและไม่โดนกรอบของ
              รายการที่เลื่อนอยู่ตัดหาย — วางไว้ในนี้ชั้นเดียว ทุกหน้าใช้ร่วมกัน */}
          <CartFlyLayer />
          </SiteShell>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
