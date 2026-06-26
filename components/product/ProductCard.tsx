/**
 * ProductCard — the 2-column grid card.
 *
 * Image (rounded) on top with a ShopBadge bottom-left and a wishlist heart
 * top-right. Below the image: name, subtitle, then a row of price + a small
 * non-selectable color swatch preview. Tapping the card navigates to the
 * product details route.
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ColorSwatches } from '@/components/ui/ColorSwatches';
import { IconButton } from '@/components/ui/IconButton';
import { ShopBadge } from '@/components/ui/ShopBadge';
import { AppText } from '@/components/ui/Text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { useWishlist } from '@/store/wishlist';

export type ProductCardProps = {
  product: Product;
  style?: StyleProp<ViewStyle>;
};

/** Max swatches to preview on a grid card before it gets crowded. */
const MAX_SWATCHES = 3;

export function ProductCard({ product, style }: ProductCardProps) {
  const router = useRouter();
  const wishlisted = useWishlist((s) => s.ids.includes(product.id));
  const toggle = useWishlist((s) => s.toggle);

  const open = () => router.push(`/product/${product.id}`);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
        />
        <ShopBadge style={styles.badge} />
        <IconButton
          icon={wishlisted ? 'heart' : 'heart-outline'}
          color={wishlisted ? Colors.primary : Colors.text}
          size={32}
          onPress={() => toggle(product.id)}
          style={styles.heart}
        />
      </View>

      <AppText variant="h2" numberOfLines={1} style={styles.name}>
        {product.name}
      </AppText>
      <AppText
        variant="caption"
        color={Colors.textMuted}
        numberOfLines={1}
        style={styles.subtitle}>
        {product.subtitle}
      </AppText>

      <View style={styles.footer}>
        <AppText variant="price" color={Colors.primary}>
          {money(product.price)}
        </AppText>
        {product.colors.length > 0 && (
          <ColorSwatches
            colors={product.colors.slice(0, MAX_SWATCHES)}
            size={12}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.9,
  },
  imageWrap: {
    position: 'relative',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  badge: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
  },
  heart: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  name: {
    marginTop: Spacing.sm,
  },
  subtitle: {
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
});
