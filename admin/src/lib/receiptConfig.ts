/**
 * Receipt / device configuration — stored per-machine in localStorage (the
 * printer + its paper are physical to each till, so machine-local is the right
 * scope and avoids a DB migration/RLS write-path). The Receipt component reads
 * this; the Settings page edits it.
 */
import { useEffect, useState } from 'react';

export type PaperWidth = 48 | 58;

export type ReceiptConfig = {
  /** Thermal roll width in mm (drives page size + receipt width). */
  paperWidth: PaperWidth;
  /** Phone shown under the shop name. */
  phone: string;
  /** Address line(s) shown under the shop name. */
  address: string;
  /** Small print at the very bottom, e.g. "สินค้าซื้อแล้วไม่รับคืน". */
  footerNote: string;
  /** Print a Code128 barcode of the sale number (scan to look up / return). */
  showBarcode: boolean;
  /** Cashier label printed on the bill, e.g. "แคชเชียร์ 01". */
  cashierName: string;
  /**
   * ความกว้างเนื้อบิลจริง (มม.) — null = ใช้ค่ามาตรฐานของขนาดกระดาษนั้น
   *
   * ★ ทำไมต้องปรับได้ ★ พื้นที่พิมพ์จริงของเครื่องแคบกว่าความกว้างม้วน และแคบไม่เท่ากัน
   * ในแต่ละรุ่น กว้างเกินไปตัวหนังสือฝั่งขวาโดนตัด (เจ้าของเจอ 5 ก.ย. 2026) แคบเกินไป
   * ก็เสียกระดาษและชื่อสินค้าตกบรรทัดถี่ — เดาจากส่วนกลางให้ถูกทุกเครื่องไม่ได้
   * ให้ปรับเองแล้วกดพิมพ์ทดสอบจบในสองนาที ดีกว่าไล่แก้โค้ดทีละรอบ
   */
  contentWidthMm: number | null;
};

const KEY = 'ofu.receiptConfig';
const EVT = 'ofu-receipt-config';

export const DEFAULT_CONFIG: ReceiptConfig = {
  paperWidth: 48,
  phone: '',
  address: '',
  footerNote: 'สินค้าซื้อแล้วไม่รับคืน',
  showBarcode: true,
  cashierName: '',
  contentWidthMm: null,
};

export function getReceiptConfig(): ReceiptConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ReceiptConfig>) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setReceiptConfig(patch: Partial<ReceiptConfig>): ReceiptConfig {
  const merged = { ...getReceiptConfig(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event(EVT));
  return merged;
}

/** ช่วงที่ยอมให้ปรับได้ — กันตั้งจนบิลกลายเป็นเส้นหรือกว้างเกินม้วนไปเลย */
export const MIN_CONTENT_MM = 32;

/** Content width (mm) for the receipt body — a hair narrower than the roll so
 *  nothing clips at the printer's edge margins.
 *
 *  ค่ามาตรฐานกลับมาที่ 40mm สำหรับม้วน 48mm — ค่านี้พิมพ์ผ่านมาตลอดไม่เคยโดนตัด
 *  ส่วน 45mm ที่ลองเมื่อ 5 ก.ย. 2026 ล้นออกขอบขวา เครื่องนี้พื้นที่พิมพ์แคบกว่าที่คิด
 *  ใครมีเครื่องที่พิมพ์ได้กว้างกว่านี้ ปรับเพิ่มเองได้ที่หน้าตั้งค่า */
export const contentMm = (w: PaperWidth, override?: number | null) => {
  const base = w === 58 ? 48 : 40;
  if (override == null) return base;
  // กว้างกว่าหน้ากระดาษไม่ได้ — เกินไปเท่าไหร่ก็โดนตัดเท่านั้น ไม่ได้อะไรเพิ่ม
  return Math.min(Math.max(override, MIN_CONTENT_MM), w);
};

/** Live config that re-renders on change (this tab or another). */
export function useReceiptConfig(): [ReceiptConfig, (p: Partial<ReceiptConfig>) => void] {
  const [cfg, setCfg] = useState<ReceiptConfig>(getReceiptConfig);
  useEffect(() => {
    const sync = () => setCfg(getReceiptConfig());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return [cfg, setReceiptConfig];
}
