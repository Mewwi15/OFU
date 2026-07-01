/**
 * ProductListItem — the horizontal cart row.
 *
 * A flat, transparent row meant to live INSIDE a shared surface (the cart
 * "ledger"), separated from its neighbours by hairlines. A left checkbox selects
 * the line; the right QuantityStepper folds the delete action into its minus
 * button (`removable`). Tapping the row (outside the controls) opens the product
 * details route.
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

import { Checkbox } from '@/components/ui/Checkbox';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cartItemId, useCart } from '@/store/cart';

export type ProductListItemVariant = 'cart';

export type ProductListItemProps = {
  product: Product;
  variant: ProductListItemVariant;
  /**
   * Cart line id. Required for the `cart` variant so qty/remove target the
   * correct line (a product can appear in multiple sizes).
   */
  cartItemId?: string;
  /** Chosen size for this cart line (shown as a muted caption). */
  size?: string;
  /** Chosen color for this cart line (currently unused for groceries). */
  color?: string;
  /** Quantity for the `cart` variant. */
  qty?: number;
  /** Render the cart row flat (no card chrome) for use inside a shared surface. */
  embedded?: boolean;
  /** Show a left checkbox (cart variant) for Shopee-style line selection. */
  selectable?: boolean;
  /** Whether this line's checkbox is ticked. */
  selected?: boolean;
  /** Called when the checkbox is tapped. */
  onToggleSelect?: () => void;
  /** Called when the line is removed (stepper trash at qty = min). */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ProductListItem({
  product,
  variant,
  cartItemId: lineId,
  size,
  qty = 1,
  embedded = false,
  selectable = false,
  selected = false,
  onToggleSelect,
  onRemove,
  style,
}: ProductListItemProps) {
  const t = useT();
  const router = useRouter();

  const setQty = useCart((s) => s.setQty);
  const removeFromCart = useCart((s) => s.remove);

  const resolvedLineId = lineId ?? cartItemId(product.id, size);
  const open = () => router.push(`/product/${product.id}`);
  const isCart = variant === 'cart';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.row,
        embedded ? styles.embedded : styles.card,
        pressed && !embedded && styles.pressed,
        style,
      ]}>
      {/* Optional left checkbox (cart selection) */}
      {selectable ? (
        <Checkbox
          checked={selected}
          onPress={onToggleSelect}
          accessibilityLabel={selected ? t('widget.deselectItem') : t('widget.selectItem')}
        />
      ) : null}

      {/* Image */}
      <Image
        source={{ uri: product.images[0] }}
        style={[
          isCart ? styles.imageSm : styles.image,
          selectable && styles.imageGap,
        ]}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
      />

      {/* Middle: name + meta + price */}
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>

        {isCart ? (
          size ? (
            <Text variant="caption" numberOfLines={1}>
              {size}
            </Text>
          ) : null
        ) : (
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color={Colors.star} />
            <Text style={styles.metaText}>{product.rating.toFixed(1)}</Text>
            {product.subtitle ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaTextMuted} numberOfLines={1}>
                  {product.subtitle}
                </Text>
              </>
            ) : null}
          </View>
        )}

        <Text style={styles.price}>{money(product.price)}</Text>
      </View>

      {/* Right: quantity stepper (delete folds into the minus button) */}
      <QuantityStepper
        value={qty}
        onChange={(next) => setQty(resolvedLineId, next)}
        min={1}
        removable
        onRemove={onRemove ?? (() => removeFromCart(resolvedLineId))}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* Wishlist: standalone white card. */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    ...Shadow.float,
  },
  pressed: {
    opacity: 0.95,
  },
  /* Cart: flat transparent row inside the shared ledger surface. */
  embedded: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  image: {
    width: 92,
    height: 92,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  imageSm: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  imageGap: {
    marginLeft: Spacing.md,
  },
  middle: {
    flex: 1,
    marginHorizontal: Spacing.md,
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  name: {
    ...Typography.bodyStrong,
    color: Colors.text,
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
    ...Typography.price,
    color: Colors.primaryStrong,
  },
  rightWishlist: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
