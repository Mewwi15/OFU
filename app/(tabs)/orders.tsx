/**
 * Orders tab — `/orders`.
 *
 * The customer's order list: any in-flight order on top (tappable → live
 * tracking) followed by past orders newest-first. Reads `active` + `history`
 * from the persisted order store. Replaces the old wishlist tab. Tokens-only,
 * zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { OrderStatus, TrackedOrder } from '@/data/fulfillment';
import { getReorderItems, TERMINAL } from '@/lib/data/order';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCart } from '@/store/cart';
import { useCatalog } from '@/store/catalog';
import { useOrder } from '@/store/order';

type StatusTone = 'active' | 'done' | 'fail';

const STATUS_META: Record<OrderStatus, { tone: StatusTone }> = {
  preparing: { tone: 'active' },
  picked_up: { tone: 'active' },
  in_transit: { tone: 'active' },
  out_for_delivery: { tone: 'active' },
  delivered: { tone: 'done' },
  delivery_failed: { tone: 'fail' },
  returned: { tone: 'fail' },
  cancelled: { tone: 'fail' },
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
  onReorder,
}: {
  order: TrackedOrder;
  onPress?: () => void;
  onReorder?: () => void;
}) {
  const t = useT();
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
              {t(`orders.status.${order.status}`)}
            </Text>
          </View>
        </View>
        <Text variant="caption" numberOfLines={1}>
          {order.itemCount} {t('orders.itemsUnit')} · {money(order.total)}
          {order.placedAtLabel ? ` · ${order.placedAtLabel}` : ''}
        </Text>
      </View>
      {onReorder ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t('orders.reorderA11y')} ${order.id}`}
          hitSlop={8}
          onPress={onReorder}
          style={styles.reorderPill}>
          <Text style={styles.reorderText}>{t('orders.reorder')}</Text>
        </PressableScale>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      ) : null}
    </View>
  );

  if (!onPress) return <View style={styles.card}>{Row}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('orders.trackA11y')} ${order.id}`}
      onPress={onPress}
      scaleTo={0.98}
      style={styles.card}>
      {Row}
    </PressableScale>
  );
}

export default function OrdersScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useOrder((s) => s.list);
  const loadList = useOrder((s) => s.loadList);
  const products = useCatalog((s) => s.products);
  const addToCart = useCart((s) => s.add);

  // Refetch the customer's orders whenever this tab gains focus.
  useFocusEffect(
    useCallback(() => {
      void loadList();
    }, [loadList]),
  );

  const reorder = async (orderNumber: string) => {
    try {
      const items = await getReorderItems(orderNumber);
      let added = 0;
      for (const it of items) {
        const product = products.find((p) => p.variants.some((v) => v.id === it.variantId));
        const variant = product?.variants.find((v) => v.id === it.variantId);
        if (product && variant && variant.available > 0) {
          addToCart(product, { size: variant.size ?? undefined, qty: it.qty });
          added += 1;
        }
      }
      if (added > 0) {
        router.push('/cart');
      } else {
        Alert.alert(t('orders.reorderFailTitle'), t('orders.reorderFailBody'));
      }
    } catch {
      Alert.alert(t('orders.errorTitle'), t('orders.reorderErrorBody'));
    }
  };

  const ongoing = list.filter((o) => !TERMINAL.includes(o.status));
  const history = list.filter((o) => TERMINAL.includes(o.status));
  const isEmpty = list.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      <ScreenHeader title={t('orders.title')} style={styles.header} />

      {isEmpty ? (
        <View style={[styles.empty, { paddingBottom: 110 + insets.bottom }]}>
          <View style={styles.emptyBadge}>
            <Ionicons name="receipt-outline" size={40} color={Colors.primaryStrong} />
          </View>
          <Text variant="title" style={styles.emptyTitle}>
            {t('orders.emptyTitle')}
          </Text>
          <Text variant="body" style={styles.emptyBody}>
            {t('orders.emptyBody')}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 110 + insets.bottom },
          ]}>
          {ongoing.length > 0 ? (
            <Animated.View entering={FadeInDown.springify().damping(18)}>
              <Text style={styles.eyebrow}>{t('orders.ongoing')}</Text>
              <View style={styles.stack}>
                {ongoing.map((order) => (
                  <OrderRow key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />
                ))}
              </View>
            </Animated.View>
          ) : null}

          {history.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Text style={[styles.eyebrow, ongoing.length > 0 && styles.eyebrowTop]}>{t('orders.past')}</Text>
              <View style={styles.stack}>
                {history.map((order, i) => (
                  <Animated.View
                    key={order.id}
                    entering={FadeInDown.delay(120 + i * 60).springify().damping(18)}>
                    <OrderRow
                      order={order}
                      onPress={() => router.push(`/order/${order.id}`)}
                      onReorder={() => reorder(order.id)}
                    />
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
  reorderPill: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  reorderText: {
    ...Typography.label,
    color: Colors.primaryStrong,
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
