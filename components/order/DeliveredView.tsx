/**
 * DeliveredView — order-tracking state 3 ("จัดส่งสำเร็จ" + rating).
 *
 * The order-complete card, delivery details (address / time / rider), and a
 * tappable 5-star rating with a free-text note. Submitting records the rating.
 * Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { TrackedOrder } from '@/data/fulfillment';
import { money } from '@/lib/format';

const MAX_STARS = 5;

/** One tappable star that pops when it (or a higher star) is selected. */
function RatingStar({
  index,
  selected,
  onPress,
}: {
  index: number;
  selected: boolean;
  onPress: (value: number) => void;
}) {
  const scale = useSharedValue(1);

  // Pop with a staggered cascade whenever this star becomes filled.
  useEffect(() => {
    if (selected) {
      scale.value = withDelay(
        index * 45,
        withSequence(withTiming(1.32, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 220 })),
      );
    }
  }, [selected, index, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`ให้ ${index + 1} ดาว`}
      hitSlop={6}
      onPress={() => onPress(index + 1)}
      style={styles.starHit}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={selected ? 'star' : 'star-outline'}
          size={36}
          color={selected ? Colors.primary : Colors.borderStrong}
        />
      </Animated.View>
    </Pressable>
  );
}

type Props = {
  order: TrackedOrder;
  onClose: () => void;
  onChat: () => void;
  onCall: () => void;
  onSubmit: (stars: number, comment: string) => void;
};

export function DeliveredView({ order, onClose, onChat, onCall, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.x2 },
        ]}>
        <View style={styles.header}>
          <IconButton icon="close" accessibilityLabel="ปิด" onPress={onClose} />
        </View>

        <Text variant="title" style={styles.title}>
          ขอบคุณที่อุดหนุนนะ!
        </Text>

        {/* Order-complete card */}
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={styles.shopAvatar}>
              <Ionicons name="storefront" size={20} color={Colors.primaryStrong} />
            </View>
            <Text style={styles.shopName} numberOfLines={1}>
              {order.shopName}
            </Text>
            <View style={styles.idPill}>
              <Text style={styles.idPillText}>#{order.id}</Text>
            </View>
          </View>
          <View style={styles.orderBottom}>
            <View style={styles.orderLeft}>
              <Text variant="caption">ยอดที่ชำระ · {money(order.total)}</Text>
              <View style={styles.deliveredRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.accentStrong} />
                <Text style={styles.deliveredText}>จัดส่งสำเร็จ</Text>
              </View>
            </View>
            <View style={styles.orderIcon}>
              <Ionicons name="basket" size={26} color={Colors.primary} />
            </View>
          </View>
        </Animated.View>

        {/* Delivery details */}
        <Animated.View entering={FadeInDown.delay(160).springify().damping(18)} style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text variant="caption">ที่อยู่</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {order.addressLine}
            </Text>
          </View>
          <View style={[styles.detailRow, styles.detailRowGap]}>
            <Text variant="caption">ส่งถึงเมื่อ</Text>
            <Text style={styles.detailValue}>{order.deliveredAt ?? '-'}</Text>
          </View>

          <View style={styles.detailHairline} />

          <View style={styles.deliveredByRow}>
            <Image source={{ uri: order.rider.avatar }} style={styles.riderAvatar} contentFit="cover" />
            <View style={styles.riderInfo}>
              <Text variant="caption">จัดส่งโดยไรเดอร์อู้ฟู่</Text>
              <View style={styles.riderNameRow}>
                <Text style={styles.riderName} numberOfLines={1}>
                  {order.rider.name}
                </Text>
                <Ionicons name="shield-checkmark" size={14} color={Colors.primaryStrong} />
              </View>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="แชทกับไรเดอร์"
              onPress={onChat}
              style={styles.riderAction}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.primaryStrong} />
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="โทรหาไรเดอร์"
              onPress={onCall}
              style={styles.riderAction}>
              <Ionicons name="call-outline" size={20} color={Colors.primaryStrong} />
            </PressableScale>
          </View>
        </Animated.View>

        {/* Rating */}
        <Animated.View entering={FadeInDown.delay(240).springify().damping(18)} style={styles.ratingCard}>
          <Text variant="subtitle" style={styles.ratingTitle}>
            ให้คะแนนประสบการณ์
          </Text>
          <View style={styles.starsRow}>
            {Array.from({ length: MAX_STARS }).map((_, i) => (
              <RatingStar key={i} index={i} selected={i < stars} onPress={setStars} />
            ))}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="เล่าให้เราฟังหน่อย..."
            placeholderTextColor={Colors.textMuted}
            multiline
            style={styles.commentInput}
          />

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="ส่งคะแนน"
            disabled={stars === 0}
            onPress={() => onSubmit(stars, comment.trim())}
            style={[styles.submitBtn, stars === 0 && styles.submitBtnOff]}>
            <Text style={styles.submitText}>ส่งคะแนน</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.sm,
  },
  title: {
    marginBottom: Spacing.xl,
  },

  /* Order card */
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  orderTop: {
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
  idPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  idPillText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },
  orderBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  orderLeft: {
    flex: 1,
    gap: Spacing.xs,
  },
  deliveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deliveredText: {
    ...Typography.subtitle,
    color: Colors.text,
  },
  orderIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Detail card */
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  detailRowGap: {
    marginTop: Spacing.sm,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  detailHairline: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  deliveredByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  riderInfo: {
    flex: 1,
    gap: 1,
  },
  riderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  riderName: {
    ...Typography.bodyStrong,
    color: Colors.text,
    flexShrink: 1,
  },
  riderAction: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Rating */
  ratingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  ratingTitle: {
    marginBottom: Spacing.lg,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x2,
    marginBottom: Spacing.lg,
  },
  starHit: {
    padding: Spacing.xs,
  },
  commentInput: {
    ...Typography.body,
    minHeight: 96,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    color: Colors.text,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  submitBtnOff: {
    opacity: 0.45,
  },
  submitText: {
    ...Typography.button,
    fontSize: 16,
    color: Colors.textOnPrimary,
  },
});
