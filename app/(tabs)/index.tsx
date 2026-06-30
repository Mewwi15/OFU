import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductRail } from '@/components/product/ProductRail';
import { CategoryIcon } from '@/components/shop/CategoryIcon';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { categories, type Category } from '@/data/products';
import { shopHoursLabel } from '@/data/shop';
import { useShopOpen } from '@/lib/useShopOpen';
import { selectedAddress, useAddress } from '@/store/address';
import { useCatalog } from '@/store/catalog';
import { useShop } from '@/store/shop';

/** Bottom padding so the floating tab bar never covers the last row. */
const TAB_BAR_CLEARANCE = 110;
/** Auto-rotating hero banner slides. */
const BANNER_SLIDES = [
  {
    id: 'b1',
    image: 'https://picsum.photos/seed/oofoo-promo1/900/600',
    title: 'ลดสูงสุด 40%\nช้อปเลยวันนี้!',
  },
  {
    id: 'b2',
    image: 'https://picsum.photos/seed/oofoo-promo2/900/600',
    title: 'ส่งฟรี!\nเมื่อสั่งครบ 200฿',
  },
  {
    id: 'b3',
    image: 'https://picsum.photos/seed/oofoo-promo3/900/600',
    title: 'ของสดใหม่ทุกวัน\nคัดพิเศษเพื่อคุณ',
  },
];
/** Auto-advance interval for the hero banner (ms). Thai reading time + WCAG 2.2.2. */
const BANNER_INTERVAL = 5000;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const address = useAddress(selectedAddress);
  const shopOpen = useShopOpen();
  const shop = useShop((s) => s.info);

  /* ----- Catalog (from Supabase) ----- */
  const products = useCatalog((s) => s.products);
  const bestSellers = useMemo(
    () => [...products].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [products],
  );
  const recommended = useMemo(() => products.slice(0, 8), [products]);
  const newArrivals = useMemo(() => [...products].reverse().slice(0, 8), [products]);

  /* ----- Auto-rotating hero banner ----- */
  const bannerRef = useRef<ScrollView>(null);
  const [bannerWidth, setBannerWidth] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  // Mirror the index in a ref so the interval callback isn't a stale closure.
  const activeSlideRef = useRef(0);
  activeSlideRef.current = activeSlide;

  useEffect(() => {
    if (bannerWidth === 0) return;
    const timer = setInterval(() => {
      const next = (activeSlideRef.current + 1) % BANNER_SLIDES.length;
      bannerRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
      setActiveSlide(next);
    }, BANNER_INTERVAL);
    return () => clearInterval(timer);
  }, [bannerWidth]);

  const onBannerLayout = (e: LayoutChangeEvent) =>
    setBannerWidth(e.nativeEvent.layout.width);

  const onBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bannerWidth === 0) return;
    setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / bannerWidth));
  };

  /** Open the full catalog tab, optionally pre-filtered by category. */
  const openCatalog = (category?: Category) =>
    router.push(
      category && category !== 'ทั้งหมด'
        ? `/search?category=${encodeURIComponent(category)}`
        : '/search',
    );

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        }}>
        {/* Full-bleed hero banner: overlaid header on top, search floating below */}
        <View
          style={[styles.hero, { height: insets.top + 250 }]}
          onLayout={onBannerLayout}>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onBannerScroll}
            style={StyleSheet.absoluteFill}>
            {BANNER_SLIDES.map((slide) => (
              <View key={slide.id} style={{ width: bannerWidth, height: '100%' }}>
                <Image
                  source={{ uri: slide.image }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
                <LinearGradient
                  colors={['rgba(241,89,41,0.12)', 'rgba(45,20,12,0.86)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.bannerContent}>
                  <Text variant="title" style={{ color: Colors.textOnPrimary }}>
                    {slide.title}
                  </Text>
                  <Button size="sm" onPress={() => {}} style={styles.bannerButton}>
                    ช้อปเลย
                  </Button>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Overlaid location header (white, on the hero) */}
          <View
            style={[styles.heroHeader, { paddingTop: insets.top + Spacing.sm }]}
            pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="เปลี่ยนที่อยู่จัดส่ง"
              style={styles.locLeft}
              onPress={() => router.push('/address')}>
              <View style={styles.locPin}>
                <Ionicons
                  name="location-sharp"
                  size={18}
                  color={Colors.textOnPrimary}
                />
              </View>
              <View style={styles.locText}>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  จัดส่งไปที่{address ? ` · ${address.label}` : ''}
                </Text>
                <View style={styles.locAddrRow}>
                  <Text numberOfLines={1} style={styles.locAddr}>
                    {address ? address.line : 'เพิ่มที่อยู่จัดส่ง'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={Colors.textOnPrimary}
                  />
                </View>
              </View>
            </Pressable>
            <IconButton
              icon="notifications-outline"
              accessibilityLabel="การแจ้งเตือน"
              onPress={() => router.push('/notifications')}
            />
          </View>

          <View style={styles.dots} pointerEvents="none">
            {BANNER_SLIDES.map((slide, i) => (
              <View
                key={slide.id}
                style={[styles.dot, i === activeSlide && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Body (padded) — search floats over the hero's bottom edge */}
        <View style={styles.body}>
          {/* Search entry — tapping opens the full catalog */}
          <PressableScale
            accessibilityRole="search"
            accessibilityLabel="ค้นหาสินค้า"
            onPress={() => openCatalog()}
            scaleTo={0.98}
            style={styles.searchEntry}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <Text style={styles.searchPlaceholder}>ค้นหาสินค้า</Text>
            <Ionicons name="mic-outline" size={20} color={Colors.primary} />
          </PressableScale>

          {/* Store-closed notice */}
          {!shopOpen ? (
            <View style={styles.closedBanner}>
              <Ionicons name="moon-outline" size={18} color={Colors.dangerStrong} />
              <Text style={styles.closedText}>
                ขณะนี้ร้านปิดทำการ · เปิดให้สั่ง {shopHoursLabel(shop.hours)}
              </Text>
            </View>
          ) : null}

          {/* Category shortcuts → catalog */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}>
            {categories.map((cat) => (
              <PressableScale
                key={cat}
                accessibilityRole="button"
                accessibilityLabel={cat}
                onPress={() => openCatalog(cat)}
                style={styles.catCard}>
                <CategoryIcon category={cat} size={64} />
                <Text numberOfLines={1} style={styles.catLabel}>
                  {cat}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>

          {/* Curated rails */}
          <ProductRail title="ขายดี" data={bestSellers} onSeeAll={() => openCatalog()} />
          <ProductRail
            title="แนะนำสำหรับคุณ"
            data={recommended}
            onSeeAll={() => openCatalog()}
          />
          <ProductRail title="มาใหม่" data={newArrivals} onSeeAll={() => openCatalog()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    paddingHorizontal: Spacing.lg,
  },
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  heroHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locPin: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locText: {
    flex: 1,
  },
  locAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locAddr: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.textOnPrimary,
  },
  searchEntry: {
    marginTop: -26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  searchPlaceholder: {
    flex: 1,
    color: Colors.textMuted,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  closedText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.dangerStrong,
  },
  bannerContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 56,
    justifyContent: 'flex-end',
  },
  bannerButton: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  dots: {
    position: 'absolute',
    bottom: 78,
    right: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.textOnPrimary,
  },
  catRow: {
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingRight: Spacing.lg,
  },
  catCard: {
    width: 72,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  catLabel: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
});
