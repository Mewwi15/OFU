/**
 * Login / register — `/login`.
 *
 * ★ เบอร์โทร + OTP เป็นทางหลัก ★ (เจ้าของสั่ง 5 ก.ย. 2026 "ทำระบบ login โดยใช้เบอร์
 * กันครับ otp ผ่าน sms") — ลูกค้าร้านชำจำเบอร์ตัวเองได้ทุกคน แต่หลายคนไม่มีอีเมลหรือ
 * จำรหัสผ่านไม่ได้ · เบอร์ยังเป็นกุญแจเดียวกับที่หน้าร้านใช้ค้นสมาชิกสะสมแต้ม (0102)
 * คนที่สมัครในแอปจึงกลายเป็นสมาชิกที่แคชเชียร์ค้นเจอทันทีโดยไม่ต้องลงทะเบียนซ้ำ
 *
 * ไม่มีขั้น "สมัครสมาชิก" แยกสำหรับเบอร์ — ยิง OTP ครั้งแรกคือการสมัคร ระบบสร้างบัญชี
 * ให้เอง ลดหน้าจอที่ลูกค้าต้องผ่านจากสองเป็นหนึ่ง
 *
 * ทางเดิมยังอยู่ครบ: อีเมล + รหัสผ่าน (ยืนยันด้วยรหัส 6 หลักทางอีเมล), Google,
 * Sign in with Apple บน iOS (ข้อ 4.8 บังคับเมื่อมี social login อื่น) และ LINE บนเว็บ
 * — บัญชีที่สมัครไว้ก่อนหน้านี้ต้องเข้าได้เหมือนเดิม
 *
 * ★ SMS มีค่าใช้จ่ายต่อข้อความ ★ ต่างจากอีเมลที่ส่งฟรี — จึงมีตัวนับถอยหลังก่อนส่งซ้ำได้
 * ทุกจุดที่ยิง OTP ไม่งั้นคนกดรัวสิบครั้งคือเงินสิบข้อความ
 */

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { DELIVERY_INK, DELIVERY_INK_SHADOW, DELIVERY_RAMP } from '@/constants/delivery';
import {
  signInWithAppleNative,
  signInWithGoogleNative,
  signInWithOAuthProvider,
  toE164Thai,
} from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { PRIVACY_URL } from '@/lib/legal';
import { startLineAuth } from '@/lib/line';
import { useAuth } from '@/store/auth';

const BRAND = { google: '#FFFFFF', line: '#06C755' } as const;
const MASCOT_SRC = require('@/assets/images/mascot-tiger.png') as number;
const CODE_LENGTH = 6;
const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

type Mode = 'signin' | 'signup';
type Step = 'form' | 'verify';
/** ทางเข้าที่กำลังเลือกอยู่ — เบอร์เป็นค่าตั้งต้น */
type Method = 'phone' | 'email';

/** เบอร์ไทยที่กรอกได้จริง: 10 หลักขึ้นต้น 0 แล้วตามด้วย 6/8/9 (มือถือไทยทุกค่าย) */
const phoneValid = (digits: string) => /^0[689]\d{8}$/.test(digits);

/** 0812345678 → 081-234-5678 (ใช้โชว์ตอนยืนยัน ให้ตรวจทานเบอร์ตัวเองได้ในแวบเดียว) */
const prettyThaiPhone = (digits: string) =>
  digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;

