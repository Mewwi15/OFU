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
 *
 * ★ โครงหน้าตามที่เจ้าของส่งตัวอย่างมา (ALL member ของ 7-Eleven) ★
 * หัวจอสีเต็มความกว้างไหลขึ้นไปถึงขอบบนจอ (ไม่มีแถบหัวข้อขาวคั่น) · ชื่อ+รูปโปรไฟล์
 * มุมขวาบน · แต้มตัวใหญ่ชิดขวา · การ์ดขาวคร่อมขอบล่างของหัวจอ ในนั้นมีคำอธิบายกับ
 * ปุ่มหลัก · เนื้อหาที่เหลือไล่ลงมาบนพื้นหน้า
 *
 * คิวอาร์ย้ายไปอยู่หลังปุ่ม "แสดงบัตร" เป็นจอเต็ม — ตัวอย่างที่เจ้าของส่งมาก็ทำแบบนี้
 * (ปุ่มสแกนกลางแถบล่าง) และมันแก้ปัญหาเดิมพอดี: คิวอาร์ที่ต้องให้เครื่องสแกนอ่านติด
 * ต้องใหญ่และสว่าง ซึ่งกินพื้นที่เกินกว่าจะแปะค้างไว้บนหน้าที่มีเนื้อหาอย่างอื่นด้วย
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';

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
import { avatarSource } from '@/lib/avatar';
import { useAuth } from '@/store/auth';

/** เว้นล่างให้พ้นแถบแท็บที่ลอยอยู่ */
const TAB_BAR_CLEARANCE = 110;
const ACCENT = GREEN_ACCENT;
/** การ์ดขาวคร่อมขอบล่างหัวจอขึ้นมากี่จุด — ใช้ทั้งระยะติดลบของการ์ดและระยะล่างของหัวจอ
 *  ผูกไว้ค่าเดียว สองที่จะได้ไม่หลุดจากกันตอนใครสักคนไปแก้ทีหลัง */
