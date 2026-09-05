/**
 * หน้าร้านโหมดออนไลน์ (ส่งพัสดุทั่วไทย)
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "ทำหน้า ONLINE ต่อเลยครับ โทนสีน้ำเงินนะครับ ... ลอกกันไปเลย
 * แต่ว่าเป็นสีน้ำเงินครับ" — โครงเดียวกับหน้าเดลิเวอรี่ทุกอย่าง ต่างที่ชุดสีกับคำ
 * (คำสั่งนี้แทนที่ที่เคยบอกไว้ 3 ก.ย. ว่า "UI จะต่างกันโดยสิ้นเชิง")
 *
 * สินค้าอ่านจาก catalog store ตัวเดียวกับทุกหน้า ไม่มีการก๊อปข้อมูลหรือคิวรีชุดใหม่ —
 * ของที่ขายคือของเดียวกันทั้งร้าน ต่างแค่วิธีส่ง
 *
 * โหมดนี้ = ส่งพัสดุทั่วไทย จ่ายก่อนส่ง หัวจอจึงเขียน "ส่งทั่วไทย" แทน "ส่งทันที"
 * และที่อยู่ที่โชว์คือที่อยู่แบบพัสดุ (ต้องมีจังหวัด+รหัสไปรษณีย์)
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBubble } from '@/components/shop/CategoryBubble';
import { ProductRail } from '@/components/product/ProductRail';
import { CartBadge } from '@/components/navigation/CartBadge';
import { IconButton } from '@/components/ui/IconButton';
import { SearchBar } from '@/components/ui/searchbar';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { categories } from '@/data/products';
import {
  ONLINE_ACCENT,
  ONLINE_INK,
  ONLINE_INK_SHADOW,
  ONLINE_RAMP,
  ONLINE_SHEET_BG,
} from '@/constants/online';
import { ALL_CATEGORY, BANNER_ASPECT, bannersFor } from '@/lib/data/catalog';
import { useCatalog } from '@/store/catalog';
import { selectedAddress, useAddress } from '@/store/address';
import { MODE_META } from '@/store/mode';

const MASCOT_SRC = require('@/assets/images/mascot-tiger.png') as number;

const TAB_BAR_CLEARANCE = 110;
/** จังหวะเลื่อนสไลด์แบนเนอร์เอง (มิลลิวินาที) — เท่าหน้าแรก อ่านทันพอดีสำหรับข้อความไทย */
const PROMO_INTERVAL = 5000;
/* สีพื้นแผ่นเนื้อหา — วงกลมหมวดหมู่ต้องใช้สีเดียวกันเป๊ะเพื่อให้กลืนหายไปกับพื้น
   (เจ้าของสั่ง 3 ก.ย. 2026 "วงกลมมันดูขาว เอาให้กลืนกับสีพื้นหลังเลย") */
const SHEET_BG = ONLINE_SHEET_BG;
/** ความสูงช่องค้นหา — ใช้คำนวณให้มันคร่อมรอยต่อพอดีครึ่งบนครึ่งล่าง (เจ้าของว่าใหญ่ไป
 *  3 ก.ย. 2026 ลดจาก 54) */
const SEARCH_H = 46;
/* ปลายเฉดล่างต้องเลยขอบหัวจอลงไปให้พ้นรอยหยักมุมของแผ่นขาว (มุมโค้ง 26) เผื่อไว้
   หน่อยกันตอนดึงจอลงเกินขอบแล้วเห็นพื้นเทาโผล่ */
const BACKDROP_BLEED = 96;
/* หัวจอตอนย่อ = แถวปุ่ม + บล็อกที่อยู่ที่ยกขึ้นมาอยู่แถวเดียวกัน + เว้นล่างนิดหน่อย
   ต้องคิดจากขนาดจริงของสองอย่างนี้ ไม่ใช่จากเปอร์เซ็นต์ของหัวจอเต็ม เพราะหัวจอเต็ม
   สูงไม่เท่ากันในแต่ละเครื่อง (safe area) แต่แถบย่อควรสูงเท่ากันทุกเครื่อง */
