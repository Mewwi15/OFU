/**
 * DesktopProductCard — grid card for the desktop-web storefront (home +
 * catalog). Square photo, name, subtitle, price; whole card routes to the
 * product page. Width is driven by the parent grid via `style`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';

type Props = {
  product: Product;
  style?: StyleProp<ViewStyle>;
};

export function DesktopProductCard({ product, style }: Props) {
  const t = useT();
  const router = useRouter();
  const soldOut =
    product.variants.length > 0 && product.variants.every((v) => (v.available ?? 0) <= 0);

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={product.name}
      scaleTo={0.985}
      onPress={() => router.push(`/product/${product.id}`)}
      style={[styles.card, style]}>
      <View style={styles.photoWrap}>
        {product.images[0] ? (
          <Image
            source={{ uri: product.images[0] }}
            style={styles.photo}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.photoFallback}>
            <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
          </View>
        )}
        {soldOut ? (
          <View style={styles.soldOutPill}>
            <Text style={styles.soldOutText}>{t('site.soldOut')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text variant="caption" style={styles.category}>
          {product.category}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        {product.subtitle ? (
          <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
            {product.subtitle}
          </Text>
        ) : null}
        <Text style={styles.price}>{money(product.price)}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutPill: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(31,18,12,0.72)',
  },
  soldOutText: {
    ...Typography.caption,
    color: Colors.textOnPrimary,
  },
  body: {
    padding: Spacing.md,
    gap: 2,
  },
  category: {
    color: Colors.textMuted,
  },
  name: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  subtitle: {
    color: Colors.textMuted,
  },
  price: {
    ...Typography.price,
    color: Colors.primaryStrong,
    marginTop: Spacing.xs,
  },
});
