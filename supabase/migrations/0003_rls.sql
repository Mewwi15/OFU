-- 0003_rls.sql
-- อู้ฟู่ (Oofoo) — Row-Level Security for all 3 surfaces.
-- Source: docs/06-data-model.md (## RLS), docs/07-api-contract.md.
--
-- Posture:
--   * RLS ENABLED on every table (Supabase grants anon/authenticated broad table
--     privileges by default — RLS is what actually gates access).
--   * SELECT governed by per-role policies below.
--   * WRITES go through SECURITY DEFINER RPCs (migration 0004), which run as the
--     table owner and BYPASS RLS — so most tables get NO client write policy.
--     A few personal tables (addresses, wishlist, push_tokens, notification_
--     preferences) allow direct owner writes for convenience.
--   * service_role (Edge Functions) has BYPASSRLS — server side is unrestricted.
--   * Rider recipient PII is NOT exposed via row reads (deliveries has no ship_*;
--     PII lives on orders, which riders cannot SELECT) — served only by the
--     time-gated RPC get_assigned_delivery (0004). See ADR / 07 HIGH#2.

-- ─────────────────────────────────────────────────────────────────────────────
-- Role-resolver helpers (SECURITY DEFINER → read app_users bypassing its RLS).
-- STABLE so the planner evaluates once per statement. search_path='' = qualified.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.app_role() returns public.role_t
  language sql stable security definer set search_path = '' as $$
  select role from public.app_users where id = auth.uid()
$$;

create or replace function public.app_shop_id() returns uuid
  language sql stable security definer set search_path = '' as $$
  select shop_id from public.app_users where id = auth.uid()
$$;

create or replace function public.app_tier() returns public.admin_tier_t
  language sql stable security definer set search_path = '' as $$
  select admin_tier from public.app_users where id = auth.uid()
$$;

create or replace function public.is_admin_of(p_shop uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and role = 'admin' and shop_id = p_shop
      and account_state = 'active'
  )
$$;

create or replace function public.is_owner_of(p_shop uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and role = 'admin' and admin_tier = 'owner'
      and shop_id = p_shop and account_state = 'active'
  )
$$;

revoke execute on function public.app_role, public.app_shop_id, public.app_tier,
  public.is_admin_of, public.is_owner_of from public;
grant execute on function public.app_role, public.app_shop_id, public.app_tier,
  public.is_admin_of, public.is_owner_of to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS everywhere (default-deny once enabled)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Public / shared reads (incl. anon)
-- ─────────────────────────────────────────────────────────────────────────────
create policy shops_read       on shops              for select using (true);
create policy shop_hours_read  on shop_hours         for select using (true);
create policy policy_ver_read  on policy_versions    for select using (true);
create policy categories_read  on categories         for select using (true);

-- Published catalog visible to everyone; admins of the shop also see drafts.
create policy products_public_read on products for select
  using ((publish_state = 'published' and archived_at is null) or public.is_admin_of(shop_id));

create policy variants_read on product_variants for select using (
  exists (select 1 from products p
          where p.id = product_id
            and ((p.publish_state = 'published' and p.archived_at is null)
                 or public.is_admin_of(p.shop_id)))
);
create policy images_read on product_images for select using (
  exists (select 1 from products p
          where p.id = product_id
            and ((p.publish_state = 'published' and p.archived_at is null)
                 or public.is_admin_of(p.shop_id)))
);

create policy banners_read on banners for select
  using (publish_state = 'published' or public.is_admin_of(shop_id));
create policy fsections_read on featured_sections for select
  using (publish_state = 'published' or public.is_admin_of(shop_id));
create policy fsection_items_read on featured_section_items for select using (
  exists (select 1 from featured_sections s
          where s.id = section_id
            and (s.publish_state = 'published' or public.is_admin_of(s.shop_id)))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin-only reads
-- ─────────────────────────────────────────────────────────────────────────────
create policy shop_settings_admin on shop_settings for select using (public.is_admin_of(shop_id));
create policy promo_codes_admin   on promo_codes   for select using (public.is_admin_of(shop_id));
create policy stock_moves_admin   on stock_movements for select using (
  exists (select 1 from product_variants v join products p on p.id = v.product_id
          where v.id = variant_id and public.is_admin_of(p.shop_id))
);
-- audit_log: owner tier only
create policy audit_owner on audit_log for select using (public.is_owner_of(shop_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity / profile
-- ─────────────────────────────────────────────────────────────────────────────
-- Own row; admins see their shop's roster (riders/staff).
create policy app_users_read on app_users for select
  using (id = auth.uid() or public.is_admin_of(shop_id));

create policy rider_profiles_read on rider_profiles for select
  using (user_id = auth.uid() or public.is_admin_of(public.app_shop_id()));

-- PDPA / personal: owner reads own; writes via RPC.
create policy consents_own  on pdpa_consents for select using (user_id = auth.uid());
create policy data_req_own   on data_requests for select using (user_id = auth.uid());

-- Personal convenience tables: full owner CRUD direct (no RPC needed)
create policy addresses_rw on addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlist_rw on wishlist_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_rw on push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_prefs_rw on notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Cart (read own; writes via cart RPCs)
-- ─────────────────────────────────────────────────────────────────────────────
create policy carts_own on carts for select using (owner_user_id = auth.uid());
create policy cart_items_own on cart_items for select using (
  exists (select 1 from carts c where c.id = cart_id and c.owner_user_id = auth.uid())
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Orders & children (customer own + admin shop; writes via RPC)
-- ─────────────────────────────────────────────────────────────────────────────
create policy orders_read on orders for select
  using (customer_user_id = auth.uid() or public.is_admin_of(shop_id));

create policy order_items_read on order_items for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_user_id = auth.uid() or public.is_admin_of(o.shop_id)))
);
create policy order_events_read on order_status_events for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_user_id = auth.uid() or public.is_admin_of(o.shop_id)))
);
create policy order_ratings_read on order_ratings for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_user_id = auth.uid() or public.is_admin_of(o.shop_id)))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Payment (sensitive — customer own + admin shop; slip/refund files via signed URL)
-- ─────────────────────────────────────────────────────────────────────────────
create policy payments_read on payments for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_user_id = auth.uid() or public.is_admin_of(o.shop_id)))
);
create policy slips_read on payment_slips for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_user_id = auth.uid() or public.is_admin_of(o.shop_id)))
);
create policy refunds_read on refunds for select
  using (
    public.is_admin_of(shop_id)
    or exists (select 1 from orders o where o.id = order_id and o.customer_user_id = auth.uid())
  );
