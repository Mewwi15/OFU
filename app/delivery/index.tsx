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
import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
/* หัวจอตอนย่อ = แถวปุ่ม + บล็อกที่อยู่ที่ยกขึ้นมาอยู่แถวเดียวกัน + เว้นล่างนิดหน่อย
   ต้องคิดจากขนาดจริงของสองอย่างนี้ ไม่ใช่จากเปอร์เซ็นต์ของหัวจอเต็ม เพราะหัวจอเต็ม
   สูงไม่เท่ากันในแต่ละเครื่อง (safe area) แต่แถบย่อควรสูงเท่ากันทุกเครื่อง */
const NAV_H = 34; // ปุ่มเล็กลงตามที่สั่ง 3 ก.ย. 2026
const ADDR_LIFT = 44; // ยกบล็อกที่อยู่ขึ้นไปเสมอแถวปุ่ม
const ADDR_MARGIN = -2; // ที่อยู่ขยับขึ้นชิดแถวปุ่ม (เจ้าของสั่ง 3 ก.ย. 2026)
const ADDR_SHIFT = 52; // แล้วเลื่อนขวาให้พ้นปุ่มย้อนกลับ
const BAR_PAD_BOTTOM = 14;
const HEAD_PAD_TOP = 2; // ปุ่มชิดขอบบนกว่าเดิม
/* มาสคอต: กล่อง 96 แต่ตัวรูปจริงกินแค่ y 11%–88% ของกล่อง (ที่เหลือเป็นพื้นใส)
   ตำแหน่งจึงต้องคิดจากขอบรูปจริง ไม่ใช่ขอบกล่อง ไม่งั้นจะดูเหมือนยังลอยอยู่สูง */
const MASCOT = 96;
const MASCOT_TOP_FROM_HEAD = -82; // ให้ท้ายรถมุดหลังช่องค้นหาราว 40% ของตัวรูป
/* เลิกใช้ส้มแบรนด์เดิม ย้ายมาใช้เฉดของแบนเนอร์ภาพที่ 2 (เจ้าของสั่ง 3 ก.ย. 2026)
   ดูดสีจากไฟล์แบนเนอร์จริงบน production ไม่ได้กะเอาเอง — ไล่จากบนลงล่างตรง ๆ
   ไม่ใช่ทแยงเหมือนเดิม เพราะของเดิมในภาพก็ไล่แนวตั้ง ถ้าทำทแยงจะไม่เข้าคู่กับแบนเนอร์
   ปลายล่างเป็นครีมอ่อน กลืนกับแผ่นเนื้อหาสีอ่อนพอดี แต่แลกมาด้วยการที่ตัวหนังสือขาว
   ใช้ไม่ได้อีกต่อไป ต้องเปลี่ยนเป็นสีเข้ม */
const HEAD_RAMP = ['#FC5738', '#FD8D61', '#FCDEB4'] as const;
/* สีตัวหนังสือบนหัวจอ — น้ำตาลอมแดงเข้ม ไม่ใช่ขาวและไม่ใช่เทาดำ
   ขาวใช้ไม่ได้เพราะครึ่งล่างของเฉดสว่างเกิน · สีแบรนด์ (#B83C18) ก็ใช้ไม่ได้ ลองแล้ว
   ทับกับพื้นส้มอ่อนจนแทบอ่านไม่ออก (อัตราต่างสีราว 1.9 ต่ำกว่าเกณฑ์มาก)
   เทาดำอ่านออกแต่ดูจืดบนพื้นโทนอุ่น น้ำตาลเข้มได้ทั้งอ่านออกและเข้ากับโทน */
const HEAD_INK = '#5A2410';

