/**
 * Edit profile — `/account/edit`.
 *
 * Edits the signed-in customer's name, contact phone and email. What's
 * editable depends on the login method: the credential itself (login phone /
 * login email) is read-only. Password changes live on their own screen
 * (`/account/password`), reached from the account menu.
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
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/components/ui/FormField';
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

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(toLocalThai(user.phone));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Login method decides what's editable: the credential itself is read-only
  // (login phone / login email).
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

  const pickAvatar = async () => {
    // OS photo picker — no media-library permission needed.
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

  const dirty = name !== user.name || (!emailIsLogin && email !== user.email) || phoneChanged;
  const canSave = dirty && name.trim().length > 0 && phoneValid && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const patch: { name: string; email?: string; phone?: string } = { name: name.trim() };
      if (!emailIsLogin && email !== user.email) patch.email = email.trim();
      if (phoneChanged) patch.phone = phoneDigits ? toE164Thai(phoneDigits) : '';
      await updateProfile(patch);
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

          <FormField
            label={t('editProfile.name')}
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder={t('editProfile.namePlaceholder')}
          />
          {phoneIsLogin ? (
            <FormField
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
            <FormField
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
          <FormField
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
