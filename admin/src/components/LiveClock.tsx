/**
 * นาฬิกาเดินจริงบนหน้าเปิด-ปิดรอบ (เจ้าของสั่ง 30 ส.ค. 2026)
 *
 * รอบขายคือเอกสารการเงินที่ผูกกับเวลา คนหน้าเครื่องต้องเห็นว่า "ตอนนี้กี่โมง"
 * ด้วยตาตัวเองก่อนกดเปิด/ปิด ไม่ใช่ไปเห็นทีหลังบนกระดาษแล้วค่อยเถียงกันว่าเวลาเพี้ยน
 *
 * เดินวินาทีจริง ตั้ง interval ที่ 1000ms แล้วยิงครั้งแรกทันทีไม่ต้องรอครบวินาที
 * ใช้ d() เพื่อตรึงเป็นเวลาไทยเสมอ ไม่ขึ้นกับ timezone ของเครื่องที่เปิดเว็บ
 */

import { useEffect, useState } from 'react';

import { d } from '../lib/time';

export function LiveClock({
  size = 15,
  color = '#8C837D',
  showDate = true,
}: {
  size?: number;
  color?: string;
  showDate?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span
      style={{ fontSize: size, color, fontVariantNumeric: 'tabular-nums' }}
      // aria-live ปิดไว้ — ตัวอ่านหน้าจอไม่ควรพูดทุกวินาที
      aria-hidden
    >
      {showDate ? `${d(now).format('DD/MM/YYYY')} ` : ''}
      {d(now).format('HH:mm:ss')} น.
    </span>
  );
}
