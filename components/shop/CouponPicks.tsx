/**
 * CouponPicks — คูปองใบใหญ่เต็มความกว้างบนหน้าแรก
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "หน้าแรกเราจะไม่โชว์สินค้าละครับ ... เอาเป็นคูปอง แบบใหญ่
 * เต็มจอเลยนะครับเหมือนภาพที่เคยให้ไป" — แทนที่แถวคูปองใบเล็กที่เลื่อนแนวนอน (CouponRail
 * เดิม) หน้าแรกไม่ได้แข่งกับสินค้าเพื่อพื้นที่แล้ว คูปองจึงกินความกว้างเต็มได้
 *
 * ใช้ตั๋วใบเดียวกับแท็บคูปอง (components/shop/CouponTicket.tsx) ไม่ได้ทำทรงใหม่ —
 * ลูกค้าเห็นคูปองใบเดียวกันสองที่ ต้องหน้าตาเหมือนกันเป๊ะ
 *
 * โชว์แค่ MAX ใบแล้วให้กด "ดูทั้งหมด" ไปแท็บคูปอง — หน้าแรกเป็นทางเข้า ไม่ใช่รายการเต็ม
 * ถ้ามีคูปอง 12 ใบแล้วเรียงหมดบนหน้าแรก แบนเนอร์ที่อยู่ถัดลงไปจะไม่มีใครเลื่อนไปเห็น
 *
 * ★ ไม่มีคูปองก็ยังยึดตำแหน่งไว้ ★ (เจ้าของสั่ง 4 ก.ย. 2026 "ตำแหน่งนั้นต้องเป็นคูปอง
 * ครับผม และด้านล่างเป็นแบรนเนอร์") — ตอนแรกทำให้ซ่อนทั้งบล็อกเมื่อไม่มีคูปอง ผลคือ
 * แบนเนอร์เลื่อนขึ้นมาแทนที่ กลายเป็นว่าใต้การ์ดโหมดเป็นแบนเนอร์ ไม่ใช่คูปอง
 * ตำแหน่งของสองบล็อกนี้ตายตัว ต่อให้ข้างในยังว่างอยู่ก็ตาม
 *
 * ดึงข้อมูลเองไม่รับผ่าน props เพราะไม่มีที่อื่นบนหน้าแรกต้องใช้คูปอง
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CouponTicket, CouponTicketSkeleton } from '@/components/shop/CouponTicket';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { BRAND_ACCENT, type Accent } from '@/constants/accent';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { claimCoupon, listCoupons, type Coupon } from '@/lib/data/coupons';

/** โชว์กี่ใบบนหน้าแรก — ที่เหลือไปดูที่แท็บคูปอง */
const MAX = 3;

export type CouponPicksProps = {
  /** สีพื้นของหน้าจอ — ตั๋วใช้วาดรอยบาก (ดูเหตุผลใน CouponTicket) */
  notchColor: string;
  /** สีเน้นของหน้า — ไม่ส่ง = สีแบรนด์ (ส้ม) */
  accent?: Accent;
};

