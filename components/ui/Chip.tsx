import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type ChipProps = {
  label: string;
  /** Active = coral filled w/ white text; inactive = white w/ border. */
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Category filter pill.
 */
export function Chip({ label, active, onPress, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        pressed && styles.pressed,
        style,
      ]}>
      <Text
        variant="body"
        style={{
          fontFamily: 'Mitr_500Medium',
          color: active ? Colors.textOnPrimary : Colors.text,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primaryStrong,
  },
  chipInactive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
});
