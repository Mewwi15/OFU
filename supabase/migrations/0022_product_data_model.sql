-- 0022_product_data_model.sql
-- Richer, analytics-friendly product model (owner: "ต้องมีบาร์โค้ด + รหัส (SKU),
-- ออกแบบเก็บข้อมูลดีๆ ใช้หลักการ data mining").
--
-- Design notes:
--  * The sellable unit is product_variants → SKU, barcode, cost_price, unit live
--    there (one product may have several sellable sizes).
--  * cost_price enables gross-margin analysis; 0023 snapshots it per sale line so
--    historical margin stays accurate even when cost changes later.
--  * brand lives on products (a mining dimension: sales/inventory by brand).

-- ── columns ──────────────────────────────────────────────────────────────────
alter table public.products
  add column if not exists brand text;

alter table public.product_variants
  add column if not exists sku        text,
  add column if not exists cost_price int,               -- ต้นทุน (VAT-excl)
  add column if not exists unit       text not null default 'ชิ้น';

create unique index if not exists product_variants_sku_ux
  on public.product_variants (sku) where sku is not null;

-- ── upsert_product (+ brand) ─────────────────────────────────────────────────
drop function if exists public.upsert_product(uuid, uuid, text, text, text, boolean, boolean, int);
create function public.upsert_product(
  p_id uuid default null,
  p_category_id uuid default null,
  p_name text default null,
  p_subtitle text default null,
  p_description text default null,
  p_orderable_delivery boolean default true,
  p_orderable_online boolean default true,
  p_expected_row_version int default null,
  p_brand text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_rv int;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name required';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id and shop_id = v_shop
  ) then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'category not in shop';
  end if;

  if p_id is null then
    insert into public.products (shop_id, category_id, name, subtitle, description, brand, orderable_delivery, orderable_online)
    values (v_shop, p_category_id, p_name, p_subtitle, p_description, p_brand,
            coalesce(p_orderable_delivery, true), coalesce(p_orderable_online, true))
    returning id into v_id;
  else
    select row_version into v_rv from public.products where id = p_id and shop_id = v_shop;
    if v_rv is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if p_expected_row_version is not null and p_expected_row_version <> v_rv then
      raise exception 'STALE_WRITE' using errcode = 'P0001';
    end if;
    update public.products set
      category_id = p_category_id, name = p_name, subtitle = p_subtitle, description = p_description,
      brand = p_brand,
      orderable_delivery = coalesce(p_orderable_delivery, orderable_delivery),
      orderable_online = coalesce(p_orderable_online, orderable_online),
      row_version = row_version + 1
    where id = p_id and shop_id = v_shop returning id into v_id;
  end if;
  perform public.write_audit(v_shop, 'upsert_product', 'products', v_id::text, 'product ' || p_name);
  return jsonb_build_object('id', v_id);
end $$;

-- ── upsert_variant (+ sku, barcode, cost_price, unit) ────────────────────────
drop function if exists public.upsert_variant(uuid, uuid, text, int, int, int);
create function public.upsert_variant(
  p_id uuid default null,
  p_product_id uuid default null,
  p_size text default null,
  p_price int default null,
  p_stock_qty int default null,
  p_low_stock_threshold int default null,
  p_sku text default null,
  p_barcode text default null,
  p_cost_price int default null,
  p_unit text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_old_stock int; v_new_stock int;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'price > 0 required';
  end if;
  if p_stock_qty is not null and p_stock_qty < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'stock >= 0';
  end if;
  if p_product_id is null or not exists (
    select 1 from public.products where id = p_product_id and shop_id = v_shop
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'product';
  end if;
  -- unique SKU / barcode across the shop (v1 = single shop)
  if p_sku is not null and exists (
    select 1 from public.product_variants where sku = p_sku and (p_id is null or id <> p_id)
  ) then raise exception 'DUPLICATE_SKU' using errcode = 'P0001'; end if;
  if p_barcode is not null and exists (
    select 1 from public.product_variants where barcode = p_barcode and (p_id is null or id <> p_id)
  ) then raise exception 'DUPLICATE_BARCODE' using errcode = 'P0001'; end if;

  if p_id is null then
    begin
      insert into public.product_variants
        (product_id, size, price, stock_qty, low_stock_threshold, sku, barcode, cost_price, unit)
      values (p_product_id, p_size, p_price, coalesce(p_stock_qty, 0), coalesce(p_low_stock_threshold, 5),
              p_sku, p_barcode, p_cost_price, coalesce(p_unit, 'ชิ้น'))
      returning id, stock_qty into v_id, v_new_stock;
    exception when unique_violation then
      raise exception 'DUPLICATE_VARIANT' using errcode = 'P0001';
    end;
    if v_new_stock > 0 then
      insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (v_id, v_new_stock, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
    end if;
  else
    select pv.stock_qty into v_old_stock
    from public.product_variants pv join public.products p on p.id = pv.product_id
    where pv.id = p_id and p.id = p_product_id and p.shop_id = v_shop;
    if v_old_stock is null then raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant'; end if;
    update public.product_variants set
      size = p_size, price = p_price,
      stock_qty = coalesce(p_stock_qty, stock_qty),
      low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold),
      sku = p_sku, barcode = p_barcode, cost_price = p_cost_price,
      unit = coalesce(p_unit, unit)
    where id = p_id returning id, stock_qty into v_id, v_new_stock;
    if v_new_stock <> v_old_stock then
      insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (v_id, v_new_stock - v_old_stock, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
    end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_variant', 'product_variants', v_id::text, 'variant price=' || p_price);
  return jsonb_build_object('id', v_id);
end $$;

-- ── delete_variant (blocked if it has sales history) ─────────────────────────
create or replace function public.delete_variant(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if not exists (
    select 1 from public.product_variants pv join public.products p on p.id = pv.product_id
    where pv.id = p_id and p.shop_id = v_shop
  ) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  begin
    delete from public.stock_movements where variant_id = p_id;
    delete from public.product_variants where id = p_id;
  exception when foreign_key_violation then
    raise exception 'VARIANT_IN_USE' using errcode = 'P0001';
  end;
end $$;

-- ── delete_category (unassign its products first) ────────────────────────────
create or replace function public.delete_category(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if not exists (select 1 from public.categories where id = p_id and shop_id = v_shop) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.products set category_id = null where category_id = p_id and shop_id = v_shop;
  delete from public.categories where id = p_id and shop_id = v_shop;
  perform public.write_audit(v_shop, 'delete_category', 'categories', p_id::text, null);
end $$;

grant execute on function public.upsert_product(uuid, uuid, text, text, text, boolean, boolean, int, text) to authenticated;
grant execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, int, text) to authenticated;
grant execute on function public.delete_variant(uuid) to authenticated;
grant execute on function public.delete_category(uuid) to authenticated;
