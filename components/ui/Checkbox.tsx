/**
 * Checkbox — a small rounded-square multi-select tick.
 *
 * Shared by the cart's select-all header and each cart line. A rounded SQUARE
 * (literal radius 6 on a 22px box — Radius.sm would render a circle and read as
 * a radio) with a coral fill + white check when on. hitSlop lifts the 22px box
 * to the 44pt touch target.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Colors } from '@/constants/theme';

export type CheckboxProps = {
  checked: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Checkbox({ checked, onPress, accessibilityLabel }: CheckboxProps) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={11}
      onPress={onPress}
      style={[styles.box, checked && styles.boxOn]}>
      {checked ? (
        <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
