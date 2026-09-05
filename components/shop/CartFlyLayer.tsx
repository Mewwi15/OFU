/**
 * ชั้นบนสุดที่วาดรูปสินค้าบินเข้าตะกร้า (เจ้าของสั่ง 5 ก.ย. 2026)
 *
 * วางไว้ชั้นเดียวที่ราก แล้วทุกหน้าใช้ร่วมกัน — ★ ต้องอยู่นอกรายการที่เลื่อนได้ ★ ถ้าวาด
 * ในการ์ดสินค้าเอง รูปจะโดนกรอบของรายการตัดหายตั้งแต่ยังไม่พ้นการ์ดใบนั้น
 *
 * pointerEvents="none" ทั้งชั้น — ระหว่างของกำลังบิน คนต้องกด "+" ใบถัดไปได้ทันที
 * (คนซื้อของกดรัวหลายใบติดกัน) ถ้าชั้นนี้กินการกดไว้ ของจะบินแล้วแอปค้างไปหนึ่งวินาที
 *
 * บินโค้งไม่ใช่เส้นตรง — ของที่ถูกโยนจะลอยขึ้นก่อนแล้วตกลงถึงปลายทาง เส้นตรงอ่านเป็น
 * "ภาพเลื่อน" ส่วนเส้นโค้งอ่านเป็น "ของถูกใส่ลงไป" ซึ่งเป็นความหมายที่ต้องการ
 */

import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useCartFly, type Flight } from '@/store/cartFly';

/** เร็วพอให้กดรัวได้ ช้าพอให้ตาตามทัน */
const DURATION = 520;
/** ความสูงของส่วนโค้ง เทียบกับระยะทางแนวตั้ง */
const ARC = 0.32;

function FlyingItem({ flight, targetX, targetY }: { flight: Flight; targetX: number; targetY: number }) {
  const p = useSharedValue(0);
  const done = useCartFly((s) => s.done);

  useEffect(() => {
    p.value = withTiming(1, { duration: DURATION, easing: Easing.inOut(Easing.quad) }, (ok) => {
      if (ok) runOnJS(done)(flight.id);
    });
  }, [p, done, flight.id]);

  const style = useAnimatedStyle(() => {
    const t = p.value;
    const x = interpolate(t, [0, 1], [flight.from.x, targetX]);
    const straightY = interpolate(t, [0, 1], [flight.from.y, targetY]);
    /* ยกโค้งขึ้นกลางทาง แล้วกลับมาเป็นศูนย์ที่ปลายทางพอดี (sin ครึ่งคลื่น)
       คิดจากระยะทางจริง ไม่ใช่ค่าคงที่ — บินจากบนจอลงล่างสุดกับบินระยะสั้นต้องได้โค้ง
       ที่ดูเป็นธรรมชาติพอกัน */
    const lift = Math.abs(targetY - flight.from.y) * ARC * Math.sin(Math.PI * t);
    /* ย่อลงเรื่อย ๆ จนเท่าไอคอนตะกร้า — ของที่ "ตกลงไปในตะกร้า" ต้องเล็กกว่าตะกร้า
       ไม่งั้นตอนถึงปลายทางมันจะทับตะกร้ามิดแล้วดูเหมือนภาพค้าง */
    const scale = interpolate(t, [0, 1], [1, 0.28]);
    return {
      transform: [
        { translateX: x - flight.size / 2 },
        { translateY: straightY - lift - flight.size / 2 },
        { scale },
      ],
      /* จางเฉพาะช่วงท้าย — จางเร็วเกินไปคนจะไม่ทันเห็นว่ามันไปไหน */
      opacity: interpolate(t, [0, 0.75, 1], [1, 1, 0]),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.item, { width: flight.size, height: flight.size }, style]}>
      <Image source={{ uri: flight.uri }} style={styles.img} contentFit="cover" cachePolicy="memory-disk" />
    </Animated.View>
  );
}

export function CartFlyLayer() {
  const flights = useCartFly((s) => s.flights);
  const target = useCartFly((s) => s.target);

  if (!target || flights.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flights.map((f) => (
        <FlyingItem key={f.id} flight={f} targetX={target.x} targetY={target.y} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
});
