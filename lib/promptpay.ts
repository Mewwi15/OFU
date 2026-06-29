/**
 * PromptPay payload helper.
 *
 * Thin wrapper over `promptpay-qr` (a pure-JS implementation of the EMVCo
 * Merchant-Presented QR spec) so the rest of the app imports a single typed
 * function and never touches the CommonJS default-export interop directly.
 *
 * `promptPayPayload('0812345678', 154)` -> an EMV string a Thai banking app can
 * scan to prefill a ฿154 transfer.
 */
import generatePayload from 'promptpay-qr';

/**
 * Build the QR string for a PromptPay transfer of `amount` Baht to `target`
 * (phone / citizen-id / tax-id / e-wallet id). A non-positive amount yields an
 * "any amount" QR (the payer types the sum themselves).
 */
export function promptPayPayload(target: string, amount: number): string {
  return amount > 0 ? generatePayload(target, { amount }) : generatePayload(target, {});
}
