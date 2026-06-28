/**
 * PromoBanner — a wide, image-backed promo card with a warm left-to-right
 * gradient and a title / subtitle / pill CTA on the left. Used on the catalog
 * screen above each curated rail to head its section.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

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
  cta = 'ดูเลย',
  onPress,
}: PromoBannerProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
          <Text style={styles.ctaText}>{cta}</Text>
        </View>
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.92,
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
