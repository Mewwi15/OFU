import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { AppText } from '@/components/ui/Text';
import { ProductCard } from '@/components/product/ProductCard';
import { Colors, Spacing } from '@/constants/theme';
import { categories, products, type Category } from '@/data/products';

/** Extra bottom padding so the floating tab bar never covers grid content. */
const TAB_BAR_CLEARANCE = 96;

/**
 * Search screen: brand header + bell/bag actions, a prominent search bar, a
 * category chip row, and a 2-column product grid filtered by the search text
 * (name/subtitle) AND the active category. Shows an empty state when nothing
 * matches.
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('ทั้งหมด');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [query, activeCategory]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}>
        <ScreenHeader
          brand
          right={
            <>
              <IconButton
                icon="notifications-outline"
                onPress={() => {}}
              />
              <IconButton
                icon="bag-outline"
                onPress={() => router.push('/cart')}
              />
            </>
          }
          style={styles.header}
        />

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="ค้นหาสินค้า"
          onFilterPress={() => {}}
          style={styles.search}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}>
          {categories.map((category) => (
            <Chip
              key={category}
              label={category}
              active={category === activeCategory}
              onPress={() => setActiveCategory(category)}
            />
          ))}
        </ScrollView>

        {results.length > 0 ? (
          <View style={styles.grid}>
            {results.map((product) => (
              <View key={product.id} style={styles.gridCell}>
                <ProductCard product={product} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <IconButton
              icon="search-outline"
              variant="primary"
              size={64}
              disabled
            />
            <AppText variant="h2" style={styles.emptyTitle}>
              ไม่พบสินค้าที่ค้นหา
            </AppText>
            <AppText
              variant="body"
              color={Colors.textMuted}
              style={styles.emptyBody}>
              ลองค้นหาด้วยคำอื่นหรือเลือกหมวดหมู่อื่นดูนะคะ
            </AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  search: {
    marginBottom: Spacing.lg,
  },
  chipsScroll: {
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.lg,
  },
  chipsRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.sm,
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
  emptyTitle: {
    marginTop: Spacing.lg,
  },
  emptyBody: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
