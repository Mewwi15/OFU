/**
 * Custom floating tab bar (icons only) for the expo-router `<Tabs>` navigator.
 *
 * Receives React Navigation `BottomTabBarProps`. Renders a floating white
 * rounded bar with a soft shadow. A single coral circle slides (spring) to sit
 * behind the ACTIVE tab's filled white icon; inactive tabs show a muted outline
 * icon. Tapping a tab fires a light haptic; pressing dims the icon. No labels.
 */

import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta = {
  /** Accessibility label (not displayed — the bar is icons only). */
  label: string;
  active: IconName;
  inactive: IconName;
};

/** Per-route icon pair + a11y label, keyed by the route file name. */
const TABS: Record<string, TabMeta> = {
  index: { label: 'หน้าหลัก', active: 'home', inactive: 'home-outline' },
  search: { label: 'ค้นหา', active: 'search', inactive: 'search-outline' },
  cart: { label: 'ตะกร้า', active: 'cart', inactive: 'cart-outline' },
  wishlist: { label: 'รายการโปรด', active: 'heart', inactive: 'heart-outline' },
  account: { label: 'บัญชี', active: 'person', inactive: 'person-outline' },
};

const INDICATOR_SIZE = 46;
const SPRING = { damping: 15, stiffness: 180, mass: 0.6 };

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Width of the inner (padding-free) row, used to place the sliding indicator.
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  // Skip the entrance animation on the very first measurement.
  const settled = useRef(false);

  const count = state.routes.length;
  const tabWidth = rowWidth > 0 ? rowWidth / count : 0;

  useEffect(() => {
    if (tabWidth <= 0) return;
    const center = state.index * tabWidth + tabWidth / 2;
    const target = center - INDICATOR_SIZE / 2;
    if (settled.current) {
      indicatorX.value = withSpring(target, SPRING);
    } else {
      indicatorX.value = target;
      settled.current = true;
    }
  }, [state.index, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const onRowLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, Spacing.md) },
      ]}>
      <View style={styles.bar}>
        <View style={styles.row} onLayout={onRowLayout}>
          {/* Sliding active indicator (behind the icons) */}
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, indicatorStyle]}
            />
          ) : null}

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
                <Ionicons
                  name={isFocused ? meta.active : meta.inactive}
                  size={isFocused ? 24 : 26}
                  color={isFocused ? Colors.textOnPrimary : Colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    height: INDICATOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    opacity: 0.55,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
});
