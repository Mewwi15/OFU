/**
 * ProductCardSkeleton — โครงการ์ดสินค้าเปล่าที่เต้นเบา ๆ ระหว่างรอคลังสินค้าโหลด
 *
 * เจ้าของถาม 4 ก.ย. 2026 "มันไม่มีหน้าโหลดรอหรอครับ แบบเป็น placeholder ของภาพ" —
 * เดิมทุกหน้าที่โชว์สินค้าไม่ได้อ่านสถานะ loading ของ catalog store เลย ระหว่างรอโหลด
 * จึงวาดกริด/แถวว่างเปล่า จอโล่งสนิทจนกว่าข้อมูลจะมาถึงแล้วเด้งขึ้นมาทีเดียว
 *
 * ขนาดทุกค่าต้องตรงกับ ProductCard เป๊ะ (สัดส่วนรูป 1:1, มุมโค้ง, ระยะขอบใน, ความสูง
 * บรรทัดชื่อ/ราคา) — ถ้าไม่ตรง พอข้อมูลมาถึงเนื้อหาจะกระโดดเปลี่ยนตำแหน่ง ซึ่งดูแย่กว่า
 * ไม่มีโครงรอเลยด้วยซ้ำ
 *
 * ใช้จังหวะเต้นร่วมกันทั้งใบด้วย Skeleton ตัวเดียวต่อชิ้นส่วน แทนที่จะไล่หน่วงทีละใบ —
 * โครงรอไม่ควรดึงความสนใจ มันแค่บอกว่า "ของกำลังมา"
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

export function ProductCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      {/* ช่องรูป — เต้นเต็มพื้นที่ ไม่ใช่แค่แถบบาง ๆ เพราะรูปสินค้าคือส่วนที่ใหญ่ที่สุด
          ของการ์ด ถ้าปล่อยว่างไว้จะดูเหมือนการ์ดพัง ไม่ใช่การ์ดที่กำลังโหลด */}
      <Skeleton width={0} height={0} style={styles.image} />
      <View style={styles.info}>
        <Skeleton width={120} height={13} />
        <Skeleton width={54} height={12} style={styles.price} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // เหมือน ProductCard.card ทุกค่า
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  /* width/height ที่ส่งเข้า Skeleton ถูกทับด้วย style ตัวนี้ — ต้องยืดเต็มความกว้าง
     การ์ดและใช้ aspectRatio 1 ให้ตรงกับรูปจริงใน ProductCard */
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    borderRadius: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  // เหมือน ProductCard.info
  info: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  // ชดเชยให้ความสูงรวมของสองบรรทัดเท่ากับ name(20) + price(สูงตามฟอนต์) ของจริง
  price: { marginTop: 5 },
});
