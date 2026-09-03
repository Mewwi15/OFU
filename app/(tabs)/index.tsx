import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductRail } from '@/components/product/ProductRail';
import { CategoryIcon } from '@/components/shop/CategoryIcon';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { DesktopHome } from '@/components/web/DesktopHome';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { categories } from '@/data/products';
import { shopHoursLabel } from '@/data/shop';
import { useT } from '@/lib/i18n';
import { useIsDesktopWeb } from '@/lib/useAppWidth';
import { useShopOpen } from '@/lib/useShopOpen';
import { loadIfStale, useCatalog } from '@/store/catalog';
import { useShop } from '@/store/shop';

/** Bottom padding so the floating tab bar never covers the last row. */
/** สัดส่วนแบนเนอร์หน้าแรก — เลขเล็กลง = สูงขึ้น (2 = สี่เหลี่ยมกว้างสองเท่าสูง) */
const HOME_HERO_ASPECT = 1.55;

const TAB_BAR_CLEARANCE = 110;
/**
 * Fallback slide shown until the owner publishes home banners (admin แบนเนอร์
 * page) — the local brand art, same asset as the catalog hero. Never network
 * placeholders here: this is the first thing a customer sees.
 */
const FALLBACK_SLIDES = [{ id: 'brand', image: require('../../assets/images/braner.jpg') }];
/** Auto-advance interval for the hero banner (ms). Thai reading time + WCAG 2.2.2. */
const BANNER_INTERVAL = 5000;

