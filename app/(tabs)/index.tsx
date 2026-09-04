import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductRail } from '@/components/product/ProductRail';
import { CouponPicks } from '@/components/shop/CouponPicks';
import { ModePickSheet } from '@/components/shop/ModePickSheet';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { DesktopHome } from '@/components/web/DesktopHome';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { shopHoursLabel } from '@/data/shop';
import { useT } from '@/lib/i18n';
import { BRAND_ACCENT, GREEN_ACCENT } from '@/constants/accent';
import { ONLINE_ACCENT } from '@/constants/online';
import { BANNER_ASPECT, bannersFor } from '@/lib/data/catalog';
import type { Product } from '@/data/products';
import { MODE_META, useMode, type ShopMode } from '@/store/mode';
import { useCart } from '@/store/cart';
import { useIsDesktopWeb } from '@/lib/useAppWidth';
import { useShopOpen } from '@/lib/useShopOpen';
import { loadIfStale, useCatalog } from '@/store/catalog';
import { useShop } from '@/store/shop';

/** ป้ายบนการ์ดเลือกโหมด — เจ้าของขอเป็นภาษาอังกฤษตามที่เขียนมา ไม่ใช้ label ภาษาไทย
 *  ใน MODE_META ที่หน้าอื่นใช้อยู่ */
const MODE_LABEL: Record<ShopMode, string> = {
  delivery: 'Delivery',
  online: 'ONLINE',
};

/**
 * สีป้ายบนการ์ด — ผูกกับ "โหมด" ไม่ใช่กับ "อันไหนถูกเลือกอยู่"
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "การ์ด delivery ให้ตัวอักษรสีส้ม ONLINE สีน้ำเงิน" — เดิมป้าย
 * เป็นเทาทั้งคู่แล้วอันที่เลือกอยู่ค่อยเปลี่ยนเป็นส้ม ผลคือ ONLINE ขึ้นเป็นสีส้มตอนถูกเลือก
 * ทั้งที่ทั้งโหมดเป็นน้ำเงิน ตอนนี้สีบอก "นี่โหมดอะไร" ส่วนวงกลมที่ถูกไล่สีบอก
 * "กำลังอยู่โหมดไหน" แยกหน้าที่กันชัด ไม่ใช่สีเดียวแบกสองความหมาย
 */
const MODE_COLOR: Record<ShopMode, { text: string; tint: string }> = {
  delivery: { text: BRAND_ACCENT.strong, tint: BRAND_ACCENT.tint },
  online: { text: ONLINE_ACCENT.strong, tint: ONLINE_ACCENT.tint },
};

/** คำอธิบายใต้ป้าย — ป้ายเป็นอังกฤษตามที่เจ้าของสั่ง บรรทัดนี้เป็นไทยไว้บอกว่าโหมดนั้น
 *  คืออะไรจริง ๆ คนที่ไม่ได้อ่านอังกฤษก็เข้าใจ (เจ้าของสั่ง 3 ก.ย. 2026) */
const MODE_SUB: Record<ShopMode, string> = {
  delivery: 'สั่งเลย',
  online: 'พร้อมส่งของ',
};

/* สีพื้นหน้าแรก — เทาอ่อนอมอุ่น (เจ้าของสั่ง 3 ก.ย. 2026) ยกขึ้นมาเป็นค่าคงที่เพราะ
   แถวคูปองต้องใช้สีเดียวกันเป๊ะไปวาดรอยบากครึ่งวงกลมของการ์ด ถ้าสองที่ไม่ตรงกัน
   รอยบากจะกลายเป็นจุดสีแปลกปลอมทันที */
const SCREEN_BG = '#F4F1EF';

/** Bottom padding so the floating tab bar never covers the last row. */

const TAB_BAR_CLEARANCE = 110;
/**
 * Fallback slide shown until the owner publishes home banners (admin แบนเนอร์
 * page) — the local brand art, same asset as the catalog hero. Never network
 * placeholders here: this is the first thing a customer sees.
 */
