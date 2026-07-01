-- 0029_split_payment.sql
-- P3 split payment: a sale can be tendered across multiple methods (cash +
-- PromptPay). Additive + backward-compatible — create_pos_sale keeps its single-
-- tender path when p_payments is null; when given, it records each tender in
-- pos_sale_payments and flags is_split. Split tenders are cash/promptpay only
-- (store-credit stays single-tender to keep the wallet math simple).

alter table public.pos_sales add column if not exists is_split boolean not null default false;

create table if not exists public.pos_sale_payments (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.pos_sales(id) on delete cascade,
  method     public.pos_pay_method_t not null,
  amount     int not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists pos_sale_payments_sale_ix on public.pos_sale_payments (sale_id);
alter table public.pos_sale_payments enable row level security;
create policy pos_sale_payments_read on public.pos_sale_payments for select
  using (exists (select 1 from public.pos_sales s where s.id = sale_id and public.is_admin_of(s.shop_id)));
grant select on public.pos_sale_payments to authenticated;
grant all on public.pos_sale_payments to service_role;

drop function if exists public.create_pos_sale(uuid, jsonb, public.pos_pay_method_t, int, int, uuid, text, text, boolean);
create or replace function public.create_pos_sale(
  p_client_op_id uuid,
  p_items jsonb,
  p_payment_method public.pos_pay_method_t,
  p_cash_tendered int default null,
  p_discount int default 0,
  p_customer_user_id uuid default null,
  p_customer_name text default null,
  p_customer_tax_id text default null,
  p_tax_invoice boolean default false,
  p_payments jsonb default null                     -- [{method, amount}] for split tender
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_cashier uuid := auth.uid();
  v_ex public.pos_sales;
  v_subtotal int := 0; v_total int; v_vat int := 0; v_net int;
  v_reg boolean; v_rate numeric; v_incl boolean;
  v_saleno bigint; v_taxno bigint := null;
  v_sale uuid; v_change int := 0; v_bal int;
  v_split boolean := false; v_paysum int; v_method public.pos_pay_method_t := p_payment_method;
  rec record;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select * into v_ex from public.pos_sales where client_op_id = p_client_op_id;
  if v_ex.id is not null then
    return jsonb_build_object('id', v_ex.id, 'sale_number', v_ex.sale_number,
      'tax_invoice_no', v_ex.tax_invoice_no, 'total', v_ex.total, 'vat_amount', v_ex.vat_amount,
      'change', v_ex.change, 'replay', true);
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_SALE' using errcode = 'P0001';
  end if;

  create temp table _lines (variant_id uuid, product_name text, size text,
    unit_price int, unit_cost int, qty int, line_discount int, line_total int) on commit drop;
  for rec in
    select (i->>'variant_id')::uuid vid, (i->>'qty')::int qty, coalesce((i->>'line_discount')::int, 0) ld
    from jsonb_array_elements(p_items) i order by (i->>'variant_id')::uuid
  loop
    declare v_price int; v_cost int; v_stock int; v_name text; v_size text;
    begin
      select v.price, v.cost_price, v.stock_qty, p.name, v.size into v_price, v_cost, v_stock, v_name, v_size
      from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = rec.vid and p.shop_id = v_shop for update of v;
      if v_price is null then raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0002'; end if;
      if v_stock < rec.qty then raise exception 'OUT_OF_STOCK' using errcode = 'P0001', detail = v_name; end if;
      insert into _lines values (rec.vid, v_name, v_size, v_price, v_cost, rec.qty, rec.ld, v_price * rec.qty - rec.ld);
      v_subtotal := v_subtotal + (v_price * rec.qty - rec.ld);
    end;
  end loop;

  v_total := v_subtotal - greatest(coalesce(p_discount, 0), 0);
  if v_total < 0 then raise exception 'VALIDATION' using errcode = 'P0001', detail = 'discount exceeds subtotal'; end if;

  select vat_registered, vat_rate, price_includes_vat into v_reg, v_rate, v_incl
  from public.shop_settings where shop_id = v_shop;
  if coalesce(v_reg, false) and coalesce(v_incl, true) then
    v_vat := round(v_total * v_rate / (100 + v_rate));
  end if;
  v_net := v_total - v_vat;

  -- payment
  if p_payments is not null and jsonb_array_length(p_payments) >= 1 then
    -- split / multi-tender (cash + promptpay only)
    if exists (select 1 from jsonb_array_elements(p_payments) e
               where (e->>'method') not in ('cash', 'promptpay')) then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'split allows cash/promptpay only';
    end if;
    select coalesce(sum((e->>'amount')::int), 0) into v_paysum from jsonb_array_elements(p_payments) e;
    if v_paysum <> v_total then raise exception 'VALIDATION' using errcode = 'P0001', detail = 'payments must sum to total'; end if;
    v_split := jsonb_array_length(p_payments) > 1;
    select (e->>'method')::public.pos_pay_method_t into v_method from jsonb_array_elements(p_payments) e limit 1;
  elsif p_payment_method = 'cash'::public.pos_pay_method_t then
    if coalesce(p_cash_tendered, 0) < v_total then raise exception 'INSUFFICIENT_CASH' using errcode = 'P0001'; end if;
    v_change := p_cash_tendered - v_total;
  elsif p_payment_method = 'store_credit'::public.pos_pay_method_t then
    if p_customer_user_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode = 'P0001'; end if;
    select coalesce(sum(delta), 0) into v_bal from public.store_credit_ledger
     where user_id = p_customer_user_id and shop_id = v_shop;
    if v_bal < v_total then raise exception 'INSUFFICIENT_CREDIT' using errcode = 'P0001'; end if;
  end if;

  insert into public.pos_counters (shop_id, kind, value) values (v_shop, 'sale', 1)
  on conflict (shop_id, kind) do update set value = public.pos_counters.value + 1 returning value into v_saleno;
  if p_tax_invoice then
    insert into public.pos_counters (shop_id, kind, value) values (v_shop, 'tax_invoice', 1)
    on conflict (shop_id, kind) do update set value = public.pos_counters.value + 1 returning value into v_taxno;
  end if;

  insert into public.pos_sales (shop_id, cashier_user_id, shift_id, sale_number, tax_invoice_no,
    subtotal, discount, total, vat_amount, net_amount, payment_method, cash_tendered, change,
    customer_name, customer_tax_id, customer_user_id, client_op_id, is_split)
  values (v_shop, v_cashier, null, 'POS' || to_char(v_saleno, 'FM000000'),
    case when p_tax_invoice then to_char(v_taxno, 'FM00000000') else null end,
    v_subtotal, greatest(coalesce(p_discount, 0), 0), v_total, v_vat, v_net, v_method,
    case when not v_split and p_payment_method = 'cash'::public.pos_pay_method_t then p_cash_tendered end,
    case when not v_split and p_payment_method = 'cash'::public.pos_pay_method_t then v_change end,
    p_customer_name, p_customer_tax_id, p_customer_user_id, p_client_op_id, v_split)
  returning id into v_sale;

  insert into public.pos_sale_items (sale_id, variant_id, product_name, size, unit_price, unit_cost, qty, line_discount)
  select v_sale, variant_id, product_name, size, unit_price, unit_cost, qty, line_discount from _lines;

  -- record tender(s)
  if p_payments is not null then
    insert into public.pos_sale_payments (sale_id, method, amount)
    select v_sale, (e->>'method')::public.pos_pay_method_t, (e->>'amount')::int
    from jsonb_array_elements(p_payments) e where (e->>'amount')::int > 0;
  else
    insert into public.pos_sale_payments (sale_id, method, amount) values (v_sale, v_method, v_total);
  end if;

  update public.product_variants v set stock_qty = stock_qty - l.qty from _lines l where v.id = l.variant_id;
  insert into public.stock_movements (variant_id, delta_stock, reason, actor_user_id)
  select variant_id, -qty, 'pos_sale'::public.stock_reason_t, v_cashier from _lines;

  if not v_split and p_payment_method = 'store_credit'::public.pos_pay_method_t then
    insert into public.store_credit_ledger (shop_id, user_id, delta, reason, sale_id)
    values (v_shop, p_customer_user_id, -v_total, 'pos_sale', v_sale);
  end if;

  return jsonb_build_object('id', v_sale, 'sale_number', 'POS' || to_char(v_saleno, 'FM000000'),
    'tax_invoice_no', case when p_tax_invoice then to_char(v_taxno, 'FM00000000') else null end,
    'subtotal', v_subtotal, 'discount', greatest(coalesce(p_discount, 0), 0), 'total', v_total,
    'vat_amount', v_vat, 'net_amount', v_net, 'change', v_change, 'replay', false, 'is_split', v_split);
end $$;

grant execute on function public.create_pos_sale(uuid, jsonb, public.pos_pay_method_t, int, int, uuid, text, text, boolean, jsonb) to authenticated;
