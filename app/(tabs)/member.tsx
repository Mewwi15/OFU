/**
 * OFU MEMBER — `/member` (แท็บที่มาแทนตะกร้า)
 *
 * เจ้าของสั่ง 4 ก.ย. 2026: "อยากเอาหน้าตะกร้าสินค้าออกใช้เป็น OFU MEMBER แทน" และ
 * "สะสมแต้มแลกเสื้อ แลกของ" · อัตรา 100 บาท = 1 แต้ม
 *
 * ★ แต้มได้ทั้งสองช่องทาง ★ ซื้อในแอป (ได้ตอนของส่งถึงแล้ว) และซื้อหน้าร้าน (แคชเชียร์
 * ถามเบอร์ก่อนปิดบิล) — หน้านี้จึงโชว์เบอร์กับคิวอาร์ตัวใหญ่ ๆ ให้ยื่นที่เคาน์เตอร์ได้เลย
 * ไม่ต้องอ่านเบอร์ให้ฟังในร้านที่เสียงดัง
 *
 * คิวอาร์เข้ารหัสเป็น "เบอร์โทร" ไม่ใช่ id ผู้ใช้ — POS มีช่องค้นลูกค้าจากเบอร์อยู่แล้ว
 * (findCustomerByPhone) แคชเชียร์สแกนแล้วได้เบอร์ไปวางในช่องเดิมได้ทันที ไม่ต้องรอ
 * ให้ POS รองรับรูปแบบใหม่ก่อนถึงจะใช้งานได้จริง
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { GREEN_ACCENT } from '@/constants/accent';
import { Colors, Radius, Shadow, Spacing, tokens } from '@/constants/theme';
import {
  BAHT_PER_POINT,
  listMyRedemptions,
  listPointsHistory,
  listRewards,
  myPoints,
  redeemReward,
  type PointsEntry,
  type Redemption,
  type Reward,
} from '@/lib/data/member';
import { useAuth } from '@/store/auth';

/** เว้นล่างให้พ้นแถบแท็บที่ลอยอยู่ */
const TAB_BAR_CLEARANCE = 110;
const ACCENT = GREEN_ACCENT;

const thDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export default function MemberScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAuth((s) => s.user);
  const signedIn = useAuth((s) => s.status === 'authenticated');

  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<PointsEntry[]>([]);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; msg: string; sub?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      /* ยิงพร้อมกันทั้งสี่ ไม่ต่อคิว — ไม่มีอันไหนต้องใช้ผลของอีกอัน และหน้านี้เปิดจาก
         แท็บล่าง ต้องขึ้นให้ไวที่สุด */
      const [p, r, h, m] = await Promise.all([
        myPoints(),
        listRewards(),
        listPointsHistory(),
        listMyRedemptions(),
      ]);
      setPoints(p);
      setRewards(r);
      setHistory(h);
      setMine(m);
    } catch {
      /* โหลดไม่ได้ก็ยังโชว์บัตรสมาชิกกับคิวอาร์ได้ — ส่วนนั้นไม่ต้องพึ่งเน็ต และเป็นสิ่งที่
         ลูกค้าเปิดหน้านี้มาใช้บ่อยที่สุดตอนยืนอยู่หน้าเคาน์เตอร์ */
    } finally {
      setLoaded(true);
    }
  }, []);

  /* โหลดใหม่ทุกครั้งที่กลับเข้าแท็บ — แต้มขยับได้จากฝั่งหน้าร้านโดยที่แอปไม่รู้ตัว
     ลูกค้าเพิ่งจ่ายเงินเสร็จแล้วเปิดดูทันที ต้องเห็นแต้มใหม่ ไม่ใช่ค่าที่แคชไว้ */
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

  const redeem = async (r: Reward) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      const res = await redeemReward(r.id);
      if (res.ok) {
        setToast({
          key: Date.now(),
          msg: 'แลกสำเร็จ',
          sub: `โค้ด ${res.code} — ยื่นโค้ดนี้ที่ร้านเพื่อรับของ`,
        });
        await load();
      } else {
        setToast({ key: Date.now(), msg: res.messageTh });
      }
    } catch {
      setToast({ key: Date.now(), msg: 'แลกไม่สำเร็จ ลองใหม่อีกครั้ง' });
    } finally {
      setBusyId(null);
    }
  };

  const pending = mine.filter((m) => m.status === 'pending');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.sm }]}>
      {/* ScreenHeader ไม่เว้นขอบบนให้เอง หน้าจอต้องเว้น insets.top เอง */}
      <ScreenHeader title="OFU MEMBER" style={styles.header} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT.solid} />
        }>
        {/* ── บัตรสมาชิก ──
            ★ เป็น "บัตร" จริง ๆ ไม่ใช่กล่องสีเขียว ★ ไล่สี + มาสคอตเป็นลายน้ำล้นขอบขวา +
            คิวอาร์อยู่บนบัตรเลย เพราะของสองอย่างนี้ถูกใช้พร้อมกันเสมอ (ยื่นบัตรให้สแกน)
            เวอร์ชันแรกแยกคิวอาร์เป็นกล่องขาวใหญ่ต่างหาก กินพื้นที่ครึ่งจอโดยที่บัตรก็ยัง
            ว่างอยู่ครึ่งใบ (เจ้าของตีกลับ "design ไม่สวย") */}
        <View style={styles.card}>
          <LinearGradient
            /* สามสต็อป ไม่ใช่สองstop — เขียวเข้มกับเขียวสดของโทเคนอยู่ใกล้กันมาก
               ไล่สองสต็อปเลยอ่านออกมาเป็นสีทึบเรียบ ๆ ไม่รู้ว่าไล่ไว้ */
            colors={[ACCENT.strong, tokens.color.brand.accentDark, ACCENT.solid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.cardBrand}>OFU MEMBER</Text>

          <View style={[styles.cardBody, styles.cardBodyTop]}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardName} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={styles.cardPhone}>{profile.phone || 'ยังไม่ได้ผูกเบอร์โทร'}</Text>

              <View style={styles.pointsRow}>
                {loaded ? (
                  <Text style={styles.pointsValue}>{points.toLocaleString('th-TH')}</Text>
                ) : (
                  <Skeleton width={72} height={38} />
                )}
                <Text style={styles.pointsUnit}>แต้ม</Text>
              </View>
            </View>

            {/* คิวอาร์บนแผ่นขาว — ต้องมีพื้นขาวรองเสมอ เครื่องสแกนอ่านคิวอาร์บนพื้นสีไม่ติด */}
            {signedIn && profile.phone ? (
              <View style={styles.qrTile}>
                <QRCode value={profile.phone} size={82} backgroundColor="transparent" />
              </View>
            ) : (
              <View style={[styles.qrTile, styles.qrTileEmpty]}>
                <Ionicons name="qr-code-outline" size={34} color={Colors.textMuted} />
              </View>
            )}
          </View>

          <View style={styles.cardFoot}>
            <Ionicons name="sparkles" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.rate}>
              {signedIn && profile.phone
                ? `ซื้อครบ ${BAHT_PER_POINT} บาท ได้ 1 แต้ม · ยื่นบัตรให้พนักงานสแกน`
                : signedIn
                  ? `เพิ่มเบอร์โทรในบัญชี แล้วคิวอาร์จะขึ้นบนบัตร`
                  : 'เข้าสู่ระบบเพื่อเริ่มสะสมแต้ม'}
            </Text>
          </View>
        </View>

        {/* ── โค้ดที่รอไปรับของ ── */}
        {pending.length > 0 ? (
          <View style={styles.section}>
            <Text variant="subtitle">รอรับของที่ร้าน</Text>
            {pending.map((m) => (
              <View key={m.id} style={styles.pendingRow}>
                <View style={styles.pendingCode}>
                  <Text style={styles.pendingCodeText}>{m.code}</Text>
                </View>
                <View style={styles.pendingCopy}>
                  <Text numberOfLines={1} style={styles.pendingName}>
                    {m.rewardName}
                  </Text>
                  <Text style={styles.pendingDate}>แลกเมื่อ {thDate(m.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── ของแลก ── */}
        <View style={styles.section}>
          <Text variant="subtitle">แลกของรางวัล</Text>
          {!loaded ? (
            [0, 1].map((i) => <Skeleton key={i} width={280} height={84} style={styles.skRow} />)
          ) : rewards.length === 0 ? (
            <View style={[styles.empty, { borderColor: ACCENT.tint }]}>
              <View style={[styles.emptyIcon, { backgroundColor: ACCENT.tint }]}>
                <Ionicons name="gift" size={22} color={ACCENT.strong} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>ยังไม่มีของรางวัลตอนนี้</Text>
                <Text style={styles.emptyText}>สะสมแต้มรอไว้ได้เลย มีของใหม่จะขึ้นตรงนี้</Text>
              </View>
            </View>
          ) : (
            rewards.map((r) => {
              const soldOut = r.stock != null && r.stock <= 0;
              const enough = points >= r.pointsCost;
              return (
                <View key={r.id} style={styles.reward}>
                  {r.image ? (
                    <Image source={{ uri: r.image }} style={styles.rewardArt} contentFit="cover" />
                  ) : (
                    <View style={[styles.rewardArt, styles.rewardArtEmpty]}>
                      <Ionicons name="gift" size={22} color={ACCENT.strong} />
                    </View>
                  )}
                  <View style={styles.rewardCopy}>
                    <Text numberOfLines={1} style={styles.rewardName}>
                      {r.name}
                    </Text>
                    {r.description ? (
                      <Text numberOfLines={1} style={styles.rewardDesc}>
                        {r.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.rewardCost, { color: ACCENT.strong }]}>
                      {r.pointsCost.toLocaleString('th-TH')} แต้ม
                      {r.stock != null ? ` · เหลือ ${r.stock}` : ''}
                    </Text>
                  </View>
                  {/* กดไม่ได้ต้องดูออกว่ากดไม่ได้ ไม่ใช่กดแล้วเงียบ */}
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`แลก ${r.name}`}
                    disabled={soldOut || !enough || busyId === r.id || !signedIn}
                    onPress={() => void redeem(r)}
                    style={[
                      styles.redeemBtn,
                      { backgroundColor: soldOut || !enough ? Colors.surfaceMuted : ACCENT.solid },
                    ]}>
                    <Text
                      style={[
                        styles.redeemText,
                        { color: soldOut || !enough ? Colors.textMuted : Colors.textOnPrimary },
                      ]}>
                      {soldOut ? 'หมด' : enough ? 'แลก' : 'แต้มไม่พอ'}
                    </Text>
                  </PressableScale>
                </View>
              );
            })
          )}
        </View>

        {/* ── ประวัติแต้ม ── */}
        {history.length > 0 ? (
          <View style={styles.section}>
            <Text variant="subtitle">ประวัติแต้ม</Text>
            {history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Text numberOfLines={1} style={styles.historyReason}>
                    {h.reason}
                  </Text>
                  <Text style={styles.historyDate}>{thDate(h.createdAt)}</Text>
                </View>
                <Text
                  style={[
                    styles.historyDelta,
                    { color: h.delta > 0 ? ACCENT.strong : Colors.textMuted },
                  ]}>
                  {h.delta > 0 ? `+${h.delta}` : h.delta}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {toast ? (
        <Toast
          key={toast.key}
          message={toast.msg}
          subtitle={toast.sub}
          accent={ACCENT}
          onHide={() => setToast(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.lg },

  /* บัตรสมาชิก — ไล่สีเขียว มุมโค้งลึก ครอบตัดให้มาสคอตที่ล้นขอบถูกตัดพอดีขอบบัตร */
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.float,
  },
  // ชื่อแบรนด์บนบัตร — ตัวเล็ก เว้นระยะตัวอักษร ให้อ่านเป็นบัตรจริงไม่ใช่กล่องข้อความ
  cardBrand: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.85)',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cardLeft: { flex: 1 },
  cardName: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 18,
    color: Colors.textOnPrimary,
  },
  cardPhone: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: Spacing.md },
  pointsValue: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 46,
    lineHeight: 56,
    color: Colors.textOnPrimary,
  },
  pointsUnit: { fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  /* แผ่นขาวรองคิวอาร์ — ต้องขาวเสมอ เครื่องสแกนอ่านคิวอาร์บนพื้นสีไม่ติด */
  qrTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTileEmpty: { width: 98, height: 98, backgroundColor: 'rgba(255,255,255,0.75)' },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: Spacing.lg,
    paddingTop: Spacing.sm,
    // เส้นคั่นจาง ๆ แยกบรรทัดกติกาออกจากตัวเลข ไม่ให้อ่านปนกัน
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  rate: { flex: 1, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.9)' },
  // คิวอาร์ชิดบนให้ตรงแนวกับชื่อ ไม่ใช่ลอยกลางบัตร
  cardBodyTop: { alignItems: 'flex-start' },

  section: { gap: Spacing.sm },
  skRow: { borderRadius: Radius.lg },

  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  /* โค้ดเป็นของที่ต้องอ่านให้พนักงานฟังได้ — กรอบประให้ดูเหมือนช่องโค้ด ไม่ใช่ข้อความ */
  pendingCode: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  pendingCodeText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    letterSpacing: 1,
    color: Colors.text,
  },
  pendingCopy: { flex: 1 },
  pendingName: { fontFamily: 'Mitr_500Medium', fontSize: 14, color: Colors.text },
  pendingDate: { fontSize: 12, color: Colors.textMuted },

  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  rewardArt: { width: 56, height: 56, borderRadius: Radius.md },
  rewardArtEmpty: {
    backgroundColor: ACCENT.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCopy: { flex: 1, gap: 1 },
  rewardName: { fontFamily: 'Mitr_500Medium', fontSize: 15, color: Colors.text },
  rewardDesc: { fontSize: 12, color: Colors.textMuted },
  rewardCost: { fontFamily: 'Mitr_500Medium', fontSize: 13 },
  redeemBtn: {
    paddingHorizontal: Spacing.md,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemText: { fontFamily: 'Mitr_500Medium', fontSize: 13 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  historyCopy: { flex: 1 },
  historyReason: { fontSize: 14, color: Colors.text },
  historyDate: { fontSize: 12, color: Colors.textMuted },
  historyDelta: { fontFamily: 'Mitr_600SemiBold', fontSize: 15 },

  /* เส้นประ = ช่องนี้รอของอยู่ ไม่ใช่การ์ดจริงที่กดได้ (ภาษาเดียวกับบล็อกคูปองหน้าแรก) */
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: Colors.surface,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontFamily: 'Mitr_500Medium', fontSize: 15, color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
});
