/**
 * Skeleton — softly pulsing placeholder bar shown while a value loads, instead
 * of a dash or empty gap. Size it to roughly match the text it stands in for:
 *
 *   {identity ? <Text>{identity.email}</Text> : <Skeleton width={140} />}
 */

import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius } from '@/constants/theme';

export type SkeletonProps = {
  width: number;
  /** Bar height in px — default suits caption/body-sized text. */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width, height = 12, style }: SkeletonProps) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View style={[styles.bar, { width, height }, pulseStyle, style]} />;
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
  },
});
