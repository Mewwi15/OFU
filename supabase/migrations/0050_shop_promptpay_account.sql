-- 0050_shop_promptpay_account.sql
-- อู้ฟู่ (Oofoo) — real receiving account for checkout QR (owner, 2026-07-12).
-- Decoded from the shop's K+ Thai QR: PromptPay e-Wallet/account-reference
-- proxy (Tag 29 subtag 03, 15 digits). The app generates a dynamic QR with
-- the exact order amount against this id (lib/promptpay.ts); verified the
-- generated payload carries the same Tag 29 as the bank's own QR.
-- Local dev is unaffected: this runs before seed.sql inserts the demo shop,
-- so local keeps the demo account.

update public.shops set
  promptpay_id   = '004999025306712',
  promptpay_name = 'นาย ธวัช ศรีษเกตุ';
