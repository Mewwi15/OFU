/**
 * Payment verification — FRONTEND STUB.
 *
 * v1 builds the checkout UI first; the *real* money check lands in the backend
 * phase. The two API routes we evaluated both fit behind this one function:
 *   - Slip Verification API (EasySlip / SlipOK): upload `slipUri` to our server,
 *     which decodes the slip's embedded QR and confirms the transfer with the
 *     bank (amount, receiving account, datetime, anti-replay on the ref).
 *   - Payment gateway (Omise/Opn): the gateway's webhook flips a charge to paid;
 *     this call would then just poll/confirm that charge's status.
 *
 * Swap the body for the real `fetch(...)` when the backend exists — the screen
 * contract (idle -> verifying -> success | failed) does not change.
 */

export type PaymentMethod = 'promptpay' | 'cod';

export type PaymentResult = {
  ok: boolean;
  /** Bank/gateway transaction reference once verified. */
  ref?: string;
  /** Human-readable reason when `ok` is false. */
  reason?: string;
};

export type VerifyInput = {
  amount: number;
  method: PaymentMethod;
  /** Local uri of the uploaded transfer slip (PromptPay only). */
  slipUri?: string | null;
};

/**
 * Verify that payment was received. STUB: resolves ok after a short delay so the
 * UI can exercise its verifying/success states. COD needs no verification and
 * resolves immediately.
 */
export async function verifyPayment(input: VerifyInput): Promise<PaymentResult> {
  if (input.method === 'cod') return { ok: true, ref: 'COD' };

  // TODO(backend): POST { slipUri, amount } to the Slip Verification API (or
  // confirm the gateway charge) and return the real verdict + transaction ref.
  await new Promise((resolve) => setTimeout(resolve, 1600));
  return { ok: true, ref: 'MOCK-VERIFIED' };
}
