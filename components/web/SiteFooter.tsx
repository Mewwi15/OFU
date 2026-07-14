/**
 * SiteFooter — desktop-web page footer (brand line + policy links).
 * Rendered at the bottom of the full-bleed desktop pages' scroll content.
 */

import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { DELETE_ACCOUNT_URL, PRIVACY_URL } from '@/lib/legal';

export function SiteFooter() {
  const t = useT();
  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        <Text style={styles.copy}>{t('site.copyright')}</Text>
        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.link}>{t('site.privacy')}</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}>
            <Text style={styles.link}>{t('site.deleteAccount')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: Spacing.xl * 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  copy: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  link: {
    ...Typography.caption,
    color: Colors.primaryStrong,
  },
  dot: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
