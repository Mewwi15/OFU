/**
 * ProductListItem — horizontal row card used by the Wishlist and Cart lists.
 *
 * Layout is shared; the right-hand controls differ by `variant`:
 *  - `wishlist`: image (with ShopBadge + heart), name/subtitle/rating, and a
 *    right column with a heart toggle + price.
 *  - `cart`: image (with ShopBadge), name/subtitle/rating, and a right column
 *    with a QuantityStepper, a small color swatch, and a danger trash button.
 *
 * Tapping the row (outside the controls) opens the product details route.
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
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { RatingStars } from '@/components/ui/RatingStars';
import { ShopBadge } from '@/components/ui/ShopBadge';
import { AppText } from '@/components/ui/Text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { cartItemId, useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';

export type ProductListItemVariant = 'wishlist' | 'cart';

export type ProductListItemProps = {
  product: Product;
  variant: ProductListItemVariant;
  /**
   * Cart line id. Required for the `cart` variant so qty/remove target the
   * correct line (a product can appear in multiple sizes).
   */
  cartItemId?: string;
  /** Chosen size for this cart line (shown next to the name). */
  size?: string;
  /** Chosen color for this cart line (shown as a swatch). */
  color?: string;
  /** Quantity for the `cart` variant. */
  qty?: number;
  style?: StyleProp<ViewStyle>;
};

const IMAGE_SIZE = 96;

export function ProductListItem({
  product,
  variant,
  cartItemId: lineId,
  size,
  color,
  qty = 1,
  style,
}: ProductListItemProps) {
  const router = useRouter();

  const wishlisted = useWishlist((s) => s.ids.includes(product.id));
  const toggleWishlist = useWishlist((s) => s.toggle);

  const setQty = useCart((s) => s.setQty);
  const removeFromCart = useCart((s) => s.remove);

  const resolvedLineId = lineId ?? cartItemId(product.id, size);
  const open = () => router.push(`/product/${product.id}`);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}>
      {/* Left: image */}
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
        />
        <ShopBadge style={styles.badge} />
        {variant === 'wishlist' ? (
          <IconButton
            icon={wishlisted ? 'heart' : 'heart-outline'}
            color={wishlisted ? Colors.primary : Colors.text}
            size={28}
            onPress={() => toggleWishlist(product.id)}
            style={styles.imageHeart}
          />
        ) : null}
      </View>

      {/* Middle: details */}
      <View style={styles.middle}>
        <AppText variant="h2" numberOfLines={1}>
          {product.name}
        </AppText>
        <AppText
          variant="caption"
          color={Colors.textMuted}
          numberOfLines={1}
          style={styles.subtitle}>
          {product.subtitle}
        </AppText>
        <RatingStars
          rating={product.rating}
          showValue
          style={styles.rating}
        />
        <AppText variant="price" color={Colors.primary} style={styles.price}>
          {money(product.price)}
        </AppText>
      </View>

      {/* Right: variant-specific controls */}
      {variant === 'wishlist' ? (
        <View style={styles.rightWishlist}>
          <IconButton
            icon={wishlisted ? 'heart' : 'heart-outline'}
            color={wishlisted ? Colors.primary : Colors.text}
            size={36}
            onPress={() => toggleWishlist(product.id)}
          />
          <AppText variant="price" color={Colors.primary}>
            {money(product.price)}
          </AppText>
        </View>
      ) : (
        <View style={styles.rightCart}>
          <QuantityStepper
            value={qty}
            onChange={(next) => setQty(resolvedLineId, next)}
            min={1}
          />
          <View style={styles.cartFooter}>
            {color ?? product.colors[0] ? (
              <ColorSwatches colors={[color ?? product.colors[0]]} size={14} />
            ) : null}
            <IconButton
              icon="trash-outline"
              color={Colors.danger}
              size={36}
              onPress={() => removeFromCart(resolvedLineId)}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.95,
  },
  imageWrap: {
    position: 'relative',
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  badge: {
    position: 'absolute',
    left: Spacing.xs,
    bottom: Spacing.xs,
  },
  imageHeart: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
  },
  middle: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
  },
  rating: {
    marginTop: Spacing.xs,
  },
  price: {
    marginTop: Spacing.xs,
  },
  rightWishlist: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: Spacing.sm,
  },
  rightCart: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: Spacing.sm,
  },
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
