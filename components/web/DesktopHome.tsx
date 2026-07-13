/**
 * DesktopHome — the desktop-web landing page (app/(tabs)/index.tsx returns
 * this on wide viewports). A real storefront composition: hero banner,
 * category tiles, best sellers, all-products grid, footer. Same catalog
 * store as the phone screens.
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/shop/CategoryIcon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { DesktopProductCard } from '@/components/web/DesktopProductCard';
import { SiteFooter } from '@/components/web/SiteFooter';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { categories as staticCategories } from '@/data/products';
import { bannerFor } from '@/lib/data/catalog';
import { useT } from '@/lib/i18n';
import { useCatalog } from '@/store/catalog';

const FALLBACK_HERO = require('@/assets/images/braner.jpg');

export function DesktopHome() {
  const t = useT();
  const router = useRouter();

  const products = useCatalog((s) => s.products);
  const banners = useCatalog((s) => s.banners);
  const bestsellerIds = useCatalog((s) => s.bestsellerIds);
  const dbCategories = useCatalog((s) => s.categories);

  const hero = bannerFor(banners, 'home');
  const cats = dbCategories.length ? dbCategories : staticCategories.filter((c) => c !== 'ทั้งหมด');

  const bestsellers = bestsellerIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 4);
  const best = bestsellers.length ? bestsellers : products.slice(0, 4);

  const goCatalog = (category?: string) =>
    router.push(category ? { pathname: '/search', params: { category } } : '/search');

  return (
    <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        {/* Hero */}
        <Pressable accessibilityRole="link" onPress={() => goCatalog()}>
          <Image
            source={hero ? { uri: hero.image } : FALLBACK_HERO}
            style={styles.hero}
            contentFit="cover"
            transition={250}
          />
        </Pressable>

        {/* Categories */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('site.categories')}</Text>
        </View>
        <View style={styles.catRow}>
          {cats.map((c) => (
            <PressableScale
              key={c}
              accessibilityRole="link"
              onPress={() => goCatalog(c)}
              style={styles.catCard}>
              <CategoryIcon category={c} size={64} />
              <Text style={styles.catLabel}>{c}</Text>
            </PressableScale>
          ))}
        </View>

        {/* Best sellers */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('home.bestSellers')}</Text>
          <Pressable accessibilityRole="link" onPress={() => goCatalog()}>
            <Text style={styles.seeAll}>{t('site.viewAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {best.map((p) => (
            <DesktopProductCard key={p.id} product={p} style={styles.gridCard4} />
          ))}
        </View>

        {/* All products */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('site.allProducts')}</Text>
          <Pressable accessibilityRole="link" onPress={() => goCatalog()}>
            <Text style={styles.seeAll}>{t('site.viewAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {products.slice(0, 8).map((p) => (
            <DesktopProductCard key={p.id} product={p} style={styles.gridCard4} />
          ))}
        </View>
      </View>
      <SiteFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  hero: {
    width: '100%',
    height: 360,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryTint,
    ...Shadow.card,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl * 1.5,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  seeAll: {
    ...Typography.bodyStrong,
    color: Colors.primaryStrong,
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  catCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    minWidth: 128,
    flexGrow: 1,
    flexBasis: '12%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  catLabel: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: Colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  gridCard4: {
    flexGrow: 1,
    flexBasis: '22%',
    maxWidth: '24%',
  },
});
