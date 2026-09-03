/**
 * หน้าร้านโหมดเดลิเวอรี่ — คนละหน้ากับโหมดออนไลน์โดยสิ้นเชิง
 *
 * เจ้าของสั่ง 3 ก.ย. 2026: "สินค้าคืออันเดียวกันนี่แหละ แต่ UI จะทำต่างกันโดยสิ้นเชิง
 * ระหว่าง Delivery และ ออนไลน์" — สินค้าจึงอ่านจาก catalog store ตัวเดียวกับทุกหน้า
 * ไม่มีการก๊อปข้อมูลหรือคิวรีชุดใหม่ ที่ต่างคือหน้าตาและสิ่งที่เน้น
 *
 * โหมดนี้ = ของถึงบ้านในวันเดียวกัน สิ่งที่คนซื้อสนใจคือ "จะถึงเมื่อไหร่" กับ
 * "ส่งมาที่ไหน" หัวจอจึงเป็นที่อยู่กับเวลาส่ง ไม่ใช่แบนเนอร์โปรโมชั่นเหมือนหน้าแรก
 * (อ้างอิงหน้าเดลิเวอรี่ของ 7-Eleven ที่เจ้าของส่งมา)
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/shop/CategoryIcon';
import { ProductRail } from '@/components/product/ProductRail';
import { CartBadge } from '@/components/navigation/CartBadge';
import { IconButton } from '@/components/ui/IconButton';
import { SearchBar } from '@/components/ui/searchbar';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { categories } from '@/data/products';
import { useCatalog } from '@/store/catalog';
import { selectedAddress, useAddress } from '@/store/address';
import { MODE_META } from '@/store/mode';

const TAB_BAR_CLEARANCE = 110;

export default function DeliveryHome() {
  const insets = useSafeAreaInsets();
  const address = useAddress(selectedAddress);
  const products = useCatalog((s) => s.products);
  const dbCategories = useCatalog((s) => s.categories);
  const [query, setQuery] = useState('');

  const catList = dbCategories.length ? ['ทั้งหมด', ...dbCategories] : [...categories];

  /* คัดสินค้าให้แต่ละแถวจากคลังเดียวกับหน้าอื่น — ต่างกันแค่วิธีจัดเรียงบนจอ
   * ไม่ได้ไปดึงข้อมูลชุดใหม่มา ของที่ขายก็คือของเดียวกันทั้งร้าน */
  const rails = useMemo(() => {
    const inStock = products.filter((p) => (p.variants?.[0]?.available ?? 1) > 0);
    return {
      quick: inStock.slice(0, 10),
      popular: [...inStock].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10),
    };
  }, [products]);

  return (
    <View style={styles.screen}>
      {/* หัวจอสีแบรนด์ — ที่อยู่กับเวลาส่งเป็นพระเอก เพราะคนเปิดโหมดนี้ถามสองอย่างนี้
          ก่อนถามเรื่องของ */}
      <View style={[styles.head, { paddingTop: insets.top + Spacing.sm }]}>
        {/* รูปประกอบวางเป็นลูกคนแรก จะได้อยู่ชั้นล่างสุด — ตอนแรกวางไว้ท้ายสุดแล้วมัน
            ไปทับปุ่มตะกร้ามุมขวาบนจนกดไม่เห็น ของประดับต้องอยู่ใต้ปุ่มเสมอ */}
        <Image
          source={MODE_META.delivery.image}
          style={styles.headMascot}
          contentFit="contain"
          pointerEvents="none"
        />
        <View style={styles.headRow}>
          <IconButton
            icon="chevron-back"
            variant="surface"
            shape="circle"
            size={40}
            accessibilityLabel="ย้อนกลับ"
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }} />
          <View style={styles.cartWrap}>
            <IconButton
              icon="bag-outline"
              variant="surface"
              shape="circle"
              size={40}
              accessibilityLabel="ตะกร้า"
              onPress={() => router.push('/cart')}
            />
            <CartBadge />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="เปลี่ยนที่อยู่จัดส่ง"
          style={styles.addrBlock}
          onPress={() => router.push('/address')}>
          <Text style={styles.headKicker}>{MODE_META.delivery.label} · ส่งถึงบ้าน</Text>
          <View style={styles.addrRow}>
            <Text numberOfLines={1} style={styles.addrText}>
              {address ? address.line : 'เลือกที่อยู่จัดส่ง'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </View>
        </Pressable>

        {/* ช่องค้นหาอยู่ในหัวจอ ไม่ใช่ดึงขึ้นมาคร่อมขอบ — ตอนแรกวางไว้ใน ScrollView
            แล้วใช้ marginTop ลบ ผลคือครึ่งบนโดน ScrollView คลิปหายไป
            อยู่ในหัวจอแบบนี้ยังได้ผลเหมือนกันและไม่มีอะไรโดนตัด */}
        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="ค้นหาสินค้าที่อยากได้"
            containerStyle={styles.search}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}>
        <View style={styles.body}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}>
            {catList.map((cat) => (
              <Pressable
                key={cat}
                accessibilityRole="button"
                accessibilityLabel={cat}
                style={styles.catCard}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { cat } })}>
                <CategoryIcon category={cat} size={58} />
                <Text numberOfLines={1} style={styles.catLabel}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* แถบสัญญาเวลา — ของที่โหมดนี้ขายจริง ๆ คือความเร็ว ไม่ใช่ราคา */}
          <View style={styles.promise}>
            <Ionicons name="bicycle" size={22} color={Colors.primary} />
            <Text style={styles.promiseText}>สั่งตอนนี้ ได้ของวันนี้ · ส่งฟรีเมื่อครบ 200 บาท</Text>
          </View>
        </View>

        <ProductRail title="สั่งซ้ำได้เลย" data={rails.quick} />
        <ProductRail title="คนแถวนี้ชอบสั่ง" data={rails.popular} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F1EF' },
  head: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  cartWrap: { position: 'relative' },
  addrBlock: { marginTop: Spacing.xs, paddingRight: 110 },
  headKicker: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addrText: {
    flex: 1,
    fontFamily: 'Mitr_500Medium',
    fontSize: 19,
    color: '#fff',
  },
  headMascot: {
    position: 'absolute',
    right: Spacing.lg,
    /* ยกให้พ้นช่องค้นหาที่อยู่ล่างสุดของหัวจอ — เดิม bottom 0 ทำให้มาสคอตไปอยู่
       หลังช่องค้นหาแล้วโดนบังครึ่งตัว (สูงช่องค้นหา ~54 + ระยะห่าง 16 + ขอบล่าง 16) */
    bottom: 88,
    width: 96,
    height: 96,
  },
  /* ต้องเป็นแถวและให้ SearchBar ยืดเต็ม — containerStyle ของมันใช้ flex 1 ตามแบบที่
     หน้าอื่นเรียก ถ้าพ่อแม่ไม่ใช่ row ตัวมันจะยุบจนเหลือแต่ไอคอนแว่นขยาย */
  searchWrap: { flexDirection: 'row', marginTop: Spacing.lg },
  search: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg },
  catRow: { gap: Spacing.lg, paddingVertical: Spacing.lg, paddingRight: Spacing.lg },
  catCard: { alignItems: 'center', width: 74, gap: Spacing.xs },
  catLabel: { fontSize: 12, color: Colors.text, textAlign: 'center' },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  promiseText: { flex: 1, fontSize: 13, color: Colors.text },
});
