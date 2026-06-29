/**
 * PinPad — the lock-screen number pad.
 *
 * Renders a row of `length` dots over a 3×4 on-screen keypad (1–9, an optional
 * biometric key, 0, delete). The parent owns the entered `value`; this component
 * just appends/pops digits and never exceeds `length`. Pass `error` to flash the
 * dots red and shake (auto-clears on the next keypress in the parent). Tokens
 * only, zero emoji, reduce-motion aware.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  length: number;
  error?: boolean;
  /** When set, the bottom-left key becomes a biometric trigger. */
  onBiometric?: () => void;
  biometricIcon?: keyof typeof Ionicons.glyphMap;
};

export function PinPad({
  value,
  onChange,
  length,
  error = false,
  onBiometric,
  biometricIcon = 'finger-print',
}: PinPadProps) {
  const reduceMotion = useReducedMotion();
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!error) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (reduceMotion) return;
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [error, reduceMotion, shake]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (digit: string) => {
    if (value.length >= length) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onChange(value + digit);
  };

  const del = () => {
    if (value.length === 0) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onChange(value.slice(0, -1));
  };

  return (
    <View style={styles.wrap}>
      {/* Dots */}
      <Animated.View style={[styles.dots, dotsStyle]}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                filled && styles.dotFilled,
                error && styles.dotError,
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Keypad */}
      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k}
            onPress={() => press(k)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        ))}

        {/* Bottom-left: biometric or spacer */}
        {onBiometric ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ปลดล็อกด้วยไบโอเมทริก"
            onPress={onBiometric}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
            <Ionicons name={biometricIcon} size={28} color={Colors.primaryStrong} />
          </Pressable>
        ) : (
          <View style={styles.key} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="0"
          onPress={() => press('0')}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
          <Text style={styles.keyText}>0</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ลบ"
          onPress={del}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
          <Ionicons name="backspace-outline" size={26} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const DOT = 16;
const KEY = 72;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.x3,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotError: {
    borderColor: Colors.dangerStrong,
    backgroundColor: Colors.dangerStrong,
  },
  pad: {
    width: KEY * 3 + Spacing.x2 * 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.lg,
    columnGap: Spacing.x2,
  },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  keyText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 28,
    color: Colors.text,
  },
});
