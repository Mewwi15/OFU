-- 0061_low_stock_items_fix.sql
-- อู้ฟู่ (Oofoo) — low_stock_items() (0031) disagreed with Stock.tsx's own
-- client-side count in two ways:
--   1. It never excluded archived (retired-size) variants, while Stock.tsx's
--      listProducts() always filters `product_variants.archived_at is null`
--      before computing its low-stock count — a retired variant with stale
--      stock/threshold data could show up here but not there.
--   2. It silently capped at 50 rows with no indication, while Stock.tsx's
--      own count is uncapped — the two only ever matched by coincidence for
--      a shop with 50 or fewer low/out variants.
-- Same signature, safe create-or-replace.

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
    where p.shop_id = v_shop and p.archived_at is null and v.archived_at is null
      and v.stock_qty <= v.low_stock_threshold
    order by v.stock_qty asc, p.name;
end $$;
