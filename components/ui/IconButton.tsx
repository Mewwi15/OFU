import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, Radius, Shadow } from '@/constants/theme';

export type IconButtonVariant = 'surface' | 'primary' | 'tint';

export type IconButtonShape = 'circle' | 'rounded';

export type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  /** Diameter of the circle in px. Defaults to 44. */
  size?: number;
  /** `surface` = white w/ soft shadow; `primary` = coral filled;
   *  `tint` = flat peach wash w/ coral icon (no shadow). */
  variant?: IconButtonVariant;
  /** `circle` (default) or `rounded` — squircle matching Radius.md chips. */
  shape?: IconButtonShape;
  /** Override the icon color. Defaults based on variant. */
  color?: string;
  /**
   * Screen-reader label (icon-only buttons are otherwise unnamed). Strongly
   * recommended at every call site, e.g. 'ลบสินค้า', 'เพิ่มในรายการโปรด'.
   */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Minimum accessible touch target (pt). */
const MIN_TOUCH = 44;

/**
 * Round icon button. `surface` renders a white circle with a soft shadow;
 * `primary` renders a coral-filled circle.
 */
export function IconButton({
  icon,
  onPress,
  size = 44,
  variant = 'surface',
  shape = 'circle',
  color,
  accessibilityLabel,
  disabled,
  style,
}: IconButtonProps) {
  const iconColor =
    color ??
    (variant === 'primary'
      ? Colors.textOnPrimary
      : variant === 'tint'
        ? Colors.primaryStrong
        : Colors.text);
  const background =
    variant === 'primary'
      ? Colors.primary
      : variant === 'tint'
        ? Colors.primaryTint
        : Colors.surface;
  const iconSize = Math.round(size * 0.5);
  // Expand the press area to the 44pt minimum when the circle is smaller.
  const slop = Math.max(0, Math.round((MIN_TOUCH - size) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={slop}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === 'rounded' ? Radius.md : Radius.pill,
          backgroundColor: background,
        },
        variant === 'surface' && Shadow.card,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