export default function HomeScreen() {
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shopOpen = useShopOpen();
  const shop = useShop((s) => s.info);
  const t = useT();

  /* ----- Catalog (from Supabase) ----- */
  const products = useCatalog((s) => s.products);
  const reloadCatalog = useCatalog((s) => s.load);
  const [refreshing, setRefreshing] = useState(false);
  // Re-fetch on focus only if the catalog is stale (loadIfStale), so admin
  // changes (new products, prices, banners) still show up without a restart,
  // but bouncing between tabs while browsing doesn't refire all 5 catalog
  // queries every single time.
  useFocusEffect(
    useCallback(() => {
      loadIfStale();
    }, []),
  );
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reloadCatalog(true);
    setRefreshing(false);
  }, [reloadCatalog]);
  const homeBanners = useCatalog((s) => s.banners).filter((b) => b.placement === 'home');
  // Admin-managed home banners when present; otherwise the local brand slide.
  const slides = homeBanners.length
    ? homeBanners.map((b) => ({ id: b.id, image: { uri: b.image } as number | { uri: string } }))
    : FALLBACK_SLIDES;
  const dbCategories = useCatalog((s) => s.categories);
  const featuredRows = useCatalog((s) => s.featured);
  const bestsellerIds = useCatalog((s) => s.bestsellerIds);
  // Admin categories (in their display order) when available; else the static list.
  const catList: string[] = dbCategories.length ? ['ทั้งหมด', ...dbCategories] : [...categories];

  // ขายดี — real units sold (POS + online); products with sales first, then fill by rating.
  const bestSellers = useMemo(() => {
    const rank = new Map(bestsellerIds.map((id, i) => [id, i]));
    return [...products]
      .sort((a, b) => {
        const ra = rank.get(a.id) ?? Infinity;
        const rb = rank.get(b.id) ?? Infinity;
        return ra !== rb ? ra - rb : b.rating - a.rating;
      })
      .slice(0, 8);
  }, [products, bestsellerIds]);
  // แนะนำ — highest rated.
  const recommended = useMemo(
    () => [...products].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [products],
  );
  // มาใหม่ — most recently added.
  const newArrivals = useMemo(
    () => [...products].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 8),
    [products],
  );

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
      const next = (activeSlideRef.current + 1) % slides.length;
      bannerRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
      setActiveSlide(next);
    }, BANNER_INTERVAL);
    return () => clearInterval(timer);
  }, [bannerWidth, slides.length]);

  const onBannerLayout = (e: LayoutChangeEvent) =>
    setBannerWidth(e.nativeEvent.layout.width);

  const onBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bannerWidth === 0) return;
    setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / bannerWidth));
  };

  /** Open the full catalog tab, optionally pre-filtered by category. */
  const openCatalog = (category?: string) =>
    router.push(
      category && category !== 'ทั้งหมด'
        ? `/search?category=${encodeURIComponent(category)}`
        : '/search',
    );

  // Desktop web renders the full storefront landing instead (after all hooks).
  if (isDesktopWeb) return <DesktopHome />;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        }}>
        {/* Hero banner — ชิดขอบบนสุด เต็มความกว้าง ไหลใต้แถบสถานะ (เจ้าของสั่ง 3 ก.ย. 2026)
            เดิมมีแถบที่อยู่คั่นอยู่ข้างบนแล้วแบนเนอร์เว้นขอบทั้งสี่ด้าน ภาพเลยดูเป็นการ์ด
            ใบหนึ่งกลางจอ ไม่ใช่หน้าปกของร้าน */}
        <View style={styles.heroWrap}>
          <View style={styles.hero} onLayout={onBannerLayout}>
            <ScrollView
              ref={bannerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onBannerScroll}
              style={StyleSheet.absoluteFill}>
              {slides.map((slide) => (
                <View key={slide.id} style={{ width: bannerWidth, height: '100%' }}>
                  <Image
                    source={slide.image}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                </View>
              ))}
            </ScrollView>

      {/* หมุดที่อยู่ + กระดิ่ง ลอยมุมขวาบนทับแบนเนอร์ (เจ้าของสั่งให้ที่อยู่เหลือแค่
          ไอคอนหมุดชิดขวา) — อยู่นอก ScrollView เพื่อให้ค้างอยู่ตอนเลื่อนหน้า ไม่งั้น
          เลื่อนลงไปนิดเดียวก็กดเปลี่ยนที่อยู่หรือดูแจ้งเตือนไม่ได้แล้ว */}
      <View style={[styles.topRight, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <IconButton
          icon="location-sharp"
          variant="tint"
          shape="rounded"
          size={40}
          accessibilityLabel={t('home.changeAddress')}
          onPress={() => router.push('/address')}
        />
        <IconButton
          icon="notifications-outline"
          variant="tint"
          shape="rounded"
          size={40}
          accessibilityLabel={t('home.notifications')}
          onPress={() => router.push('/notifications')}
        />
      </View>
            {/* Bottom scrim so the dots stay readable over any image */}
            {slides.length > 1 ? (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.28)']}
                style={styles.heroScrim}
                pointerEvents="none"
              />
            ) : null}
            {slides.length > 1 ? (
              <View style={styles.dots} pointerEvents="none">
                {slides.map((slide, i) => (
                  <View key={slide.id} style={[styles.dot, i === activeSlide && styles.dotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Body (padded) — search floats over the hero's bottom edge */}
        <View style={styles.body}>
          {/* Store-closed notice */}
          {!shopOpen ? (
            <View style={styles.closedBanner}>
              <Ionicons name="moon-outline" size={18} color={Colors.dangerStrong} />
              <Text style={styles.closedText}>
                {t('home.shopClosed')} {shopHoursLabel(shop.hours)}
              </Text>
            </View>
          ) : null}

          {/* Category shortcuts → catalog */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}>
            {catList.map((cat) => (
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

          {/* Admin-managed featured rows (จัดหน้าแอป) */}
          {featuredRows.map((row) => {
            const rowProducts = row.productIds
              .map((id) => products.find((p) => p.id === id))
              .filter((p): p is (typeof products)[number] => !!p);
            if (rowProducts.length === 0) return null;
            return (
              <ProductRail key={row.id} title={row.title} data={rowProducts} onSeeAll={() => openCatalog()} />
            );
          })}

          {/* Curated rails */}
          <ProductRail
            title={t('home.bestSellers')}
            data={bestSellers}
            onSeeAll={() => openCatalog()}
          />
          <ProductRail
            title={t('home.recommended')}
            data={recommended}
            onSeeAll={() => openCatalog()}
          />
          <ProductRail
            title={t('home.newArrivals')}
            data={newArrivals}
            onSeeAll={() => openCatalog()}
          />
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
  heroWrap: {
    // เต็มความกว้าง ไม่เว้นขอบ ไม่มีมุมโค้งและเงา — แบนเนอร์เป็นหน้าปกของหน้า
    // ไม่ใช่การ์ดใบหนึ่งที่วางอยู่บนหน้า
    backgroundColor: Colors.primaryTint,
  },
  hero: {
    /* สูงกว่าสัดส่วนที่แอดมินครอปไว้ (BANNER_ASPECT.home = 2:1) เพราะตอนนี้แบนเนอร์
     * ไหลใต้แถบสถานะ ส่วนบนของภาพจึงถูกกินไปราว 60pt ถ้าใช้ 2:1 ตรง ๆ ส่วนที่มองเห็น
     * จริงจะเตี้ยกว่าที่ออกแบบไว้ · เจ้าของสั่งขอให้ใหญ่ลงมาด้านล่างอีก (3 ก.ย. 2026)
     * ภาพยังเป็น cover เหมือนเดิม กล่องสูงขึ้นจึงครอปด้านซ้าย-ขวาเล็กน้อยแทน */
    aspectRatio: HOME_HERO_ASPECT,
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
  },
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  topRight: {
    position: 'absolute',
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
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
