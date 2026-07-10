/**
 * Settings — `/account/settings`.
 *
 * Two cards:
 *  • Marketing/promo push toggle (PDPA opt-out; transactional alerts always send).
 *  • Biometric unlock (Face ID / fingerprint) toggle — previously only offered
 *    once during PIN setup; now switchable any time. Enabling requires passing
 *    a biometric prompt first; the row hides on devices without enrolled
 *    biometrics (and on simulators without a test face/finger).
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { getPushEnabled, setPushEnabled } from '@/lib/data/notifications';
import { useT } from '@/lib/i18n';
import { useLock } from '@/store/lock';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [push, setPush] = useState<boolean | null>(null); // null = loading
  const [saving, setSaving] = useState(false);

  const biometricEnabled = useLock((s) => s.biometricEnabled);
  const setBiometricEnabled = useLock((s) => s.setBiometricEnabled);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  useEffect(() => {
    getPushEnabled()
      .then(setPush)
      .catch(() => setPush(true));
    (async () => {
      const [hasHw, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      if (hasHw && enrolled) {
        setBioAvailable(true);
        const isFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        setBioLabel(isFace ? 'Face ID' : t('lock.fingerprint'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (value: boolean) => {
    setPush(value); // optimistic
    setSaving(true);
    try {
      await setPushEnabled(value);
    } catch {
      setPush(!value); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  const toggleBio = async (value: boolean) => {
    if (!value) {
      await setBiometricEnabled(false);
      return;
    }
    // Turning ON requires passing the scan once — proves it works on this device.
    setBioSaving(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `${t('lock.bioPromptPrefix')}${bioLabel}${t('lock.bioPromptSuffix')}`,
        cancelLabel: t('common.cancel'),
      });
      if (res.success) await setBiometricEnabled(true);
    } finally {
      setBioSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('settings.title')}
        style={styles.header}
        left={<IconButton icon="chevron-back" accessibilityLabel="back" onPress={() => router.back()} />}
      />

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t('settings.promoLabel')}</Text>
              <Text variant="caption" style={styles.rowCaption}>
                {t('settings.promoCap')}
              </Text>
            </View>
            {push === null ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Switch
                value={push}
                onValueChange={toggle}
                disabled={saving}
                trackColor={{ true: Colors.primary, false: Colors.border }}
              />
            )}
          </View>
        </View>

        {bioAvailable ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>
                  {t('settings.bioLabel')} ({bioLabel})
                </Text>
                <Text variant="caption" style={styles.rowCaption}>
                  {t('settings.bioCap')}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBio}
                disabled={bioSaving}
                trackColor={{ true: Colors.primary, false: Colors.border }}
              />
            </View>
          </View>
        ) : null}

        <Text variant="caption" style={styles.note}>
          {t('settings.note')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowText: { flex: 1 },
  rowLabel: { ...Typography.bodyStrong, color: Colors.text },
  rowCaption: { color: Colors.textMuted, marginTop: 2 },
  note: { color: Colors.textMuted, paddingHorizontal: Spacing.xs },
});