const NAV_H = 34; // ปุ่มเล็กลงตามที่สั่ง 3 ก.ย. 2026
const ADDR_LIFT = 48; // ยกบล็อกที่อยู่ขึ้นไปเสมอแถวปุ่ม
const ADDR_MARGIN = 12; // ช่องไฟใต้แถวปุ่ม (เจ้าของว่า -2 อัดแน่นเกินไป)
const ADDR_SHIFT = 52; // แล้วเลื่อนขวาให้พ้นปุ่มย้อนกลับ
const BAR_PAD_BOTTOM = 14;
const HEAD_PAD_TOP = 2; // ปุ่มชิดขอบบนกว่าเดิม
const HEAD_PAD_BOTTOM = 40; // เว้นล่างให้ที่อยู่ไม่ไปชนช่องค้นหาที่คร่อมขอบอยู่
/* มาสคอตเสือ OFU (เจ้าของส่งมา 3 ก.ย. 2026) — ไฟล์ถูกครอบให้ชิดตัวรูปพอดีแล้ว
   ไม่มีขอบใสเหลือ ตำแหน่งจึงคิดจากขอบกล่องได้ตรง ๆ ต่างจากรูปเดิมที่มีพื้นใสรอบ ๆ
   สัดส่วน 409:488 เป็นแนวตั้ง ต้องกำหนดกว้าง/สูงแยกกัน ใส่กล่องจัตุรัสแล้วจะเล็กเกิน */
const MASCOT_W = 92;
const MASCOT_H = 110;
const MASCOT_TOP_FROM_HEAD = -107; // ก้นเสือมุดหลังช่องค้นหาไปราวหนึ่งในสี่
/* เยื้องซ้ายจากขอบขวา ไม่ใช่ชิดขอบเหมือนรูปเดิม — หมวก OFU กว้างเกือบเต็มความกว้างรูป
   ถ้าชิดขอบ ปุ่มตะกร้าจะไปคร่อมทับตัวอักษร OFU พอดี ซึ่งเป็นจุดขายของมาสคอตตัวนี้ */
const MASCOT_RIGHT = 48;
/* เฉดกับสีตัวหนังสืออยู่ constants/online.ts เพราะหน้าหมวดของโหมดนี้ต้องใช้ชุดเดียวกัน
   ถ้าปล่อยให้ต่างคนต่างประกาศ กดจากหน้าร้านไปหน้าหมวดแล้วสีจะเพี้ยนกันให้เห็น */
const HEAD_RAMP = ONLINE_RAMP;
const HEAD_INK = ONLINE_INK;

