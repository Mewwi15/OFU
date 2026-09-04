/**
 * Address formatting shared between the address picker and the two mode-check
 * screens — all turn a reverse-geocode result into a readable Thai line and
 * Thai postal parts. Kept in one place so they can't drift into showing the
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

/** Best-effort map of a reverse-geocode result to Thai postal parts. */
export type ParcelParts = {
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

/**
 * แปลงผลถอดรหัสพิกัดเป็นส่วนประกอบที่อยู่แบบไทย
 *
 * ชื่อฟิลด์ของ expo-location ไม่ตรงกับลำดับการปกครองไทย — `district` ของมันคือตำบล/แขวง
 * ส่วนอำเภอ/เขตไปอยู่ที่ `subregion` และจังหวัดอยู่ที่ `region` (กรุงเทพฯ บางทีมาที่
 * `city` แทน) จึงต้องแมปมือแบบนี้ อย่าเดาจากชื่อฟิลด์
 */
export function parcelPartsFrom(a: Location.LocationGeocodedAddress): ParcelParts {
  return {
    subDistrict: a.district?.trim() ?? '',
    district: (a.subregion ?? a.city)?.trim() ?? '',
    province: (a.region ?? a.city)?.trim() ?? '',
    postalCode: a.postalCode?.trim() ?? '',
  };
}
