-- 0017_pos_enums.sql
-- อู้ฟู่ POS (P1) — enum additions. Kept in their own migration so the new enum
-- values are committed before later migrations reference them (Postgres forbids
-- using a freshly-added enum value in the same transaction).

-- Cashier = an admin-role user restricted to POS + their own shift.
alter type public.admin_tier_t add value if not exists 'cashier';

-- Stock ledger reasons for on-site sales / refunds.
alter type public.stock_reason_t add value if not exists 'pos_sale';
alter type public.stock_reason_t add value if not exists 'pos_refund';

-- On-site payment methods (distinct from the online promptpay_slip/cod flow).
do $$ begin
  create type public.pos_pay_method_t as enum ('cash', 'promptpay', 'store_credit');
exception when duplicate_object then null; end $$;

-- On-site sale lifecycle.
do $$ begin
  create type public.pos_sale_status_t as enum ('completed', 'voided', 'refunded');
exception when duplicate_object then null; end $$;
