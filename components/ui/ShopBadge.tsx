import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type ShopBadgeProps = {
  /** Label text. Defaults to "ช้อป". */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Small coral pill with a bag icon + label. Designed to overlap the
 * bottom-left of product images (the parent positions it absolutely).
 */
export function ShopBadge({ label = 'ช้อป', style }: ShopBadgeProps) {
  return (
    <View style={[styles.badge, style]}>
      <Ionicons
        name="bag-outline"
        size={12}
        color={Colors.textOnPrimary}
        style={styles.icon}
      />
      <Text variant="caption" style={{ color: Colors.textOnPrimary }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.xs,
  },
});
