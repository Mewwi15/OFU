/**
 * จอสแกนหาตำแหน่ง ก่อนเข้าโหมดเดลิเวอรี่ (เจ้าของสั่ง 3 ก.ย. 2026)
 *
 * ระบบมีเขตส่งอยู่แล้ว — trigger `enforce_delivery_zone` (0073) บล็อกออเดอร์ที่อยู่
 * เกิน `delivery_radius_km` จากพิกัดร้าน แต่มันบล็อกตอน "กดสั่งซื้อ" ลูกค้าจึงเลือก
 * ของจนเต็มตะกร้า กรอกที่อยู่ กดจ่ายเงิน แล้วค่อยโดนเด้ง OUT_OF_AREA
 * จอนี้ย้ายการเช็คมาไว้ตั้งแต่ "กดเลือกโหมด" — รู้ตั้งแต่วินาทีแรกว่าส่งถึงไหม
 *
 * นอกเขตไม่ใช่ทางตัน — ร้านมีโหมด ONLINE ที่ส่งพัสดุทั่วไทยอยู่แล้ว คนที่อยู่ไกล
 * ไม่ใช่คนที่ซื้อไม่ได้ เขาแค่ซื้อคนละวิธี จอนี้จึงเสนอ ONLINE เป็นปุ่มหลักแทนที่จะ
 * ขึ้นว่า "ไม่ให้บริการ" แล้วจบ
 *
 * ใช้ระยะเส้นตรงเหมือนฝั่งเซิร์ฟเวอร์ (lib/geo.ts kmBetween ↔ SQL km_between)
 * ถ้าสองฝั่งคิดคนละแบบ จอนี้จะบอกว่าส่งได้แล้วไปโดนปฏิเสธตอนจ่ายเงินอยู่ดี
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BouncingBoxes } from '@/components/shop/BouncingBoxes';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { DELIVERY_INK, DELIVERY_INK_SHADOW, DELIVERY_RAMP } from '@/constants/delivery';
import { formatAddressLine } from '@/lib/address';
import { kmBetween } from '@/lib/geo';
import { osmReverseGeocode } from '@/lib/osm';
import { SCANNED_LABEL, useAddress } from '@/store/address';
import { useAuth } from '@/store/auth';
import { useLocale } from '@/store/locale';
import { MODE_META, useFees, useMode } from '@/store/mode';

/* ไล่สีสองสต็อปแรกของ DELIVERY_RAMP เท่านั้น ตัดสต็อปครีมท้ายทิ้ง — จอนั้นใช้ครีมได้
   เพราะสีจางลงตรงขอบล่างของหัวจอสั้น ๆ ก่อนถึงแผ่นเนื้อหาสีขาว แต่จอนี้เนื้อหาลอย
   กึ่งกลางเต็มความสูงจอ ถ้าไล่ถึงครีมด้วยจุดที่ตัวหนังสือสีขาวลอยอยู่จะตกอยู่ในโซนที่
   จางเกินจนอ่านไม่ออกพอดี ตัดสต็อปสุดท้ายทิ้งให้พื้นเป็นส้มสดตลอดทั้งจอแทน */
const SCREEN_RAMP = DELIVERY_RAMP.slice(0, 2) as [string, string];

type Phase =
  | { k: 'scanning' }
  | { k: 'inside'; km: number; address: string | null; lat: number; lng: number }
  | { k: 'outside'; km: number; radius: number }
  | { k: 'denied' }
  | { k: 'failed' };

