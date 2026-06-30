/**
 * Notification settings — `/account/settings`.
 *
 * One toggle for marketing/promo push (PDPA opt-out). Transactional order alerts
 * are always sent and aren't controlled here. Backed by notification_preferences.
 */

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

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [push, setPush] = useState<boolean | null>(null); // null = loading
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPushEnabled()
      .then(setPush)
      .catch(() => setPush(true));
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
