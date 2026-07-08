/**
 * Payment types shared by the checkout UI.
 *
 * Verification is MANUAL by design (owner decision 2026-07-08): the customer
 * uploads a PromptPay transfer slip (`attach_payment_slip` RPC → payment_status
 * `slip_uploaded`), the shop eyeballs it in the admin Payments page and
 * approves/rejects (`approve_slip` / `reject_slip`), and the order screen
 * follows along via Realtime. There is no auto-verify step in the app — a slip
 * API (EasySlip/SlipOK) or gateway could slot into the admin side later without
 * touching this app.
 */

export type PaymentMethod = 'promptpay' | 'cod';
