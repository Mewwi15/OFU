/**
 * /line-callback — where LINE Login redirects back to (web only; the route
 * is registered outside the auth gate so both flows can land here).
 * Validates the OAuth state, hands the code to the line-login Edge Function,
 * then either redeems the returned token_hash for a session ('login') or
 * confirms the link ('link') and returns to the account tab.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { LINE_STATE_KEY } from '@/lib/line';
import { supabase } from '@/lib/supabase/client';

type Phase = 'working' | 'error';

export default function LineCallbackScreen() {
  const t = useT();
  const router = useRouter();
  const { code, state, error: lineError } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  const [phase, setPhase] = useState<Phase>('working');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || Platform.OS !== 'web') return;
    ran.current = true;

    const fail = (msg: string) => {
      setMessage(msg);
      setPhase('error');
    };

    const run = async () => {
      if (lineError || !code || !state) {
        fail(t('line.cancelled'));
        return;
      }
      const saved = sessionStorage.getItem(LINE_STATE_KEY);
      sessionStorage.removeItem(LINE_STATE_KEY);
      const mode = state.startsWith('link:') ? 'link' : 'login';
      // Mobile app-switch returns can land in a fresh browser context with an
      // empty sessionStorage — allow that for LOGIN (no account at risk), but
      // LINK binds the LINE to the signed-in account, so it must match.
      if (mode === 'link' && saved !== state) {
        fail(`${t('line.failed')} [state]`);
        return;
      }
      if (saved && saved !== state) {
        fail(`${t('line.failed')} [state2]`);
        return;
      }

      const { data, error } = await supabase.functions.invoke('line-login', {
        body: { code, redirect_uri: `${window.location.origin}/line-callback`, mode },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const status = ctx?.status;
        let detail = '';
        try {
          detail = ctx ? ((await ctx.json()) as { error?: string }).error ?? '' : '';
        } catch {
          detail = '';
        }
        fail(status === 409 ? t('line.taken') : `${t('line.failed')} [${status ?? '?'} ${detail}]`);
        return;
      }

      if (mode === 'link') {
        router.replace('/account');
        return;
      }
      const tokenHash = (data as { token_hash?: string })?.token_hash;
      if (!tokenHash) {
        fail(t('line.failed'));
        return;
      }
      const { error: otpErr } = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: tokenHash,
      });
      if (otpErr) {
        fail(t('line.failed'));
        return;
      }
      router.replace('/');
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      {phase === 'working' ? (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>{t('line.working')}</Text>
        </>
      ) : (
        <>
          <Text style={styles.text}>{message}</Text>
          <Button onPress={() => router.replace('/')} style={styles.button}>
            {t('line.backHome')}
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
