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
import { ModeSwitch } from '@/components/shop/ModeSwitch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography, tokens } from '@/constants/theme';
import { products, type Product } from '@/data/products';
import { money } from '@/lib/format';
import { selectedAddress, useAddress } from '@/store/address';
import {
  cartCount,
  cartSubtotal,
  selectedItems,
  useCart,
  type CartItem,
} from '@/store/cart';
import { deliveryFeeFor, FREE_DELIVERY_MIN, useMode } from '@/store/mode';

/** Payment hint shown per mode (the two flows differ on payment). */
const PAYMENT_HINT = {
  delivery: 'ชำระปลายทาง หรือโอนเมื่อรับของ',
  online: 'ชำระออนไลน์ PromptPay/โอน + แนบสลิป',
} as const;

const PAYMENT_ICON = {
  delivery: 'wallet-outline',
  online: 'qr-code-outline',
} as const;

/** Footprint of the floating tab bar above the screen bottom. */
const TAB_BAR_FOOTPRINT = 64;
/** Height reserved for the sticky checkout bar (so scroll content clears it). */
const CHECKOUT_BAR_HEIGHT = 80;

/* ----------------------------------------------------------------------- */
/* Free-shipping progress (a block inside the delivery surface)            */
/* ----------------------------------------------------------------------- */

