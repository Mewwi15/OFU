/**
 * DesktopProduct — desktop-web product page (app/product/[id].tsx returns
 * this on wide viewports). Two-column: photo gallery left, buy panel right
 * (name, price, perks, quantity + add-to-cart, description). Shares the cart
 * store and Toast with the phone screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/Toast';
import { SiteFooter } from '@/components/web/SiteFooter';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { Product } from '@/data/products';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useCart } from '@/store/cart';

const PERKS = [
  { icon: 'bicycle-outline', label: 'product.perkFast' },
  { icon: 'leaf-outline', label: 'product.perkFresh' },
  { icon: 'shield-checkmark-outline', label: 'product.perkQuality' },
] as const;

type Props = { product: Product };

export function DesktopProduct({ product }: Props) {
  const t = useT();
  const router = useRouter();
  const add = useCart((s) => s.add);

  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  const soldOut =
    product.variants.length > 0 && product.variants.every((v) => (v.available ?? 0) <= 0);
  const total = product.price * qty;
  const mainImage = product.images[activeImage] ?? product.images[0];

  const handleAdd = () => {
    if (soldOut) return;
    add(product, { qty });
    setToastKey((k) => k + 1);
    setShowToast(true);
  };

  return (
    <View style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* Breadcrumb */}
          <View style={styles.breadcrumb}>
            <Pressable accessibilityRole="link" onPress={() => router.push('/')}>
              <Text style={styles.crumbLink}>{t('tab.home')}</Text>
            </Pressable>
            <Text style={styles.crumbSep}>/</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                router.push({ pathname: '/search', params: { category: product.category } })
              }>
              <Text style={styles.crumbLink}>{product.category}</Text>
            </Pressable>
            <Text style={styles.crumbSep}>/</Text>
            <Text style={styles.crumbHere} numberOfLines={1}>
              {product.name}
            </Text>
          </View>

          <View style={styles.columns}>
            {/* Gallery */}
            <View style={styles.gallery}>
              <View style={styles.mainPhotoWrap}>
                {mainImage ? (
                  <Image
                    source={{ uri: mainImage }}
                    style={styles.mainPhoto}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.photoFallback}>
                    <Ionicons name="image-outline" size={56} color={Colors.textMuted} />
                  </View>
                )}
              </View>
              {product.images.length > 1 ? (
                <View style={styles.thumbRow}>
                  {product.images.map((uri, i) => (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      onPress={() => setActiveImage(i)}
                      style={[styles.thumb, i === activeImage && styles.thumbActive]}>
                      <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Buy panel */}
            <View style={styles.panel}>
              <View style={styles.categoryPill}>
                <Text variant="caption" style={styles.categoryText}>
                  {product.category}
                </Text>
              </View>
              <Text style={styles.name}>{product.name}</Text>
              {product.subtitle ? (
                <Text style={styles.subtitle}>{product.subtitle}</Text>
              ) : null}
              <Text style={styles.price}>{money(product.price)}</Text>

              <View style={styles.perks}>
                {PERKS.map((perk) => (
                  <View key={perk.label} style={styles.perk}>
                    <Ionicons name={perk.icon} size={16} color={Colors.primaryStrong} />
                    <Text variant="caption" style={styles.perkLabel}>
                      {t(perk.label)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.buyRow}>
                <QuantityStepper value={qty} onChange={setQty} max={99} />
                <Button onPress={handleAdd} disabled={soldOut} style={styles.addButton}>
                  {soldOut ? t('site.soldOut') : `${t('product.addToCart')} · ${money(total)}`}
                </Button>
              </View>

              {product.description ? (
                <>
                  <Text variant="subtitle" style={styles.sectionLabel}>
                    {t('product.description')}
                  </Text>
                  <Text variant="body" style={{ color: Colors.textMuted }}>
                    {product.description}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>
        <SiteFooter />
      </ScrollView>

      {showToast ? (
        <Toast
          key={toastKey}
          message={t('product.addedToCart')}
          subtitle={`${product.name} × ${qty}`}
          actionLabel={t('product.viewCart')}
          onAction={() => {
            setShowToast(false);
            router.push('/cart');
          }}
          onHide={() => setShowToast(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  crumbLink: {
    ...Typography.caption,
    color: Colors.primaryStrong,
  },
  crumbSep: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  crumbHere: {
    ...Typography.caption,
    color: Colors.textMuted,
    maxWidth: 320,
  },
  columns: {
    flexDirection: 'row',
    gap: Spacing.xl * 2,
    alignItems: 'flex-start',
  },

  /* Gallery */
  gallery: {
    flex: 1,
    maxWidth: 520,
    gap: Spacing.md,
  },
  mainPhotoWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  mainPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Colors.surfaceMuted,
  },
  thumbActive: {
    borderColor: Colors.primaryStrong,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },

  /* Buy panel */
  panel: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  categoryText: {
    color: Colors.primaryStrong,
  },
  name: {
    ...Typography.display,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  price: {
    ...Typography.display,
    color: Colors.primaryStrong,
    marginTop: Spacing.lg,
  },
  perks: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  perkLabel: {
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xl,
  },
  buyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  addButton: {
    flex: 1,
    maxWidth: 360,
  },
  sectionLabel: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
});
