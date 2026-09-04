/**
 * จอเตรียมพร้อม ก่อนเข้าโหมดออนไลน์ (ส่งพัสดุทั่วไทย)
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "เข้าไปหน้า UI ก็ขึ้นโหลดเหมือน Delivery เลยครับ ลอกกันไปเลย
 * แต่ว่าเป็นสีน้ำเงินครับ" — โครงเดียวกับ delivery-check.tsx ทุกอย่าง ต่างที่ชุดสี
 * และ "สิ่งที่ตรวจ"
 *
 * ★ ตรวจคนละเรื่องกับเดลิเวอรี่ ★
 * เดลิเวอรี่ตรวจว่าอยู่ในรัศมีส่งของไหม (มีเขตจำกัด) แต่ออนไลน์ส่งพัสดุทั่วไทย ไม่มีเขต
 * ให้ตรวจ — ถ้าลอกการสแกน GPS มาทั้งดุ้นจะกลายเป็นจอที่ขอสิทธิ์ตำแหน่งโดยไม่มีเหตุผล
 * และบอกว่า "อยู่นอกเขต" ทั้งที่ส่งได้จริง
 * สิ่งที่โหมดนี้ต้องมีจริง ๆ คือที่อยู่แบบพัสดุ (จังหวัด + รหัสไปรษณีย์ 5 หลัก + ชื่อ
 * ผู้รับ + เบอร์) ซึ่งเดิมไปเช็คตอนกดจ่ายเงิน ลูกค้าเลือกของเต็มตะกร้าแล้วค่อยโดนบล็อก
 * จอนี้จึงย้ายการเช็คมาไว้ตั้งแต่กดเลือกโหมด เหมือนที่เดลิเวอรี่ทำ
 *
 * ไม่บล็อกทางเดิน — ไม่มีที่อยู่ก็ยังกด "ดูสินค้าก่อน" เข้าไปเลือกของได้ ค่อยกรอกที่อยู่
 * ตอนจ่ายเงิน เพราะการบังคับกรอกที่อยู่ก่อนเห็นของสักชิ้นคือการไล่ลูกค้ากลับ
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BouncingBoxes } from '@/components/shop/BouncingBoxes';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { ONLINE_INK, ONLINE_INK_SHADOW, ONLINE_RAMP } from '@/constants/online';
import { hasParcelInfo, selectedAddress, useAddress } from '@/store/address';
import { MODE_META, useFees, useMode } from '@/store/mode';

/* ไล่เฉดสองสต็อปแรก ตัดสต็อปจางท้ายทิ้ง — เหตุผลเดียวกับจอสแกนของเดลิเวอรี่: เนื้อหา
   ลอยกลางจอเต็มความสูง ถ้าไล่ถึงสีจางด้วย ตัวหนังสือขาวจะไปตกในโซนที่อ่านไม่ออกพอดี */
const SCREEN_RAMP = ONLINE_RAMP.slice(0, 2) as [string, string];

type Phase =
  | { k: 'checking' }
  | { k: 'ready'; line: string }
  | { k: 'needAddress' };

