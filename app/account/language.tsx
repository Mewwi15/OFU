/**
 * Language — `/account/language`.
 *
 * Phase 1: shows the language options (Thai active). The real i18n switch
 * (Thai/English across the app) lands in phase 2.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

const LANGS = [
  { code: 'th', label: 'ภาษาไทย', active: true },
  { code: 'en', label: 'English', active: false },
];

export default function LanguageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="เปลี่ยนภาษา"
        style={styles.header}
        left={<IconButton icon="chevron-back" accessibilityLabel="ย้อนกลับ" onPress={() => router.back()} />}
      />
      <View style={styles.content}>
        <View style={styles.card}>
          {LANGS.map((l, i) => (
            <Pressable
              key={l.code}
              accessibilityRole="button"
              accessibilityLabel={l.label}
              onPress={() =>
                l.active || Alert.alert('เร็วๆ นี้', 'รองรับภาษาอังกฤษเต็มรูปแบบเร็วๆ นี้')
              }
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
              <Text style={styles.rowLabel}>{l.label}</Text>
              {l.active ? (
                <Ionicons name="checkmark" size={20} color={Colors.primaryStrong} />
              ) : (
                <Text variant="caption" style={styles.soon}>
                  เร็วๆ นี้
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  content: { padding: Spacing.lg },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  pressed: { opacity: 0.6 },
  rowLabel: { ...Typography.bodyStrong, color: Colors.text },
  soon: { color: Colors.textMuted },
});
