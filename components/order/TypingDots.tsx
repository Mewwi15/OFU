/**
 * TypingDots — a rider "กำลังพิมพ์..." bubble with three dots bouncing in a
 * staggered loop. Rendered as a left-aligned (rider) chat bubble. Tokens-only.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';

function Dot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, reduced, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * 4 }],
    opacity: 0.4 + t.value * 0.6,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export function TypingDots() {
  const reduced = useReducedMotion();
  return (
    <View style={styles.bubble}>
      <Dot delay={0} reduced={reduced} />
      <Dot delay={160} reduced={reduced} />
      <Dot delay={320} reduced={reduced} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.textMuted,
  },
});
