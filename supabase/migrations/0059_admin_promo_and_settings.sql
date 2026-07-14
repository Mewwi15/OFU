-- 0059_admin_promo_and_settings.sql
-- อู้ฟู่ (Oofoo) — admin write-paths for two tables that have only ever had a
-- read policy: promo_codes and shop_settings/shops. Every historical change to
-- delivery fee, VAT, or the PromptPay receiving account has been a developer
-- one-off migration (see 0048, 0050) because there was no other way — the
-- owner could not self-serve these from the app. Same story for promo codes:
-- place_order/validate_promo fully support them, but nothing in admin can
-- create one. Both new RPCs are owner-gated (public.is_owner_of) since they
-- touch pricing/payment routing, not just catalog content — a step up from
-- the plain admin_shop() guard most admin RPCs use.

-- ─────────────────────────────────────────────────────────────────────────────
-- Promo codes: create/edit + activate/deactivate
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_promo_code(
  p_code             citext,
  p_type             public.promo_type_t,
  p_value            int,
  p_id               uuid default null,
  p_max_discount     int default null,
  p_min_spend        int default 0,
  p_scope            public.promo_scope_t default 'subtotal',
  p_active_from      timestamptz default null,
  p_active_to        timestamptz default null,
  p_total_limit      int default null,
  p_per_user_limit   int default null,
  p_active           boolean default true
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id   uuid;
begin
  if v_shop is null or not public.is_owner_of(v_shop) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_code is null or btrim(p_code::text) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'code_required';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'value_must_be_positive';
  end if;
  if p_type = 'percent'::public.promo_type_t and p_value > 100 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'percent_over_100';
  end if;
  if p_min_spend < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'min_spend_negative';
  end if;
  if p_active_from is not null and p_active_to is not null and p_active_from > p_active_to then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'date_range';
  end if;

  if p_id is null then
    insert into public.promo_codes (
      shop_id, code, type, value, max_discount, min_spend, scope,
      active_from, active_to, total_limit, per_user_limit, active, created_by
    ) values (
      v_shop, p_code, p_type, p_value, p_max_discount, p_min_spend, p_scope,
      p_active_from, p_active_to, p_total_limit, p_per_user_limit, p_active, auth.uid()
    )
    returning id into v_id;
  else
    update public.promo_codes set
      code            = p_code,
      type            = p_type,
      value           = p_value,
      max_discount    = p_max_discount,
      min_spend       = p_min_spend,
      scope           = p_scope,
      active_from     = p_active_from,
      active_to       = p_active_to,
      total_limit     = p_total_limit,
      per_user_limit  = p_per_user_limit,
      active          = p_active
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  perform public.write_audit(v_shop, 'upsert_promo_code', 'promo_codes', v_id::text, p_code::text);
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    raise exception 'DUPLICATE_PROMO_CODE' using errcode = 'P0001';
  when check_violation then
    raise exception 'VALIDATION' using errcode = 'P0001';
end $$;

create or replace function public.set_promo_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null or not public.is_owner_of(v_shop) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.promo_codes set active = p_active where id = p_id and shop_id = v_shop;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.write_audit(
    v_shop, case when p_active then 'activate_promo' else 'deactivate_promo' end,
    'promo_codes', p_id::text, null);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Shop settings: delivery/online fee, VAT, PromptPay receiving account, COD
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_shop_settings(
  p_name                      text,
  p_promptpay_id              text,
  p_promptpay_name            text,
  p_delivery_fee              int,
  p_free_delivery_threshold   int,
  p_online_fee                int,
  p_online_free_threshold     int,
  p_cod_enabled               boolean,
  p_cod_cap                   int,
  p_vat_registered            boolean,
  p_vat_rate                  numeric,
  p_tax_id                    text,
  p_branch_code               text,
  p_receipt_header            text,
  p_receipt_footer            text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_promptpay_id text := nullif(btrim(coalesce(p_promptpay_id, '')), '');
begin
  if v_shop is null or not public.is_owner_of(v_shop) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name_required';
  end if;
  if p_delivery_fee < 0 or p_free_delivery_threshold < 0
     or p_online_fee < 0 or p_online_free_threshold < 0 or coalesce(p_cod_cap, 0) < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'negative_amount';
  end if;
  if p_vat_rate < 0 or p_vat_rate > 100 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'vat_rate_range';
  end if;
  -- PromptPay id is the live money-routing field for every checkout QR — a
  -- typo here silently misdirects real customer payments, so it's format
  -- checked (digits only; 10 = mobile, 13 = citizen id, 15 = e-wallet/biller).
  if v_promptpay_id is not null
     and (v_promptpay_id !~ '^[0-9]+$' or length(v_promptpay_id) not in (10, 13, 15)) then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'promptpay_id_format';
  end if;

  update public.shops set
    name           = btrim(p_name),
    promptpay_id   = v_promptpay_id,
    promptpay_name = nullif(btrim(coalesce(p_promptpay_name, '')), '')
  where id = v_shop;

  update public.shop_settings set
    delivery_fee            = p_delivery_fee,
    free_delivery_threshold = p_free_delivery_threshold,
    online_fee              = p_online_fee,
    online_free_threshold   = p_online_free_threshold,
    cod_enabled              = p_cod_enabled,
    cod_cap                  = p_cod_cap,
    vat_registered           = p_vat_registered,
    vat_rate                 = p_vat_rate,
    tax_id                   = nullif(btrim(coalesce(p_tax_id, '')), ''),
    branch_code              = coalesce(nullif(btrim(coalesce(p_branch_code, '')), ''), '00000'),
    receipt_header           = nullif(btrim(coalesce(p_receipt_header, '')), ''),
    receipt_footer           = nullif(btrim(coalesce(p_receipt_footer, '')), ''),
    updated_at               = now(),
    updated_by               = auth.uid()
  where shop_id = v_shop;

  perform public.write_audit(v_shop, 'update_shop_settings', 'shop_settings', v_shop::text, 'owner updated shop settings');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute privileges
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function
  public.upsert_promo_code(citext, public.promo_type_t, int, uuid, int, int, public.promo_scope_t, timestamptz, timestamptz, int, int, boolean),
  public.set_promo_active(uuid, boolean),
  public.update_shop_settings(text, text, text, int, int, int, int, boolean, int, boolean, numeric, text, text, text, text)
  from public;

grant execute on function
  public.upsert_promo_code(citext, public.promo_type_t, int, uuid, int, int, public.promo_scope_t, timestamptz, timestamptz, int, int, boolean),
  public.set_promo_active(uuid, boolean),
  public.update_shop_settings(text, text, text, int, int, int, int, boolean, int, boolean, numeric, text, text, text, text)
  to authenticated;
