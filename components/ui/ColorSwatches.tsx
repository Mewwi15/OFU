import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type ColorSwatchesProps = {
  /** Hex color strings to render as dots. */
  colors: string[];
  /** Currently selected color (hex). Enables the selected ring. */
  selected?: string;
  /** When provided, swatches become pressable/selectable. */
  onSelect?: (color: string) => void;
  /** Dot diameter in px. Defaults to 18. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A row of color dots. If `onSelect` is provided the dots are pressable and
 * the `selected` dot gets a coral ring.
 */
export function ColorSwatches({
  colors,
  selected,
  onSelect,
  size = 18,
  style,
}: ColorSwatchesProps) {
  return (
    <View style={[styles.row, style]}>
      {colors.map((color) => {
        const isSelected = selected === color;
        const dot = (
          <View
            style={[
              styles.ring,
              {
                width: size + 6,
                height: size + 6,
                borderRadius: Radius.pill,
                borderColor: isSelected ? Colors.primary : 'transparent',
              },
            ]}>
            <View
              style={[
                styles.dot,
                {
                  width: size,
                  height: size,
                  borderRadius: Radius.pill,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        );

        if (!onSelect) {
          return (
            <View key={color} style={styles.item}>
              {dot}
            </View>
          );
        }

        return (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(color)}
            style={({ pressed }) => [
              styles.item,
              pressed && styles.pressed,
            ]}>
            {dot}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    marginRight: Spacing.xs,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dot: {
    borderWidth: 1,
    borderColor: Colors.swatchBorder,
  },
  pressed: {
    opacity: 0.7,
  },
});
