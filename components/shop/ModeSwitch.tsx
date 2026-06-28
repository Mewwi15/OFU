/**
 * ModeSwitch — pick between the two shopping flows (เดลิเวอรี่ / ออนไลน์).
 *
 * 7-Eleven "7 Delivery / ALL Online" look: white rounded cards, a circular
 * tinted icon badge, title + tagline, and a colored ring + check on the
 * selected one. Each mode has its own accent (delivery = green, online =
 * orange). `compact` renders small pills for the cart/checkout header. Reads and
 * writes the shared `useMode` store, so every instance stays in sync.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { MODE_META, useMode, type ShopMode } from '@/store/mode';

const MODES = Object.values(MODE_META);

/** Per-mode accent: delivery = 7-Eleven green, online = warm orange. */
const ACCENT: Record<ShopMode, { color: string; tint: string }> = {
  delivery: { color: Colors.primaryStrong, tint: Colors.primaryTint },
  online: { color: Colors.accentStrong, tint: Colors.accentTint },
};

type Props = {
  compact?: boolean;
  style?: ViewStyle;
};

export function ModeSwitch({ compact = false, style }: Props) {
  const mode = useMode((s) => s.mode);
  const setMode = useMode((s) => s.setMode);

  return (
    <View style={[styles.row, style]}>
      {MODES.map((m) => {
        const active = m.key === mode;
        const accent = ACCENT[m.key];
        const icon = m.icon as keyof typeof Ionicons.glyphMap;

        /* Compact pill (cart/checkout). */
        if (compact) {
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[
                styles.pill,
                active
                  ? { backgroundColor: accent.color }
                  : styles.pillInactive,
              ]}>
              <Ionicons
                name={icon}
                size={18}
                color={active ? Colors.textOnPrimary : accent.color}
              />
              <Text
                variant="subtitle"
                style={{ color: active ? Colors.textOnPrimary : Colors.text }}>
                {m.label}
              </Text>
            </Pressable>
          );
        }

        /* Large card (home). */
        return (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={[
              styles.card,
              active && { borderColor: accent.color, borderWidth: 2 },
            ]}>
            <View style={[styles.iconBadge, { backgroundColor: accent.tint }]}>
              <Ionicons name={icon} size={22} color={accent.color} />
            </View>
            <View style={styles.cardText}>
              <Text variant="subtitle">{m.label}</Text>
              <Text variant="caption" style={{ color: Colors.textMuted }}>
                {m.tagline}
              </Text>
            </View>
            {active && (
              <View style={[styles.check, { backgroundColor: accent.color }]}>
                <Ionicons name="checkmark" size={12} color={Colors.textOnPrimary} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  /* Large card (home). */
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadow.card,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
  },
  check: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Small pill (cart/checkout). */
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  pillInactive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
