/**
 * Breathing — wraps children in a gentle, looping "breathing" scale to signal an
 * in-progress / live state (e.g. the preparing bike, a pulsing status chip).
 * Respects the OS reduce-motion setting (loop disabled → static). Tokens-only.
 */

import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  /** Run the loop. Defaults to true. */
  active?: boolean;
  /** Peak extra scale at the top of the breath. Defaults to 0.08 (=> 1.08x). */
  amount?: number;
  /** One full breath duration (ms). Defaults to 1600. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export function Breathing({ children, active = true, amount = 0.08, duration = 1600, style }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (active && !reduced) {
      t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      t.value = withTiming(0, { duration: 200 });
    }
  }, [active, reduced, duration, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * amount }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
