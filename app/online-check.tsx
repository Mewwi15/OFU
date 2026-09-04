/**
 * จอเตรียมพร้อม ก่อนเข้าโหมดออนไลน์ (ส่งพัสดุทั่วไทย)
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "เข้าไปหน้า UI ก็ขึ้นโหลดเหมือน Delivery เลยครับ ลอกกันไปเลย
 * แต่ว่าเป็นสีน้ำเงินครับ" — โครงเดียวกับ delivery-check.tsx ทุกอย่าง ต่างที่ชุดสี
 * และ "สิ่งที่ตรวจ"
 *
 * ★ ตรวจคนละเรื่องกับเดลิเวอรี่ ★
 * เดลิเวอรี่ตรวจว่าอยู่ในรัศมีส่งของไหม (มีเขตจำกัด) แต่ออนไลน์ส่งพัสดุทั่วไทย ไม่มีเขต
 * ให้ตรวจ — จอนี้จึงไม่มีวันบอกว่า "อยู่นอกเขต"
 * สิ่งที่โหมดนี้ต้องมีจริง ๆ คือที่อยู่แบบพัสดุ (จังหวัด + รหัสไปรษณีย์ 5 หลัก + ชื่อ
 * ผู้รับ + เบอร์) ซึ่งเดิมไปเช็คตอนกดจ่ายเงิน ลูกค้าเลือกของเต็มตะกร้าแล้วค่อยโดนบล็อก
 * จอนี้จึงย้ายการเช็คมาไว้ตั้งแต่กดเลือกโหมด เหมือนที่เดลิเวอรี่ทำ
 *
 * ★ จับพิกัดด้วย (เจ้าของสั่ง 4 ก.ย. 2026 "อยากให้จับพิกัดด้วยครับ") ★
 * ไม่ได้จับไว้ตรวจเขต แต่จับไว้ "กรอกให้" — พิกัดหนึ่งจุดถอดออกมาได้ทั้งจังหวัดและรหัส
 * ไปรษณีย์ ซึ่งเป็นสองช่องที่โหมดนี้ต้องการพอดี ลูกค้าจึงเหลือแค่กรอกชื่อผู้รับกับเบอร์
 * แทนที่จะเจอฟอร์มเปล่าทั้งใบ
 * พิกัดเป็นของแถม ไม่ใช่ด่าน — ไม่ให้สิทธิ์ / หาไม่เจอ / ช้าเกิน GPS_TIMEOUT_MS ก็ไปต่อ
 * ด้วยสมุดที่อยู่ตามเดิม ไม่มีจอ error และไม่ค้างรอ (ต่างจากเดลิเวอรี่ที่ถ้าไม่มีพิกัดก็
 * ตัดสินอะไรไม่ได้เลย จึงต้องขึ้นจอ "ยังไม่ได้เปิดตำแหน่ง")
 *
 * ไม่บล็อกทางเดิน — ไม่มีที่อยู่ก็ยังกด "ดูสินค้าก่อน" เข้าไปเลือกของได้ ค่อยกรอกที่อยู่
 * ตอนจ่ายเงิน เพราะการบังคับกรอกที่อยู่ก่อนเห็นของสักชิ้นคือการไล่ลูกค้ากลับ
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
import { ONLINE_INK, ONLINE_INK_SHADOW, ONLINE_RAMP } from '@/constants/online';
import { formatAddressLine, parcelPartsFrom } from '@/lib/address';
import { osmReverseGeocode } from '@/lib/osm';
import { saveScannedAddress, type ScannedPin } from '@/lib/scannedAddress';
import { hasParcelInfo, SCANNED_LABEL, selectedAddress, useAddress } from '@/store/address';
import { useAuth } from '@/store/auth';
import { useLocale } from '@/store/locale';
import { MODE_META, useFees, useMode } from '@/store/mode';

/* ไล่เฉดสองสต็อปแรก ตัดสต็อปจางท้ายทิ้ง — เหตุผลเดียวกับจอสแกนของเดลิเวอรี่: เนื้อหา
   ลอยกลางจอเต็มความสูง ถ้าไล่ถึงสีจางด้วย ตัวหนังสือขาวจะไปตกในโซนที่อ่านไม่ออกพอดี */
const SCREEN_RAMP = ONLINE_RAMP.slice(0, 2) as [string, string];

