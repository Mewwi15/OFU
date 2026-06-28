import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { ProductRail } from '@/components/product/ProductRail';
import { PromoBanner } from '@/components/shop/PromoBanner';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { SearchBar } from '@/components/ui/searchbar';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { categories, products, type Category } from '@/data/products';

/** Extra bottom padding so the floating tab bar never covers grid content. */
const TAB_BAR_CLEARANCE = 96;

/* Curated catalog rails (derived from the mock catalog). */
const TRENDING = products.slice(0, 6);
const PROMOTIONS = [...products].sort((a, b) => a.price - b.price).slice(0, 6);
const HOT_WEEKLY = [...products].sort((a, b) => b.rating - a.rating).slice(0, 6);

/** Promo banner heading each curated section. */
const SECTION_BANNERS = {
  trending: {
    title: 'กำลังมาแรง 🔥',
    subtitle: 'สินค้าที่คนสั่งเยอะที่สุดสัปดาห์นี้',
    image: 'https://picsum.photos/seed/oofoo-trend/900/360',
  },
  promo: {
    title: 'ลดสูงสุด 40%',
    subtitle: 'ดีลคุ้มประจำวัน เฉพาะวันนี้',
    image: 'https://picsum.photos/seed/oofoo-promo/900/360',
  },
  hot: {
    title: 'เรตติ้งสูงสุด ⭐',
    subtitle: 'คัดจากรีวิวลูกค้าตัวจริง',
    image: 'https://picsum.photos/seed/oofoo-hot/900/360',
  },
} as const;

/** Whether an arbitrary string is one of our canonical categories. */
function isCategory(value: string | undefined): value is Category {
  return !!value && (categories as readonly string[]).includes(value);
}

/**
 * Catalog ("สินค้าทั้งหมด"): a search bar + category chips. By default it shows
 * curated horizontal rails (ติดกระแส / โปรโมชั่น / มาแรงประจำสัปดาห์) above a
 * vertical "แนะนำสำหรับคุณ" grid. Typing a query or picking a category instead
 * shows a flat filtered grid. Can arrive pre-filtered via a `category` param.
 */
export default function CatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category } = useLocalSearchParams<{ category?: string }>();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>(
    isCategory(category) ? category : 'ทั้งหมด',
  );

  // Sync the filter when arriving with a (new) category param from home.
  useEffect(() => {
    if (isCategory(category)) setActiveCategory(category);
  }, [category]);

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
  }, [q, activeCategory]);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}>
        {/* Brand hero (coral) — แอป อู้ฟู่ mascot logo on the right edge. The
            gradient deepens toward the bottom-right so the light watercolor
            logo stays legible. */}
        <View
          style={[
            styles.hero,
            { paddingTop: insets.top + Spacing.sm, height: insets.top + 182 },
          ]}>
          <LinearGradient
            colors={['#F15929', '#A8331A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTop}>
            <View style={styles.heroTitleWrap}>
              <Text variant="caption" style={styles.heroKicker}>
                อู้ฟู่ · ของสดของดี
              </Text>
            </View>
            <IconButton
              icon="bag-outline"
              accessibilityLabel="ตะกร้า"
              onPress={() => router.push('/cart')}
            />
          </View>
          {/* The mascot's face is translucent in the artwork, so a white disc
              sits behind ONLY the face — the rest of the logo (fu, body, tail)
              shows on the coral hero directly (ref: brand logo on a dark bg). */}
          <View
            style={[styles.heroLogoWrap, { top: insets.top + 60 }]}
            pointerEvents="none">
            <View style={styles.heroLogoFace} />
            <Image
              source={require('../../assets/images/logo-oofoo.png')}
              style={styles.heroLogo}
              contentFit="contain"
            />
          </View>
        </View>

        <View style={styles.body}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="ค้นหาสินค้า"
            rightIcon={
              <Pressable
                onPress={() => {}}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="ค้นหาด้วยเสียง">
                <Ionicons name="mic-outline" size={20} color={Colors.primary} />
              </Pressable>
            }
            containerStyle={styles.search}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.chipsScroll}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                active={cat === activeCategory}
                onPress={() => setActiveCategory(cat)}
              />
            ))}
          </ScrollView>

          {isBrowsing ? (
          /* Curated view: a promo banner heading each horizontal rail, then a
             vertical recommended grid */
          <>
            <PromoBanner {...SECTION_BANNERS.trending} />
            <ProductRail title="สินค้าติดกระแส" data={TRENDING} />
            <PromoBanner {...SECTION_BANNERS.promo} />
            <ProductRail title="โปรโมชั่น" data={PROMOTIONS} />
            <PromoBanner {...SECTION_BANNERS.hot} />
            <ProductRail title="มาแรงประจำสัปดาห์" data={HOT_WEEKLY} />

            <View style={styles.gridSection}>
              <Text variant="subtitle" style={styles.gridTitle}>
                แนะนำสำหรับคุณ
              </Text>
              <View style={styles.grid}>
                {products.map((product, i) => (
                  <View key={product.id} style={styles.gridCell}>
                    <ProductCard product={product} index={i} />
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : results.length > 0 ? (
          /* Filtered view: a flat grid */
          <View style={styles.grid}>
            {results.map((product, i) => (
              <View key={product.id} style={styles.gridCell}>
                <ProductCard product={product} index={i} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search" size={40} color={Colors.primary} />
            </View>
            <Text variant="subtitle" style={styles.emptyTitle}>
              ไม่พบสินค้าที่ค้นหา
            </Text>
            <Text
              variant="body"
              style={[{ color: Colors.textMuted }, styles.emptyBody]}>
              ลองค้นหาด้วยคำอื่นหรือเลือกหมวดหมู่อื่นดูนะคะ
            </Text>
          </View>
          )}
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
  hero: {
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.9)',
  },
  heroLogoWrap: {
    position: 'absolute',
    right: Spacing.md,
    width: 184,
    height: 81,
  },
  heroLogoFace: {
    // White disc behind the mascot's face (centered ~x0.22, y0.60 of the
    // artwork). Sized larger than the face opening on purpose — the opaque tan
    // head renders on top and masks the overflow, leaving a fully white face
    // with no coral rim.
    position: 'absolute',
    left: 29,
    top: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
  },
  heroLogo: {
    width: 184,
    height: 81,
  },
  body: {
    paddingHorizontal: Spacing.lg,
  },
  search: {
    marginTop: -24,
    marginBottom: Spacing.lg,
  },
  chipsScroll: {
    marginHorizontal: -Spacing.lg,
  },
  chipsRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  gridSection: {
    marginTop: Spacing.xl,
  },
  gridTitle: {
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.sm,
    marginTop: Spacing.lg,
  },
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
