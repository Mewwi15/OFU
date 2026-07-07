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

/** Content width (mm) for the receipt body — a hair narrower than the roll so
 *  nothing clips at the printer's edge margins. */
export const contentMm = (w: PaperWidth) => (w === 58 ? 54 : 46);

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
