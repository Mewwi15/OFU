-- 0028_reorder_banners.sql — drag-to-reorder banners (app home hero).
create or replace function public.reorder_banners(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.banners b set display_order = pos.ord
  from (select id, (row_number() over ()) - 1 as ord from unnest(p_ids) with ordinality as t(id, ord)) pos
  where b.id = pos.id and b.shop_id = v_shop;
end $$;
grant execute on function public.reorder_banners(uuid[]) to authenticated;
