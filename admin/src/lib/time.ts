/**
 * เวลาไทยที่เดียวของแอดมิน
 *
 * ฐานข้อมูลเก็บเป็น timestamptz (UTC) ส่วน `dayjs()` เปล่า ๆ จะแปลงตาม timezone
 * ของ "เครื่องที่เปิดเว็บ" — บนเครื่องในร้านมันบังเอิญถูกเพราะเครื่องตั้งเป็นไทยอยู่แล้ว
 * แต่พอเปิดจากมือถือที่ตั้งโซนผิด หรือ preview บน Vercel ก็จะเพี้ยนไป 7 ชั่วโมงเงียบ ๆ
 * โดยไม่มีอะไรฟ้อง — เวลาปิดรอบเลยกลายเป็นคนละวันได้
 *
 * `d()` ตรึงไว้ที่ Asia/Bangkok เสมอ ไม่ว่าเปิดจากเครื่องไหน ใช้แทน `dayjs()` ให้หมด
 * (`dayjs.tz.setDefault` มีผลเฉพาะ `dayjs.tz(...)` ไม่ครอบ `dayjs()` เปล่า จึงต้องห่อเอง)
 */

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TH_TZ = 'Asia/Bangkok';

/** dayjs ที่เป็นเวลาไทยเสมอ — ใช้แทน dayjs() ทุกที่ที่แสดงเวลาให้คนอ่าน */
export const d = (value?: string | number | Date | null) =>
  value == null ? dayjs().tz(TH_TZ) : dayjs(value).tz(TH_TZ);

/**
 * "ผ่านมานานแค่ไหนแล้ว" แบบอ่านออกทันที — ปัดเป็นหน่วยหยาบพอ เพราะคนหน้าร้าน
 * อยากรู้แค่ว่า "เพิ่งเปิด" หรือ "เปิดค้างมาทั้งคืน" ไม่ได้อยากรู้ระดับวินาที
 */
export function since(from: string | Date, now = new Date()): string {
  const mins = Math.max(0, d(now).diff(d(from), 'minute'));
  if (mins < 1) return 'เพิ่งเปิด';
  if (mins < 60) return `${mins} นาที`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m === 0 ? `${h} ชั่วโมง` : `${h} ชม. ${m} นาที`;
  const days = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${days} วัน` : `${days} วัน ${rh} ชม.`;
}
