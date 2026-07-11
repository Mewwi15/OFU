/**
 * Edit profile — `/account/edit`.
 *
 * Edits the signed-in customer's name, contact phone and email, plus an
 * optional password change (email-login accounts only). What's editable
 * depends on the login method: the credential itself (login phone / login
 * email) is read-only; everything else saves via the auth store in one tap.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { avatarSource } from '@/lib/avatar';
import { getAccountIdentity, toE164Thai } from '@/lib/data/auth';
import { uploadAvatar } from '@/lib/data/storage';
import { compressForUpload } from '@/lib/images';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/store/auth';

type FieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  /** Read-only display (e.g. the login phone number). */
  readOnly?: boolean;
  hint?: string;
  /** Error takes the hint slot in the warning colour. */
  error?: string;
  maxLength?: number;
  secure?: boolean;
};

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  readOnly = false,
  hint,
  error,
  maxLength,
  secure = false,
}: FieldProps) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, readOnly && styles.inputRowReadonly]}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={!readOnly}
          maxLength={maxLength}
          secureTextEntry={hidden}
          style={[styles.input, readOnly && styles.inputReadonly]}
        />
        {secure ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน'}
            onPress={() => setHidden((v) => !v)}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={Colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.fieldHint, styles.fieldError]}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** "+66812345678" (store display form) → local "0812345678" for editing. */
function toLocalThai(display: string): string {
  const digits = display.replace(/\D/g, '');
  return digits.startsWith('66') ? `0${digits.slice(2)}` : digits;
}

export default function EditProfileScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const updateProfile = useAuth((s) => s.updateProfile);
  const changePassword = useAuth((s) => s.changePassword);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(toLocalThai(user.phone));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Login method decides what's editable: the credential itself is read-only
  // (login phone / login email); a password only exists for email accounts.
  const [provider, setProvider] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getAccountIdentity()
      .then((id) => {
        if (alive) setProvider(id?.provider ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const phoneIsLogin = provider === 'phone';
  const emailIsLogin = provider === 'email';
  const hasPassword = provider === 'email';

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('editProfile.photoPermTitle'), t('editProfile.photoPermBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setAvatarBusy(true);
    try {
      // Avatars render small — 512px keeps them crisp at a fraction of the bytes.
      const photo = await compressForUpload(result.assets[0], { maxDim: 512, quality: 0.7 });
      const url = await uploadAvatar(photo.base64);
      await updateProfile({ avatar: url });
    } catch {
      Alert.alert(t('editProfile.avatarFailed'), t('editProfile.avatarFailedBody'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneChanged = !phoneIsLogin && phoneDigits !== toLocalThai(user.phone);
  const phoneValid = phoneDigits === '' || /^0\d{9}$/.test(phoneDigits);
  const wantsPassword = password.length > 0 || confirm.length > 0;
  const passwordValid = !wantsPassword || (password.length >= 6 && password === confirm);

  const dirty =
    name !== user.name || (!emailIsLogin && email !== user.email) || phoneChanged || wantsPassword;
  const canSave = dirty && name.trim().length > 0 && phoneValid && passwordValid && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const patch: { name: string; email?: string; phone?: string } = { name: name.trim() };
      if (!emailIsLogin && email !== user.email) patch.email = email.trim();
      if (phoneChanged) patch.phone = phoneDigits ? toE164Thai(phoneDigits) : '';
      await updateProfile(patch);
      if (wantsPassword) await changePassword(password);
      setSaved(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      Alert.alert(
        t('editProfile.saveFailed'),
        /duplicate|unique|23505/i.test(msg)
          ? t('editProfile.phoneTaken')
          : t('editProfile.saveFailedBody'),
      );
    } finally {
      setSaving(false);
    }
  };

  // Hide the toast first, then leave on the next frame — navigating while the
  // toast's exit animation is mid-flight tears down the surface and trips
  // Fabric's "Unable to find viewState" redbox. Idempotent so the action tap
  // and the auto-timer can't both fire a back().
  const leaving = useRef(false);
  const finish = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setSaved(false);
    requestAnimationFrame(() => router.back());
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('editProfile.title')}
        style={styles.header}
        left={
          <IconButton
            icon="chevron-back"
            variant="tint"
            shape="rounded"
            size={40}
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
          />
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <Image
              source={avatarSource(user.avatar)}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('editProfile.changePhoto')}
              disabled={avatarBusy}
              onPress={() => void pickAvatar()}
              style={styles.avatarEdit}>
              {avatarBusy ? (
                <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              ) : (
                <Ionicons name="camera" size={16} color={Colors.textOnPrimary} />
              )}
            </PressableScale>
          </View>

          <Field
            label={t('editProfile.name')}
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder={t('editProfile.namePlaceholder')}
          />
          {phoneIsLogin ? (
            <Field
              label={t('editProfile.phone')}
              icon="call-outline"
              value={user.phone}
              onChangeText={() => {}}
              placeholder="—"
              keyboardType="phone-pad"
              readOnly
              hint={t('editProfile.phoneHint')}
            />
          ) : (
            <Field
              label={t('editProfile.phone')}
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder={t('editProfile.phonePlaceholder')}
              keyboardType="phone-pad"
              maxLength={12}
              hint={t('editProfile.phoneHintEditable')}
              error={phoneValid ? undefined : t('editProfile.phoneInvalid')}
            />
          )}
          <Field
            label={t('editProfile.email')}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            readOnly={emailIsLogin}
            hint={emailIsLogin ? t('editProfile.emailLoginHint') : undefined}
          />

          {hasPassword ? (
            <View style={styles.passwordSection}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t('editProfile.passwordSection')}
              </Text>
              <Text style={styles.sectionHint}>{t('editProfile.passwordSectionHint')}</Text>
              <Field
                label={t('editProfile.newPassword')}
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                autoCapitalize="none"
                secure
                error={
                  password.length > 0 && password.length < 6
                    ? t('editProfile.passwordShort')
                    : undefined
                }
              />
              <Field
                label={t('editProfile.confirmPassword')}
                icon="lock-closed-outline"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••"
                autoCapitalize="none"
                secure
                error={
                  confirm.length > 0 && confirm !== password
                    ? t('editProfile.passwordMismatch')
                    : undefined
                }
              />
            </View>
          ) : null}
        </ScrollView>

        {/* Save */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('editProfile.save')}
            disabled={!canSave}
            onPress={() => void onSave()}
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.saveText}>{t('editProfile.save')}</Text>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {saved ? (
        <Toast
          message={t('editProfile.savedToast')}
          onAction={finish}
          actionLabel={t('editProfile.done')}
          onHide={finish}
          duration={1600}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  field: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    padding: 0,
  },
  inputRowReadonly: {
    backgroundColor: Colors.surfaceMuted,
    borderColor: 'transparent',
  },
  inputReadonly: {
    color: Colors.textMuted,
  },
  fieldHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  fieldError: {
    color: Colors.dangerStrong,
  },
  passwordSection: {
    marginTop: Spacing.md,
    gap: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: -Spacing.sm,
  },
  sectionHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  saveBtnOff: {
    opacity: 0.45,
  },
  saveText: {
    ...Typography.button,
    fontSize: 16,
    color: Colors.textOnPrimary,
  },
});
