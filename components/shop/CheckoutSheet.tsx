/**
 * CheckoutSheet — a bottom-sheet order review that confirms with a SLIDE gesture.
 *
 * Tapping สั่งซื้อ on the cart raises this sheet (slides up over a dimmed
 * backdrop). It lists the ticked lines, the delivery fee and the ink grand
 * total, then asks the user to "รูดเพื่อสั่งซื้อ" — drag the white thumb across
 * the coral track to commit. Releasing before the end springs back; reaching the
 * end fires onConfirm. The handle can be dragged down (or the backdrop tapped) to
 * dismiss. Tokens-only, zero emoji.
 *
 * Note: gesture-handler needs its OWN GestureHandlerRootView inside a RN Modal —
 * the Modal renders in a separate native window outside the app's root provider.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeButton from 'rn-swipe-button';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { CartItem } from '@/store/cart';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  mode: 'delivery' | 'online';
  /** Slider verb, e.g. "สั่งซื้อ" / "ชำระเงิน". */
  verb: string;
};

/* ----------------------------------------------------------------------- */
/* Slide-to-confirm control (rn-swipe-button)                              */
/* ----------------------------------------------------------------------- */

const SWIPE_HEIGHT = 56;

function SlideToConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <SwipeButton
      height={SWIPE_HEIGHT}
      title={label}
      titleColor={Colors.primaryStrong}
      titleFontSize={16}
      titleStyles={styles.swipeTitle}
      railBackgroundColor={Colors.surfaceMuted}
      railBorderColor="transparent"
      railFillBackgroundColor={Colors.primaryTint}
      railFillBorderColor="transparent"
      thumbIconBackgroundColor={Colors.primary}
      thumbIconBorderColor={Colors.primary}
      thumbIconComponent={() => (
        <Ionicons name="arrow-forward" size={22} color={Colors.textOnPrimary} />
      )}
      onSwipeSuccess={() => onConfirm()}
      shouldResetAfterSuccess={false}
      swipeSuccessThreshold={70}
      containerStyles={styles.swipeContainer}
    />
  );
}

/* ----------------------------------------------------------------------- */
/* Sheet                                                                   */
/* ----------------------------------------------------------------------- */

export function CheckoutSheet({
  visible,
  onClose,
  onConfirm,
  items,
  subtotal,
  deliveryFee,
  total,
  mode,
  verb,
}: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [sheetH, setSheetH] = useState(560);

  const progress = useSharedValue(0); // 0 = hidden, 1 = open
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      setMounted(true);
      progress.value = withTiming(1, { duration: 280 });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetH + dragY.value }],
  }));

  // Drag the grab-handle down to dismiss.
  const drag = Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dragY.value > 110 || e.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 280 });
      }
    });

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={t('sheet.close')}
          onPress={onClose}
          style={[styles.backdrop, backdropStyle]}
        />
        <Animated.View
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + Spacing.lg }]}>
          {/* Grab handle (drag down to dismiss) */}
          <GestureDetector gesture={drag}>
            <View style={styles.handleHit}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>

          <Text variant="subtitle" style={styles.title}>
            {t('sheet.orderSummary')}
          </Text>

          {/* Selected lines */}
          <View style={styles.lines}>
            {items.map((it) => (
              <View key={it.id} style={styles.lineRow}>
                <Text variant="body" numberOfLines={1} style={styles.lineName}>
                  {it.product.name}
                  <Text style={styles.lineQty}>{`  × ${it.qty}`}</Text>
                </Text>
                <Text style={styles.lineValue}>{money(it.product.price * it.qty)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.hairline} />

          <View style={styles.sumRow}>
            <Text variant="body" style={styles.sumMuted}>
              {t('sheet.subtotal')}
            </Text>
            <Text style={styles.sumValue}>{money(subtotal)}</Text>
          </View>
          <View style={[styles.sumRow, styles.sumGap]}>
            <Text variant="body" style={styles.sumMuted}>
              {mode === 'delivery' ? t('sheet.deliveryFee') : t('sheet.flashFee')}
            </Text>
            {deliveryFee === 0 ? (
              <Text style={[styles.sumValue, { color: Colors.accentStrong }]}>
                {t('sheet.free')}
              </Text>
            ) : (
              <Text variant="body" style={{ color: Colors.text }}>
                {money(deliveryFee)}
              </Text>
            )}
          </View>

          <View style={styles.hairline} />

          <View style={styles.totalRow}>
            <Text variant="subtitle">{t('sheet.total')}</Text>
            <Text style={styles.grandTotal}>{money(total)}</Text>
          </View>

          {/* Slide to confirm */}
          <SlideToConfirm label={`${t('sheet.slidePrefix')}${verb}`} onConfirm={onConfirm} />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31,18,12,0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    // On web the Modal overlays the whole browser window (not the phone
    // frame) — keep the sheet phone-sized and centred on desktop.
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...Shadow.float,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
  },
  title: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },

  /* Lines */
  lines: {
    gap: Spacing.sm,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  lineName: {
    flex: 1,
    color: Colors.text,
  },
  lineQty: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  lineValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },

  hairline: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sumGap: {
    marginTop: Spacing.sm,
  },
  sumMuted: {
    color: Colors.textMuted,
  },
  sumValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  grandTotal: {
    ...Typography.title,
    color: Colors.text,
  },

  /* Slide-to-confirm (rn-swipe-button) */
  swipeContainer: {
    borderRadius: SWIPE_HEIGHT / 2,
  },
  swipeTitle: {
    fontFamily: 'Mitr_500Medium',
  },
});
