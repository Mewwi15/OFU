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
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { CouponTicket } from '@/components/shop/CouponTicket';
import { BRAND_ACCENT, type Accent } from '@/constants/accent';
import { ONLINE_ACCENT } from '@/constants/online';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography, tokens } from '@/constants/theme';
import { type Product } from '@/data/products';
import { shopHoursLabel } from '@/data/shop';
import { listClaimedCoupons, type Coupon } from '@/lib/data/coupons';
import { validatePromo } from '@/lib/data/order';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { productThumb } from '@/lib/image';
import { useShopOpen } from '@/lib/useShopOpen';
import { hasContactInfo, hasParcelInfo, selectedAddress, useAddress } from '@/store/address';
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
  meetsMinOrder,
  useFees,
  useMode,
} from '@/store/mode';



/** Footprint of the floating tab bar above the screen bottom. */
const TAB_BAR_FOOTPRINT = 64;
/** Breathing gap between the sticky checkout bar and the floating tab bar. */
const CHECKOUT_BAR_GAP = Spacing.lg;
/** Height reserved for the sticky checkout bar (so scroll content clears it). */
const CHECKOUT_BAR_HEIGHT = 80;

/* ----------------------------------------------------------------------- */
/* Free-shipping progress (a block inside the delivery surface)            */
/* ----------------------------------------------------------------------- */

/**
 * ตัดส่วนที่ซ้ำกับช่องข้อมูลแยกออกจากที่อยู่บรรทัดหลัก
 *
 * ★ ห้ามโชว์รหัสไปรษณีย์สองตัวที่ไม่ตรงกัน ★ บรรทัดที่อยู่มาจากการถอดรหัสพิกัดหรือที่
 * ลูกค้าพิมพ์เอง ส่วนตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์เป็นช่องแยกที่ลูกค้าแก้ทีหลังได้
 * สองอย่างนี้ไม่ตรงกันได้ (ย้ายที่แล้วแก้แค่ช่องแยก) พอโชว์ทั้งคู่เต็ม ๆ ลูกค้าจะเห็น
 * "10800" กับ "10330" อยู่ติดกันแล้วไม่รู้ว่าพัสดุจะไปไหน
 * ช่องแยกคือตัวที่ใช้ส่งจริง บรรทัดหลักจึงเหลือแค่ชื่อถนน/บ้านเลขที่
 */
function streetOnly(a: { line: string; subDistrict?: string; district?: string; province?: string; postalCode?: string }): string {
  let out = a.line;
  for (const part of [a.postalCode, a.province, a.district, a.subDistrict]) {
    const token = part?.trim();
    if (token) out = out.split(token).join(' ');
  }
  /* ตัดรหัสไปรษณีย์ท้ายบรรทัดทิ้งเสมอ ไม่ใช่เฉพาะตัวที่ตรงกับช่องแยก — ถ้าสองที่ไม่ตรงกัน
     (ลูกค้าย้ายที่แล้วแก้แค่ช่องแยก) การโชว์ทั้งคู่คือการโชว์เลขที่ขัดกันเองให้ลูกค้าเดา
     ช่องแยกคือตัวที่ใช้ส่งจริง เลขในบรรทัดจึงต้องหายไป ไม่ใช่มาแข่งกัน
     ตัดเฉพาะที่อยู่ท้ายบรรทัด — รหัสไปรษณีย์ไทยอยู่ท้ายเสมอ ส่วนบ้านเลขที่อยู่ต้น */
  out = out.replace(/\s*\b\d{5}\b\s*$/, '');
  return out.replace(/\s{2,}/g, ' ').trim() || a.line;
}