export default function DeliveryCheckScreen() {
  const insets = useSafeAreaInsets();
  const setMode = useMode((s) => s.setMode);
  const loadFees = useFees((s) => s.load);
  const lang = useLocale((s) => s.lang);
  const profile = useAuth((s) => s.user);
  /* ยังไม่ล็อกอิน = ชื่อใน store เป็นชื่อสำรอง ("คุณอู้ฟู่") ไม่ใช่ชื่อผู้รับจริง
     อย่าเอาไปกรอกให้ ไม่งั้นไรเดอร์จะได้ชื่อปลอมไปส่งของ */
  const signedIn = useAuth((s) => s.status === 'authenticated');
  const [phase, setPhase] = useState<Phase>({ k: 'scanning' });

  /* ไอคอนยุบพองวนไป (เจ้าของสั่ง 3 ก.ย. 2026 "ไอคอน ยุบพอง ตามหาพิกัด") แทนวงแหวน
   * เรดาร์แบบเดิม — ยุบพองสื่อว่า "กำลังหา" ได้ตรงกว่าวงขยายออกแล้วหายไปเฉย ๆ
   * useNativeDriver เพื่อให้วิ่งบนเธรดของ UI ไม่สะดุดตอน JS ยุ่งกับการหาพิกัด */
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase.k !== 'scanning') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, phase.k]);
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const scan = useCallback(async () => {
    setPhase({ k: 'scanning' });
    try {
      await loadFees();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPhase({ k: 'denied' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { shopLat, shopLng, deliveryRadiusKm } = useFees.getState().fees;

      // ที่อยู่กับระยะทางหาไปพร้อมกัน ไม่ใช่ต่อคิวกัน — ทั้งคู่ใช้พิกัดเดียวกันที่มีอยู่
      // แล้ว การถอดรหัสที่อยู่ล้มเหลวได้ (สัญญาณเน็ตไม่ดี) โดยไม่ควรทำให้ทั้งจอค้าง
      // รอ จึงกันด้วย .catch แยกจาก try/catch หลักที่คุมการตรวจเขตส่ง
      const geocodePromise = (
        Platform.OS === 'web'
          ? osmReverseGeocode(
              { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
              lang,
            )
          : Location.reverseGeocodeAsync({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            })
      ).catch(() => [] as Location.LocationGeocodedAddress[]);

      // ร้านยังไม่ตั้งพิกัด = ยังไม่เปิดใช้เขต ฝั่งเซิร์ฟเวอร์ก็ปล่อยผ่าน (0073)
      if (shopLat == null || shopLng == null) {
        const rev = await geocodePromise;
        setPhase({
          k: 'inside', km: 0,
          address: rev[0] ? formatAddressLine(rev[0]) : null,
          lat: pos.coords.latitude, lng: pos.coords.longitude,
        });
        return;
      }
      const km = kmBetween(shopLat, shopLng, pos.coords.latitude, pos.coords.longitude);
      if (km <= deliveryRadiusKm) {
        const rev = await geocodePromise;
        setPhase({
          k: 'inside', km,
          address: rev[0] ? formatAddressLine(rev[0]) : null,
          lat: pos.coords.latitude, lng: pos.coords.longitude,
        });
      } else {
        setPhase({ k: 'outside', km, radius: deliveryRadiusKm });
      }
    } catch {
      setPhase({ k: 'failed' });
    }
  }, [loadFees, lang]);

  useEffect(() => {
    void scan();
  }, [scan]);

  /* เข้าเขตแล้วไม่ต้องให้กดต่อ — โชว์หมุด+ที่อยู่ที่เจอไว้ให้อ่านก่อนพาเข้าไปเอง
   * (เจ้าของสั่ง 3 ก.ย. 2026: "พอหาพิกัดได้ก็มีหมุดและที่อยู่ใต้จอ และก็เข้าไป")
   * หน่วงนานกว่าตอนโชว์แค่ระยะทางเดิม (900) เพราะที่อยู่เป็นประโยคยาว อ่านไม่ทัน
   * ใช้ replace ไม่ใช่ push — จอเช็คตำแหน่งไม่ควรค้างอยู่ในประวัติให้กดย้อนกลับมาเจอ */
  /* บันทึกตำแหน่งที่สแกนได้เป็นที่อยู่จัดส่งแล้วเลือกใช้ทันที (เจ้าของสั่ง 4 ก.ย. 2026
     "ตอนสแกนเข้ามา ที่อยู่ต้องตรงตามที่สแกนได้") — เดิมจอนี้หาที่อยู่มาโชว์แล้วทิ้งไป
     หน้าร้านจึงยังโชว์ที่อยู่เก่าในสมุดที่อยู่ ไม่ตรงกับที่เพิ่งสแกน
     เขียนทับใบเดิมที่ป้ายว่า "ตำแหน่งปัจจุบัน" ไม่สร้างใบใหม่ทุกครั้ง ไม่งั้นสมุดที่อยู่
     จะรกด้วยที่อยู่ซ้ำ ๆ ทุกครั้งที่เปิดโหมดเดลิเวอรี่
     ชื่อ/เบอร์เอาจากโปรไฟล์ที่ล็อกอินไว้ ถ้ายังไม่มีก็ปล่อยว่าง แล้วตะกร้าจะกันไม่ให้
     สั่งจนกว่าจะกรอก (ตามที่เจ้าของเลือก: ค่อยกรอกตอนสั่ง) */
  useEffect(() => {
    if (phase.k !== 'inside') return;
    setMode('delivery');

    let cancelled = false;
    const save = async () => {
      if (!phase.address) return; // ถอดรหัสที่อยู่ไม่ได้ ก็ไม่มีอะไรจะบันทึก
      try {
        const existing = useAddress
          .getState()
          .addresses.find((a) => a.label === SCANNED_LABEL);
        const id = await useAddress.getState().upsert({
          id: existing?.id,
          label: SCANNED_LABEL,
          recipient: existing?.recipient || (signedIn ? profile.name : '') || '',
          phone: existing?.phone || (signedIn ? profile.phone : '') || '',
          line: phase.address,
          lat: phase.lat,
          lng: phase.lng,
        });
        if (!cancelled) useAddress.getState().select(id);
      } catch {
        /* บันทึกไม่ได้ (ยังไม่ล็อกอิน/เน็ตหลุด) ก็ยังเข้าหน้าร้านได้ตามปกติ หัวจอจะโชว์
           ที่อยู่เดิมหรือ "เลือกที่อยู่จัดส่ง" แทน ไม่บล็อกทางเดินของลูกค้า */
      }
    };
    void save();

    const t = setTimeout(() => router.replace('/delivery'), 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phase, setMode, signedIn, profile.name, profile.phone]);

  const goOnline = () => {
    setMode('online');
    // โหมดออนไลน์ยังใช้หน้ารวมอยู่ก่อน — หน้าร้านของโหมดนี้ยังไม่ได้ทำ
    router.replace('/(tabs)/search');
  };

  return (
    <LinearGradient
      colors={SCREEN_RAMP}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.screen, { paddingTop: insets.top }]}>
      <IconButton
        icon="close"
        variant="tint"
        shape="circle"
        size={34}
        color={DELIVERY_INK}
        style={[styles.close, styles.glassBtn, { top: insets.top + Spacing.sm }]}
        accessibilityLabel="ปิด"
        onPress={() => router.back()}
      />

      <View style={styles.center}>
        <View style={styles.stage}>
          {phase.k === 'inside' ? (
            /* พบพิกัดแล้ว — ไอคอนหยุดยุบพองแล้วเปลี่ยนเป็นหมุดปักตำแหน่ง */
            <View style={styles.disc}>
              <Ionicons name="location" size={56} color={Colors.primaryStrong} />
            </View>
          ) : (
            /* รูปไอคอนยุบพองรอโหลด (เจ้าของสั่ง 3 ก.ย. 2026) — ทั้งวงกลมขาวและรูป
               มาสคอตขยับไปด้วยกันในสเกลเดียว ไม่ใช่แค่รูปข้างในขยับเฉย ๆ */
            <Animated.View style={[styles.disc, { transform: [{ scale: breatheScale }] }]}>
              <Image
                source={MODE_META.delivery.image}
                style={styles.mascot}
                contentFit="contain"
              />
            </Animated.View>
          )}
        </View>

        {phase.k === 'scanning' ? (
          <>
            <Text style={styles.title}>กำลังหาตำแหน่งของคุณ</Text>
            <Text style={styles.body}>ขอสักครู่นะ กำลังดูว่าส่งถึงบ้านคุณได้ไหม</Text>
            {/* กล่องเด้งไล่กันแทนวงหมุน (เจ้าของสั่ง 4 ก.ย. 2026) — สื่อว่า "กำลังทำงาน"
                ได้เหมือนกันแต่มีชีวิตกว่า และเป็นภาพของที่กำลังจะส่งถึงบ้านพอดี */}
            <View style={styles.loader}>
              <BouncingBoxes color={DELIVERY_INK} />
            </View>
          </>
        ) : null}

        {phase.k === 'inside' ? (
          <>
            <Text style={styles.title}>ส่งถึงคุณได้!</Text>
            {/* หมุด + ที่อยู่ที่เจอ — เจ้าของสั่ง 3 ก.ย. 2026 ให้ขึ้นแทนตัวเลขระยะทาง
                ถอดรหัสที่อยู่ล้มเหลวได้ (เน็ตไม่ดี ๆ) จึงมีข้อความสำรองไว้ ไม่ปล่อยว่าง */}
            <View style={styles.addrRow}>
              <Ionicons name="location" size={16} color={DELIVERY_INK} style={styles.addrPin} />
              <Text style={styles.addrText} numberOfLines={2}>
                {phase.address ?? `ห่างจากร้าน ${phase.km.toFixed(1)} กม.`}
              </Text>
            </View>
          </>
        ) : null}

        {phase.k === 'outside' ? (
          <>
            <Text style={styles.title}>บ้านคุณอยู่ไกลไปนิด</Text>
            <Text style={styles.body}>
              ห่างจากร้าน {phase.km.toFixed(0)} กม. เกินเขตส่งของร้าน ({phase.radius} กม.)
            </Text>
            {/* ไม่ใช่ทางตัน — ร้านส่งพัสดุทั่วไทยได้ ปุ่มนี้จึงเป็นปุ่มหลัก */}
            <Text style={styles.lead}>แต่เราส่งพัสดุถึงคุณได้นะ</Text>
            <Pressable style={styles.primaryBtn} onPress={goOnline}>
              <Text style={styles.primaryLabel}>เปลี่ยนเป็นส่งพัสดุ</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => router.replace('/address')}>
              <Text style={styles.ghostLabel}>ใช้ที่อยู่อื่น</Text>
            </Pressable>
          </>
        ) : null}

        {phase.k === 'denied' ? (
          <>
            <Text style={styles.title}>ยังไม่ได้เปิดตำแหน่ง</Text>
            <Text style={styles.body}>
              เปิดสิทธิ์ตำแหน่งให้แอป หรือเลือกที่อยู่จัดส่งเองก็ได้
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.replace('/address')}>
              <Text style={styles.primaryLabel}>เลือกที่อยู่เอง</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => void scan()}>
              <Text style={styles.ghostLabel}>ลองอีกครั้ง</Text>
            </Pressable>
          </>
        ) : null}

        {phase.k === 'failed' ? (
          <>
            <Text style={styles.title}>หาตำแหน่งไม่เจอ</Text>
            <Text style={styles.body}>สัญญาณอาจไม่ดี ลองอีกครั้งหรือเลือกที่อยู่เอง</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void scan()}>
              <Text style={styles.primaryLabel}>ลองอีกครั้ง</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => router.replace('/address')}>
              <Text style={styles.ghostLabel}>เลือกที่อยู่เอง</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // ไล่สีส้มเต็มจอ (เจ้าของสั่ง 3 ก.ย. 2026 "ขอสีส้มกาเดียน") — สีจริงมาจาก SCREEN_RAMP
  // ที่ผูกกับ LinearGradient ค่านี้เป็นแค่พื้นสำรองกันกระพริบเฟรมแรกก่อนไล่สีวาดเสร็จ
  screen: { flex: 1, backgroundColor: Colors.primary },
  // top จริงมาจาก insets.top + Spacing.sm ที่ผูกตรงจุดเรียกใช้ — paddingTop ของ
  // LinearGradient ที่ครอบอยู่ไม่ไหลลงมาถึงลูกที่ position: absolute ต้องบวก
  // insets.top เข้าไปเองตรง ๆ ไม่งั้นปุ่มจะไปทับแถบสถานะ (ลองแล้วเห็นจริง)
  close: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 1,
  },
  // ปุ่มใส แบบเดียวกับปุ่มบนหัวจอเดลิเวอรี่ (delivery/index.tsx) — ให้ทั้งขบวนการ
  // ก่อนเข้าโหมดเดลิเวอรี่หน้าตาเข้าชุดกัน
  glassBtn: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  loader: { marginTop: Spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.x2,
    /* ดันขึ้นเล็กน้อยเฉย ๆ ไม่ถึง 22% — เผื่อระยะเดิมไว้ตอนยังเป็นโมดัลที่เตี้ยกว่า
     * เต็มจอ ตอนนี้เต็มจอแล้วแต่ระยะนี้ยังใช้ได้ดี เนื้อหาไม่กองอยู่ครึ่งล่างพอดี */
    paddingBottom: Spacing.x3,
    justifyContent: 'center',
  },
  stage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  /* พื้นขาวตัดกับจอสีพีช (เจ้าของสั่ง 3 ก.ย. 2026 "จอสีพีช") — ถ้าดิสก์เป็นสีพีชเหมือน
     ตอนพื้นหลังยังขาวจะจมหายไปกับพื้นทันที ไม่เห็นว่าอะไรกำลังยุบพองอยู่ */
  disc: {
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.float,
  },
  mascot: { width: 92, height: 92 },
  // ตัวหนังสือขาวทั้งจอ + เงาจาง ๆ ตรึงขอบ (ชุดเดียวกับ DELIVERY_INK_SHADOW ที่หัวจอ
  // เดลิเวอรี่ใช้) — ข้อความสีเข้มแบบเดิมอ่านไม่ออกบนพื้นส้มสดแล้ว
  title: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 22,
    color: DELIVERY_INK,
    textAlign: 'center',
    ...DELIVERY_INK_SHADOW,
  },
  body: {
    fontSize: 15,
    color: DELIVERY_INK,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 24,
    ...DELIVERY_INK_SHADOW,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  // เว้นให้หมุดอยู่กึ่งกลางบรรทัดแรกของข้อความพอดี ไม่ใช่ชิดขอบบนของกล่องข้อความ
  addrPin: { marginTop: 3 },
  addrText: {
    flexShrink: 1,
    fontSize: 15,
    color: DELIVERY_INK,
    lineHeight: 22,
    ...DELIVERY_INK_SHADOW,
  },
  lead: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 17,
    color: DELIVERY_INK,
    textAlign: 'center',
    marginTop: Spacing.lg,
    ...DELIVERY_INK_SHADOW,
  },
  // ปุ่มหลักพลิกเป็นพื้นขาวตัวหนังสือส้ม (เดิมพื้นส้มตัวหนังสือขาว) — บนพื้นจอที่เป็น
  // ส้มไล่สีอยู่แล้ว ปุ่มพื้นส้มเดิมจะจมหายไปกับพื้นแทบมองไม่เห็นขอบปุ่ม
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.md,
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.float,
  },
  primaryLabel: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 17,
    color: Colors.primaryStrong,
  },
  ghostBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.xs,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontSize: 15, color: DELIVERY_INK, ...DELIVERY_INK_SHADOW },
});