create policy promo_redemptions_read on promo_redemptions for select
  using (user_id = auth.uid()
         or exists (select 1 from orders o where o.id = order_id and public.is_admin_of(o.shop_id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- Fulfilment — Parcel (Flash) + Delivery (rider)
-- ─────────────────────────────────────────────────────────────────────────────
-- parcel_shipments: customer (via order) + admin. Riders not involved.
create policy parcel_read on parcel_shipments for select using (
  public.is_admin_of(shop_id)
  or exists (select 1 from orders o where o.id = order_id and o.customer_user_id = auth.uid())
);

-- deliveries: PII-free by schema. Rider sees own jobs + available pool; admin sees shop.
create policy deliveries_read on deliveries for select using (
  public.is_admin_of(shop_id)
  or (public.app_role() = 'rider' and (rider_user_id = auth.uid() or is_available = true))
);
create policy assignments_read on delivery_assignments for select using (
  rider_user_id = auth.uid()
  or exists (select 1 from orders o where o.id = order_id and public.is_admin_of(o.shop_id))
);
create policy shifts_read on rider_shifts for select
  using (rider_user_id = auth.uid() or public.is_admin_of(shop_id));
create policy shift_cash_read on shift_cash_entries for select using (
  exists (select 1 from rider_shifts s where s.id = shift_id
          and (s.rider_user_id = auth.uid() or public.is_admin_of(s.shop_id)))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications (recipient membership; admins see their shop's)
-- ─────────────────────────────────────────────────────────────────────────────
create policy notifications_read on notifications for select using (
  public.is_admin_of(shop_id)
  or exists (select 1 from notification_recipients nr
             where nr.notification_id = notifications.id and nr.user_id = auth.uid())
);
-- recipients: read own + mark-read (update read_at) on own rows
create policy notif_recipients_read on notification_recipients for select
  using (user_id = auth.uid());
create policy notif_recipients_mark on notification_recipients for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_deliveries_own on notification_deliveries for select
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- order_number_seq: server-only (no policy → no client access; RPC bypasses RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- (RLS enabled above; intentionally no policy.)

-- ─────────────────────────────────────────────────────────────────────────────
-- Base table privileges. RLS only gates a role that already holds the table
-- GRANT, so grant the standard Supabase API roles and let the policies above do
-- the actual filtering. anon/authenticated = read-only baseline; direct writes
-- only on personal tables (everything else flows through SECURITY DEFINER RPC).
-- ─────────────────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

grant insert, update, delete on
  addresses, wishlist_items, push_tokens, notification_preferences
  to authenticated;
grant update on notification_recipients to authenticated;   -- mark read_at (RLS → own rows)
