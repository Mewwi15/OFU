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
import { LinearGradient } from 'expo-linear-gradient';
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
/** ความสูงช่องค้นหา — ใช้คำนวณให้มันคร่อมรอยต่อพอดีครึ่งบนครึ่งล่าง */
const SEARCH_H = 54;
/* ปลายเฉดล่างต้องเลยขอบหัวจอลงไปให้พ้นรอยหยักมุมของแผ่นขาว (มุมโค้ง 26) เผื่อไว้
   หน่อยกันตอนดึงจอลงเกินขอบแล้วเห็นพื้นเทาโผล่ */
const BACKDROP_BLEED = 96;
const HEAD_RAMP = ['#FF9455', '#F15929', '#D8402A'] as const;

export default function DeliveryHome() {
  const insets = useSafeAreaInsets();
  const address = useAddress(selectedAddress);
  const products = useCatalog((s) => s.products);
  const dbCategories = useCatalog((s) => s.categories);
  const [query, setQuery] = useState('');
  /* ต้องรู้ความสูงหัวจอจริงถึงจะวางช่องค้นหาให้คร่อมรอยต่อสีส้ม/ขาวได้พอดี
   * คำนวณเอาไม่ได้เพราะความสูงขึ้นกับ safe area ของแต่ละเครื่องและความยาวที่อยู่ */
  const [headH, setHeadH] = useState(0);

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
      {/* ไล่เฉดแทนสีส้มแบนตัวเดียว (เจ้าของทัก 3 ก.ย. 2026 ว่า "สีมันส้มไป") — ส้มล้วน
          โทนเดียวเต็มพื้นที่ใหญ่ ๆ อ่านแล้วแบนและแรง ไล่จากส้มอมพีชมุมบนซ้ายไปหาแดงอิฐ
          มุมล่างขวา สีแบรนด์ยังอยู่ตรงกลางเฉด
          วาดเป็นพื้นหลังลอยสูงกว่าหัวจอ ไม่ใช่พื้นของหัวจอเอง เพราะรอยหยักมุมบนของ
          แผ่นขาวอยู่ ต่ำกว่า หัวจอ ถ้าเฉดจบตรงขอบหัวจอ มุมทั้งสองจะต้องเดาสีมาแปะเอง
          แล้วไม่มีวันตรงกับปลายเฉด — ลากพื้นหลังเลยลงไปคลุมมุมซะเลยจบ */}
      <LinearGradient
        colors={HEAD_RAMP}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={[styles.backdrop, { height: headH + BACKDROP_BLEED }]}
      />
      <View
        style={[styles.head, { paddingTop: insets.top + Spacing.sm }]}
        onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        /* โปร่งใส ปล่อยให้เฉดที่ลอยอยู่ข้างหลังโผล่ตรงรอยหยักมุมของแผ่นขาว —
           มุมโค้งจะเห็นว่าโค้งก็ต่อเมื่อมีสีอื่นโผล่ตรงมุมเท่านั้น */
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}>
        {/* แผ่นขาวมุมบนโค้ง (เจ้าของสั่ง 3 ก.ย. 2026) — เว้นบนไว้ให้ครึ่งล่างของช่อง
            ค้นหาที่ลอยคร่อมรอยต่ออยู่ ไม่งั้นหัวข้อแรกจะไปมุดใต้ช่องค้นหา */}
        <View style={styles.sheet}>
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
        </View>
      </ScrollView>

      {/* ช่องค้นหาลอยคร่อมรอยต่อสีส้มกับขาว — วางเป็นชั้นบนสุดนอก ScrollView จึงไม่
          โดนคลิปเหมือนตอนใส่ margin ลบไว้ข้างใน และคร่อมได้จริงทั้งสองฝั่ง
          ขอบมนนิดเดียวตามที่สั่ง ไม่ใช่ทรงแคปซูล */}
      {headH > 0 ? (
        <View style={[styles.searchFloat, { top: headH - SEARCH_H / 2 }]}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="ค้นหาสินค้าที่อยากได้"
            containerStyle={styles.search}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F1EF' },
  head: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.x2,
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
    /* ช่องค้นหาย้ายออกไปลอยนอกหัวจอแล้ว มาสคอตจึงลงมาชิดขอบล่างได้ เว้นไว้นิดเดียว
       ไม่ให้ชนช่องค้นหาที่คร่อมอยู่ */
    bottom: 34,
    width: 96,
    height: 96,
  },
  /* ต้องเป็นแถวและให้ SearchBar ยืดเต็ม — containerStyle ของมันใช้ flex 1 ตามแบบที่
     หน้าอื่นเรียก ถ้าพ่อแม่ไม่ใช่ row ตัวมันจะยุบจนเหลือแต่ไอคอนแว่นขยาย */
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0 },
  searchFloat: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
  },
  search: { flex: 1, height: SEARCH_H, borderRadius: Radius.sm },
  scroll: { backgroundColor: 'transparent' },
  sheet: {
    // flexGrow ให้แผ่นยืดเต็มจอเสมอ ไม่งั้นเนื้อหาสั้น ๆ จะเห็นสีส้มโผล่ข้างล่างด้วย
    flexGrow: 1,
    backgroundColor: '#F4F1EF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: SEARCH_H / 2 + Spacing.md,
  },
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
