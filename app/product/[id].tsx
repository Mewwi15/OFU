import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCart } from '@/store/cart';
import { findProduct, useCatalog } from '@/store/catalog';

/** At-a-glance promises shown under the price. */
const PERKS = [
  { icon: 'bicycle-outline', label: 'product.perkFast' },
  { icon: 'leaf-outline', label: 'product.perkFresh' },
  { icon: 'shield-checkmark-outline', label: 'product.perkQuality' },
] as const;

export default function ProductDetailsScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const products = useCatalog((s) => s.products);
  const product = findProduct(products, id);

  const add = useCart((s) => s.add);

  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  // Bump on each add so a re-tap while the toast is up forces a fresh pop.
  const [toastKey, setToastKey] = useState(0);

  /** Floating back button — shared by the found / not-found states. */
  const backButton = (
    <IconButton
      icon="chevron-back"
      accessibilityLabel={t('common.back')}
      onPress={() => router.back()}
    />
  );

  if (!product) {
    return (
      <View style={styles.screen}>
        <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
          {backButton}
        </View>
        <View style={styles.missingBody}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={Colors.textMuted}
          />
          <Text variant="subtitle" style={{ color: Colors.textMuted }}>
            {t('product.notFound')}
          </Text>
        </View>
      </View>
    );
  }

  const imageHeight = Math.round(width * 0.92);
  const total = product.price * qty;
  const soldOut = product.variants.length > 0 && product.variants.every((v) => (v.available ?? 0) <= 0);

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== activeImage) setActiveImage(index);
  };

  const handleAddToCart = () => {
    if (soldOut) return;
    add(product, { qty });
    setToastKey((k) => k + 1);
    setShowToast(true);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 132 }}>
        {/* Full-bleed hero image (single image, or a swipeable pager) */}
        <View style={[styles.hero, { height: imageHeight }]}>
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
                style={{ width, height: imageHeight }}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
            ))}
          </ScrollView>

          {product.images.length > 1 ? (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeImage && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Content card overlapping the image's bottom edge */}
        <Animated.View entering={FadeInDown.duration(420)} style={styles.card}>
          <View style={styles.metaRow}>
            <View style={styles.categoryPill}>
              <Text variant="caption" style={styles.categoryText}>
                {product.category}
              </Text>
            </View>
          </View>

          <Text variant="title" style={styles.name}>
            {product.name}
          </Text>
          {product.subtitle ? (
            <Text variant="body" style={[styles.subtitle, { color: Colors.textMuted }]}>
              {product.subtitle}
            </Text>
          ) : null}

          <Text style={styles.price}>{money(product.price)}</Text>

          {/* Perks */}
          <View style={styles.perks}>
            {PERKS.map((perk) => (
              <View key={perk.label} style={styles.perk}>
                <Ionicons name={perk.icon} size={16} color={Colors.primaryStrong} />
                <Text variant="caption" style={styles.perkLabel}>
                  {t(perk.label)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Description */}
          <Text variant="subtitle" style={styles.sectionLabel}>
            {t('product.description')}
          </Text>
          <Text
            variant="body"
            style={{ color: Colors.textMuted }}
            numberOfLines={expanded ? undefined : 3}>
            {product.description}
          </Text>
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={Spacing.sm}>
            <Text variant="caption" style={styles.readMore}>
              {expanded ? t('product.collapse') : t('product.readMore')}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Floating back button over the hero */}
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
        {backButton}
      </View>

      {/* Sticky action bar: quantity + add-to-cart with live total */}
      <Animated.View
        entering={FadeInUp.delay(120).duration(380)}
        style={[styles.actionBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <QuantityStepper value={qty} onChange={setQty} max={99} />
        <Button onPress={handleAddToCart} disabled={soldOut} style={styles.addButton}>
          {soldOut ? 'สินค้าหมด' : `${t('product.addToCart')} · ${money(total)}`}
        </Button>
      </Animated.View>

      {showToast ? (
        <Toast
          key={toastKey}
          message={t('product.addedToCart')}
          subtitle={`${product.name} × ${qty}`}
          actionLabel={t('product.viewCart')}
          onAction={() => {
            setShowToast(false);
            router.push('/cart');
          }}
          onHide={() => setShowToast(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  missingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  hero: {
    width: '100%',
    backgroundColor: Colors.primaryTint,
  },
  dots: {
    position: 'absolute',
    bottom: Spacing.x2 + Spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.textOnPrimary,
  },
  card: {
    marginTop: -Spacing.x2,
    paddingHorizontal: Spacing.x2,
    paddingTop: Spacing.x2,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.background,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    backgroundColor: Colors.primaryTint,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  categoryText: {
    color: Colors.primaryStrong,
  },
  name: {
    marginTop: Spacing.md,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  price: {
    marginTop: Spacing.md,
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 28,
    color: Colors.primaryStrong,
  },
  perks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  perkLabel: {
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.x2,
  },
  sectionLabel: {
    marginTop: Spacing.x2,
    marginBottom: Spacing.sm,
  },
  readMore: {
    marginTop: Spacing.xs,
    color: Colors.primaryStrong,
    fontFamily: 'Mitr_500Medium',
  },
  topBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.x2,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadow.float,
  },
  addButton: {
    flex: 1,
  },
});
