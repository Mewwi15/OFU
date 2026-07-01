-- 0030_upsert_banner_partial.sql
-- Fix: upsert_banner required image_path on every call and overwrote fields with
-- nulls, so a partial update (e.g. toggling publish) wiped the image and failed
-- the NOT NULL check ("ข้อมูลไม่ถูกต้อง"). Now: image is required only when the
-- row would end up with none; updates keep existing values when a param is null.
create or replace function public.upsert_banner(
  p_id uuid default null, p_image_path text default null, p_alt_text text default null,
  p_headline text default null, p_cta_label text default null,
  p_cta_target_type cta_target_t default null, p_cta_target_id text default null,
  p_cta_url text default null, p_display_order integer default 0,
  p_publish_state publish_state_t default 'draft'::publish_state_t
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  if p_id is null then
    if p_image_path is null or btrim(p_image_path) = '' then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'image required';
    end if;
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
      image_path = coalesce(p_image_path, image_path),
      alt_text = coalesce(p_alt_text, alt_text),
      headline = coalesce(p_headline, headline),
      cta_label = coalesce(p_cta_label, cta_label),
      cta_target_type = coalesce(p_cta_target_type, cta_target_type),
      cta_target_id = coalesce(p_cta_target_id, cta_target_id),
      cta_url = coalesce(p_cta_url, cta_url),
      display_order = coalesce(p_display_order, display_order),
      publish_state = coalesce(p_publish_state, publish_state)
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_banner', 'banners', v_id::text, 'banner');
  return jsonb_build_object('id', v_id);
end $$;
