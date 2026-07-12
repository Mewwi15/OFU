/**
 * Google Places API (New) — autocomplete + place lookup for the address picker.
 *
 * A Google key can carry ONE application-restriction type, so each platform
 * has its own key (both restricted to Places API (New) only, both safe to
 * commit — the repo is public either way and a restricted key is unusable by
 * others). The REST endpoints honour those restrictions via identification
 * headers that Google checks against the key's allow-list (it cannot see the
 * real app signature over REST):
 *  - Android: X-Android-Package + X-Android-Cert. The registered DEBUG SHA-1
 *    works from any build, so release builds need no change HERE (only the
 *    native map needs the release SHA-1 added to its key).
 *  - iOS: X-Ios-Bundle-Identifier.
 *
 * Cost: only Essentials-tier SKUs are used — Autocomplete per-request and
 * Place Details with an Essentials field mask — each with a 10K/month free
 * tier, far above the shop's scale. Adding Pro fields (displayName, rating…)
 * to the field mask would move Details to a paid SKU: don't.
 *
 * When no key exists for the platform (or a call fails), the picker falls
 * back to the on-device geocoder.
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

// iOS-apps-restricted key (bundle id com.oofoo.shop — same id on both
// platforms since the 2026-07 store-prep rename; the key's GCP allowlist must
// include it or Places calls 403 and the picker falls back to the geocoder).
const IOS_KEY = 'AIzaSyAj78470TAv1n_hAV9bGATJappdYPZedJU';

const CREDS = Platform.select<{ key: string; idHeaders: Record<string, string> } | null>({
  android: {
    // Same key as android/app/src/main/AndroidManifest.xml.
    key: 'AIzaSyBtLlL9dF_bJEPpccud6Q3N4uat_O0C3-8',
    idHeaders: {
      'X-Android-Package': 'com.oofoo.shop',
      // Debug-keystore SHA-1 registered on the key (colons stripped).
      'X-Android-Cert': '5E8F16062EA3CD2C4A0D547876BAA6F38CABF625',
    },
  },
  ios: IOS_KEY
    ? { key: IOS_KEY, idHeaders: { 'X-Ios-Bundle-Identifier': 'com.oofoo.shop' } }
    : null,
  default: null,
});

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': CREDS?.key ?? '',
  ...CREDS?.idHeaders,
};

export function placesAvailable(): boolean {
  return CREDS != null;
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
