/**
 * /auth-callback — where Google OAuth returns to on native
 * (`myrnapp://auth-callback?code=...`).
 *
 * `signInWithOAuthProvider` opens the provider in a browser session and expects
 * to catch the redirect itself, and on a dev client that works. On a standalone
 * build the OS hands the deep link to expo-router instead, which had no such
 * route — so a successful Google login landed on "Unmatched Route" with the
 * code sitting right there in the URL, unread.
 *
 * This is the FALLBACK for that case, not a replacement: the browser-session
 * promise is still the primary path (SDK 54 is built around it). Both funnel
 * into `exchangeAuthCodeOnce`, which guarantees a single-use code is exchanged
 * exactly once no matter which of them gets there first.
 *
 * Registered outside the auth gate in app/_layout.tsx — the user is by
 * definition not signed in yet when they land here.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { exchangeAuthCodeOnce } from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/store/auth';

type Phase = 'working' | 'error';

export default function AuthCallbackScreen() {
  const t = useT();
  const router = useRouter();
  const { code, error: oauthError } = useLocalSearchParams<{
    code?: string;
    error?: string;
  }>();
  const [phase, setPhase] = useState<Phase>('working');
  const ran = useRef(false);

  useEffect(() => {
    // Params can settle across renders; the exchange must fire once. (The code
    // is single-use — exchangeAuthCodeOnce would dedupe anyway, but there is no
    // reason to lean on that here.)
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      if (oauthError || !code) {
        // 'access_denied' = the user backed out of Google's consent screen.
        useAuth
          .getState()
          .setSocialCallbackError(oauthError === 'access_denied' ? 'GOOGLE_CANCELLED' : 'GOOGLE_FAILED');
        setPhase('error');
        return;
      }
      try {
        await exchangeAuthCodeOnce(code);
        // The session is in place; onAuthStateChange flips the gate and '/'
        // resolves to the app rather than back to login.
        router.replace('/');
      } catch {
        useAuth.getState().setSocialCallbackError('GOOGLE_FAILED');
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      {phase === 'working' ? (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>{t('authCallback.working')}</Text>
        </>
      ) : (
        <>
          <Text style={styles.text}>{t('authCallback.failed')}</Text>
          {/* The banner on /login carries the reason — this just gets them back
              there, since a failed callback leaves them signed out. */}
          <Button onPress={() => router.replace('/login')} style={styles.button}>
            {t('authCallback.backToLogin')}
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  text: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
  },
  button: {
    minWidth: 200,
  },
});