/* รูปสำรองตอนยังไม่มีแบนเนอร์ในระบบ — ใส่ title: null ไว้ให้ชนิดข้อมูลตรงกับ
 * แบนเนอร์จากหลังร้าน ไม่งั้น TypeScript แคบชนิดไม่ลงตอนเช็ค slide.title */
const FALLBACK_SLIDES: { id: string; image: number | { uri: string }; title: string | null }[] = [
  { id: 'brand', image: require('../../assets/images/braner.jpg') as number, title: null },
];
/** Auto-advance interval for the hero banner (ms). Thai reading time + WCAG 2.2.2. */
const BANNER_INTERVAL = 5000;
/** รูปมาสคอตของแบนเนอร์สำรอง — ไฟล์เดียวกับที่หน้าเดลิเวอรี่/ออนไลน์ใช้ */
const MASCOT_SRC = require('@/assets/images/mascot-tiger.png') as number;
/* เฉดของแบนเนอร์สำรองใต้คูปอง — เขียวตามธีมหน้าแรก ไม่ใช่ส้มแบบหัวจอเดลิเวอรี่
   ใช้โทเคนเขียวชุดเดียวกับ GREEN_ACCENT ไม่ได้ตั้งเลขสีใหม่ */
const PROMO_FALLBACK_RAMP = [GREEN_ACCENT.strong, GREEN_ACCENT.solid] as const;

