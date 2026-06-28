import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** Lower bound (inclusive). Defaults to 1. */
  min?: number;
  /** Upper bound (inclusive). Optional. */
  max?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Minus / value / plus stepper. The minus button uses a light tinted fill;
 * the plus button is coral filled with a white "+". The value gives a small
 * bounce each time it changes.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  style,
}: QuantityStepperProps) {
  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  // Pop the number on every change.
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = withSequence(
      withTiming(1.3, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 300 }),
    );
  }, [value, pop]);

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const decrement = () => {
    if (canDecrement) onChange(value - 1);
  };
  const increment = () => {
    if (canIncrement) onChange(value + 1);
  };

  return (
    <View style={[styles.row, style]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="ลดจำนวน"
        hitSlop={6}
        disabled={!canDecrement}
        onPress={decrement}
        style={[styles.button, styles.minus, !canDecrement && styles.disabled]}>
        <Ionicons name="remove" size={18} color={Colors.text} />
      </PressableScale>

      <Animated.View style={valueStyle}>
        <Text variant="subtitle" style={styles.value}>
          {value}
        </Text>
      </Animated.View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="เพิ่มจำนวน"
        hitSlop={6}
        disabled={!canIncrement}
        onPress={increment}
        style={[styles.button, styles.plus, !canIncrement && styles.disabled]}>
        <Ionicons name="add" size={18} color={Colors.textOnPrimary} />
      </PressableScale>
    </View>
  );
}

const SIZE = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minus: {
    backgroundColor: Colors.primaryTint,
  },
  plus: {
    backgroundColor: Colors.primary,
  },
  value: {
    minWidth: SIZE,
    marginHorizontal: Spacing.sm,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