function FreeShipBlock({
  subtotal,
  freeMin,
  accent,
}: {
  subtotal: number;
  freeMin: number;
  accent: Accent;
}) {
  const t = useT();
  // freeMin 0 = ส่งฟรีทุกยอด — เต็มหลอดทันที ไม่ใช่หารด้วยศูนย์
  const progress = freeMin > 0 ? Math.min(1, subtotal / freeMin) : 1;
  const remaining = Math.max(0, freeMin - subtotal);
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
          color={reached ? Colors.accentStrong : accent.strong}
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
            { backgroundColor: accent.solid },
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
  accent,
}: {
  items: Product[];
  onAdd: (product: Product) => void;
  accent: Accent;
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
              source={{ uri: productThumb(p.images[0], 232, 192) }}
              style={[styles.addonImg, { backgroundColor: accent.tint }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            <Text numberOfLines={1} style={styles.addonName}>
              {p.name}
            </Text>
            <View style={styles.addonBottom}>
              <Text style={[styles.addonPrice, { color: accent.strong }]}>{money(p.price)}</Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${t('cart.addProductA11yPrefix')} ${p.name} ${t('cart.addProductA11ySuffix')}`}
                hitSlop={7}
                onPress={() => onAdd(p)}
                style={[styles.addonAdd, { backgroundColor: accent.solid }]}>
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
  /* คูปองที่ลูกค้ากดเก็บไว้ (0096) — เอามาให้กดเลือกแทนการพิมพ์โค้ดเอง ซึ่งเป็นเหตุผล
     ทั้งหมดของการมีปุ่ม "เก็บ" ตั้งแต่แรก ถ้าเก็บแล้วยังต้องพิมพ์อยู่ดีก็ไม่ต่างจากเดิม
     ช่องพิมพ์โค้ดยังอยู่ ไม่ได้เอาออก — โค้ดลับที่ร้านส่งให้เฉพาะรายไม่มีทางโผล่ใน
     รายการที่เก็บได้ ต้องพิมพ์เองเท่านั้น */
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  /* สีของหน้า — โหมดออนไลน์เป็นน้ำเงินทั้งโหมดแล้ว ตะกร้าเป็นส้มอยู่หน้าเดียวจะโดดออกมา
     (เจ้าของทัก 5 ก.ย. 2026 "ทำไมไม่เป็นสีน้ำเงินครับ") — ส่งสีเข้าคอมโพเนนต์ที่ใช้ร่วมกัน
     แทนการก๊อปหน้าตะกร้าเป็นสองเวอร์ชัน */
  const A = mode === 'online' ? ONLINE_ACCENT : BRAND_ACCENT;

  const chosen = selectedItems(items, selectedIds);
  const subtotal = cartSubtotal(chosen);
  const selectedCount = cartCount(chosen);
  const fees = useFees((f) => f.fees);
  const deliveryFee = deliveryFeeFor(mode, subtotal, fees);
  const discount = appliedPromo?.discount ?? 0;
  const total = subtotal + deliveryFee - discount;

  const shopOpen = useShopOpen();

  const isEmpty = items.length === 0;
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const nothingSelected = selectedCount === 0;
  // Minimum-order floor (delivery only) — only relevant once something is ticked.
  const belowMin = !nothingSelected && !meetsMinOrder(mode, subtotal);
  // Online (parcel) needs a parcel-ready address before checkout.
  const needsParcel = mode === 'online' && !hasParcelInfo(address);
  /* เดลิเวอรี่ก็ต้องมีชื่อผู้รับ+เบอร์โทร — ที่อยู่ที่มาจากการสแกนพิกัด (0096/จอ
     delivery-check) อาจยังว่างสองช่องนี้ถ้าโปรไฟล์ยังไม่ได้กรอก เจ้าของเลือกไว้ว่า
     "ค่อยกรอกชื่อ/เบอร์ตอนสั่ง" จึงต้องกันที่นี่ — ปล่อยผ่านไปฐานข้อมูลจะปฏิเสธเอง
     (recipient_name/recipient_phone เป็น not null) ซึ่งลูกค้าจะเจอเป็น error ดิบ ๆ */
  const needsContact = mode === 'delivery' && !!address && !hasContactInfo(address);
  const canCheckout =
    !nothingSelected && shopOpen && !belowMin && !needsParcel && !needsContact;

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

  /* โหลดทุกครั้งที่เข้าหน้า ไม่แคช — ลูกค้าอาจเพิ่งไปเก็บคูปองมาจากหน้าแรกหรือแท็บคูปอง
     แล้วกลับมาที่นี่ทันที ถ้าแคชไว้จะไม่เห็นใบที่เพิ่งเก็บ */
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void listClaimedCoupons()
        .then((cs) => alive && setMyCoupons(cs))
        .catch(() => alive && setMyCoupons([]));
      return () => {
        alive = false;
      };
    }, []),
  );

  /* กดเลือกจากคูปองที่เก็บไว้ = เติมโค้ดลงช่องแล้วตรวจให้เลย ไม่ใช่ตั้งส่วนลดเอง —
     ต้องผ่าน validate_promo เหมือนพิมพ์เองทุกประการ เพราะยอดขั้นต่ำ/โควตาตัดสินตอนนี้
     ไม่ใช่ตอนเก็บ ถ้าลัดขั้นตอนจะได้ส่วนลดที่ place_order ปฏิเสธทีหลัง */
  /* เอาคูปองออกจากออเดอร์ — ล้างทั้งใบที่ใช้อยู่และช่องพิมพ์โค้ด ไม่ให้เหลือโค้ดค้างใน
     ช่องแล้วลูกค้าเข้าใจว่ายังใช้อยู่ */
  const clearCoupon = () => {
    setAppliedPromo(null);
    setPromo('');
  };

  const applyCoupon = async (c: Coupon) => {
    setPromo(c.code);
    setPromoBusy(true);
    try {
      const res = await validatePromo(c.code, subtotal, mode);
      if (res.valid) {
        setAppliedPromo({ code: c.code, discount: res.discount });
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

  // A promo is only ever priced against a subtotal, so the moment the basket
  // moves that price is stale — keeping it on screen is how the customer ends
  // up transferring one amount while place_order charges another (H2). Re-ask
  // the server instead of trusting the number we captured at apply time; if the
  // code no longer qualifies (dropped under min-spend, say) it goes away here
  // rather than failing after the money has left their bank.
  useEffect(() => {
    const code = appliedPromo?.code;
    if (!code) return;
    let cancelled = false;
    validatePromo(code, subtotal, mode)
      .then((res) => {
        if (cancelled) return;
        setAppliedPromo((cur) =>
          cur?.code !== code ? cur : res.valid ? { code, discount: res.discount } : null,
        );
      })
      .catch(() => {
        // Preview only — a failed re-check must not wipe a valid promo. The
        // authoritative pricing still happens in place_order.
      });
    return () => {
      cancelled = true;
    };
  }, [appliedPromo?.code, subtotal, mode]);

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
    // Code only. A discount handed over here is a price frozen at tap time, and
    // checkout would have had no way to tell it had gone stale (H2) — the
    // server re-prices it against the live subtotal instead.
    const params = appliedPromo ? { promo: appliedPromo.code } : undefined;
    // Let the sheet finish sliding out before the route transition.
    setTimeout(() => router.push({ pathname: '/checkout', params }), 240);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* โหมดออนไลน์ไม่มีหัวข้อ "ตะกร้าของฉัน" แล้ว (เจ้าของสั่ง 5 ก.ย. 2026) — แถบล่าง
          ของโหมดบอกอยู่แล้วว่านี่คือตะกร้าสินค้า หัวข้อซ้ำอีกทีกินที่เปล่า ๆ
          แถบหลักของแอปยังต้องมี เพราะเข้ามาจากที่อื่นได้และไม่มีอะไรบอกว่าอยู่หน้าไหน */}
      {mode === 'online' ? null : (
        <ScreenHeader title={t('cart.title')} style={styles.header} />
      )}
      {/* จำนวนใต้หัวข้อ — โหมดออนไลน์ไม่มีหัวข้อแล้ว บรรทัดนี้เลยลอยเดี่ยว ๆ อยู่บนสุด
          และไปซ้ำกับหัวโซน "รายการสินค้า N รายการ" ที่อยู่ถัดลงไปไม่กี่บรรทัด */}
      {!isEmpty && mode !== 'online' ? (
        <Text variant="caption" style={styles.headerCount}>
          {items.length} {t('cart.itemsUnit')}
        </Text>
      ) : null}

      {isEmpty ? (
        <View style={[styles.empty, { paddingBottom: TAB_BAR_FOOTPRINT + Spacing.x3 }]}>
          <View style={styles.emptyBadge}>
            <Ionicons name="bag-handle-outline" size={40} color={A.strong} />
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
            {/* สวิตช์โหมดไม่มีในโหมดออนไลน์ (เจ้าของสั่ง 5 ก.ย. 2026) — เข้ามาทางแถบล่าง
                ของโหมดออนไลน์แล้ว โหมดถูกกำหนดไว้ตั้งแต่ต้นทาง ให้สลับตรงนี้ได้อีกจะพา
                ลูกค้าออกจากโหมดโดยไม่ตั้งใจ */}
            {mode === 'online' ? null : <ModeSwitch compact style={styles.modeSwitch} />}

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
                    <Ionicons name="location-outline" size={20} color={A.strong} />
                  </View>
                  <View style={styles.addrBody}>
                    {address ? (
                      <>
                        <Text style={styles.addrTitle} numberOfLines={1}>
                          {t('cart.deliverTo')} {address.label}
                        </Text>
                        <Text variant="caption" numberOfLines={1}>
                          {address.recipient}   {address.phone}
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
                <FreeShipBlock subtotal={subtotal} freeMin={fees.freeDeliveryMin} accent={A} />
              </View>
            ) : (
              /* Online surface — nationwide parcel address
                 การ์ดที่อยู่แบบเต็ม (เจ้าของสั่ง 5 ก.ย. 2026 "ที่อยู่ทำเป็นการ์ดดีๆครับ
                 ตัวเลขชัดเจน ตัวหนังสือชัดเจน") — เดิมเป็นแถวเล็ก ๆ ตัวอักษรจางเท่ากันหมด
                 อ่านไม่ออกว่าอะไรสำคัญ พัสดุส่งผิดที่เพราะอ่านที่อยู่ผิดคือความเสียหายจริง */
              <View style={styles.parcelCard}>
                <View style={styles.parcelHead}>
                  <View style={styles.parcelTag}>
                    <Ionicons name="cube" size={14} color={ONLINE_ACCENT.strong} />
                    <Text style={styles.parcelTagText}>ที่อยู่จัดส่งพัสดุ</Text>
                  </View>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('cart.parcelAddressA11y')}
                    onPress={() => router.push(address ? '/address' : '/address/picker')}
                    hitSlop={8}>
                    <Text style={[styles.parcelEdit, { color: ONLINE_ACCENT.strong }]}>
                      {address ? 'เปลี่ยน' : 'เพิ่ม'}
                    </Text>
                  </PressableScale>
                </View>

                {address && !needsParcel ? (
                  <>
                    {/* ชื่อกับเบอร์อยู่บรรทัดเดียวกันแต่คนละน้ำหนัก — เบอร์เป็นตัวเลขที่
                        พนักงานขนส่งต้องอ่านออกตอนโทรหา ต้องเด่นพอ ๆ กับชื่อ */}
                    <View style={styles.parcelWho}>
                      <Text style={styles.parcelName} numberOfLines={1}>
                        {address.recipient}
                      </Text>
                      <Text style={styles.parcelPhone}>{address.phone}</Text>
                    </View>
                    <Text style={styles.parcelLine}>{streetOnly(address)}</Text>
                    <View style={styles.parcelZone}>
                      <Text style={styles.parcelZoneText} numberOfLines={2}>
                        {[address.subDistrict, address.district, address.province]
                          .filter(Boolean)
                          .join(' ')}
                      </Text>
                      {/* รหัสไปรษณีย์แยกออกมาเป็นก้อนตัวเลขเว้นระยะ — เลขห้าหลักที่ผิด
                          ตัวเดียวพัสดุไปคนละจังหวัด ต้องตรวจทานได้ด้วยตาในแวบเดียว */}
                      {address.postalCode ? (
                        <View style={styles.zip}>
                          <Text style={styles.zipText}>{address.postalCode}</Text>
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : address ? (
                  <View style={styles.parcelWarn}>
                    <Ionicons name="alert-circle" size={18} color={Colors.dangerStrong} />
                    <View style={styles.parcelWarnCopy}>
                      <Text style={styles.parcelWarnTitle}>{t('cart.parcelIncomplete')}</Text>
                      <Text variant="caption">{t('cart.parcelIncompleteCap')}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.parcelWarn}>
                    <Ionicons name="add-circle-outline" size={18} color={ONLINE_ACCENT.strong} />
                    <View style={styles.parcelWarnCopy}>
                      <Text style={styles.parcelWarnTitle}>{t('cart.addParcelAddress')}</Text>
                      <Text variant="caption">{t('cart.addParcelAddressCap')}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Items ledger */}
            {/* ★ นับให้ตรงหน่วย ★ เดิมใช้จำนวน "บรรทัด" แต่เขียนหน่วยว่า "ชิ้น" — ตะกร้า
                ที่มีมาม่า 3 ห่อกับน้ำยา 2 ถุง ขึ้นว่า "2 ชิ้น" ทั้งที่มีของ 5 ชิ้น
                (เจ้าของทัก 5 ก.ย. 2026) บรรทัดกับชิ้นเป็นคนละเรื่อง บอกทั้งสองอย่างไปเลย */}
            <Text style={styles.eyebrow}>
              {t('cart.itemsEyebrow')} {items.length} รายการ
            </Text>
            <View style={styles.itemsCard}>
              {/* Select-all header */}
              <View style={styles.selectAllRow}>
                <Checkbox
                  checked={allSelected}
                  onPress={() => selectAll(!allSelected)}
                  accessibilityLabel={t('cart.selectAll')}
                  accent={A}
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
                    accent={A}
                  />
                </View>
              ))}
            </View>

            {/* Upsell rail */}
            <AddOnRail items={suggestions} onAdd={onAddSuggestion} accent={A} />

            {/* Summary */}
            <Text style={[styles.eyebrow, styles.eyebrowTop]}>{t('cart.summaryEyebrow')}</Text>
            <View style={styles.summaryCard}>
              {/* คูปองที่เก็บไว้ — กดเลือกได้เลยไม่ต้องพิมพ์ ซ่อนทั้งแถวถ้ายังไม่เคยเก็บ */}
              {myCoupons.length > 0 ? (
                <View style={styles.myCoupons}>
                  <Text style={styles.myCouponsHead}>คูปองที่เก็บไว้</Text>
                  {/* ตั๋วใบเดียวกับแท็บคูปอง แค่ย่อขนาด (เจ้าของสั่ง 5 ก.ย. 2026 "เอา ui
                      ของเรามาย่อขนาดก็ได้") — ลูกค้าเห็นคูปองใบเดิมที่เคยกดเก็บ ไม่ใช่
                      ชิปเล็ก ๆ ที่ดูเป็นคนละอย่าง · กดที่ใบเพื่อใช้ ใบที่ใช้อยู่จะถูกฉีก */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.myCouponsRow}>
                    {myCoupons.map((c) => {
                      const on = appliedPromo?.code === c.code;
                      return (
                        <View key={c.id} style={styles.couponCell}>
                          <CouponTicket
                            coupon={c}
                            compact
                            torn={on}
                            notchColor={Colors.background}
                            accent={A}
                            busy={promoBusy}
                            /* กดใบที่ใช้อยู่ = เอาออก ไม่ใช่กดแล้วไม่มีอะไรเกิดขึ้น —
                               ไม่งั้นลูกค้าเปลี่ยนใจไปใช้ใบอื่นไม่ได้เลย */
                            onPress={() => (on ? clearCoupon() : void applyCoupon(c))}
                            footer={
                              <Text
                                style={[
                                  styles.couponUse,
                                  {
                                    color: on ? Colors.textMuted : A.strong,
                                  },
                                ]}>
                                {on ? 'แตะเพื่อเอาออก' : 'แตะเพื่อใช้'}
                              </Text>
                            }
                          />
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

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
                  <Text style={[styles.promoApply, { color: A.strong }]}>
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
                  {t('cart.subtotalLabel')}
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

              {/* วิธีชำระเงินไม่อยู่ในสรุปแล้ว (เจ้าของสั่ง 5 ก.ย. 2026 "ชำอะไรออนไลน์
                  promptPay เอาออกไปเลย เราแค่สรุปรายการครับ") — กล่องนี้มีหน้าที่บอกว่า
                  จ่ายเท่าไหร่ ไม่ใช่จ่ายอย่างไร วิธีจ่ายไปเลือกที่หน้าชำระเงินอยู่แล้ว */}

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
                  ? `${t('cart.closedShort')} ${shopHoursLabel(shopHours)}`
                  : nothingSelected
                      ? t('cart.nothingSelected')
                      : needsParcel
                        ? t('cart.needParcelAddress')
                        : needsContact
                          ? t('cart.needContact')
                          /* ★ คำอธิบายต้องตรงกับตัวเลขที่โชว์ ★ ตัวเลขข้างล่างคือยอด
                             ที่ต้องจ่ายจริง (รวมค่าส่ง หักส่วนลดแล้ว) แต่คำเดิมเขียนว่า
                             "รวมที่เลือก · N ชิ้น" ซึ่งอ่านเป็นยอดค่าสินค้าเฉย ๆ ลูกค้าเลย
                             เห็นเลขไม่ตรงกับที่บวกเอง (เจ้าของทัก "ทำยอดให้ตรงด้วยครับ")
                             ค่าส่งเป็นศูนย์ก็ไม่ต้องเขียนถึง ไม่งั้นรกโดยไม่ได้ความ */
                          : deliveryFee > 0
                            ? 'ยอดที่ต้องจ่าย รวมค่าส่ง'
                            : 'ยอดที่ต้องจ่าย'}
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
              style={[
                styles.checkoutCta,
                { backgroundColor: A.solid },
                !canCheckout && styles.checkoutCtaOff,
              ]}>
              <Text style={styles.checkoutCtaText}>{checkoutVerb}</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.textOnPrimary} />
            </PressableScale>
          </Animated.View>

          {/* Slide-to-confirm checkout sheet */}
          <CheckoutSheet
            accent={A}
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
  /* การ์ดที่อยู่พัสดุ — ลำดับความสำคัญชัด: ชื่อ+เบอร์ > ที่อยู่ > ตำบล/อำเภอ/จังหวัด
     + รหัสไปรษณีย์แยกเป็นก้อนตัวเลข (เจ้าของสั่งให้ตัวเลขกับตัวหนังสือชัดเจน) */
  parcelCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    ...Shadow.card,
  },
  parcelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parcelTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  parcelTagText: { fontFamily: 'Mitr_500Medium', fontSize: 13, color: Colors.textMuted },
  parcelEdit: { fontFamily: 'Mitr_500Medium', fontSize: 13 },
  parcelWho: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: 2 },
  parcelName: { flexShrink: 1, fontFamily: 'Mitr_500Medium', fontSize: 16, color: Colors.text },
  // เบอร์เป็นตัวเลขที่พนักงานขนส่งต้องอ่านออกตอนโทรหา เว้นระยะตัวอักษรให้อ่านทีละหลักได้
  parcelPhone: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    letterSpacing: 0.5,
    color: Colors.text,
  },
  parcelLine: { fontSize: 14, lineHeight: 21, color: Colors.text },
  parcelZone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  parcelZoneText: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.textMuted },
  /* ก้อนรหัสไปรษณีย์ — เลขห้าหลักที่ผิดตัวเดียวพัสดุไปคนละจังหวัด ต้องตรวจได้ในแวบเดียว */
  zip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  zipText: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 15,
    letterSpacing: 2,
    color: Colors.text,
  },
  parcelWarn: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: 2 },
  parcelWarnCopy: { flex: 1 },
  parcelWarnTitle: { fontFamily: 'Mitr_500Medium', fontSize: 15, color: Colors.text },

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
  /* หัวโซน — หนาขึ้นและเข้มขึ้นกว่าเดิม (เจ้าของทัก 5 ก.ย. 2026 "ตัวหนังสือเอาตัวหนา
     ครับ บางแล้วมองไม่ชัด") ของเดิมเป็นตัวกลางสีเทาจาง อ่านยากบนพื้นขาวโดยเฉพาะ
     กลางแดดหรือจอที่หรี่แสงอยู่ */
  eyebrow: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    /* ★ เว้นบนให้ห่างจากโซนก่อนหน้า ★ เดิมหัวข้อลอยชิดการ์ดที่อยู่ด้านบนจนดูเป็นก้อน
       เดียวกัน (เจ้าของทัก "อย่าเอาไปชิดกับข้างบน แยกโซนให้ชัดเจน") — ระยะบนต้อง
       มากกว่าระยะล่างชัด ๆ หัวข้อจึงจะอ่านเป็น "ของก้อนถัดไป" ไม่ใช่หางของก้อนบน */
    marginTop: Spacing.x2,
    marginBottom: Spacing.sm,
  },
  eyebrowTop: {
    marginTop: Spacing.x3,
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
  myCoupons: { marginBottom: Spacing.md },
  myCouponsHead: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  myCouponsRow: { gap: Spacing.sm },
  couponCell: { width: 194 },
  couponUse: { fontFamily: 'Mitr_500Medium', fontSize: 12 },
  couponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  couponChipOn: { backgroundColor: Colors.primary },
  couponChipText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    color: Colors.primaryStrong,
  },
  couponChipTextOn: { color: Colors.textOnPrimary },
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
  /* หนาและเข้มขึ้น (เจ้าของสั่ง 5 ก.ย. 2026 "ตรงสรุปคำสั่งซื้อ ทำตัวอักษรให้หนา") —
     ของเดิมฝั่งซ้ายเป็นเทาจาง อ่านคู่กับตัวเลขฝั่งขวาไม่ติดกันเป็นบรรทัดเดียว */
  sumLabel: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.text,
  },
  sumValue: {
    fontFamily: 'Mitr_600SemiBold',
    fontSize: 16,
    color: Colors.text,
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
