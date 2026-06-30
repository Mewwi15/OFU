/**
 * Legal — `/account/legal`.
 *
 * Terms of use + PDPA privacy summary. Placeholder copy for v1 — the owner
 * should replace it with lawyer-reviewed text before launch.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';

const SECTION_KEYS = ['s1', 's2', 's3', 's4'];

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('legal.title')}
        style={styles.header}
        left={<IconButton icon="chevron-back" accessibilityLabel="back" onPress={() => router.back()} />}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.x2 }]}>
        {SECTION_KEYS.map((k) => (
          <View key={k} style={styles.card}>
            <Text style={styles.cardTitle}>{t(`legal.${k}.title`)}</Text>
            <Text variant="body" style={styles.cardBody}>
              {t(`legal.${k}.body`)}
            </Text>
          </View>
        ))}
        <Text variant="caption" style={styles.note}>
          {t('legal.note')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  cardTitle: { ...Typography.bodyStrong, color: Colors.text, marginBottom: Spacing.xs },
  cardBody: { color: Colors.textMuted, lineHeight: 22 },
  note: { color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },
});
