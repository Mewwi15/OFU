/**
 * ProductListItem — horizontal row card used by the Wishlist and Cart lists.
 *
 * White rounded card: image (left), then name + a meta row (coral star · rating)
 * + price. Right-hand controls differ by `variant`:
 *  - `wishlist`: a single coral heart toggle.
 *  - `cart`: a trash button + a QuantityStepper.
 *
 * Tapping the row (outside the controls) opens the product details route.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Text } from '@/components/ui/text';
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
  /** Chosen size for this cart line (shown next to the rating). */
  size?: string;
  /** Chosen color for this cart line (currently unused for groceries). */
  color?: string;
  /** Quantity for the `cart` variant. */
  qty?: number;
  style?: StyleProp<ViewStyle>;
};

const IMAGE_SIZE = 92;

export function ProductListItem({
  product,
  variant,
  cartItemId: lineId,
  size,
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

  /** Secondary meta after the rating: chosen size (cart) or subtitle. */
  const metaTail = variant === 'cart' ? size : product.subtitle;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}>
      {/* Left: image */}
      <Image
        source={{ uri: product.images[0] }}
        style={styles.image}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
      />

      {/* Middle: name + meta + price */}
      <View style={styles.middle}>
        <Text variant="subtitle" numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="star" size={13} color={Colors.primary} />
          <Text style={styles.metaText}>{product.rating.toFixed(1)}</Text>
          {metaTail ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.metaTextMuted} numberOfLines={1}>
                {metaTail}
              </Text>
            </>
          ) : null}
        </View>
        <Text style={styles.price}>{money(product.price)}</Text>
      </View>

      {/* Right: variant-specific controls */}
      {variant === 'wishlist' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            wishlisted ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'
          }
          hitSlop={10}
          onPress={() => toggleWishlist(product.id)}
          style={styles.rightWishlist}>
          <Ionicons
            name={wishlisted ? 'heart' : 'heart-outline'}
            size={24}
            color={Colors.primary}
          />
        </Pressable>
      ) : (
        <View style={styles.rightCart}>
          <IconButton
            icon="trash-outline"
            color={Colors.danger}
            size={32}
            accessibilityLabel="ลบสินค้าออกจากตะกร้า"
            onPress={() => removeFromCart(resolvedLineId)}
          />
          <QuantityStepper
            value={qty}
            onChange={(next) => setQty(resolvedLineId, next)}
            min={1}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    ...Shadow.float,
  },
  pressed: {
    opacity: 0.95,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  middle: {
    flex: 1,
    marginHorizontal: Spacing.md,
    justifyContent: 'center',
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 13,
    color: Colors.text,
  },
  metaTextMuted: {
    flexShrink: 1,
    fontSize: 13,
    color: Colors.textMuted,
  },
  dot: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  price: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 15,
    color: Colors.primaryStrong,
    marginTop: 2,
  },
  rightWishlist: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCart: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
});
