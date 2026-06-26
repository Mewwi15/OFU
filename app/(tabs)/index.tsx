import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/searchbar';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { categories, products, type Category } from '@/data/products';

/** Bottom padding so the floating tab bar never covers the last row. */
const TAB_BAR_CLEARANCE = 110;
/** Promo banner background image. */
const PROMO_IMAGE = 'https://picsum.photos/seed/oofoo-promo/900/600';
/** Decorative dot indicators on the promo banner. */
const PROMO_DOTS = [0, 1, 2];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('ทั้งหมด');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        activeCategory === 'ทั้งหมด' || p.category === activeCategory;
      const matchesQuery =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom },
        ]}>
        <ScreenHeader
          brand
          style={styles.header}
          right={
            <>
              <IconButton icon="notifications-outline" onPress={() => {}} />
              <IconButton
                icon="bag-outline"
                onPress={() => router.push('/cart')}
              />
            </>
          }
        />

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="ค้นหาสินค้า"
          containerStyle={styles.search}
          rightIcon={
            <Pressable onPress={() => {}} hitSlop={8}>
              <Ionicons name="options-outline" size={20} color={Colors.primary} />
            </Pressable>
          }
        />

        <View style={styles.banner}>
          <Image
            source={{ uri: PROMO_IMAGE }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerContent}>
            <Text variant="title" style={{ color: Colors.textOnPrimary }}>
              {'ลดสูงสุด 40%\nช้อปเลยวันนี้!'}
            </Text>
            <Button size="sm" onPress={() => {}} style={styles.bannerButton}>
              ช้อปเลย
            </Button>
            <View style={styles.dots}>
              {PROMO_DOTS.map((d) => (
                <View
                  key={d}
                  style={[styles.dot, d === 0 && styles.dotActive]}
                />
              ))}
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={cat === activeCategory}
              onPress={() => setActiveCategory(cat)}
            />
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="subtitle" style={{ color: Colors.textMuted }}>
                ไม่พบสินค้าที่ค้นหา
              </Text>
            </View>
          ) : (
            filtered.map((product) => (
              <View key={product.id} style={styles.gridCell}>
                <ProductCard product={product} />
              </View>
            ))
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
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginTop: Spacing.sm,
  },
  search: {
    marginTop: Spacing.lg,
  },
  banner: {
    marginTop: Spacing.xl,
    height: 180,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
    ...Shadow.card,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  bannerContent: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  bannerButton: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
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
  chips: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridCell: {
    width: '47.5%',
  },
  empty: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.x3,
  },
});
