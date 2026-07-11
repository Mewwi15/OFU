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
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeProvider } from '@/theme/theme-provider';
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

  // The PIN belongs to an account, not the device: if another account's PIN is
  // still stored here (account switch / phone-OTP era), clear it so this
  // account gets the setup flow instead of a lock it can never pass.
  useEffect(() => {
    if (userId && hydrated) void ensurePinOwner(userId);
  }, [userId, hydrated, ensurePinOwner]);

  // Re-lock when the app has been in the background for a while (screen-lock
  // behaviour) — but with a grace period. Locking on EVERY background made
  // in-app detours require the PIN again: the image picker (slip/avatar) and
  // the Google OAuth browser both background the app for a few seconds.
  const LOCK_GRACE_MS = 2 * 60 * 1000;
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

  const showOnboarding = !onboarded;
  const showLogin = onboarded && !isAuthed;
  const showSetup = onboarded && isAuthed && !hasPin;
  const showLock = onboarded && isAuthed && hasPin && locked;
  const showApp = onboarded && isAuthed && hasPin && !locked;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
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
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
