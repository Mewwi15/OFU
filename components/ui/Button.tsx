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

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Ionicons name rendered before the title. */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

const HEIGHTS: Record<ButtonSize, number> = {
  sm: 40,
  md: 52,
};

const ICON_SIZE: Record<ButtonSize, number> = {
  sm: 16,
  md: 18,
};

function backgroundFor(variant: ButtonVariant, pressed: boolean): string {
  switch (variant) {
    case 'primary':
      return pressed ? Colors.primaryDark : Colors.primary;
    case 'secondary':
      return pressed ? Colors.border : Colors.primaryTint;
    case 'ghost':
      return 'transparent';
  }
}

function contentColorFor(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return Colors.textOnPrimary;
    case 'secondary':
    case 'ghost':
      return Colors.primary;
  }
}

/**
 * App button primitive. Presentational only — pass an `onPress` handler.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth,
  disabled,
  leftIcon,
  style,
}: ButtonProps) {
  const contentColor = contentColorFor(variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          paddingHorizontal: size === 'sm' ? Spacing.lg : Spacing.x2,
          backgroundColor: backgroundFor(variant, pressed),
        },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.content}>
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={ICON_SIZE[size]}
            color={contentColor}
            style={styles.icon}
          />
        ) : null}
        <AppText variant="button" color={contentColor}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.sm,
  },
});
