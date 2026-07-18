-- 0066_stock_ledger_reasons.sql
-- อู้ฟู่ (Oofoo) — new stock_movements ledger reasons for the "sell by physical
-- stock" model (0067). Kept in its OWN migration because a value added to an
-- enum by ALTER TYPE ... ADD VALUE cannot be USED in the same transaction that
-- adds it; 0067 (a separate transaction) uses these.
--
-- Model: stock_qty becomes the single source of truth and reserved_qty is
-- forced to 0. Online/COD placement decrements stock immediately; a
-- non-terminal cancel / rejected slip / expiry restocks it once. These reasons
-- name those movements.

alter type public.stock_reason_t add value if not exists 'online_place';
alter type public.stock_reason_t add value if not exists 'online_reject_restock';
alter type public.stock_reason_t add value if not exists 'online_cancel_restock';
alter type public.stock_reason_t add value if not exists 'online_expiry_restock';
