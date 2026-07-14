/**
 * Cart tab — `/cart`.
 *
 * A calm, editorial grocery cart: the warm peach canvas carries just three
 * white e1 surfaces — a merged delivery card (address + free-shipping), one
 * hairline-divided items "ledger" with its own select-all header, and one order
 * summary — each introduced by a small muted Thai eyebrow label rather than more
 * boxes. Exactly one element floats at e2: the sticky checkout pill, which
 * totals only the ticked lines. Coral is the sole interactive/price accent; ink
 * carries every definitive total; green appears only for an earned ส่งฟรี / ฟรี.
 * Tokens-only, zero emoji. Friendly empty state when the cart is empty.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductListItem } from '@/components/product/ProductListItem';
import { CheckoutSheet } from '@/components/shop/CheckoutSheet';
import { ModeSwitch } from '@/components/shop/ModeSwitch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography, tokens } from '@/constants/theme';
import { type Product } from '@/data/products';
import { shopHoursLabel } from '@/data/shop';
import { validatePromo } from '@/lib/data/order';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useShopOpen } from '@/lib/useShopOpen';
import { hasParcelInfo, selectedAddress, useAddress } from '@/store/address';
import { useCatalog } from '@/store/catalog';
import { useShop } from '@/store/shop';
import {
  cartCount,
  cartSubtotal,
  selectedItems,
  useCart,
  type CartItem,
} from '@/store/cart';
import {
  deliveryFeeFor,
  FREE_DELIVERY_MIN,
  meetsMinOrder,
  MIN_ORDER,
  useMode,
} from '@/store/mode';

/** Payment hint i18n key per mode (the two flows differ on payment). */
const PAYMENT_HINT = {
  delivery: 'cart.payHintDelivery',
  online: 'cart.payHintOnline',
} as const;

const PAYMENT_ICON = {
  delivery: 'wallet-outline',
  online: 'qr-code-outline',
} as const;

/** Footprint of the floating tab bar above the screen bottom. */
const TAB_BAR_FOOTPRINT = 64;
/** Breathing gap between the sticky checkout bar and the floating tab bar. */
const CHECKOUT_BAR_GAP = Spacing.lg;
/** Height reserved for the sticky checkout bar (so scroll content clears it). */
const CHECKOUT_BAR_HEIGHT = 80;

/* ----------------------------------------------------------------------- */
/* Free-shipping progress (a block inside the delivery surface)            */
/* ----------------------------------------------------------------------- */

function FreeShipBlock({ subtotal }: { subtotal: number }) {
  const t = useT();
  const progress = Math.min(1, subtotal / FREE_DELIVERY_MIN);
  const remaining = Math.max(0, FREE_DELIVERY_MIN - subtotal);
  const reached = remaining === 0;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(progress, { duration: tokens.motion.duration.base });
  }, [progress, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.shipBlock}>
      <View style={styles.shipTop}>
        <Ionicons
          name={reached ? 'checkmark-circle' : 'bicycle-outline'}
          size={18}
          color={reached ? Colors.accentStrong : Colors.primaryStrong}
        />
        {reached ? (
          <Text style={[styles.shipText, { color: Colors.accentStrong }]}>
            {t('cart.freeShipEarned')}
          </Text>
        ) : (
          <Text style={styles.shipText}>
            {t('cart.buyMorePrefix')}{' '}
            <Text style={styles.shipAmount}>{money(remaining)}</Text>{' '}
            {t('cart.buyMoreSuffix')}
          </Text>
        )}
      </View>
      <View style={styles.shipTrack}>
        <Animated.View
          style={[
            styles.shipFill,
            fillStyle,
            reached && { backgroundColor: Colors.accentStrong },
          ]}
        />
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------------- */
/* ซื้อเพิ่มเติม upsell rail (flat outlined chips)                          */
/* ----------------------------------------------------------------------- */

