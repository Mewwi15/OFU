/**
 * Address formatting shared between the address picker and the delivery-zone
 * scan screen — both turn a reverse-geocode result into one readable Thai
 * line. Kept in one place so the two screens can't drift into showing the
 * address differently for the same coordinates.
 */

import type * as Location from 'expo-location';

/** Build a readable Thai address line from a reverse-geocode result. */
export function formatAddressLine(a: Location.LocationGeocodedAddress): string {
  const raw = [
    a.name,
    a.streetNumber,
    a.street,
    a.district,
    a.subregion,
    a.city,
    a.region,
    a.postalCode,
  ]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);

  // Drop any part already represented in what we've collected — Apple often
  // returns `name` as "<streetNumber> <street>", duplicating the next two parts.
  const out: string[] = [];
  for (const p of raw) {
    if (!out.join(' ').includes(p)) out.push(p);
  }
  return out.join(' ');
}
