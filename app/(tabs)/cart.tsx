/**
 * Cart tab — `/cart`.
 *
 * A top-level tab now (no back button). Header ("ตะกร้าของฉัน" + bell), a scroll
 * list of cart lines (ProductListItem variant="cart"), a promo-code input +
 * Apply, a Sub Total / Total summary, and a full-width "Buy Now" button. Shows a
 * friendly empty state when the cart has no items. Amounts are in Baht via money().
 * Content leaves clearance for the floating tab bar.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductListItem } from '@/components/product/ProductListItem';
import { ModeSwitch } from '@/components/shop/ModeSwitch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { money } from '@/lib/format';
import { cartSubtotal, useCart } from '@/store/cart';
import { deliveryFeeFor, useMode } from '@/store/mode';

/** Payment hint shown per mode (the two flows differ on payment). */
const PAYMENT_HINT = {
  delivery: 'ชำระปลายทาง หรือโอนเมื่อรับของ',
  online: 'ชำระออนไลน์ PromptPay/โอน + แนบสลิป',
} as const;

/** Bottom space so content clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 110;

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const mode = useMode((s) => s.mode);

  const [promo, setPromo] = useState('');

  const subtotal = cartSubtotal(items);
  const deliveryFee = deliveryFeeFor(mode, subtotal);
  const total = subtotal + deliveryFee;
  const isEmpty = items.length === 0;

  const goShopping = () => router.push('/');

  const onApply = () => {
    // Mock promo application.
    Alert.alert(
      'โค้ดส่วนลด',
      promo.trim() ? `ใช้โค้ด "${promo.trim()}" แล้ว` : 'กรุณากรอกโค้ดส่วนลดก่อน',
    );
  };

  const onBuyNow = () => {
    clear();
    setPromo('');
    const detail =
      mode === 'delivery'
        ? 'เราจะจัดส่งถึงบ้านคุณเร็วๆ นี้ค่ะ'
        : 'ชำระเงินออนไลน์แล้วแนบสลิป รับสินค้าที่ร้านได้เลยค่ะ';
    Alert.alert('สั่งซื้อสำเร็จ', `ขอบคุณที่อุดหนุนร้านอู้ฟู่ค่ะ\n${detail}`);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="ตะกร้าของฉัน"
        style={styles.header}
        right={<IconButton icon="notifications-outline" onPress={() => {}} />}
      />

      {isEmpty ? (
        <View style={[styles.empty, { paddingBottom: TAB_BAR_CLEARANCE }]}>
          <IconButton
            icon="bag-handle-outline"
            variant="primary"
            size={72}
            onPress={goShopping}
          />
          <Text variant="title" style={styles.emptyTitle}>
            ตะกร้าว่างเปล่า
          </Text>
          <Text
            variant="body"
            style={[styles.emptyBody, { color: Colors.textMuted }]}>
            ไปเลือกซื้อสินค้ากันเลย
          </Text>
          <Button onPress={goShopping} style={styles.emptyButton}>ช้อปเลย</Button>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
          ]}>
          {/* Mode switch (เดลิเวอรี่ / ออนไลน์ — payment differs) */}
          <ModeSwitch compact style={styles.modeSwitch} />

          {/* Cart lines */}
          <View style={styles.list}>
            {items.map((item) => (
              <ProductListItem
                key={item.id}
                product={item.product}
                variant="cart"
                cartItemId={item.id}
                size={item.size}
                color={item.color}
                qty={item.qty}
              />
            ))}
          </View>

          {/* Promo code */}
          <Text variant="subtitle" style={styles.sectionTitle}>
            กรอกโค้ดส่วนลด
          </Text>
          <View style={styles.promoRow}>
            <View style={styles.promoInputWrap}>
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
            </View>
            <Button size="sm" onPress={onApply}>ใช้โค้ด</Button>
          </View>

          {/* Summary */}
          <Card style={{ ...styles.summary, padding: Spacing.lg }}>
            <View style={styles.summaryRow}>
              <Text variant="body" style={{ color: Colors.textMuted }}>
                ยอดรวมสินค้า
              </Text>
              <Text variant="body">{money(subtotal)}</Text>
            </View>

            {mode === 'delivery' && (
              <View style={[styles.summaryRow, styles.summaryRowGap]}>
                <Text variant="body" style={{ color: Colors.textMuted }}>
                  ค่าจัดส่ง
                </Text>
                <Text
                  variant="body"
                  style={deliveryFee === 0 ? { color: Colors.primaryStrong } : undefined}>
                  {deliveryFee === 0 ? 'ฟรี' : money(deliveryFee)}
                </Text>
              </View>
            )}

            {/* Payment method hint — differs by mode */}
            <View style={[styles.summaryRow, styles.summaryRowGap]}>
              <Text variant="body" style={{ color: Colors.textMuted }}>
                การชำระเงิน
              </Text>
              <Text variant="caption" style={styles.payHint}>
                {PAYMENT_HINT[mode]}
              </Text>
            </View>

            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text variant="subtitle">รวมทั้งหมด</Text>
              <Text
                variant="body"
                style={{ color: Colors.text, fontFamily: 'Mitr_600SemiBold' }}>
                {money(total)}
              </Text>
            </View>
          </Card>

          <View style={[styles.buyButton, { flexDirection: 'row' }]}>
            <Button style={{ flex: 1 }} onPress={onBuyNow}>
              {mode === 'delivery' ? 'สั่งซื้อ & จัดส่ง' : 'ชำระเงินออนไลน์'}
            </Button>
          </View>
        </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modeSwitch: {
    marginBottom: Spacing.lg,
  },
  list: {
    gap: Spacing.md,
  },
  summaryRowGap: {
    marginTop: Spacing.md,
  },
  payHint: {
    flex: 1,
    textAlign: 'right',
    color: Colors.text,
  },
  sectionTitle: {
    marginTop: Spacing.x2,
    marginBottom: Spacing.md,
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  promoInputWrap: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    ...Shadow.card,
  },
  promoInput: {
    ...Typography.body,
    color: Colors.text,
    padding: 0,
  },
  summary: {
    marginTop: Spacing.x2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  buyButton: {
    marginTop: Spacing.x2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
  },
  emptyTitle: {
    marginTop: Spacing.xl,
  },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: Spacing.xl,
  },
});
