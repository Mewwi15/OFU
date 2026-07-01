-- 0024_product_images_rpc.sql
-- product_images has only a SELECT policy, so admins manage images through these
-- SECURITY DEFINER RPCs (guarded by admin_shop via the parent product's shop).
-- The file itself is uploaded to the public 'product-images' storage bucket by the
-- client; storage_path holds its public URL.

create or replace function public.add_product_image(
  p_product_id uuid, p_storage_path text, p_is_primary boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_order int; v_count int;
begin
  if not exists (select 1 from public.products where id = p_product_id and shop_id = v_shop) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  select count(*), coalesce(max(display_order), -1) + 1
    into v_count, v_order from public.product_images where product_id = p_product_id;
  -- first image is always primary
  if v_count = 0 then p_is_primary := true; end if;
  if p_is_primary then
    update public.product_images set is_primary = false where product_id = p_product_id;
  end if;
  insert into public.product_images (product_id, storage_path, is_primary, display_order)
  values (p_product_id, p_storage_path, coalesce(p_is_primary, false), v_order)
  returning id into v_id;
  perform public.write_audit(v_shop, 'add_product_image', 'product_images', v_id::text, null);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.set_primary_image(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_product uuid;
begin
  select pi.product_id into v_product
  from public.product_images pi join public.products p on p.id = pi.product_id
  where pi.id = p_image_id and p.shop_id = v_shop;
  if v_product is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  update public.product_images set is_primary = (id = p_image_id) where product_id = v_product;
end $$;

create or replace function public.delete_product_image(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_product uuid; v_was_primary boolean;
begin
  select pi.product_id, pi.is_primary into v_product, v_was_primary
  from public.product_images pi join public.products p on p.id = pi.product_id
  where pi.id = p_image_id and p.shop_id = v_shop;
  if v_product is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  delete from public.product_images where id = p_image_id;
  -- if we removed the primary, promote the next image
  if v_was_primary then
    update public.product_images set is_primary = true
    where id = (select id from public.product_images where product_id = v_product order by display_order limit 1);
  end if;
end $$;

grant execute on function public.add_product_image(uuid, text, boolean) to authenticated;
grant execute on function public.set_primary_image(uuid) to authenticated;
grant execute on function public.delete_product_image(uuid) to authenticated;
