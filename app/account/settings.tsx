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

import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { authRepo } from '@/lib/data/auth';
import { getPushEnabled, setPushEnabled } from '@/lib/data/notifications';
import { useT } from '@/lib/i18n';
import { showAlert, showConfirm } from '@/lib/showAlert';
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

  // PDPA data-processing consent — required by place_order (CONSENT_REQUIRED);
  // withdrawing it blocks new orders until granted again, browsing/cart still
  // work. null = loading.
  const [consentGranted, setConsentGranted] = useState<boolean | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);

  useEffect(() => {
    getPushEnabled()
      .then(setPush)
      .catch(() => setPush(true));
    authRepo
      .getConsentStatus()
      .then((s) => setConsentGranted(s.data_processing ?? false))
      .catch(() => setConsentGranted(true)); // fail open on read — don't alarm on a network hiccup
    if (Platform.OS === 'web') return; // no biometrics / app lock on web
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

  const toggleConsent = async () => {
    if (consentGranted) {
      const ok = await showConfirm(
        t('settings.consentWithdrawConfirmTitle'),
        t('settings.consentWithdrawConfirmBody'),
        { confirmText: t('settings.consentWithdrawBtn'), cancelText: t('common.cancel'), destructive: true },
      );
      if (!ok) return;
    }
    setConsentSaving(true);
    try {
      if (consentGranted) {
        await authRepo.withdrawConsent('data_processing');
        setConsentGranted(false);
      } else {
        await authRepo.grantConsent('data_processing', 'v1');
        setConsentGranted(true);
      }
    } catch {
      showAlert(t('settings.consentUpdateFailed'));
    } finally {
      setConsentSaving(false);
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
        left={
          <IconButton
            icon="chevron-back"
            variant="tint"
            shape="rounded"
            size={40}
            accessibilityLabel="back"
            onPress={() => router.back()}
          />
        }
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

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t('settings.consentTitle')}</Text>
              <Text variant="caption" style={styles.rowCaption}>
                {t('settings.consentCap')}
              </Text>
            </View>
            {consentGranted === null ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <View style={styles.consentStatusRow}>
                <Ionicons
                  name={consentGranted ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={consentGranted ? Colors.accentStrong : Colors.dangerStrong}
                />
                <Text
                  variant="caption"
                  style={[styles.consentStatusText, { color: consentGranted ? Colors.accentStrong : Colors.dangerStrong }]}>
                  {consentGranted ? t('settings.consentGranted') : t('settings.consentWithdrawn')}
                </Text>
              </View>
            )}
          </View>
          {consentGranted !== null ? (
            <Pressable
              accessibilityRole="button"
              disabled={consentSaving}
              onPress={() => void toggleConsent()}
              style={({ pressed }) => [styles.consentBtn, pressed && styles.consentBtnPressed]}>
              {consentSaving ? (
                <ActivityIndicator color={consentGranted ? Colors.dangerStrong : Colors.primaryStrong} />
              ) : (
                <Text
                  style={[
                    styles.consentBtnText,
                    { color: consentGranted ? Colors.dangerStrong : Colors.primaryStrong },
                  ]}>
                  {consentGranted ? t('settings.consentWithdrawBtn') : t('settings.consentGrantBtn')}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

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

  consentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  consentStatusText: { ...Typography.label },
  consentBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  consentBtnPressed: { opacity: 0.6 },
  consentBtnText: { ...Typography.button },
});
