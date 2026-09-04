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
 * รูปทรงตั๋วฉีกอยู่ที่ components/shop/CouponTicket.tsx — หน้าแรกใช้ใบเดียวกัน
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CouponTicket, CouponTicketSkeleton } from '@/components/shop/CouponTicket';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Spacing } from '@/constants/theme';
import { claimCoupon, listCoupons, type Coupon } from '@/lib/data/coupons';

/** เว้นล่างให้พ้นแถบแท็บที่ลอยอยู่ */
const TAB_BAR_CLEARANCE = 110;

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
    <CouponTicket
      key={c.id}
      coupon={c}
      notchColor={Colors.background}
      busy={busyId === c.id}
      onPress={() => (c.claimed ? void copy(c.code) : void claim(c))}
    />
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
              <CouponTicketSkeleton key={i} />
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
  /* หัวกลุ่ม — เว้นบนมากกว่าระยะห่างระหว่างใบ (gap ของ body) ให้เห็นว่าขึ้นกลุ่มใหม่
     ไม่ใช่แค่ใบถัดไป */
  groupHead: { marginTop: Spacing.sm },
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
