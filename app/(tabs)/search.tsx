import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartBadge } from '@/components/navigation/CartBadge';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductRail } from '@/components/product/ProductRail';
import { CategoryIcon } from '@/components/shop/CategoryIcon';
import { PromoBanner } from '@/components/shop/PromoBanner';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { SearchBar } from '@/components/ui/searchbar';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { categories } from '@/data/products';
import { BANNER_ASPECT, bannerFor } from '@/lib/data/catalog';
import { DesktopCatalog } from '@/components/web/DesktopCatalog';
import { useT } from '@/lib/i18n';
import { useAppWidth, useIsDesktopWeb } from '@/lib/useAppWidth';
import { loadIfStale, useCatalog } from '@/store/catalog';

/** Extra bottom padding so the floating tab bar never covers grid content. */
const TAB_BAR_CLEARANCE = 96;

/**
 * Catalog ("สินค้าทั้งหมด"): a search bar + category chips. By default it shows
 * curated horizontal rails (ติดกระแส / โปรโมชั่น / มาแรงประจำสัปดาห์) above a
 * vertical "แนะนำสำหรับคุณ" grid. Typing a query or picking a category instead
 * shows a flat filtered grid. Can arrive pre-filtered via a `category` param.
 */
export default function CatalogScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const screenW = useAppWidth();
  // A slim header band below the safe area, at the same aspect the admin crops
  // search_hero to (BANNER_ASPECT) — cropped image fills it with no mismatch.
  const bannerHeight = screenW / BANNER_ASPECT.search_hero;
  const { category, q: qParam, focus } = useLocalSearchParams<{
    category?: string;
    q?: string;
    focus?: string;
  }>();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(category ?? 'ทั้งหมด');

  // Sync the filter when arriving with a (new) category param from home.
  useEffect(() => {
    if (category) setActiveCategory(category);
  }, [category]);

  const products = useCatalog((s) => s.products);
  const dbCategories = useCatalog((s) => s.categories);
  const banners = useCatalog((s) => s.banners);
  // Re-fetch on focus only if the catalog is stale — see loadIfStale's doc
  // comment (store/catalog.ts) for why this isn't an unconditional force.
  useFocusEffect(
    useCallback(() => {
      loadIfStale();
    }, []),
  );
  const catList: string[] = dbCategories.length ? ['ทั้งหมด', ...dbCategories] : [...categories];

  // Admin-managed banners per slot; fall back to the built-in image + copy.
  const heroBanner = bannerFor(banners, 'search_hero');
  const trendingBanner = bannerFor(banners, 'search_trending');
  const promoBanner = bannerFor(banners, 'search_promo');
  const hotBanner = bannerFor(banners, 'search_hot');
  const trending = useMemo(() => products.slice(0, 6), [products]);
  const promotions = useMemo(
    () => [...products].sort((a, b) => a.price - b.price).slice(0, 6),
    [products],
  );
  const hotWeekly = useMemo(
    () => [...products].sort((a, b) => b.rating - a.rating).slice(0, 6),
    [products],
  );

  const q = query.trim().toLowerCase();
  const isBrowsing = q.length === 0 && activeCategory === 'ทั้งหมด';

  const results = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'ทั้งหมด' || product.category === activeCategory;
      if (!matchesCategory) return false;
      if (q.length === 0) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.subtitle.toLowerCase().includes(q)
      );
    });
  }, [products, q, activeCategory]);

  // กริดใหญ่ที่สุดของทั้งแอป (ทุกสินค้าที่เผยแพร่ ~775 ชิ้นตอนเรียกดูแบบไม่กรอง) —
  // isBrowsing ใช้ products ทั้งก้อน ไม่งั้นใช้ results ที่กรองแล้ว
  const gridData = isBrowsing ? products : results;

  // Desktop web renders the sidebar-filter catalog instead (after all hooks).
  if (isDesktopWeb) {
    return (
      <DesktopCatalog
        key={`${category ?? ''}|${qParam ?? ''}`}
        initialCategory={category}
        initialQuery={qParam}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* กริดสินค้าทั้งหมดเคย .map() ทุกชิ้นลงใน ScrollView เดียวตรง ๆ — ตอนเรียกดูแบบ
          ไม่กรอง (isBrowsing) นั่นคือ ~775 การ์ดมาวาดพร้อมกันทีเดียวทุกครั้ง แต่ละใบมี
          Reanimated shared value + entrance animation ของตัวเอง (ปุ่มบวกที่เพิ่งทำ)
          จอเลยกระตุกหนักโดยเฉพาะตอนเปิดแท็บนี้ครั้งแรก — เจ้าของทัก 4 ก.ย. 2026
          "แอพคือกระตุกมากๆ ข้อมูลน่าจะโหลดเยอะหรือป่าว" ถูกตรงเผงเรื่องปริมาณ ไม่ใช่
          เรื่องโหลดข้อมูลจากเซิร์ฟเวอร์ช้า
          ย้ายมาเป็น FlatList เดียวทั้งหน้า — วาดเฉพาะแถวที่มองเห็นบวกกันชนบัฟเฟอร์
          เท่านั้น ของเดิมที่อยู่เหนือกริด (แบนเนอร์/ช่องค้นหา/ชิปหมวดหมู่/แถวคัดสรร)
          ย้ายไปเป็น ListHeaderComponent แทน — โครงหน้าตาเหมือนเดิมทุกอย่าง เปลี่ยนแค่
          วิธีวาด ไม่ใช่วิธีจัดวาง */}
      <FlatList
        data={gridData}
        keyExtractor={(product) => product.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingHorizontal: Spacing.sm,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        renderItem={({ item, index }) => (
          <View style={styles.gridCell}>
            <ProductCard product={item} index={index} />
          </View>
        )}
        ListHeaderComponent={
          <>
            {/* Brand hero — full-bleed marketing banner (owner-designed: coral
                gradient, อู้ฟู่ mascot + OFU wordmark + groceries, with its own
                copy baked in). The cart button is overlaid top-right. */}
            <View style={[styles.hero, { height: insets.top + bannerHeight }]}>
              <Image
                source={heroBanner ? { uri: heroBanner.image } : require('../../assets/images/braner.jpg')}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            </View>

            <View style={styles.body}>
              {/* Floating toolbar over the banner's bottom edge: search + cart.
                  Both are white surfaces so they read as one group. */}
              <View style={styles.searchRow}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  // Home's search shortcut lands here — put the cursor in the
                  // field on web so typing continues seamlessly (native keeps
                  // its no-keyboard-pop behavior).
                  autoFocus={Platform.OS === 'web' && focus === '1'}
                  placeholder={t('search.placeholder')}
                  containerStyle={styles.search}
                />
                <View style={styles.cartWrap}>
                  <IconButton
                    icon="bag-outline"
                    shape="rounded"
                    size={48}
                    accessibilityLabel={t('search.cart')}
                    onPress={() => router.push('/cart')}
                  />
                  <CartBadge />
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
                style={styles.chipsScroll}>
                {catList.map((cat) => {
                  const active = cat === activeCategory;
                  return (
                    <PressableScale
                      key={cat}
                      accessibilityRole="button"
                      accessibilityLabel={cat}
                      accessibilityState={{ selected: active }}
                      onPress={() => setActiveCategory(cat)}
                      style={styles.catCard}>
                      <CategoryIcon category={cat} size={60} />
                      <Text
                        numberOfLines={1}
                        style={[styles.catLabel, active && styles.catLabelActive]}>
                        {cat}
                      </Text>
                      <View
                        style={[
                          styles.catIndicator,
                          active && styles.catIndicatorActive,
                        ]}
                      />
                    </PressableScale>
                  );
                })}
              </ScrollView>

              {isBrowsing ? (
                /* Curated rails ahead of the recommended grid — each still bounded
                   to ~6-8 items (ProductRail), so these stay cheap regardless of
                   catalog size. Only the grid itself was the unbounded part. */
                <>
                  {trendingBanner ? (
                    <>
                      <PromoBanner
                        title={trendingBanner.title || t('search.trendingBannerTitle')}
                        subtitle={t('search.trendingBannerSub')}
                        image={trendingBanner.image}
                      />
                      <ProductRail data={trending} />
                    </>
                  ) : (
                    <ProductRail title={t('search.railTrending')} data={trending} />
                  )}
                  {promoBanner ? (
                    <>
                      <PromoBanner
                        title={promoBanner.title || t('search.promoBannerTitle')}
                        subtitle={t('search.promoBannerSub')}
                        image={promoBanner.image}
                      />
                      <ProductRail data={promotions} />
                    </>
                  ) : (
                    <ProductRail title={t('search.railPromo')} data={promotions} />
                  )}
                  {hotBanner ? (
                    <>
                      <PromoBanner
                        title={hotBanner.title || t('search.hotBannerTitle')}
                        subtitle={t('search.hotBannerSub')}
                        image={hotBanner.image}
                      />
                      <ProductRail data={hotWeekly} />
                    </>
                  ) : (
                    <ProductRail title={t('search.railHotWeekly')} data={hotWeekly} />
                  )}

                  <View style={styles.gridSection}>
                    <Text variant="subtitle" style={styles.gridTitle}>
                      {t('search.recommended')}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </>
        }
        ListEmptyComponent={
          // เดิมข้อความ "ไม่พบ" ขึ้นเฉพาะตอนกรองแล้วไม่เจอ — ตอนเรียกดูแบบไม่กรองแล้ว
          // products ยังว่าง (คลังยังโหลดไม่เสร็จ) ปล่อยว่างเงียบ ๆ เหมือนเดิม ไม่ขึ้น
          // ข้อความที่บอกว่า "ค้นหาไม่เจอ" ทั้งที่ยังไม่ได้ค้นหาอะไรเลย
          !isBrowsing ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search" size={40} color={Colors.primary} />
              </View>
              <Text variant="subtitle" style={styles.emptyTitle}>
                {t('search.noResults')}
              </Text>
              <Text
                variant="body"
                style={[{ color: Colors.textMuted }, styles.emptyBody]}>
                {t('search.noResultsHint')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
  },
  body: {
    paddingHorizontal: Spacing.lg,
  },
  searchRow: {
    marginTop: -24,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  search: {
    flex: 1,
  },
  cartWrap: {
    // Anchor for the absolutely-positioned cart count badge.
    position: 'relative',
  },
  chipsScroll: {
    marginHorizontal: -Spacing.lg,
  },
  catRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
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
  catLabelActive: {
    fontFamily: 'Mitr_500Medium',
    color: Colors.primaryStrong,
  },
  catIndicator: {
    width: 18,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'transparent',
  },
  catIndicatorActive: {
    backgroundColor: Colors.primary,
  },
  gridSection: {
    marginTop: Spacing.xl,
  },
  gridTitle: {
    marginBottom: Spacing.md,
  },
  // `grid` (flexWrap row) ไม่ใช้แล้ว — FlatList คุมเลย์เอาต์ 2 คอลัมน์เอง ระยะขอบ
  // เดิมที่ grid เคยชดเชยด้วย marginHorizontal ลบ ย้ายไปอยู่ที่ contentContainerStyle
  // ของ FlatList แทน (paddingHorizontal: Spacing.sm) บวกกับ gridCell ด้านล่างที่ยังคง
  // paddingHorizontal ของตัวเองไว้ ได้ระยะขอบนอกเท่าเดิมเป๊ะ (Spacing.lg รวมกัน)
  gridCell: {
    width: '50%',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.x3 * 2,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: Spacing.x3 * 2,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: Spacing.lg,
  },
  emptyBody: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
