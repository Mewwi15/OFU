-- 0018_pos_schema.sql
-- อู้ฟู่ POS (P1) — tables + columns for on-site sales, shifts, store credit,
-- VAT settings, and barcodes. On-site sales share the same product stock as
-- online orders (create_pos_sale in 0019 decrements product_variants.stock_qty).

-- ── VAT / receipt settings (single shop; prices are VAT-inclusive) ────────────
alter table public.shop_settings
  add column if not exists vat_registered     boolean not null default false,
  add column if not exists vat_rate           numeric(4,2) not null default 7.00,
  add column if not exists tax_id             text,
  add column if not exists branch_code        text not null default '00000',
  add column if not exists price_includes_vat boolean not null default true,
  add column if not exists receipt_header     text,
  add column if not exists receipt_footer     text;

-- ── Barcode on the sellable unit ─────────────────────────────────────────────
alter table public.product_variants
  add column if not exists barcode text;
create unique index if not exists product_variants_barcode_ux
  on public.product_variants (barcode) where barcode is not null;

-- ── Cash shifts ──────────────────────────────────────────────────────────────
create table if not exists public.pos_shifts (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id),
  cashier_user_id uuid not null references public.app_users(id),
  opened_at       timestamptz not null default now(),
  opening_float   int not null default 0 check (opening_float >= 0),
  closed_at       timestamptz,
  counted_cash    int,          -- cash counted at close
  expected_cash   int,          -- opening_float + cash sales (computed at close)
  over_short      int,          -- counted_cash - expected_cash
  note            text
);
create index if not exists pos_shifts_open_ix
  on public.pos_shifts (shop_id, cashier_user_id) where closed_at is null;

-- ── On-site sales ────────────────────────────────────────────────────────────
create table if not exists public.pos_sales (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops(id),
  cashier_user_id   uuid not null references public.app_users(id),
  shift_id          uuid references public.pos_shifts(id),
  sale_number       text not null,          -- per-shop running receipt no
  tax_invoice_no    text,                   -- per-shop gapless VAT invoice no
  subtotal          int not null,           -- sum of line totals (VAT-inclusive)
  discount          int not null default 0,
  total             int not null,           -- subtotal - discount (what's paid)
  vat_amount        int not null default 0, -- VAT backed out of `total`
  net_amount        int not null default 0, -- total - vat_amount
  payment_method    public.pos_pay_method_t not null,
  cash_tendered     int,
  change            int,
  customer_name     text,                   -- for a full tax invoice
  customer_tax_id   text,
  customer_user_id  uuid references public.app_users(id), -- store-credit wallet
  status            public.pos_sale_status_t not null default 'completed',
  client_op_id      uuid unique,            -- idempotency for offline sync
  created_at        timestamptz not null default now()
);
create index if not exists pos_sales_shop_ix on public.pos_sales (shop_id, created_at desc);
create index if not exists pos_sales_shift_ix on public.pos_sales (shift_id);

create table if not exists public.pos_sale_items (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.pos_sales(id) on delete cascade,
  variant_id    uuid not null references public.product_variants(id),
  product_name  text not null,     -- snapshot
  size          text,
  unit_price    int not null,
  qty           int not null check (qty > 0),
  line_discount int not null default 0,
  line_total    int generated always as (unit_price * qty - line_discount) stored
);
create index if not exists pos_sale_items_sale_ix on public.pos_sale_items (sale_id);

-- ── Store-credit wallet (ledger; balance = sum(delta)) ───────────────────────
create table if not exists public.store_credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id),
  user_id    uuid not null references public.app_users(id),
  delta      int not null,        -- +top up / -spend
  reason     text not null,
  sale_id    uuid references public.pos_sales(id),
  created_at timestamptz not null default now()
);
create index if not exists store_credit_user_ix on public.store_credit_ledger (user_id, created_at desc);

-- ── Per-shop gapless counters (receipt / tax-invoice numbers) ────────────────
create table if not exists public.pos_counters (
  shop_id uuid not null references public.shops(id),
  kind    text not null,          -- 'sale' | 'tax_invoice'
  value   bigint not null default 0,
  primary key (shop_id, kind)
);

-- ── RLS: shop admins (incl. cashiers) read their shop's POS data ─────────────
alter table public.pos_shifts          enable row level security;
alter table public.pos_sales           enable row level security;
alter table public.pos_sale_items      enable row level security;
alter table public.store_credit_ledger enable row level security;
alter table public.pos_counters        enable row level security;

create policy pos_shifts_read on public.pos_shifts for select using (public.is_admin_of(shop_id));
create policy pos_sales_read on public.pos_sales for select using (public.is_admin_of(shop_id));
create policy pos_sale_items_read on public.pos_sale_items for select
  using (exists (select 1 from public.pos_sales s where s.id = sale_id and public.is_admin_of(s.shop_id)));
create policy store_credit_read on public.store_credit_ledger for select using (public.is_admin_of(shop_id));
create policy pos_counters_read on public.pos_counters for select using (public.is_admin_of(shop_id));

grant select on public.pos_shifts, public.pos_sales, public.pos_sale_items,
  public.store_credit_ledger, public.pos_counters to authenticated;
grant all on public.pos_shifts, public.pos_sales, public.pos_sale_items,
  public.store_credit_ledger, public.pos_counters to service_role;
