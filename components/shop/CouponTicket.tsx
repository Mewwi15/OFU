/**
 * CouponTicket — คูปองใบใหญ่ทรงตั๋วฉีก ใช้ทั้งแท็บคูปองและหน้าแรก
 *
 * รูปทรงตั๋ว (เจ้าของส่งหน้าคูปองของ 7-Eleven มาเป็นตัวอย่าง 4 ก.ย. 2026) — ต้นขั้ว
 * สีเน้นซ้าย + รอยปรุประกลาง + รอยบากครึ่งวงกลมบนล่าง รอยบากทำด้วยวงกลมสีพื้นหน้าจอ
 * วางคร่อมขอบการ์ด แล้วให้การ์ดครอบตัด เหลือครึ่งในเป็นรอยแหว่งพอดี — ไม่ต้องใช้ svg
 * หรือ mask ให้หนักเครื่อง
 *
 * ★ แยกออกมาเป็นคอมโพเนนต์กลางตอนหน้าแรกขอใบใหญ่ด้วย ★ (เจ้าของสั่ง 4 ก.ย. 2026
 * "เอาเป็นคูปอง แบบใหญ่เต็มจอเลยนะครับเหมือนภาพที่เคยให้ไป") — ถ้าก๊อปทรงตั๋วไปไว้อีก
 * หน้า วันหนึ่งจะแก้ที่เดียวแล้วสองหน้าไม่เหมือนกัน ทั้งที่ลูกค้าเห็นว่าเป็นของสิ่งเดียวกัน
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { BRAND_ACCENT, type Accent } from '@/constants/accent';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Coupon } from '@/lib/data/coupons';
import { money } from '@/lib/format';

const MASCOT_SRC = require('@/assets/images/mascot-tiger.png') as number;
/** ความกว้างต้นขั้ว + รัศมีรอยบาก — ใช้ทั้งวางเส้นปรุและวางรอยบากให้ตรงแนวกัน */
const STUB_W = 104;
const NOTCH_R = 9;
/* ขีดของเส้นปรุ — จำนวนคงที่ แล้วให้ space-between กระจายระยะเอง การ์ดสูงไม่เท่ากัน
   (เงื่อนไขบางใบยาวสองบรรทัด) จึงคำนวณจำนวนตามความสูงจริงไม่ได้ถ้าไม่วัดก่อน */
const PERF_DASHES = Array.from({ length: 11 }, (_, i) => i);

/** วันหมดอายุแบบสั้น เช่น "4 ก.ย. 2569" */
function expiryLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

/** พาดหัวคูปอง เช่น "ลด 10%" / "ลด ฿50" */
export function couponHeadline(c: Coupon): string {
  return c.type === 'percent' ? `ลด ${c.value}%` : `ลด ${money(c.value)}`;
}

/** เงื่อนไขย่อย — เฉพาะข้อที่มีจริง ไม่ต้องเขียน "ไม่มีขั้นต่ำ" ให้รก */
export function couponConditions(c: Coupon): string[] {
  const out: string[] = [];
  out.push(c.scope === 'delivery' ? 'ใช้ลดค่าส่ง' : 'ใช้ลดค่าสินค้า');
  if (c.minSpend > 0) out.push(`ซื้อขั้นต่ำ ${money(c.minSpend)}`);
  if (c.maxDiscount != null) out.push(`ลดสูงสุด ${money(c.maxDiscount)}`);
  if (c.activeTo) {
    const d = new Date(c.activeTo);
    if (!Number.isNaN(d.getTime())) {
      out.push(`ถึง ${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`);
    }
  }
  return out;
}

export type CouponTicketProps = {
  coupon: Coupon;
  /**
   * สีพื้นของหน้าจอที่ใบนี้ไปวางอยู่ — ใช้วาดรอยบากครึ่งวงกลม
   *
   * ต้องรับเป็น prop ไม่ใช่อ่าน Colors.background เอง เพราะแต่ละหน้าตั้งพื้นเอง
   * (แท็บคูปองเป็นขาว หน้าแรกเป็นเทาอ่อน) ส่งผิดสีเมื่อไหร่รอยบากจะกลายเป็นจุดสี
   * แปลกปลอมทันที ให้ตรงกับพื้นจริงเสมอ
   */
  notchColor: string;
  /** สีเน้นของหน้าที่ใบนี้ไปวางอยู่ — ไม่ส่ง = สีแบรนด์ (ส้ม) */
  accent?: Accent;
  /** กำลังรอผลการเก็บใบนี้ — กันกดรัว */
  busy?: boolean;
  onPress: () => void;
};

