-- 0063_upsert_variant_preserve_stock_on_update.sql
-- Product metadata edits must not replay a stale stock_qty snapshot over live
-- POS/stock movements. Creation still accepts initial stock; updates route
-- stock changes through set_stock_qty/receive_stock so movements are explicit.

create or replace function public.upsert_variant(
  p_id uuid default null,
  p_product_id uuid default null,
  p_size text default null,
  p_price int default null,
  p_stock_qty int default null,
  p_low_stock_threshold int default null,
  p_sku text default null,
  p_barcode text default null,
  p_cost_price numeric default null,
  p_unit text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_new_stock int;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'price > 0 required';
  end if;
  if p_id is null and p_stock_qty is not null and p_stock_qty < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'stock >= 0';
  end if;
  if p_product_id is null or not exists (
    select 1 from public.products where id = p_product_id and shop_id = v_shop
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'product';
  end if;
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
    if not exists (
      select 1
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = p_id and p.id = p_product_id and p.shop_id = v_shop
    ) then raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant'; end if;

    update public.product_variants set
      size = p_size, price = p_price,
      low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold),
      sku = p_sku, barcode = p_barcode, cost_price = p_cost_price,
      unit = coalesce(p_unit, unit)
    where id = p_id returning id into v_id;
  end if;
  perform public.write_audit(v_shop, 'upsert_variant', 'product_variants', v_id::text, 'variant price=' || p_price);
  return jsonb_build_object('id', v_id);
end $$;

revoke execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, numeric, text) from public;
grant execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, numeric, text) to authenticated;
