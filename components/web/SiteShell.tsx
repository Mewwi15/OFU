/**
 * SiteShell — web-only responsive chrome around the router.
 *
 *  - Native / mobile-width web: children untouched (the phone app).
 *  - Tablet (≤ DESKTOP_BREAK): the phone column centred with gutters.
 *  - Desktop: a real storefront — SiteHeader on top; the shopping routes
 *    (home / catalog / product) render their own full-width desktop layouts,
 *    every other route (cart, checkout, orders, account, login, …) keeps its
 *    phone layout in a centred column under the header.
 *
 * Layout math inside the app must use lib/useAppWidth (also WEB_FRAME_MAX).
 */

import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { SiteHeader } from '@/components/web/SiteHeader';
import { Colors } from '@/constants/theme';
import { DESKTOP_BREAK, WEB_FRAME_MAX } from '@/lib/useAppWidth';

/** Routes that render their own full-width desktop layouts. */
function isFullBleed(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/product');
}

export function SiteShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();

  if (Platform.OS !== 'web' || width <= WEB_FRAME_MAX) {
    return <>{children}</>;
  }

  if (width < DESKTOP_BREAK) {
    return (
      <View style={styles.tabletStage}>
        <View style={styles.tabletColumn}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SiteHeader />
      {isFullBleed(pathname) ? (
        <View style={styles.full}>{children}</View>
      ) : (
        <View style={styles.centered}>
          <View style={styles.column}>{children}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabletStage: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  tabletColumn: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_FRAME_MAX,
    backgroundColor: Colors.background,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  full: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_FRAME_MAX,
    backgroundColor: Colors.background,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
});
