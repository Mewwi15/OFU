/**
 * Custom floating tab bar for the expo-router `<Tabs>` navigator (Oroshi style).
 *
 * Floating white rounded bar with a soft shadow. Each tab stacks an icon over a
 * Thai label; the active tab turns coral (brand) with a short top indicator bar,
 * inactive tabs are muted gray. Tapping fires a light haptic.
 */

import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta = {
  /** Thai label shown under the icon (also the accessibility label). */
  label: string;
  active: IconName;
  inactive: IconName;
};

/** Per-route icon pair + Thai label, keyed by the route file name. */
const TABS: Record<string, TabMeta> = {
  index: { label: 'หน้าหลัก', active: 'home', inactive: 'home-outline' },
  search: { label: 'สินค้า', active: 'grid', inactive: 'grid-outline' },
  cart: { label: 'ตะกร้า', active: 'cart', inactive: 'cart-outline' },
  wishlist: { label: 'รายการโปรด', active: 'heart', inactive: 'heart-outline' },
  account: { label: 'บัญชี', active: 'person', inactive: 'person-outline' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, Spacing.md) },
      ]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const meta = TABS[route.name];
          const isFocused = state.index === index;

          // Skip any route we don't have metadata for (defensive).
          if (!meta) return null;

          const onPress = () => {
            if (Platform.OS !== 'web') {
              Haptics.selectionAsync();
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const tint = isFocused ? Colors.primary : Colors.textMuted;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ?? meta.label
              }
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}>
              <View
                style={[
                  styles.indicator,
                  isFocused && styles.indicatorActive,
                ]}
              />
              <Ionicons
                name={isFocused ? meta.active : meta.inactive}
                size={24}
                color={tint}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: isFocused ? Colors.primaryStrong : Colors.textMuted },
                ]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  bar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    ...Shadow.card,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
  },
  itemPressed: {
    opacity: 0.6,
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: Radius.pill,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 11,
    lineHeight: 14,
  },
});