export default function HomeScreen() {
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const modes = Object.values(MODE_META);
  const mode = useMode((st) => st.mode);
  const router = useRouter();
  const shopOpen = useShopOpen();
  const shop = useShop((s) => s.info);
  const t = useT();

  /* ----- Catalog (from Supabase) ----- */
  const reloadCatalog = useCatalog((s) => s.load);
  const products = useCatalog((s) => s.products);
  const bestsellerIds = useCatalog((s) => s.bestsellerIds);
  /* เช็ค loaded ไม่ใช่ loading — loading เป็น false ทั้งตอนยังไม่เริ่มโหลดและตอนเสร็จแล้ว
     ถ้าดูแค่ loading แถบขายดีจะโล่งอยู่ดีในช่วงก่อนคำขอแรกจะยิงออกไป */
  const catalogLoaded = useCatalog((s) => s.loaded);
  const [refreshing, setRefreshing] = useState(false);
  // Re-fetch on focus only if the catalog is stale (loadIfStale), so admin
  // changes (new products, prices, banners) still show up without a restart,
  // but bouncing between tabs while browsing doesn't refire all 5 catalog
  // queries every single time.
  useFocusEffect(
    useCallback(() => {
      loadIfStale();
    }, []),
  );
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reloadCatalog(true);
    setRefreshing(false);
  }, [reloadCatalog]);
  const homeBanners = useCatalog((s) => s.banners).filter((b) => b.placement === 'home');
  // Admin-managed home banners when present; otherwise the local brand slide.
  const slides = homeBanners.length
    ? homeBanners.map((b) => ({
        id: b.id,
        image: { uri: b.image } as number | { uri: string },
        /* หัวข้อจากหน้าแอดมิน — วาดเป็นข้อความจริงทับบนภาพ ไม่ใช่เผาไว้ในรูป
         * (เจ้าของขอข้อความไทยที่ไม่เพี้ยน 3 ก.ย. 2026) ตัวสร้างภาพ AI เขียนไทย
         * ผิดเกือบทุกครั้ง ส่วนทางนี้ได้ฟอนต์จริงของแอป แก้คำได้จากหลังร้านโดยไม่ต้อง
         * ทำรูปใหม่ และคมทุกความละเอียดหน้าจอ */
        title: b.title,
      }))
    : FALLBACK_SLIDES;
  /* ----- Auto-rotating hero banner ----- */
  const bannerRef = useRef<ScrollView>(null);
  const [bannerWidth, setBannerWidth] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  // Mirror the index in a ref so the interval callback isn't a stale closure.
  const activeSlideRef = useRef(0);
  activeSlideRef.current = activeSlide;

  useEffect(() => {
    if (bannerWidth === 0) return;
    const timer = setInterval(() => {
      const next = (activeSlideRef.current + 1) % slides.length;
      bannerRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
      setActiveSlide(next);
    }, BANNER_INTERVAL);
    return () => clearInterval(timer);
  }, [bannerWidth, slides.length]);

  /* ----- แบนเนอร์ใต้คูปอง (ช่อง home_promo) ----- */
  const promoBanners = bannersFor(useCatalog((st) => st.banners), 'home_promo');
  const promoRef = useRef<ScrollView>(null);
  const [promoW, setPromoW] = useState(0);
  const [promoIdx, setPromoIdx] = useState(0);
  /* เก็บดัชนีไว้ใน ref ด้วย — ตัวจับเวลาอ่านค่าเก่าค้างถ้าอ่านจาก state ตรง ๆ */
  const promoIdxRef = useRef(0);
  promoIdxRef.current = promoIdx;

  useEffect(() => {
    if (promoW === 0 || promoBanners.length < 2) return;
    const timer = setInterval(() => {
      const next = (promoIdxRef.current + 1) % promoBanners.length;
      promoRef.current?.scrollTo({ x: next * promoW, animated: true });
      setPromoIdx(next);
    }, BANNER_INTERVAL);
    return () => clearInterval(timer);
  }, [promoW, promoBanners.length]);

  /* ----- แถบสินค้าขายดี + ด่านเลือกวิธีรับของ ----- */
  /* เรียงตามลำดับที่ RPC ให้มา (ยอดขายจริง POS + ออนไลน์ ดู 0034) ไม่ใช่ลำดับใน
     คลังสินค้า — id ที่หาสินค้าไม่เจอถูกทิ้ง (สินค้าถูกเก็บ/ยกเลิกขายหลังจากเคยขายดี) */
  const bestsellers = bestsellerIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p)
    .slice(0, 8);

  const addToCart = useCart((s) => s.add);
  const pickedMode = useMode((s) => s.pickedThisSession);
  /* งานที่ค้างรอผลการเลือกโหมด — เก็บทั้งสินค้าและสิ่งที่จะทำ เพราะกดการ์ดกับกดปุ่ม +
     ไปคนละทางกัน (เข้าหน้าสินค้า vs ใส่ตะกร้าเลย) */
  const [pending, setPending] = useState<{ product: Product; action: 'open' | 'add' } | null>(null);

  const runAction = useCallback(
    (product: Product, action: 'open' | 'add') => {
      if (action === 'add') addToCart(product);
      else router.push(`/product/${product.id}`);
    },
    [addToCart, router],
  );

  /* เลือกโหมดไว้แล้วในรอบนี้ = ไปต่อเลย ไม่ถามซ้ำ — ด่านที่ถามทุกครั้งคือด่านที่คนเลิกใช้ */
  const gate = useCallback(
    (product: Product, action: 'open' | 'add') => {
      if (pickedMode) runAction(product, action);
      else setPending({ product, action });
    },
    [pickedMode, runAction],
  );

  const onBannerLayout = (e: LayoutChangeEvent) =>
    setBannerWidth(e.nativeEvent.layout.width);

  const onBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bannerWidth === 0) return;
    setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / bannerWidth));
  };

  // Desktop web renders the full storefront landing instead (after all hooks).
  if (isDesktopWeb) return <DesktopHome />;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN_ACCENT.solid} />}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        }}>
        {/* Hero banner — ชิดขอบบนสุด เต็มความกว้าง ไหลใต้แถบสถานะ (เจ้าของสั่ง 3 ก.ย. 2026)
            เดิมมีแถบที่อยู่คั่นอยู่ข้างบนแล้วแบนเนอร์เว้นขอบทั้งสี่ด้าน ภาพเลยดูเป็นการ์ด
            ใบหนึ่งกลางจอ ไม่ใช่หน้าปกของร้าน */}
        <View style={styles.heroWrap}>
          <View style={styles.hero} onLayout={onBannerLayout}>
            <ScrollView
              ref={bannerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onBannerScroll}
              style={StyleSheet.absoluteFill}>
              {slides.map((slide) => (
                <View key={slide.id} style={{ width: bannerWidth, height: '100%' }}>
                  <Image
                    source={slide.image}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                  {slide.title ? (
                    <View style={styles.heroTextWrap} pointerEvents="none">
                      {/* ม่านไล่สีจากซ้าย — ข้อความต้องอ่านออกบนรูปอะไรก็ได้ที่เจ้าของ
                          อัปมา ไม่ใช่แค่รูปที่ฝั่งซ้ายบังเอิญเข้ม */}
                      <LinearGradient
                        colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Text numberOfLines={3} style={styles.heroTitle}>
                        {slide.title}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

      {/* หมุดที่อยู่ + กระดิ่ง ลอยมุมขวาบนทับแบนเนอร์ (เจ้าของสั่งให้ที่อยู่เหลือแค่
          ไอคอนหมุดชิดขวา) — อยู่นอก ScrollView เพื่อให้ค้างอยู่ตอนเลื่อนหน้า ไม่งั้น
          เลื่อนลงไปนิดเดียวก็กดเปลี่ยนที่อยู่หรือดูแจ้งเตือนไม่ได้แล้ว */}
      <View style={[styles.topRight, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        {/* วงกลมขาวมีเงา (เจ้าของสั่ง 3 ก.ย. 2026) — variant surface ให้พื้นขาว
            shape circle ให้เป็นวงกลม · เงาฟุ้งกว่าค่าเริ่มต้นเพราะปุ่มลอยอยู่บน
            ภาพสีส้ม เงาคมจะอ่านเป็นเส้นขอบมืดแทนที่จะเป็นการลอย (เหมือนการ์ดโหมด)
            เปลี่ยนหมุดจาก location-sharp (ทรงหยดน้ำทึบ ดูหนัก) เป็นแบบเส้น
            ให้น้ำหนักเส้นเท่ากระดิ่งที่อยู่ข้างกัน */}
        <IconButton
          icon="location-outline"
          variant="surface"
          shape="circle"
          size={44}
          style={styles.floatBtn}
          accessibilityLabel={t('home.changeAddress')}
          onPress={() => router.push('/address')}
        />
        <IconButton
          icon="notifications-outline"
          variant="surface"
          shape="circle"
          size={44}
          style={styles.floatBtn}
          accessibilityLabel={t('home.notifications')}
          onPress={() => router.push('/notifications')}
        />
      </View>
            {/* Bottom scrim so the dots stay readable over any image */}
            {slides.length > 1 ? (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.28)']}
                style={styles.heroScrim}
                pointerEvents="none"
              />
            ) : null}
            {slides.length > 1 ? (
              <View style={styles.dots} pointerEvents="none">
                {slides.map((slide, i) => (
                  <View key={slide.id} style={[styles.dot, i === activeSlide && styles.dotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Body (padded) — search floats over the hero's bottom edge */}
        <View style={styles.body}>
          {/* Store-closed notice */}
          {!shopOpen ? (
            <View style={styles.closedBanner}>
              <Ionicons name="moon-outline" size={18} color={Colors.dangerStrong} />
              <Text style={styles.closedText}>
                {t('home.shopClosed')} {shopHoursLabel(shop.hours)}
              </Text>
            </View>
          ) : null}

          {/* เลือกวิธีรับของ — เจ้าของสั่งเพิ่ม 3 ก.ย. 2026: การ์ดสี่เหลี่ยมจัตุรัสสองใบ
              โลโก้กลมข้างใน ป้ายอยู่ข้างล่าง
              ผูกกับ useMode ตัวเดียวกับที่ตะกร้าและหน้าชำระเงินใช้ ไม่ได้เป็นแค่รูป
              ประดับ — กดแล้วเปลี่ยนโหมดจริง และค่าส่งกับข้อความในตะกร้าเปลี่ยนตาม */}
          <View style={styles.modeRow}>
            {modes.map((m) => {
              const on = mode === m.key;
              return (
                <PressableScale
                  key={m.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={MODE_LABEL[m.key]}
                  /* Delivery ต้องรู้ก่อนว่าบ้านลูกค้าอยู่ในเขตส่งไหม จึงพาไปจอสแกน
                     ตำแหน่งก่อน (จอนั้นเป็นคนตั้งโหมดให้เอง) ส่วน ONLINE ส่งทั่วไทย
                     ไม่มีเขต กดแล้วเปลี่ยนได้เลย */
                  onPress={() =>
                    /* ทั้งสองโหมดมีจอเตรียมพร้อมของตัวเองแล้ว (เจ้าของสั่ง 4 ก.ย. 2026
                       ให้หน้าออนไลน์ขึ้นจอโหลดเหมือนเดลิเวอรี่) — เดิมฝั่งออนไลน์แค่
                       สลับโหมดค้างอยู่หน้าแรก ไม่พาไปไหน */
                    router.push(m.key === 'delivery' ? '/delivery-check' : '/online-check')
                  }
                  style={styles.modeCard}>
                  <View
                    style={[
                      styles.modeLogo,
                      on && { backgroundColor: MODE_COLOR[m.key].tint },
                    ]}>
                    <Image source={m.image} style={styles.modeLogoImg} contentFit="contain" />
                  </View>
                  <View style={styles.modeTexts}>
                    <Text style={[styles.modeLabel, { color: MODE_COLOR[m.key].text }]}>
                      {MODE_LABEL[m.key]}
                    </Text>
                    <Text numberOfLines={1} style={styles.modeSub}>
                      {MODE_SUB[m.key]}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* ★ หน้าแรกไม่โชว์สินค้าแล้ว ★ (เจ้าของสั่ง 4 ก.ย. 2026 "หน้าแรกเราจะไม่โชว์
              สินค้าละครับ ... เอาเป็นคูปอง แบบใหญ่เต็มจอเลย ... ตามด้วยแบรนเนอร์")
              เดิมมีหมวดหมู่ + แถวสินค้าแนะนำ/มาใหม่ ซึ่งพาไปหน้าสินค้ารวมที่ถอดออกจาก
              แถบแท็บไปแล้ว ตอนนี้ทางเข้าสินค้าคือการ์ดสองโหมดข้างบนทางเดียว สินค้าอยู่
              ในหมวดหมู่ของแต่ละโหมด ไม่มีหน้ารวมที่ไม่รู้ว่าจะส่งแบบไหนอีกต่อไป
              เหลือสองอย่างตามที่สั่ง: คูปองใบใหญ่ แล้วต่อด้วยแบนเนอร์ */}
          <CouponPicks notchColor={SCREEN_BG} accent={GREEN_ACCENT} />

          {/* แบนเนอร์ใต้คูปอง — ช่อง home_promo (คนละใบกับสไลด์บนสุด ดู 0098)
              ยังไม่ได้อัปรูปก็มีของสำรองวาดไว้ในขนาดเดียวกันเป๊ะ เจ้าของจะได้เห็นว่าช่อง
              อยู่ตรงไหนและกว้างยาวเท่าไหร่ก่อนทำรูปจริง — และเพราะร้านเปิดขายอยู่จริง
              ของสำรองต้องเป็นแบนเนอร์ที่ดูตั้งใจทำ ไม่ใช่กล่องเทาเขียนว่า "ยังไม่มีรูป" */}
          <View style={styles.promoSection}>
            {promoBanners.length > 0 ? (
              <View
                style={[styles.promoPager, { aspectRatio: BANNER_ASPECT.home_promo }]}
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
                      <View
                        key={b.id}
                        style={[styles.promoDot, i === promoIdx && styles.promoDotOn]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (
              <LinearGradient
                colors={PROMO_FALLBACK_RAMP}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.promoFallback, { aspectRatio: BANNER_ASPECT.home_promo }]}>
                <View style={styles.promoCopy}>
                  <Text style={styles.promoTitle}>ร้านอู้ฟู่</Text>
                  <Text style={styles.promoSub}>ของครบ ราคาร้านชำ</Text>
                </View>
                <Image
                  source={MASCOT_SRC}
                  style={styles.promoArt}
                  contentFit="contain"
                  pointerEvents="none"
                />
              </LinearGradient>
            )}
          </View>

          {/* สินค้าขายดีจากยอดขายจริง (เจ้าของสั่ง 4 ก.ย. 2026 "ด้านล่างเป็นสินค้าขายดี
              แนะนำครับ ... ยอดขายจริง")
              ★ ดูได้เลย แต่กดแล้วต้องเลือกวิธีรับของก่อน ★ เจ้าของวางกติกาไว้ว่าต้องเลือก
              delivery หรือ ONLINE ก่อนถึงจะเลือกสินค้าได้ — ดักตอนกด ไม่ใช่ตอนดู เพราะ
              ของสวย ๆ ต้องได้ทำหน้าที่ดึงดูดก่อน ไม่ใช่ซ่อนไว้หลังด่าน
              ไม่มี "ดูทั้งหมด" เพราะหน้ารวมสินค้าถูกถอดออกไปแล้ว ทางเข้าคือการ์ดโหมด */}
          {catalogLoaded && bestsellers.length === 0 ? null : (
            <ProductRail
              title="ขายดีแนะนำ"
              data={bestsellers}
              loading={!catalogLoaded}
              accent={GREEN_ACCENT}
              onCardPress={(p) => gate(p, 'open')}
              onCardQuickAdd={(p) => gate(p, 'add')}
            />
          )}
        </View>
      </ScrollView>

      {pending ? (
        <ModePickSheet
          productName={pending.product.name}
          onPicked={() => {
            const { product, action } = pending;
            setPending(null);
            runAction(product, action);
          }}
          onClose={() => setPending(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promoSection: { marginTop: Spacing.lg },
  /* กรอบสไลด์ — ต้องเป็นสไตล์ของตัวเอง ห้ามใช้ร่วมกับตัวสำรองที่จัด row + เว้นขอบใน
     (บทเรียนจากหน้าเดลิเวอรี่: ใช้ร่วมกันแล้วความกว้างที่วัดได้ไม่ตรงกับความกว้างหน้า
     รูปเลยเลื่อนไม่พอดีหน้า) */
  promoPager: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  promoDots: {
    position: 'absolute',
    bottom: Spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  promoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  promoDotOn: { width: 18, backgroundColor: '#FFFFFF' },
  promoFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    paddingLeft: Spacing.lg,
  },
  promoCopy: { flex: 1 },
  promoTitle: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 22,
    color: '#FFFFFF',
  },
  promoSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 2,
  },
  promoArt: { width: 130, height: '100%' },
  screen: {
    flex: 1,
    /* เทาอ่อนมาก ๆ แทนพื้นพีชเดิม (เจ้าของสั่ง 3 ก.ย. 2026) — การ์ดขาวไม่มีเส้นขอบแล้ว
     * ถ้าพื้นยังเกือบขาวก็แยกไม่ออกว่าการ์ดจบตรงไหน เหลือแค่เงาที่ต้องแบกงานทั้งหมด
     * เลือกเทาอมอุ่นเล็กน้อย ไม่ใช่เทากลาง เพราะทั้งแอปเป็นโทนอุ่น เทากลางจะดูเย็นแปลกแยก
     * ตอนนี้ตั้งเฉพาะหน้าแรก ยังไม่แตะโทเคนกลางที่ใช้ทุกหน้า */
    backgroundColor: SCREEN_BG,
  },
  body: {
    paddingHorizontal: Spacing.lg,
  },
  heroWrap: {
    // เต็มความกว้าง ไม่เว้นขอบ ไม่มีมุมโค้งและเงา — แบนเนอร์เป็นหน้าปกของหน้า
    // ไม่ใช่การ์ดใบหนึ่งที่วางอยู่บนหน้า
    backgroundColor: Colors.primaryTint,
  },
  hero: {
    // สัดส่วนเดียวกับที่แอดมินครอปไว้ (BANNER_ASPECT.home) — ครอปเท่าไหร่ก็เห็นเท่านั้น
    // ไม่มีค่าของตัวเอง ไม่งั้นสองฝั่งเพี้ยนกันแล้วภาพโดนครอปซ้ำโดยไม่มีใครรู้
    aspectRatio: BANNER_ASPECT.home,
    overflow: 'hidden',
    backgroundColor: Colors.primaryTint,
  },
  heroTextWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    // เว้นบนให้พ้นแถบสถานะ เว้นล่างให้พ้นการ์ดโหมดที่ทับขอบล่างอยู่
    paddingTop: 56,
    paddingBottom: 34,
    paddingLeft: Spacing.lg,
    // ไม่ให้ข้อความยาวไปชนปุ่มหมุด/กระดิ่งมุมขวาบน
    paddingRight: '32%',
  },
  heroTitle: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 26,
    lineHeight: 36,
    color: '#fff',
    // เงาตัวอักษรเผื่อรูปที่สว่างมาก ม่านไล่สีอย่างเดียวอาจไม่พอ
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  topRight: {
    position: 'absolute',
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  floatBtn: {
    // เงาฟุ้งชุดเดียวกับการ์ดโหมด — ปุ่มลอยบนภาพสีส้มเหมือนกัน
    shadowColor: '#7A4A2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    // ดึงขึ้นไปทับขอบล่างแบนเนอร์นิดเดียวตามที่เจ้าของสั่ง — การ์ดจึงคาบเกี่ยวสองส่วน
    // แทนที่จะลอยอยู่ใต้แบนเนอร์เฉย ๆ  body อยู่หลัง heroWrap ในลำดับ จึงทับได้เอง
    // ไม่ต้องใช้ zIndex
    marginTop: -22,
    marginBottom: Spacing.xs,
  },
  modeCard: {
    // ผืนผ้าแนวนอน (เจ้าของสั่งเปลี่ยนจากจัตุรัส 3 ก.ย. 2026) — กว้างเต็มครึ่งแถว
    // เตี้ยลง เอาโลโก้กับป้ายมาเรียงข้างกันแทนซ้อนบนล่าง จะได้ไม่มีที่ว่างเหลือกลางการ์ด
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    // การ์ดขาวล้วน ไม่มีเส้นขอบเลย (เจ้าของสั่ง 3 ก.ย. 2026) — ตัวที่เลือกอยู่บอกด้วย
    // สีวงโลโก้กับสีตัวหนังสือแทน ไม่ใช่กรอบหรือถมสีพื้น
    backgroundColor: Colors.surface,
    // เงาฟุ้ง กระจายกว้างและจางกว่า Shadow.card ปกติ — การ์ดลอยอยู่บนภาพสีส้ม
    // ถ้าเงาคมจะเห็นเป็นเส้นขอบมืด ๆ แทนที่จะเป็นการลอย
    shadowColor: '#7A4A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  modeLogo: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeLogoImg: {
    width: 38,
    height: 38,
  },
  modeTexts: {
    // ชิดซ้ายในกล่องข้อความ ไม่ใช่กลาง — สองบรรทัดที่ยาวไม่เท่ากันถ้าจัดกลางจะเหลื่อม
    alignItems: 'flex-start',
  },
  modeLabel: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    // สีจริงมาจาก MODE_COLOR ที่จุดเรียกใช้ — ค่านี้เป็นแค่ตัวสำรอง
    color: Colors.textMuted,
  },
  modeSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: -2,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  closedText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.dangerStrong,
  },
  bannerContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 56,
    justifyContent: 'flex-end',
  },
  bannerButton: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  dots: {
    position: 'absolute',
    /* ยกขึ้นพ้นการ์ดโหมดที่ทับขอบล่างแบนเนอร์อยู่ 22pt — เดิม 12 ทำให้จุดไปโผล่แหว่ง
     * อยู่ในช่องว่างระหว่างการ์ดสองใบ เห็นเป็นเศษสีขาวลอยอยู่ (เจอตอนใส่แบนเนอร์
     * ใบที่สองแล้วจุดถึงเริ่มแสดง 3 ก.ย. 2026) */
    bottom: 42,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.textOnPrimary,
  },
  catRow: {
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingRight: Spacing.lg,
  },
  catCard: {
    width: 72,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  catLabel: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
});
