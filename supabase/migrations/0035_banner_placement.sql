-- 0035_banner_placement.sql
-- Banners can appear in several app slots, not just the home carousel. Add a
-- `placement` so every banner in the app (home carousel + search hero + the 3
-- search section headers) is admin-managed (add/edit/delete/reorder per slot).

alter table public.banners add column if not exists placement text not null default 'home';
alter table public.banners drop constraint if exists banners_placement_chk;
alter table public.banners add constraint banners_placement_chk
  check (placement in ('home', 'search_hero', 'search_trending', 'search_promo', 'search_hot'));

-- Extend upsert_banner with p_placement (drop the old signature first so PostgREST
-- doesn't see two overloads).
drop function if exists public.upsert_banner(uuid, text, text, text, text, cta_target_t, text, text, integer, publish_state_t);

create or replace function public.upsert_banner(
  p_id uuid default null,
  p_image_path text default null,
  p_alt_text text default null,
  p_headline text default null,
  p_cta_label text default null,
  p_cta_target_type cta_target_t default null,
  p_cta_target_id text default null,
  p_cta_url text default null,
  p_display_order integer default 0,
  p_publish_state publish_state_t default 'draft'::publish_state_t,
  p_placement text default 'home'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  if p_id is null then
    if p_image_path is null or btrim(p_image_path) = '' then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'image required';
    end if;
    insert into public.banners (
      shop_id, image_path, alt_text, headline, cta_label, cta_target_type,
      cta_target_id, cta_url, display_order, publish_state, placement, created_by
    ) values (
      v_shop, p_image_path, p_alt_text, p_headline, coalesce(p_cta_label, 'ช้อปเลย'),
      p_cta_target_type, p_cta_target_id, p_cta_url,
      coalesce(p_display_order, 0), coalesce(p_publish_state, 'draft'::public.publish_state_t),
      coalesce(p_placement, 'home'), auth.uid()
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
      publish_state = coalesce(p_publish_state, publish_state),
      placement = coalesce(p_placement, placement)
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_banner', 'banners', v_id::text, 'banner');
  return jsonb_build_object('id', v_id);
end $$;

grant execute on function public.upsert_banner(uuid, text, text, text, text, cta_target_t, text, text, integer, publish_state_t, text) to authenticated;
