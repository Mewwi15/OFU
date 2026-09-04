/**
 * CouponRail — แถวคูปองเลื่อนแนวนอนบนหน้าแรก
 *
 * เจ้าของสั่ง 4 ก.ย. 2026 "ตรงหน้าแรก ตรงสินค้าขายดีอะครับเอาออกไปและเป็นคูปองแทนครับ
 * เลื่อนไปทางขวาให้ลูกค้าเก็บ" — แทนที่แถว "ขายดี" เดิม
 *
 * "เก็บ" ในที่นี้ = คัดลอกโค้ดไปวางที่ตะกร้า ไม่ใช่การผูกคูปองเข้าบัญชี เพราะระบบ
 * ส่วนลดของร้านเป็นแบบ "พิมพ์โค้ดตอนจ่ายเงิน" มาตั้งแต่ต้น (promo_codes + validate_promo)
 * ไม่มีตารางเก็บคูปองรายคน การทำปุ่มที่บอกว่า "เก็บแล้ว" โดยไม่มีที่เก็บจริงจะเป็น
 * คำสัญญาลอย ๆ — คูปองทุกใบยังหาเจอได้ตลอดที่แท็บคูปอง ตรงนั้นทำหน้าที่ "ที่เก็บ" อยู่แล้ว
 * (ถ้าอยากได้ระบบเก็บเข้าบัญชีจริง ต้องมีตารางใหม่ + RPC — คนละงาน)
 *
 * ดึงข้อมูลเองไม่รับผ่าน props เพราะไม่มีที่อื่นบนหน้าแรกต้องใช้คูปอง — และถ้าไม่มี
 * คูปองเลยจะซ่อนทั้งแถว ไม่ทิ้งหัวข้อว่างไว้ให้เก้อ
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { listCoupons, type Coupon } from '@/lib/data/coupons';
import { money } from '@/lib/format';

const CARD_W = 190;
const NOTCH_R = 8;
/** เส้นปรุร่นเข้าจากขอบการ์ดเท่าไหร่ — เว้นที่ให้รอยบากไม่ทับขีดแรก/ขีดสุดท้าย */
const PERF_INSET = NOTCH_R + 2;

function headline(c: Coupon): string {
  return c.type === 'percent' ? `ลด ${c.value}%` : `ลด ${money(c.value)}`;
}

/** เงื่อนไขบรรทัดเดียว — การ์ดแคบ ใส่ได้ข้อเดียวจริง ๆ เอาข้อที่กันเซอร์ไพรส์ที่สุด */
function condition(c: Coupon): string {
  if (c.minSpend > 0) return `ซื้อขั้นต่ำ ${money(c.minSpend)}`;
  return c.scope === 'delivery' ? 'ใช้ลดค่าส่ง' : 'ไม่มียอดขั้นต่ำ';
}

export type CouponRailProps = {
  /**
   * สีพื้นของหน้าจอที่แถวนี้ไปวางอยู่ — ใช้วาดรอยบากครึ่งวงกลม
   *
   * ต้องรับเป็น prop ไม่ใช่อ่าน Colors.background เอง เพราะ Colors.background เป็น
   * สีขาว แต่หน้าแรกตั้งพื้นเป็นเทาอ่อนของตัวเอง (ยังไม่ได้ย้ายเข้าโทเคนกลาง) —
   * ตอนแรกใช้ Colors.background แล้วรอยบากหายสนิท เพราะกลายเป็นวงกลมขาวบนการ์ดขาว
   * ส่งผิดสีเมื่อไหร่รอยบากจะกลายเป็นจุดสีแปลกปลอมทันที ให้ตรงกับพื้นจริงเสมอ
   */
  notchColor: string;
};