/** วินาทีที่ต้องรอก่อนส่ง SMS ซ้ำ — ทุกครั้งที่ส่งคือเงินจริงของร้าน */
const RESEND_COOLDOWN = 60;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();

  // Defensive, not a fix for an observed bug: on-device the insets are correct
  // (measured T33 == StatusBar 33), and the overlap that kicked this off turned
  // out to be a stale build. This is kept anyway because it can only ever ADD
  // top padding (Math.max), never remove it — so it cannot regress the healthy
  // case — while still clearing the status bar on an Android OEM that
  // under-reports insets.top. Safe because SDK 54 forces edge-to-edge (this app
  // always draws under the bar), so insets.top is the real value and
  // StatusBar.currentHeight only ever matches or backstops it.
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );
  // No equivalent OS reading for the nav bar, so the floor is a plain minimum:
  // enough that the consent links stay tappable rather than pinned to the edge.
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? Spacing.x2 : 0);
  const signInEmail = useAuth((s) => s.signInEmail);
  const signUpEmail = useAuth((s) => s.signUpEmail);
  const verifyEmailCode = useAuth((s) => s.verifyEmailCode);
  const resendEmailCode = useAuth((s) => s.resendEmailCode);
  const startPhoneOtp = useAuth((s) => s.startPhoneOtp);
  const verifyPhoneOtp = useAuth((s) => s.verifyPhoneOtp);
  const socialCallbackError = useAuth((s) => s.socialCallbackError);
  const setSocialCallbackError = useAuth((s) => s.setSocialCallbackError);

  const [mode, setMode] = useState<Mode>('signin');
  const [method, setMethod] = useState<Method>('phone');
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  /* เหลืออีกกี่วินาทีถึงจะส่ง SMS ซ้ำได้ — 0 = ส่งได้ */
  const [cooldown, setCooldown] = useState(0);
  // Web: LINE-only by default (owner pivot); the classic form is opt-in.
  const [showClassic, setShowClassic] = useState(Platform.OS !== 'web');
  const lineOnly = Platform.OS === 'web' && !showClassic;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Native Apple sheet availability (iOS 13+ device/sim; always false on Android).
  const [appleAvailable, setAppleAvailable] = useState(false);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => {});
  }, []);

  // The web Google OAuth round-trip is a full page redirect back to `/`, so
  // any failure it hit is stashed in the auth store (see app/_layout.tsx) —
  // derive the banner straight from the store (regardless of which sub-view,
  // LINE-hero or classic form, happens to be showing after the remount).
  // Deliberately NOT auto-cleared on a timer: an effect that clears the store
  // right after reading it also fires on the very render that's supposed to
  // show the message, so the banner flashed for under a frame and never
  // actually appeared. It clears instead when the user dismisses it or starts
  // a fresh social attempt (see onGoogle/onApple/the LINE button below).
  const socialError = socialCallbackError
    ? socialCallbackError === 'GOOGLE_CANCELLED'
      ? t('login.googleCancelled')
      : t('login.googleFailed')
    : null;

  const formValid =
    emailValid(email) && password.length >= 6 && (mode === 'signin' || password === confirm);
  const codeValid = code.length === CODE_LENGTH;

  const submitForm = async () => {
    if (!formValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInEmail(email, password);
      } else {
        const { needsVerify } = await signUpEmail(email, password);
        if (needsVerify) {
          setCode('');
          setStep('verify');
          setTimeout(() => codeRef.current?.focus(), 250);
        }
      }
    } catch (e) {
      setError(authMessage(e, mode));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!codeValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, code);
    } catch {
      setError('รหัสยืนยันไม่ถูกต้องหรือหมดอายุ');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendEmailCode(email);
      setError(null);
      Alert.alert('ส่งรหัสใหม่แล้ว', `เราส่งรหัสยืนยันไปที่ ${email} อีกครั้ง`);
    } catch {
      Alert.alert('ส่งรหัสไม่สำเร็จ', 'ลองใหม่อีกครั้งในภายหลัง');
    }
  };

  const onGoogle = async () => {
    if (socialBusy) return;
    setSocialCallbackError(null);
    setSocialBusy(true);
    try {
      // Android: native sheet first (build 1.0.2+) — no browser, no deep link.
      const res = await signInWithGoogleNative();
      // 'unavailable' = no native sheet in this binary (old Android build, or
      // iOS) → the browser flow is the only way in. Every other failure reports
      // its code: this used to `.catch(() => 'unavailable')`, which swallowed
      // real errors and quietly pushed the user into the browser round-trip —
      // the flow that leaves them staring at a frozen login screen with a
      // session already saved, needing a force-quit to get in. A visible code
      // is both the honest outcome and the only way to learn WHY the sheet
      // failed on a customer's device.
      if (!res.ok && res.reason === 'unavailable') {
        await signInWithOAuthProvider('google');
      } else if (!res.ok && res.reason === 'failed') {
        Alert.alert(t('login.socialFailed'), `${t('login.socialFailedBody')}\n\n(${res.code})`);
      }
      // 'cancelled' and success both just end here — the auth gate reacts.
    } catch {
      Alert.alert(t('login.socialFailed'), t('login.socialFailedBody'));
    } finally {
      setSocialBusy(false);
    }
  };

  const onApple = async () => {
    if (socialBusy) return;
    setSocialCallbackError(null);
    setSocialBusy(true);
    try {
      const res = await signInWithAppleNative();
      // A user cancel (reason 'cancelled') is silent — no error dialog. Only a
      // real failure alerts, with a short token-free diagnostic code appended so
      // the user can report it (never the identity token or any credential).
      if (!res.ok && res.reason === 'failed') {
        Alert.alert(t('login.socialFailed'), `${t('login.socialFailedBody')}\n\n(${res.code})`);
      }
    } catch {
      Alert.alert(t('login.socialFailed'), t('login.socialFailedBody'));
    } finally {
      setSocialBusy(false);
    }
  };

  /* ตัวนับถอยหลังของปุ่มส่งซ้ำ — เดินเฉพาะตอนมีค่าค้างอยู่ ไม่ตั้ง interval ทิ้งไว้เปล่า ๆ */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const phoneDigits = phone.replace(/\D/g, '');

  /* ส่ง OTP — ใช้ทั้งตอนกดครั้งแรกและตอนกดส่งซ้ำ
     ★ ไม่บอกว่าเบอร์นี้มีบัญชีอยู่หรือยัง ★ ตอบเหมือนกันทุกกรณี ไม่งั้นใครก็ไล่ยิงเบอร์
     เพื่อดูว่าใครเป็นลูกค้าร้านนี้ได้ (และการสมัครกับเข้าสู่ระบบเป็นทางเดียวกันอยู่แล้ว) */
  const sendOtp = async () => {
    if (!phoneValid(phoneDigits) || busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      await startPhoneOtp(toE164Thai(phoneDigits));
      setCode('');
      setStep('verify');
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => codeRef.current?.focus(), 250);
    } catch (e) {
      setError(otpMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPhoneCode = async () => {
    if (!codeValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneOtp(toE164Thai(phoneDigits), code);
    } catch (e) {
      setError(otpMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const switchMethod = (next: Method) => {
    setMethod(next);
    setError(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirm('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ★ หัวจอไล่สีเต็มความกว้าง ไม่ใช่แถบสีอ่อนลอย ๆ ★ (เจ้าของตีกลับ 5 ก.ย. 2026
          "ไม่สวยเลย ทำใหม่หน่อย") — หน้าร้านทั้งสองโหมดกับหน้าสมาชิกใช้โครงเดียวกันหมด
          คือพื้นไล่สีเต็มจอแล้วมีแผ่นเนื้อหาสีขาวโค้งทับขึ้นมา หน้าล็อกอินเป็นหน้าแรกที่
          ลูกค้าเห็น แต่กลับเป็นหน้าเดียวที่ไม่เข้าชุดกับที่เหลือ */}
      <LinearGradient
        colors={DELIVERY_RAMP}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.6, 1]}
        style={styles.heroBg}
        pointerEvents="none"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + Spacing.lg, paddingBottom: bottomInset + Spacing.x3 },
        ]}>
        <View style={styles.brand}>
          {/* มาสคอตคู่กับโลโก้ — ตัวเดียวกับที่ลูกค้าเห็นบนหน้าร้าน จำร้านได้ตั้งแต่จอแรก */}
          <Image source={MASCOT_SRC} style={styles.mascot} contentFit="contain" />
          <Text variant="heading" style={styles.welcome}>
            {t('login.welcome')}
          </Text>
          <Text variant="body" style={styles.tagline}>
            {t('login.tagline')}
          </Text>
        </View>

        {/* แผ่นเนื้อหา — ยกขึ้นมาทับพื้นไล่สีเล็กน้อย ให้อ่านเป็นการ์ดที่วางอยู่บนพื้น
            ไม่ใช่สองโซนที่ต่อกันเฉย ๆ */}
        <View style={styles.sheet}>

        {socialError ? (
          <View style={styles.socialErrorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.dangerStrong} />
            <Text style={styles.socialErrorText}>{socialError}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              onPress={() => setSocialCallbackError(null)}>
              <Ionicons name="close" size={18} color={Colors.dangerStrong} />
            </Pressable>
          </View>
        ) : null}

        {step === 'form' && lineOnly ? (
          <>
            {/* Web-first (owner 2026-07-13): LINE is THE way in — everyone who
                signs in this way is auto-linked for LINE order notifications.
                The classic email/Google form stays reachable below for
                accounts created before the pivot. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('login.continueLine')}
              onPress={() => startLineAuth('login')}
              scaleTo={0.98}
              style={[styles.social, styles.lineHero, { backgroundColor: BRAND.line }]}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
              <Text style={[styles.socialText, { color: '#FFFFFF' }]}>{t('login.continueLine')}</Text>
            </PressableScale>
            <Text variant="caption" style={styles.lineHeroHint}>
              {t('login.lineHint')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowClassic(true)}
              hitSlop={8}
              style={styles.otherMethods}>
              <Text style={styles.otherMethodsText}>{t('login.otherMethods')}</Text>
            </Pressable>
          </>
        ) : step === 'form' ? (
          <>
            {/* เลือกทางเข้า — เบอร์โทรมาก่อนเพราะเป็นทางหลัก */}
            <View style={styles.modeToggle}>
              {(['phone', 'email'] as Method[]).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{ selected: method === m }}
                  onPress={() => switchMethod(m)}
                  style={[styles.modeBtn, method === m && styles.modeBtnActive]}>
                  <Text style={[styles.modeText, method === m && styles.modeTextActive]}>
                    {m === 'phone' ? 'เบอร์โทร' : 'อีเมล'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {method === 'phone' ? (
              <>
                <Text style={styles.label}>เบอร์โทรศัพท์</Text>
                <View style={styles.field}>
                  {/* +66 ตายตัว ไม่ให้แก้ — ร้านส่งของในไทยอย่างเดียว การเปิดให้เลือก
                      รหัสประเทศคือเพิ่มช่องให้กรอกผิดโดยไม่มีใครได้ประโยชน์ */}
                  <View style={styles.dialCode}>
                    <Text style={styles.dialCodeText}>+66</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                    placeholder="08X-XXX-XXXX"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    style={styles.input}
                    onSubmitEditing={sendOtp}
                    returnKeyType="done"
                  />
                </View>
                {phoneDigits.length === 10 && !phoneValid(phoneDigits) ? (
                  <Text style={styles.hintErr}>เบอร์มือถือไทยขึ้นต้นด้วย 06 08 หรือ 09</Text>
                ) : null}

                {/* ★ ปุ่มต้องรู้เรื่องเวลารอด้วย ★ ตัวนับเดินต่อแม้กดย้อนกลับมาหน้านี้ —
                    ถ้าปุ่มยังกดได้แต่ข้างในเงียบ คนจะกดซ้ำแล้วคิดว่าแอปค้าง */}
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="ส่งรหัส OTP"
                  disabled={!phoneValid(phoneDigits) || busy || cooldown > 0}
                  onPress={sendOtp}
                  style={[
                    styles.primaryBtn,
                    (!phoneValid(phoneDigits) || busy || cooldown > 0) && styles.primaryBtnOff,
                  ]}>
                  <Text style={styles.primaryText}>
                    {busy
                      ? 'กำลังส่งรหัส…'
                      : cooldown > 0
                        ? `ขอรหัสใหม่ได้ในอีก ${cooldown} วินาที`
                        : 'ส่งรหัส OTP'}
                  </Text>
                </PressableScale>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Text variant="caption" style={styles.methodHint}>
                  ยังไม่เคยมีบัญชีก็ใช้เบอร์นี้ได้เลย ระบบสมัครให้อัตโนมัติ
                </Text>
              </>
            ) : (
              <>
            {/* สมัคร/เข้าสู่ระบบ มีเฉพาะทางอีเมล — ทางเบอร์ยิง OTP ครั้งแรกคือสมัครเลย */}
            <View style={styles.modeToggle}>
              {(['signin', 'signup'] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === m }}
                  onPress={() => switchMode(m)}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}>
                  <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                    {m === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>อีเมล</Text>
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>รหัสผ่าน</Text>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                style={styles.input}
                onSubmitEditing={mode === 'signin' ? submitForm : undefined}
                returnKeyType={mode === 'signin' ? 'done' : 'next'}
              />
              <Pressable hitSlop={8} onPress={() => setShowPw((v) => !v)} accessibilityLabel="สลับการแสดงรหัสผ่าน">
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
                <View style={styles.field}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    style={styles.input}
                    onSubmitEditing={submitForm}
                    returnKeyType="done"
                  />
                </View>
                {confirm.length > 0 && confirm !== password ? (
                  <Text style={styles.hintErr}>รหัสผ่านไม่ตรงกัน</Text>
                ) : null}
              </>
            )}

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              disabled={!formValid || busy}
              onPress={submitForm}
              style={[styles.primaryBtn, (!formValid || busy) && styles.primaryBtnOff]}>
              <Text style={styles.primaryText}>
                {busy ? 'กำลังดำเนินการ…' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </Text>
            </PressableScale>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {/* Nudge new users to sign up — shown only after a failed sign-in,
                never revealing whether the email exists (no enumeration). */}
            {error && mode === 'signin' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => switchMode('signup')}
                hitSlop={8}
                style={styles.signupHint}>
                <Text style={styles.signupHintText}>
                  ยังไม่มีบัญชี? <Text style={styles.signupHintLink}>สมัครสมาชิก</Text>
                </Text>
              </Pressable>
            ) : null}

              </>
            )}

            {/* Divider + Google */}
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text variant="caption" style={styles.dividerText}>
                {t('login.orSignInWith')}
              </Text>
              <View style={styles.divider} />
            </View>
            {/* Apple first (its own native, brand-compliant button — renders a
                localized "ดำเนินการต่อด้วย Apple"); guideline 4.8 wants it at
                least as prominent as other third-party logins. */}
            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={26}
                onPress={onApple}
                style={styles.appleButton}
              />
            ) : null}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('login.continueGoogle')}
              onPress={onGoogle}
              scaleTo={0.98}
              style={[styles.social, { backgroundColor: BRAND.google }, styles.socialBordered]}>
              <Ionicons name="logo-google" size={20} color={Colors.text} />
              <Text style={[styles.socialText, { color: Colors.text }]}>{t('login.continueGoogle')}</Text>
            </PressableScale>
            {/* Back to the primary LINE sign-in (web classic form only). */}
            {Platform.OS === 'web' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowClassic(false)}
                hitSlop={8}
                style={styles.otherMethods}>
                <Text style={styles.otherMethodsText}>{t('login.backToLine')}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={10}
              onPress={() => setStep('form')}
              style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
              <Text style={styles.backText}>ย้อนกลับ</Text>
            </Pressable>

            <Text variant="subtitle" style={styles.otpTitle}>
              {method === 'phone' ? 'ยืนยันเบอร์โทร' : 'ยืนยันอีเมล'}
            </Text>
            <Text variant="body" style={styles.otpSub}>
              กรอกรหัส 6 หลักที่ส่งไปที่{' '}
              {method === 'phone' ? prettyThaiPhone(phoneDigits) : email}
            </Text>

            <Pressable style={styles.otpRow} onPress={() => codeRef.current?.focus()}>
              {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                const filled = i < code.length;
                const active = i === code.length;
                return (
                  <View key={i} style={[styles.otpCell, (filled || active) && styles.otpCellActive]}>
                    <Text style={styles.otpDigit}>{code[i] ?? ''}</Text>
                  </View>
                );
              })}
              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                style={styles.otpHidden}
                autoFocus
              />
            </Pressable>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="ยืนยัน"
              disabled={!codeValid || busy}
              onPress={method === 'phone' ? submitPhoneCode : submitCode}
              style={[styles.primaryBtn, (!codeValid || busy) && styles.primaryBtnOff]}>
              <Text style={styles.primaryText}>{busy ? 'กำลังยืนยัน…' : 'ยืนยัน'}</Text>
            </PressableScale>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* ★ ส่งซ้ำต้องรอ ★ SMS เสียเงินต่อข้อความ ไม่เหมือนอีเมลที่ส่งฟรี — ปุ่มจึงบอก
                ตรง ๆ ว่าเหลืออีกกี่วินาที ไม่ใช่กดได้เรื่อย ๆ แล้วเงียบ หรือกดแล้วเด้ง error
                (ทางอีเมลไม่ต้องรอ ของเดิมทำงานเหมือนเดิม) */}
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              disabled={method === 'phone' && (cooldown > 0 || busy)}
              onPress={method === 'phone' ? sendOtp : resend}
              style={styles.resend}>
              <Text
                style={[
                  styles.resendText,
                  method === 'phone' && cooldown > 0 && styles.resendTextOff,
                ]}>
                {method === 'phone' && cooldown > 0
                  ? `ส่งรหัสอีกครั้งใน ${cooldown} วินาที`
                  : 'ส่งรหัสอีกครั้ง'}
              </Text>
            </Pressable>
          </>
        )}

        </View>

        {/* PDPA consent — both open the same hosted policy page (no separate
            terms-of-use page exists yet; see lib/legal.ts).
            Real Pressables, not `<Text onPress>` nested in a sentence: that
            gives a tap target the exact size of the glyphs and takes no
            hitSlop. Both stores require the privacy policy to be reachable, so
            a link that is merely *technically* present fails review. */}
        <View style={styles.consentBlock}>
          <Text variant="caption" style={styles.consent}>
            {t('login.consentPrefix')}
          </Text>
          <View style={styles.consentLinkRow}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('login.terms')}
              hitSlop={12}
              onPress={() => Linking.openURL(PRIVACY_URL)}
              style={styles.consentHit}>
              <Text style={styles.consentLink}>{t('login.terms')}</Text>
            </Pressable>
            <Text variant="caption" style={styles.consent}>
              {t('common.and')}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('login.privacy')}
              hitSlop={12}
              onPress={() => Linking.openURL(PRIVACY_URL)}
              style={styles.consentHit}>
              <Text style={styles.consentLink}>{t('login.privacy')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Map Supabase auth errors to friendly Thai copy. */
/**
 * ข้อความผิดพลาดของ OTP ทางเบอร์ — แปลงศัพท์เทคนิคของ Supabase เป็นคำที่ลูกค้าทำอะไรต่อได้
 *
 * ★ แยก "รหัสผิด" ออกจาก "ส่งไม่ออก" ★ สองอย่างนี้ลูกค้าต้องทำคนละเรื่อง: รหัสผิดให้กรอกใหม่
 * ส่งไม่ออกให้รอแล้วลองอีกที ถ้ารวบเป็น "ผิดพลาด" เหมือนกันหมด คนจะนั่งกรอกรหัสซ้ำทั้งที่
 * ไม่มี SMS มาถึงตั้งแต่แรก
 */
function otpMessage(e: unknown): string {
  const err = e as { message?: string; code?: string; status?: number };
  const code = err?.code ?? '';
  const msg = err?.message?.toLowerCase() ?? '';
  if (code === 'otp_expired' || msg.includes('expired'))
    return 'รหัสหมดอายุแล้ว — กดส่งรหัสใหม่อีกครั้ง';
  if (code === 'otp_disabled' || msg.includes('signups not allowed') || msg.includes('disabled'))
    return 'ยังเปิดใช้การเข้าสู่ระบบด้วยเบอร์ไม่ได้ ลองวิธีอื่นก่อนนะ';
  if (msg.includes('invalid') && (msg.includes('token') || msg.includes('otp')))
    return 'รหัสไม่ถูกต้อง ลองตรวจดูอีกที';
  /* โควตาต่อชั่วโมงของโครงการ หรือความถี่ต่อเบอร์ — คนละเรื่องกับรหัสผิด ต้องบอกให้รอ */
  if (err?.status === 429 || code.includes('rate') || msg.includes('rate limit') || msg.includes('too many'))
    return 'ขอรหัสบ่อยเกินไป รอสักครู่แล้วลองใหม่';
  if (msg.includes('invalid') && msg.includes('phone')) return 'เบอร์นี้ไม่ถูกต้อง ลองตรวจดูอีกที';
  if (msg.includes('sms') || msg.includes('provider') || msg.includes('send'))
    return 'ส่ง SMS ไม่สำเร็จ ลองใหม่อีกครั้ง หรือเข้าด้วยวิธีอื่นก่อน';
  return 'ไม่สำเร็จ ลองใหม่อีกครั้ง';
}

function authMessage(e: unknown, mode: Mode): string {
  const err = e as { message?: string; code?: string };
  const code = err?.code ?? '';
  const msg = err?.message?.toLowerCase() ?? '';
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบแทน';
  // ตอน "เข้าสู่ระบบ" ทุกเคสที่เกี่ยวกับรหัส = ข้อมูลไม่ถูกต้อง (ห้ามขึ้นข้อความเงื่อนไขรหัสผ่าน)
  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login') ||
    msg.includes('invalid credentials') ||
    (mode === 'signin' && msg.includes('password'))
  )
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (msg.includes('not confirmed')) return 'อีเมลยังไม่ได้ยืนยัน — กรุณายืนยันก่อนเข้าสู่ระบบ';
  // ข้อความเงื่อนไขรหัสผ่านมีเฉพาะตอนสมัครสมาชิก
  if (code === 'weak_password' || msg.includes('password'))
    return 'รหัสผ่านไม่ผ่านเงื่อนไข (อย่างน้อย 6 ตัวอักษร)';
  return mode === 'signin' ? 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง' : 'สมัครไม่สำเร็จ ลองใหม่อีกครั้ง';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  // `justifyContent: 'center'` groups brand+form+consent as one block and
  // centers it when content is short (the LINE-only view) instead of leaving
  // a stark empty gap above a footer pinned to the bottom; it's a no-op once
  // content is tall enough to scroll (the classic email/password form).
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },

  /* พื้นไล่สีอยู่หลังทุกอย่าง สูงพอให้หัวจอมีที่หายใจแม้แป้นพิมพ์ดันเนื้อหาขึ้น */
  heroBg: { position: 'absolute', left: 0, right: 0, top: 0, height: '46%' },
  brand: { alignItems: 'center', paddingBottom: Spacing.x2 },
  mascot: { width: 132, height: 132 },
  /* ตัวหนังสือบนพื้นไล่สีเป็นสีขาว + เงาบาง ๆ ตรึงขอบ — ชุดเดียวกับหัวจอหน้าร้าน */
  welcome: { color: DELIVERY_INK, ...DELIVERY_INK_SHADOW, textAlign: 'center' },
  tagline: { color: DELIVERY_INK, ...DELIVERY_INK_SHADOW, marginTop: 2 },

  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    paddingTop: Spacing.x2,
    ...Shadow.float,
  },

  socialErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.dangerStrong,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  socialErrorText: { ...Typography.body, color: Colors.dangerStrong, flex: 1 },

  /* Mode toggle */
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryTint,
    borderRadius: Radius.pill,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm + 2, borderRadius: Radius.pill },
  modeBtnActive: { backgroundColor: Colors.surface, ...Platform.select({ ios: {}, default: {} }) },
  modeText: { ...Typography.button, color: Colors.textMuted },
  modeTextActive: { color: Colors.primaryStrong },

  /* Fields */
  label: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  input: { ...Typography.subtitle, flex: 1, color: Colors.text, padding: 0 },
  /* +66 ติดอยู่กับช่อง มีเส้นคั่นบาง ๆ — อ่านเป็น "ส่วนหนึ่งของเบอร์" ไม่ใช่ปุ่มที่กดได้ */
  dialCode: {
    paddingRight: Spacing.sm,
    marginRight: Spacing.xs,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  dialCodeText: { ...Typography.subtitle, color: Colors.textMuted },
  methodHint: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.md },
  resendTextOff: { color: Colors.textMuted },
  hintErr: { ...Typography.caption, color: Colors.dangerStrong, marginTop: -Spacing.sm, marginBottom: Spacing.md },

  /* Primary button */
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    marginTop: Spacing.xs,
  },
  primaryBtnOff: { opacity: 0.45 },
  errorText: { ...Typography.caption, color: Colors.dangerStrong, textAlign: 'center', marginTop: Spacing.md },
  signupHint: { alignSelf: 'center', marginTop: Spacing.sm, padding: Spacing.xs },
  signupHintText: { ...Typography.caption, color: Colors.textMuted },
  signupHintLink: { color: Colors.primaryStrong },
  primaryText: { ...Typography.button, fontSize: 16, color: Colors.textOnPrimary },

  /* Divider */
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.xl },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted },

  /* Social */
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: Radius.pill,
  },
  socialBordered: { borderWidth: 1, borderColor: Colors.border },
  /* LINE-first (web): the hero button + hint + escape hatch to the old form */
  lineHero: {
    minHeight: 58,
    marginTop: Spacing.lg,
    ...Shadow.float,
  },
  lineHeroHint: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  otherMethods: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  otherMethodsText: {
    ...Typography.button,
    color: Colors.textMuted,
  },
  /* Native Apple button — must carry explicit dimensions to render; height and
     pill radius mirror the Google row below it. */
  appleButton: {
    height: 52,
    width: '100%',
    marginBottom: Spacing.md,
  },
  socialText: { ...Typography.button },

  /* Verify (reused OTP cells) */
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: Spacing.lg },
  backText: { ...Typography.button, color: Colors.text },
  otpTitle: { color: Colors.text },
  otpSub: { color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.xl },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xl },
  otpCell: {
    width: 48,
    height: 58,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellActive: { borderColor: Colors.primary },
  otpDigit: { ...Typography.title, color: Colors.text },
  otpHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  resend: { alignSelf: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
  resendText: { ...Typography.button, color: Colors.primaryStrong },

  /* Consent */
  consentBlock: { marginTop: Spacing.x3, paddingTop: Spacing.x2 },
  consent: { textAlign: 'center', lineHeight: 19 },
  consentLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    // Keeps the row readable when the OS font scale is turned up and the links
    // wrap onto separate lines.
    columnGap: Spacing.xs,
  },
  // A real touch target around the link text rather than the glyphs alone.
  consentHit: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.xxs },
  consentLink: { ...Typography.caption, color: Colors.primaryStrong },
});
