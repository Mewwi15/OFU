/**
 * Google Places API (New) — autocomplete + place lookup for the address picker.
 *
 * Uses the same Android-restricted key as the native map. The Places REST
 * endpoints honour an "Android apps" key restriction when the request carries
 * X-Android-Package / X-Android-Cert headers matching a cert registered on the
 * key — Google checks the headers against the key's allow-list (it cannot see
 * the real signature over REST), so the registered debug SHA-1 works from any
 * build and release builds need no change HERE (the native map still needs the
 * release SHA-1 added to the key).
 *
 * Cost: only Essentials-tier SKUs are used — Autocomplete per-request and
 * Place Details with an Essentials field mask — each with a 10K/month free
 * tier, far above the shop's scale. Adding Pro fields (displayName, rating…)
 * to the field mask would move Details to a paid SKU: don't.
 *
 * iOS ships Apple Maps and no Google key, so this module reports unavailable
 * there; the picker falls back to the on-device geocoder (which is decent on
 * real iOS devices), same as when a call here fails.
 */

import { Platform } from 'react-native';

type LatLng = { latitude: number; longitude: number };

export type PlaceSuggestion = {
  placeId: string;
  /** Place name / first line, e.g. "บิ๊กซี เอ็กซ์ตร้า พระราม 4". */
  primary: string;
  /** Locality context, e.g. "ถนนพระรามที่ 4 คลองเตย กรุงเทพมหานคร". */
  secondary: string;
};

// Same key as android/app/src/main/AndroidManifest.xml (already public in the
// repo; usable only by apps on the key's Android allow-list).
const KEY = 'AIzaSyBtLlL9dF_bJEPpccud6Q3N4uat_O0C3-8';
const ANDROID_PACKAGE = 'com.anonymous.myrnapp';
// Debug-keystore SHA-1 registered on the key (colons stripped).
const ANDROID_CERT = '5E8F16062EA3CD2C4A0D547876BAA6F38CABF625';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': KEY,
  'X-Android-Package': ANDROID_PACKAGE,
  'X-Android-Cert': ANDROID_CERT,
};

export function placesAvailable(): boolean {
  return Platform.OS === 'android';
}

/**
 * Suggest places for a partial query (Google returns up to 5), biased around
 * `near` and restricted to Thailand — the shop only delivers domestically.
 * Throws on HTTP/network failure so the caller can fall back.
 */
export async function autocompletePlaces(
  input: string,
  opts: { lang: string; near?: LatLng },
): Promise<PlaceSuggestion[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      input,
      languageCode: opts.lang,
      includedRegionCodes: ['TH'],
      ...(opts.near
        ? { locationBias: { circle: { center: opts.near, radius: 30000 } } }
        : null),
    }),
  });
  if (!res.ok) throw new Error(`places autocomplete ${res.status}`);
  const json: {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  } = await res.json();

  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId!,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }))
    .filter((p) => p.primary.length > 0);
}

/**
 * Resolve a suggestion to coordinates + a formatted address line.
 * Field mask stays Essentials-tier (see module doc). Throws on failure.
 */
export async function fetchPlaceLocation(
  placeId: string,
  lang: string,
): Promise<{ coords: LatLng; address: string }> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${lang}`,
    { headers: { ...HEADERS, 'X-Goog-FieldMask': 'location,formattedAddress' } },
  );
  if (!res.ok) throw new Error(`place details ${res.status}`);
  const json: {
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
  } = await res.json();
  const { latitude, longitude } = json.location ?? {};
  if (latitude == null || longitude == null) throw new Error('place has no location');
  return { coords: { latitude, longitude }, address: json.formattedAddress ?? '' };
}
