/**
 * Orders tab — `/orders`.
 *
 * The customer's order list, redesigned for scannability (owner: the old rows
 * "ดูยาก"). Each card leads with what was bought — stacked product thumbnails +
 * the first item's name — over a clear footer (total + track/reorder action).
 * The order number/date live in a small card header; status is a colored badge.
 * In-flight orders sit on top with a coral "ติดตามออเดอร์" call-to-action.
 * Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { BRAND_ACCENT } from '@/constants/accent';
import { ONLINE_ACCENT } from '@/constants/online';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { isAwaitingSlipCheck, type OrderStatus, type TrackedOrder } from '@/data/fulfillment';
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
  /* ★ เทา ไม่ใช่แดง ★ ออเดอร์ที่ยกเลิกไปแล้วเป็นเรื่องที่จบไปแล้ว ไม่ใช่ปัญหาที่ลูกค้า
     ต้องรีบจัดการ — ป้ายแดงในรายการย้อนหลังทำให้ทั้งหน้าดูเหมือนมีอะไรผิดพลาดเต็มไปหมด
     สีแดงเก็บไว้ใช้กับสิ่งที่ต้องลงมือทำจริง ๆ */
  fail: Colors.textMuted,
};

const THUMB = 44;

/** Stacked product thumbnails (≤3 + a "+N" chip); falls back to an icon tile. */
function ThumbStack({ order }: { order: TrackedOrder }) {
  const images = order.itemImages ?? [];
  if (images.length === 0) {
    return (
      <View style={styles.thumbFallback}>
        <Ionicons name="bag-handle-outline" size={20} color={Colors.primaryStrong} />
      </View>
    );
  }
  const shown = images.slice(0, 3);
  // Lines, not units — "+4" on a 1-product ×5 order would mislead.
  const extra = (order.lineCount ?? order.itemCount) - shown.length;
  return (
    <View style={styles.thumbRow}>
      {shown.map((uri, i) => (
        <Image
          key={`${uri}-${i}`}
          source={{ uri }}
          style={[styles.thumb, i > 0 && styles.thumbOverlap]}
          contentFit="cover"
          transition={150}
        />
      ))}
      {extra > 0 ? (
        <View style={[styles.thumb, styles.thumbOverlap, styles.thumbMore]}>
          <Text style={styles.thumbMoreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

function OrderCard({
  order,
  onPress,
  onReorder,
}: {
  order: TrackedOrder;
  onPress: () => void;
  onReorder?: () => void;
}) {
  const t = useT();
  const meta = STATUS_META[order.status];
  /* สีตามโหมดของออเดอร์ใบนี้ ไม่ใช่โหมดที่แอปอยู่ตอนนี้ (เหตุผลเดียวกับหน้าติดตามออเดอร์) */
  const A = order.mode === 'online' ? ONLINE_ACCENT : BRAND_ACCENT;
  const ongoing = !onReorder;
  // "และอีก N รายการ" counts other product lines, not leftover units.
  const restCount = (order.lineCount ?? order.itemCount) - 1;
  // Honest badge: the shop hasn't approved the slip yet → not "preparing".
  const statusLabel = isAwaitingSlipCheck(order)
    ? t('orders.status.awaitSlip')
    : t(`orders.status.${order.status}`);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('orders.trackA11y')} ${order.id}`}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.card, ongoing && { borderColor: A.solid }, ongoing && styles.cardOngoing]}>
      {/* Header: order no. + date | status badge */}
      <View style={styles.cardHead}>
        <Text variant="caption" numberOfLines={1} style={styles.headMeta}>
          #{order.id}
          {order.placedAtLabel ? `   ${order.placedAtLabel}` : ''}
        </Text>
        <View
          style={[
            styles.badge,
            TONE_BADGE[meta.tone],
            meta.tone === 'active' && { backgroundColor: A.tint },
          ]}>
          <Text
            style={[
              styles.badgeText,
              { color: meta.tone === 'active' ? A.strong : TONE_TEXT[meta.tone] },
            ]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* What was bought */}
      <View style={styles.cardBody}>
        <ThumbStack order={order} />
        <View style={styles.bodyText}>
          <Text style={styles.itemName} numberOfLines={1}>
            {order.firstItemName ?? order.shopName}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {restCount > 0
              ? `${t('orders.morePrefix')}${restCount}${t('orders.moreSuffix')}`
              : `${order.itemCount} ${t('orders.itemsUnit')}`}
          </Text>
        </View>
        <View style={styles.totalCol}>
          <Text variant="caption">{t('orders.totalLabel')}</Text>
          <Text style={styles.totalValue}>{money(order.total)}</Text>
        </View>
      </View>

      {/* Footer action */}
      {ongoing ? (
        /* ★ ปุ่มไม่กินเต็มความกว้าง ★ ของเดิมเป็นแถบสีทึบเต็มการ์ด ทั้งใบเลยตะโกนแข่งกับ
           ทุกอย่างบนหน้า ทั้งที่ทั้งการ์ดกดได้อยู่แล้ว — ย่อเป็นปุ่มชิดขวาพอ */
        <View style={styles.cardFoot}>
          <Text variant="caption" numberOfLines={1} style={styles.footMeta}>
            {order.deliveredAt ?? ''}
          </Text>
          <View style={[styles.trackPill, { backgroundColor: A.solid }]}>
            <Text style={styles.trackText}>{t('orders.trackCta')}</Text>
            <Ionicons name="arrow-forward" size={15} color={Colors.textOnPrimary} />
          </View>
        </View>
      ) : (
        <View style={styles.cardFoot}>
          <Text variant="caption" numberOfLines={1} style={styles.footMeta}>
            {order.deliveredAt ?? ''}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${t('orders.reorderA11y')} ${order.id}`}
            hitSlop={8}
            onPress={onReorder}
            style={[styles.reorderPill, { borderColor: A.tint }]}>
            <Ionicons name="refresh" size={14} color={A.strong} />
            <Text style={[styles.reorderText, { color: A.strong }]}>{t('orders.reorder')}</Text>
          </PressableScale>
        </View>
      )}
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
                  <OrderCard
                    key={order.id}
                    order={order}
                    onPress={() => router.push(`/order/${order.id}`)}
                  />
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
                    <OrderCard
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

  /* Card */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    /* แน่นขึ้นกว่าเดิม — ของเดิมเว้นขอบในกว้างจนเห็นได้แค่สองใบครึ่งต่อจอ
       หน้านี้เป็นรายการที่ต้องกวาดตาหา ไม่ใช่หน้าที่อ่านทีละใบ */
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadow.card,
  },
  /* ★ ขอบบางลงมาก ★ ของเดิม 1.5 สีทึบทั้งกรอบ อ่านออกมาเป็นกล่องเตือนภัยมากกว่า
     "ออเดอร์ที่กำลังมา" — บาง ๆ พอให้รู้ว่าใบนี้ต่างจากใบอื่น ไม่ต้องตะโกน */
  cardOngoing: { borderWidth: 1 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headMeta: {
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

  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bodyText: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  totalCol: {
    alignItems: 'flex-end',
    gap: 1,
  },
  /* เล็กลงกว่าเดิมหนึ่งขั้น — ของเดิมตัวเลขใหญ่กว่าชื่อสินค้า สายตาเลยไปหาตัวเลขก่อน
     ทั้งที่คนเปิดหน้านี้มาหา "ออเดอร์ไหน" ไม่ใช่ "จ่ายไปเท่าไหร่" */
  totalValue: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },

  /* Thumbnails */
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  thumbOverlap: {
    marginLeft: -14,
  },
  thumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  thumbMoreText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },
  thumbFallback: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Footer — ongoing: track CTA strip */
  /* ปุ่มติดตามชิดขวา ไม่กินเต็มความกว้าง — ทั้งการ์ดกดได้อยู่แล้ว ปุ่มนี้แค่บอกว่ากดแล้ว
     จะไปไหน ไม่ต้องเป็นแถบทึบเต็มใบ */
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    height: 36,
    borderRadius: Radius.pill,
  },
  trackText: {
    ...Typography.button,
    color: Colors.textOnPrimary,
  },

  /* Footer — history: delivered date + reorder */
  /* ไม่มีเส้นคั่นแล้ว — เส้นบวกระยะห่างสองชั้นทำให้เกิดแถบว่างใต้การ์ดทุกใบ
     ปุ่มอยู่แถวเดียวกับวันที่ก็แยกออกจากเนื้อหาได้เองอยู่แล้ว */
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  footMeta: {
    flexShrink: 1,
  },
  reorderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
