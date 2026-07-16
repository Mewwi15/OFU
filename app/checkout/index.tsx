/**
 * Checkout / payment screen — `/checkout`.
 *
 * Reached after the customer slides to confirm in the cart's CheckoutSheet. It
 * reads the ticked cart lines + current mode, shows the amount due, lets the
 * customer pick a payment method, and — for PromptPay — renders a scannable Thai
 * QR for the exact amount, the shop account (with copy), and a slip-upload zone.
 *
 * The money shown here is the SERVER'S, never ours. The client cannot price an
 * order: the promo is re-priced by `validate_promo`/`place_order` against the
 * live subtotal, and the parcel fee lives in `shop_settings` where the owner
 * edits it. So PromptPay runs in two steps — place the order first, then render
 * the QR from `placed.total` — and every amount before that is labelled an
 * estimate and carries no QR. A QR is a payment instruction: showing one we
 * computed ourselves is how a customer transfers the wrong amount.
 *
 * idle -> placing -> awaiting_payment -> verifying -> success  (PromptPay)
 * idle -> placing -> success                                   (COD)
 *
 * Coral is the sole interactive/price accent; ink carries the amount due; green
 * marks the verified-success state. Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import {
  attachSlip,
  orderErrorMessage,
  placeOrder,
  validatePromo,
  type PlacedOrder,
} from '@/lib/data/order';
import { uploadSlip } from '@/lib/data/storage';
import { compressForUpload } from '@/lib/images';
import { useShop } from '@/store/shop';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { type PaymentMethod } from '@/lib/payment';
import { uuidv4 } from '@/lib/uuid';
import { selectedAddress, useAddress } from '@/store/address';
import { useAuth } from '@/store/auth';
import { cartCount, cartSubtotal, selectedItems, useCart, type CartItem } from '@/store/cart';
import { deliveryFeeFor, useMode } from '@/store/mode';

type Status = 'idle' | 'placing' | 'awaiting_payment' | 'verifying' | 'success';

/**
 * Survives unmount for the app session. Placing the order before the QR means
 * backing out of checkout leaves a real awaiting-payment order behind that is
 * already holding committed stock — so coming back has to resume THAT order
 * rather than place a second one. Keyed by what the order is made of: an
 * identical attempt reuses the idempotency key, and `place_order` replays the
 * order it already created (H1). A genuinely different cart is a different
 * order and correctly gets a new key.
 */
let pendingAttempt: { signature: string; key: string; order: PlacedOrder | null } | null = null;

/** What the order is made of — payment method is deliberately NOT part of it
 *  (see H1: once a key is submitted, an order may exist under it).
 *  `userId` scopes it: the cart persists per device, so without it a sign-out
 *  and a new sign-in with the same basket would resume the previous person's
 *  order and show them its QR. */
function attemptSignature(
  userId: string | null,
  items: CartItem[],
  mode: string,
  promoCode: string | null,
): string {
  const lines = items.map((i) => `${i.variantId}:${i.qty}`).sort().join(',');
  return `${userId ?? 'anon'}|${mode}|${promoCode ?? ''}|${lines}`;
}

/** A selectable payment method row. Text is resolved via i18n at render. */
type MethodOption = {
  key: PaymentMethod;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  captionKey: string;
};

const PROMPTPAY_OPTION: MethodOption = {
  key: 'promptpay',
  icon: 'qr-code-outline',
  titleKey: 'checkout.method.promptpay.title',
  captionKey: 'checkout.method.promptpay.caption',
};

