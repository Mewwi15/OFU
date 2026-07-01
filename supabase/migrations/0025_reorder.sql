-- 0025_reorder.sql
-- Drag-and-drop ordering for the customer-app layout: persist display_order from
-- an ordered array of ids. Both are shop-scoped and admin-guarded.

create or replace function public.reorder_categories(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.categories c
     set display_order = pos.ord
  from (select id, (row_number() over ()) - 1 as ord
        from unnest(p_ids) with ordinality as t(id, ord)) pos
  where c.id = pos.id and c.shop_id = v_shop;
end $$;

create or replace function public.reorder_featured_sections(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.featured_sections s
     set display_order = pos.ord
  from (select id, (row_number() over ()) - 1 as ord
        from unnest(p_ids) with ordinality as t(id, ord)) pos
  where s.id = pos.id and s.shop_id = v_shop;
end $$;

-- toggle a featured section's publish state (draft <-> published)
create or replace function public.set_featured_publish(p_id uuid, p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.featured_sections
     set publish_state = case when p_published then 'published'::public.publish_state_t else 'draft'::public.publish_state_t end
  where id = p_id and shop_id = v_shop;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

grant execute on function public.reorder_categories(uuid[]) to authenticated;
grant execute on function public.reorder_featured_sections(uuid[]) to authenticated;
grant execute on function public.set_featured_publish(uuid, boolean) to authenticated;
