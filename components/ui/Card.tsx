import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

export type CardProps = {
  children?: React.ReactNode;
  /** Inner padding in px. Defaults to 16 (Spacing.lg). */
  padding?: number;
  /** Corner radius in px. Defaults to 20 (Radius.lg). */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * White surface wrapper with a soft shadow and rounded corners.
 */
export function Card({
  children,
  padding = Spacing.lg,
  radius = Radius.lg,
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        { padding, borderRadius: radius },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
});