const COD_OPTION: MethodOption = {
  key: 'cod',
  icon: 'cash-outline',
  titleKey: 'checkout.method.cod.title',
  captionKey: 'checkout.method.cod.caption',
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  const items = useCart((s) => s.items);
  const selectedIds = useCart((s) => s.selectedIds);
  const removeSelected = useCart((s) => s.removeSelected);
  const mode = useMode((s) => s.mode);
  const promptPay = useShop((s) => s.info.promptPay);
  const address = useAddress(selectedAddress);
  const userId = useAuth((s) => s.userId);

  // Only the promo CODE crosses the route — a discount amount handed over from
  // the cart is a price frozen at tap time, and the subtotal it was priced
  // against may not exist any more (H2).
  const { promo } = useLocalSearchParams<{ promo?: string }>();

  const chosen = selectedItems(items, selectedIds);
  const subtotal = cartSubtotal(chosen);
  const count = cartCount(chosen);
  const deliveryFee = deliveryFeeFor(mode, subtotal);

  // Online flow pays up-front (PromptPay only); delivery defaults to COD but may
  // also pay by PromptPay.
  const methods: MethodOption[] =
    mode === 'delivery' ? [COD_OPTION, PROMPTPAY_OPTION] : [PROMPTPAY_OPTION];

  const [method, setMethod] = useState<PaymentMethod>(
    mode === 'delivery' ? 'cod' : 'promptpay',
  );
  const [slipUri, setSlipUri] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<string | null>(null);

  // An order placed earlier this session for this exact cart — resume it rather
  // than place a second one. Read once, at mount: `useState`/`useRef` keep the
  // initial value, so later renders can't thrash it.
  const resumed =
    pendingAttempt?.signature === attemptSignature(userId, chosen, mode, promo ?? null)
      ? pendingAttempt.order
      : null;

  const [status, setStatus] = useState<Status>(resumed ? 'awaiting_payment' : 'idle');
  const [placed, setPlaced] = useState<PlacedOrder | null>(resumed);
  const [copied, setCopied] = useState(false);
  /** Best-effort discount for the pre-order estimate. Re-priced against the live
   *  subtotal on every change, so it cannot freeze the way the cart's did. */
  const [estDiscount, setEstDiscount] = useState(0);

  // One idempotency key per checkout attempt, minted at the first confirm and
  // held across retries: if the server committed the order but the response
  // never made it back, the retry replays that order instead of placing a
  // second one. Minting it per call (the old behaviour) is exactly the bug.
  // It deliberately survives cart/method/promo edits — once a key has been
  // submitted an order may exist under it, and a fresh key would double-charge.
  // Since the order is now placed BEFORE the QR, the key also has to outlive the
  // screen (see `pendingAttempt`): backing out and returning must land on the
  // same order, not mint a second one holding its own stock.
  const checkoutKeyRef = useRef<string | null>(resumed ? (pendingAttempt?.key ?? null) : null);
  // The server cart is authoritative for this key once synced; a committed
  // place_order consumes it, so re-syncing on retry would rebuild a phantom
  // cart under an order that already exists.
  const cartSyncedRef = useRef(!!resumed);
  // `status` is stale inside two taps dispatched in the same tick — a ref is
  // the only guard that closes the double-submit window synchronously.
  const inFlightRef = useRef(false);

  // Re-price the promo whenever the basket moves. Preview only — `place_order`
  // is what actually decides, and it re-prices again server-side.
  useEffect(() => {
    if (!promo || subtotal <= 0) {
      setEstDiscount(0);
      return;
    }
    let cancelled = false;
    validatePromo(promo, subtotal, mode)
      .then((r) => {
        if (!cancelled) setEstDiscount(r.valid ? r.discount : 0);
      })
      .catch(() => {
        if (!cancelled) setEstDiscount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [promo, subtotal, mode]);

  const estimateTotal = subtotal + deliveryFee - estDiscount;
  /** Once the order exists its numbers are the only true ones. */
  const shownTotal = placed ? placed.total : estimateTotal;
  const shownSubtotal = placed ? placed.subtotal : subtotal;
  const shownFee = placed ? placed.deliveryFee : deliveryFee;
  const shownDiscount = placed ? placed.discountAmount : estDiscount;

  const needsSlip = method === 'promptpay';
  // The QR is only ever drawn from a placed order's total.
  const showQr = needsSlip && !!placed;
  const awaiting = status === 'awaiting_payment';
  const busy = status === 'placing' || status === 'verifying';

  // Step 1 places the order; step 2 (PromptPay only) submits the slip against it.
  const ctaLabel = placed
    ? t('checkout.confirmPayment')
    : method === 'cod'
      ? t('checkout.confirmOrder')
      : t('checkout.continueToPay');
  const canConfirm = awaiting ? !!slipUri : status === 'idle';

  /* ----- Guard: nothing to pay for (e.g. opened with an empty selection) ----
   * `placed` exempts the awaiting-payment screen: that order is real and owed,
   * so it must stay reachable even if the cart underneath it empties. */
  if (chosen.length === 0 && !placed && status !== 'success') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={t('checkout.title')}
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
        <View style={styles.guard}>
          <Ionicons name="cart-outline" size={40} color={Colors.primaryStrong} />
          <Text variant="subtitle" style={styles.guardTitle}>
            {t('checkout.emptyTitle')}
          </Text>
          <Text variant="body" style={styles.guardBody}>
            {t('checkout.emptyBody')}
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
      Alert.alert(t('checkout.permTitle'), t('checkout.permBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
    });
    if (!result.canceled) {
      // Shrink on-device before it ever leaves the phone — slips upload in a
      // couple hundred KB instead of multi-MB camera originals.
      const slip = await compressForUpload(result.assets[0]);
      setSlipUri(slip.uri);
      setSlipBase64(slip.base64);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    }
  };

  /* ── Step 1: place the order. Nothing payable is shown before this lands ─── */
  const onPlaceOrder = async () => {
    // Covers every non-idle status: the CTA stays mounted under the success
    // toast, and `status` alone is stale across two taps in one tick.
    if (inFlightRef.current || status !== 'idle') return;
    if (!address) {
      // พาไปหน้าเพิ่มที่อยู่ได้ทันที ไม่ต้องย้อนหาเอง
      Alert.alert(t('checkout.noAddressTitle'), t('checkout.noAddressBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('checkout.addAddressCta'), onPress: () => router.push('/address/picker') },
      ]);
      return;
    }
    if (chosen.length === 0) return;
    inFlightRef.current = true;
    setStatus('placing');
    // Minted lazily, so the key always reflects the cart as it stands at the
    // first confirm; every retry after that reuses it. An identical attempt
    // from earlier this session resumes its key so place_order replays that
    // order instead of placing a second one that holds more stock.
    if (!checkoutKeyRef.current) {
      const sig = attemptSignature(userId, chosen, mode, promo ?? null);
      checkoutKeyRef.current = pendingAttempt?.signature === sig ? pendingAttempt.key : uuidv4();
      pendingAttempt = { signature: sig, key: checkoutKeyRef.current, order: null };
    }
    try {
      // The selected address is already a backend row; place the order on it.
      const order = await placeOrder({
        items: chosen,
        mode,
        paymentMethod: method === 'cod' ? 'cod' : 'promptpay_slip',
        addressId: address.id,
        promoCode: promo ?? null,
        idempotencyKey: checkoutKeyRef.current,
        skipCartSync: cartSyncedRef.current,
        onCartSynced: () => {
          cartSyncedRef.current = true;
        },
      });
      setPlaced(order);
      if (pendingAttempt) pendingAttempt.order = order;
      if (method === 'cod') {
        // COD owes nothing now — the old single-confirm flow, unchanged.
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setStatus('success');
      } else {
        // Only now is there an authoritative amount to render a QR for.
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        setStatus('awaiting_payment');
      }
    } catch (e) {
      // Key and cart-synced flag survive on purpose — the throw may be a lost
      // response over an order that did commit, so the retry has to carry them.
      // A rejected promo / min-spend lands here too: an error before any QR,
      // which is the whole point of placing first.
      setStatus('idle');
      Alert.alert(t('checkout.orderFailedTitle'), orderErrorMessage(e));
    } finally {
      inFlightRef.current = false;
    }
  };

  /* ── Step 2: attach the slip to the order that already exists ───────────── */
  const onSubmitSlip = async () => {
    if (inFlightRef.current || status !== 'awaiting_payment') return;
    if (!placed) return;
    if (!slipUri || !slipBase64) {
      Alert.alert(t('checkout.noSlipTitle'), t('checkout.noSlipBody'));
      return;
    }
    inFlightRef.current = true;
    setStatus('verifying');
    try {
      const path = await uploadSlip(placed.id, slipBase64);
      await attachSlip(placed.id, path, placed.total);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setStatus('success');
    } catch {
      // The order is already placed and paid for — a failed upload must drop
      // back to the SAME order to retry, never place another one.
      setStatus('awaiting_payment');
      Alert.alert(t('checkout.slipUploadFailedTitle'), t('checkout.slipUploadFailedBody'));
    } finally {
      inFlightRef.current = false;
    }
  };

  // Once the success card is closed: clear the paid lines, then start tracking —
  // delivery → live rider map, online → parcel timeline.
  const finishSuccess = () => {
    // The attempt is closed: retire the key so nothing can replay this order,
    // and drop the session resume so the next checkout starts clean.
    checkoutKeyRef.current = null;
    cartSyncedRef.current = false;
    pendingAttempt = null;
    removeSelected();
    // The order lives in the DB now; the tracking screen loads it by number.
    if (placed) router.replace(`/order/${placed.orderNumber}`);
    else router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('checkout.title')}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}>
        {/* Amount — an estimate until the order exists, then the server's */}
        <View style={styles.amountCard}>
          <Text variant="caption">
            {placed ? t('checkout.amountDue') : t('checkout.amountEstimate')}
          </Text>
          <Text style={styles.amountValue}>{money(shownTotal)}</Text>
          {!placed ? (
            <Text variant="caption" style={styles.estimateNote}>
              {t('checkout.estimateNote')}
            </Text>
          ) : null}
          <View style={styles.amountMeta}>
            <Ionicons
              name={mode === 'delivery' ? 'bicycle-outline' : 'cube-outline'}
              size={14}
              color={Colors.textMuted}
            />
            <Text variant="caption" style={styles.amountMetaText}>
              {count} {t('checkout.itemsUnit')} ·{' '}
              {mode === 'delivery' ? t('checkout.homeDelivery') : t('checkout.flashDelivery')}
            </Text>
          </View>

          {/* Breakdown */}
          <View style={styles.breakdown}>
            <View style={styles.breakRow}>
              <Text variant="caption">{t('checkout.subtotal')}</Text>
              <Text style={styles.breakValue}>{money(shownSubtotal)}</Text>
            </View>
            <View style={[styles.breakRow, styles.breakRowGap]}>
              <Text variant="caption">
                {mode === 'delivery' ? t('checkout.deliveryFee') : t('checkout.flashFee')}
              </Text>
              {shownFee === 0 ? (
                <Text style={[styles.breakValue, { color: Colors.accentStrong }]}>
                  {t('checkout.free')}
                </Text>
              ) : (
                <Text style={styles.breakValue}>{money(shownFee)}</Text>
              )}
            </View>
            {shownDiscount > 0 ? (
              <View style={[styles.breakRow, styles.breakRowGap]}>
                <Text variant="caption">
                  {t('checkout.discount')}
                  {promo ? ` (${promo})` : ''}
                </Text>
                <Text style={[styles.breakValue, { color: Colors.accentStrong }]}>
                  -{money(shownDiscount)}
                </Text>
              </View>
            ) : null}
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
        <Text style={styles.eyebrow}>{t('checkout.paymentMethod')}</Text>
        <View style={styles.methodCard}>
          {methods.map((m, i) => {
            const active = m.key === method;
            return (
              <View key={m.key}>
                {i > 0 ? <View style={styles.insetHairline} /> : null}
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t(m.titleKey)}
                  scaleTo={0.99}
                  // The placed order already carries its payment_method; letting
                  // it be switched underneath would just desync the two.
                  disabled={!!placed || busy}
                  onPress={() => setMethod(m.key)}
                  style={[styles.methodRow, !!placed && m.key !== method && styles.methodRowOff]}>
                  <View style={[styles.methodIcon, active && styles.methodIconOn]}>
                    <Ionicons
                      name={m.icon}
                      size={20}
                      color={active ? Colors.textOnPrimary : Colors.primaryStrong}
                    />
                  </View>
                  <View style={styles.methodBody}>
                    <Text style={styles.methodTitle}>{t(m.titleKey)}</Text>
                    <Text variant="caption">{t(m.captionKey)}</Text>
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

        {/* PromptPay — before the order exists there is no amount we're allowed
            to put on a QR, so the customer gets the reason instead. */}
        {needsSlip && !placed ? (
          <View style={styles.codNote}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.primaryStrong} />
            <Text variant="caption" style={styles.codNoteText}>
              {t('checkout.qrAfterOrder')}
            </Text>
          </View>
        ) : null}

        {/* PromptPay detail — amount is the order's, never ours */}
        {showQr && placed ? (
          <Animated.View entering={FadeIn.duration(220)}>
            <PromptPayQR
              target={promptPay.target}
              amount={placed.total}
              displayName={promptPay.displayName}
              onCopyNumber={copyNumber}
            />

            <Text style={[styles.eyebrow, styles.eyebrowTop]}>{t('checkout.attachSlip')}</Text>
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
                    <Text style={styles.slipDoneText}>{t('checkout.slipAttached')}</Text>
                  </View>
                  <Text variant="caption">{t('checkout.slipAutoVerify')}</Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('checkout.changeSlipImage')}
                    hitSlop={8}
                    onPress={pickSlip}
                    style={styles.slipChange}>
                    <Ionicons name="image-outline" size={14} color={Colors.primaryStrong} />
                    <Text style={styles.slipChangeText}>{t('checkout.changeImage')}</Text>
                  </PressableScale>
                </View>
                <IconButton
                  icon="close"
                  size={32}
                  accessibilityLabel={t('checkout.removeSlip')}
                  color={Colors.textMuted}
                  onPress={() => setSlipUri(null)}
                />
              </View>
            ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('checkout.attachSlip')}
                scaleTo={0.98}
                onPress={pickSlip}
                style={styles.slipDrop}>
                <View style={styles.slipDropIcon}>
                  <Ionicons name="cloud-upload-outline" size={24} color={Colors.primaryStrong} />
                </View>
                <Text style={styles.slipDropTitle}>{t('checkout.tapToAttach')}</Text>
                <Text variant="caption" style={styles.slipDropCaption}>
                  {t('checkout.pickFromGallery')}
                </Text>
              </PressableScale>
            )}
          </Animated.View>
        ) : null}

        {method === 'cod' ? (
          <View style={styles.codNote}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primaryStrong} />
            <Text variant="caption" style={styles.codNoteText}>
              {t('checkout.prepareCash')} {money(shownTotal)} {t('checkout.payRiderOnReceive')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky confirm bar */}
      <View
        style={[
          styles.confirmBar,
          { paddingBottom: insets.bottom + Spacing.sm },
        ]}>
        {awaiting && !slipUri ? (
          <Text variant="caption" style={styles.confirmHint}>
            {t('checkout.attachSlipHint')}
          </Text>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          disabled={!canConfirm || busy || status === 'success'}
          onPress={awaiting ? onSubmitSlip : onPlaceOrder}
          style={[
            styles.confirmCta,
            (!canConfirm || busy || status === 'success') && styles.confirmCtaOff,
          ]}>
          <Text style={styles.confirmCtaText}>{ctaLabel}</Text>
          <Text style={styles.confirmCtaAmount}>{money(shownTotal)}</Text>
        </PressableScale>
      </View>

      {/* Busy overlay — the two steps say different things */}
      {busy ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.verifyText}>
              {status === 'placing' ? t('checkout.placing') : t('checkout.verifying')}
            </Text>
            <Text variant="caption" style={styles.verifySub}>
              {status === 'placing' ? t('checkout.placingSub') : t('checkout.verifyingSub')}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Success */}
      {status === 'success' ? (
        <Toast
          message={t('checkout.paidSuccess')}
          subtitle={
            method === 'cod'
              ? t('checkout.successCod')
              : t('checkout.successPrepay')
          }
          actionLabel={t('checkout.done')}
          onAction={finishSuccess}
          onHide={finishSuccess}
          duration={3200}
        />
      ) : null}

      {/* Copied toast */}
      {copied ? (
        <Toast
          message={t('checkout.copied')}
          subtitle={t('checkout.copiedSub')}
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
  estimateNote: {
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
  methodRowOff: {
    opacity: 0.45,
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
