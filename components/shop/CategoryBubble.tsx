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
 * กระดิก: วงกลมเป็นกรอบอยู่กับที่ ไม่ขยับ — ตัวที่ขยับคือรูปข้างใน และขยับอยู่ในวง
 * (เจ้าของย้ำ 3 ก.ย. 2026 "เหมือนเรา template วงกลมเอาไว้แล้วเอารูปมาใส่ วงกลมไม่ได้
 *  ขยับ ให้รูปขยับ แต่ขยับในวงกลมนั้น") ตอนแรกทำผิดเป็นขยับทั้งวง
 * หมุนเล็กน้อยสลับกับเด้งขึ้นลง วนไม่รู้จบ และ หน่วงตามลำดับของแต่ละอันให้เป็นคลื่นไล่
 * ไปตามแถว ถ้าเริ่มพร้อมกันหมดจะดูเหมือนจอสั่น ไม่ใช่กรูฟ
 */

import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

/** รูปประจำหมวด — ยังเป็นชุดเดิมอยู่ รอภาพใหม่จากเจ้าของ ตัวไหนไม่รู้จักใช้ตะกร้ารวม */
const ART: Record<string, ReturnType<typeof require>> = {
  ทั้งหมด: require('@/assets/images/categories/cat-all.png'),
  ของสด: require('@/assets/images/categories/cat-fresh.png'),
  เครื่องดื่ม: require('@/assets/images/categories/cat-drinks.png'),
  ของแห้ง: require('@/assets/images/categories/cat-dry.png'),
  ของใช้ในบ้าน: require('@/assets/images/categories/cat-home.png'),
  ขนม: require('@/assets/images/categories/cat-snacks.png'),
  ยา: require('@/assets/images/categories/cat-medicine.png'),
};

/** หน่วงของแต่ละอันในแถว — ทำให้เป็นคลื่นไล่ ไม่ใช่สั่นพร้อมกัน */
const GROOVE_STEP_MS = 170;
const GROOVE_MS = 1400;
/* รูปกินพื้นที่กี่ส่วนของวง — ต้องเหลือขอบไว้ให้รูปขยับได้โดยไม่ชนขอบวงตลอดเวลา
   ถ้าให้เต็มวง พอเอียงทีไรมุมรูปจะโดนขอบตัดทุกที */
const ART_FILL = 0.76;

type Props = {
  category: string;
  /** ลำดับในแถว ใช้หน่วงจังหวะให้ไล่กันเป็นคลื่น */
  index: number;
  size?: number;
  /** สีพื้นในวง — ส่งสีพื้นของหน้ามาเพื่อให้วงกลมกลืนหายไป ไม่ใช่ดูเป็นจานสีขาว */
  plateColor?: string;
  onPress?: () => void;
};

export function CategoryBubble({ category, index, size = 66, plateColor, onPress }: Props) {
  const groove = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    /* เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของเครื่อง — ภาพกระดิกตลอดเวลาเป็นตัวกระตุ้น
       อาการเวียนหัวของคนที่แพ้การเคลื่อนไหว ปิดไปเลยดีกว่าทำให้ช้าลง */
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * GROOVE_STEP_MS),
          Animated.timing(groove, {
            toValue: 1,
            duration: GROOVE_MS,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(groove, {
            toValue: 0,
            duration: GROOVE_MS,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [groove, index]);

  const rotate = groove.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
  const lift = groove.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] });
  /* ย่อตอนกดก็ให้เกิดกับรูป ไม่ใช่ทั้งวง — วงต้องนิ่งสนิทตามที่สั่ง */
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
        {/* ชั้นครอบตัดต้องแยกจากชั้นที่ใส่เงา — บน iOS การครอบตัดจะตัดเงาไปด้วย
            ใส่รวมวิวเดียวแล้วเงาหายทั้งดวง
            และการเคลื่อนไหวต้องอยู่ ข้างใน ชั้นนี้ รูปจึงถูกขอบวงกลมกันไว้เสมอ */}
        <View style={[styles.clip, { borderRadius: size / 2 }]}>
          <Animated.View
            style={{ transform: [{ translateY: lift }, { rotate }, { scale }] }}>
            <Image
              source={ART[category] ?? ART['ทั้งหมด']}
              style={{ width: size * ART_FILL, height: size * ART_FILL }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.label, { width: size + 14 }]}>
        {category}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', gap: Spacing.sm },
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, color: Colors.text, textAlign: 'center' },
});
