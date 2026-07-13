/**
 * DesktopCatalog — the desktop-web product listing (app/(tabs)/search.tsx
 * returns this on wide viewports). Reference layout: breadcrumb, filter
 * sidebar (category + price range), toolbar (result count + sort), and a
 * 3-column product grid. Pure client-side filtering over the catalog store.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { DesktopProductCard } from '@/components/web/DesktopProductCard';
import { SiteFooter } from '@/components/web/SiteFooter';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { categories as staticCategories } from '@/data/products';
import { useT } from '@/lib/i18n';
import { useCatalog } from '@/store/catalog';

const ALL = 'ทั้งหมด';

type SortKey = 'featured' | 'priceAsc' | 'priceDesc';
const SORTS: { key: SortKey; labelKey: string }[] = [
  { key: 'featured', labelKey: 'site.sortFeatured' },
  { key: 'priceAsc', labelKey: 'site.sortPriceAsc' },
  { key: 'priceDesc', labelKey: 'site.sortPriceDesc' },
];

type Props = {
  initialCategory?: string;
  initialQuery?: string;
};

export function DesktopCatalog({ initialCategory, initialQuery }: Props) {
  const t = useT();
  const router = useRouter();

  const products = useCatalog((s) => s.products);
  const dbCategories = useCatalog((s) => s.categories);
  const cats = [ALL, ...(dbCategories.length ? dbCategories : staticCategories.filter((c) => c !== ALL))];

  const [category, setCategory] = useState(initialCategory ?? ALL);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const query = (initialQuery ?? '').trim().toLowerCase();

  const countFor = (c: string) =>
    c === ALL ? products.length : products.filter((p) => p.category === c).length;

  const shown = useMemo(() => {
    const min = Number(priceMin) || 0;
    const max = Number(priceMax) || Number.POSITIVE_INFINITY;
    const list = products.filter(
      (p) =>
        (category === ALL || p.category === category) &&
        p.price >= min &&
        p.price <= max &&
        (!query ||
          p.name.toLowerCase().includes(query) ||
          p.subtitle.toLowerCase().includes(query)),
    );
    if (sort === 'priceAsc') return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, category, priceMin, priceMax, sort, query]);

  const clearFilters = () => {
    setCategory(ALL);
    setPriceMin('');
    setPriceMax('');
    setSort('featured');
  };

  return (
    <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/')}>
            <Text style={styles.crumbLink}>{t('tab.home')}</Text>
          </Pressable>
          <Text style={styles.crumbSep}>/</Text>
          <Text style={styles.crumbHere}>
            {category === ALL ? t('tab.products') : category}
          </Text>
        </View>
        <Text style={styles.pageTitle}>
          {shown.length} {t('site.resultsSuffix')}
          {query ? ` · "${query}"` : ''}
        </Text>

        <View style={styles.body}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <View style={styles.filterCard}>
              <Text style={styles.filterTitle}>{t('site.categories')}</Text>
              {cats.map((c) => {
                const active = c === category;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    onPress={() => setCategory(c)}
                    style={[styles.catItem, active && styles.catItemActive]}>
                    <Text style={[styles.catItemText, active && styles.catItemTextActive]}>
                      {c}
                    </Text>
                    <Text style={styles.catCount}>{countFor(c)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.filterCard}>
              <Text style={styles.filterTitle}>{t('site.priceRange')}</Text>
              <View style={styles.priceRow}>
                <TextInput
                  value={priceMin}
                  onChangeText={(v) => setPriceMin(v.replace(/\D/g, ''))}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.priceInput}
                />
                <Text style={styles.priceDash}>-</Text>
                <TextInput
                  value={priceMax}
                  onChangeText={(v) => setPriceMax(v.replace(/\D/g, ''))}
                  placeholder="9999"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.priceInput}
                />
              </View>
            </View>

            <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearBtn}>
              <Text style={styles.clearText}>{t('site.clearFilter')}</Text>
            </Pressable>
          </View>

          {/* Main column */}
          <View style={styles.main}>
            <View style={styles.toolbar}>
              <View style={styles.sortRow}>
                {SORTS.map((s) => {
                  const active = s.key === sort;
                  return (
                    <Pressable
                      key={s.key}
                      accessibilityRole="button"
                      onPress={() => setSort(s.key)}
                      style={[styles.sortChip, active && styles.sortChipActive]}>
                      <Text style={[styles.sortText, active && styles.sortTextActive]}>
                        {t(s.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {shown.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ color: Colors.textMuted }}>{t('site.noResults')}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {shown.map((p) => (
                  <DesktopProductCard key={p.id} product={p} style={styles.gridCard3} />
                ))}
              </View>
            )}
          </View>
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
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  crumbLink: {
    ...Typography.caption,
    color: Colors.primaryStrong,
  },
  crumbSep: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  crumbHere: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  pageTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  body: {
    flexDirection: 'row',
    gap: Spacing.xl,
    alignItems: 'flex-start',
  },

  /* Sidebar */
  sidebar: {
    width: 260,
    gap: Spacing.lg,
  },
  filterCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...Shadow.card,
  },
  filterTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  catItemActive: {
    backgroundColor: Colors.primaryTint,
  },
  catItemText: {
    ...Typography.body,
    color: Colors.text,
  },
  catItemTextActive: {
    ...Typography.bodyStrong,
    color: Colors.primaryStrong,
  },
  catCount: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceInput: {
    ...Typography.body,
    flex: 1,
    // web flexbox: text inputs default to min-width:auto and burst the card
    minWidth: 0,
    height: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  priceDash: {
    color: Colors.textMuted,
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  clearText: {
    ...Typography.button,
    color: Colors.textMuted,
  },

  /* Main */
  main: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.lg,
  },
  sortRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sortChip: {
    paddingHorizontal: Spacing.lg,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: {
    backgroundColor: Colors.primaryStrong,
    borderColor: Colors.primaryStrong,
  },
  sortText: {
    ...Typography.button,
    fontSize: 13,
    color: Colors.text,
  },
  sortTextActive: {
    color: Colors.textOnPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  gridCard3: {
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '32%',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
});