function AddOnRail({
  items,
  onAdd,
}: {
  items: Product[];
  onAdd: (product: Product) => void;
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <>
      <Text style={[styles.eyebrow, styles.eyebrowTop]}>{t('cart.addOnRail')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.addonRow}>
        {items.map((p) => (
          <View key={p.id} style={styles.addonCard}>
            <Image
              source={{ uri: p.images[0] }}
              style={styles.addonImg}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            <Text numberOfLines={1} style={styles.addonName}>
              {p.name}
            </Text>
            <View style={styles.addonBottom}>
              <Text style={styles.addonPrice}>{money(p.price)}</Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${t('cart.addProductA11yPrefix')} ${p.name} ${t('cart.addProductA11ySuffix')}`}
                hitSlop={7}
                onPress={() => onAdd(p)}
                style={styles.addonAdd}>
                <Ionicons name="add" size={18} color={Colors.textOnPrimary} />
              </PressableScale>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Cart screen                                                             */
/* ----------------------------------------------------------------------- */

export default function CartScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useCart((s) => s.items);
  const selectedIds = useCart((s) => s.selectedIds);
  const toggleSelect = useCart((s) => s.toggleSelect);
  const selectAll = useCart((s) => s.selectAll);
  const removeSelected = useCart((s) => s.removeSelected);
  const removeLine = useCart((s) => s.remove);
  const add = useCart((s) => s.add);
  const mode = useMode((s) => s.mode);
  const address = useAddress(selectedAddress);
  const shopHours = useShop((s) => s.info.hours);

  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const chosen = selectedItems(items, selectedIds);
  const subtotal = cartSubtotal(chosen);
  const selectedCount = cartCount(chosen);
  const deliveryFee = deliveryFeeFor(mode, subtotal);
  const discount = appliedPromo?.discount ?? 0;
  const total = subtotal + deliveryFee - discount;

  const shopOpen = useShopOpen();

  const isEmpty = items.length === 0;
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const nothingSelected = selectedCount === 0;
  // Minimum-order floor (delivery only) — only relevant once something is ticked.
  const belowMin = !nothingSelected && !meetsMinOrder(mode, subtotal);
  const minShortfall = Math.max(0, MIN_ORDER - subtotal);
  // Online (parcel) needs a parcel-ready address before checkout.
  const needsParcel = mode === 'online' && !hasParcelInfo(address);
  const canCheckout =
    !nothingSelected && shopOpen && !belowMin && !needsParcel;

  const checkoutVerb = mode === 'delivery' ? t('cart.checkoutOrder') : t('cart.checkoutPay');
  const checkoutLabel =
    selectedCount > 0 ? `${checkoutVerb} (${selectedCount})` : checkoutVerb;

  // Suggestions = catalog products not already in the cart.
  const products = useCatalog((s) => s.products);
  const inCart = new Set(items.map((i) => i.product.id));
  const suggestions = products.filter((p) => !inCart.has(p.id)).slice(0, 8);

  const goShopping = () => router.push('/');

  const onAddSuggestion = (product: Product) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    add(product);
  };

  const onApply = async () => {
    const code = promo.trim();
    if (!code) {
      setAppliedPromo(null);
      return;
    }
    setPromoBusy(true);
    try {
      const res = await validatePromo(code, subtotal, mode);
      if (res.valid) {
        setAppliedPromo({ code, discount: res.discount });
        Alert.alert(
          t('cart.promoSuccessTitle'),
          res.messageTh || `${t('cart.discountReceived')} ${money(res.discount)}`,
        );
      } else {
        setAppliedPromo(null);
        Alert.alert(t('cart.promoInvalidTitle'), res.messageTh || t('cart.promoInvalidBody'));
      }
    } catch {
      Alert.alert(t('cart.promoErrorTitle'), t('cart.promoErrorBody'));
    } finally {
      setPromoBusy(false);
    }
  };

  const confirmRemoveLine = (item: CartItem) => {
    Alert.alert(
      t('cart.removeTitle'),
      `${t('cart.removeLinePrefix')}"${item.product.name}"${t('cart.removeLineSuffix')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('cart.delete'), style: 'destructive', onPress: () => removeLine(item.id) },
      ],
    );
  };

  const confirmRemoveSelected = () => {
    Alert.alert(
      t('cart.removeTitle'),
      `${t('cart.removeSelectedPrefix')}${selectedCount}${t('cart.removeSelectedSuffix')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('cart.delete'), style: 'destructive', onPress: () => removeSelected() },
      ],
    );
  };

  const openCheckout = () => {
    if (!canCheckout) return;
    setSheetOpen(true);
  };

  // Fired when the user slides the confirm control to the end: close the sheet
  // and hand off to the payment screen (which reads the ticked lines + mode from
  // the stores). The cart is cleared there only once payment is verified.
  const onConfirmOrder = () => {
    setSheetOpen(false);
    const params = appliedPromo
      ? { promo: appliedPromo.code, discount: String(appliedPromo.discount) }
      : undefined;
    // Let the sheet finish sliding out before the route transition.
    setTimeout(() => router.push({ pathname: '/checkout', params }), 240);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title={t('cart.title')} style={styles.header} />
      {!isEmpty ? (
        <Text variant="caption" style={styles.headerCount}>
          {items.length} {t('cart.itemsUnit')}
        </Text>
      ) : null}

      {isEmpty ? (
        <View style={[styles.empty, { paddingBottom: TAB_BAR_FOOTPRINT + Spacing.x3 }]}>
          <View style={styles.emptyBadge}>
            <Ionicons name="bag-handle-outline" size={40} color={Colors.primaryStrong} />
          </View>
          <Text variant="title" style={styles.emptyTitle}>
            {t('cart.emptyTitle')}
          </Text>
          <Text variant="body" style={styles.emptyBody}>
            {t('cart.emptyBody')}
          </Text>
          <Button onPress={goShopping} style={styles.emptyButton}>
            {t('cart.shopNow')}
          </Button>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom:
                  insets.bottom +
                  TAB_BAR_FOOTPRINT +
                  CHECKOUT_BAR_GAP +
                  CHECKOUT_BAR_HEIGHT +
                  Spacing.md,
              },
            ]}>
            {/* Store-closed notice */}
            {!shopOpen ? (
              <View style={styles.closedBanner}>
                <Ionicons name="moon-outline" size={18} color={Colors.dangerStrong} />
                <Text style={styles.closedText}>
                  {t('cart.closedNotice')} {shopHoursLabel(shopHours)}
                </Text>
              </View>
            ) : null}

            {/* Mode segmented control */}
            <ModeSwitch compact style={styles.modeSwitch} />

            {/* Delivery surface (rider address + free-shipping) */}
            {mode === 'delivery' ? (
              <View style={styles.deliveryCard}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('cart.selectAddressA11y')}
                  onPress={() => router.push(address ? '/address' : '/address/picker')}
                  scaleTo={0.98}
                  style={styles.addrRow}>
                  <View style={styles.addrTile}>
                    <Ionicons name="location-outline" size={20} color={Colors.primaryStrong} />
                  </View>
                  <View style={styles.addrBody}>
                    {address ? (
                      <>
                        <Text style={styles.addrTitle} numberOfLines={1}>
                          {t('cart.deliverTo')} · {address.label}
                        </Text>
                        <Text variant="caption" numberOfLines={1}>
                          {address.recipient} · {address.phone}
                        </Text>
                        <Text variant="caption" numberOfLines={1}>
                          {address.line}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.addrTitle}>{t('cart.addAddress')}</Text>
                        <Text variant="caption">{t('cart.addAddressCap')}</Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </PressableScale>
                <View style={styles.insetHairline} />
                <FreeShipBlock subtotal={subtotal} />
              </View>
            ) : (
              /* Online surface — nationwide parcel address */
              <View style={styles.deliveryCard}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('cart.parcelAddressA11y')}
                  onPress={() => router.push(address ? '/address' : '/address/picker')}
                  scaleTo={0.98}
                  style={styles.addrRow}>
                  <View style={styles.addrTile}>
                    <Ionicons name="cube-outline" size={20} color={Colors.primaryStrong} />
                  </View>
                  <View style={styles.addrBody}>
                    {address && !needsParcel ? (
                      <>
                        <Text style={styles.addrTitle} numberOfLines={1}>
                          {t('cart.flashTo')} · {address.label}
                        </Text>
                        <Text variant="caption" numberOfLines={1}>
                          {address.recipient} · {address.phone}
                        </Text>
                        <Text variant="caption" numberOfLines={2}>
                          {address.line}
                        </Text>
                        <Text variant="caption" numberOfLines={1}>
                          {[address.subDistrict, address.district, address.province, address.postalCode]
                            .filter(Boolean)
                            .join(' ')}
                        </Text>
                      </>
                    ) : address ? (
                      <>
                        <Text style={[styles.addrTitle, styles.addrWarn]} numberOfLines={1}>
                          {t('cart.parcelIncomplete')}
                        </Text>
                        <Text variant="caption">
                          {t('cart.parcelIncompleteCap')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.addrTitle}>{t('cart.addParcelAddress')}</Text>
                        <Text variant="caption">{t('cart.addParcelAddressCap')}</Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </PressableScale>
              </View>
            )}

            {/* Items ledger */}
            <Text style={styles.eyebrow}>{t('cart.itemsEyebrow')} · {items.length} {t('cart.unitPieces')}</Text>
            <View style={styles.itemsCard}>
              {/* Select-all header */}
              <View style={styles.selectAllRow}>
                <Checkbox
                  checked={allSelected}
                  onPress={() => selectAll(!allSelected)}
                  accessibilityLabel={t('cart.selectAll')}
                />
                <Text style={styles.selectAllText}>{t('cart.selectAll')}</Text>
                <Text variant="caption" style={styles.selectAllCount}>
                  ({items.length})
                </Text>
                <View style={styles.flexSpacer} />
                {selectedCount > 0 ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('cart.removeSelectedA11y')}
                    hitSlop={8}
                    onPress={confirmRemoveSelected}
                    style={styles.deleteSel}>
                    <Ionicons name="trash-outline" size={16} color={Colors.dangerStrong} />
                    <Text style={styles.deleteSelText}>{t('cart.deleteSelected')}</Text>
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.fullHairline} />

              {/* Lines */}
              {items.map((item, i) => (
                <View key={item.id}>
                  {i > 0 ? <View style={styles.insetHairline} /> : null}
                  <ProductListItem
                    product={item.product}
                    variant="cart"
                    embedded
                    cartItemId={item.id}
                    size={item.size}
                    color={item.color}
                    qty={item.qty}
                    selectable
                    selected={selectedIds.includes(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onRemove={() => confirmRemoveLine(item)}
                  />
                </View>
              ))}
            </View>

            {/* Upsell rail */}
            <AddOnRail items={suggestions} onAdd={onAddSuggestion} />

            {/* Summary */}
            <Text style={[styles.eyebrow, styles.eyebrowTop]}>{t('cart.summaryEyebrow')}</Text>
            <View style={styles.summaryCard}>
              {/* Promo field (inset) */}
              <View style={styles.promoField}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  value={promo}
                  onChangeText={setPromo}
                  placeholder={t('cart.promoPlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  style={styles.promoInput}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={onApply}
                />
                <PressableScale
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={promoBusy}
                  onPress={onApply}>
                  <Text style={styles.promoApply}>
                    {promoBusy
                      ? t('cart.promoChecking')
                      : appliedPromo
                        ? t('cart.promoApplied')
                        : t('cart.applyCode')}
                  </Text>
                </PressableScale>
              </View>

              <View style={styles.summaryHairline} />

              {/* Breakdown */}
              <View style={styles.sumRow}>
                <Text variant="body" style={styles.sumLabel}>
                  {t('cart.subtotalLabel')} ({selectedCount} {t('cart.unitPieces')})
                </Text>
                <Text style={styles.sumValue}>{money(subtotal)}</Text>
              </View>

              <View style={[styles.sumRow, styles.sumRowGap]}>
                <Text variant="body" style={styles.sumLabel}>
                  {mode === 'delivery' ? t('cart.deliveryFee') : t('cart.flashFee')}
                </Text>
                {deliveryFee === 0 ? (
                  <Text style={[styles.sumValue, { color: Colors.accentStrong }]}>
                    {t('cart.free')}
                  </Text>
                ) : (
                  <Text variant="body" style={{ color: Colors.text }}>
                    {money(deliveryFee)}
                  </Text>
                )}
              </View>

              {appliedPromo ? (
                <View style={[styles.sumRow, styles.sumRowGap]}>
                  <Text variant="body" style={styles.sumLabel}>
                    {t('cart.discountLabel')} ({appliedPromo.code})
                  </Text>
                  <Text style={[styles.sumValue, { color: Colors.accentStrong }]}>
                    -{money(discount)}
                  </Text>
                </View>
              ) : null}

              {/* Payment hint — its own full-width line */}
              <View style={styles.payRow}>
                <Ionicons name={PAYMENT_ICON[mode]} size={14} color={Colors.textMuted} />
                <Text variant="caption" style={styles.payText}>
                  {t(PAYMENT_HINT[mode])}
                </Text>
              </View>

              <View style={styles.summaryHairline} />

              <View style={styles.sumRow}>
                <Text variant="subtitle">{t('cart.total')}</Text>
                <Text style={styles.grandTotal}>{money(total)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky checkout bar (the only e2 element on the screen) */}
          <Animated.View
            entering={FadeInUp.duration(280)}
            style={[
              styles.checkoutBar,
              { bottom: insets.bottom + TAB_BAR_FOOTPRINT + CHECKOUT_BAR_GAP },
            ]}>
            <View style={styles.checkoutLeft}>
              <Text
                style={[styles.checkoutLabel, !canCheckout && !nothingSelected && styles.checkoutLabelWarn]}
                numberOfLines={1}>
                {!shopOpen
                  ? `${t('cart.closedShort')} · ${shopHoursLabel(shopHours)}`
                  : belowMin
                    ? `${t('cart.minOrderPrefix')}${MIN_ORDER} · ${t('cart.shortBy')} ${money(minShortfall)}`
                    : nothingSelected
                      ? t('cart.nothingSelected')
                      : needsParcel
                        ? t('cart.needParcelAddress')
                        : `${t('cart.selectedTotal')} · ${selectedCount} ${t('cart.unitPieces')}`}
              </Text>
              <View style={styles.checkoutTotalRow}>
                <Text style={styles.checkoutTotal}>
                  {money(nothingSelected ? 0 : total)}
                </Text>
                {!nothingSelected && mode === 'delivery' && deliveryFee === 0 ? (
                  <View style={styles.freeShipPill}>
                    <Ionicons name="bicycle" size={12} color={Colors.accentStrong} />
                    <Text style={styles.freeShipPillText}>{t('cart.freeShip')}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={checkoutLabel}
              disabled={!canCheckout}
              onPress={openCheckout}
              style={[styles.checkoutCta, !canCheckout && styles.checkoutCtaOff]}>
              <Text style={styles.checkoutCtaText}>{checkoutVerb}</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.textOnPrimary} />
            </PressableScale>
          </Animated.View>

          {/* Slide-to-confirm checkout sheet */}
          <CheckoutSheet
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onConfirm={onConfirmOrder}
            items={chosen}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            mode={mode}
            verb={checkoutVerb}
          />
        </>
      )}
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
  headerCount: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
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
  modeSwitch: {
    marginBottom: Spacing.x2,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  closedText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.dangerStrong,
  },

  /* Delivery surface */
  deliveryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.x2,
    ...Shadow.card,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  addrTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrBody: {
    flex: 1,
    gap: 1,
  },
  addrTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  addrWarn: {
    color: Colors.dangerStrong,
  },
  insetHairline: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  fullHairline: {
    height: 1,
    backgroundColor: Colors.border,
  },

  /* Free-shipping block */
  shipBlock: {
    padding: Spacing.lg,
  },
  shipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  shipText: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
  },
  shipAmount: {
    ...Typography.price,
    color: Colors.primaryStrong,
  },
  shipTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  shipFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },


  /* Items ledger */
  itemsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.x2,
    ...Shadow.card,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  selectAllText: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  selectAllCount: {
    marginLeft: Spacing.xs,
  },
  flexSpacer: {
    flex: 1,
  },
  deleteSel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deleteSelText: {
    ...Typography.label,
    color: Colors.dangerStrong,
  },

  /* Upsell rail */
  addonRow: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  addonCard: {
    width: 132,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addonImg: {
    width: '100%',
    height: 96,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryTint,
  },
  addonName: {
    ...Typography.caption,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  addonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xxs,
  },
  addonPrice: {
    ...Typography.bodyStrong,
    color: Colors.primaryStrong,
  },
  addonAdd: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Summary */
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  promoField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  promoInput: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    padding: 0,
  },
  promoApply: {
    ...Typography.button,
    color: Colors.primaryStrong,
  },
  summaryHairline: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sumRowGap: {
    marginTop: Spacing.md,
  },
  sumLabel: {
    color: Colors.textMuted,
  },
  sumValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  payText: {
    flex: 1,
  },
  grandTotal: {
    ...Typography.title,
    color: Colors.text,
  },

  /* Sticky checkout bar */
  checkoutBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.float,
  },
  checkoutLeft: {
    flex: 1,
    // Was a bare `2` — the "รวมที่เลือก · N ชิ้น" caption sat almost touching
    // the title-sized price below it. Spacing.sm gives the label its own
    // breathing room without pulling the price row apart from it.
    gap: Spacing.sm,
  },
  checkoutLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  checkoutLabelWarn: {
    color: Colors.dangerStrong,
  },
  checkoutTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkoutTotal: {
    ...Typography.title,
    color: Colors.text,
  },
  freeShipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentTint,
  },
  freeShipPillText: {
    ...Typography.label,
    color: Colors.accentStrong,
  },
  checkoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 52,
    paddingHorizontal: Spacing.x2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  checkoutCtaOff: {
    opacity: 0.45,
  },
  checkoutCtaText: {
    ...Typography.button,
    color: Colors.textOnPrimary,
  },

  /* Empty state */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
  },
  emptyBadge: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: Spacing.xl,
  },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  emptyButton: {
    marginTop: Spacing.xl,
    minWidth: 180,
  },
});
