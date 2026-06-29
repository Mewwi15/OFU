-- 0004_auth_identity.sql
-- อู้ฟู่ (Oofoo) — auth/identity foundation: provisioning + mirror triggers +
-- identity/consent RPCs. Unblocks the customer Auth slice (D3) and the shared
-- account model for all 3 surfaces. Source: docs/06 (RPC/triggers), docs/07,
-- docs/11 §6.
--
-- All business logic = SECURITY DEFINER, search_path='' (fully qualified),
-- acting only on auth.uid()'s own data.

-- ─────────────────────────────────────────────────────────────────────────────
-- Provision an app_users row when a Supabase auth user is created.
-- Invite flows pass role/shop/tier via user metadata; plain signup = customer.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.role_t;
  v_shop uuid;
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.role_t, 'customer');
  v_shop := coalesce(
    (new.raw_user_meta_data ->> 'shop_id')::uuid,
    (select id from public.shops where active order by created_at limit 1)
  );

  insert into public.app_users (
    id, shop_id, role, admin_tier, account_state, display_name, email, phone
  ) values (
    new.id,
    v_shop,
    v_role,
    case when v_role = 'admin'
         then coalesce((new.raw_user_meta_data ->> 'admin_tier')::public.admin_tier_t, 'staff')
         else null end,
    -- customers are live immediately; invited admin/rider stay pending until activated
    (case when v_role = 'customer' then 'active' else 'pending' end)::public.account_state_t,
    new.raw_user_meta_data ->> 'display_name',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- payments = authoritative payment state → mirror onto orders.payment_status
-- (orders.payment_status is read-only/derived; INT-1).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mirror_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set payment_status = new.status where id = new.order_id;
  return new;
end $$;

create trigger payments_mirror
  after insert or update of status on payments
  for each row execute function public.mirror_payment_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- Generic updated_at touch
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch_app_users     before update on app_users     for each row execute function public.touch_updated_at();
create trigger touch_addresses     before update on addresses     for each row execute function public.touch_updated_at();
create trigger touch_products      before update on products      for each row execute function public.touch_updated_at();
create trigger touch_carts         before update on carts         for each row execute function public.touch_updated_at();
create trigger touch_shop_settings before update on shop_settings for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: profile
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_profile(
  p_display_name text default null,
  p_avatar_path  text default null,
  p_locale       text default null
) returns public.app_users
language plpgsql security definer set search_path = '' as $$
declare v_row public.app_users;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  update public.app_users set
    display_name = coalesce(p_display_name, display_name),
    avatar_path  = coalesce(p_avatar_path, avatar_path),
    locale       = coalesce(p_locale, locale)
  where id = auth.uid()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_row;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: PDPA consent (latest row per purpose = current state)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_consent_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(purpose, granted), '{}'::jsonb)
  from (
    select distinct on (purpose)
      purpose,
      (granted and withdrawn_at is null) as granted
    from public.pdpa_consents
    where user_id = auth.uid()
    order by purpose, granted_at desc
  ) s
$$;

create or replace function public.grant_consent(
  p_purpose        public.consent_purpose_t,
  p_policy_version text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  -- clock_timestamp() (not now()) so repeated consent changes get strictly
  -- increasing granted_at → "latest row wins" stays deterministic even same-tx.
  insert into public.pdpa_consents (user_id, purpose, policy_version, granted, granted_at, source)
  values (auth.uid(), p_purpose, p_policy_version, true, clock_timestamp(), 'app');
end $$;

create or replace function public.withdraw_consent(
  p_purpose public.consent_purpose_t
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  insert into public.pdpa_consents (user_id, purpose, granted, granted_at, withdrawn_at, source)
  values (auth.uid(), p_purpose, false, clock_timestamp(), clock_timestamp(), 'app');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute privileges: client-callable RPCs → authenticated only.
-- Trigger functions are not directly callable.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function
  public.update_profile(text, text, text),
  public.get_consent_status(),
  public.grant_consent(public.consent_purpose_t, text),
  public.withdraw_consent(public.consent_purpose_t)
  from public;

grant execute on function
  public.update_profile(text, text, text),
  public.get_consent_status(),
  public.grant_consent(public.consent_purpose_t, text),
  public.withdraw_consent(public.consent_purpose_t)
  to authenticated;

revoke execute on function
  public.handle_new_auth_user(),
  public.mirror_payment_status(),
  public.touch_updated_at()
  from public;
