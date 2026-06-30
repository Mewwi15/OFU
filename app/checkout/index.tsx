/**
 * Checkout / payment screen — `/checkout`.
 *
 * Reached after the customer slides to confirm in the cart's CheckoutSheet. It
 * reads the ticked cart lines + current mode, shows the amount due, lets the
 * customer pick a payment method, and — for PromptPay — renders a scannable Thai
 * QR for the exact amount, the shop account (with copy), and a slip-upload zone.
 * Confirming runs `verifyPayment` (a stub today; the real Slip/Gateway API lands
 * in the backend phase) through idle -> verifying -> success, then clears the
 * paid lines and returns to the cart.
 *
 * Coral is the sole interactive/price accent; ink carries the amount due; green
 * marks the verified-success state. Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PromptPayQR } from '@/components/shop/PromptPayQR';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { attachSlip, orderErrorMessage, placeOrder, type PlacedOrder } from '@/lib/data/order';
import { useShop } from '@/store/shop';
import { money } from '@/lib/format';
import { type PaymentMethod } from '@/lib/payment';
import { selectedAddress, useAddress } from '@/store/address';
import { cartCount, cartSubtotal, selectedItems, useCart } from '@/store/cart';
import { deliveryFeeFor, useMode } from '@/store/mode';
import { useOrder } from '@/store/order';

type Status = 'idle' | 'verifying' | 'success';

/** A selectable payment method row. */
type MethodOption = {
  key: PaymentMethod;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
};

const PROMPTPAY_OPTION: MethodOption = {
  key: 'promptpay',
  icon: 'qr-code-outline',
  title: 'พร้อมเพย์ / โอนเงิน',
  caption: 'สแกน QR แล้วแนบสลิปการโอน',
};