export default function DeliveryHome() {
  const insets = useSafeAreaInsets();
  const address = useAddress(selectedAddress);
  const products = useCatalog((s) => s.products);
  const dbCategories = useCatalog((s) => s.categories);
  const [query, setQuery] = useState('');
  /* ต้องรู้ความสูงหัวจอจริงถึงจะวางช่องค้นหาให้คร่อมรอยต่อสีส้ม/ขาวได้พอดี
   * คำนวณเอาไม่ได้เพราะความสูงขึ้นกับ safe area ของแต่ละเครื่องและความยาวที่อยู่ */
  const [headH, setHeadH] = useState(0);
  const [addrH, setAddrH] = useState(52);
  const scrollY = useRef(new Animated.Value(0)).current;

  /* ก่อนวัดจริงเสร็จ ใช้ค่าประมาณไปพลางแทนที่จะเป็น 0 ไม่งั้นเฟรมแรกเนื้อหาจะเด้ง
     ขึ้นไปชนขอบบนแล้วค่อยกระตุกลงมา */
  const headEff = headH || insets.top + 124;
  /* ความสูงของ "ผ้าใบ" ที่ใช้วาดเฉด ทั้งสองชั้นต้องใช้ค่านี้เท่ากัน องศาไล่สีจึงตรงกัน */
  const rampH = headEff + BACKDROP_BLEED;
  /* บล็อกที่อยู่สูงกว่าปุ่ม พอยกขึ้นไปอยู่แถวเดียวกันมันจึงล้นขึ้นไปข้างบน ต้องกันไม่ให้
     ล้ำเข้าไปในแถบสถานะ — เครื่องที่ขอบบนบาง (แอนดรอยด์ ~24) ยก 44 เท่ากันจะไปทับนาฬิกา
     พอดี ยอมให้ล้ำขึ้นไปได้ไม่เกิน 20% ของขอบบน เครื่องจอบากจึงยกได้เต็ม */
  const addrTop = HEAD_PAD_TOP + NAV_H + ADDR_MARGIN;
  const addrLift = Math.min(ADDR_LIFT, addrTop + Math.min(10, insets.top * 0.2));
  /* ความสูงแถบตอนย่อคิดจากของที่สูงที่สุดในแถบ ซึ่งคือบล็อกที่อยู่ ไม่ใช่ปุ่ม */
  const barMin = Math.max(
    insets.top + addrTop - addrLift + addrH + BAR_PAD_BOTTOM,
    insets.top + HEAD_PAD_TOP + NAV_H + BAR_PAD_BOTTOM,
  );
  /* ระยะที่ยุบได้ อย่างน้อย 1 กัน interpolate ที่ inputRange ซ้ำกันแล้วพัง */
  const shrink = Math.max(1, headEff - barMin);
  const ramp = (to: number, at = shrink) =>
    scrollY.interpolate({ inputRange: [0, at], outputRange: [0, to], extrapolate: 'clamp' });

  const barH = scrollY.interpolate({
    inputRange: [0, shrink],
    outputRange: [headEff, barMin],
    extrapolate: 'clamp',
  });
  const addrX = ramp(ADDR_SHIFT);
  const addrY = ramp(-addrLift);
  /* มาสคอตต้องจางหมดก่อนที่ที่อยู่จะเลื่อนมาถึง ไม่งั้นตัวหนังสือทับรูปอยู่พักหนึ่ง */
  const mascotO = scrollY.interpolate({
    inputRange: [0, shrink * 0.45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  /* ช่องค้นหาเลื่อนหนีขึ้นตามเนื้อหาแบบ 1:1 ไม่ clamp — มันต้องคร่อมรอยต่อไปตลอดทาง
     รอยต่อ (ขอบบนแผ่นขาว) ก็ขยับด้วยอัตราเดียวกัน ถ้า clamp เมื่อไหร่จะหลุดจากรอยต่อ */
  const searchY = Animated.multiply(scrollY, -1);
  const searchO = scrollY.interpolate({
    inputRange: [0, shrink * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

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
      {/* สามชั้นซ้อนกัน เรียงจากหลังมาหน้า:
          1. เฉดเต็มความสูง (หลัง ScrollView) — โผล่ตรงรอยหยักมุมแผ่นขาวและตอนดึงจอเกินขอบ
          2. เนื้อหาที่เลื่อนได้ ดันลงมาด้วย paddingTop เท่าหัวจอ เลื่อนขึ้นแล้วลอดใต้หัวจอไป
          3. แถบหัวจอที่ย่อได้ + ปุ่ม + ที่อยู่ ทับอยู่บนสุด
          เจ้าของสั่ง 3 ก.ย. 2026: "พอเลื่อนจอขึ้นสีส้มจะเล็กลง content จะเหลือ ส่งทันที
          และข้างล่างเป็นที่อยู่" */}
      <LinearGradient
        colors={HEAD_RAMP}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={[styles.backdrop, { height: rampH }]}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          /* ย่อหัวจอคือการเปลี่ยน "ความสูง" ซึ่ง native driver ทำไม่ได้ (ได้แค่ transform
             กับ opacity) จะเลี่ยงไปใช้ scaleY ก็ไม่ได้เพราะเฉดจะโดนบีบจนองศาเพี้ยน
             ยอมขับด้วย JS ทั้งชุด ให้ทุกชั้นขยับพร้อมกันในเฟรมเดียว */
          useNativeDriver: false,
        })}
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingTop: headEff, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}>
        {/* แผ่นขาวมุมบนโค้ง — เว้นบนไว้ให้ครึ่งล่างของช่องค้นหาที่คร่อมรอยต่ออยู่
            ไม่งั้นหัวข้อแรกจะไปมุดใต้ช่องค้นหา */}
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
      </Animated.ScrollView>

      {/* สำเนาเฉดตัวเดิมเป๊ะ ๆ แต่ถูกครอบตัดตามความสูงแถบ — ต้องเป็นสำเนาที่ "สูงเท่ากัน
          แล้วครอบตัด" ไม่ใช่เฉดที่ตั้งความสูงตามแถบ ไม่งั้นองศาไล่สีจะไม่ตรงกับชั้นหลัง
          แล้วเห็นเป็นรอยต่อพาดจอ */}
      <Animated.View pointerEvents="none" style={[styles.backdrop, styles.barClip, { height: barH }]}>
        <LinearGradient
          colors={HEAD_RAMP}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ height: rampH }}
        />
      </Animated.View>

      {/* มาสคอตเป็นชั้นของตัวเอง วาด ก่อน ช่องค้นหา จึงมุดอยู่หลังช่องค้นหาตามที่สั่ง
          (3 ก.ย. 2026) — ถ้ายังอยู่ในหัวจอเหมือนเดิมมันจะถูกวาดทีหลังแล้วไปทับช่องค้นหา
          แต่ต้องวาด หลัง ชั้นเฉดที่ครอบตัด ไม่งั้นแถบสีจะกลืนมันหายไปแทน */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.mascot,
          {
            top: headEff + MASCOT_TOP_FROM_HEAD,
            opacity: mascotO,
            transform: [{ translateY: searchY }],
          },
        ]}>
        <Image source={MODE_META.delivery.image} style={styles.mascotImg} contentFit="contain" />
      </Animated.View>

      {/* ช่องค้นหาเลื่อนหนีขึ้นตามเนื้อหา 1:1 แล้วจางหายไป — เจ้าของบอกว่าตอนย่อให้เหลือ
          แค่ "ส่งทันที" กับที่อยู่ ช่องค้นหาจึงไม่ปักหมุด
          ต้องวาดทับแถบหัวจอ ไม่ใช่มุดใต้แถบ เพราะตอนยังไม่เลื่อนมันคร่อมรอยต่ออยู่
          ครึ่งบนอยู่ในเขตแถบพอดี ถ้าให้อยู่ใต้แถบครึ่งบนจะโดนกลืนหายตั้งแต่แรก
          ซ่อนตอนย่อจึงต้องใช้การจาง ไม่ใช่ให้แถบบัง
          และวางไว้นอก ScrollView เพราะถ้าอยู่ข้างในแล้วใช้ margin ลบ ครึ่งบนจะโดนคลิป */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.searchFloat,
          { top: headEff - SEARCH_H / 2, opacity: searchO, transform: [{ translateY: searchY }] },
        ]}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="ค้นหาสินค้าที่อยากได้"
          containerStyle={styles.search}
        />
      </Animated.View>

      <View
        style={[styles.head, { paddingTop: insets.top + HEAD_PAD_TOP }]}
        onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>
        <View style={styles.headRow}>
          <IconButton
            icon="chevron-back"
            variant="tint"
            shape="circle"
            size={NAV_H}
            color={HEAD_INK}
            style={styles.glassBtn}
            accessibilityLabel="ย้อนกลับ"
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }} />
          {/* ปุ่มตะกร้าอยู่ในแถวเดียวกับปุ่มย้อนกลับ ระดับเดียวกันเป๊ะ (เจ้าของสั่ง
              3 ก.ย. 2026) — เคยลองหย่อนลงไปนั่งบนหัวมาสคอตแล้วมันหลุดแนวกับปุ่มซ้าย */}
          <View style={styles.cartWrap}>
            <IconButton
              icon="bag-outline"
              variant="tint"
              shape="circle"
              size={NAV_H}
              color={HEAD_INK}
              style={styles.glassBtn}
              accessibilityLabel="ตะกร้า"
              onPress={() => router.push('/cart')}
            />
            <CartBadge />
          </View>
        </View>

        {/* ตอนย่อ บล็อกนี้ลอยขึ้นไปอยู่แถวเดียวกับปุ่ม แล้วเลื่อนขวาให้พ้นปุ่มย้อนกลับ
            เหลือสองบรรทัดตามที่สั่ง: ส่งทันที / ที่อยู่ — ที่เว้นขวา 110 ไว้กันมาสคอต
            พอเลื่อนขวา 52 ยังเหลือ 58 ซึ่งพอให้พ้นปุ่มตะกร้า (40 + ระยะห่าง 12) */}
        <Animated.View
          onLayout={(e) => setAddrH(e.nativeEvent.layout.height)}
          style={[styles.addrBlock, { transform: [{ translateX: addrX }, { translateY: addrY }] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="เปลี่ยนที่อยู่จัดส่ง"
            onPress={() => router.push('/address')}>
            <Text style={styles.headKicker}>ส่งทันที</Text>
            <View style={styles.addrRow}>
              <Text numberOfLines={1} style={styles.addrText}>
                {address ? address.line : 'เลือกที่อยู่จัดส่ง'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={HEAD_INK} />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F1EF' },
  /* หัวจอปักหมุดทับเนื้อหา ไม่ได้อยู่ในสายการวางปกติ เนื้อหาจึงเลื่อนลอดใต้มันได้
     ซึ่งเป็นเงื่อนไขเดียวที่ทำให้ "สีส้มเล็กลงตอนเลื่อน" เกิดขึ้นได้จริง */
  head: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.x2,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  cartWrap: { position: 'relative' },
  addrBlock: { marginTop: ADDR_MARGIN, paddingRight: 110 },
  headKicker: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 17,
    lineHeight: 24,
    color: HEAD_INK,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addrText: {
    flex: 1,
    fontFamily: 'Mitr_500Medium',
    fontSize: 19,
    lineHeight: 28,
    color: HEAD_INK,
  },
  mascotImg: { width: MASCOT, height: MASCOT },
  mascot: { position: 'absolute', right: Spacing.lg },
  /* ปุ่มใสแทนวงกลมขาวทึบ (เจ้าของสั่ง 3 ก.ย. 2026) — ใช้ variant tint เพราะ surface
     ใส่เงาให้ด้วย ซึ่งเงาใต้ปุ่มใสจะดูเลอะ ขอบขาวจาง ๆ ช่วยให้เห็นขอบปุ่มบนพื้นส้ม */
  glassBtn: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  /* ต้องเป็นแถวและให้ SearchBar ยืดเต็ม — containerStyle ของมันใช้ flex 1 ตามแบบที่
     หน้าอื่นเรียก ถ้าพ่อแม่ไม่ใช่ row ตัวมันจะยุบจนเหลือแต่ไอคอนแว่นขยาย */
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0 },
  barClip: { overflow: 'hidden' },
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
