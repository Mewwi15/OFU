/**
 * PromoBanner — a wide, image-backed promo card with a warm diagonal gradient
 * and a title / subtitle / pill CTA on the left. Used on the catalog screen
 * above each curated rail to head its section. With no photo it renders a
 * self-contained, on-brand coral card (soft glow + concentric-ring motif).
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { BANNER_ASPECT } from '@/lib/data/catalog';
import { useT } from '@/lib/i18n';

export type PromoBannerProps = {
  title: string;
  subtitle: string;
  /** Background photo. Omit for a clean on-brand coral gradient (no image). */
  image?: string;
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
      {image ? (
        <Image
          source={{ uri: image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
        />
      ) : null}
      {/* Over a photo: a light neutral scrim on the text side only (no colour
          tint) so the image shows true. No image: rich diagonal coral gradient. */}
      <LinearGradient
        colors={
          image
            ? ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)']
            : ['#C0421C', '#D6482A', '#F15E3C']
        }
        locations={image ? [0, 0.42, 0.7] : [0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={image ? { x: 1, y: 0 } : { x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* No photo → soft glow + concentric rings so the right side reads as a
          finished, designed card rather than an empty colour block. */}
      {!image ? (
        <View pointerEvents="none" style={styles.decor}>
          <View style={styles.glow} />
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMid]} />
          <View style={styles.ringDot} />
        </View>
      ) : null}
      {/* Subtle top sheen for depth (both variants). */}
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
        locations={[0, 0.6]}
        style={styles.sheen}
        pointerEvents="none"
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
          <Ionicons name="arrow-forward" size={13} color={Colors.primaryStrong} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    // Fixed display aspect (matches the admin crop for search-section banners),
    // so what the owner crops is exactly what shows here on every device.
    aspectRatio: BANNER_ASPECT.search_trending,
    marginTop: Spacing.xl,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
    ...Shadow.card,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    left: undefined,
    width: 210,
    right: -46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft radial-ish highlight behind the rings.
  glow: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  ring: {
    position: 'absolute',
    borderRadius: Radius.pill,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ringOuter: {
    width: 196,
    height: 196,
    borderWidth: 2,
  },
  ringMid: {
    width: 128,
    height: 128,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  ringDot: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    color: Colors.textOnPrimary,
    fontSize: 19,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.94)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.md - 2,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    ...Shadow.card,
  },
  ctaText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 12,
    color: Colors.primaryStrong,
  },
});