const OVERLAP = 34;

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
  const [showCard, setShowCard] = useState(false);

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

  const canScan = signedIn && !!profile.phone;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT.solid} />
        }>
        {/* ── หัวจอสีเต็มความกว้าง ไหลถึงขอบบน ──
            ไม่มีแถบหัวข้อขาวคั่นแบบหน้าอื่น — ตัวอย่างที่เจ้าของส่งมาให้สีไหลขึ้นไปชนขอบจอ
            ซึ่งทำให้หน้านี้รู้สึกเป็น "บัตร" ทั้งหน้า ไม่ใช่หน้าปกติที่มีการ์ดวางอยู่ */}
        <LinearGradient
          /* สามสต็อป ไม่ใช่สอง — เขียวเข้มกับเขียวสดของโทเคนอยู่ใกล้กันมาก ไล่สองสต็อป
             อ่านออกมาเป็นสีทึบเรียบ ไม่รู้ว่าไล่ไว้ */
          colors={[ACCENT.strong, tokens.color.brand.accentDark, ACCENT.solid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}>
          <View style={styles.heroTop}>
            <Text style={styles.brand}>OFU</Text>
            <View style={styles.who}>
              <Text numberOfLines={1} style={styles.whoName}>
                {profile.name}
              </Text>
              <Image source={avatarSource(profile.avatar)} style={styles.avatar} contentFit="cover" />
            </View>
          </View>
          <Text style={styles.brandSub}>MEMBER</Text>

          {/* แต้มชิดขวา ตัวใหญ่ที่สุดบนหน้า — เป็นสิ่งเดียวที่ลูกค้าเปิดหน้านี้มาดู */}
          <View style={styles.pointsBlock}>
            {loaded ? (
              <Text style={styles.pointsValue}>{points.toLocaleString('th-TH')}</Text>
            ) : (
              <Skeleton width={110} height={54} />
            )}
            <Text style={styles.pointsUnit}>แต้ม</Text>
          </View>
        </LinearGradient>

        {/* ── การ์ดขาวคร่อมขอบล่างของหัวจอ ──
            ระยะติดลบเท่ากับครึ่งความสูงการ์ด ให้คร่อมพอดีเหมือนตัวอย่าง */}
        <View style={styles.overlapWrap}>
          <View style={styles.overlapCard}>
            <Text numberOfLines={2} style={styles.overlapText}>
              {canScan
                ? `ซื้อครบ ${BAHT_PER_POINT} บาท ได้ 1 แต้ม\nแต้มไม่มีวันหมดอายุ`
                : signedIn
                  ? 'เพิ่มเบอร์โทรในบัญชี เพื่อรับแต้มที่หน้าร้าน'
                  : 'เข้าสู่ระบบเพื่อเริ่มสะสมแต้ม'}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="แสดงบัตรสมาชิก"
              disabled={!canScan}
              onPress={() => setShowCard(true)}
              style={[
                styles.overlapBtn,
                { backgroundColor: canScan ? ACCENT.strong : Colors.surfaceMuted },
              ]}>
              <Ionicons
                name="qr-code"
                size={16}
                color={canScan ? Colors.textOnPrimary : Colors.textMuted}
              />
              <Text
                style={[
                  styles.overlapBtnText,
                  { color: canScan ? Colors.textOnPrimary : Colors.textMuted },
                ]}>
                แสดงบัตร
              </Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.body}>
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
        </View>
      </ScrollView>

      {/* ── บัตรเต็มจอสำหรับให้พนักงานสแกน ──
          คิวอาร์ต้องใหญ่และคอนทราสต์สูงถึงจะถูกอ่านติดในร้านที่แสงไม่แน่นอน
          พื้นขาวเต็มจอช่วยดันความสว่างจอขึ้นเองด้วย (จอ OLED สว่างตามเนื้อหา) */}
      {showCard && canScan ? (
        <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => setShowCard(false)}>
          <Pressable style={styles.cardBackdrop} onPress={() => setShowCard(false)}>
            <View style={styles.bigCard}>
              <Text style={styles.bigCardName}>{profile.name}</Text>
              <Text style={styles.bigCardPhone}>{profile.phone}</Text>
              <View style={styles.bigQr}>
                <QRCode value={profile.phone} size={216} backgroundColor="transparent" />
              </View>
              <Text style={styles.bigCardHint}>ยื่นให้พนักงานสแกนก่อนจ่ายเงิน</Text>
              <Text style={styles.bigCardClose}>แตะที่ใดก็ได้เพื่อปิด</Text>
            </View>
          </Pressable>
        </Modal>
      ) : null}

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
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.x2, gap: Spacing.lg },

  /* หัวจอ — ไล่สีเต็มความกว้าง ไหลขึ้นไปถึงขอบบนจอ ไม่มีแถบหัวข้อคั่น
     ล่างสุดเผื่อไว้ให้การ์ดขาวคร่อมทับได้โดยไม่บังแต้ม */
  hero: {
    paddingHorizontal: Spacing.lg,
    /* ★ ต้องมากกว่าระยะที่การ์ดขาวคร่อมขึ้นมา (OVERLAP) ★ ไม่งั้นคำว่า "แต้ม" ที่อยู่
       ล่างสุดของหัวจอจะถูกการ์ดทับ — เจอมาแล้วตอนตั้งเท่ากันพอดี */
    paddingBottom: OVERLAP + Spacing.x2,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 1,
    color: Colors.textOnPrimary,
  },
  // "MEMBER" ซ้อนใต้ OFU ให้อ่านเป็นโลโก้สองบรรทัด ไม่ใช่ประโยค
  brandSub: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    letterSpacing: 5,
    color: 'rgba(255,255,255,0.9)',
    marginTop: -4,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  whoName: {
    flexShrink: 1,
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.textOnPrimary,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  pointsBlock: { alignItems: 'flex-end', marginTop: Spacing.x2 },
  pointsValue: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 54,
    lineHeight: 64,
    color: Colors.textOnPrimary,
  },
  pointsUnit: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: -6 },

  /* การ์ดขาวคร่อมขอบล่างหัวจอ — ระยะติดลบดันขึ้นไปทับ ต้องมี zIndex ไม่งั้นบางเครื่อง
     วาดไล่สีทับการ์ดเพราะมันมาทีหลังในลำดับ */
  overlapWrap: { paddingHorizontal: Spacing.lg, marginTop: -OVERLAP, zIndex: 1 },
  overlapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    ...Shadow.float,
  },
  overlapText: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  overlapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: Radius.pill,
  },
  overlapBtnText: { fontFamily: 'Mitr_500Medium', fontSize: 14 },

  /* บัตรเต็มจอตอนกด "แสดงบัตร" */
  cardBackdrop: {
    flex: 1,
    backgroundColor: Colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
  },
  bigCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    paddingVertical: Spacing.x2,
    paddingHorizontal: Spacing.lg,
    ...Shadow.float,
  },
  bigCardName: { fontFamily: 'Mitr_500Medium', fontSize: 18, color: Colors.text },
  bigCardPhone: { fontSize: 14, color: Colors.textMuted, marginTop: 1 },
  bigQr: { marginTop: Spacing.lg },
  bigCardHint: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 14,
    color: Colors.text,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  bigCardClose: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

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
