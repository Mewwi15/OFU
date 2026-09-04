/**
 * แท็บคูปอง — `/coupons`
 *
 * เจ้าของสั่ง 4 ก.ย. 2026 "หน้าสินค้าเราไม่เอาแล้วนะครับ เปลี่ยนเป็นคูปองแทน" —
 * แทนที่แท็บสินค้าใน bottom bar
 *
 * คูปองที่โชว์คือใบที่เจ้าของติ๊ก "แสดงในแอป" ในหน้าโปรโมชั่นของแอดมินเท่านั้น ไม่ใช่
 * ทุกใบที่เปิดใช้งานอยู่ — โค้ดลับ/ยิงเฉพาะรายต้องไม่หลุดมาที่นี่ (ดู 0095)
 *
 * แบ่งสองส่วน: "คูปองของฉัน" (เก็บแล้ว) กับ "เก็บเพิ่ม" (ยังไม่เก็บ) — ชื่อหน้าคือ
 * คูปองของฉัน ถ้าเอาทุกใบมากองรวมกันคำว่า "ของฉัน" จะไม่จริง
 *
 * ใบที่เก็บแล้วกดเพื่อคัดลอกโค้ดได้ (เผื่อใครถนัดพิมพ์เอง) แต่ทางหลักคือไปเลือกที่ตะกร้า
 * ซึ่งดึงใบที่เก็บไว้มาให้กดใช้ได้เลย ไม่ต้องจำโค้ด
 *
 * รูปทรงตั๋วฉีก (เจ้าของส่งหน้าคูปองของ 7-Eleven มาเป็นตัวอย่าง 4 ก.ย. 2026) — ต้นขั้ว
 * สีแบรนด์ซ้าย + รอยปรุประกลาง + รอยบากครึ่งวงกลมบนล่าง รอยบากทำด้วยวงกลมสีพื้นหน้าจอ
 * วางคร่อมขอบการ์ด แล้วให้การ์ดครอบตัด เหลือครึ่งในเป็นรอยแหว่งพอดี — วิธีนี้ไม่ต้อง
 * ใช้ svg หรือ mask ให้หนักเครื่อง แต่ผูกกับสีพื้นหน้าจอ ถ้าเปลี่ยนสีพื้นต้องเปลี่ยน
 * สีวงกลมตามด้วย ไม่งั้นรอยบากจะกลายเป็นจุดสีแปลกปลอม
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { claimCoupon, listCoupons, type Coupon } from '@/lib/data/coupons';
import { money } from '@/lib/format';

/** เว้นล่างให้พ้นแถบแท็บที่ลอยอยู่ */
const TAB_BAR_CLEARANCE = 110;
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
function headline(c: Coupon): string {
  return c.type === 'percent' ? `ลด ${c.value}%` : `ลด ${money(c.value)}`;
}

