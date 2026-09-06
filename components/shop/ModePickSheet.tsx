/**
 * ModePickSheet — แผ่นเลือกวิธีรับของ ก่อนเข้าหน้าสินค้าจากแถบขายดีบนหน้าแรก
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "flow การทำงานของเราจะต้องเลือก delivery หรือ ONLINE ก่อน
 * ถึงจะเลือกสินค้าได้นะครับ" — หน้าแรกโชว์สินค้าขายดีให้ดูได้เลย (ของสวยต้องได้ทำหน้าที่
 * ดึงดูด) แต่ "ตอนกด" ต้องรู้ก่อนว่าจะรับของยังไง
 *
 * ★ ทำไมต้องถาม ทั้งที่ mode มีค่าอยู่แล้วเสมอ ★
 * mode ตั้งต้นเป็นเดลิเวอรี่และถูกจำข้ามการเปิดแอป จึงแยกไม่ออกว่าลูกค้าตั้งใจเลือกไว้
 * หรือแค่ค่าตั้งต้นค้างอยู่ คนที่อยู่ไกลเกินเขตส่งแล้วไม่เคยแตะการ์ดโหมดเลย จะใส่ตะกร้า
 * ในโหมดเดลิเวอรี่แล้วไปตันตอนจ่ายเงิน — เสียเวลาลูกค้าไปทั้งกระบวนการ
 *
 * ถามครั้งเดียวต่อรอบการใช้งาน (useMode.pickedThisSession) เลือกแล้วกดใบถัดไปเข้า
 * หน้าสินค้าตรง ๆ ไม่ถามซ้ำ — ด่านที่ถามทุกครั้งคือด่านที่คนเลิกใช้
 *
 * ครอบด้วย Modal ไม่ใช่ View ที่กาง absoluteFill — บทเรียนจาก Toast: absoluteFill กาง
 * เต็มกล่องแม่ที่ใกล้ที่สุด ไม่ใช่เต็มจอ พอถูกเรียกจากในแถบที่ซ้อนใน ScrollView จะโดนตัด
 */

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { BRAND_ACCENT } from '@/constants/accent';
import { ONLINE_ACCENT } from '@/constants/online';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { MODE_META, useMode, type ShopMode } from '@/store/mode';
import { checkDeliveryZone } from '@/lib/deliveryZone';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** ป้ายกับสีให้ตรงกับการ์ดโหมดบนหน้าแรกเป๊ะ — ลูกค้าต้องอ่านออกว่าเป็นของสิ่งเดียวกัน */
const LABEL: Record<ShopMode, string> = { delivery: 'Delivery', online: 'ONLINE' };
const SUB: Record<ShopMode, string> = { delivery: 'ส่งถึงบ้าน วันนี้', online: 'ส่งพัสดุทั่วไทย' };
const COLOR: Record<ShopMode, { text: string; tint: string }> = {
  delivery: { text: BRAND_ACCENT.strong, tint: BRAND_ACCENT.tint },
  online: { text: ONLINE_ACCENT.strong, tint: ONLINE_ACCENT.tint },
};

export type ModePickSheetProps = {
  /** ชื่อสินค้าที่กด — เอามาขึ้นหัวเรื่องให้รู้ว่ากำลังตอบเรื่องอะไรอยู่ */
  productName?: string;
  /** เลือกโหมดแล้ว — ผู้เรียกพาไปต่อเอง (โหมดถูกตั้งให้แล้วก่อนเรียก) */
  onPicked: () => void;
  onClose: () => void;
};

export function ModePickSheet({ productName, onPicked, onClose }: ModePickSheetProps) {
  const insets = useSafeAreaInsets();
  const setMode = useMode((s) => s.setMode);
  const modes = Object.values(MODE_META);

  const pick = (m: ShopMode) => {
    /* ★ เลือกเดลิเวอรี่ต้องผ่านด่านเขตส่งเสมอ ★ (เจ้าของทัก 6 ก.ย. 2026 "ทำไมลูกค้า
       ที่อยู่นอกพื้นที่ยังกด Delivery ได้อีก") — เดิมแผ่นนี้ตั้งโหมดแล้วพาเข้าร้านเลย
       ข้ามจอเช็คตำแหน่งซึ่งเป็นที่เดียวที่กติกาเขตส่งอยู่ ลูกค้านอกเขตจึงหยิบของเต็ม
       ตะกร้าแล้วไปเจอด่านตอนกดจ่ายเงิน
       อยู่ในเขตอยู่แล้วก็ไปต่อทันที ไม่ต้องเสียเวลาสแกนซ้ำ — ด่านโผล่เฉพาะตอนที่จำเป็น */
    if (m === 'delivery') {
      const zone = checkDeliveryZone();
      if (!zone.ok) {
        onClose();
        router.push('/delivery-check');
        return;
      }
    }
    setMode(m); // ตั้งธง pickedThisSession ให้ด้วยในตัว
    onPicked();
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.wrap}>
        <AnimatedPressable
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          accessibilityLabel="ปิด"
          onPress={onClose}
          style={styles.backdrop}
        />

        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(160)}
          exiting={FadeOut.duration(160)}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.grip} />

          <Text variant="subtitle" style={styles.title}>
            สั่งสินค้านี้แบบไหน
          </Text>
          {productName ? (
            <Text numberOfLines={1} style={styles.product}>
              {productName}
            </Text>
          ) : null}

          <View style={styles.row}>
            {modes.map((m) => {
              const c = COLOR[m.key];
              return (
                <PressableScale
                  key={m.key}
                  accessibilityRole="button"
                  accessibilityLabel={LABEL[m.key]}
                  /* โหมดที่ยังไม่เปิดใช้งานกดไม่ได้ ไม่ใช่กดแล้วเงียบ */
                  disabled={m.comingSoon}
                  onPress={() => pick(m.key)}
                  style={[styles.card, m.comingSoon && styles.cardOff]}>
                  <View style={[styles.logo, { backgroundColor: c.tint }]}>
                    <Image source={m.image} style={styles.logoImg} contentFit="contain" />
                  </View>
                  <Text style={[styles.label, { color: c.text }]}>{LABEL[m.key]}</Text>
                  <Text numberOfLines={1} style={styles.sub}>
                    {m.comingSoon ? 'เร็วๆ นี้' : SUB[m.key]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={styles.note}>เลือกแล้วเปลี่ยนทีหลังได้ที่หน้าแรก</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.scrim },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    ...Shadow.float,
  },
  // ขีดจับด้านบน บอกว่าแผ่นนี้ปิดได้ ไม่ใช่จอที่ต้องตอบให้จบ
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  title: { textAlign: 'center' },
  product: {
    textAlign: 'center',
    marginTop: 2,
    fontSize: 13,
    color: Colors.textMuted,
  },
  row: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  cardOff: { opacity: 0.45 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 40, height: 40 },
  label: { fontFamily: 'Mitr_500Medium', fontSize: 15, marginTop: 2 },
  sub: { fontSize: 12, color: Colors.textMuted },
  note: {
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
