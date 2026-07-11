/**
 * ModeSwitch — pick between the two shopping flows (เดลิเวอรี่ / ออนไลน์).
 *
 *  - default: two large white cards (home) — circular tinted icon, title +
 *    tagline, accent ring + check on the selected one (delivery = green accent,
 *    online = orange accent).
 *  - `compact`: a single segmented track (cart/checkout) — a surfaceMuted pill
 *    rail with a white thumb sliding under the active segment. Unified on coral
 *    so green stays reserved for success/discount.
 *
 * Reads/writes the shared `useMode` store, so every instance stays in sync.
 */

import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { MODE_META, useMode, type ShopMode } from '@/store/mode';

const MODES = Object.values(MODE_META);

/** Per-mode accent (large cards only): delivery = green, online = orange. */
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

  /** Coming-soon modes stay visible but explain themselves instead of switching. */
  const onPick = (m: (typeof MODES)[number]) => {
    if (m.comingSoon) {
      Alert.alert(m.label, 'กำลังจะเปิดให้ใช้งานเร็วๆ นี้');
      return;
    }
    setMode(m.key);
  };

  /* Compact: one segmented track with a white active thumb. */
  if (compact) {
    return (
      <View style={[styles.track, style]}>
        {MODES.map((m) => {
          const active = m.key === mode;
          const icon = m.icon as keyof typeof Ionicons.glyphMap;
          const tint = active ? Colors.primaryStrong : Colors.textMuted;
          return (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              accessibilityState={
                m.comingSoon ? { disabled: true } : active ? { selected: true } : {}
              }
              accessibilityLabel={m.label}
              onPress={() => onPick(m)}
              style={[styles.segment, active && styles.segmentActive]}>
              <Ionicons name={icon} size={18} color={tint} style={m.comingSoon && styles.dim} />
              <Text style={[Typography.button, { color: tint }, m.comingSoon && styles.dim]}>
                {m.label}
              </Text>
              {m.comingSoon ? (
                <View style={styles.soonPill}>
                  <Text style={styles.soonText}>เร็วๆ นี้</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  /* Default: two large cards (home). */
  return (
    <View style={[styles.row, style]}>
      {MODES.map((m) => {
        const active = m.key === mode;
        const accent = ACCENT[m.key];
        const icon = m.icon as keyof typeof Ionicons.glyphMap;
        return (
          <Pressable
            key={m.key}
            onPress={() => onPick(m)}
            accessibilityState={m.comingSoon ? { disabled: true } : {}}
            style={[
              styles.card,
              active && { borderColor: accent.color, borderWidth: 2 },
            ]}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: accent.tint },
                m.comingSoon && styles.dim,
              ]}>
              <Ionicons name={icon} size={22} color={accent.color} />
            </View>
            <View style={styles.cardText}>
              <Text variant="subtitle" style={m.comingSoon && styles.dim}>
                {m.label}
              </Text>
              <Text variant="caption" style={{ color: Colors.textMuted }}>
                {m.tagline}
              </Text>
            </View>
            {m.comingSoon ? (
              <View style={[styles.soonPill, styles.soonPillCard]}>
                <Text style={styles.soonText}>เร็วๆ นี้</Text>
              </View>
            ) : active ? (
              <View style={[styles.check, { backgroundColor: accent.color }]}>
                <Ionicons name="checkmark" size={12} color={Colors.textOnPrimary} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Compact segmented track. */
  track: {
    flexDirection: 'row',
    padding: Spacing.xxs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    borderRadius: Radius.pill,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },

  /* Large cards (home). */
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
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

  /* Coming-soon treatment */
  dim: {
    opacity: 0.45,
  },
  soonPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  soonPillCard: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  soonText: {
    ...Typography.label,
    fontSize: 11,
    color: Colors.primaryStrong,
  },
});
