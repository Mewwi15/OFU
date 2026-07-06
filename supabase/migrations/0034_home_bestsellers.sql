-- 0034_home_bestsellers.sql
-- Real "ขายดี" ranking for the app home: top-selling published products by units
-- sold across BOTH channels (POS + online orders), returned as an ordered id
-- array. SECURITY DEFINER so the anon/customer app gets the ranking without
-- being able to read the underlying sale rows.

create or replace function public.home_bestseller_ids(p_limit int default 12)
returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(product_id order by qty desc), '{}')
  from (
    select v.product_id, sum(x.qty)::numeric as qty
    from (
      select variant_id, qty from public.pos_sale_items
      union all
      select variant_id, qty from public.order_items
    ) x
    join public.product_variants v on v.id = x.variant_id
    join public.products p on p.id = v.product_id
    where p.publish_state = 'published' and p.archived_at is null
    group by v.product_id
    order by qty desc
    limit p_limit
  ) t;
$$;

grant execute on function public.home_bestseller_ids(int) to anon, authenticated;
