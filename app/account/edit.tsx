/**
 * Edit profile — `/account/edit`.
 *
 * Edits the signed-in customer's name, phone and email (the fields surfaced on
 * the account screen). Saving patches the auth store and returns. Frontend-first:
 * persists to the in-memory store; the backend sync lands later.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { uploadAvatar } from '@/lib/data/storage';
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
}: FieldProps) {
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
          style={[styles.input, readOnly && styles.inputReadonly]}
        />
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const updateProfile = useAuth((s) => s.updateProfile);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saved, setSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์เข้าถึงรูปภาพ', 'อนุญาตการเข้าถึงรูปภาพเพื่อเปลี่ยนรูปโปรไฟล์');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;
    setAvatarBusy(true);
    try {
      const url = await uploadAvatar(result.assets[0].base64);
      await updateProfile({ avatar: url });
    } catch {
      Alert.alert('อัปโหลดไม่สำเร็จ', 'ไม่สามารถเปลี่ยนรูปโปรไฟล์ได้ กรุณาลองใหม่');
    } finally {
      setAvatarBusy(false);
    }
  };

  const dirty = name !== user.name || email !== user.email;
  const canSave = dirty && name.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    updateProfile({ name: name.trim(), email: email.trim() });
    setSaved(true);
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
        title="แก้ไขโปรไฟล์"
        style={styles.header}
        left={
          <IconButton icon="chevron-back" accessibilityLabel="ย้อนกลับ" onPress={() => router.back()} />
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
              source={{ uri: user.avatar }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="เปลี่ยนรูปโปรไฟล์"
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
            label="ชื่อ"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="ชื่อของคุณ"
          />
          <Field
            label="เบอร์โทรศัพท์"
            icon="call-outline"
            value={user.phone}
            onChangeText={() => {}}
            placeholder="—"
            keyboardType="phone-pad"
            readOnly
            hint="เบอร์ที่ใช้เข้าสู่ระบบ เปลี่ยนไม่ได้"
          />
          <Field
            label="อีเมล"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </ScrollView>

        {/* Save */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="บันทึก"
            disabled={!canSave}
            onPress={onSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}>
            <Text style={styles.saveText}>บันทึก</Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {saved ? (
        <Toast
          message="บันทึกโปรไฟล์แล้ว"
          onAction={finish}
          actionLabel="เสร็จสิ้น"
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
