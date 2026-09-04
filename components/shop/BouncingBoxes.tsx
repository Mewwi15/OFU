/**
 * BouncingBoxes — กล่องพัสดุเด้งไล่กันเป็นคลื่น ใช้แทนวงหมุนบนจอโหลด
 *
 * เจ้าของสั่ง 4 ก.ย. 2026 "ทำแบบโค้ดไปก่อนครับ กล่องเด้งไล่กัน" — หลังคุยกันว่าถ้าจะเอา
 * ระดับวิดีโอจริง ๆ ต้องใช้ Lottie ซึ่งเป็น native module ต้อง build ใหม่แล้วส่งสโตร์
 * รอรีวิวหลายวัน ตัวนี้ทำด้วยโค้ดล้วน ส่ง OTA ถึงลูกค้าได้ทันที
 *
 * ใช้ได้ทั้งจอเดลิเวอรี่ (ส้ม) และจอออนไลน์ (น้ำเงิน) — รับสีจากข้างนอก ไม่ผูกกับโหมด
 * ใดโหมดหนึ่ง
 */

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

/** หน่วงเริ่มของแต่ละกล่อง — ทำให้เป็นคลื่นไล่ ไม่ใช่เด้งพร้อมกันทั้งแถว */
const STEP_MS = 160;
/** ขาขึ้นกับขาลงอย่างละเท่านี้ รวมเป็นหนึ่งรอบ */
const LEG_MS = 340;

export type BouncingBoxesProps = {
  /** สีกล่อง — ส่งสีของโหมดนั้นมา (ส้มหรือน้ำเงิน) */
  color: string;
  /** ความกว้าง/สูงของกล่องแต่ละใบ */
  size?: number;
  count?: number;
};

export function BouncingBoxes({ color, size = 20, count = 3 }: BouncingBoxesProps) {
  /* หนึ่งค่าต่อหนึ่งกล่อง — สร้างครั้งเดียวตลอดอายุคอมโพเนนต์ ถ้าสร้างใหม่ทุกเรนเดอร์
     แอนิเมชันจะกระตุกทุกครั้งที่พ่อแม่เรนเดอร์ใหม่ */
  const vals = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    /* เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของเครื่อง — จอโหลดที่เด้งตลอดเวลาเป็นตัวกระตุ้น
       อาการเวียนหัวของคนที่แพ้การเคลื่อนไหว ปล่อยให้กล่องอยู่นิ่งไปเลยดีกว่า */
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      vals.forEach((v, i) => {
        /* หน่วงด้วย setTimeout ก่อนเริ่มลูป ไม่ใช่ใส่ Animated.delay ไว้ในลูป —
           delay ที่อยู่ในลูปจะถูกเล่นซ้ำทุกรอบ กลายเป็นกล่องหยุดค้างก่อนเด้งทุกครั้ง
           แทนที่จะเด้งต่อเนื่องเป็นคลื่น */
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            const leg = (to: number, easing: (v: number) => number) =>
              Animated.timing(v, {
                toValue: to,
                duration: LEG_MS,
                easing,
                useNativeDriver: true,
              });
            Animated.loop(
              // ขาขึ้นชะลอตัวตอนสุด ขาลงเร่งตัว — ให้รู้สึกมีน้ำหนักเหมือนของตกจริง
              Animated.sequence([leg(1, Easing.out(Easing.quad)), leg(0, Easing.in(Easing.quad))]),
              { resetBeforeIteration: false },
            ).start();
          }, i * STEP_MS),
        );
      });
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      vals.forEach((v) => v.stopAnimation());
    };
  }, [vals]);

  return (
    <View style={[styles.row, { gap: Math.round(size * 0.45) }]}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.box,
            {
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.22),
              backgroundColor: color,
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -Math.round(size * 0.8)],
                  }),
                },
              ],
            },
          ]}>
          {/* เส้นเทปกลางกล่อง — ทำให้อ่านออกว่าเป็นกล่องพัสดุ ไม่ใช่แค่สี่เหลี่ยมสามอัน
              ใช้ดำจาง ไม่ใช่ขาวจาง เพราะกล่องถูกส่งสีขาวมา (ตัวหนังสือของหน้านั้น)
              ขาวบนขาวมองไม่เห็นเลย — ดำจางเห็นได้ทั้งบนกล่องขาวและกล่องสีเข้ม */}
          <View
            style={[
              styles.tape,
              {
                width: size,
                height: Math.max(2, Math.round(size * 0.1)),
                top: Math.round(size / 2) - 1,
              },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  box: { alignItems: 'center', justifyContent: 'center' },
  tape: { position: 'absolute', left: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
});
