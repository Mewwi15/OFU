-- 0033_variant_archive.sql
-- Owner dropped the size/variant concept: 1 product = 1 price/stock. We keep the
-- product_variants table (1 row per product) but need to retire the extra size rows
-- WITHOUT deleting them (they're referenced by past bills/orders). Soft-archive them
-- so every read can hide them while history stays intact.

alter table public.product_variants
  add column if not exists archived_at timestamptz;

-- Collapse any product that still has multiple sizes: keep the most-referenced
-- variant (so the live row carries the sales history), clear its size label, and
-- archive the rest. Idempotent — only touches products with >1 live variant.
do $$
declare r record; v_keep uuid;
begin
  for r in
    select product_id from public.product_variants
    where archived_at is null
    group by product_id having count(*) > 1
  loop
    select v.id into v_keep
    from public.product_variants v
    where v.product_id = r.product_id and v.archived_at is null
    order by (
      (select count(*) from public.pos_sale_items s where s.variant_id = v.id) +
      (select count(*) from public.order_items o where o.variant_id = v.id) +
      (select count(*) from public.cart_items c where c.variant_id = v.id)
    ) desc, v.id asc
    limit 1;

    update public.product_variants
    set archived_at = now()
    where product_id = r.product_id and id <> v_keep and archived_at is null;

    update public.product_variants set size = null where id = v_keep;
  end loop;
end $$;
