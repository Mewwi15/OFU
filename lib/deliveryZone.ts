/**
 * เขตส่งเดลิเวอรี่ — ตอบคำถามเดียว: "ที่อยู่ที่เลือกอยู่ตอนนี้ ไรเดอร์ไปส่งได้ไหม"
 *
 * เจ้าของทัก 6 ก.ย. 2026: "ทำไมลูกค้าที่อยู่นอกพื้นที่ยังกด Delivery ได้อีก"
 *
 * ★ กติกาเขตส่งเคยอยู่ในจอเช็คตำแหน่งจอเดียว ★ (delivery-check) ซึ่งเป็นทางเข้าเดียวที่
 * ถูกดัก แต่โหมดเดลิเวอรี่ถูกเลือกได้จากอีกสองที่ที่ไม่ผ่านจอนั้นเลย:
 *   · แผ่นเลือกวิธีรับของ ตอนกดสินค้าขายดีบนหน้าแรก
 *   · สวิตช์โหมดในหน้าตะกร้า
 * ลูกค้านอกเขตจึงเดินเข้าร้านเดลิเวอรี่ หยิบของเต็มตะกร้า แล้วไปเจอด่านตอนกดจ่ายเงิน
 * ซึ่งสายเกินไป — เสียเวลาเลือกของทั้งหมดฟรี
 *
 * ★ ไม่ใช่ด่านความปลอดภัย ★ ตัวจริงคือทริกเกอร์ enforce_delivery_zone (0073) ที่ฐานข้อมูล
 * ปฏิเสธออเดอร์นอกเขตเสมอ ไฟล์นี้แค่ทำให้ลูกค้ารู้ตัวตั้งแต่ต้นทางแทนที่จะรู้ตอนจ่ายเงิน
 */

import { kmBetween } from '@/lib/geo';
import { useAddress } from '@/store/address';
import { useFees } from '@/store/mode';

export type ZoneCheck =
  /** ที่อยู่ที่เลือกอยู่ในเขต หรือร้านยังไม่ได้ตั้งเขต (= ส่งได้ทุกที่) */
  | { ok: true }
  /** อยู่นอกเขต — บอกระยะจริงไปด้วย จะได้เขียนข้อความที่ลูกค้าเชื่อได้ */
  | { ok: false; reason: 'far'; km: number }
  /** ยังไม่รู้ว่าอยู่ไหน (ยังไม่มีที่อยู่ / ที่อยู่ไม่มีหมุด) — ต้องไปสแกนตำแหน่งก่อน */
  | { ok: false; reason: 'unknown' };

export function checkDeliveryZone(): ZoneCheck {
  const { shopLat, shopLng, deliveryRadiusKm } = useFees.getState().fees;
  /* ร้านยังไม่ปักหมุดตัวเอง = ยังไม่เปิดใช้เขต — กติกาเดียวกับฝั่งฐานข้อมูล (0073)
     ต้องตรงกัน ไม่งั้นแอปห้ามแต่เซิร์ฟเวอร์ยอม (หรือกลับกัน) */
  if (shopLat == null || shopLng == null) return { ok: true };

  const { addresses, selectedId } = useAddress.getState();
  const picked = addresses.find((a) => a.id === selectedId) ?? addresses[0];
  if (!picked || picked.lat == null || picked.lng == null) return { ok: false, reason: 'unknown' };

  const km = kmBetween(shopLat, shopLng, picked.lat, picked.lng);
  return km > deliveryRadiusKm ? { ok: false, reason: 'far', km } : { ok: true };
}
