-- 0032_featured_manage.sql
-- Make "จัดหน้าแอป" fully functional: create/rename featured rows and curate which
-- products appear in each (the customer-app home reads published sections + items).

create or replace function public.upsert_featured_section(
  p_id uuid default null, p_title text default null,
  p_publish_state public.publish_state_t default 'draft'::public.publish_state_t
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_order int;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'title required';
  end if;
  if p_id is null then
    select coalesce(max(display_order), -1) + 1 into v_order from public.featured_sections where shop_id = v_shop;
    insert into public.featured_sections (shop_id, title, display_order, publish_state)
    values (v_shop, btrim(p_title), v_order, coalesce(p_publish_state, 'draft'::public.publish_state_t))
    returning id into v_id;
  else
    update public.featured_sections set title = btrim(p_title), publish_state = coalesce(p_publish_state, publish_state)
    where id = p_id and shop_id = v_shop returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Replace a section's items with the given ordered product ids.
create or replace function public.set_featured_items(p_section_id uuid, p_product_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.featured_sections where id = p_section_id and shop_id = v_shop) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  delete from public.featured_section_items where section_id = p_section_id;
  insert into public.featured_section_items (section_id, product_id, display_order)
  select p_section_id, pid, (ord - 1)
  from unnest(p_product_ids) with ordinality as t(pid, ord)
  where exists (select 1 from public.products p where p.id = pid and p.shop_id = v_shop);
end $$;

create or replace function public.delete_featured_section(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  delete from public.featured_sections where id = p_id and shop_id = v_shop;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

grant execute on function public.upsert_featured_section(uuid, text, public.publish_state_t) to authenticated;
grant execute on function public.set_featured_items(uuid, uuid[]) to authenticated;
grant execute on function public.delete_featured_section(uuid) to authenticated;
