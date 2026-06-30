/**
 * Language — `/account/language`. Switches the app language (Thai/English),
 * persisted in the locale store; screens using `useT` re-render immediately.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useLocale, type Lang } from '@/store/locale';

export default function LanguageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const setLang = useLocale((s) => s.setLang);

  const langs: { code: Lang; label: string }[] = [
    { code: 'th', label: t('language.thai') },
    { code: 'en', label: t('language.english') },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('language.title')}
        style={styles.header}
        left={<IconButton icon="chevron-back" accessibilityLabel="back" onPress={() => router.back()} />}
      />
      <View style={styles.content}>
        <View style={styles.card}>
          {langs.map((l, i) => (
            <Pressable
              key={l.code}
              accessibilityRole="button"
              accessibilityLabel={l.label}
              onPress={() => setLang(l.code)}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
              <Text style={styles.rowLabel}>{l.label}</Text>
              {l.code === lang ? (
                <Ionicons name="checkmark" size={20} color={Colors.primaryStrong} />
              ) : null}
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
});
