/**
 * ProductCard — the 2-column grid card (Oroshi "Explore" frame).
 *
 * White card with the product image filling the top edge-to-edge (rounded only
 * at the top), then a padded info area: name and price. Tapping the card opens
 * the details. A round "+" button overlaps the image's bottom-right corner
 * (เจ้าของสั่ง 3 ก.ย. 2026 "เพิ่มปุ่มบวกสินค้า ... กดแล้วก็เพิ่มลงตะกร้าเลย") —
 * adds the product's default variant straight to the cart, no detail page.
 *
 * The "+" is a separate Pressable nested inside the card's outer PressableScale.
 * React Native hit-tests nested Pressables independently (whichever is on top
 * catches the touch), so tapping "+" does NOT also fire the card's onPress —
 * no manual stopPropagation needed.
 *
 * Feedback on add is deliberately local, not a full-screen Toast (used on the
 * product detail page): a grid is meant for tapping "+" on several cards in a
 * row, and a modal-style toast would force a pause between each tap. The
 * button pops once instead, and CartBadge (already visible on the cart icon
 * in every header) already bounces on every count change — that's the
 * confirmation, same signal a shopper already reads to know the tap landed.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { BRAND_ACCENT, type Accent } from '@/constants/accent';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { productThumb } from '@/lib/image';
import { useCart } from '@/store/cart';

export type ProductCardProps = {
  product: Product;
  style?: StyleProp<ViewStyle>;
  /** Position in its list — staggers the entrance fade. */
  index?: number;
  /** สีเน้นของโหมดที่การ์ดนี้ไปโผล่ — ไม่ส่ง = สีแบรนด์ (ส้ม) */
  accent?: Accent;
};

export function ProductCard({ product, style, index = 0, accent = BRAND_ACCENT }: ProductCardProps) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const bump = useSharedValue(1);

  const open = () => router.push(`/product/${product.id}`);
  const soldOut = product.variants.length > 0 && product.variants.every((v) => (v.available ?? 0) <= 0);

  const quickAdd = () => {
    add(product);
    bump.value = withSequence(withSpring(1.3, { damping: 9, stiffness: 380 }), withSpring(1));
  };

  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 8) * 55).duration(320)}
      style={[styles.wrapper, style]}>
      <PressableScale accessibilityRole="button" onPress={open} style={styles.card}>
        <View>
          <Image
            source={{ uri: productThumb(product.images[0], 400) }}
            style={[styles.image, { backgroundColor: accent.tint }, soldOut && styles.imageDimmed]}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
          />
          {soldOut ? (
            <View style={styles.soldOutBadge}>
              <Text style={styles.soldOutText}>สินค้าหมด</Text>
            </View>
          ) : (
            <Animated.View style={[styles.addBtnWrap, bumpStyle]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`เพิ่ม ${product.name} ลงตะกร้า`}
                onPress={quickAdd}
                style={[styles.addBtn, { backgroundColor: accent.solid }]}
                hitSlop={8}>
                <Ionicons name="add" size={20} color={Colors.textOnPrimary} />
              </PressableScale>
            </Animated.View>
          )}
        </View>

        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.name}>
            {product.name}
          </Text>

          <Text style={[styles.price, { color: accent.strong }]}>{money(product.price)}</Text>
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
    // Radius.lg + เงา: บนพื้นพีชเดิมการ์ดขาวตัดกับพื้นเองเลยไม่ต้องมีเงา —
    // พอพื้นเป็นขาว การ์ดจมหายทั้งกริด (มุมมองเจ้าของ 23 ส.ค.: "โล้น ไม่นุ่ม")
    // ให้เข้าชุดกับ ProductListItem ที่ใช้ Radius.lg + เงาอยู่แล้ว
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    // ค่าตั้งต้นสีแบรนด์ — ถูกทับด้วย accent.tint ที่จุดเรียกใช้ (โหมดออนไลน์ส่งน้ำเงินมา)
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
  /* ลอยคร่อมรอยต่อรูป/พื้นข้อมูล — ครึ่งบนทับรูป ครึ่งล่างล้นออกมาบนพื้นขาว เหมือนปุ่ม
     ลอยอยู่บนผิวการ์ด ไม่ใช่จมอยู่ในกรอบรูป */
  addBtnWrap: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: -14,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
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
  price: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 14,
    color: Colors.primaryStrong,
  },
});
