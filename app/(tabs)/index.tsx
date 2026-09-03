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
import { BANNER_ASPECT } from '@/lib/data/catalog';
import { MODE_META, useMode, type ShopMode } from '@/store/mode';
import { useIsDesktopWeb } from '@/lib/useAppWidth';
import { useShopOpen } from '@/lib/useShopOpen';
import { loadIfStale, useCatalog } from '@/store/catalog';
import { useShop } from '@/store/shop';

/** ป้ายบนการ์ดเลือกโหมด — เจ้าของขอเป็นภาษาอังกฤษตามที่เขียนมา ไม่ใช้ label ภาษาไทย
 *  ใน MODE_META ที่หน้าอื่นใช้อยู่ */
const MODE_LABEL: Record<ShopMode, string> = {
  delivery: 'Delivery',
  online: 'ONLINE',
};

/** Bottom padding so the floating tab bar never covers the last row. */

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
  const modes = Object.values(MODE_META);
  const mode = useMode((st) => st.mode);
  const setMode = useMode((st) => st.setMode);
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

          {/* เลือกวิธีรับของ — เจ้าของสั่งเพิ่ม 3 ก.ย. 2026: การ์ดสี่เหลี่ยมจัตุรัสสองใบ
              โลโก้กลมข้างใน ป้ายอยู่ข้างล่าง
              ผูกกับ useMode ตัวเดียวกับที่ตะกร้าและหน้าชำระเงินใช้ ไม่ได้เป็นแค่รูป
              ประดับ — กดแล้วเปลี่ยนโหมดจริง และค่าส่งกับข้อความในตะกร้าเปลี่ยนตาม */}
          <View style={styles.modeRow}>
            {modes.map((m) => {
              const on = mode === m.key;
              return (
                <PressableScale
                  key={m.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={MODE_LABEL[m.key]}
                  onPress={() => setMode(m.key)}
                  style={styles.modeCard}>
                  <View style={[styles.modeLogo, on && styles.modeLogoOn]}>
                    <Image source={m.image} style={styles.modeLogoImg} contentFit="contain" />
                  </View>
                  <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>
                    {MODE_LABEL[m.key]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

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
    /* เทาอ่อนมาก ๆ แทนพื้นพีชเดิม (เจ้าของสั่ง 3 ก.ย. 2026) — การ์ดขาวไม่มีเส้นขอบแล้ว
     * ถ้าพื้นยังเกือบขาวก็แยกไม่ออกว่าการ์ดจบตรงไหน เหลือแค่เงาที่ต้องแบกงานทั้งหมด
     * เลือกเทาอมอุ่นเล็กน้อย ไม่ใช่เทากลาง เพราะทั้งแอปเป็นโทนอุ่น เทากลางจะดูเย็นแปลกแยก
     * ตอนนี้ตั้งเฉพาะหน้าแรก ยังไม่แตะโทเคนกลางที่ใช้ทุกหน้า */
    backgroundColor: '#F4F1EF',
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
    // สัดส่วนเดียวกับที่แอดมินครอปไว้ (BANNER_ASPECT.home) — ครอปเท่าไหร่ก็เห็นเท่านั้น
    // ไม่มีค่าของตัวเอง ไม่งั้นสองฝั่งเพี้ยนกันแล้วภาพโดนครอปซ้ำโดยไม่มีใครรู้
    aspectRatio: BANNER_ASPECT.home,
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
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    // ดึงขึ้นไปทับขอบล่างแบนเนอร์นิดเดียวตามที่เจ้าของสั่ง — การ์ดจึงคาบเกี่ยวสองส่วน
    // แทนที่จะลอยอยู่ใต้แบนเนอร์เฉย ๆ  body อยู่หลัง heroWrap ในลำดับ จึงทับได้เอง
    // ไม่ต้องใช้ zIndex
    marginTop: -22,
    marginBottom: Spacing.xs,
  },
  modeCard: {
    // ผืนผ้าแนวนอน (เจ้าของสั่งเปลี่ยนจากจัตุรัส 3 ก.ย. 2026) — กว้างเต็มครึ่งแถว
    // เตี้ยลง เอาโลโก้กับป้ายมาเรียงข้างกันแทนซ้อนบนล่าง จะได้ไม่มีที่ว่างเหลือกลางการ์ด
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    // การ์ดขาวล้วน ไม่มีเส้นขอบเลย (เจ้าของสั่ง 3 ก.ย. 2026) — ตัวที่เลือกอยู่บอกด้วย
    // สีวงโลโก้กับสีตัวหนังสือแทน ไม่ใช่กรอบหรือถมสีพื้น
    backgroundColor: Colors.surface,
    // เงาฟุ้ง กระจายกว้างและจางกว่า Shadow.card ปกติ — การ์ดลอยอยู่บนภาพสีส้ม
    // ถ้าเงาคมจะเห็นเป็นเส้นขอบมืด ๆ แทนที่จะเป็นการลอย
    shadowColor: '#7A4A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  modeLogo: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeLogoOn: {
    backgroundColor: Colors.primaryTint,
  },
  modeLogoImg: {
    width: 32,
    height: 32,
  },
  modeLabel: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  modeLabelOn: {
    color: Colors.primaryStrong,
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
