import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/Text';
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
 * the plus button is coral filled with a white "+".
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

  const decrement = () => {
    if (canDecrement) onChange(value - 1);
  };
  const increment = () => {
    if (canIncrement) onChange(value + 1);
  };

  return (
    <View style={[styles.row, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={!canDecrement}
        onPress={decrement}
        style={({ pressed }) => [
          styles.button,
          styles.minus,
          pressed && styles.pressed,
          !canDecrement && styles.disabled,
        ]}>
        <Ionicons name="remove" size={18} color={Colors.text} />
      </Pressable>

      <AppText variant="h2" style={styles.value}>
        {value}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={!canIncrement}
        onPress={increment}
        style={({ pressed }) => [
          styles.button,
          styles.plus,
          pressed && styles.pressed,
          !canIncrement && styles.disabled,
        ]}>
        <Ionicons name="add" size={18} color={Colors.textOnPrimary} />
      </Pressable>
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
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
