/**
 * PressableScale — a drop-in Pressable that springs slightly smaller while held,
 * giving every card / tile a tactile "squish". Wraps reanimated so call sites
 * stay declarative: use it exactly like a <Pressable>, minus the function-style
 * form (pass a plain style array instead).
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Springs shared across press interactions — snappy in, soft settle out. */
const PRESS_IN = { damping: 18, stiffness: 420, mass: 0.5 };
const PRESS_OUT = { damping: 16, stiffness: 280, mass: 0.7 };

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  children?: ReactNode;
  /** Scale while pressed. Defaults to 0.96. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  children,
  scaleTo = 0.96,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.value = withSpring(scaleTo, PRESS_IN);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    scale.value = withSpring(1, PRESS_OUT);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
