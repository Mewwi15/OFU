/**
 * PromptPay QR payload — thin wrapper over `promptpay-qr` (the same library
 * the customer app uses, lib/promptpay.ts), replacing a hand-rolled EMVCo
 * encoder that only ever emitted proxy type 01 (mobile) or 02 (13-digit
 * national/tax id). This shop's real PromptPay account is a 15-digit
 * e-Wallet proxy (type 03, see 0050_shop_promptpay_account.sql) — the old
 * encoder misclassified it as a type-02 id, producing a QR that scanned as
 * "invalid" in banking apps. `promptpay-qr` handles all three proxy types
 * (10-digit mobile, 13-digit citizen/tax id, 15-digit e-Wallet) correctly.
 */
import generatePayload from 'promptpay-qr';

export function promptpayPayload(target: string, amount?: number): string {
  return generatePayload(target, amount != null ? { amount } : {});
}
