-- 0056_set_stock_qty.sql
-- อู้ฟู่ (Oofoo) — absolute stock set for the stock-count / import flow
-- (owner 2026-07-13: full stock workspace). Unlike adjust_stock (+/- delta),
-- this sets the counted quantity and ledgers the computed difference, so a
-- CSV import of a physical count is one call per row.

create or replace function public.set_stock_qty(
  p_variant_id uuid,
  p_qty int,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_cur int; v_delta int;
begin
  if p_qty is null or p_qty < 0 or p_qty > 100000 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'qty 0..100000';
  end if;

  select pv.stock_qty into v_cur
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = p_variant_id and p.shop_id = v_shop
  for update;
  if v_cur is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant';
  end if;

  v_delta := p_qty - v_cur;
  if v_delta = 0 then
    return jsonb_build_object('variant_id', p_variant_id, 'stock_qty', v_cur, 'delta', 0);
  end if;

  update public.product_variants set stock_qty = p_qty where id = p_variant_id;

  insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
  values (p_variant_id, v_delta, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());

  perform public.write_audit(v_shop, 'set_stock_qty', 'product_variants', p_variant_id::text,
    'ตั้งเป็น ' || p_qty || ' (' || (case when v_delta > 0 then '+' else '' end) || v_delta || ')'
    || coalesce(' · ' || nullif(btrim(p_note), ''), ''));

  return jsonb_build_object('variant_id', p_variant_id, 'stock_qty', p_qty, 'delta', v_delta);
end $$;

revoke execute on function public.set_stock_qty(uuid, int, text) from public;
grant execute on function public.set_stock_qty(uuid, int, text) to authenticated;
