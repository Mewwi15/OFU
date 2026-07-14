/**
 * Legal — `/account/legal`.
 *
 * Terms of use + PDPA privacy summary. The sections below are a short
 * in-app summary, not the full legal text — the actual, kept-in-sync privacy
 * policy is hosted on the admin domain (required for both stores' privacy
 * links) and linked at the bottom via lib/legal.ts, the same URL the desktop
 * web footer uses.
 */

import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { PRIVACY_URL } from '@/lib/legal';

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
        left={
          <IconButton
            icon="chevron-back"
            variant="tint"
            shape="rounded"
            size={40}
            accessibilityLabel="back"
            onPress={() => router.back()}
          />
        }
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
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(PRIVACY_URL)}
          style={styles.fullPolicyButton}>
          <Text style={styles.fullPolicyText}>{t('legal.readFull')}</Text>
        </Pressable>
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
  fullPolicyButton: {
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPolicyText: { ...Typography.button, color: Colors.primaryStrong },
  note: { color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },
});
