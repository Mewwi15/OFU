/**
 * ProductRail — a titled, horizontally-scrolling row of ProductCards with an
 * optional "ดูทั้งหมด" action. Shared by the Home and Catalog screens.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product/ProductCard';
import { Text } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';

export type ProductRailProps = {
  title: string;
  data: Product[];
  /** Optional "ดูทั้งหมด" handler (omit to hide the action). */
  onSeeAll?: () => void;
};

/** Fixed card width inside a horizontal rail. */
const CARD_WIDTH = 168;

export function ProductRail({ title, data, onSeeAll }: ProductRailProps) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="subtitle">{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
            <Text style={styles.seeAll}>ดูทั้งหมด</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {data.map((product, i) => (
          <View key={product.id} style={styles.card}>
            <ProductCard product={product} index={i} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  seeAll: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 13,
    color: Colors.primaryStrong,
  },
  row: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
  },
});
