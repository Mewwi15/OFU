/**
 * Web stand-ins for expo-maps (see native-maps.ts — the real module crashes at
 * import time on web). The screens using these render their own map-free
 * fallback on web, so these Views should never be visible; rendering null
 * keeps any stray mount harmless.
 */

function NullView(): null {
  return null;
}

export const AppleMaps = { View: NullView };
export const GoogleMaps = { View: NullView };