function FreeShipBlock({ subtotal }: { subtotal: number }) {
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
            คุณได้รับสิทธิ์ส่งฟรีแล้ว
          </Text>
        ) : (
          <Text style={styles.shipText}>
            ซื้ออีก{' '}
            <Text style={styles.shipAmount}>{money(remaining)}</Text> รับส่งฟรี
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
  if (items.length === 0) return null;
  return (
    <>
      <Text style={[styles.eyebrow, styles.eyebrowTop]}>ซื้อเพิ่มเติม</Text>
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
                accessibilityLabel={`เพิ่ม ${p.name} ลงตะกร้า`}
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

  const [promo, setPromo] = useState('');

  const chosen = selectedItems(items, selectedIds);
  const subtotal = cartSubtotal(chosen);
  const selectedCount = cartCount(chosen);
  const deliveryFee = deliveryFeeFor(mode, subtotal);
  const total = subtotal + deliveryFee;

  const isEmpty = items.length === 0;
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const nothingSelected = selectedCount === 0;

  const checkoutVerb = mode === 'delivery' ? 'สั่งซื้อ' : 'ชำระเงิน';
  const checkoutLabel =
    selectedCount > 0 ? `${checkoutVerb} (${selectedCount})` : checkoutVerb;

  // Suggestions = catalog products not already in the cart.
  const inCart = new Set(items.map((i) => i.product.id));
  const suggestions = products.filter((p) => !inCart.has(p.id)).slice(0, 8);

  const goShopping = () => router.push('/');

  const onAddSuggestion = (product: Product) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    add(product);
  };

  const onApply = () => {
    Alert.alert(
      'โค้ดส่วนลด',
      promo.trim() ? `ใช้โค้ด "${promo.trim()}" แล้ว` : 'กรุณากรอกโค้ดส่วนลดก่อน',
    );
  };

  const confirmRemoveLine = (item: CartItem) => {
    Alert.alert('ลบสินค้า', `ลบ "${item.product.name}" ออกจากตะกร้า?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => removeLine(item.id) },
    ]);
  };

  const confirmRemoveSelected = () => {
    Alert.alert('ลบสินค้า', `ลบสินค้าที่เลือก ${selectedCount} ชิ้นออกจากตะกร้า?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => removeSelected() },
    ]);
  };

  const onBuyNow = () => {
    if (nothingSelected) return;
    removeSelected();
    setPromo('');
    const detail =
      mode === 'delivery'
        ? 'เราจะจัดส่งถึงบ้านคุณเร็วๆ นี้ค่ะ'
        : 'ชำระเงินออนไลน์แล้วแนบสลิป รับสินค้าที่ร้านได้เลยค่ะ';
    Alert.alert('สั่งซื้อสำเร็จ', `ขอบคุณที่อุดหนุนร้านอู้ฟู่ค่ะ\n${detail}`);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="ตะกร้าของฉัน" style={styles.header} />
      {!isEmpty ? (
        <Text variant="caption" style={styles.headerCount}>
          {items.length} รายการ
        </Text>
      ) : null}

      {isEmpty ? (
        <View style={[styles.empty, { paddingBottom: TAB_BAR_FOOTPRINT + Spacing.x3 }]}>
          <View style={styles.emptyBadge}>
            <Ionicons name="bag-handle-outline" size={40} color={Colors.primaryStrong} />
          </View>
          <Text variant="title" style={styles.emptyTitle}>
            ตะกร้าว่างเปล่า
          </Text>
          <Text variant="body" style={styles.emptyBody}>
            ยังไม่มีสินค้าในตะกร้า เลือกของสดใหม่กันก่อนนะ
          </Text>
          <Button onPress={goShopping} style={styles.emptyButton}>
            เลือกซื้อสินค้า
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
                  insets.bottom + TAB_BAR_FOOTPRINT + CHECKOUT_BAR_HEIGHT + Spacing.md,
              },
            ]}>
            {/* Mode segmented control */}
            <ModeSwitch compact style={styles.modeSwitch} />

            {/* Delivery surface (address + free-shipping) / pickup strip */}
            {mode === 'delivery' ? (
              <View style={styles.deliveryCard}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="เลือกที่อยู่จัดส่ง"
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
                          จัดส่งถึง · {address.label}
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
                        <Text style={styles.addrTitle}>เพิ่มที่อยู่จัดส่ง</Text>
                        <Text variant="caption">ปักหมุดบนแผนที่เพื่อจัดส่งถึงบ้าน</Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </PressableScale>
                <View style={styles.insetHairline} />
                <FreeShipBlock subtotal={subtotal} />
              </View>
            ) : (
              <View style={styles.pickupStrip}>
                <Ionicons name="storefront-outline" size={16} color={Colors.textMuted} />
                <Text variant="caption" style={styles.pickupText}>
                  รับสินค้าที่ร้าน อู้ฟู่ · ชำระออนไลน์แล้วแนบสลิป
                </Text>
              </View>
            )}

            {/* Items ledger */}
            <Text style={styles.eyebrow}>รายการสินค้า · {items.length} ชิ้น</Text>
            <View style={styles.itemsCard}>
              {/* Select-all header */}
              <View style={styles.selectAllRow}>
                <Checkbox
                  checked={allSelected}
                  onPress={() => selectAll(!allSelected)}
                  accessibilityLabel="เลือกทั้งหมด"
                />
                <Text style={styles.selectAllText}>เลือกทั้งหมด</Text>
                <Text variant="caption" style={styles.selectAllCount}>
                  ({items.length})
                </Text>
                <View style={styles.flexSpacer} />
                {selectedCount > 0 ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="ลบสินค้าที่เลือก"
                    hitSlop={8}
                    onPress={confirmRemoveSelected}
                    style={styles.deleteSel}>
                    <Ionicons name="trash-outline" size={16} color={Colors.dangerStrong} />
                    <Text style={styles.deleteSelText}>ลบที่เลือก</Text>
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
            <Text style={[styles.eyebrow, styles.eyebrowTop]}>สรุปคำสั่งซื้อ</Text>
            <View style={styles.summaryCard}>
              {/* Promo field (inset) */}
              <View style={styles.promoField}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  value={promo}
                  onChangeText={setPromo}
                  placeholder="กรอกโค้ดส่วนลด"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.promoInput}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={onApply}
                />
                <PressableScale accessibilityRole="button" hitSlop={8} onPress={onApply}>
                  <Text style={styles.promoApply}>ใช้โค้ด</Text>
                </PressableScale>
              </View>

              <View style={styles.summaryHairline} />

              {/* Breakdown */}
              <View style={styles.sumRow}>
                <Text variant="body" style={styles.sumLabel}>
                  ยอดรวมสินค้า ({selectedCount} ชิ้น)
                </Text>
                <Text style={styles.sumValue}>{money(subtotal)}</Text>
              </View>

              {mode === 'delivery' ? (
                <View style={[styles.sumRow, styles.sumRowGap]}>
                  <Text variant="body" style={styles.sumLabel}>
                    ค่าจัดส่ง
                  </Text>
                  {deliveryFee === 0 ? (
                    <Text style={[styles.sumValue, { color: Colors.accentStrong }]}>
                      ฟรี
                    </Text>
                  ) : (
                    <Text variant="body" style={{ color: Colors.text }}>
                      {money(deliveryFee)}
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Payment hint — its own full-width line */}
              <View style={styles.payRow}>
                <Ionicons name={PAYMENT_ICON[mode]} size={14} color={Colors.textMuted} />
                <Text variant="caption" style={styles.payText}>
                  {PAYMENT_HINT[mode]}
                </Text>
              </View>

              <View style={styles.summaryHairline} />

              <View style={styles.sumRow}>
                <Text variant="subtitle">รวมทั้งหมด</Text>
                <Text style={styles.grandTotal}>{money(total)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky checkout bar (the only e2 element on the screen) */}
          <Animated.View
            entering={FadeInUp.duration(280)}
            style={[styles.checkoutBar, { bottom: insets.bottom + TAB_BAR_FOOTPRINT }]}>
            <View style={styles.checkoutLeft}>
              <Text variant="caption">รวมที่เลือก</Text>
              <Text style={styles.checkoutTotal}>{money(total)}</Text>
            </View>
            <Button
              onPress={onBuyNow}
              disabled={nothingSelected}
              style={styles.checkoutBtn}>
              {checkoutLabel}
            </Button>
          </Animated.View>
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

  /* Pickup strip (online) */
  pickupStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.x2,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  pickupText: {
    flex: 1,
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
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  checkoutLeft: {
    flex: 1,
  },
  checkoutTotal: {
    ...Typography.title,
    color: Colors.text,
  },
  checkoutBtn: {
    minWidth: 150,
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