export function CouponTicket({
  coupon: c,
  notchColor,
  accent = BRAND_ACCENT,
  busy = false,
  onPress,
}: CouponTicketProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={c.claimed ? `คัดลอกโค้ด ${c.code}` : `เก็บคูปอง ${c.code}`}
      disabled={busy}
      onPress={onPress}
      style={styles.ticket}>
      {/* ต้นขั้วซ้าย — มาสคอต + วันหมดอายุ เหมือนตัวอย่างที่เจ้าของส่งมา */}
      <View style={[styles.stub, { backgroundColor: accent.solid }]}>
        <Image source={MASCOT_SRC} style={styles.stubArt} contentFit="contain" />
        <Text style={styles.stubLabel}>คูปอง</Text>
        <Text style={styles.stubExpiry}>
          {c.activeTo ? `หมดอายุ ${expiryLabel(c.activeTo)}` : 'ไม่มีวันหมดอายุ'}
        </Text>
      </View>

      {/* รอยปรุ + รอยบากบนล่าง */}
      <View style={styles.perf} pointerEvents="none">
        {PERF_DASHES.map((k) => (
          <View key={k} style={styles.perfDash} />
        ))}
      </View>
      <View style={[styles.notch, styles.notchTop, { backgroundColor: notchColor }]} />
      <View style={[styles.notch, styles.notchBottom, { backgroundColor: notchColor }]} />

      <View style={styles.ticketBody}>
        <Text style={[styles.headline, { color: accent.strong }]}>{couponHeadline(c)}</Text>
        <Text style={styles.conds}>{couponConditions(c).join(' · ')}</Text>
        <View style={styles.codeRow}>
          {/* เก็บแล้วโชว์โค้ดให้คัดลอก · ยังไม่เก็บซ่อนโค้ดไว้ก่อน ให้กดเก็บ —
              ถ้าโชว์โค้ดตั้งแต่ยังไม่เก็บ ปุ่มเก็บก็ไม่มีความหมาย ใครก็จดไปใช้ได้ */}
          {c.claimed ? (
            <>
              <Text style={styles.code}>{c.code}</Text>
              <View style={styles.copyHint}>
                <Ionicons name="copy-outline" size={13} color={accent.strong} />
                <Text style={[styles.copyText, { color: accent.strong }]}>คัดลอก</Text>
              </View>
            </>
          ) : (
            <View style={[styles.claimBtn, { backgroundColor: accent.solid }]}>
              <Ionicons name="add" size={15} color={Colors.textOnPrimary} />
              <Text style={styles.claimText}>เก็บคูปอง</Text>
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

/** โครงรอ ขนาดเท่าใบจริง ไม่ให้เนื้อหากระโดดตอนของมาถึง */
export function CouponTicketSkeleton({ accent = BRAND_ACCENT }: { accent?: Accent }) {
  return (
    <View style={styles.ticket}>
      {/* ต้นขั้วเปล่าสีจาง ไม่ต้องเต้น จะได้ไม่แย่งสายตากับแถบข้อความที่เต้นอยู่ */}
      <View style={[styles.stub, { backgroundColor: accent.tint }]} />
      <View style={styles.ticketBody}>
        <Skeleton width={110} height={20} />
        <Skeleton width={170} height={12} style={styles.skLine} />
        <Skeleton width={130} height={12} style={styles.skLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ครอบตัดไว้ เพื่อให้วงกลมรอยบากที่วางคร่อมขอบเหลือแค่ครึ่งใน = รอยแหว่ง */
  ticket: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  stub: {
    width: STUB_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    gap: 2,
  },
  stubArt: { width: 46, height: 55 },
  stubLabel: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 13,
    color: Colors.textOnPrimary,
  },
  stubExpiry: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  /* เส้นปรุ — เรียงขีดสั้น ๆ เอง ไม่ใช้ borderStyle dashed เพราะ RN วาดเส้นประ
     ด้านเดียวไม่ได้ (dashed ใช้ได้ต่อเมื่อกำหนดขอบครบทุกด้าน) ลองแบบ borderLeft
     ก่อนแล้วไม่ขึ้นเลยสักเส้น */
  perf: {
    position: 'absolute',
    left: STUB_W - 1,
    top: NOTCH_R + 2,
    bottom: NOTCH_R + 2,
    width: 2,
    justifyContent: 'space-between',
  },
  perfDash: { width: 2, height: 4, borderRadius: 1, backgroundColor: Colors.border },
  /* วงกลมสีพื้นหน้าจอ วางคร่อมขอบบน/ล่างให้โผล่เข้ามาครึ่งเดียว = รอยบากครึ่งวงกลม */
  notch: {
    position: 'absolute',
    left: STUB_W - NOTCH_R,
    width: NOTCH_R * 2,
    height: NOTCH_R * 2,
    borderRadius: NOTCH_R,
  },
  notchTop: { top: -NOTCH_R },
  notchBottom: { bottom: -NOTCH_R },
  ticketBody: { flex: 1, padding: Spacing.md, gap: 2 },
  headline: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 20,
  },
  conds: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  /* โค้ดเป็นของที่ต้องอ่านแล้วพิมพ์ตามได้ — กรอบประให้ดูเหมือนช่องโค้ด ไม่ใช่ข้อความ */
  code: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    letterSpacing: 1,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  copyHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  copyText: { fontSize: 13 },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  claimText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    color: Colors.textOnPrimary,
  },
  skLine: { marginTop: Spacing.sm },
});
