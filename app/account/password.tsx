/**
 * Change password — `/account/password` (email-login accounts only).
 *
 * รหัสเดิม → รหัสใหม่ → ยืนยัน. The current password is verified against
 * Supabase (signInWithPassword re-auth) before auth.updateUser sets the new
 * one, so a stolen unlocked phone can't silently take over the account.
 */

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
import { getAccountIdentity } from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/store/auth';

export default function ChangePasswordScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signInEmail = useAuth((s) => s.signInEmail);
  const changePassword = useAuth((s) => s.changePassword);

  const [loginEmail, setLoginEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // The login email is what the re-auth check runs against.
  useEffect(() => {
    let alive = true;
    getAccountIdentity()
      .then((id) => {
        if (alive && id?.email) setLoginEmail(id.email);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const nextValid = next.length >= 6;
  const confirmValid = confirm === next;
  const differs = next !== current;
  const canSave =
    !saving &&
    loginEmail.length > 0 &&
    current.length > 0 &&
    nextValid &&
    confirm.length > 0 &&
    confirmValid &&
    differs;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Re-auth: proves the person tapping save knows the current password.
      try {
        await signInEmail(loginEmail, current);
      } catch {
        Alert.alert(t('password.failed'), t('password.wrongCurrent'));
        return;
      }
      await changePassword(next);
      setSaved(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      Alert.alert(
        t('password.failed'),
        /different from the old/i.test(msg)
          ? t('password.mustDiffer')
          : t('editProfile.saveFailedBody'),
      );
    } finally {
      setSaving(false);
    }
  };

  // Same toast-then-back dance as edit-profile (see the comment there).
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
        title={t('password.title')}
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
          <Text style={styles.intro}>{t('password.intro')}</Text>

          <FormField
            label={t('password.current')}
            icon="lock-closed-outline"
            value={current}
            onChangeText={setCurrent}
            placeholder="••••••"
            autoCapitalize="none"
            secure
          />
          <FormField
            label={t('password.new')}
            icon="key-outline"
            value={next}
            onChangeText={setNext}
            placeholder="••••••"
            autoCapitalize="none"
            secure
            hint={t('password.newHint')}
            error={
              next.length > 0 && !nextValid
                ? t('editProfile.passwordShort')
                : next.length > 0 && !differs
                  ? t('password.mustDiffer')
                  : undefined
            }
          />
          <FormField
            label={t('password.confirm')}
            icon="key-outline"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••"
            autoCapitalize="none"
            secure
            error={
              confirm.length > 0 && !confirmValid
                ? t('editProfile.passwordMismatch')
                : undefined
            }
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('password.save')}
            disabled={!canSave}
            onPress={() => void onSave()}
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.saveText}>{t('password.save')}</Text>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {saved ? (
        <Toast
          message={t('password.savedToast')}
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
  intro: {
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