export default function OnlineCheckScreen() {
  const insets = useSafeAreaInsets();
  const setMode = useMode((s) => s.setMode);
  const loadFees = useFees((s) => s.load);
  const loadAddresses = useAddress((s) => s.load);
  const [phase, setPhase] = useState<Phase>({ k: 'checking' });

  /* ไอคอนยุบพองระหว่างรอ — ชุดเดียวกับจอเดลิเวอรี่ */
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase.k !== 'checking') return;
    const leg = (to: number) =>
      Animated.timing(breathe, {
        toValue: to,
        duration: 900,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [breathe, phase.k]);
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const check = useCallback(async () => {
    setPhase({ k: 'checking' });
    try {
      /* โหลดค่าธรรมเนียมกับสมุดที่อยู่ให้เสร็จก่อนตัดสิน — ถ้าตัดสินจากสมุดที่อยู่ที่ยัง
         โหลดไม่เสร็จ จะขึ้นว่า "ยังไม่มีที่อยู่" ทั้งที่มีอยู่แล้ว */
      await Promise.all([loadFees(), loadAddresses()]);
    } catch {
      /* โหลดไม่สำเร็จก็ยังตัดสินจากสิ่งที่มีในเครื่องได้ ไม่ต้องขึ้นจอ error ให้ตกใจ */
    }
    const a = selectedAddress(useAddress.getState());
    setPhase(hasParcelInfo(a) ? { k: 'ready', line: a?.line ?? '' } : { k: 'needAddress' });
  }, [loadFees, loadAddresses]);

  useEffect(() => {
    void check();
  }, [check]);

  /* พร้อมแล้วพาเข้าหน้าร้านเอง — หน่วงให้อ่านที่อยู่จบก่อน เท่าจอเดลิเวอรี่
     replace ไม่ใช่ push จอเตรียมพร้อมไม่ควรค้างในประวัติให้กดย้อนกลับมาเจอ */
  useEffect(() => {
    if (phase.k !== 'ready') return;
    setMode('online');
    const t = setTimeout(() => router.replace('/online'), 1500);
    return () => clearTimeout(t);
  }, [phase.k, setMode]);

  const browseAnyway = () => {
    setMode('online');
    router.replace('/online');
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
        color={ONLINE_INK}
        style={[styles.close, styles.glassBtn, { top: insets.top + Spacing.sm }]}
        accessibilityLabel="ปิด"
        onPress={() => router.back()}
      />

      <View style={styles.center}>
        <View style={styles.stage}>
          {phase.k === 'checking' ? (
            <Animated.View style={[styles.disc, { transform: [{ scale: breatheScale }] }]}>
              <Image source={MODE_META.online.image} style={styles.mascot} contentFit="contain" />
            </Animated.View>
          ) : (
            <View style={styles.disc}>
              <Ionicons
                name={phase.k === 'ready' ? 'cube' : 'location-outline'}
                size={56}
                color={SCREEN_RAMP[0]}
              />
            </View>
          )}
        </View>

        {phase.k === 'checking' ? (
          <>
            <Text style={styles.title}>กำลังเตรียมร้านให้คุณ</Text>
            <Text style={styles.body}>ขอสักครู่นะ เช็คที่อยู่สำหรับส่งพัสดุ</Text>
            {/* กล่องเด้งไล่กันแทนวงหมุน — ชุดเดียวกับจอเดลิเวอรี่ ต่างแค่สี */}
            <View style={styles.loader}>
              <BouncingBoxes color={ONLINE_INK} />
            </View>
          </>
        ) : null}

        {phase.k === 'ready' ? (
          <>
            <Text style={styles.title}>ส่งพัสดุถึงคุณได้!</Text>
            <View style={styles.addrRow}>
              <Ionicons name="location" size={16} color={ONLINE_INK} style={styles.addrPin} />
              <Text style={styles.addrText} numberOfLines={2}>
                {phase.line}
              </Text>
            </View>
          </>
        ) : null}

        {phase.k === 'needAddress' ? (
          <>
            <Text style={styles.title}>ส่งได้ทั่วไทย</Text>
            <Text style={styles.body}>
              เพิ่มที่อยู่พร้อมจังหวัดและรหัสไปรษณีย์ไว้ก่อน ตอนสั่งจะได้ไม่ต้องกรอกใหม่
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.replace('/address')}>
              <Text style={styles.primaryLabel}>เพิ่มที่อยู่ส่งพัสดุ</Text>
            </Pressable>
            {/* ไม่บังคับ — บังคับกรอกที่อยู่ก่อนเห็นของสักชิ้นคือการไล่ลูกค้ากลับ */}
            <Pressable style={styles.ghostBtn} onPress={browseAnyway}>
              <Text style={styles.ghostLabel}>ดูสินค้าก่อน</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // พื้นสำรองกันกระพริบเฟรมแรกก่อนไล่สีวาดเสร็จ — สีจริงมาจาก SCREEN_RAMP
  screen: { flex: 1, backgroundColor: SCREEN_RAMP[0] },
  /* top จริงบวก insets.top ที่จุดเรียกใช้ — paddingTop ของ LinearGradient ไม่ไหลลงมาถึง
     ลูกที่ position absolute (บทเรียนจากจอเดลิเวอรี่ ปุ่มไปทับแถบสถานะ) */
  close: { position: 'absolute', right: Spacing.lg, zIndex: 1 },
  glassBtn: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  loader: { marginTop: Spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
    paddingBottom: Spacing.x3,
  },
  stage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  // ขาวตัดกับพื้นน้ำเงิน — ถ้าใช้สีเดียวกับพื้นจะจมหายไปเหมือนที่เคยพลาดในจอเดลิเวอรี่
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
    color: ONLINE_INK,
    textAlign: 'center',
    ...ONLINE_INK_SHADOW,
  },
  body: {
    fontSize: 15,
    color: ONLINE_INK,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 24,
    ...ONLINE_INK_SHADOW,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  addrPin: { marginTop: 3 },
  addrText: {
    flexShrink: 1,
    fontSize: 15,
    color: ONLINE_INK,
    lineHeight: 22,
    ...ONLINE_INK_SHADOW,
  },
  // ปุ่มขาวตัวหนังสือน้ำเงิน — ปุ่มสีพื้นเดียวกับจอจะจมหายไป
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.lg,
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
    color: SCREEN_RAMP[0],
  },
  ghostBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.xs,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontSize: 15, color: ONLINE_INK, ...ONLINE_INK_SHADOW },
});
