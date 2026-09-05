/**
 * สินค้าโปรด — `/online/favorites`
 *
 * เจ้าของสั่ง 5 ก.ย. 2026 ให้เป็นหนึ่งในห้าเมนูของแถบล่างโหมดออนไลน์
 *
 * ของโปรดเก็บเป็นชุด id (store/favorites) ส่วนตัวสินค้าจริงอ่านจาก catalog ที่โหลดอยู่แล้ว
 * — ไม่ต้องยิงขอข้อมูลสินค้าซ้ำ และราคา/สถานะของหมดจะตรงกับที่เห็นในหน้าอื่นเสมอ
 *
 * โหลดใหม่ทุกครั้งที่กลับเข้าหน้า — กดหัวใจจากหน้าอื่นแล้วสลับมาหน้านี้ต้องเห็นทันที
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { ONLINE_ACCENT } from '@/constants/online';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Product } from '@/data/products';
import { useAuth } from '@/store/auth';
import { loadIfStale, useCatalog } from '@/store/catalog';
import { useFavorites } from '@/store/favorites';

/** เว้นล่างให้พ้นแถบล่างที่ลอยอยู่ */
const TAB_BAR_CLEARANCE = 110;

export default function OnlineFavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signedIn = useAuth((s) => s.status === 'authenticated');

  const ids = useFavorites((s) => s.ids);
  const loadFavorites = useFavorites((s) => s.load);
  const favLoaded = useFavorites((s) => s.loaded);
  const products = useCatalog((s) => s.products);
  const catalogLoaded = useCatalog((s) => s.loaded);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadIfStale();
      void loadFavorites(true);
    }, [loadFavorites]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavorites(true);
    setRefreshing(false);
  };

  /* เรียงตามลำดับที่กดโปรด (ใหม่ก่อน) ไม่ใช่ลำดับในคลังสินค้า — id ที่หาสินค้าไม่เจอถูกทิ้ง
     (สินค้าถูกเลิกขายหลังจากลูกค้ากดโปรดไว้) ไม่ใช่โชว์เป็นช่องว่างให้งง */
  const items = useMemo(
    () =>
      ids
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => !!p),
    [ids, products],
  );

  const loading = !favLoaded || !catalogLoaded;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      {/* ScreenHeader ไม่เว้นขอบบนให้เอง หน้าจอต้องเว้น insets.top เอง */}
      <ScreenHeader title="สินค้าโปรด" style={styles.header} />

      <FlatList
        data={loading ? [] : items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ONLINE_ACCENT.solid}
          />
        }
        renderItem={({ item, index }) => (
          <ProductCard product={item} index={index} accent={ONLINE_ACCENT} />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.row}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.skCell}>
                  <ProductCardSkeleton />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: ONLINE_ACCENT.tint }]}>
                <Ionicons name="heart-outline" size={34} color={ONLINE_ACCENT.strong} />
              </View>
              <Text variant="subtitle" style={styles.emptyTitle}>
                {signedIn ? 'ยังไม่มีสินค้าโปรด' : 'เข้าสู่ระบบเพื่อเก็บสินค้าโปรด'}
              </Text>
              <Text style={styles.emptyBody}>
                {signedIn
                  ? 'กดรูปหัวใจที่มุมสินค้า เก็บไว้ดูทีหลังได้'
                  : 'ของโปรดผูกกับบัญชี เปลี่ยนเครื่องแล้วยังอยู่'}
              </Text>
              <PressableScale
                accessibilityRole="button"
                onPress={() => router.push('/online')}
                style={[styles.emptyBtn, { backgroundColor: ONLINE_ACCENT.solid }]}>
                <Text style={styles.emptyBtnText}>ไปเลือกสินค้า</Text>
              </PressableScale>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
  skCell: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: Spacing.x3 * 2 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: Spacing.lg, textAlign: 'center' },
  emptyBody: {
    marginTop: Spacing.xs,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  emptyBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.x2,
    height: 46,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.textOnPrimary,
  },
});
