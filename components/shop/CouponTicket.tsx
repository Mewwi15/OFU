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
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

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
  /**
   * ใบที่เก็บไปแล้ว โชว์แบบจาง ๆ พร้อมป้าย "ใช้แล้ว" (เจ้าของสั่ง 4 ก.ย. 2026)
   *
   * เป็นตัวเลือก ไม่ได้ผูกกับ claimed ตรง ๆ — แท็บคูปองเอาใบที่เก็บแล้วไปไว้กลุ่ม
   * "คูปองของฉัน" ซึ่งเป็นของที่ลูกค้าตั้งใจมาดู ทำจางทั้งกลุ่มจะกลายเป็นหน้าที่ดูตายทั้งหน้า
   * ส่วนหน้าแรกต้องการให้ใบที่เก็บแล้วถอยไปเป็นฉากหลัง เพราะของที่ควรสะดุดตาคือใบที่ยังไม่เก็บ
   */
  dimmed?: boolean;
  /**
   * ย่อขนาดลง — ใช้ในแถวคูปองบนหน้าตะกร้า (เจ้าของสั่ง 5 ก.ย. 2026 "เอา ui ของเรามา
   * ย่อขนาดก็ได้") ต้นขั้วแคบลง ตัวอักษรเล็กลง ตัดมาสคอตออก เพราะที่หน้าตะกร้าตั๋วเป็น
   * ตัวเลือกในแถวเลื่อน ไม่ใช่พระเอกของหน้าเหมือนในแท็บคูปอง
   */
  compact?: boolean;
  /** แทนที่แถวโค้ด/ปุ่มเก็บด้วยของจุดเรียกใช้ (หน้าตะกร้าใช้บอกสถานะ "ใช้อยู่") */
  footer?: ReactNode;
  /**
   * ฉีกแล้ว — ใบที่ถูกใช้ไปกับออเดอร์นี้
   *
   * สองซีกแยกออกจากกันตรงรอยปรุพร้อมเอียงเล็กน้อย + ตราปั๊ม "ใช้แล้ว" — ตั๋วจริงถูกฉีก
   * ตรงรอยปรุ ภาพนี้จึงอ่านออกทันทีโดยไม่ต้องอ่านตัวหนังสือ (เจ้าของสั่ง "มี effect
   * ฉีกการ์ดใช้แล้ว")
   */
  torn?: boolean;
  onPress: () => void;
};

