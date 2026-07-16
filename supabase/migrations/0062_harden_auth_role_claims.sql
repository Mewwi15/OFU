-- 0062_harden_auth_role_claims.sql
-- Self-service signup must not be able to provision privileged app_users roles.

create or replace function public.app_role() returns public.role_t
  language sql stable security definer set search_path = '' as $$
  select role
  from public.app_users
  where id = auth.uid()
    and account_state = 'active'::public.account_state_t
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role public.role_t := 'customer'::public.role_t;
  v_shop uuid;
  v_is_invite boolean := new.invited_at is not null;
begin
  if v_is_invite and (new.raw_user_meta_data ->> 'role') in ('admin', 'rider', 'customer') then
    v_role := (new.raw_user_meta_data ->> 'role')::public.role_t;
  end if;

  v_shop := coalesce(
    case when v_is_invite then (new.raw_user_meta_data ->> 'shop_id')::uuid else null end,
    (select id from public.shops where active order by created_at limit 1)
  );

  insert into public.app_users (
    id, shop_id, role, admin_tier, account_state, display_name, email, phone
  ) values (
    new.id,
    v_shop,
    v_role,
    case when v_is_invite and v_role = 'admin'::public.role_t
         then coalesce((new.raw_user_meta_data ->> 'admin_tier')::public.admin_tier_t, 'staff')
         else null end,
    (case when v_role = 'customer'::public.role_t then 'active' else 'pending' end)::public.account_state_t,
    new.raw_user_meta_data ->> 'display_name',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end $$;
