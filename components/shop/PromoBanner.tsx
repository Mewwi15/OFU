/**
 * PromoBanner — a wide, image-backed promo card with a warm left-to-right
 * gradient and a title / subtitle / pill CTA on the left. Used on the catalog
 * screen above each curated rail to head its section.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

export type PromoBannerProps = {
  title: string;
  subtitle: string;
  image: string;
  /** Pill label (defaults to "ดูเลย"). */
  cta?: string;
  onPress?: () => void;
};

export function PromoBanner({
  title,
  subtitle,
  image,
  cta,
  onPress,
}: PromoBannerProps) {
  const t = useT();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title} ${subtitle}`}
      onPress={onPress}
      scaleTo={0.975}
      style={styles.card}>
      <Image
        source={{ uri: image }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
      />
      {/* Warm scrim: opaque coral on the text side → clear over the image. */}
      <LinearGradient
        colors={['rgba(184,60,24,0.94)', 'rgba(184,60,24,0.55)', 'rgba(241,89,41,0.12)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text variant="subtitle" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text variant="caption" numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{cta ?? t('widget.viewNow')}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 124,
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
    ...Shadow.card,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    color: Colors.textOnPrimary,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
  },
  cta: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  ctaText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 12,
    color: Colors.primaryStrong,
  },
});