export function CouponTicket({
  coupon: c,
  notchColor,
  accent = BRAND_ACCENT,
  busy = false,
  dimmed = false,
  compact = false,
  footer,
  torn = false,
  onPress,
}: CouponTicketProps) {
  const stubW = compact ? 62 : STUB_W;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={c.claimed ? `คัดลอกโค้ด ${c.code}` : `เก็บคูปอง ${c.code}`}
      disabled={busy}
      onPress={onPress}
      style={[styles.ticket, compact && styles.ticketCompact, torn && styles.ticketTorn]}>
      {/* ต้นขั้วซ้าย — ฉีกแล้วเลื่อนออกจากตัวตั๋วพร้อมเอียงนิดหน่อย */}
      <View
        style={[
          styles.stub,
          { width: stubW, backgroundColor: dimmed || torn ? Colors.textMuted : accent.solid },
          compact && styles.stubCompact,
          torn && styles.stubTorn,
        ]}>
        {/* ★ ย่อขนาดแต่ต้องเป็นใบเดียวกับที่ลูกค้ากดเก็บ ★ (เจ้าของสั่ง 5 ก.ย. 2026
            "ต้องเป็นอันเดียวกับที่เก็บได้ UI ส่วนลด ราคาอะไรต้องตรงหมด") — มาสคอตกับ
            วันหมดอายุอยู่ครบ แค่เล็กลง ไม่ใช่ตัดทิ้งจนกลายเป็นของคนละใบ */}
        <Image
          source={MASCOT_SRC}
          style={compact ? styles.stubArtCompact : styles.stubArt}
          contentFit="contain"
        />
        <Text style={[styles.stubLabel, compact && styles.stubLabelCompact]}>คูปอง</Text>
        <Text style={[styles.stubExpiry, compact && styles.stubExpiryCompact]}>
          {c.activeTo ? `หมดอายุ ${expiryLabel(c.activeTo)}` : 'ไม่มีวันหมดอายุ'}
        </Text>
      </View>

      {/* รอยปรุ + รอยบากบนล่าง */}
      <View style={[styles.perf, { left: stubW - 1 }]} pointerEvents="none">
        {PERF_DASHES.map((k) => (
          <View key={k} style={styles.perfDash} />
        ))}
      </View>
      <View
        style={[styles.notch, styles.notchTop, { left: stubW - NOTCH_R, backgroundColor: notchColor }]}
      />
      <View
        style={[styles.notch, styles.notchBottom, { left: stubW - NOTCH_R, backgroundColor: notchColor }]}
      />

      {/* ตราปั๊ม "ใช้แล้ว" — เอียงเหมือนปั๊มยางจริง ไม่ใช่ป้ายตรง ๆ */}
      {torn ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.stamp} pointerEvents="none">
          <Text style={styles.stampText}>ใช้แล้ว</Text>
        </Animated.View>
      ) : null}

      <View style={[styles.ticketBody, compact && styles.ticketBodyCompact, torn && styles.bodyTorn]}>
        <Text
          style={[
            styles.headline,
            compact && styles.headlineCompact,
            { color: dimmed || torn ? Colors.textMuted : accent.strong },
          ]}>
          {couponHeadline(c)}
        </Text>
        <Text numberOfLines={compact ? 2 : undefined} style={styles.conds}>
          {couponConditions(c).join('   ')}
        </Text>
        {footer !== undefined ? (
          <View style={styles.codeRow}>{footer}</View>
        ) : (
        <View style={styles.codeRow}>
          {/* เก็บแล้วโชว์โค้ดให้คัดลอก · ยังไม่เก็บซ่อนโค้ดไว้ก่อน ให้กดเก็บ —
              ถ้าโชว์โค้ดตั้งแต่ยังไม่เก็บ ปุ่มเก็บก็ไม่มีความหมาย ใครก็จดไปใช้ได้
              แบบจาง (หน้าแรก) ไม่โชว์โค้ด แค่ป้ายบอกสถานะ — ใบนี้ถอยไปเป็นฉากหลังแล้ว
              คนที่อยากได้โค้ดไปกดที่แท็บคูปองซึ่งเป็นที่ของมันจริง ๆ */}
          {dimmed ? (
            <View style={styles.usedPill}>
              <Ionicons name="checkmark" size={13} color={Colors.textMuted} />
              <Text style={styles.usedText}>ใช้แล้ว</Text>
            </View>
          ) : c.claimed ? (
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
        )}
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
  /* ฉีกแล้ว: สองซีกแยกออกจากกันตรงรอยปรุพร้อมเอียงคนละทาง — ตั๋วจริงถูกฉีกตรงนั้น
     ภาพนี้จึงอ่านออกทันทีโดยไม่ต้องอ่านตัวหนังสือ */
  /* ★ ต้องมีเส้นขอบตอนย่อ ★ ตั๋วเป็นการ์ดขาว แต่ในหน้าตะกร้ามันวางอยู่บนการ์ดสรุปที่ก็
     ขาวเหมือนกัน — เงาอย่างเดียวจางเกินกว่าจะเห็นขอบ ตั๋วเลยดูเหมือนข้อความลอย ๆ ไม่ใช่
     ของที่กดได้ ในแท็บคูปองไม่มีปัญหานี้เพราะพื้นหน้าเป็นเทาอ่อน */
  ticketCompact: { borderWidth: 1, borderColor: Colors.border },
  ticketTorn: { opacity: 0.75 },
  stubTorn: { transform: [{ translateX: -6 }, { rotate: '-2.5deg' }] },
  bodyTorn: { transform: [{ translateX: 6 }, { rotate: '1.5deg' }] },
  stamp: {
    position: 'absolute',
    right: 10,
    top: '38%',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: '#C9372C',
    transform: [{ rotate: '-12deg' }],
    backgroundColor: 'rgba(255,255,255,0.75)',
    zIndex: 2,
  },
  stampText: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 13,
    letterSpacing: 1,
    color: '#C9372C',
  },
  stub: {
    width: STUB_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    gap: 2,
  },
  stubCompact: { paddingVertical: Spacing.sm, paddingHorizontal: 4, gap: 1 },
  stubArt: { width: 46, height: 55 },
  stubArtCompact: { width: 26, height: 31 },
  stubLabelCompact: { fontSize: 11 },
  stubExpiryCompact: { fontSize: 8, lineHeight: 11 },
  ticketBodyCompact: { padding: Spacing.sm, gap: 1 },
  headlineCompact: { fontSize: 15 },
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
  /* ป้าย "ใช้แล้ว" — พื้นเทาอ่อนตัวหนังสือเทา ไม่ใช่ปุ่มสี ให้อ่านออกว่าเป็นสถานะ
     ไม่ใช่ของที่กดได้ */
  usedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  usedText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
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
