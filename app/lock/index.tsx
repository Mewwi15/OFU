/**
 * App lock — `/lock`.
 *
 * The screen-lock a returning, signed-in user meets on every cold start /
 * return-from-background (gated by: authed && hasPin && locked). Unlock with the
 * 6-digit PIN or biometric (auto-prompted on mount when enabled). "ออกจากระบบ"
 * clears the lock and returns to login. Tokens only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/lock/PinPad';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { PIN_LENGTH, useLock } from '@/store/lock';

export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const verifyPin = useLock((s) => s.verifyPin);
  const unlock = useLock((s) => s.unlock);
  const resetLock = useLock((s) => s.resetLock);
  const biometricEnabled = useLock((s) => s.biometricEnabled);

  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [bioIcon, setBioIcon] = useState<keyof typeof Ionicons.glyphMap>('finger-print');
  const [bioReady, setBioReady] = useState(false);
  const checking = useRef(false);

  const runBiometric = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'ปลดล็อก อู้ฟู่',
      cancelLabel: 'ใช้ PIN',
    });
    if (res.success) unlock();
  }, [unlock]);

  // Probe biometric availability + auto-prompt once on mount when enabled.
  useEffect(() => {
    (async () => {
      if (!biometricEnabled) return;
      const [hasHw, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      if (!hasHw || !enrolled) return;
      setBioReady(true);
      setBioIcon(
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          ? 'scan-outline'
          : 'finger-print',
      );
      runBiometric();
    })();
  }, [biometricEnabled, runBiometric]);

  // Verify once the PIN fills up.
  useEffect(() => {
    if (entry.length !== PIN_LENGTH || checking.current) return;
    checking.current = true;
    (async () => {
      const ok = await verifyPin(entry); // unlocks on success
      if (!ok) {
        setError(true);
        setEntry('');
      }
      checking.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  const onChange = (next: string) => {
    if (error) setError(false);
    setEntry(next);
  };

  const confirmLogout = () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบและล้างรหัส PIN ใช่ไหม?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: async () => {
          await resetLock();
          logout();
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.x3 }]}>
      <View style={styles.header}>
        <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
        <Text variant="title" style={styles.greeting}>
          สวัสดี {user.name}
        </Text>
        <Text variant="body" style={styles.sub}>
          {error ? 'รหัส PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง' : 'กรอกรหัส PIN เพื่อเข้าใช้งาน'}
        </Text>
      </View>

      <View style={styles.padArea}>
        <PinPad
          value={entry}
          onChange={onChange}
          length={PIN_LENGTH}
          error={error}
          onBiometric={bioReady ? runBiometric : undefined}
          biometricIcon={bioIcon}
        />
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="ออกจากระบบ"
        onPress={confirmLogout}
        style={[styles.logout, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Text style={styles.logoutText}>ออกจากระบบ</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.x2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    marginBottom: Spacing.lg,
  },
  greeting: {
    textAlign: 'center',
  },
  sub: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  padArea: {
    flex: 1,
    justifyContent: 'center',
  },
  logout: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  logoutText: {
    ...Typography.button,
    color: Colors.dangerStrong,
  },
});