export default function DeliveryHome() {
  const insets = useSafeAreaInsets();
  const address = useAddress(selectedAddress);
  const products = useCatalog((s) => s.products);
  const dbCategories = useCatalog((s) => s.categories);
  const banners = useCatalog((s) => s.banners);
  const bestsellerIds = useCatalog((s) => s.bestsellerIds);
  /* โครงการ์ดรอ (เจ้าของถาม 4 ก.ย. 2026 "ไม่มีหน้าโหลดรอหรอ") — เช็ค loaded ไม่ใช่
     loading เพราะ loading เป็น false ทั้งตอน "ยังไม่เริ่มโหลด" และ "โหลดเสร็จแล้ว"
     ถ้าดูแค่ loading จอจะโล่งอยู่ดีในช่วงก่อนคำขอแรกจะยิงออกไป */
  const catalogLoaded = useCatalog((s) => s.loaded);
  const [query, setQuery] = useState('');
  /* ต้องรู้ความสูงหัวจอจริงถึงจะวางช่องค้นหาให้คร่อมรอยต่อสีส้ม/ขาวได้พอดี
   * คำนวณเอาไม่ได้เพราะความสูงขึ้นกับ safe area ของแต่ละเครื่องและความยาวที่อยู่ */
  const [headH, setHeadH] = useState(0);
  const [addrH, setAddrH] = useState(52);
  /* สองค่านี้อ่านตำแหน่งสกอลล์ตัวเดียวกัน แต่ขับกันคนละเธรด — แยกไว้เพราะ transform/
     opacity ขับบนเธรดเนทีฟได้ (addrX/addrY/mascotO/searchY/searchO ใช้ scrollY)
     ส่วน height ขับบนเนทีฟไม่ได้ (barH ต้องใช้ barScrollY) เดิมรวมเป็นค่าเดียวแล้วบังคับ
     useNativeDriver: false ทั้งชุด ทุกอินเตอร์โพเลตเลยต้องคำนวณบนเธรด JS ทุกเฟรมสกอลล์
     พร้อมกันหมด 6 ตัว — เจ้าของทัก 4 ก.ย. 2026 "หน้า delivery กระตุกแบบมากๆ" — หน้านี้ลอกโครงมา
     ตัวต้นเหตุ แยกแล้วเหลือแค่ barH ตัวเดียวที่ยังต้องคำนวณบน JS ทุกเฟรม */
  const scrollY = useRef(new Animated.Value(0)).current;
  const barScrollY = useRef(new Animated.Value(0)).current;

  /* ก่อนวัดจริงเสร็จ ใช้ค่าประมาณไปพลางแทนที่จะเป็น 0 ไม่งั้นเฟรมแรกเนื้อหาจะเด้ง
     ขึ้นไปชนขอบบนแล้วค่อยกระตุกลงมา */
  const headEff = headH || insets.top + 124;
  /* ความสูงของ "ผ้าใบ" ที่ใช้วาดเฉด ทั้งสองชั้นต้องใช้ค่านี้เท่ากัน องศาไล่สีจึงตรงกัน */
  const rampH = headEff + BACKDROP_BLEED;
  /* จุดพักเฉด: สีที่สองไปตกที่ขอบล่างหัวจอพอดี ครีมจึงอยู่ใต้ขอบทั้งหมด
     ถ้าปล่อยให้กระจายเท่า ๆ กันทั้งผ้าใบ ครีมจะไต่ขึ้นมาถึงบรรทัดที่อยู่ */
  const rampStops: readonly [number, number, number] = [0, headEff / rampH, 1];
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

  const barH = barScrollY.interpolate({
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
  /* ช่องนี้ใส่ได้หลายรูปแล้ว (เจ้าของสั่ง 4 ก.ย. 2026 "ต้องเพิ่มได้หลายภาพสิ") —
     เลื่อนเองอัตโนมัติเหมือนสไลด์หน้าแรก และปัดเองได้ */
  const promoBanners = bannersFor(banners, 'online_promo');
  const [promoW, setPromoW] = useState(0);
  const [promoIdx, setPromoIdx] = useState(0);
  const promoRef = useRef<ScrollView>(null);
  /* เก็บดัชนีไว้ใน ref ด้วย — callback ของ setInterval ถูกสร้างครั้งเดียว ถ้าอ่านจาก
     state ตรง ๆ จะเห็นค่าเก่าค้างตลอด (แพทเทิร์นเดียวกับสไลด์หน้าแรก) */
  const promoIdxRef = useRef(0);
  promoIdxRef.current = promoIdx;

  useEffect(() => {
    if (promoW === 0 || promoBanners.length < 2) return;
    const t = setInterval(() => {
      const next = (promoIdxRef.current + 1) % promoBanners.length;
      promoRef.current?.scrollTo({ x: next * promoW, animated: true });
      setPromoIdx(next);
    }, PROMO_INTERVAL);
    return () => clearInterval(t);
  }, [promoW, promoBanners.length]);

  /* สามแถวคัดสรร (เจ้าของสั่ง 3 ก.ย. 2026 "นำสินค้าขายดีมา สินค้าแนะนำ สินค้ายอดฮิต")
     แทนที่แถวไล่ทีละหมวดเดิม — การไล่ทีละหมวดครบทุกหมวดทำให้หน้ายาวและซ้ำกับสิ่งที่
     วงกลมหมวดหมู่ด้านบนทำอยู่แล้ว (กดเข้าไปดูเต็มหมวดได้ที่นั่น) หน้านี้จึงเน้นแนะนำแทน

     สัญญาณจริงที่มีอยู่มีแค่สองอย่าง: ยอดขายจริง (bestsellerIds จาก POS+ออนไลน์) กับ
     คะแนนรีวิว — "ขายดี" กับ "แนะนำ" ใช้สองอย่างนี้ตรง ๆ เหมือนที่หน้าแรกทำอยู่แล้ว
     ส่วน "ยอดฮิต" ไม่มีสัญญาณของตัวเองจริง ๆ (ยังไม่มีการนับยอดวิว/ยอดกดดู) จึงใช้
     คะแนนรีวิวเหมือนกันแต่เลื่อนช่วงไปอีกชุด ไม่เอาซ้ำกับที่ "แนะนำ" โชว์ไปแล้ว ไม่งั้น
     สามแถวจะกลายเป็นแถวเดียวกันวนสามรอบ — ถ้าจะมีสัญญาณของแท้ในอนาคต (เช่นยอดวิว)
     ค่อยเปลี่ยนตรงนี้ */
  const available = useMemo(
    () => products.filter((p) => (p.variants?.[0]?.available ?? 1) > 0),
    [products],
  );
  const bestSellers = useMemo(() => {
    const rank = new Map(bestsellerIds.map((id, i) => [id, i]));
    return [...available]
      .sort((a, b) => {
        const ra = rank.get(a.id) ?? Infinity;
        const rb = rank.get(b.id) ?? Infinity;
        return ra !== rb ? ra - rb : b.rating - a.rating;
      })
      .slice(0, 10);
  }, [available, bestsellerIds]);
  const recommended = useMemo(
    () => [...available].sort((a, b) => b.rating - a.rating).slice(0, 10),
    [available],
  );
  const popular = useMemo(
    () => [...available].sort((a, b) => b.rating - a.rating).slice(10, 20),
    [available],
  );
  const seeAllProducts = () =>
    router.push({ pathname: '/online/[cat]', params: { cat: ALL_CATEGORY } });

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
        locations={rampStops}
        pointerEvents="none"
        style={[styles.backdrop, { height: rampH }]}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          /* addrX/addrY/mascotO/searchY/searchO ล้วนเป็น transform/opacity ขับบนเธรด
             เนทีฟได้ทั้งหมด จึงตั้ง true ตรงนี้ — barH ที่ขับบนเนทีฟไม่ได้ (เปลี่ยน
             ความสูงจริง ไม่ใช่ transform) แยกออกไปใช้ barScrollY กับ listener ข้างล่าง
             แทน ให้มันเป็นตัวเดียวที่ยังกินเธรด JS ต่อเฟรม ไม่ใช่ทั้งหกตัว */
          useNativeDriver: true,
          listener: (e: NativeSyntheticEvent<NativeScrollEvent>) =>
            barScrollY.setValue(e.nativeEvent.contentOffset.y),
        })}
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingTop: headEff, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}>
        {/* แผ่นขาวมุมบนโค้ง — เว้นบนไว้ให้ครึ่งล่างของช่องค้นหาที่คร่อมรอยต่ออยู่
            ไม่งั้นหัวข้อแรกจะไปมุดใต้ช่องค้นหา */}
        <View style={styles.sheet}>
          <View style={styles.body}>
            {/* หัวข้อกำกับ + วงกลมกระดิกได้ (เจ้าของสั่ง 3 ก.ย. 2026) — หมวดหมู่ยังเป็น
                ชุดเดิมจากฐานข้อมูล เปลี่ยนแค่หน้าตาตามที่สั่ง */}
            <Text variant="subtitle" style={styles.catHead}>
              หมวดหมู่สินค้า
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}>
              {catList.map((cat) => (
                <CategoryBubble
                  key={cat}
                  category={cat}
                  plateColor={SHEET_BG}
                  onPress={() => router.push({ pathname: '/online/[cat]', params: { cat } })}
                />
              ))}
            </ScrollView>

            {/* แบนเนอร์ประจำหน้าเดลิเวอรี่ (เจ้าของสั่ง 3 ก.ย. 2026 แทนแถบ "สั่งตอนนี้
                ได้ของวันนี้" ที่ให้เอาออก)
                ยังไม่ได้อัปรูปก็มีของสำรองวาดไว้ในขนาดเดียวกันเป๊ะ เจ้าของจะได้เห็นว่า
                ช่องอยู่ตรงไหนและกว้างยาวเท่าไหร่ก่อนทำรูปจริง — และเพราะร้านเปิดขายอยู่
                จริง ของสำรองจึงต้องเป็นแบนเนอร์ที่ดูตั้งใจทำ ใช้คำที่แอปพูดอยู่แล้ว
                ไม่ใช่กล่องเทาเขียนว่า "ยังไม่มีรูป" ให้ลูกค้าเห็น
                และไม่ไปสัญญาตัวเลขอะไรใหม่ที่ยังไม่ได้ตกลงกัน */}
            {promoBanners.length > 0 ? (
              <View
                style={[styles.promoPager, { aspectRatio: BANNER_ASPECT.online_promo }]}
                onLayout={(e: LayoutChangeEvent) => setPromoW(e.nativeEvent.layout.width)}>
                <ScrollView
                  ref={promoRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  /* ปิดการปัดเองตอนมีรูปเดียว ไม่งั้นปัดแล้วเด้งไปมาโดยไม่มีอะไรให้ดู */
                  scrollEnabled={promoBanners.length > 1}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    if (promoW === 0) return;
                    setPromoIdx(Math.round(e.nativeEvent.contentOffset.x / promoW));
                  }}
                  style={StyleSheet.absoluteFill}>
                  {promoBanners.map((b) => (
                    <Image
                      key={b.id}
                      source={{ uri: b.image }}
                      style={{ width: promoW, height: '100%' }}
                      contentFit="cover"
                      transition={180}
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={b.title ?? 'โปรโมชั่น'}
                    />
                  ))}
                </ScrollView>
                {promoBanners.length > 1 ? (
                  <View style={styles.promoDots} pointerEvents="none">
                    {promoBanners.map((b, i) => (
                      <View key={b.id} style={[styles.promoDot, i === promoIdx && styles.promoDotOn]} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (
              <LinearGradient
                colors={HEAD_RAMP}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.promo, { aspectRatio: BANNER_ASPECT.online_promo }]}>
                <View style={styles.promoCopy}>
                  <Text style={styles.promoTitle}>อู้ฟู่ ส่งพัสดุ</Text>
                  <Text style={styles.promoSub}>{MODE_META.online.tagline}</Text>
                </View>
                <Image
                  source={MASCOT_SRC}
                  style={styles.promoArt}
                  contentFit="contain"
                  pointerEvents="none"
                />
              </LinearGradient>
            )}

            {/* สามแถวคัดสรร วางในกรอบเดียวกับหมวดหมู่/แบนเนอร์ (styles.body มี
                paddingHorizontal ของหน้า) — เดิม ProductRail ถูกวางไว้นอกกรอบนี้ การ์ด
                กับหัวข้อจึงชิดขอบจอซ้ายพอดี (เจ้าของทัก 3 ก.ย. 2026 "การ์ดมันดูชิดขอบ
                มากๆ") ProductRail เว้นระยะขวาให้ตัวเองอยู่แล้วเพื่อกันเลื่อนสุดแล้วชน
                ขอบ แต่ไม่ได้เว้นซ้าย เพราะหน้าอื่นทุกหน้าที่ใช้ ProductRail ครอบด้วยกรอบ
                ที่มี padding อยู่แล้วเหมือนกันหมด */}
            <ProductRail
              accent={ONLINE_ACCENT}
              title="สินค้าขายดี"
              data={bestSellers}
              onSeeAll={seeAllProducts}
              loading={!catalogLoaded}
            />
            <ProductRail
              accent={ONLINE_ACCENT}
              title="สินค้าแนะนำ"
              data={recommended}
              onSeeAll={seeAllProducts}
              loading={!catalogLoaded}
            />
            <ProductRail
              accent={ONLINE_ACCENT}
              title="สินค้ายอดฮิต"
              data={popular}
              onSeeAll={seeAllProducts}
              loading={!catalogLoaded}
            />
          </View>
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
          locations={rampStops}
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
        <Image source={MASCOT_SRC} style={styles.mascotImg} contentFit="contain" />
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
        {/* ★ ช่องค้นหาที่กดแล้วค้นได้จริง ★ เจ้าของทัก 5 ก.ย. 2026 "ตรงค้นหาของ Delivery
            และออนไลน์ทำให้ค้นหาได้ด้วย" — เดิมพิมพ์ได้แต่ไม่มีอะไรเกิดขึ้น เพราะหน้านี้
            ไม่มีที่แสดงผลลัพธ์ (เป็นหน้าโปรโมชั่น: แบนเนอร์ หมวดหมู่ ขายดี)
            กดแล้วพาไปหน้ารายการสินค้าทั้งหมดพร้อมเปิดแป้นพิมพ์ให้เลย ที่นั่นมีการค้นหา
            ที่ทำงานอยู่แล้ว — ทำผลลัพธ์ซ้ำอีกชุดบนหน้านี้คือมีสองที่ให้แก้เวลาต้องแก้
            ไม่ให้พิมพ์ตรงนี้ (editable={false}) เพราะพิมพ์ได้แต่ไม่มีผลลัพธ์คือสิ่งที่พัง
            อยู่เดิม — กดแล้วเด้งไปทันทีตั้งแต่ตัวอักษรแรกยังไม่ทันพิมพ์ */}
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="ค้นหาสินค้า"
          /* ★ ต้องส่งต่อ flex ทุกชั้น ★ แถบค้นหายืดเต็มความกว้างด้วย flex: 1 ที่ตัวมันเอง
             ห่อด้วยกล่องที่ไม่มี flex เมื่อไหร่ มันจะหดเหลือเท่าไอคอนแว่นขยายทันที */
          style={styles.searchPress}
          onPress={() =>
            router.push({
              pathname: '/online/[cat]',
              params: { cat: ALL_CATEGORY, focus: '1' },
            })
          }>
          {/* ★ ห้ามใส่ flex ที่ชั้นนี้ ★ กล่องนี้อยู่ในแนวตั้งของ Pressable ที่สูงตามเนื้อหา
              — flex: 1 ในกล่องที่แม่ไม่มีความสูงตายตัวจะยุบเหลือ 0 ช่องค้นหายังวาดออกมา
              ครบเพราะล้นออกนอกกรอบได้ แต่กรอบที่รับการกดสูง 0 กดยังไงก็ไม่ติด
              (เจอตอนทดสอบบนซิม 5 ก.ย. 2026 — เห็นเต็มตาแต่กดไม่ติดสักที) */}
          <View pointerEvents="none">
            <SearchBar
              value={query}
              onChangeText={setQuery}
              editable={false}
              placeholder="ค้นหาสินค้าที่อยากได้"
              containerStyle={styles.search}
            />
          </View>
        </Pressable>
      </Animated.View>

      <View
        /* ★ แถบหัวจอต้องปล่อยการกดผ่านตรงที่ไม่มีปุ่ม ★ มันเป็นกล่องทึบวางทับทั้งแถบบน
           รวมถึงครึ่งบนของช่องค้นหาที่คร่อมขอบอยู่ — ค่าเริ่มต้นของกล่องคือ "กินการกด"
           แม้ตรงนั้นจะไม่มีปุ่มอะไรเลย ตอนช่องค้นหายังกดไม่ได้ก็ไม่มีใครรู้ พอทำให้กดค้นหา
           ได้ (5 ก.ย. 2026) กดเท่าไหร่ก็ไม่ติด เพราะโดนกล่องนี้กินไปหมด
           box-none = กล่องนี้ไม่รับการกดเอง แต่ปุ่มย้อนกลับ/ตะกร้า/ที่อยู่ข้างในยังกดได้ */
        pointerEvents="box-none"
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
              onPress={() => router.push('/online/cart')}
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
            <Text style={styles.headKicker}>ส่งทั่วไทย</Text>
            <View style={styles.addrRow}>
              <Text numberOfLines={1} style={styles.addrText}>
                {address ? address.line : 'เลือกที่อยู่ส่งพัสดุ'}
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
  screen: { flex: 1, backgroundColor: SHEET_BG },
  /* หัวจอปักหมุดทับเนื้อหา ไม่ได้อยู่ในสายการวางปกติ เนื้อหาจึงเลื่อนลอดใต้มันได้
     ซึ่งเป็นเงื่อนไขเดียวที่ทำให้ "สีส้มเล็กลงตอนเลื่อน" เกิดขึ้นได้จริง */
  head: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: HEAD_PAD_BOTTOM,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  cartWrap: { position: 'relative' },
  /* เว้นขวาให้พ้นมาสคอตที่เยื้องเข้ามา 48 + กว้าง 92 = 140 เผื่ออีกนิด */
  addrBlock: { marginTop: ADDR_MARGIN, paddingRight: 128 },
  headKicker: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 17,
    lineHeight: 24,
    color: HEAD_INK,
    ...ONLINE_INK_SHADOW,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addrText: {
    flex: 1,
    fontFamily: 'Mitr_500Medium',
    fontSize: 19,
    lineHeight: 28,
    color: HEAD_INK,
    ...ONLINE_INK_SHADOW,
  },
  mascotImg: { width: MASCOT_W, height: MASCOT_H },
  mascot: { position: 'absolute', right: MASCOT_RIGHT },
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
    /* ★ ต้องอยู่ชั้นบนสุดจริง ๆ ไม่ใช่แค่ดูเหมือนอยู่บน ★ แถบหัวจอถูกวาดทีหลังจึงทับ
       ช่องค้นหาอยู่ตรงครึ่งบนที่คร่อมกันพอดี ตอนเป็นแค่กล่องเปล่าไม่มีใครรู้ พอทำให้กด
       ค้นหาได้ (5 ก.ย. 2026) การกดครึ่งบนของช่องเลยตกไปโดนแถวที่อยู่ข้างหลังแทน */
    zIndex: 2,
    elevation: 2,
  },
  /* เงาต้องอยู่ที่ตัวช่องค้นหาเอง ไม่ใช่ที่กรอบนอกที่ครอบมันอยู่ — กรอบนอกพื้นใส
     iOS จะไม่วาดเงาให้วิวที่ไม่มีพื้น */
  searchPress: { flex: 1 },
  search: { flex: 1, height: SEARCH_H, borderRadius: Radius.sm, ...Shadow.float },
  scroll: { backgroundColor: 'transparent' },
  sheet: {
    // flexGrow ให้แผ่นยืดเต็มจอเสมอ ไม่งั้นเนื้อหาสั้น ๆ จะเห็นสีส้มโผล่ข้างล่างด้วย
    flexGrow: 1,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: SEARCH_H / 2 + Spacing.md,
  },
  body: { paddingHorizontal: Spacing.lg },
  catHead: { marginTop: Spacing.lg },
  catRow: { gap: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, paddingRight: Spacing.lg },
  /* กรอบสไลด์แบนเนอร์ — ต้องเป็นสไตล์ของตัวเอง ห้ามใช้ styles.promo ร่วมกับตัวสำรอง
     เพราะตัวสำรองเป็นเลย์เอาต์แถว (flexDirection + paddingLeft) สำหรับวางข้อความคู่
     มาสคอต ถ้าเอามาครอบ ScrollView ที่ absoluteFill ระยะเว้นซ้ายจะไปหดความกว้างของ
     ช่องเลื่อน แต่ onLayout วัดจากกรอบนอกได้ค่าเต็ม สองค่าไม่ตรงกัน สไลด์เลยหยุดไม่ตรงรูป */
  promoPager: {
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  promo: {
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    /* ครอบตัดไว้ เพราะมาสคอตในตัวสำรองถูกวางให้ล้นขอบล่างเพื่อให้ดูโผล่ออกมาจากแบนเนอร์ */
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.lg,
  },
  /* จุดบอกสไลด์ วางลอยมุมล่างขวาในกรอบแบนเนอร์ — ไม่วางกลางเพราะข้อความบนแบนเนอร์
     ส่วนใหญ่อยู่ซ้าย จุดกลางจะไปทับพอดี */
  promoDots: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.sm,
    flexDirection: 'row',
    gap: 5,
  },
  promoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  promoDotOn: { backgroundColor: '#fff', width: 16 },
  promoCopy: { flex: 1, gap: 2 },
  promoTitle: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 22,
    color: '#fff',
    textShadowColor: 'rgba(10,30,80,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  promoSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(10,30,80,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  promoArt: { width: 132, height: 158, marginBottom: -22, marginRight: Spacing.sm },
});
