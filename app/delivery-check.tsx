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
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { formatAddressLine } from '@/lib/address';
import { kmBetween } from '@/lib/geo';
import { osmReverseGeocode } from '@/lib/osm';
import { useLocale } from '@/store/locale';
import { MODE_META, useFees, useMode } from '@/store/mode';

type Phase =
  | { k: 'scanning' }
  | { k: 'inside'; km: number; address: string | null }
  | { k: 'outside'; km: number; radius: number }
  | { k: 'denied' }
  | { k: 'failed' };

export default function DeliveryCheckScreen() {
  const insets = useSafeAreaInsets();
  const setMode = useMode((s) => s.setMode);
  const loadFees = useFees((s) => s.load);
  const lang = useLocale((s) => s.lang);
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
        setPhase({ k: 'inside', km: 0, address: rev[0] ? formatAddressLine(rev[0]) : null });
        return;
      }
      const km = kmBetween(shopLat, shopLng, pos.coords.latitude, pos.coords.longitude);
      if (km <= deliveryRadiusKm) {
        const rev = await geocodePromise;
        setPhase({ k: 'inside', km, address: rev[0] ? formatAddressLine(rev[0]) : null });
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
  useEffect(() => {
    if (phase.k !== 'inside') return;
    setMode('delivery');
    const t = setTimeout(() => router.replace('/delivery'), 1500);
    return () => clearTimeout(t);
  }, [phase.k, setMode]);

  const goOnline = () => {
    setMode('online');
    // โหมดออนไลน์ยังใช้หน้ารวมอยู่ก่อน — หน้าร้านของโหมดนี้ยังไม่ได้ทำ
    router.replace('/(tabs)/search');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ปิด"
        style={styles.close}
        onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={Colors.text} />
      </Pressable>

      <View style={styles.center}>
        <View style={styles.stage}>
          {phase.k === 'inside' ? (
            /* พบพิกัดแล้ว — ไอคอนหยุดยุบพองแล้วเปลี่ยนเป็นหมุดปักตำแหน่ง */
            <View style={styles.disc}>
              <Ionicons name="location" size={56} color={Colors.primaryStrong} />
            </View>
          ) : (
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
            <ActivityIndicator style={{ marginTop: Spacing.lg }} color={Colors.primary} />
          </>
        ) : null}

        {phase.k === 'inside' ? (
          <>
            <Text style={styles.title}>ส่งถึงคุณได้!</Text>
            {/* หมุด + ที่อยู่ที่เจอ — เจ้าของสั่ง 3 ก.ย. 2026 ให้ขึ้นแทนตัวเลขระยะทาง
                ถอดรหัสที่อยู่ล้มเหลวได้ (เน็ตไม่ดี ๆ) จึงมีข้อความสำรองไว้ ไม่ปล่อยว่าง */}
            <View style={styles.addrRow}>
              <Ionicons name="location" size={16} color={Colors.primaryStrong} style={styles.addrPin} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  // จอสีพีช (เจ้าของสั่ง 3 ก.ย. 2026) — primaryTint คือโทนพีชอ่อนที่ระบบมีอยู่แล้ว
  // ใช้ทำพื้นแบนเนอร์/รูปสินค้าที่ยังโหลดไม่เสร็จ เอามาเป็นพื้นทั้งจอได้พอดี
  screen: { flex: 1, backgroundColor: Colors.primaryTint },
  close: {
    alignSelf: 'flex-end',
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.x2,
    /* ดันขึ้นเล็กน้อยเฉย ๆ ไม่ถึง 22% — จอนี้เปิดเป็นโมดัลซึ่งเตี้ยกว่าเต็มจอ
     * เว้นล่างเยอะไปแล้วเนื้อหาจะไปกองครึ่งล่าง เหลือช่องว่างโล่งข้างบน */
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
  title: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 24,
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
    color: Colors.textMuted,
    lineHeight: 22,
  },
  lead: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 17,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.md,
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 17,
    color: Colors.textOnPrimary,
  },
  ghostBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.xs,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontSize: 15, color: Colors.textMuted },
});
