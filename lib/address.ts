/**
 * Address formatting shared between the address picker, the two mode-check
 * screens, and every screen that prints a shipping address — all turn a reverse-geocode result into a readable Thai line and
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

/**
 * ตัดส่วนที่ซ้ำกับช่องข้อมูลแยกออกจากที่อยู่บรรทัดหลัก
 *
 * ★ ห้ามโชว์รหัสไปรษณีย์สองตัวที่ไม่ตรงกัน ★ บรรทัดที่อยู่มาจากการถอดรหัสพิกัดหรือที่
 * ลูกค้าพิมพ์เอง ส่วนตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์เป็นช่องแยกที่ลูกค้าแก้ทีหลังได้
 * สองอย่างนี้ไม่ตรงกันได้ (ย้ายที่แล้วแก้แค่ช่องแยก) พอโชว์ทั้งคู่เต็ม ๆ ลูกค้าจะเห็น
 * "10800" กับ "10330" อยู่ติดกันแล้วไม่รู้ว่าพัสดุจะไปไหน
 * ช่องแยกคือตัวที่ใช้ส่งจริง บรรทัดหลักจึงเหลือแค่ชื่อถนน/บ้านเลขที่
 */
export function streetOnly(a: { line: string; subDistrict?: string; district?: string; province?: string; postalCode?: string }): string {
  let out = a.line;
  for (const part of [a.postalCode, a.province, a.district, a.subDistrict]) {
    const token = part?.trim();
    if (token) out = out.split(token).join(' ');
  }
  /* ตัดรหัสไปรษณีย์ท้ายบรรทัดทิ้งเสมอ ไม่ใช่เฉพาะตัวที่ตรงกับช่องแยก — ถ้าสองที่ไม่ตรงกัน
     (ลูกค้าย้ายที่แล้วแก้แค่ช่องแยก) การโชว์ทั้งคู่คือการโชว์เลขที่ขัดกันเองให้ลูกค้าเดา
     ช่องแยกคือตัวที่ใช้ส่งจริง เลขในบรรทัดจึงต้องหายไป ไม่ใช่มาแข่งกัน
     ตัดเฉพาะที่อยู่ท้ายบรรทัด — รหัสไปรษณีย์ไทยอยู่ท้ายเสมอ ส่วนบ้านเลขที่อยู่ต้น */
  out = out.replace(/\s*\b\d{5}\b\s*$/, '');
  return out.replace(/\s{2,}/g, ' ').trim() || a.line;
}
