/**
 * Create app lock — `/lock/setup`.
 *
 * Shown right after the first sign-in (gated by: authed && !hasPin). The user
 * sets a 6-digit PIN (enter → confirm), then — if the device supports it — opts
 * into biometric unlock. Saving the PIN unlocks the app and the root gate hands
 * off to the tabs. Tokens only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/lock/PinPad';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { PIN_LENGTH, useLock } from '@/store/lock';

type Step = 'create' | 'confirm' | 'biometric';

export default function LockSetupScreen() {
  const insets = useSafeAreaInsets();
  const setPin = useLock((s) => s.setPin);
  const setBiometricEnabled = useLock((s) => s.setBiometricEnabled);

  const [step, setStep] = useState<Step>('create');
  const [first, setFirst] = useState('');
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioIcon, setBioIcon] = useState<keyof typeof Ionicons.glyphMap>('finger-print');
  const [bioLabel, setBioLabel] = useState('ไบโอเมทริก');

  useEffect(() => {
    (async () => {
      const [hasHw, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      if (hasHw && enrolled) {
        setBioAvailable(true);
        const isFace = types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        );
        setBioIcon(isFace ? 'scan-outline' : 'finger-print');
        setBioLabel(isFace ? 'Face ID' : 'ลายนิ้วมือ');
      }
    })();
  }, []);

  // Drive the two PIN steps as the entry fills up.
  useEffect(() => {
    if (entry.length !== PIN_LENGTH) return;

    if (step === 'create') {
      setFirst(entry);
      setEntry('');
      setStep('confirm');
      return;
    }
    if (step === 'confirm') {
      if (entry === first) {
        if (bioAvailable) {
          setStep('biometric');
        } else {
          finalize(false);
        }
      } else {
        // Mismatch — shake and restart.
        setError(true);
        setEntry('');
        setFirst('');
        setStep('create');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  const onChange = (next: string) => {
    if (error) setError(false);
    setEntry(next);
  };

  const finalize = async (enableBio: boolean) => {
    await setBiometricEnabled(enableBio);
    await setPin(first); // unlocks + flips the gate to the app
  };

  const enableBiometric = async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: `ยืนยันด้วย${bioLabel}เพื่อเปิดใช้งาน`,
      cancelLabel: 'ยกเลิก',
    });
    finalize(res.success);
  };

  const heading =
    step === 'create' ? 'ตั้งรหัส PIN' : step === 'confirm' ? 'ยืนยันรหัส PIN' : 'ปลดล็อกให้เร็วขึ้น';
  const sub =
    step === 'create'
      ? `ตั้งรหัส ${PIN_LENGTH} หลักไว้ล็อกแอปของคุณ`
      : step === 'confirm'
        ? 'กรอกรหัสเดิมอีกครั้งเพื่อยืนยัน'
        : `เปิดใช้ ${bioLabel} เพื่อปลดล็อกแอปได้เร็วขึ้น`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.x2 }]}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons
            name={step === 'biometric' ? bioIcon : 'lock-closed'}
            size={30}
            color={Colors.primaryStrong}
          />
        </View>
        <Text variant="title" style={styles.heading}>
          {heading}
        </Text>
        <Text variant="body" style={styles.sub}>
          {sub}
        </Text>
        {error ? <Text style={styles.errorText}>รหัสไม่ตรงกัน ลองใหม่อีกครั้ง</Text> : null}
      </View>

      {step === 'biometric' ? (
        <View style={[styles.bioActions, { paddingBottom: insets.bottom + Spacing.x2 }]}>
          <Button onPress={enableBiometric} style={styles.bioBtn}>
            {`เปิดใช้ ${bioLabel}`}
          </Button>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="ข้ามไปก่อน"
            onPress={() => finalize(false)}
            style={styles.skipBtn}>
            <Text style={styles.skipText}>ข้ามไปก่อน</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.padArea}>
          <PinPad value={entry} onChange={onChange} length={PIN_LENGTH} error={error} />
        </View>
      )}
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
  badge: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  heading: {
    textAlign: 'center',
  },
  sub: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.dangerStrong,
    marginTop: Spacing.sm,
  },
  padArea: {
    flex: 1,
    justifyContent: 'center',
  },
  bioActions: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  bioBtn: {
    width: '100%',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  skipText: {
    ...Typography.button,
    color: Colors.textMuted,
  },
});
