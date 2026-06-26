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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AppText } from '@/components/ui/Text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { money } from '@/lib/format';
import { cartSubtotal, useCart } from '@/store/cart';

/** Bottom space so content clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 110;

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [promo, setPromo] = useState('');

  const subtotal = cartSubtotal(items);
  const total = subtotal;
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
    Alert.alert('สั่งซื้อสำเร็จ', 'ขอบคุณที่อุดหนุนร้านอู้ฟู่ค่ะ');
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
          <AppText variant="h1" style={styles.emptyTitle}>
            ตะกร้าว่างเปล่า
          </AppText>
          <AppText
            variant="body"
            color={Colors.textMuted}
            style={styles.emptyBody}>
            ไปเลือกซื้อสินค้ากันเลย
          </AppText>
          <Button title="ช้อปเลย" onPress={goShopping} style={styles.emptyButton} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
          ]}>
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
          <AppText variant="h2" style={styles.sectionTitle}>
            กรอกโค้ดส่วนลด
          </AppText>
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
            <Button title="ใช้โค้ด" size="sm" onPress={onApply} />
          </View>

          {/* Summary */}
          <Card style={styles.summary} padding={Spacing.lg}>
            <View style={styles.summaryRow}>
              <AppText variant="body" color={Colors.textMuted}>
                ยอดรวมสินค้า
              </AppText>
              <AppText variant="body">{money(subtotal)}</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <AppText variant="h2">รวมทั้งหมด</AppText>
              <AppText variant="price" color={Colors.primary}>
                {money(total)}
              </AppText>
            </View>
          </Card>

          <Button
            title="สั่งซื้อเลย"
            fullWidth
            onPress={onBuyNow}
            style={styles.buyButton}
          />
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
  list: {
    gap: Spacing.md,
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