/** เงื่อนไขย่อย — เฉพาะข้อที่มีจริง ไม่ต้องเขียน "ไม่มีขั้นต่ำ" ให้รก */
function conditions(c: Coupon): string[] {
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

export default function CouponsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCoupons(await listCoupons());
      setFailed(false);
    } catch {
      /* ล้มแล้วไม่โชว์รายการเก่าค้างไว้เงียบ ๆ — คูปองหมดอายุได้ ข้อมูลเก่าหลอกลูกค้า */
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  /* โหลดใหม่ทุกครั้งที่กลับเข้าแท็บ ไม่แคช — คูปองมีโควตาจำกัดและหมดอายุได้ ถ้าโชว์
     ของเก่าค้างไว้ ลูกค้าจะกดคัดลอกแล้วไปเจอว่าใช้ไม่ได้ที่หน้าตะกร้า */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopied(code);
  };

  const claim = async (c: Coupon) => {
    if (busyId) return;
    setBusyId(c.id);
    try {
      const res = await claimCoupon(c.id);
      if (res.ok) {
        // ย้ายใบนั้นไปกลุ่ม "ของฉัน" ทันที ไม่ต้องรอโหลดใหม่ทั้งหน้า
        setCoupons((cur) => cur.map((x) => (x.id === c.id ? { ...x, claimed: true } : x)));
      }
    } catch {
      /* เงียบไว้ — ปุ่มยังกดใหม่ได้ และดึงหน้าจอลงรีเฟรชได้ */
    } finally {
      setBusyId(null);
    }
  };

  const mine = coupons.filter((c) => c.claimed);
  const more = coupons.filter((c) => !c.claimed);

  /* การ์ดใบเดียว ใช้ซ้ำทั้งสองกลุ่ม — ต่างกันแค่ปุ่มท้ายใบ: เก็บแล้วให้คัดลอกโค้ด
     ยังไม่เก็บให้กดเก็บ */
  const renderTicket = (c: Coupon) => (
    <PressableScale
      key={c.id}
      accessibilityRole="button"
      accessibilityLabel={c.claimed ? `คัดลอกโค้ด ${c.code}` : `เก็บคูปอง ${c.code}`}
      disabled={busyId === c.id}
      onPress={() => (c.claimed ? void copy(c.code) : void claim(c))}
      style={styles.ticket}>
              {/* ต้นขั้วซ้าย — มาสคอต + วันหมดอายุ เหมือนตัวอย่างที่เจ้าของส่งมา */}
              <View style={styles.stub}>
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
              <View style={[styles.notch, styles.notchTop]} />
              <View style={[styles.notch, styles.notchBottom]} />

              <View style={styles.ticketBody}>
                <Text style={styles.headline}>{headline(c)}</Text>
                <Text style={styles.conds}>{conditions(c).join(' · ')}</Text>
                <View style={styles.codeRow}>
                  {/* เก็บแล้วโชว์โค้ดให้คัดลอก · ยังไม่เก็บซ่อนโค้ดไว้ก่อน ให้กดเก็บ —
                      ถ้าโชว์โค้ดตั้งแต่ยังไม่เก็บ ปุ่มเก็บก็ไม่มีความหมาย ใครก็จดไปใช้ได้ */}
                  {c.claimed ? (
                    <>
                      <Text style={styles.code}>{c.code}</Text>
                      <View style={styles.copyHint}>
                        <Ionicons name="copy-outline" size={13} color={Colors.primaryStrong} />
                        <Text style={styles.copyText}>คัดลอก</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.claimBtn}>
                      <Ionicons name="add" size={15} color={Colors.textOnPrimary} />
                      <Text style={styles.claimText}>เก็บคูปอง</Text>
                    </View>
                  )}
                </View>
              </View>
    </PressableScale>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      {/* ScreenHeader ไม่เว้นขอบบนให้เอง หน้าจอต้องเว้น insets.top เอง (ทำเหมือน
          หน้าคำสั่งซื้อ) — ไม่งั้นหัวข้อจะไปมุดใต้แถบสถานะจนมองไม่เห็น */}
      <ScreenHeader title="คูปองของฉัน" style={styles.header} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }>
        {!loaded ? (
          /* โครงรอ ขนาดเท่าใบจริง ไม่ให้เนื้อหากระโดดตอนของมาถึง */
          <>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.ticket}>
                <View style={[styles.stub, styles.stubLoading]} />
                <View style={styles.ticketBody}>
                  <Skeleton width={110} height={20} />
                  <Skeleton width={170} height={12} style={styles.skLine} />
                  <Skeleton width={130} height={12} style={styles.skLine} />
                </View>
              </View>
            ))}
          </>
        ) : failed ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cloud-offline-outline" size={38} color={Colors.primary} />
            </View>
            <Text variant="subtitle" style={styles.emptyTitle}>
              โหลดคูปองไม่สำเร็จ
            </Text>
            <Text style={styles.emptyBody}>ดึงหน้าจอลงเพื่อลองใหม่</Text>
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="pricetag-outline" size={38} color={Colors.primary} />
            </View>
            <Text variant="subtitle" style={styles.emptyTitle}>
              ยังไม่มีคูปองตอนนี้
            </Text>
            <Text style={styles.emptyBody}>มีโปรใหม่เมื่อไหร่จะขึ้นตรงนี้ กลับมาดูได้เรื่อย ๆ</Text>
          </View>
        ) : (
          <>
            {mine.length > 0 ? (
              <Text variant="subtitle" style={styles.groupHead}>
                คูปองของฉัน ({mine.length})
              </Text>
            ) : null}
            {mine.map((c) => renderTicket(c))}

            {more.length > 0 ? (
              <Text variant="subtitle" style={styles.groupHead}>
                เก็บเพิ่มได้
              </Text>
            ) : null}
            {more.map((c) => renderTicket(c))}
          </>
        )}
      </ScrollView>

      {copied ? (
        <Toast
          key={copied}
          message="คัดลอกโค้ดแล้ว"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    gap: 2,
  },
  // โครงรอ: ต้นขั้วเปล่าสีจาง ไม่ต้องเต้น จะได้ไม่แย่งสายตากับแถบข้อความที่เต้นอยู่
  stubLoading: { backgroundColor: Colors.primaryTint },
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
  /* วงกลมสีพื้นหน้าจอ วางคร่อมขอบบน/ล่างให้โผล่เข้ามาครึ่งเดียว = รอยบากครึ่งวงกลม
     ผูกกับ Colors.background ของหน้านี้ ถ้าเปลี่ยนสีพื้นต้องเปลี่ยนตามด้วย */
  notch: {
    position: 'absolute',
    left: STUB_W - NOTCH_R,
    width: NOTCH_R * 2,
    height: NOTCH_R * 2,
    borderRadius: NOTCH_R,
    backgroundColor: Colors.background,
  },
  notchTop: { top: -NOTCH_R },
  notchBottom: { bottom: -NOTCH_R },
  ticketBody: { flex: 1, padding: Spacing.md, gap: 2 },
  headline: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 20,
    color: Colors.primaryStrong,
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
  copyText: { fontSize: 13, color: Colors.primaryStrong },
  skLine: { marginTop: Spacing.sm },
  /* หัวกลุ่ม — เว้นบนมากกว่าระยะห่างระหว่างใบ (gap ของ body) ให้เห็นว่าขึ้นกลุ่มใหม่
     ไม่ใช่แค่ใบถัดไป */
  groupHead: { marginTop: Spacing.sm },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  claimText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    color: Colors.textOnPrimary,
  },
  empty: { alignItems: 'center', paddingTop: Spacing.x3 * 2 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: Spacing.lg },
  emptyBody: {
    marginTop: Spacing.xs,
    textAlign: 'center',
    color: Colors.textMuted,
  },
});
