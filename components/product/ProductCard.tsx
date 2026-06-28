/**
 * ProductCard — the 2-column grid card (Oroshi "Explore" frame).
 *
 * White card with the product image filling the top edge-to-edge (rounded only
 * at the top), then a padded info area: name + inline coral wishlist heart, and
 * a meta row (coral star · rating · price). Tapping the card opens the details.
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

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { useWishlist } from '@/store/wishlist';

export type ProductCardProps = {
  product: Product;
  style?: StyleProp<ViewStyle>;
};

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
      <Image
        source={{ uri: product.images[0] }}
        style={styles.image}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
      />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {product.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              wishlisted ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'
            }
            hitSlop={10}
            onPress={() => toggle(product.id)}>
            <Ionicons
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={22}
              color={Colors.primary}
            />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="star" size={13} color={Colors.primary} />
          <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.price}>{money(product.price)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadow.float,
  },
  pressed: {
    opacity: 0.9,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  info: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    flex: 1,
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
