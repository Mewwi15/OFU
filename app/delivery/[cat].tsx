/**
 * หน้าสินค้าของหมวดเดียว ในโหมดเดลิเวอรี่
 *
 * เจ้าของสั่ง 3 ก.ย. 2026 ให้ย้ายเส้นทางการซื้อ — "หน้าสินค้าจะไม่มีแล้ว จะย้ายมาอยู่ใน
 * แต่ละหมวด" ทางเข้าคือกดหมวดจากหน้าร้านเดลิเวอรี่ ไม่ใช่แท็บสินค้าที่แชร์กันทุกโหมด
 *
 * ใช้ FlatList ไม่ใช่ map ทั้งก้อนเหมือนแท็บสินค้าเดิม เพราะหมวดใหญ่สุด (ของใช้ในบ้าน)
 * มีสินค้า 329 ชิ้น วาดพร้อมกันหมดจะกินหน่วยความจำและกระตุกตอนเปิด
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartBadge } from '@/components/navigation/CartBadge';
import { ProductCard } from '@/components/product/ProductCard';
import { IconButton } from '@/components/ui/IconButton';
import { SearchBar } from '@/components/ui/searchbar';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  DELIVERY_INK,
  DELIVERY_INK_SHADOW,
  DELIVERY_RAMP,
  DELIVERY_SHEET_BG,
} from '@/constants/delivery';
import { ALL_CATEGORY } from '@/lib/data/catalog';
import { useCatalog } from '@/store/catalog';

const TAB_BAR_CLEARANCE = 110;

export default function DeliveryCategory() {
  const insets = useSafeAreaInsets();
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const category = cat ?? ALL_CATEGORY;
  const products = useCatalog((s) => s.products);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (category === ALL_CATEGORY ? true : p.category === category))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      /* ของที่ซื้อได้ขึ้นก่อนเสมอ — หมวดใหญ่มีของหมดปนอยู่หลายสิบชิ้น ถ้าเรียงตามลำดับ
         เดิมคนเลื่อนไปเจอแต่ป้าย "สินค้าหมด" ก่อนจะถึงของที่ซื้อได้จริง */
      .sort((a, b) => {
        const av = (a.variants?.[0]?.available ?? 0) > 0 ? 0 : 1;
        const bv = (b.variants?.[0]?.available ?? 0) > 0 ? 0 : 1;
        return av - bv;
      });
  }, [products, category, query]);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={DELIVERY_RAMP}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.75, 1]}
        style={[styles.head, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headRow}>
          <IconButton
            icon="chevron-back"
            variant="tint"
            shape="circle"
            size={34}
            color={DELIVERY_INK}
            style={styles.glassBtn}
            accessibilityLabel="ย้อนกลับ"
            onPress={() => router.back()}
          />
          <Text numberOfLines={1} style={styles.title}>
            {category}
          </Text>
          <View style={styles.cartWrap}>
            <IconButton
              icon="bag-outline"
              variant="tint"
              shape="circle"
              size={34}
              color={DELIVERY_INK}
              style={styles.glassBtn}
              accessibilityLabel="ตะกร้า"
              onPress={() => router.push('/cart')}
            />
            <CartBadge />
          </View>
        </View>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={`ค้นหาใน${category}`}
          containerStyle={styles.search}
        />
      </LinearGradient>

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <View style={styles.cell}>
            <ProductCard product={item} index={index} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="basket-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {query ? 'ไม่เจอสินค้าที่ค้นหา' : 'หมวดนี้ยังไม่มีสินค้า'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DELIVERY_SHEET_BG },
  head: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: {
    flex: 1,
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 19,
    color: DELIVERY_INK,
    ...DELIVERY_INK_SHADOW,
  },
  cartWrap: { position: 'relative' },
  glassBtn: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  search: { height: 46, borderRadius: Radius.sm, ...Shadow.float },
  list: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.lg },
  cell: { width: '50%', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.lg },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.x3 * 2 },
  emptyText: { color: Colors.textMuted },
});
