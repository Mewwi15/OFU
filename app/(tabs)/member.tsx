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
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
  WELCOME_POINTS,
  joinMembership,
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

/* มาสคอตถือบัตรสมาชิก (เจ้าของส่งมา 6 ก.ย. 2026) — ใช้ในการ์ดชวนสมัคร */
const MEMBER_MASCOT = require('@/assets/images/mascot-member.png') as number;

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
  /* ฟอร์มสมัครสมาชิก — โผล่เฉพาะคนที่ยังไม่มีเบอร์ผูกกับบัญชี */
  const [joinPhone, setJoinPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);

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

  const joinDigits = joinPhone.replace(/\D/g, '');
  const joinValid = /^0[689]\d{8}$/.test(joinDigits);

  const join = async () => {
    if (!joinValid || joining) return;
    setJoining(true);
    setJoinErr(null);
    try {
      const res = await joinMembership(joinDigits);
      if (!res.ok) {
        setJoinErr(
          res.reason === 'PHONE_TAKEN'
            ? 'เบอร์นี้ถูกใช้กับอีกบัญชีแล้ว — เข้าด้วยบัญชีนั้นได้เลย'
            : res.reason === 'BAD_PHONE'
              ? 'เบอร์ไม่ถูกต้อง ลองตรวจดูอีกที'
              : 'สมัครไม่สำเร็จ ลองใหม่อีกครั้ง',
        );
        return;
      }
      setPoints(res.points);
      /* อัปเดตโปรไฟล์ในเครื่องด้วย — ทั้งหน้าดูที่ profile.phone เพื่อรู้ว่าเป็นสมาชิกแล้ว
         ถ้าไม่รีเฟรช การ์ดชวนสมัครจะค้างอยู่ทั้งที่สมัครสำเร็จไปแล้ว */
      await useAuth.getState().refreshProfile();
      setToast({
        key: Date.now(),
        msg: res.awarded ? `รับ ${WELCOME_POINTS} แต้มแล้ว` : 'ผูกเบอร์กับบัญชีแล้ว',
        sub: res.awarded ? 'ยินดีต้อนรับสู่ OFU MEMBER' : undefined,
      });
      void load();
    } catch {
      setJoinErr('สมัครไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setJoining(false);
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
        <View style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}>
          {/* ลายพื้นหลัง — ไอคอนของร้านซ้ำ ๆ จาง ๆ (เจ้าของทำภาพมาให้ 4 ก.ย. 2026)
              วางเป็นชั้นล่างสุด ไล่สีทับข้างบนแบบโปร่ง เพื่อให้ได้ทั้งลายและมิติของแสง
              ★ ถ้าเอาไล่สีไว้ล่างแล้วเอาลายทับ ★ ลายมีพื้นเขียวทึบของตัวเอง จะกลบไล่สี
              จนหายหมด ต้องเรียงแบบนี้เท่านั้น */}
          <Image
            /* .jpg ไม่ใช่ .png — ลายนี้เป็นภาพไล่เฉดนุ่ม ๆ ทึบทั้งใบ ไม่มีส่วนโปร่ง
               PNG เก็บได้ 1.3 MB ส่วน JPEG คุณภาพ 82 เหลือ 90 KB (เล็กลง 14 เท่า)
               ลายคอนทราสต์ต่ำมากอยู่แล้ว ร่องรอยการบีบอัดจึงมองไม่เห็น */
            source={require('@/assets/images/member-pattern.jpg')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            pointerEvents="none"
          />
          <LinearGradient
            /* สามสต็อป ไม่ใช่สอง — เขียวเข้มกับเขียวสดของโทเคนอยู่ใกล้กันมาก ไล่สองสต็อป
               อ่านออกมาเป็นสีทึบเรียบ ไม่รู้ว่าไล่ไว้
               โปร่งบางส่วน ให้ลายที่อยู่ข้างล่างยังโผล่ขึ้นมาเห็นได้ */
            colors={[ACCENT.strong, tokens.color.brand.accentDark, ACCENT.solid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.heroTint]}
          />
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

          {/* ★ เสือประดับมุมซ้ายล่างของหัวจอ ★ (เจ้าของสั่ง 6 ก.ย. 2026 "เสือผมเอามาไว้
              ประดับตรงสีเขียว") — วางลอยแบบ absolute ไม่ใช่ในแถว เพราะแต้มต้องอยู่ชิดขวา
              ที่เดิมเป๊ะ ตัวเลขแต้มคือสิ่งเดียวที่ลูกค้าเปิดหน้านี้มาดู ห้ามให้อะไรมาเบียด
              pointerEvents none — เป็นของประดับ ไม่ใช่ปุ่ม กดโดนแล้วต้องไม่มีอะไรเกิดขึ้น */}
          <Image
            source={MEMBER_MASCOT}
            style={styles.heroMascot}
            contentFit="contain"
            pointerEvents="none"
          />

          {/* แต้มชิดขวา ตัวใหญ่ที่สุดบนหน้า — เป็นสิ่งเดียวที่ลูกค้าเปิดหน้านี้มาดู */}
          <View style={styles.pointsBlock}>
            {loaded ? (
              <Text style={styles.pointsValue}>{points.toLocaleString('th-TH')}</Text>
            ) : (
              <Skeleton width={110} height={54} />
            )}
            <Text style={styles.pointsUnit}>แต้ม</Text>
          </View>
        </View>

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
        {/* ── ยังไม่ได้เป็นสมาชิก: ชวนสมัครด้วยเบอร์ ──
            เจ้าของสั่ง 6 ก.ย. 2026 "ลูกค้าที่ยังไม่มีระบบสมาชิกต้องมาสมัคร กรอกเบอร์
            ได้รับแต้ม 100"
            ★ เบอร์คือบัตรสมาชิก ★ แคชเชียร์ค้นสมาชิกที่หน้าร้านด้วยเบอร์ คนที่สมัครด้วย
            Google/Apple แล้วไม่เคยกรอกเบอร์จึงสะสมแต้มจากการซื้อหน้าร้านไม่ได้เลย
            แต้มต้อนรับคือแรงจูงใจให้กรอก ไม่ใช่ของแถมเปล่า ๆ */}
        {signedIn && !profile.phone ? (
          <View style={styles.joinCard}>
            <Image source={MEMBER_MASCOT} style={styles.joinMascot} contentFit="contain" />
            <Text variant="subtitle" style={styles.joinTitle}>
              สมัครสมาชิก รับ {WELCOME_POINTS} แต้มทันที
            </Text>
            <Text style={styles.joinBody}>
              กรอกเบอร์มือถือเพื่อรับบัตรสมาชิก แล้วสะสมแต้มได้ทุกครั้งที่ซื้อของ
            </Text>
            <View style={styles.joinField}>
              <Ionicons name="call-outline" size={20} color={Colors.textMuted} />
              <TextInput
                value={joinPhone}
                onChangeText={(v) => {
                  setJoinPhone(v.replace(/\D/g, '').slice(0, 10));
                  setJoinErr(null);
                }}
                placeholder="เบอร์มือถือ"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                style={styles.joinInput}
                onSubmitEditing={join}
                returnKeyType="done"
              />
            </View>
            {joinErr ? <Text style={styles.joinErr}>{joinErr}</Text> : null}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="สมัครสมาชิก"
              disabled={!joinValid || joining}
              onPress={join}
              style={[
                styles.joinBtn,
                { backgroundColor: joinValid && !joining ? ACCENT.strong : Colors.surfaceMuted },
              ]}>
              <Text
                style={[
                  styles.joinBtnText,
                  { color: joinValid && !joining ? Colors.textOnPrimary : Colors.textMuted },
                ]}>
                {joining ? 'กำลังสมัคร…' : `สมัครและรับ ${WELCOME_POINTS} แต้ม`}
              </Text>
            </PressableScale>
          </View>
        ) : null}

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
                /* ★ ของรางวัลคือเหตุผลเดียวที่คนสะสมแต้ม ★ (เจ้าของตีกลับ 6 ก.ย. 2026
                   "การ์ดไม่สวยเลยไม่เด่นเลย") — ของเดิมเป็นแถวเตี้ย ๆ รูปจิ๋ว 56px
                   อ่านดูเหมือนรายการตั้งค่า ไม่ใช่ของที่อยากได้
                   ทำเป็นการ์ดใบใหญ่ รูปเต็มความกว้าง แบบเดียวกับการ์ดสินค้าในร้าน */
                <View key={r.id} style={styles.reward}>
                  {r.image ? (
                    <Image source={{ uri: r.image }} style={styles.rewardArt} contentFit="cover" />
                  ) : (
                    <View style={[styles.rewardArt, styles.rewardArtEmpty]}>
                      <Ionicons name="gift" size={40} color={ACCENT.strong} />
                    </View>
                  )}
                  {soldOut ? (
                    <View style={styles.rewardSoldOut}>
                      <Text style={styles.rewardSoldOutText}>ของหมดแล้ว</Text>
                    </View>
                  ) : null}

                  <View style={styles.rewardCopy}>
                    {/* ★ ชื่อกับแต้มอยู่แถวเดียวกัน ★ (เจ้าของสั่ง 6 ก.ย. 2026 "เอาไว้ข้าง ๆ
                        ชื่อ") — อ่านทีเดียวจบว่า "ของอะไร กี่แต้ม" ไม่ต้องกวาดสายตาลงมาหา
                        ชื่อยืดเต็มที่เหลือ ป้ายแต้มไม่ยอมหด (shrink 0) เพราะตัวเลขแต้มย่อ
                        ไม่ได้ ถ้าชื่อยาวให้ตัดชื่อ ไม่ใช่ตัดราคา */}
                    <View style={styles.rewardTitleRow}>
                      <Text numberOfLines={1} style={styles.rewardName}>
                        {r.name}
                      </Text>
                      <View style={[styles.rewardCostChip, { backgroundColor: ACCENT.tint }]}>
                        <Ionicons name="medal" size={13} color={ACCENT.strong} />
                        {/* มีคำว่า "แต้ม" ด้วย — เลขลอย ๆ ในป้ายอ่านเป็นราคาบาทได้ */}
                        <Text style={[styles.rewardCostChipText, { color: ACCENT.strong }]}>
                          {r.pointsCost.toLocaleString('th-TH')} แต้ม
                        </Text>
                      </View>
                    </View>

                    {r.description ? (
                      <Text numberOfLines={2} style={styles.rewardDesc}>
                        {r.description}
                      </Text>
                    ) : null}

                    {/* ★ แถบความคืบหน้า ★ บอกว่าเหลืออีกกี่แต้มด้วยภาพ ไม่ใช่ตัวเลขลอย ๆ —
                        เห็นว่าตัวเองมาได้ไกลแค่ไหนแล้วคือสิ่งที่ทำให้คนอยากสะสมต่อ
                        ส่วนคำว่า "แต้มไม่พอ" เฉย ๆ คือการปิดประตูโดยไม่บอกทางไป */}
                    {!soldOut && !enough ? (
                      <View style={styles.rewardProgressWrap}>
                        <View style={styles.rewardTrack}>
                          <View
                            style={[
                              styles.rewardFill,
                              {
                                backgroundColor: ACCENT.solid,
                                width: `${Math.min(100, Math.round((points / r.pointsCost) * 100))}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.rewardShort}>
                          อีก {(r.pointsCost - points).toLocaleString('th-TH')} แต้ม
                          {r.stock != null && r.stock > 0 ? `  ·  เหลือ ${r.stock} ชิ้น` : ''}
                        </Text>
                      </View>
                    ) : r.stock != null && r.stock > 0 ? (
                      <Text style={styles.rewardStock}>เหลือ {r.stock} ชิ้น</Text>
                    ) : null}

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
                        {busyId === r.id
                          ? 'กำลังแลก…'
                          : soldOut
                            ? 'ของหมดแล้ว'
                            : enough
                              ? 'แลกเลย'
                              : 'แต้มยังไม่พอ'}
                      </Text>
                    </PressableScale>
                  </View>
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
    // ครอบตัดลายที่ล้นขอบ + เป็นพื้นสำรองกันกระพริบเฟรมแรกก่อนรูปลายโหลดเสร็จ
    overflow: 'hidden',
    backgroundColor: ACCENT.strong,
    paddingHorizontal: Spacing.lg,
    /* ★ ต้องมากกว่าระยะที่การ์ดขาวคร่อมขึ้นมา (OVERLAP) ★ ไม่งั้นคำว่า "แต้ม" ที่อยู่
       ล่างสุดของหัวจอจะถูกการ์ดทับ — เจอมาแล้วตอนตั้งเท่ากันพอดี */
    paddingBottom: OVERLAP + Spacing.x2,
  },
  /* 0.62 คือจุดที่ทั้งสองอย่างยังอยู่ครบ — ทึบกว่านี้ลายหายไปเลย ใสกว่านี้ไล่สีหายและ
     ลายเด่นเกินจนแย่งสายตาตัวเลขแต้ม */
  heroTint: { opacity: 0.62 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /* ล่างสุดของหัวจอพอดี — ส่วนล่างของตัวเสือถูกการ์ดขาวที่คร่อมอยู่บังไปนิดหน่อย
     ซึ่งทำให้ดูเหมือนเสือยืนอยู่หลังการ์ด ไม่ใช่ภาพลอยแปะ */
  heroMascot: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: 0,
    width: 148,
    height: 148,
  },
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

  /* การ์ดชวนสมัคร — มาสคอตอยู่บนสุดกลางการ์ด ให้อ่านเป็นคำเชิญ ไม่ใช่แบบฟอร์ม */
  joinCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: ACCENT.tint,
    ...Shadow.card,
  },
  joinMascot: { width: 136, height: 136 },
  joinTitle: { textAlign: 'center', color: ACCENT.strong },
  joinBody: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  joinField: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinInput: {
    flex: 1,
    fontFamily: 'Mitr_500Medium',
    fontSize: 17,
    color: Colors.text,
    padding: 0,
  },
  joinErr: { fontSize: 13, color: Colors.dangerStrong, alignSelf: 'flex-start' },
  joinBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: Radius.pill,
  },
  joinBtnText: { fontFamily: 'Mitr_500Medium', fontSize: 16 },

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
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  /* รูปเต็มความกว้าง — ของรางวัลต้องขายตัวเองด้วยรูป เหมือนการ์ดสินค้าในร้าน
     4:3 ไม่ใช่จัตุรัส เพราะรูปถ่ายสินค้าที่ร้านถ่ายมาส่วนใหญ่เป็นแนวนอน */
  rewardArt: { width: '100%', aspectRatio: 4 / 3, backgroundColor: ACCENT.tint },
  rewardArtEmpty: { alignItems: 'center', justifyContent: 'center' },
  rewardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rewardCostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    /* ห้ามหดตามชื่อที่ยาว — ตัวเลขแต้มย่อไม่ได้ ชื่อตัดได้ */
    flexShrink: 0,
  },
  rewardCostChipText: { fontFamily: 'Mitr_500Medium', fontSize: 14 },
  rewardProgressWrap: { gap: 5, marginTop: Spacing.sm },
  /* แถบบาง ๆ ไม่ใช่แถบหนา — เป็นข้อมูลประกอบ ไม่ใช่พระเอกของการ์ด */
  rewardTrack: {
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  rewardFill: { height: '100%', borderRadius: Radius.pill },
  /* ของหมดคลุมทั้งรูป — ต้องเห็นตั้งแต่ยังไม่อ่านตัวหนังสือว่าอันนี้แลกไม่ได้แล้ว */
  rewardSoldOut: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  rewardSoldOutText: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 16,
    color: Colors.textMuted,
  },
  rewardCopy: { gap: 2, padding: Spacing.md },
  rewardName: { flex: 1, fontFamily: 'Mitr_500Medium', fontSize: 17, color: Colors.text },
  rewardDesc: { fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  rewardShort: { fontFamily: 'Mitr_500Medium', fontSize: 13, color: ACCENT.strong, marginTop: 2 },
  rewardStock: { fontSize: 12, color: Colors.textMuted },
  redeemBtn: {
    marginTop: Spacing.sm,
    height: 46,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemText: { fontFamily: 'Mitr_500Medium', fontSize: 15 },

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
