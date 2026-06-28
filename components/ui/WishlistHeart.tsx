/**
 * WishlistHeart — the coral heart toggle with a little "pop" bounce + haptic
 * tick on tap. Centralises the wishlist interaction so the grid card and the
 * product detail screen behave identically.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useWishlist } from '@/store/wishlist';

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

export type WishlistHeartProps = {
  productId: string;
  /** Icon size in px. Defaults to 22. */
  size?: number;
  /** Heart color. Defaults to brand coral. */
  color?: string;
  hitSlop?: number;
};

export function WishlistHeart({
  productId,
  size = 22,
  color = Colors.primary,
  hitSlop = 10,
}: WishlistHeartProps) {
  const wishlisted = useWishlist((s) => s.ids.includes(productId));
  const toggle = useWishlist((s) => s.toggle);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPress = () => {
    // Overshoot when adding (a satisfying pop), a gentler dip when removing.
    scale.value = wishlisted
      ? withSequence(withTiming(0.85, { duration: 90 }), withSpring(1))
      : withSequence(
          withTiming(1.35, { duration: 130 }),
          withSpring(1, { damping: 8, stiffness: 320 }),
        );
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggle(productId);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={wishlisted ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
      hitSlop={hitSlop}
      onPress={onPress}>
      <AnimatedIcon
        name={wishlisted ? 'heart' : 'heart-outline'}
        size={size}
        color={color}
        style={animatedStyle}
      />
    </Pressable>
  );
}
