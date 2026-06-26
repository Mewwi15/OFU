import { Text, type StyleProp, type TextStyle } from 'react-native';

import { Colors, Typography, type TypographyVariant } from '@/constants/theme';

export type AppTextProps = {
  /** Typography variant from the design system. Defaults to `body`. */
  variant?: TypographyVariant;
  /** Text color. Defaults to the primary text token. */
  color?: string;
  /** Extra style overrides (applied last). */
  style?: StyleProp<TextStyle>;
  /** Truncate to N lines with an ellipsis. */
  numberOfLines?: number;
  children?: React.ReactNode;
};

/**
 * The single text primitive for the app. Screens MUST use `AppText` (never a
 * raw `<Text>`) so typography stays consistent with the design tokens.
 */
export function AppText({
  variant = 'body',
  color = Colors.text,
  style,
  numberOfLines,
  children,
}: AppTextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[Typography[variant], { color }, style]}>
      {children}
    </Text>
  );
}
