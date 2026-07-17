/**
 * Login / register — `/login`.
 *
 * Cost-free auth (no SMS): email + password with a 6-digit email verification
 * code, plus Google social sign-in — and, on iOS, native Sign in with Apple
 * (guideline 4.8: mandatory once any third-party login exists). Two modes
 * (sign in / sign up); signing up moves to a verify step where the emailed
 * code is entered. PDPA consent line per product requirements. Tokens-only,
 * zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
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
import { signInWithAppleNative, signInWithOAuthProvider } from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { PRIVACY_URL } from '@/lib/legal';
import { startLineAuth } from '@/lib/line';
import { useAuth } from '@/store/auth';

const BRAND = { google: '#FFFFFF', line: '#06C755' } as const;
const CODE_LENGTH = 6;
const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

type Mode = 'signin' | 'signup';
type Step = 'form' | 'verify';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();

  // The reported bug is the welcome title sitting under the status bar and the
  // privacy link under the Android nav buttons — i.e. these insets arriving as
  // 0 on a device that IS drawing edge-to-edge, since the padding below is
  // otherwise correct. `StatusBar.currentHeight` is a second, independent
  // reading of the Android status bar, so take whichever is larger rather than
  // trusting one source. Both agree on a healthy device (max is then a no-op);
  // if safe-area-context under-reports, this still clears the bar.
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
  const socialCallbackError = useAuth((s) => s.socialCallbackError);
  const setSocialCallbackError = useAuth((s) => s.setSocialCallbackError);

  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('form');
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
      await signInWithOAuthProvider('google');
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
      await signInWithAppleNative();
    } catch {
      Alert.alert(t('login.socialFailed'), t('login.socialFailedBody'));
    } finally {
      setSocialBusy(false);
    }
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + Spacing.x3, paddingBottom: bottomInset + Spacing.x3 },
        ]}>
        {/* Brand — a tinted hero band (not just text floating on the plain
            background) so the screen reads as designed, not placeholder. */}
        <View style={styles.brand}>
          <Image source={require('@/assets/images/logo-oofoo.png')} style={styles.logo} contentFit="contain" />
          <Text variant="heading" style={styles.welcome}>
            {t('login.welcome')}
          </Text>
          <View style={styles.taglineChip}>
            <Text variant="body" style={styles.tagline}>
              {t('login.tagline')}
            </Text>
          </View>
        </View>

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
            {/* Mode toggle */}
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
              ยืนยันอีเมล
            </Text>
            <Text variant="body" style={styles.otpSub}>
              กรอกรหัส 6 หลักที่ส่งไปที่ {email}
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
              onPress={submitCode}
              style={[styles.primaryBtn, (!codeValid || busy) && styles.primaryBtnOff]}>
              <Text style={styles.primaryText}>{busy ? 'กำลังยืนยัน…' : 'ยืนยัน'}</Text>
            </PressableScale>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable accessibilityRole="button" hitSlop={8} onPress={resend} style={styles.resend}>
              <Text style={styles.resendText}>ส่งรหัสอีกครั้ง</Text>
            </Pressable>
          </>
        )}

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
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.x2 },

  // Tinted hero band (bleeds past the content padding) instead of the logo
  // and welcome text floating alone on the plain page background.
  brand: {
    alignItems: 'center',
    marginHorizontal: -Spacing.x2,
    marginBottom: Spacing.x3,
    paddingHorizontal: Spacing.x2,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.x3,
    backgroundColor: Colors.primaryTint,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  logo: { width: 160, height: 70, marginBottom: Spacing.md },
  welcome: { color: Colors.text },
  taglineChip: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  tagline: { color: Colors.textMuted },

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
