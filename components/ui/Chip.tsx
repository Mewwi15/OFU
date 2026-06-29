import type { ReactNode } from 'react';
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
  /** Optional leading element (e.g. a category icon) shown before the label. */
  leading?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Category filter pill.
 */
export function Chip({ label, active, leading, onPress, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        leading ? styles.chipWithLeading : null,
        active ? styles.chipActive : styles.chipInactive,
        pressed && styles.pressed,
        style,
      ]}>
      {leading}
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
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  chipWithLeading: {
    // Tighter left inset so the icon sits closer to the pill edge.
    paddingLeft: Spacing.xs,
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
