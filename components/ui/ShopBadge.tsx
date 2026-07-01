import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

export type ShopBadgeProps = {
  /** Label text. Defaults to the localized "Shop". */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Small coral pill with a bag icon + label. Designed to overlap the
 * bottom-left of product images (the parent positions it absolutely).
 */
export function ShopBadge({ label, style }: ShopBadgeProps) {
  const t = useT();
  const text = label ?? t('ui.shop');
  return (
    <View style={[styles.badge, style]}>
      <Ionicons
        name="bag-outline"
        size={12}
        color={Colors.textOnPrimary}
        style={styles.icon}
      />
      <Text variant="caption" style={{ color: Colors.textOnPrimary }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryStrong,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.xs,
  },
});
