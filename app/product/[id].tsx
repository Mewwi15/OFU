import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ColorSwatches } from '@/components/ui/ColorSwatches';
import { IconButton } from '@/components/ui/IconButton';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { RatingStars } from '@/components/ui/RatingStars';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ShopBadge } from '@/components/ui/ShopBadge';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { getProduct } from '@/data/products';
import { money } from '@/lib/format';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const product = getProduct(id);

  const add = useCart((s) => s.add);
  const toggleWishlist = useWishlist((s) => s.toggle);
  const isWishlisted = useWishlist((s) => (product ? s.ids.includes(product.id) : false));

  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product?.sizes[0],
  );
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product?.colors[0],
  );
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);

  if (!product) {
    return (
      <View style={[styles.screen, styles.missing, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="รายละเอียดสินค้า"
          left={
            <IconButton icon="chevron-back" accessibilityLabel="ย้อนกลับ" onPress={() => router.back()} />
          }
          style={styles.header}
        />
        <View style={styles.missingBody}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={Colors.textMuted}
          />
          <Text variant="subtitle" style={[styles.missingText, { color: Colors.textMuted }]}>
            ไม่พบสินค้านี้
          </Text>
        </View>
      </View>
    );
  }

  const imageWidth = width;

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / imageWidth);
    if (index !== activeImage) setActiveImage(index);
  };

  const handleAddToCart = () => {
    add(product, { size: selectedSize, qty, color: selectedColor });
    router.push('/cart');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="รายละเอียดสินค้า"
        left={<IconButton icon="chevron-back" accessibilityLabel="ย้อนกลับ" onPress={() => router.back()} />}
        right={
          <>
            <IconButton
              icon="share-social-outline"
              accessibilityLabel="แชร์สินค้า"
              onPress={() =>
                Alert.alert('แชร์', `แชร์ "${product.name}"`)
              }
            />
            <IconButton
              icon={isWishlisted ? 'heart' : 'heart-outline'}
              color={isWishlisted ? Colors.primary : undefined}
              accessibilityLabel={
                isWishlisted ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'
              }
              onPress={() => toggleWishlist(product.id)}
            />
          </>
        }
        style={styles.header}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + Spacing.x3,
        }}>
        {/* Image carousel */}
        <View style={styles.carousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onCarouselScroll}
            scrollEventThrottle={16}>
            {product.images.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={[styles.image, { width: imageWidth }]}
                contentFit="cover"
                transition={300}
              />
            ))}
          </ScrollView>

          {/* Price + Shop badge overlay (bottom-left) */}
          <View style={styles.overlay}>
            <ShopBadge />
            <View style={styles.priceTag}>
              <Text variant="body" style={{ fontFamily: 'Mitr_600SemiBold', color: Colors.textOnPrimary }}>
                {money(product.price)}
              </Text>
            </View>
          </View>

          {/* Dot indicators */}
          {product.images.length > 1 ? (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === activeImage ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* Title / subtitle / rating */}
          <Text variant="title">{product.name}</Text>
          <Text
            variant="body"
            style={[styles.subtitle, { color: Colors.textMuted }]}>
            {product.subtitle}
          </Text>
          <RatingStars
            rating={product.rating}
            size={16}
            showValue
            style={styles.rating}
          />

          {/* Description with Read More */}
          <Text variant="subtitle" style={styles.sectionLabel}>
            รายละเอียด
          </Text>
          <Text
            variant="body"
            style={{ color: Colors.textMuted }}
            numberOfLines={expanded ? undefined : 2}>
            {product.description}
          </Text>
          <Pressable
            onPress={() => setExpanded((prev) => !prev)}
            hitSlop={Spacing.sm}>
            <Text
              variant="caption"
              style={[styles.readMore, { color: Colors.primaryStrong }]}>
              {expanded ? 'ย่อ' : 'อ่านเพิ่มเติม'}
            </Text>
          </Pressable>

          {/* Color selector */}
          {product.colors.length > 0 ? (
            <>
              <Text variant="subtitle" style={styles.sectionLabel}>
                เลือกสี
              </Text>
              <ColorSwatches
                colors={product.colors}
                selected={selectedColor}
                onSelect={setSelectedColor}
                size={28}
              />
            </>
          ) : null}

          {/* Size selector */}
          {product.sizes.length > 0 ? (
            <>
              <Text variant="subtitle" style={styles.sectionLabel}>
                ขนาด
              </Text>
              <View style={styles.sizeRow}>
                {product.sizes.map((size) => {
                  const active = size === selectedSize;
                  return (
                    <Pressable
                      key={size}
                      onPress={() => setSelectedSize(size)}
                      style={[
                        styles.sizePill,
                        active ? styles.sizePillActive : styles.sizePillInactive,
                      ]}>
                      <Text
                        variant="body"
                        style={{
                          fontFamily: 'Mitr_500Medium',
                          color: active ? Colors.textOnPrimary : Colors.text,
                        }}>
                        {size}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom action row */}
      <View
        style={[
          styles.actionBar,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}>
        <QuantityStepper value={qty} onChange={setQty} />
        <Button onPress={handleAddToCart} style={styles.addButton}>
          เพิ่มลงตะกร้า
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  missing: {
    flex: 1,
  },
  missingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  missingText: {
    marginTop: Spacing.sm,
  },
  carousel: {
    position: 'relative',
  },
  image: {
    aspectRatio: 3 / 4,
  },
  overlay: {
    position: 'absolute',
    left: Spacing.xl,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceTag: {
    backgroundColor: Colors.primaryStrong,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  dots: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: Radius.pill,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: Colors.surface,
    opacity: 0.7,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  rating: {
    marginTop: Spacing.md,
  },
  sectionLabel: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  readMore: {
    marginTop: Spacing.xs,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sizePill: {
    minWidth: 48,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePillActive: {
    backgroundColor: Colors.primaryStrong,
  },
  sizePillInactive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadow.card,
  },
  addButton: {
    flex: 1,
  },
});
