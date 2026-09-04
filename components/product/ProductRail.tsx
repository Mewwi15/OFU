/**
 * ProductRail — a titled, horizontally-scrolling row of ProductCards with an
 * optional "ดูทั้งหมด" action. Shared by the Home and Catalog screens.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton';
import { Text } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { useT } from '@/lib/i18n';

export type ProductRailProps = {
  /** Section heading. Omit when a PromoBanner already heads the section. */
  title?: string;
  data: Product[];
  /** Optional "ดูทั้งหมด" handler (omit to hide the action). */
  onSeeAll?: () => void;
  /** โชว์โครงการ์ดรอแทนของจริง ระหว่างคลังสินค้ายังโหลดไม่เสร็จ */
  loading?: boolean;
};

/** Fixed card width inside a horizontal rail. */
const CARD_WIDTH = 168;
/* จำนวนโครงการ์ดตอนรอ — พอให้เต็มความกว้างจอบวกโผล่ใบถัดไปนิดหน่อย ให้รู้ว่าเลื่อนได้
   มากกว่านี้ไม่มีประโยชน์เพราะมองไม่เห็นอยู่ดี แต่กินแรงวาดเพิ่มฟรี ๆ */
const SKELETON_COUNT = 3;

export function ProductRail({ title, data, onSeeAll, loading = false }: ProductRailProps) {
  const t = useT();
  const showHead = !!title || !!onSeeAll;
  return (
    <View style={[styles.section, !showHead && styles.sectionTight]}>
      {showHead ? (
        <View style={styles.head}>
          <Text variant="subtitle">{title}</Text>
          {onSeeAll ? (
            <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
              <Text style={styles.seeAll}>{t('widget.seeAll')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        /* ปิดการเลื่อนตอนรอ — เลื่อนโครงเปล่าไปมาไม่ได้ให้อะไร แถมเผยว่ามีแค่ไม่กี่ใบ */
        scrollEnabled={!loading}
        contentContainerStyle={styles.row}>
        {loading
          ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <View key={`sk-${i}`} style={styles.card}>
                <ProductCardSkeleton />
              </View>
            ))
          : data.map((product, i) => (
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
  // When a PromoBanner already heads the section, sit snug beneath it.
  sectionTight: {
    marginTop: Spacing.md,
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