const COD_OPTION: MethodOption = {
  key: 'cod',
  icon: 'cash-outline',
  title: 'เก็บเงินปลายทาง',
  caption: 'ชำระเงินสดกับไรเดอร์เมื่อรับของ',
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useCart((s) => s.items);
  const selectedIds = useCart((s) => s.selectedIds);
  const removeSelected = useCart((s) => s.removeSelected);
  const mode = useMode((s) => s.mode);
  const promptPay = useShop((s) => s.info.promptPay);
  const address = useAddress(selectedAddress);

  const chosen = selectedItems(items, selectedIds);
  const subtotal = cartSubtotal(chosen);
  const count = cartCount(chosen);
  const deliveryFee = deliveryFeeFor(mode, subtotal);
  const total = subtotal + deliveryFee;

  // Online flow pays up-front (PromptPay only); delivery defaults to COD but may
  // also pay by PromptPay.
  const methods: MethodOption[] =
    mode === 'delivery' ? [COD_OPTION, PROMPTPAY_OPTION] : [PROMPTPAY_OPTION];

  const [method, setMethod] = useState<PaymentMethod>(
    mode === 'delivery' ? 'cod' : 'promptpay',
  );
  const [slipUri, setSlipUri] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  const needsSlip = method === 'promptpay';
  const canConfirm = !needsSlip || !!slipUri;
  const ctaLabel = method === 'cod' ? 'ยืนยันสั่งซื้อ' : 'ยืนยันการชำระเงิน';

  /* ----- Guard: nothing to pay for (e.g. opened with an empty selection) ---- */
  if (chosen.length === 0 && status !== 'success') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="ชำระเงิน"
          style={styles.header}
          left={
            <IconButton
              icon="chevron-back"
              accessibilityLabel="ย้อนกลับ"
              onPress={() => router.back()}
            />
          }
        />
        <View style={styles.guard}>
          <Ionicons name="cart-outline" size={40} color={Colors.primaryStrong} />
          <Text variant="subtitle" style={styles.guardTitle}>
            ไม่มีรายการให้ชำระ
          </Text>
          <Text variant="body" style={styles.guardBody}>
            กลับไปเลือกสินค้าในตะกร้าก่อนนะ
          </Text>
        </View>
      </View>
    );
  }

  const copyNumber = async () => {
    await Clipboard.setStringAsync(promptPay.target);
    setCopied(true);
  };

  const pickSlip = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'ต้องการสิทธิ์เข้าถึงรูปภาพ',
        'อนุญาตการเข้าถึงรูปภาพเพื่อแนบสลิปการโอนเงิน',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setSlipUri(result.assets[0].uri);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    }
  };

  const onConfirm = async () => {
    if (status === 'verifying') return;
    if (needsSlip && !slipUri) {
      Alert.alert('ยังไม่ได้แนบสลิป', 'กรุณาแนบสลิปการโอนเงินก่อนยืนยัน');
      return;
    }
    if (!address) {
      Alert.alert('ยังไม่มีที่อยู่จัดส่ง', 'กรุณาเลือกที่อยู่ก่อนสั่งซื้อ');
      return;
    }
    if (chosen.length === 0) return;
    setStatus('verifying');
    try {
      // The selected address is already a backend row; place the order on it.
      const order = await placeOrder({
        items: chosen,
        mode,
        paymentMethod: method === 'cod' ? 'cod' : 'promptpay_slip',
        addressId: address.id,
        promoCode: null,
      });
      // Prepay: record the uploaded slip (the file upload to Storage lands later).
      if (method !== 'cod') {
        await attachSlip(order.id, `payment-slips/${order.id}.jpg`, order.total).catch(() => {});
      }
      setPlaced(order);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setStatus('success');
    } catch (e) {
      setStatus('idle');
      Alert.alert('สั่งซื้อไม่สำเร็จ', orderErrorMessage(e));
    }
  };

  // Once the success card is closed: clear the paid lines, then start tracking —
  // delivery → live rider map, online → Flash parcel timeline.
  const finishSuccess = () => {
    removeSelected();
    // The order lives in the DB now; the tracking screen loads it by number.
    if (placed) router.replace(`/order/${placed.orderNumber}`);
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="ชำระเงิน"
        style={styles.header}
        left={
          <IconButton
            icon="chevron-back"
            accessibilityLabel="ย้อนกลับ"
            onPress={() => router.back()}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}>
        {/* Amount due */}
        <View style={styles.amountCard}>
          <Text variant="caption">ยอดที่ต้องชำระ</Text>
          <Text style={styles.amountValue}>{money(total)}</Text>
          <View style={styles.amountMeta}>
            <Ionicons
              name={mode === 'delivery' ? 'bicycle-outline' : 'cube-outline'}
              size={14}
              color={Colors.textMuted}
            />
            <Text variant="caption" style={styles.amountMetaText}>
              {count} ชิ้น · {mode === 'delivery' ? 'จัดส่งถึงบ้าน' : 'ส่งผ่าน Flash Express'}
            </Text>
          </View>

          {/* Breakdown */}
          <View style={styles.breakdown}>
            <View style={styles.breakRow}>
              <Text variant="caption">ยอดรวมสินค้า</Text>
              <Text style={styles.breakValue}>{money(subtotal)}</Text>
            </View>
            <View style={[styles.breakRow, styles.breakRowGap]}>
              <Text variant="caption">
                {mode === 'delivery' ? 'ค่าจัดส่ง' : 'ค่าส่ง Flash'}
              </Text>
              {deliveryFee === 0 ? (
                <Text style={[styles.breakValue, { color: Colors.accentStrong }]}>
                  ฟรี
                </Text>
              ) : (
                <Text style={styles.breakValue}>{money(deliveryFee)}</Text>
              )}
            </View>
          </View>

          {address ? (
            <View style={styles.addrRow}>
              <Ionicons
                name={mode === 'delivery' ? 'location-outline' : 'cube-outline'}
                size={14}
                color={Colors.textMuted}
              />
              <Text variant="caption" style={styles.addrText} numberOfLines={2}>
                {mode === 'online'
                  ? `${address.recipient} · ${address.phone} · ${[address.line, address.subDistrict, address.district, address.province, address.postalCode].filter(Boolean).join(' ')}`
                  : `${address.label} · ${address.line}`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Payment method */}
        <Text style={styles.eyebrow}>วิธีชำระเงิน</Text>
        <View style={styles.methodCard}>
          {methods.map((m, i) => {
            const active = m.key === method;
            return (
              <View key={m.key}>
                {i > 0 ? <View style={styles.insetHairline} /> : null}
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={m.title}
                  scaleTo={0.99}
                  onPress={() => setMethod(m.key)}
                  style={styles.methodRow}>
                  <View style={[styles.methodIcon, active && styles.methodIconOn]}>
                    <Ionicons
                      name={m.icon}
                      size={20}
                      color={active ? Colors.textOnPrimary : Colors.primaryStrong}
                    />
                  </View>
                  <View style={styles.methodBody}>
                    <Text style={styles.methodTitle}>{m.title}</Text>
                    <Text variant="caption">{m.caption}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? Colors.primary : Colors.borderStrong}
                  />
                </PressableScale>
              </View>
            );
          })}
        </View>

        {/* PromptPay detail */}
        {method === 'promptpay' ? (
          <Animated.View entering={FadeIn.duration(220)}>
            <PromptPayQR
              target={promptPay.target}
              amount={total}
              displayName={promptPay.displayName}
              onCopyNumber={copyNumber}
            />

            <Text style={[styles.eyebrow, styles.eyebrowTop]}>แนบสลิปการโอนเงิน</Text>
            {slipUri ? (
              <View style={styles.slipCard}>
                <Image
                  source={{ uri: slipUri }}
                  style={styles.slipThumb}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.slipBody}>
                  <View style={styles.slipDoneRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={Colors.accentStrong}
                    />
                    <Text style={styles.slipDoneText}>แนบสลิปแล้ว</Text>
                  </View>
                  <Text variant="caption">ระบบจะตรวจสอบยอดเงินให้อัตโนมัติ</Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="เปลี่ยนรูปสลิป"
                    hitSlop={8}
                    onPress={pickSlip}
                    style={styles.slipChange}>
                    <Ionicons name="image-outline" size={14} color={Colors.primaryStrong} />
                    <Text style={styles.slipChangeText}>เปลี่ยนรูป</Text>
                  </PressableScale>
                </View>
                <IconButton
                  icon="close"
                  size={32}
                  accessibilityLabel="ลบสลิป"
                  color={Colors.textMuted}
                  onPress={() => setSlipUri(null)}
                />
              </View>
            ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="แนบสลิปการโอนเงิน"
                scaleTo={0.98}
                onPress={pickSlip}
                style={styles.slipDrop}>
                <View style={styles.slipDropIcon}>
                  <Ionicons name="cloud-upload-outline" size={24} color={Colors.primaryStrong} />
                </View>
                <Text style={styles.slipDropTitle}>แตะเพื่อแนบสลิป</Text>
                <Text variant="caption" style={styles.slipDropCaption}>
                  เลือกรูปสลิปการโอนจากแกลเลอรี
                </Text>
              </PressableScale>
            )}
          </Animated.View>
        ) : (
          <View style={styles.codNote}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primaryStrong} />
            <Text variant="caption" style={styles.codNoteText}>
              เตรียมเงินสด {money(total)} ชำระกับไรเดอร์เมื่อรับสินค้าได้เลย
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky confirm bar */}
      <View
        style={[
          styles.confirmBar,
          { paddingBottom: insets.bottom + Spacing.sm },
        ]}>
        {needsSlip && !slipUri ? (
          <Text variant="caption" style={styles.confirmHint}>
            แนบสลิปการโอนเพื่อยืนยันการชำระเงิน
          </Text>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          disabled={!canConfirm || status === 'verifying'}
          onPress={onConfirm}
          style={[styles.confirmCta, !canConfirm && styles.confirmCtaOff]}>
          <Text style={styles.confirmCtaText}>{ctaLabel}</Text>
          <Text style={styles.confirmCtaAmount}>{money(total)}</Text>
        </PressableScale>
      </View>

      {/* Verifying overlay */}
      {status === 'verifying' ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.verifyText}>กำลังตรวจสอบการชำระเงิน</Text>
            <Text variant="caption" style={styles.verifySub}>
              สักครู่นะ กำลังยืนยันยอดเงิน
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Success */}
      {status === 'success' ? (
        <Toast
          message="ชำระเงินสำเร็จ"
          subtitle={
            method === 'cod'
              ? 'รับออเดอร์แล้ว เตรียมเงินสดไว้รับของได้เลย'
              : 'ยืนยันยอดเรียบร้อย ขอบคุณที่อุดหนุนร้านอู้ฟู่'
          }
          actionLabel="เสร็จสิ้น"
          onAction={finishSuccess}
          onHide={finishSuccess}
          duration={3200}
        />
      ) : null}

      {/* Copied toast */}
      {copied ? (
        <Toast
          message="คัดลอกแล้ว"
          subtitle="วางหมายเลขพร้อมเพย์ในแอปธนาคารได้เลย"
          onHide={() => setCopied(false)}
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
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  eyebrow: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  eyebrowTop: {
    marginTop: Spacing.x2,
  },
  insetHairline: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },

  /* Amount card */
  amountCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.x2,
    ...Shadow.card,
  },
  amountValue: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: Spacing.xxs,
  },
  amountMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  amountMetaText: {
    color: Colors.textMuted,
  },
  breakdown: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakRowGap: {
    marginTop: Spacing.sm,
  },
  breakValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  addrText: {
    flex: 1,
  },

  /* Method selector */
  methodCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.x2,
    ...Shadow.card,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconOn: {
    backgroundColor: Colors.primary,
  },
  methodBody: {
    flex: 1,
    gap: 1,
  },
  methodTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },

  /* Slip upload */
  slipDrop: {
    alignItems: 'center',
    paddingVertical: Spacing.x2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: Colors.surface,
  },
  slipDropIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  slipDropTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  slipDropCaption: {
    marginTop: 2,
    textAlign: 'center',
  },
  slipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  slipThumb: {
    width: 56,
    height: 72,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  slipBody: {
    flex: 1,
    gap: 2,
  },
  slipDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  slipDoneText: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  slipChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    marginTop: Spacing.xs,
  },
  slipChangeText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },

  /* COD note */
  codNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryTint,
  },
  codNoteText: {
    flex: 1,
    color: Colors.text,
  },

  /* Confirm bar */
  confirmBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.float,
  },
  confirmHint: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  confirmCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: Spacing.x2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  confirmCtaOff: {
    opacity: 0.45,
  },
  confirmCtaText: {
    ...Typography.button,
    fontSize: 16,
    color: Colors.textOnPrimary,
  },
  confirmCtaAmount: {
    ...Typography.title,
    color: Colors.textOnPrimary,
  },

  /* Verifying overlay */
  verifyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.scrim,
    paddingHorizontal: Spacing.x2,
  },
  verifyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.x2,
    paddingHorizontal: Spacing.x3,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  verifyText: {
    ...Typography.subtitle,
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  verifySub: {
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },

  /* Guard (empty selection) */
  guard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
    gap: Spacing.sm,
  },
  guardTitle: {
    marginTop: Spacing.sm,
  },
  guardBody: {
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
