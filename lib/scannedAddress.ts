/**
 * บันทึกพิกัดที่สแกนได้ลงใบที่อยู่ "ตำแหน่งปัจจุบัน" — ใช้ร่วมกันทั้งสองโหมด
 *
 * จอเช็คก่อนเข้าโหมดทั้งสอง (delivery-check / online-check) จับพิกัดแล้วเขียนลงใบเดียวกัน
 * ★ ต้องอยู่ที่เดียว ★ ตอนที่ต่างคนต่างเขียน จอเดลิเวอรี่บันทึกโดยไม่ส่งจังหวัด/รหัส
 * ไปรษณีย์มาด้วย ซึ่ง upsert เขียนทั้งแถวเสมอ (toRow ใส่ null ให้ช่องที่ไม่ได้ส่ง) ผลคือ
 * เปิดโหมดเดลิเวอรี่ทีไรก็ล้างสิ่งที่โหมดออนไลน์เพิ่งเติมทิ้งทุกครั้ง กฎการรวมข้อมูลจึง
 * ต้องมีชุดเดียว ไม่ใช่ชุดใครชุดมัน
 */

import type { ParcelParts } from '@/lib/address';
import { kmBetween } from '@/lib/geo';
import { SCANNED_LABEL, useAddress } from '@/store/address';

/** ผลการสแกนหนึ่งครั้ง — ที่อยู่บรรทัดเดียว + ส่วนประกอบไปรษณีย์ + พิกัด */
export type ScannedPin = {
  line: string;
  /** null = ถอดรหัสได้ที่อยู่แต่แกะส่วนประกอบไม่ได้ */
  parts: ParcelParts | null;
  lat: number;
  lng: number;
};

/**
 * ไกลกว่านี้ถือว่า "คนละที่" — ส่วนประกอบที่อยู่ใบเดิมเป็นของที่เก่า ต้องเขียนทับทั้งชุด
 *
 * ★ กฎนี้กันพัสดุส่งผิดจังหวัด ★ ที่อยู่บรรทัดหลักถูกเขียนทับด้วยพิกัดใหม่เสมอ ถ้าจังหวัด
 * กับรหัสไปรษณีย์ไม่ถูกเขียนทับตามไปด้วย ใบเดียวกันจะมีที่อยู่เชียงใหม่คู่กับจังหวัด
 * กรุงเทพฯ ที่ค้างจากรอบก่อน — ผิดยิ่งกว่าไม่มีอะไรเลย เพราะฟอร์มดูเหมือนกรอกครบ
 * ในระยะนี้ถือว่าที่เดิม (ความคลาดของ GPS ในเมืองอยู่ระดับสิบ ๆ เมตร) ค่าที่ลูกค้าแก้เอง
 * จึงชนะผลถอดรหัส ซึ่งเดาตำบล/อำเภอพลาดได้บ่อยแถบชานเมือง
 */
const SAME_SPOT_KM = 0.3;

/**
 * เขียนใบ "ตำแหน่งปัจจุบัน" ใบเดิมทับ (ไม่สร้างใบใหม่ทุกครั้ง ไม่งั้นสมุดที่อยู่จะรกด้วย
 * ที่อยู่ซ้ำ ๆ ทุกครั้งที่เปิดโหมด) แล้วคืน id ของใบนั้น
 *
 * `contact` = ชื่อ/เบอร์สำรองจากโปรไฟล์ ใช้เฉพาะตอนใบเดิมยังว่าง — ส่งค่าว่างมาได้ถ้า
 * ยังไม่ล็อกอิน (ชื่อใน store ตอนนั้นเป็นชื่อสำรอง ไม่ใช่ชื่อผู้รับจริง) แล้วตะกร้าจะกัน
 * ไม่ให้สั่งจนกว่าจะกรอก
 */
export async function saveScannedAddress(
  pin: ScannedPin,
  contact: { recipient: string; phone: string },
): Promise<string> {
  const existing = useAddress.getState().addresses.find((a) => a.label === SCANNED_LABEL);
  const moved = !existing || kmBetween(existing.lat, existing.lng, pin.lat, pin.lng) > SAME_SPOT_KM;
  const part = (old: string | undefined, fresh: string | undefined) =>
    moved ? fresh : old || fresh;

  return useAddress.getState().upsert({
    id: existing?.id,
    label: SCANNED_LABEL,
    /* ชื่อ/เบอร์ไม่ได้ผูกกับสถานที่ — ย้ายที่ก็ยังเป็นคนเดิม เก็บของเดิมไว้เสมอ */
    recipient: existing?.recipient || contact.recipient,
    phone: existing?.phone || contact.phone,
    line: pin.line,
    lat: pin.lat,
    lng: pin.lng,
    subDistrict: part(existing?.subDistrict, pin.parts?.subDistrict),
    district: part(existing?.district, pin.parts?.district),
    province: part(existing?.province, pin.parts?.province),
    postalCode: part(existing?.postalCode, pin.parts?.postalCode),
  });
}
