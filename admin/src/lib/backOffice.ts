/**
 * สถานะปลดล็อกหลังร้าน — เจ้าของคุมเอง ไม่มีตัวจับเวลา
 *
 * ตอนแรกผมตั้งให้หมดอายุเอง 30 นาที เจ้าของสั่งแก้ 30 ส.ค. 2026:
 * "ขอเป็นจะเปิดก็ใส่ ปิดตอนไหนก็ได้" — ปลดแล้วปลดยาว จะปิดเมื่อไหร่กดปิดเอง
 * ตัวจับเวลาถูกเอาออกทั้งหมด เหลือปุ่มล็อกบนแถบบนที่กดได้ตลอด
 *
 * ยังเก็บใน sessionStorage ไม่ใช่ localStorage — ผูกกับแท็บ ปิดเบราว์เซอร์แล้ว
 * ล็อกเอง ซึ่งในทางปฏิบัติคือ "ล็อกตอนปิดร้าน" เพราะเครื่อง POS เปิดค้างทั้งวัน
 * อยู่แล้ว ไม่ได้ขัดกับที่สั่ง แค่มีตาข่ายรับไว้ตอนลืมกดปิด
 */

const KEY = 'ofu.backOffice.unlocked';
const EVT = 'ofu-back-office';

export function isBackOfficeUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockBackOffice() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* โหมดส่วนตัว/ปิด storage — ก็แค่ต้องใส่รหัสใหม่ทุกครั้ง ไม่ถึงกับพัง */
  }
  window.dispatchEvent(new Event(EVT));
}

export function lockBackOffice() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* เหมือนข้างบน */
  }
  window.dispatchEvent(new Event(EVT));
}

/** ให้ทั้งด่านและปุ่มล็อกบนแถบบนเห็นสถานะเดียวกันโดยไม่ต้องส่ง prop ข้ามครึ่งแอป */
export function onBackOfficeChange(fn: () => void): () => void {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

/** เส้นทางที่นับเป็นหลังร้าน — ต้องตรงกับกลุ่ม "หลังร้าน" ใน Sidebar.tsx */
const BACK_OFFICE_PATHS = [
  '/stock', '/receive', '/products', '/categories', '/promotions', '/banners',
  '/broadcast', '/reports', '/store-credit', '/audit-log', '/deploys', '/settings',
  '/scan-lab',
];

export const isBackOfficePath = (pathname: string) =>
  BACK_OFFICE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
