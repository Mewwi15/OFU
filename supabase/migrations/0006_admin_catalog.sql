-- 0006_admin_catalog.sql
-- อู้ฟู่ (Oofoo) — admin catalog + banner management RPCs (SECURITY DEFINER).
-- The admin web manages all products/variants/categories/banners through these
-- (the customer app + direct table writes can't — catalog UPDATE is RLS-denied,
-- mutations flow through here and are audited). Source: docs/06 RPC + docs/07 §1.11.
-- search_path='' → everything fully qualified; enum literals explicitly cast.

-- ─────────────────────────────────────────────────────────────────────────────
-- Guards / helpers
-- ─────────────────────────────────────────────────────────────────────────────
-- Return the caller's shop iff they are an active admin; else FORBIDDEN.
create or replace function public.admin_shop()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select shop_id into v_shop
  from public.app_users
  where id = auth.uid() and role = 'admin'::public.role_t
    and account_state = 'active'::public.account_state_t;
  if v_shop is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return v_shop;
end $$;

-- Append a PII-free audit row for an admin mutation.
create or replace function public.write_audit(
  p_shop uuid, p_action text, p_table text, p_target text,
  p_summary text, p_fields text[] default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (
    shop_id, actor_user_id, actor_role, actor_tier,
    action, target_table, target_id, summary, changed_fields
  )
  select p_shop, auth.uid(), 'admin'::public.role_t, au.admin_tier,
         p_action, p_table, p_target, p_summary, p_fields
  from public.app_users au where au.id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Categories
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_category(
  p_id uuid default null,
  p_name text default null,
  p_slug text default null,
  p_display_order int default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name required';
  end if;
  if p_id is null then
    begin
      insert into public.categories (shop_id, name, slug, display_order)
      values (v_shop, p_name, p_slug, coalesce(p_display_order, 0))
      returning id into v_id;
    exception when unique_violation then
      raise exception 'DUPLICATE_CATEGORY' using errcode = 'P0001';
    end;
  else
    update public.categories
       set name = p_name, slug = p_slug, display_order = coalesce(p_display_order, display_order)
     where id = p_id and shop_id = v_shop
     returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_category', 'categories', v_id::text, 'category ' || p_name);
  return jsonb_build_object('id', v_id);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Products
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_product(
  p_id uuid default null,
  p_category_id uuid default null,
  p_name text default null,
  p_subtitle text default null,
  p_description text default null,
  p_orderable_delivery boolean default true,
  p_orderable_online boolean default true,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_rv int;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name required';
  end if;
  -- category (if given) must belong to the shop
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id and shop_id = v_shop
  ) then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'category not in shop';
  end if;

  if p_id is null then
    insert into public.products (
      shop_id, category_id, name, subtitle, description,
      orderable_delivery, orderable_online
    ) values (
      v_shop, p_category_id, p_name, p_subtitle, p_description,
      coalesce(p_orderable_delivery, true), coalesce(p_orderable_online, true)
    ) returning id into v_id;
  else
    select row_version into v_rv from public.products where id = p_id and shop_id = v_shop;
    if v_rv is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
    if p_expected_row_version is not null and p_expected_row_version <> v_rv then
      raise exception 'STALE_WRITE' using errcode = 'P0001';
    end if;
    update public.products set
      category_id = p_category_id,
      name = p_name, subtitle = p_subtitle, description = p_description,
      orderable_delivery = coalesce(p_orderable_delivery, orderable_delivery),
      orderable_online = coalesce(p_orderable_online, orderable_online),
      row_version = row_version + 1
    where id = p_id and shop_id = v_shop
    returning id into v_id;
  end if;
  perform public.write_audit(v_shop, 'upsert_product', 'products', v_id::text, 'product ' || p_name);
  return jsonb_build_object('id', v_id);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Variants (per-size price + stock). A stock_qty change writes a ledger row.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_variant(
  p_id uuid default null,
  p_product_id uuid default null,
  p_size text default null,
  p_price int default null,
  p_stock_qty int default null,
  p_low_stock_threshold int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid; v_old_stock int; v_new_stock int;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'price > 0 required';
  end if;
  if p_stock_qty is not null and p_stock_qty < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'stock >= 0';
  end if;
  -- product must belong to the shop
  if p_product_id is null or not exists (
    select 1 from public.products where id = p_product_id and shop_id = v_shop
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'product';
  end if;

  if p_id is null then
    begin
      insert into public.product_variants (product_id, size, price, stock_qty, low_stock_threshold)
      values (p_product_id, p_size, p_price, coalesce(p_stock_qty, 0), coalesce(p_low_stock_threshold, 5))
      returning id, stock_qty into v_id, v_new_stock;
    exception when unique_violation then
      raise exception 'DUPLICATE_VARIANT' using errcode = 'P0001';
    end;
    if v_new_stock > 0 then
      insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (v_id, v_new_stock, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
    end if;
  else
    select pv.stock_qty into v_old_stock
    from public.product_variants pv join public.products p on p.id = pv.product_id
    where pv.id = p_id and p.id = p_product_id and p.shop_id = v_shop;
    if v_old_stock is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant';
    end if;
    update public.product_variants set
      size = p_size, price = p_price,
      stock_qty = coalesce(p_stock_qty, stock_qty),
      low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold)
    where id = p_id returning id, stock_qty into v_id, v_new_stock;
    if v_new_stock <> v_old_stock then
      insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (v_id, v_new_stock - v_old_stock, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
    end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_variant', 'product_variants', v_id::text, 'variant price=' || p_price);
  return jsonb_build_object('id', v_id);
end $$;

-- Direct stock adjustment (+/-) with ledger.
create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_delta int,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_cur int; v_new int;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'delta != 0';
  end if;
  -- Lock the row, compute the result, and reject an under-zero adjustment with a
  -- friendly error (rather than letting the stock_qty>=0 CHECK fire raw).
  select pv.stock_qty into v_cur
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = p_variant_id and p.shop_id = v_shop
  for update;
  if v_cur is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant';
  end if;
  v_new := v_cur + p_delta;
  if v_new < 0 then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001',
      detail = 'adjustment would drop stock below 0';
  end if;
  update public.product_variants set stock_qty = v_new where id = p_variant_id;
  insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
  values (p_variant_id, p_delta, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
  perform public.write_audit(v_shop, 'adjust_stock', 'product_variants', p_variant_id::text,
    'stock ' || (case when p_delta > 0 then '+' else '' end) || p_delta);
  return jsonb_build_object('variant_id', p_variant_id, 'stock_qty', v_new);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Publish / archive
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_publish_state(
  p_product_id uuid,
  p_state public.publish_state_t,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_rv int;
begin
  select row_version into v_rv from public.products where id = p_product_id and shop_id = v_shop;
  if v_rv is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;
  -- A product can only be published if it has at least one variant AND one image.
  if p_state = 'published'::public.publish_state_t then
    if not exists (select 1 from public.product_variants where product_id = p_product_id)
       or not exists (select 1 from public.product_images where product_id = p_product_id) then
      raise exception 'BROKEN_PUBLISH' using errcode = 'P0001',
        detail = 'needs at least one variant and one image';
    end if;
  end if;
  update public.products
     set publish_state = p_state, row_version = row_version + 1
   where id = p_product_id and shop_id = v_shop;
  perform public.write_audit(v_shop, 'set_publish_state', 'products', p_product_id::text, 'publish=' || p_state);
  return jsonb_build_object('id', p_product_id, 'publish_state', p_state);
end $$;

create or replace function public.archive_product(
  p_id uuid,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_rv int;
begin
  select row_version into v_rv from public.products where id = p_id and shop_id = v_shop;
  if v_rv is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;
  update public.products
     set archived_at = now(), publish_state = 'draft'::public.publish_state_t,
         row_version = row_version + 1
   where id = p_id and shop_id = v_shop;
  perform public.write_audit(v_shop, 'archive_product', 'products', p_id::text, 'archived');
  return jsonb_build_object('id', p_id, 'archived', true);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Banners (add / edit / remove)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_banner(
  p_id uuid default null,
  p_image_path text default null,
  p_alt_text text default null,
  p_headline text default null,
  p_cta_label text default null,
  p_cta_target_type public.cta_target_t default null,
  p_cta_target_id text default null,
  p_cta_url text default null,
  p_display_order int default 0,
  p_publish_state public.publish_state_t default 'draft'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  if p_image_path is null or btrim(p_image_path) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'image required';
  end if;
  if p_id is null then
    insert into public.banners (
      shop_id, image_path, alt_text, headline, cta_label, cta_target_type,
      cta_target_id, cta_url, display_order, publish_state, created_by
    ) values (
      v_shop, p_image_path, p_alt_text, p_headline, coalesce(p_cta_label, 'ช้อปเลย'),
      p_cta_target_type, p_cta_target_id, p_cta_url,
      coalesce(p_display_order, 0), coalesce(p_publish_state, 'draft'::public.publish_state_t), auth.uid()
    ) returning id into v_id;
  else
    update public.banners set
      image_path = p_image_path, alt_text = p_alt_text, headline = p_headline,
      cta_label = coalesce(p_cta_label, cta_label), cta_target_type = p_cta_target_type,
      cta_target_id = p_cta_target_id, cta_url = p_cta_url,
      display_order = coalesce(p_display_order, display_order),
      publish_state = coalesce(p_publish_state, publish_state)
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_banner', 'banners', v_id::text, 'banner');
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.delete_banner(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  delete from public.banners where id = p_id and shop_id = v_shop returning id into v_id;
  if v_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.write_audit(v_shop, 'delete_banner', 'banners', p_id::text, 'deleted');
  return jsonb_build_object('id', p_id, 'deleted', true);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute privileges: admin RPCs are callable by authenticated (the admin_shop()
-- guard rejects non-admins). Helpers stay internal.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.admin_shop(), public.write_audit(uuid, text, text, text, text, text[]) from public;

revoke execute on function
  public.upsert_category(uuid, text, text, int),
  public.upsert_product(uuid, uuid, text, text, text, boolean, boolean, int),
  public.upsert_variant(uuid, uuid, text, int, int, int),
  public.adjust_stock(uuid, int, text),
  public.set_publish_state(uuid, public.publish_state_t, int),
  public.archive_product(uuid, int),
  public.upsert_banner(uuid, text, text, text, text, public.cta_target_t, text, text, int, public.publish_state_t),
  public.delete_banner(uuid)
  from public;

grant execute on function
  public.upsert_category(uuid, text, text, int),
  public.upsert_product(uuid, uuid, text, text, text, boolean, boolean, int),
  public.upsert_variant(uuid, uuid, text, int, int, int),
  public.adjust_stock(uuid, int, text),
  public.set_publish_state(uuid, public.publish_state_t, int),
  public.archive_product(uuid, int),
  public.upsert_banner(uuid, text, text, text, text, public.cta_target_t, text, text, int, public.publish_state_t),
  public.delete_banner(uuid)
  to authenticated;
