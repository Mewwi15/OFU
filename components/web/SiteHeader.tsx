/**
 * SiteHeader — desktop-web top navigation bar (SiteShell mounts it on wide
 * viewports; never rendered on native/mobile). Logo + primary nav + search +
 * cart/account, all routing into the same expo-router screens the phone uses.
 * Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { cartCount, useCart } from '@/store/cart';

/** Web-only: suppress the browser focus ring inside the search pill. */
const NO_FOCUS_RING = { outlineStyle: 'none' } as unknown as TextStyle;

const NAV = [
  { labelKey: 'tab.home', href: '/' },
  { labelKey: 'tab.products', href: '/search' },
  { labelKey: 'tab.orders', href: '/orders' },
] as const;

export function SiteHeader() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const count = useCart((s) => cartCount(s.items));
  const [query, setQuery] = useState('');

  const submitSearch = () => {
    const q = query.trim();
    router.push(q ? { pathname: '/search', params: { q } } : '/search');
    setQuery('');
  };

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        {/* Brand */}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/')}
          style={styles.brand}>
          <Image
            source={require('@/assets/images/logo-oofoo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.brandName}>อู้ฟู่</Text>
        </Pressable>

        {/* Primary nav */}
        <View style={styles.nav}>
          {NAV.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Pressable
                key={item.href}
                accessibilityRole="link"
                onPress={() => router.push(item.href)}
                style={styles.navItem}>
                <Text style={[styles.navText, active && styles.navTextActive]}>
                  {t(item.labelKey)}
                </Text>
                <View style={[styles.navUnderline, active && styles.navUnderlineActive]} />
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            placeholder={t('site.searchPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            style={[styles.searchInput, NO_FOCUS_RING]}
          />
        </View>

        {/* Cart + account */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('tab.cart')}
          onPress={() => router.push('/cart')}
          style={styles.iconBtn}>
          <Ionicons name="cart-outline" size={22} color={Colors.text} />
          {count > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('tab.account')}
          onPress={() => router.push('/account')}
          style={styles.iconBtn}>
          <Ionicons name="person-circle-outline" size={24} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    height: 68,
    paddingHorizontal: Spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 38,
    height: 38,
  },
  brandName: {
    ...Typography.heading,
    color: Colors.text,
  },
  nav: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginLeft: Spacing.lg,
  },
  navItem: {
    alignItems: 'center',
    gap: 3,
  },
  navText: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  navTextActive: {
    color: Colors.primaryStrong,
  },
  navUnderline: {
    height: 3,
    alignSelf: 'stretch',
    borderRadius: Radius.pill,
    backgroundColor: 'transparent',
  },
  navUnderlineActive: {
    backgroundColor: Colors.primaryStrong,
  },
  search: {
    flex: 1,
    maxWidth: 340,
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    padding: 0,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 10,
    color: Colors.textOnPrimary,
  },
});