export function CouponRail({ notchColor }: CouponRailProps) {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCoupons(await listCoupons());
    } catch {
      /* หน้าแรกไม่ควรพังเพราะคูปองโหลดไม่ได้ — ซ่อนแถวไปเงียบ ๆ พอ ที่แท็บคูปอง
         มีสถานะบอกความผิดพลาดให้อยู่แล้ว */
      setCoupons([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const collect = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopied(code);
  };

  // ไม่มีคูปอง = ไม่มีแถวนี้เลย ดีกว่าโชว์หัวข้อแล้วว่างข้างล่าง
  if (loaded && coupons.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="subtitle">คูปองส่วนลด</Text>
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.push('/coupons')}
          hitSlop={8}>
          <Text style={styles.seeAll}>ดูทั้งหมด</Text>
        </PressableScale>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={loaded}
        contentContainerStyle={styles.row}>
        {!loaded
          ? [0, 1, 2].map((i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardTop}>
                  <Skeleton width={90} height={20} />
                  <Skeleton width={120} height={12} style={styles.skLine} />
                </View>
              </View>
            ))
          : coupons.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.headline}>{headline(c)}</Text>
                  <Text numberOfLines={1} style={styles.cond}>
                    {condition(c)}
                  </Text>
                </View>

                {/* รอยปรุแนวนอน + รอยบากซ้ายขวา — ภาษาเดียวกับตั๋วในแท็บคูปอง แค่หมุน
                    เป็นแนวนอนเพราะการ์ดนี้เป็นทรงตั้ง ไม่ใช่ทรงนอน */}
                <View style={styles.perf} pointerEvents="none">
                  {DASHES.map((k) => (
                    <View key={k} style={styles.dash} />
                  ))}
                  {/* รอยบากอยู่ ข้างใน แถวเส้นปรุ ไม่ได้วางเทียบกับการ์ด — ความสูงส่วนบน
                      การ์ดเปลี่ยนได้ตามความยาวข้อความ ถ้าวางเทียบการ์ดด้วยตัวเลขคงที่
                      รอยบากจะหลุดจากแนวเส้น (เจอมาแล้ว เยื้องไป 10) อยู่ในแถวแล้วมันตาม
                      เส้นเองเสมอไม่ว่าส่วนบนจะสูงเท่าไหร่ */}
                  <View style={[styles.notch, styles.notchLeft, { backgroundColor: notchColor }]} />
                  <View style={[styles.notch, styles.notchRight, { backgroundColor: notchColor }]} />
                </View>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`เก็บโค้ด ${c.code}`}
                  onPress={() => void collect(c.code)}
                  style={styles.collectBtn}>
                  <Ionicons name="copy-outline" size={14} color={Colors.textOnPrimary} />
                  <Text style={styles.collectText}>เก็บโค้ด</Text>
                </PressableScale>
              </View>
            ))}
      </ScrollView>

      {copied ? (
        <Toast
          key={copied}
          message="เก็บโค้ดแล้ว"
          subtitle={`${copied} — วางในช่องโค้ดส่วนลดที่ตะกร้า`}
          actionLabel="ไปที่ตะกร้า"
          onAction={() => {
            setCopied(null);
            router.push('/cart');
          }}
          onHide={() => setCopied(null)}
        />
      ) : null}
    </View>
  );
}

const DASHES = Array.from({ length: 9 }, (_, i) => i);

const styles = StyleSheet.create({
  section: { marginTop: Spacing.lg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  seeAll: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 13,
    color: Colors.primaryStrong,
  },
  row: { gap: Spacing.md, paddingRight: Spacing.lg },
  /* ครอบตัดเพื่อให้วงกลมรอยบากที่คร่อมขอบเหลือแค่ครึ่งใน = รอยแหว่ง */
  card: {
    width: CARD_W,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  cardTop: { padding: Spacing.md, gap: 2 },
  headline: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 20,
    color: Colors.primaryStrong,
  },
  cond: { fontSize: 12, color: Colors.textMuted },
  /* เส้นปรุเรียงขีดเอง ไม่ใช้ borderStyle dashed — RN วาดเส้นประด้านเดียวไม่ได้
     (ต้องกำหนดขอบครบทุกด้าน) เจอมาแล้วตอนทำตั๋วในแท็บคูปอง */
  perf: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 2,
    marginHorizontal: PERF_INSET,
  },
  dash: { width: 4, height: 2, borderRadius: 1, backgroundColor: Colors.border },
  /* วงกลมคร่อมขอบซ้าย/ขวาของการ์ด ให้ศูนย์กลางอยู่ที่แนวเส้นปรุ สีมาจาก prop
     notchColor (ดูคำอธิบายที่นั่น) — วางเทียบกับแถวเส้นปรุ ไม่ใช่เทียบการ์ด
     แถวเส้นปรุสูง 2 (เท่าขีด) ศูนย์กลางจึงอยู่ที่ 1 → top = 1 - รัศมี
     แนวนอน: แถวเส้นปรุร่นเข้ามาจากขอบการ์ด PERF_INSET จึงต้องถอยออกไปเท่านั้นบวกรัศมี
     เพื่อให้ศูนย์กลางวงกลมตกที่ขอบการ์ดพอดี */
  notch: {
    position: 'absolute',
    top: 1 - NOTCH_R,
    width: NOTCH_R * 2,
    height: NOTCH_R * 2,
    borderRadius: NOTCH_R,
  },
  notchLeft: { left: -(PERF_INSET + NOTCH_R) },
  notchRight: { right: -(PERF_INSET + NOTCH_R) },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    margin: Spacing.md,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  collectText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 14,
    color: Colors.textOnPrimary,
  },
  skLine: { marginTop: Spacing.sm },
});
