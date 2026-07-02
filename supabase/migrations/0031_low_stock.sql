-- 0031_low_stock.sql — low/out-of-stock variants for the admin dashboard.
create or replace function public.low_stock_items()
returns table (product_name text, size text, stock_qty int, threshold int)
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return query
    select p.name, v.size, v.stock_qty, v.low_stock_threshold
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where p.shop_id = v_shop and p.archived_at is null
      and v.stock_qty <= v.low_stock_threshold
    order by v.stock_qty asc, p.name limit 50;
end $$;
grant execute on function public.low_stock_items() to authenticated;
