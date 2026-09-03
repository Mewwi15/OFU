/**
 * หมวดหมู่แบบวงกลมสำหรับหน้าเดลิเวอรี่ — เจ้าของสั่ง 3 ก.ย. 2026
 * "หมวดหมู่เราจะเป็นวงกลม รองรับภาพไม่มีพื้นหลังด้วย ... รูปน่าสนใจ กระดิกได้
 *  เพิ่มกรูฟให้กับภาพ"
 *
 * คนละตัวกับ CategoryIcon ที่หน้าอื่นใช้ ตัวนั้นเป็นไทล์สี่เหลี่ยมที่มีพื้นเขียวอบมาใน
 * รูปแล้ว วางเดี่ยว ๆ ได้เลย ส่วนตัวนี้เป็น "จาน" วงกลมที่มีพื้นของตัวเอง แล้วเอารูป
 * วางทับ — รูปที่ไม่มีพื้นหลังจึงใช้ได้ทันที ส่วนไทล์เดิมที่ยังมีพื้นติดมาก็ยังใช้ได้
 * เพราะถูกครอบตัดเป็นวงกลมพอดี (ยังไม่มีภาพชุดใหม่ ใช้ของเดิมไปพลางก่อน)
 *
 * การเคลื่อนไหว: เดิมกระดิกทุกอัน เจ้าของสั่งตัดออกตอนภาพชุดจริงมา แล้วสั่งใหม่ให้
 * เอียงซ้ายขวาเฉพาะ "เครื่องดื่ม" กับ "ขนม" (3 ก.ย. 2026) — สองหมวดนี้เป็นของกินเล่น
 * ที่ควรดูมีชีวิต ส่วนหมวดอื่นอยู่นิ่ง ถ้าขยับหมดทั้งแถวจะกลายเป็นจอสั่นเหมือนเดิม
 * ที่เหลือมีแค่ย่อตอนกด ซึ่งเป็นการตอบสนองปกติของปุ่ม ไม่ใช่ขยับเอง
 */

import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

/** ภาพชุดพื้นใสที่เจ้าของส่งมา 3 ก.ย. 2026 — คนละชุดกับไทล์สี่เหลี่ยมพื้นเขียวที่หน้าอื่น
 *  ใช้อยู่ (assets/images/categories/*.png) จึงแยกโฟลเดอร์ไว้ ไม่ทับของเดิม
 *  ตัวไหนไม่รู้จัก (หมวดที่แอดมินเพิ่มทีหลัง) ใช้ตะกร้ารวมแทน */
const ART: Record<string, ReturnType<typeof require>> = {
  ทั้งหมด: require('@/assets/images/categories/circle/cat-all.png'),
  ของสด: require('@/assets/images/categories/circle/cat-fresh.png'),
  เครื่องดื่ม: require('@/assets/images/categories/circle/cat-drinks.png'),
  ของแห้ง: require('@/assets/images/categories/circle/cat-dry.png'),
  ของใช้ในบ้าน: require('@/assets/images/categories/circle/cat-home.png'),
  ขนม: require('@/assets/images/categories/circle/cat-snacks.png'),
  ยา: require('@/assets/images/categories/circle/cat-medicine.png'),
};

/* รูปกินพื้นที่กี่ส่วนของวง — ต้องเหลือขอบไว้บ้างเพราะสองหมวดที่เอียงจะหมุนมุมรูป
   เข้าไปหาขอบวง ถ้าเต็มวงจะเห็นเป็นรอยตัดตอนเอียงสุด */
const ART_FILL = 0.92;
/** หมวดที่ให้เอียงซ้ายขวาไปเรื่อย ๆ — เจ้าของเลือกมาสองตัวนี้ ไม่ใช่ทั้งแถว */
const TILTING = new Set(['เครื่องดื่ม', 'ขนม']);
const TILT_DEG = 5;
const TILT_MS = 950;

type Props = {
  category: string;
  size?: number;
  /** สีพื้นในวง — ส่งสีพื้นของหน้ามาเพื่อให้วงกลมกลืนหายไป ไม่ใช่ดูเป็นจานสีขาว */
  plateColor?: string;
  onPress?: () => void;
};

