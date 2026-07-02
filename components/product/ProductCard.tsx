/**
 * ProductCard — the 2-column grid card (Oroshi "Explore" frame).
 *
 * White card with the product image filling the top edge-to-edge (rounded only
 * at the top), then a padded info area: name and a meta row (coral star · rating
 * · price). Tapping the card opens the details.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';

export type ProductCardProps = {
  product: Product;
  style?: StyleProp<ViewStyle>;
  /** Position in its list — staggers the entrance fade. */
  index?: number;
};

export function ProductCard({ product, style, index = 0 }: ProductCardProps) {
  const router = useRouter();

  const open = () => router.push(`/product/${product.id}`);
  const soldOut = product.variants.length > 0 && product.variants.every((v) => (v.available ?? 0) <= 0);

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 8) * 55).duration(320)}
      style={[styles.wrapper, style]}>
      <PressableScale accessibilityRole="button" onPress={open} style={styles.card}>
        <View>
          <Image
            source={{ uri: product.images[0] }}
            style={[styles.image, soldOut && styles.imageDimmed]}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
          />
          {soldOut ? (
            <View style={styles.soldOutBadge}>
              <Text style={styles.soldOutText}>สินค้าหมด</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.name}>
            {product.name}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color={Colors.primary} />
            <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.price}>{money(product.price)}</Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  imageDimmed: {
    opacity: 0.45,
  },
  soldOutBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(30,30,30,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  soldOutText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 12,
    color: '#fff',
  },
  info: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  name: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 13,
    color: Colors.text,
  },
  dot: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  price: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 14,
    color: Colors.primaryStrong,
  },
});
