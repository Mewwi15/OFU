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
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { kmBetween } from '@/lib/geo';
import { MODE_META, useFees, useMode } from '@/store/mode';

type Phase =
  | { k: 'scanning' }
  | { k: 'inside'; km: number }
  | { k: 'outside'; km: number; radius: number }
  | { k: 'denied' }
  | { k: 'failed' };

export default function DeliveryCheckScreen() {
  const insets = useSafeAreaInsets();
  const setMode = useMode((s) => s.setMode);
  const loadFees = useFees((s) => s.load);
  const [phase, setPhase] = useState<Phase>({ k: 'scanning' });

  /* วงกลมเรดาร์ขยายออกวนไป — ให้จอโหลดมีชีวิตแทนที่จะเป็นวงกลมหมุนเปล่า ๆ
   * useNativeDriver เพื่อให้วิ่งบนเธรดของ UI ไม่สะดุดตอน JS ยุ่งกับการหาพิกัด */
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

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
      // ร้านยังไม่ตั้งพิกัด = ยังไม่เปิดใช้เขต ฝั่งเซิร์ฟเวอร์ก็ปล่อยผ่าน (0073)
      if (shopLat == null || shopLng == null) {
        setPhase({ k: 'inside', km: 0 });
        return;
      }
      const km = kmBetween(shopLat, shopLng, pos.coords.latitude, pos.coords.longitude);
      setPhase(
        km <= deliveryRadiusKm
          ? { k: 'inside', km }
          : { k: 'outside', km, radius: deliveryRadiusKm },
      );
    } catch {
      setPhase({ k: 'failed' });
    }
  }, [loadFees]);

  useEffect(() => {
    void scan();
  }, [scan]);

  /* เข้าเขตแล้วไม่ต้องให้กดต่อ — หน่วงให้อ่านข้อความจบแล้วพาไปหน้าสินค้าเลย
   * (เจ้าของสั่ง 3 ก.ย. 2026: กด Delivery แล้วเปลี่ยนหน้าไปหน้าสินค้าไปเลย)
   * คนกดเลือกโหมดเพราะอยากซื้อของ ไม่ใช่อยากกลับมาดูหน้าแรกอีกรอบ
   * ใช้ replace ไม่ใช่ push — จอเช็คตำแหน่งไม่ควรค้างอยู่ในประวัติให้กดย้อนกลับมาเจอ */
  useEffect(() => {
    if (phase.k !== 'inside') return;
    setMode('delivery');
    const t = setTimeout(() => router.replace('/delivery'), 900);
    return () => clearTimeout(t);
  }, [phase.k, setMode]);

  const goOnline = () => {
    setMode('online');
    // โหมดออนไลน์ยังใช้หน้ารวมอยู่ก่อน — หน้าร้านของโหมดนี้ยังไม่ได้ทำ
    router.replace('/(tabs)/search');
  };

  const ring = (delay: number) => ({
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6 + delay, 1.9 + delay],
        }),
      },
    ],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
  });

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
          {phase.k === 'scanning' ? (
            <>
              <Animated.View style={[styles.ring, ring(0)]} />
              <Animated.View style={[styles.ring, ring(0.35)]} />
            </>
          ) : null}
          <View style={styles.disc}>
            <Image
              source={MODE_META.delivery.image}
              style={styles.mascot}
              contentFit="contain"
            />
          </View>
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
            <View style={styles.okBadge}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
            <Text style={styles.title}>ส่งถึงคุณได้!</Text>
            <Text style={styles.body}>
              บ้านคุณห่างจากร้าน {phase.km.toFixed(1)} กม. · เริ่มสั่งได้เลย
            </Text>
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
  screen: { flex: 1, backgroundColor: Colors.background },
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
  ring: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  disc: {
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: { width: 92, height: 92 },
  okBadge: {
    width: 40,
    height: 40,
    borderRadius: 999,
    // เขียวสำเร็จ ไม่ใช่ส้มแบรนด์ — เครื่องหมายถูกต้องอ่านว่า "ผ่าน" ไม่ใช่ "ปุ่ม"
    backgroundColor: Colors.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
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
