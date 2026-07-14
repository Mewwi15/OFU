/**
 * Store credit — `/account/store-credit`.
 *
 * Read-only: balance + recent history. Credit is only granted/spent at the
 * till (POS top-up, refund-as-credit) — there's no online-spend path yet, so
 * this screen exists purely so a customer can see what they have.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { listMyStoreCredit, type MyStoreCredit, type StoreCreditEntry } from '@/lib/data/storeCredit';
import { money } from '@/lib/format';
import { useLocale } from '@/store/locale';

const REASON_LABEL_TH: Record<string, string> = {
  topup: 'เติมเครดิต',
  pos_sale: 'ใช้ซื้อสินค้า',
  pos_refund: 'คืนเงินเป็นเครดิต',
};
const REASON_LABEL_EN: Record<string, string> = {
  topup: 'Top-up',
  pos_sale: 'Spent in store',
  pos_refund: 'Refunded as credit',
};

function entryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StoreCreditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [data, setData] = useState<MyStoreCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const lang = useLocale((s) => s.lang);
  const reasonLabel = lang === 'en' ? REASON_LABEL_EN : REASON_LABEL_TH;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyStoreCredit()
        .then((d) => !cancelled && setData(d))
        .catch(() => !cancelled && setData({ balance: 0, entries: [] }))
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('storeCredit.title')}
        style={styles.header}
        left={
          <IconButton
            icon="chevron-back"
            variant="tint"
            shape="rounded"
            size={40}
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.x2 }]}>
        <Animated.View entering={FadeInDown.duration(280)} style={styles.balanceCard}>
          <Ionicons name="wallet-outline" size={28} color={Colors.textOnPrimary} />
          <Text variant="caption" style={styles.balanceLabel}>
            {t('storeCredit.balanceLabel')}
          </Text>
          {loading ? (
            <ActivityIndicator color={Colors.textOnPrimary} style={styles.balanceSpinner} />
          ) : (
            <Text style={styles.balanceValue}>{money(data?.balance ?? 0)}</Text>
          )}
        </Animated.View>

        <Text style={styles.eyebrow}>{t('storeCredit.historyLabel')}</Text>

        {!loading && data?.entries.length === 0 ? (
          <Text variant="body" style={styles.empty}>
            {t('storeCredit.empty')}
          </Text>
        ) : null}

        {(data?.entries ?? []).map((e: StoreCreditEntry, i: number) => (
          <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 8) * 45).duration(240)}>
            <View style={styles.row}>
              <View
                style={[
                  styles.rowIconTile,
                  e.delta >= 0 ? styles.rowIconTileIn : styles.rowIconTileOut,
                ]}>
                <Ionicons
                  name={e.delta >= 0 ? 'add' : 'remove'}
                  size={18}
                  color={e.delta >= 0 ? Colors.accentStrong : Colors.dangerStrong}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{reasonLabel[e.reason] ?? e.reason}</Text>
                <Text variant="caption" style={styles.rowDate}>
                  {entryDate(e.createdAt)}
                </Text>
              </View>
              <Text style={[styles.rowDelta, e.delta >= 0 ? styles.rowDeltaIn : styles.rowDeltaOut]}>
                {e.delta >= 0 ? '+' : ''}
                {money(e.delta)}
              </Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  content: { padding: Spacing.lg, gap: Spacing.md },

  balanceCard: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.x2,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.sm,
    ...Shadow.float,
  },
  balanceLabel: { color: Colors.textOnPrimary, opacity: 0.85 },
  balanceValue: { ...Typography.heading, fontSize: 32, color: Colors.textOnPrimary },
  balanceSpinner: { marginVertical: Spacing.sm },

  eyebrow: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    paddingTop: Spacing.x2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  rowIconTile: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconTileIn: { backgroundColor: Colors.accentTint },
  rowIconTileOut: { backgroundColor: Colors.surfaceMuted },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { ...Typography.bodyStrong, color: Colors.text },
  rowDate: { color: Colors.textMuted },
  rowDelta: { ...Typography.bodyStrong },
  rowDeltaIn: { color: Colors.accentStrong },
  rowDeltaOut: { color: Colors.text },
});
