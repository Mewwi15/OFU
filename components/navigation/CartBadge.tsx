/**
 * CartBadge — the little coral count bubble pinned to the cart tab icon. Reads
 * the cart store directly so only the badge re-renders as quantities change,
 * and gives a small pop each time the total changes. Renders nothing when the
 * cart is empty.
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Colors } from '@/constants/theme';
import { cartCount, useCart } from '@/store/cart';

export function CartBadge() {
  const count = useCart((s) => cartCount(s.items));

  const scale = useSharedValue(0);

  useEffect(() => {
    // Pop in on the first item, give a quick bounce on every later change,
    // and shrink away when the cart empties.
    scale.value =
      count === 0
        ? withTiming(0, { duration: 140 })
        : withSequence(
            withTiming(1.25, { duration: 130 }),
            withSpring(1, { damping: 9, stiffness: 320 }),
          );
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (count === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.badge, animatedStyle]}
      accessibilityElementsHidden>
      <Text style={styles.text}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.surface,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 10,
    lineHeight: 13,
    color: Colors.textOnPrimary,
  },
});
