/**
 * Orders tab — `/orders`.
 *
 * The customer's order list: any in-flight order on top (tappable → live
 * tracking) followed by past orders newest-first. Reads `active` + `history`
 * from the persisted order store. Replaces the old wishlist tab. Tokens-only,
 * zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { OrderStatus, TrackedOrder } from '@/data/fulfillment';
import { money } from '@/lib/format';
import { useOrder } from '@/store/order';

type StatusTone = 'active' | 'done' | 'fail';

const STATUS_META: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  preparing: { label: 'กำลังเตรียม', tone: 'active' },
  picked_up: { label: 'Flash รับแล้ว', tone: 'active' },
  in_transit: { label: 'กำลังขนส่ง', tone: 'active' },
  out_for_delivery: { label: 'กำลังจัดส่ง', tone: 'active' },
  delivered: { label: 'ส่งสำเร็จ', tone: 'done' },
  delivery_failed: { label: 'นำจ่ายไม่สำเร็จ', tone: 'fail' },
  returned: { label: 'ตีกลับ', tone: 'fail' },
  cancelled: { label: 'ยกเลิก', tone: 'fail' },
};

const TONE_BADGE: Record<StatusTone, object> = {
  active: { backgroundColor: Colors.primaryTint },
  done: { backgroundColor: Colors.accentTint },
  fail: { backgroundColor: Colors.surfaceMuted },
};

const TONE_TEXT: Record<StatusTone, string> = {
  active: Colors.primaryStrong,
  done: Colors.accentStrong,
  fail: Colors.dangerStrong,
};

function OrderRow({
  order,
  onPress,
}: {
  order: TrackedOrder;
  onPress?: () => void;
}) {
  const meta = STATUS_META[order.status];
  const Row = (
    <View style={styles.row}>
      <View style={styles.iconTile}>
        <Ionicons name="receipt-outline" size={20} color={Colors.primaryStrong} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.orderId} numberOfLines={1}>
            {order.id}
          </Text>
          <View style={[styles.badge, TONE_BADGE[meta.tone]]}>
            <Text style={[styles.badgeText, { color: TONE_TEXT[meta.tone] }]}>
              {meta.label}
            </Text>
          </View>
        </View>
        <Text variant="caption" numberOfLines={1}>
          {order.itemCount} ชิ้น · {money(order.total)}
          {order.placedAtLabel ? ` · ${order.placedAtLabel}` : ''}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} /> : null}
    </View>
  );

  if (!onPress) return <View style={styles.card}>{Row}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`ติดตามคำสั่งซื้อ ${order.id}`}
      onPress={onPress}
      scaleTo={0.98}
      style={styles.card}>
      {Row}
    </PressableScale>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const active = useOrder((s) => s.active);
  const history = useOrder((s) => s.history);

  const isEmpty = !active && history.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      <ScreenHeader title="คำสั่งซื้อของฉัน" style={styles.header} />

      {isEmpty ? (
        <View style={[styles.empty, { paddingBottom: 110 + insets.bottom }]}>
          <View style={styles.emptyBadge}>
            <Ionicons name="receipt-outline" size={40} color={Colors.primaryStrong} />
          </View>
          <Text variant="title" style={styles.emptyTitle}>
            ยังไม่มีคำสั่งซื้อ
          </Text>
          <Text variant="body" style={styles.emptyBody}>
            เมื่อคุณสั่งซื้อ ออเดอร์จะมาแสดงที่นี่
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 110 + insets.bottom },
          ]}>
          {active ? (
            <Animated.View entering={FadeInDown.springify().damping(18)}>
              <Text style={styles.eyebrow}>กำลังดำเนินการ</Text>
              <OrderRow order={active} onPress={() => router.push(`/order/${active.id}`)} />
            </Animated.View>
          ) : null}

          {history.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Text style={[styles.eyebrow, active && styles.eyebrowTop]}>ที่ผ่านมา</Text>
              <View style={styles.stack}>
                {history.map((order, i) => (
                  <Animated.View
                    key={order.id}
                    entering={FadeInDown.delay(120 + i * 60).springify().damping(18)}>
                    <OrderRow order={order} />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  eyebrow: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  eyebrowTop: {
    marginTop: Spacing.x2,
  },
  stack: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  orderId: {
    ...Typography.bodyStrong,
    color: Colors.text,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    ...Typography.label,
  },

  /* Empty */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
  },
  emptyBadge: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: Spacing.xl,
  },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    color: Colors.textMuted,
  },
});