/* รอพิกัดนานสุดเท่านี้แล้วไปต่อ — โหมดนี้ไม่ได้ต้องใช้พิกัดถึงจะทำงานได้ (ต่างจาก
   เดลิเวอรี่) การปล่อยให้จอโหลดค้างรอ GPS ในตึก/ลิฟต์เป็นนาที แลกกับการช่วยกรอกสองช่อง
   ไม่คุ้ม */
const GPS_TIMEOUT_MS = 8000;


/** คืน null เมื่อครบเวลา แทนที่จะรอต่อ — ผู้เรียกถือว่า "ไม่ได้พิกัด" แล้วไปต่อ */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

type Phase =
  | { k: 'checking' }
  | { k: 'ready'; line: string }
  /* pinned = ข้อความสั้น ๆ ของจังหวัด/รหัสไปรษณีย์ที่จับได้ (null ถ้าไม่ได้พิกัด) — โชว์
     ให้เห็นว่าการขอสิทธิ์ตำแหน่งไปแล้วได้อะไรกลับมาจริง ไม่ใช่ขอเฉย ๆ */
  | { k: 'needAddress'; pinned: string | null };

export default function OnlineCheckScreen() {
  const insets = useSafeAreaInsets();
  const setMode = useMode((s) => s.setMode);
  const loadFees = useFees((s) => s.load);
  const loadAddresses = useAddress((s) => s.load);
  const lang = useLocale((s) => s.lang);
  const profile = useAuth((s) => s.user);
  /* ยังไม่ล็อกอิน = ชื่อใน store เป็นชื่อสำรอง ("คุณอู้ฟู่") ไม่ใช่ชื่อผู้รับจริง อย่าเอาไป
     กรอกให้ ไม่งั้นพัสดุจะถูกส่งไปหาชื่อปลอม (เหตุผลเดียวกับจอเดลิเวอรี่) */
  const signedIn = useAuth((s) => s.status === 'authenticated');
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

  /* จับพิกัดแล้วถอดเป็นที่อยู่ — คืน null ทุกกรณีที่ไม่ได้ (ไม่ให้สิทธิ์ / หาไม่เจอ / ช้า
     เกินรอ) ผู้เรียกไปต่อด้วยสมุดที่อยู่แทน ไม่มีทางแตกออกไปเป็นจอ error */
  const capturePin = useCallback(async (): Promise<ScannedPin | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        GPS_TIMEOUT_MS,
      );
      if (!pos) return null;
      const { latitude, longitude } = pos.coords;
      // เว็บไม่มีตัวถอดรหัสในเครื่อง (expo-location) ต้องยิง Nominatim แทน
      const rev = await (Platform.OS === 'web'
        ? osmReverseGeocode({ latitude, longitude }, lang)
        : Location.reverseGeocodeAsync({ latitude, longitude })
      ).catch(() => [] as Location.LocationGeocodedAddress[]);
      if (!rev[0]) return null;
      return {
        line: formatAddressLine(rev[0]),
        parts: parcelPartsFrom(rev[0]),
        lat: latitude,
        lng: longitude,
      };
    } catch {
      return null;
    }
  }, [lang]);

  /* บันทึกพิกัดที่จับได้ลงใบ "ตำแหน่งปัจจุบัน" ใบเดิม — ใบเดียวกับที่จอเดลิเวอรี่ดูแล
     สองโหมดใช้ร่วมกัน สแกนที่ไหนก็ตาม อีกโหมดได้ที่อยู่ล่าสุดไปด้วย */
  const savePin = useCallback(
    async (pin: ScannedPin) => {
      const id = await saveScannedAddress(pin, {
        recipient: (signedIn ? profile.name : '') || '',
        phone: (signedIn ? profile.phone : '') || '',
      });

      /* ★ เลือกใบที่สแกนได้ ต่อเมื่อใบที่เลือกอยู่ยังส่งพัสดุไม่ได้ ★
         ถ้าลูกค้ามีที่อยู่บ้านที่กรอกครบอยู่แล้ว การสลับไปใช้ใบที่เพิ่งสแกน (ซึ่งมักยังไม่มี
         ชื่อผู้รับ/เบอร์) จะเปลี่ยนคนที่กดเข้ามาแล้วพร้อมสั่งเลย ให้กลายเป็นคนที่โดนถาม
         หาที่อยู่ใหม่ — ถอยหลัง ที่อยู่ที่ครบแล้วจึงชนะพิกัดสด */
      const current = selectedAddress(useAddress.getState());
      if (!hasParcelInfo(current)) useAddress.getState().select(id);
    },
    [signedIn, profile.name, profile.phone],
  );

  const check = useCallback(async () => {
    setPhase({ k: 'checking' });
    try {
      /* โหลดค่าธรรมเนียมกับสมุดที่อยู่ให้เสร็จก่อนตัดสิน — ถ้าตัดสินจากสมุดที่อยู่ที่ยัง
         โหลดไม่เสร็จ จะขึ้นว่า "ยังไม่มีที่อยู่" ทั้งที่มีอยู่แล้ว
         จับพิกัดคู่ขนานไปเลย ไม่ต่อคิว — ทั้งสองอย่างไม่ต้องรอผลของกันและกัน และการขอ
         สิทธิ์ตำแหน่งค้างรอผู้ใช้กดได้นาน ไม่ควรไปหน่วงการโหลดสมุดที่อยู่ */
      const [, pin] = await Promise.all([
        Promise.all([loadFees(), loadAddresses()]).catch(() => null),
        capturePin(),
      ]);
      if (pin) {
        /* บันทึกล้มเหลวได้ (ยังไม่ล็อกอิน/เน็ตหลุด) — ยังตัดสินจากสมุดที่อยู่ต่อได้ตามปกติ */
        await savePin(pin).catch(() => {});
      }
      const a = selectedAddress(useAddress.getState());
      if (hasParcelInfo(a)) {
        setPhase({ k: 'ready', line: a?.line ?? '' });
        return;
      }
      const found = [pin?.parts?.province, pin?.parts?.postalCode].filter(Boolean).join(' ');
      setPhase({ k: 'needAddress', pinned: found || null });
    } catch {
      /* กันไว้ชั้นสุดท้าย — ไม่ว่าอะไรพัง ลูกค้าต้องได้ทางเดินต่อ ไม่ใช่จอค้างที่ "กำลังเตรียม" */
      setPhase({ k: 'needAddress', pinned: null });
    }
  }, [loadFees, loadAddresses, capturePin, savePin]);

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

  /* ★ ต้องตั้งโหมดก่อนเปิดหน้าที่อยู่ ★ ฟอร์มที่อยู่ดูโหมดปัจจุบันเพื่อตัดสินว่าจะโชว์ช่อง
     ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ไหม ถ้ายังเป็นโหมดเดลิเวอรี่อยู่ ลูกค้าจะถูกส่งไปเจอ
     ฟอร์มที่ไม่มีช่องที่จอนี้เพิ่งบอกให้ไปกรอกเลย
     จับพิกัดได้ = พาเข้าใบนั้นตรง ๆ (ช่องกรอกไว้ให้แล้ว) ไม่ได้ = ไปที่สมุดที่อยู่ตามเดิม */
  const goAddress = () => {
    setMode('online');
    const scanned = useAddress.getState().addresses.find((a) => a.label === SCANNED_LABEL);
    router.replace(scanned ? `/address/picker?id=${scanned.id}` : '/address');
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
            <Text style={styles.body}>ขอสักครู่นะ กำลังหาตำแหน่งและที่อยู่ส่งพัสดุ</Text>
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
            {/* จับพิกัดได้ = กรอกจังหวัด/รหัสไปรษณีย์ไว้ให้แล้ว บอกไปตรง ๆ ว่าเหลือแค่ชื่อ
                กับเบอร์ ลูกค้าจะได้ไม่คิดว่าต้องกรอกใหม่ทั้งใบ */}
            {phase.pinned ? (
              <>
                <View style={styles.addrRow}>
                  <Ionicons
                    name="location"
                    size={16}
                    color={ONLINE_INK}
                    style={styles.addrPin}
                  />
                  <Text style={styles.addrText} numberOfLines={2}>
                    {phase.pinned}
                  </Text>
                </View>
                <Text style={styles.body}>
                  กรอกจังหวัดกับรหัสไปรษณีย์ไว้ให้แล้ว เหลือแค่ชื่อผู้รับกับเบอร์โทร
                </Text>
              </>
            ) : (
              <Text style={styles.body}>
                เพิ่มที่อยู่พร้อมจังหวัดและรหัสไปรษณีย์ไว้ก่อน ตอนสั่งจะได้ไม่ต้องกรอกใหม่
              </Text>
            )}
            <Pressable style={styles.primaryBtn} onPress={goAddress}>
              <Text style={styles.primaryLabel}>
                {phase.pinned ? 'กรอกชื่อผู้รับ' : 'เพิ่มที่อยู่ส่งพัสดุ'}
              </Text>
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