export function CouponPicks({ notchColor, accent = BRAND_ACCENT }: CouponPicksProps) {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<{ key: number; msg: string; sub?: string } | null>(null);
  /* กันกดรัวใบเดิมซ้ำ — ฝั่งฐานข้อมูลกันด้วย unique + on conflict อยู่แล้ว แต่กันที่นี่
     ด้วยเพื่อไม่ให้ปุ่มกะพริบสถานะไปมาระหว่างรอคำตอบ */
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCoupons(await listCoupons());
    } catch {
      /* หน้าแรกไม่ควรพังเพราะคูปองโหลดไม่ได้ — ซ่อนบล็อกไปเงียบ ๆ พอ ที่แท็บคูปอง
         มีสถานะบอกความผิดพลาดให้อยู่แล้ว */
      setCoupons([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  /* โหลดใหม่ทุกครั้งที่กลับเข้าหน้าแรก ไม่แคช — คูปองมีโควตาและหมดอายุได้ ถ้าโชว์ของ
     เก่าค้างไว้ ลูกค้าจะกดเก็บแล้วไปเจอว่าใช้ไม่ได้ที่ตะกร้า */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /* เก็บแล้วกดอีกที = คัดลอกโค้ด (เหมือนแท็บคูปอง) — ใบเดียวกันต้องกดแล้วได้ผลเหมือนกัน
     ทั้งสองที่ ไม่งั้นลูกค้าต้องจำว่าอยู่หน้าไหนถึงจะคัดลอกได้ */
  const press = async (c: Coupon) => {
    if (c.claimed) {
      await Clipboard.setStringAsync(c.code);
      setToast({ key: Date.now(), msg: 'คัดลอกโค้ดแล้ว', sub: `${c.code} — วางในช่องโค้ดที่ตะกร้า` });
      return;
    }
    if (busyId) return;
    setBusyId(c.id);
    try {
      const res = await claimCoupon(c.id);
      if (res.ok) {
        /* อัปเดตในหน้าเลยไม่ต้องรอโหลดใหม่ — ใบต้องเปลี่ยนเป็น "เก็บแล้ว" ทันทีที่กด
           ไม่งั้นคนจะกดซ้ำเพราะนึกว่าไม่ติด */
        setCoupons((cur) => cur.map((x) => (x.id === c.id ? { ...x, claimed: true } : x)));
        setToast({ key: Date.now(), msg: 'เก็บคูปองแล้ว', sub: `${c.code} — เลือกใช้ได้ที่ตะกร้า` });
      } else {
        setToast({ key: Date.now(), msg: res.messageTh || 'เก็บคูปองไม่สำเร็จ' });
      }
    } catch {
      setToast({ key: Date.now(), msg: 'เก็บคูปองไม่สำเร็จ ลองใหม่อีกครั้ง' });
    } finally {
      setBusyId(null);
    }
  };

  /* เรียงใบที่ยังไม่เก็บขึ้นก่อน ใบที่เก็บแล้วไปท้ายสุด (เจ้าของสั่ง 4 ก.ย. 2026)
     ของที่ควรสะดุดตาคือใบที่ยังกดเก็บได้ ใบที่เก็บไปแล้วไม่มีอะไรให้ทำต่อบนหน้านี้
     ใช้ sort ที่คงลำดับเดิมภายในกลุ่ม (stable sort) ลำดับที่หลังร้านจัดไว้จึงไม่เพี้ยน */
  const ordered = [...coupons].sort((a, b) => Number(a.claimed) - Number(b.claimed));
  const empty = loaded && coupons.length === 0;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="subtitle">คูปองส่วนลด</Text>
        {/* โชว์ไม่ครบถึงค่อยมีปุ่มดูทั้งหมด — ถ้าโชว์ครบแล้วยังมีปุ่มอยู่ กดไปก็เจอของเดิม */}
        {coupons.length > MAX ? (
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push('/coupons')}
            hitSlop={8}>
            <Text style={[styles.seeAll, { color: accent.strong }]}>ดูทั้งหมด</Text>
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.list}>
        {empty ? (
          /* ใบเปล่าทรงเดียวกับตั๋วจริง — บอกตรง ๆ ว่าตอนนี้ยังไม่มี ดีกว่าปล่อยช่องว่าง
             ให้เดาว่าแอปพังหรือโหลดไม่ขึ้น และคนที่เคยเห็นคูปองตรงนี้จะได้รู้ว่ากลับมาดูได้ */
          <View style={[styles.emptyCard, { borderColor: accent.tint }]}>
            <Ionicons name="pricetag-outline" size={26} color={accent.strong} />
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>ยังไม่มีคูปองตอนนี้</Text>
              <Text style={styles.emptyBody}>มีโปรใหม่เมื่อไหร่จะขึ้นตรงนี้</Text>
            </View>
          </View>
        ) : null}
        {!loaded
          ? [0, 1].map((i) => <CouponTicketSkeleton key={i} accent={accent} />)
          : ordered
              .slice(0, MAX)
              .map((c) => (
                <CouponTicket
                  key={c.id}
                  coupon={c}
                  notchColor={notchColor}
                  accent={accent}
                  busy={busyId === c.id}
                  dimmed={c.claimed}
                  onPress={() => void press(c)}
                />
              ))}
      </View>

      {toast ? (
        <Toast
          key={toast.key}
          message={toast.msg}
          subtitle={toast.sub}
          actionLabel={toast.sub ? 'ไปที่ตะกร้า' : undefined}
          onAction={
            toast.sub
              ? () => {
                  setToast(null);
                  router.push('/cart');
                }
              : undefined
          }
          onHide={() => setToast(null)}
          accent={accent}
        />
      ) : null}
    </View>
  );
}

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
  },
  list: { gap: Spacing.md },
  /* เส้นประรอบใบเปล่า — สื่อว่า "ช่องนี้รอของอยู่" ไม่ใช่การ์ดจริงที่กดได้
     ที่นี่ใช้ dashed ได้เพราะกำหนดขอบครบทุกด้าน (ต่างจากเส้นปรุของตั๋วที่ต้องการ
     ด้านเดียว RN จึงวาดให้ไม่ได้) */
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: Colors.surface,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.text,
  },
  emptyBody: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
});
