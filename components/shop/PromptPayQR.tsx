/**
 * PromptPayQR — a Thai-QR-style payment card.
 *
 * Renders a scannable PromptPay QR (encoding the shop's receiving id + the exact
 * order amount) inside a clean white slip: a coral header band, the QR in a soft
 * frame, the prefilled amount, and the account name + number with copy and
 * save-image actions. Saving writes the QR PNG to the photo library (add-only
 * permission) so the customer can pick it from the gallery inside their banking
 * app — the QR embeds its own quiet zone so gallery scans decode reliably.
 *
 * The parent owns clipboard + toast via `onCopyNumber`; saving is self-contained
 * here (it owns the QR ref). Tokens-only, zero emoji.
 *
 * Note: the header reads "พร้อมเพย์ · Thai QR Payment" as text rather than the
 * official PromptPay/Thai-QR logo artwork. Drop the real logo asset in here
 * before launch (brand-guideline requirement).
 */

import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { promptPayPayload } from '@/lib/promptpay';

const QR_SIZE = 196;

/** Pretty-print a 10-digit Thai phone PromptPay id: 0812345678 -> 081-234-5678. */
function formatTarget(target: string): string {
  if (/^\d{10}$/.test(target)) {
    return `${target.slice(0, 3)}-${target.slice(3, 6)}-${target.slice(6)}`;
  }
  return target;
}

type Props = {
  /** PromptPay id the QR encodes (phone / citizen-id / e-wallet). */
  target: string;
  /** Order amount in Baht — prefilled into the QR. */
  amount: number;
  /** Account-holder name shown under the QR. */
  displayName: string;
  /** Called when the user taps "คัดลอก" — parent copies + toasts. */
  onCopyNumber: () => void;
};

export function PromptPayQR({ target, amount, displayName, onCopyNumber }: Props) {
  const t = useT();
  const payload = promptPayPayload(target, amount);
  // react-native-qrcode-svg exposes toDataURL on the underlying svg element.
  const qrRef = useRef<{ toDataURL: (cb: (b64: string) => void) => void } | null>(null);
  const [saving, setSaving] = useState(false);

  const saveImage = async () => {
    if (saving || !qrRef.current) return;
    setSaving(true);
    try {
      if (Platform.OS === 'web') {
        // No photo library on web — hand the PNG to the browser as a download.
        const b64 = await new Promise<string>((resolve) => qrRef.current!.toDataURL(resolve));
        const a = document.createElement('a');
        a.href = `data:image/png;base64,${b64}`;
        a.download = 'oofoo-promptpay-qr.png';
        a.click();
        return;
      }
      const { granted } = await MediaLibrary.requestPermissionsAsync(true); // add-only
      if (!granted) {
        Alert.alert(t('qr.savePermissionTitle'), t('qr.savePermissionBody'));
        return;
      }
      const b64 = await new Promise<string>((resolve) => qrRef.current!.toDataURL(resolve));
      const file = new File(Paths.cache, `oofoo-qr-${Date.now()}.png`);
      file.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      await MediaLibrary.saveToLibraryAsync(file.uri);
      Alert.alert(t('qr.savedTitle'), t('qr.savedBody'));
    } catch {
      Alert.alert(t('qr.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header band */}
      <View style={styles.band}>
        <Ionicons name="qr-code" size={18} color={Colors.textOnPrimary} />
        <Text style={styles.bandText}>{t('qr.header')}</Text>
      </View>

      {/* QR */}
      <View style={styles.qrWrap}>
        <View style={styles.qrFrame}>
          <QRCode
            value={payload}
            size={QR_SIZE}
            color={Colors.text}
            backgroundColor={Colors.surface}
            ecl="M"
            quietZone={12}
            getRef={(c) => {
              qrRef.current = c;
            }}
          />
        </View>
        <Text style={styles.amountLabel}>{t('qr.amountDue')}</Text>
        <Text style={styles.amount}>{money(amount)}</Text>
      </View>

      <View style={styles.hairline} />

      {/* Account row */}
      <View style={styles.accountRow}>
        <View style={styles.accountInfo}>
          <Text variant="caption">{t('qr.accountName')}</Text>
          <Text style={styles.accountName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.accountNo}>{formatTarget(target)}</Text>
        </View>
        <View style={styles.actionCol}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('qr.copyNumberA11y')}
            onPress={onCopyNumber}
            style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={16} color={Colors.primaryStrong} />
            <Text style={styles.copyText}>{t('qr.copy')}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('qr.saveA11y')}
            onPress={() => void saveImage()}
            style={styles.copyBtn}>
            <Ionicons name="download-outline" size={16} color={Colors.primaryStrong} />
            <Text style={styles.copyText}>
              {saving ? t('qr.saving') : t('qr.save')}
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.primary,
  },
  bandText: {
    ...Typography.button,
    color: Colors.textOnPrimary,
  },
  qrWrap: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  qrFrame: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  amountLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
  amount: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: Spacing.xxs,
  },
  hairline: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  accountInfo: {
    flex: 1,
    gap: 1,
  },
  accountName: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  accountNo: {
    ...Typography.price,
    color: Colors.primaryStrong,
    letterSpacing: 0.5,
  },
  actionCol: {
    gap: Spacing.sm,
    alignItems: 'stretch',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  copyText: {
    ...Typography.button,
    color: Colors.primaryStrong,
  },
});
