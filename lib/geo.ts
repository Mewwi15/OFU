/**
 * Straight-line distance helpers (haversine).
 *
 * Used by the delivery-zone gate in checkout; must agree with the server's
 * `km_between` (0073) so the app never green-lights an address the trigger
 * will reject. Straight-line, not road distance, on both sides — the shop
 * tunes `delivery_radius_km` to compensate.
 */

export function kmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
