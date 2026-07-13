/**
 * Width of the column the app actually renders in.
 *
 * On web, DesktopShell caps the app at WEB_FRAME_MAX and centres it on wide
 * viewports — so any layout math (image paging, banner aspect fills) must size
 * against this, never the raw window width, or desktop browsers get phone
 * layouts stretched to monitor width. On native it's just the window width.
 */

import { Platform, useWindowDimensions } from 'react-native';

/** Max width of the app column on web (phone-sized, matches SiteShell). */
export const WEB_FRAME_MAX = 480;

/** Viewport width where the web switches to the full desktop storefront. */
export const DESKTOP_BREAK = 1024;

export function useAppWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, WEB_FRAME_MAX) : width;
}

/** True when the web viewport is desktop-sized (full storefront layouts). */
export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAK;
}
