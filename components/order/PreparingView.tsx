/**
 * PreparingView — order tracking before the parcel/rider moves: the
 * "waiting for slip verification" state and the "shop is preparing" state.
 *
 * Redesigned for scannability (owner: the old screen "ดูยาก"): a 4-step
 * progress strip (ตรวจสลิป/ยืนยัน → เตรียมสินค้า → จัดส่ง → สำเร็จ), the shop
 * status card, an order-summary card (thumbnails + first item + total — the
 * old screen showed no order context at all), and the delivery address. The
 * promo upsell is gone. Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Breathing } from '@/components/ui/Breathing';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { TrackedOrder } from '@/data/fulfillment';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';

type Props = {
  order: TrackedOrder;
  onClose: () => void;
  /** Shown while the order can still be cancelled (before it ships). */
  onCancel?: () => void;
  /** Prepay order whose slip the shop hasn't approved yet — swap the copy to
      "waiting for slip verification" (Realtime flips it once approved). */
  awaitingSlip?: boolean;
};

const THUMB = 44;

/** Compact 4-step progress strip. Step 0 adapts to the payment flow. */
function StepStrip({ awaitingSlip, isSlipFlow }: { awaitingSlip: boolean; isSlipFlow: boolean }) {
  const t = useT();
  const steps = [
    isSlipFlow ? t('track.step.slip') : t('track.step.confirm'),
    t('track.step.prepare'),
    t('track.step.deliver'),
    t('track.step.done'),
  ];
  const current = awaitingSlip ? 0 : 1;
  return (
    <View style={styles.stepRow}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.stepCol}>
            <View style={styles.stepNodeRow}>
              <View style={[styles.stepLine, i === 0 && styles.stepLineHidden, (done || active) && styles.stepLineOn]} />
              {active ? (
                <Breathing amount={0.12} duration={1300} style={[styles.stepDot, styles.stepDotActive]}>
                  <View style={styles.stepDotCore} />
                </Breathing>
              ) : (
                <View style={[styles.stepDot, done && styles.stepDotDone]}>
                  {done ? <Ionicons name="checkmark" size={12} color={Colors.textOnPrimary} /> : null}
                </View>
              )}
              <View
                style={[styles.stepLine, i === steps.length - 1 && styles.stepLineHidden, done && styles.stepLineOn]}
              />
            </View>
            <Text
              variant="caption"
              numberOfLines={1}
              style={[styles.stepLabel, (done || active) && styles.stepLabelOn]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function PreparingView({ order, onClose, onCancel, awaitingSlip = false }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const isSlipFlow = order.paymentMethod === 'promptpay_slip';
  const images = (order.itemImages ?? []).slice(0, 3);
  // Lines, not units — "+4"/"และอีก 4 รายการ" on a 1-product ×5 order would mislead.
  const lineCount = order.lineCount ?? order.itemCount;
  const extra = lineCount - images.length;
  const restCount = lineCount - 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel={t('track.close')} onPress={onClose} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.x2 }]}>
        <Text variant="title" style={styles.title}>
          {awaitingSlip ? t('track.verifySlipTitle') : t('track.preparingTitle')}
        </Text>

        {/* Progress */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.stepCard}>
          <StepStrip awaitingSlip={awaitingSlip} isSlipFlow={isSlipFlow} />
        </Animated.View>

        {/* Shop / status card */}
        <Animated.View entering={FadeInDown.delay(70).springify().damping(18)} style={styles.shopCard}>
          <View style={styles.shopTop}>
            <View style={styles.shopAvatar}>
              <Ionicons name="storefront" size={20} color={Colors.primaryStrong} />
            </View>
            <Text style={styles.shopName} numberOfLines={1}>
              {order.shopName}
            </Text>
            <Breathing amount={0.05} duration={1300} style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {awaitingSlip ? t('track.verifySlipBadge') : t('track.preparingBadge')}
              </Text>
            </Breathing>
          </View>
          <View style={styles.noteRow}>
            <Ionicons
              name={awaitingSlip ? 'time-outline' : 'leaf'}
              size={18}
              color={Colors.accentStrong}
            />
            <Text variant="body" style={styles.noteText}>
              {awaitingSlip ? t('track.verifySlipBanner') : t('track.preparingBanner')}
            </Text>
          </View>
        </Animated.View>

        {/* Order summary — the old screen showed no order context at all */}
        <Animated.View entering={FadeInDown.delay(140).springify().damping(18)} style={styles.sumCard}>
          <View style={styles.sumHead}>
            <Text variant="caption" numberOfLines={1} style={styles.sumMeta}>
              #{order.id}
              {order.placedAtLabel ? ` · ${order.placedAtLabel}` : ''}
            </Text>
          </View>
          <View style={styles.sumBody}>
            {images.length > 0 ? (
              <View style={styles.thumbRow}>
                {images.map((uri, i) => (
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
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="bag-handle-outline" size={20} color={Colors.primaryStrong} />
              </View>
            )}
            <View style={styles.sumText}>
              <Text style={styles.sumName} numberOfLines={1}>
                {order.firstItemName ?? order.shopName}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {restCount > 0
                  ? `${t('orders.morePrefix')}${restCount}${t('orders.moreSuffix')}`
                  : `${order.itemCount} ${t('orders.itemsUnit')}`}
              </Text>
            </View>
          </View>
          <View style={styles.sumFoot}>
            <Text variant="caption">{t('orders.totalLabel')}</Text>
            <Text style={styles.sumTotal}>{money(order.total)}</Text>
          </View>
        </Animated.View>

        {/* Delivery address + ETA */}
        <Animated.View entering={FadeInDown.delay(210).springify().damping(18)} style={styles.addrCard}>
          <View style={styles.addrPin}>
            <Ionicons name="home" size={18} color={Colors.primaryStrong} />
          </View>
          <View style={styles.addrText}>
            <Text variant="caption">{t('track.deliverTo')}</Text>
            <Text style={styles.addrValue} numberOfLines={2}>
              {order.addressLine || order.addressLabel}
            </Text>
          </View>
          <View style={styles.etaChip}>
            <Text style={styles.etaChipText}>{order.etaShort}</Text>
          </View>
        </Animated.View>

        {onCancel ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('track.cancelOrderA11y')}
            onPress={onCancel}
            style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('track.cancelOrder')}</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
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
    paddingTop: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xl,
  },

  /* Step strip */
  stepCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
  },
  stepLineOn: {
    backgroundColor: Colors.primary,
  },
  stepLineHidden: {
    opacity: 0,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepDotActive: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCore: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  stepLabelOn: {
    color: Colors.primaryStrong,
    fontFamily: Typography.bodyStrong.fontFamily,
  },

  /* Shop card */
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
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
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentTint,
  },
  noteText: {
    flex: 1,
    color: Colors.text,
  },

  /* Order summary */
  sumCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  sumHead: {
    marginBottom: Spacing.md,
  },
  sumMeta: {
    color: Colors.textMuted,
  },
  sumBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sumText: {
    flex: 1,
    gap: 2,
  },
  sumName: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  sumFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  sumTotal: {
    ...Typography.subtitle,
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

  /* Address */
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  addrPin: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrText: {
    flex: 1,
    gap: 1,
  },
  addrValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  etaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  etaChipText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },

  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  cancelText: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
