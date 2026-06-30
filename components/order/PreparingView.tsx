/**
 * PreparingView — order-tracking state 1 ("ร้านกำลังเตรียมสินค้า").
 *
 * A calm status screen: shop card with a "กำลังเตรียม" badge + ETA window, a
 * reassuring info banner, a free-delivery upsell, and a pinned footer showing
 * where the order is heading. Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Breathing } from '@/components/ui/Breathing';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { TrackedOrder } from '@/data/fulfillment';

type Props = {
  order: TrackedOrder;
  onClose: () => void;
  onExplore: () => void;
  /** Shown while the order can still be cancelled (before it ships). */
  onCancel?: () => void;
};

export function PreparingView({ order, onClose, onExplore, onCancel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel="ปิด" onPress={onClose} />
      </View>

      <View style={styles.body}>
        <Text variant="title" style={styles.title}>
          รอสักครู่นะ กำลังจัดเตรียมให้อยู่!
        </Text>

        {/* Shop / status card */}
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.shopCard}>
          <View style={styles.shopTop}>
            <View style={styles.shopAvatar}>
              <Ionicons name="storefront" size={20} color={Colors.primaryStrong} />
            </View>
            <Text style={styles.shopName} numberOfLines={1}>
              {order.shopName}
            </Text>
            <Breathing amount={0.05} duration={1300} style={styles.statusPill}>
              <Text style={styles.statusPillText}>กำลังเตรียมสินค้า</Text>
            </Breathing>
          </View>

          <View style={styles.etaRow}>
            <View style={styles.etaLeft}>
              <Text variant="caption">เวลาจัดส่งโดยประมาณ</Text>
              <Text style={styles.etaValue}>{order.etaText}</Text>
            </View>
            <Breathing style={styles.etaIcon}>
              <Ionicons name="bicycle" size={26} color={Colors.primary} />
            </Breathing>
          </View>
        </Animated.View>

        {/* Reassurance banner */}
        <Animated.View entering={FadeInDown.delay(160).springify().damping(18)} style={styles.banner}>
          <Ionicons name="leaf" size={18} color={Colors.accentStrong} />
          <Text variant="body" style={styles.bannerText}>
            ร้านอู้ฟู่กำลังจัดเตรียมออเดอร์ของคุณ ของสดใหม่กำลังมา!
          </Text>
        </Animated.View>

        {/* Free-delivery upsell */}
        <Animated.View entering={FadeInDown.delay(240).springify().damping(18)} style={styles.promoCard}>
          <View style={styles.promoBody}>
            <Text style={styles.promoTitle}>ปลดล็อกส่งฟรี!</Text>
            <Text variant="caption" style={styles.promoSub}>
              รับดีลและส่วนลดพิเศษเพิ่มเติมอีกเพียบ
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="ดูดีลเพิ่มเติม"
              onPress={onExplore}
              style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>ดูเลย</Text>
            </PressableScale>
          </View>
          <View style={styles.promoIcon}>
            <Ionicons name="bicycle" size={34} color={Colors.primary} />
          </View>
        </Animated.View>
      </View>

      {onCancel ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="ยกเลิกออเดอร์"
          onPress={onCancel}
          style={styles.cancelBtn}>
          <Text style={styles.cancelText}>ยกเลิกออเดอร์</Text>
        </PressableScale>
      ) : null}

      {/* Pinned footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.footerPin}>
          <Ionicons name="home" size={18} color={Colors.primaryStrong} />
        </View>
        <View style={styles.footerText}>
          <Text variant="caption">จัดส่งไปที่</Text>
          <Text style={styles.footerAddr} numberOfLines={1}>
            {order.addressLabel} · คาดว่าถึงใน {order.etaShort}
          </Text>
        </View>
      </View>
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
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xl,
  },

  /* Shop card */
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  shopTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shopAvatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    flex: 1,
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  statusPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  statusPillText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  etaLeft: {
    flex: 1,
    gap: 2,
  },
  etaValue: {
    ...Typography.title,
    color: Colors.text,
  },
  etaIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentTint,
    marginBottom: Spacing.lg,
  },
  bannerText: {
    flex: 1,
    color: Colors.text,
  },

  /* Promo */
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  promoBody: {
    flex: 1,
  },
  promoTitle: {
    ...Typography.subtitle,
    color: Colors.text,
  },
  promoSub: {
    marginTop: 2,
  },
  promoBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  promoBtnText: {
    ...Typography.button,
    color: Colors.primaryStrong,
  },
  promoIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  cancelText: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerPin: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    flex: 1,
    gap: 1,
  },
  footerAddr: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
});
