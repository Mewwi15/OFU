/**
 * Platform seam for expo-maps. Import maps from here, never from 'expo-maps'
 * directly: its entry calls requireNativeModule('ExpoMaps') at import time,
 * which throws on web and would take the whole bundle down. Metro swaps in
 * native-maps.web.ts on web (stub Views that render nothing).
 */

export { AppleMaps, GoogleMaps } from 'expo-maps';
