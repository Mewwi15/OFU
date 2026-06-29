/**
 * AnimatedCounter — a number that counts up to `value` on the UI thread.
 *
 * Uses the reanimated animated-TextInput `text` trick so the tick runs off the
 * JS thread (no per-frame re-render). Renders as plain text (non-editable, no
 * focus). Pass a TextStyle to match the surrounding type.
 */

import { useEffect } from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  value: number;
  /** Count-up duration (ms). Defaults to 900. */
  duration?: number;
  style?: TextStyle | TextStyle[];
};

export function AnimatedCounter({ value, duration = 900, style }: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = value;
    } else {
      progress.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    }
  }, [value, duration, reduced, progress]);

  const animatedProps = useAnimatedProps(() => {
    // `text` isn't a typed TextInput prop — drive it via animatedProps.
    return { text: `${Math.round(progress.value)}` } as unknown as { value: string };
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      defaultValue={`${Math.round(value)}`}
      style={[styles.base, style]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 0,
    margin: 0,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