export function CategoryBubble({ category, size = 76, plateColor, onPress }: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const tilting = TILTING.has(category);

  useEffect(() => {
    if (!tilting) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    /* เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของเครื่อง — ภาพขยับตลอดเวลาเป็นตัวกระตุ้น
       อาการเวียนหัวของคนที่แพ้การเคลื่อนไหว ปิดไปเลยดีกว่าทำให้ช้าลง */
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      const leg = (to: number) =>
        Animated.timing(tilt, {
          toValue: to,
          duration: TILT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        });
      /* resetBeforeIteration ต้องปิด — ค่าเริ่มต้นของมันคือ true ซึ่งจะดีดค่ากลับไปที่
         ตำแหน่งตั้งต้นทุกครั้งที่วนรอบใหม่ รูปจึงกระโดดจากเอียงซ้ายสุดกลับมาตรงกลาง
         ทันทีในเฟรมเดียว = อาการกระตุกทุกรอบที่เจ้าของเห็น (3 ก.ย. 2026)
         ปิดแล้วมันวิ่งต่อจากที่ค้างไว้ ขวาสุด → ซ้ายสุด → ขวาสุด ไม่มีรอยต่อ */
      loop = Animated.loop(Animated.sequence([leg(1), leg(-1)]), {
        resetBeforeIteration: false,
      });
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [tilt, tilting]);

  const rotate = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${TILT_DEG}deg`, `${TILT_DEG}deg`],
  });
  /* หมุนรอบ "ฐาน" ของรูป ไม่ใช่รอบจุดกึ่งกลาง — หมุนรอบกึ่งกลางแล้วมันดูเหมือนสติกเกอร์
     ที่ถูกจับหมุน ไม่ใช่ของที่ตั้งอยู่แล้วโยกไปมา ย้ายจุดหมุนลงไปที่ขอบล่างด้วยการ
     เลื่อนลงครึ่งหนึ่ง หมุน แล้วเลื่อนกลับขึ้น (เรียงลำดับสำคัญ transform ทำจากท้ายไปหน้า) */
  const pivot = (size * ART_FILL) / 2;

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });

  const to = (v: number) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={onPress}
      style={styles.hit}>
      <View
        style={[
          styles.plate,
          { width: size, height: size, borderRadius: size / 2 },
          plateColor ? { backgroundColor: plateColor } : null,
        ]}>
        {/* ไม่ครอบตัดแล้ว — บน iOS การครอบตัดบังคับให้เนื้อหาที่หมุนถูกแรสเตอร์แล้วตัด
            ขอบรูปที่เอียงเลยออกมาหยัก ๆ ไม่เนียน (เจ้าของทัก 3 ก.ย. 2026 "ให้เนียน ๆ
            หน่อย อันนี้ไม่เนียน") ปล่อยให้วาดตรง ๆ ระบบจะลบรอยหยักให้เอง
            รูปกินแค่ 92% ของวงและอยู่กึ่งกลาง จึงไม่มีอะไรล้นกรอบอยู่ดี */}
        <View style={[styles.clip, { borderRadius: size / 2 }]}>
          <Animated.View
            style={{ transform: [{ translateY: pivot }, { rotate }, { translateY: -pivot }, { scale }] }}>
            <Image
              source={ART[category] ?? ART['ทั้งหมด']}
              style={{ width: size * ART_FILL, height: size * ART_FILL }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.label, { width: size }]}>
        {category}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', gap: Spacing.xs },
  /* "จาน" วงกลมมีพื้นของตัวเอง รูปที่ไม่มีพื้นหลังจึงมีที่ยืน · overflow hidden ทำให้
     ไทล์เดิมที่ยังเป็นสี่เหลี่ยมถูกครอบเป็นวงกลมไปด้วย ไม่ต้องรอภาพใหม่ถึงจะใช้ได้ */
  /* ไม่มีเงา ไม่มีขอบ — เจ้าของขอให้วงกลมกลืนไปกับพื้น เงาหรือขอบจะทำให้มันกลับมา
     ดูเป็นจานวางอยู่บนพื้นอีก วงกลมจึงเหลือหน้าที่เดียวคือครอบตัดรูปให้เป็นวง */
  plate: {
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clip: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ตัวหนาตามที่เจ้าของสั่ง — คำหมวดหมู่ต้องอ่านสะดุดตากว่าคำอธิบายทั่วไป */
  label: { fontFamily: 'Mitr_500Medium', fontSize: 12, color: Colors.text, textAlign: 'center' },
});
