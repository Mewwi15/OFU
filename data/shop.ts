/**
 * Shop / merchant profile types + helpers — single-shop v1.
 *
 * The live values are loaded from the backend (`shops` + `shop_hours`) into
 * `store/shop.ts`; `DEFAULT_SHOP` is the fallback used until that resolves.
 * The PromptPay `target` is what the QR encodes (phone / citizen-id / e-wallet).
 */

export type ShopHours = { open: string; close: string };

export type ShopInfo = {
  name: string;
  promptPay: {
    /** PromptPay target the QR encodes — phone (10) / citizen-id (13) / e-wallet (15). */
    target: string;
    /** Account-holder name shown under the QR. */
    displayName: string;
    /** Receiving bank, for the manual-transfer fallback. */
    bankName: string;
  };
  /** Today's operating window, "HH:MM" 24h. */
  hours: ShopHours;
};

export const DEFAULT_SHOP: ShopInfo = {
  name: 'ร้าน อู้ฟู่',
  promptPay: {
    target: '0812345678',
    displayName: 'ร้าน อู้ฟู่ (พร้อมเพย์)',
    bankName: 'พร้อมเพย์ · เบอร์โทร',
  },
  hours: { open: '08:00', close: '22:00' },
};

/** Operating-hours label shown to the customer. */
export function shopHoursLabel(hours: ShopHours): string {
  return `ทุกวัน ${hours.open}–${hours.close} น.`;
}

/** "HH:MM" → minutes since midnight. */
function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** Whether the shop is open at `now` (handles windows that cross midnight). */
export function isShopOpen(hours: ShopHours, now: Date = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  return open <= close ? mins >= open && mins < close : mins >= open || mins < close;
}
