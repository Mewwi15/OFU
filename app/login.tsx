/**
 * Login — `/login`.
 *
 * The auth gate's entry screen. Two steps: enter a Thai mobile number → request
 * an OTP → enter the 6-digit code, plus a Google social option.
 * Frontend-first: no real OTP is sent and any 6-digit code is accepted; this UI
 * sits in front of the planned Supabase Auth (phone OTP + social). PDPA consent
 * line per product requirements. Tokens-only, zero emoji (social marks use real
 * brand glyphs/colors).
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { authRepo, signInWithOAuthProvider, toE164Thai } from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/store/auth';

/** External brand colors for the social buttons (exempt from design tokens). */
const BRAND = { google: '#FFFFFF' } as const;

const OTP_LENGTH = 6;

/** Keep only digits, max 10 (Thai mobile). */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

/** 0812345678 -> 081-234-5678 (partial-friendly). */
function formatPhone(d: string): string {
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

type SocialProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  bordered?: boolean;
  onPress: () => void;
};

function SocialButton({ label, icon, bg, fg, bordered, onPress }: SocialProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.social, { backgroundColor: bg }, bordered && styles.socialBordered]}>
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.socialText, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const startPhoneOtp = useAuth((s) => s.startPhoneOtp);
  const verifyPhoneOtp = useAuth((s) => s.verifyPhoneOtp);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRef = useRef<TextInput>(null);
  const t = useT();

  const phoneValid = phone.length === 10;
  const codeValid = code.length === OTP_LENGTH;

  const requestOtp = async () => {
    if (!phoneValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startPhoneOtp(toE164Thai(phone));
      setCode('');
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch {
      setError(t('login.otpSendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async () => {
    if (!codeValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneOtp(toE164Thai(phone), code);
      // Record PDPA consent given at sign-in; the auth gate routes into the app.
      await authRepo.grantConsent('data_processing', 'v1').catch(() => {});
    } catch {
      setError(t('login.otpInvalid'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onSocial = async (provider: 'google') => {
    if (socialBusy) return;
    setSocialBusy(true);
    try {
      // Success flips the gate via the auth store's onAuthStateChange.
      await signInWithOAuthProvider(provider);
    } catch {
      Alert.alert(t('login.socialFailed'), t('login.socialFailedBody'));
    } finally {
      setSocialBusy(false);
    }
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
          { paddingTop: insets.top + Spacing.x3, paddingBottom: insets.bottom + Spacing.x2 },
        ]}>
        {/* Brand */}
        <View style={styles.brand}>
          <Image
            source={require('@/assets/images/logo-oofoo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text variant="title" style={styles.welcome}>
            {t('login.welcome')}
          </Text>
          <Text variant="body" style={styles.tagline}>
            {t('login.tagline')}
          </Text>
        </View>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>{t('login.phoneLabel')}</Text>
            <View style={styles.phoneField}>
              <View style={styles.dialCode}>
                <Text style={styles.dialCodeText}>+66</Text>
              </View>
              <TextInput
                value={formatPhone(phone)}
                onChangeText={(v) => setPhone(digitsOnly(v))}
                placeholder="081-234-5678"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={styles.phoneInput}
                maxLength={12}
                returnKeyType="done"
                onSubmitEditing={requestOtp}
              />
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('login.requestOtp')}
              disabled={!phoneValid || busy}
              onPress={requestOtp}
              style={[styles.primaryBtn, (!phoneValid || busy) && styles.primaryBtnOff]}>
              <Text style={styles.primaryText}>{busy ? t('login.sending') : t('login.requestOtp')}</Text>
            </PressableScale>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text variant="caption" style={styles.dividerText}>
                {t('login.orSignInWith')}
              </Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socials}>
              <SocialButton
                label={t('login.continueGoogle')}
                icon="logo-google"
                bg={BRAND.google}
                fg={Colors.text}
                bordered
                onPress={() => void onSocial('google')}
              />
            </View>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={10}
              onPress={() => setStep('phone')}
              style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
              <Text style={styles.backText}>{t('login.changePhone')}</Text>
            </Pressable>

            <Text variant="subtitle" style={styles.otpTitle}>
              {t('login.enterOtp')}
            </Text>
            <Text variant="body" style={styles.otpSub}>
              {t('login.otpSentTo')}{formatPhone(phone)}
            </Text>

            {/* OTP cells backed by one hidden input */}
            <Pressable style={styles.otpRow} onPress={() => otpRef.current?.focus()}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                const filled = i < code.length;
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    style={[styles.otpCell, (filled || active) && styles.otpCellActive]}>
                    <Text style={styles.otpDigit}>{code[i] ?? ''}</Text>
                  </View>
                );
              })}
              <TextInput
                ref={otpRef}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                style={styles.otpHidden}
                autoFocus
              />
            </Pressable>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('login.verifyCode')}
              disabled={!codeValid || busy}
              onPress={confirmOtp}
              style={[styles.primaryBtn, (!codeValid || busy) && styles.primaryBtnOff]}>
              <Text style={styles.primaryText}>{busy ? t('login.verifying') : t('login.verify')}</Text>
            </PressableScale>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('login.resendA11y')}
              hitSlop={8}
              onPress={() => setCode('')}
              style={styles.resend}>
              <Text style={styles.resendText}>{t('login.resend')}</Text>
            </Pressable>
          </>
        )}

        {/* PDPA consent */}
        <Text variant="caption" style={styles.consent}>
          {t('login.consentPrefix')}{' '}
          <Text style={styles.consentLink}>{t('login.terms')}</Text> {t('common.and')}{' '}
          <Text style={styles.consentLink}>{t('login.privacy')}</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.x2,
  },

  /* Brand */
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.x3,
  },
  logo: {
    width: 132,
    height: 58,
    marginBottom: Spacing.lg,
  },
  welcome: {
    color: Colors.text,
  },
  tagline: {
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  /* Phone */
  label: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  phoneField: {
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
  dialCode: {
    paddingRight: Spacing.sm,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  dialCodeText: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  phoneInput: {
    ...Typography.subtitle,
    flex: 1,
    color: Colors.text,
    padding: 0,
    letterSpacing: 1,
  },

  /* Primary button */
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  primaryBtnOff: {
    opacity: 0.45,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.dangerStrong,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  primaryText: {
    ...Typography.button,
    fontSize: 16,
    color: Colors.textOnPrimary,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
  },

  /* Social */
  socials: {
    gap: Spacing.md,
  },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: Radius.pill,
  },
  socialBordered: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  socialText: {
    ...Typography.button,
  },

  /* OTP */
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
  },
  backText: {
    ...Typography.button,
    color: Colors.text,
  },
  otpTitle: {
    color: Colors.text,
  },
  otpSub: {
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
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
  otpCellActive: {
    borderColor: Colors.primary,
  },
  otpDigit: {
    ...Typography.title,
    color: Colors.text,
  },
  otpHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resend: {
    alignSelf: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  resendText: {
    ...Typography.button,
    color: Colors.primaryStrong,
  },

  /* Consent */
  consent: {
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: Spacing.x2,
    lineHeight: 19,
  },
  consentLink: {
    color: Colors.primaryStrong,
  },
});
