/**
 * Shop / merchant profile — single-shop v1.
 *
 * Holds the receiving-account details the customer pays INTO. The PromptPay
 * `target` is what the QR encodes (a phone, citizen-id, tax-id or e-wallet id);
 * `displayName` + `accountNo` are shown on the QR card and the manual-transfer
 * fallback.
 *
 * NOTE: these are placeholder demo values. Before going live, replace them with
 * the real merchant PromptPay id / bank account (and move them server-side so a
 * tampered build can't redirect payments).
 */
export const SHOP = {
  name: 'ร้าน อู้ฟู่',
  promptPay: {
    /** PromptPay target the QR encodes — phone (10) / citizen-id (13) / e-wallet (15). */
    target: '0812345678',
    /** Account-holder name shown under the QR. */
    displayName: 'ร้าน อู้ฟู่ (พร้อมเพย์)',
    /** Receiving bank, for the manual-transfer fallback. */
    bankName: 'พร้อมเพย์ · เบอร์โทร',
  },
  /** Daily operating hours, "HH:MM" 24h. Orders are blocked outside this window. */
  hours: {
    open: '08:00',
    close: '22:00',
  },
} as const;

/** Operating-hours label shown to the customer. */
export const SHOP_HOURS_LABEL = `ทุกวัน ${SHOP.hours.open}–${SHOP.hours.close} น.`;

/** "HH:MM" → minutes since midnight. */
function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** Whether the shop is open at `now` (handles windows that cross midnight). */
export function isShopOpen(now: Date = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(SHOP.hours.open);
  const close = toMinutes(SHOP.hours.close);
  return open <= close ? mins >= open && mins < close : mins >= open || mins < close;
}
