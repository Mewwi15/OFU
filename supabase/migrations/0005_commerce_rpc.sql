-- 0005_commerce_rpc.sql
-- อู้ฟู่ (Oofoo) — customer commerce RPCs: cart, validate_promo, place_order,
-- attach_payment_slip. All SECURITY DEFINER (search_path='') and act only on the
-- caller's own data; writes bypass RLS by design (clients call these, not tables).
-- Source: docs/06 (RPC) + docs/07 (§1.2). Authored + adversarially verified
-- (concurrency/idempotency/security lenses) then reconciled. D1 per-variant
-- price/stock; D2 reserve@place / commit@confirm. Admin verify + state machine
-- land in 0006.

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN: Cart
-- ═══════════════════════════════════════════════════════════════════════════
-- 0005_cart_rpcs.sql
-- อู้ฟู่ (Oofoo) — customer cart RPCs (SECURITY DEFINER; writes bypass RLS).
-- All require an authenticated caller; cart row is upserted per caller
-- (carts.owner_user_id is unique, shop from app_users.shop_id). No stock changes.

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal helper: get-or-create the caller's cart, return its id.
-- The on-conflict no-op UPDATE fires the touch_carts trigger → carts.updated_at
-- is refreshed for every cart mutation. NOT granted to clients (internal only).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cart_ensure()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_cart_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  insert into public.carts (shop_id, owner_user_id)
  select u.shop_id, u.id
    from public.app_users u
   where u.id = v_uid
  on conflict (owner_user_id) do update
    set owner_user_id = excluded.owner_user_id   -- no-op touch → returns existing row
  returning id into v_cart_id;

  if v_cart_id is null then
    -- caller has no app_users profile (should not happen for an authed user)
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'no app_users row for caller';
  end if;

  return v_cart_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- add_cart_item: insert or SUM qty for (cart, variant).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_cart_item(p_variant_id uuid, p_qty int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cart_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'p_qty must be > 0';
  end if;
  if not exists (
    select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = p_variant_id
       and p.shop_id = public.app_shop_id()
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant not in caller shop';
  end if;

  v_cart_id := public.cart_ensure();

  insert into public.cart_items as ci (cart_id, variant_id, qty)
  values (v_cart_id, p_variant_id, p_qty)
  on conflict (cart_id, variant_id) do update
    set qty = ci.qty + excluded.qty;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- set_cart_item_qty: set ABSOLUTE qty; p_qty <= 0 (or null) removes the line.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_cart_item_qty(p_variant_id uuid, p_qty int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cart_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- only validate shop membership when we are about to (re)insert a positive qty
  if p_qty is not null and p_qty > 0 then
    if not exists (
      select 1
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = p_variant_id
         and p.shop_id = public.app_shop_id()
    ) then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant not in caller shop';
    end if;
  end if;

  v_cart_id := public.cart_ensure();

  if p_qty is null or p_qty <= 0 then
    delete from public.cart_items
     where cart_id = v_cart_id and variant_id = p_variant_id;
    return;
  end if;

  insert into public.cart_items as ci (cart_id, variant_id, qty)
  values (v_cart_id, p_variant_id, p_qty)
  on conflict (cart_id, variant_id) do update
    set qty = excluded.qty;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- remove_cart_item: drop a single line.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.remove_cart_item(p_variant_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cart_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  v_cart_id := public.cart_ensure();
  delete from public.cart_items
   where cart_id = v_cart_id and variant_id = p_variant_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- clear_cart: drop all lines from the caller's cart.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.clear_cart()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cart_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  v_cart_id := public.cart_ensure();
  delete from public.cart_items where cart_id = v_cart_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- set_cart_mode: set carts.shop_mode and mirror app_users.preferred_shop_mode.
-- (p_shop_mode is already typed → no enum cast needed.)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_cart_mode(p_shop_mode public.shop_mode_t)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cart_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  v_cart_id := public.cart_ensure();
  update public.carts
     set shop_mode = p_shop_mode
   where id = v_cart_id;
  update public.app_users
     set preferred_shop_mode = p_shop_mode
   where id = auth.uid();
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute privileges: customer RPCs → authenticated only.
-- cart_ensure stays internal (revoked from public, NOT granted to clients;
-- the SECURITY DEFINER callers run as the owner and can still invoke it).
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function
  public.cart_ensure(),
  public.add_cart_item(uuid, int),
  public.set_cart_item_qty(uuid, int),
  public.remove_cart_item(uuid),
  public.clear_cart(),
  public.set_cart_mode(public.shop_mode_t)
  from public;

grant execute on function
  public.add_cart_item(uuid, int),
  public.set_cart_item_qty(uuid, int),
  public.remove_cart_item(uuid),
  public.clear_cart(),
  public.set_cart_mode(public.shop_mode_t)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN: Promo (validate_promo — non-throwing preview)
-- ═══════════════════════════════════════════════════════════════════════════
-- validate_promo — non-throwing cart-preview promo check (customer-callable).
-- Mirrors place_order discount math/caps/floor + live-redemption usage counts,
-- but never raises for promo problems: returns {valid, discount, scope,
-- reason_code, message_th}. Only auth is a hard precondition.
create or replace function public.validate_promo(
  p_code      citext,
  p_subtotal  int,
  p_shop_mode public.shop_mode_t
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_shop      uuid;
  v_promo     public.promo_codes%rowtype;
  v_subtotal  int := greatest(coalesce(p_subtotal, 0), 0);
  v_base      int;
  v_fee       int;
  v_threshold int;
  v_discount  int;
  v_used      int;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- Caller's shop (via app_users). If null/absent the promo lookup below simply
  -- finds nothing -> NOT_FOUND, keeping this preview non-throwing.
  select shop_id into v_shop from public.app_users where id = v_uid;

  -- Promo by (shop_id, code); plain (non-locking) read for a preview.
  select * into v_promo
  from public.promo_codes
  where shop_id = v_shop and code = p_code;

  if not found then
    return jsonb_build_object(
      'valid', false, 'discount', 0, 'scope', null,
      'reason_code', 'NOT_FOUND',
      'message_th', 'ไม่พบโค้ดส่วนลดนี้');
  end if;

  if not v_promo.active then
    return jsonb_build_object(
      'valid', false, 'discount', 0, 'scope', v_promo.scope::text,
      'reason_code', 'INACTIVE',
      'message_th', 'โค้ดส่วนลดนี้ถูกปิดใช้งานแล้ว');
  end if;

  if v_promo.active_from is not null and now() < v_promo.active_from then
    return jsonb_build_object(
      'valid', false, 'discount', 0, 'scope', v_promo.scope::text,
      'reason_code', 'NOT_STARTED',
      'message_th', 'โค้ดส่วนลดนี้ยังไม่เริ่มใช้งาน');
  end if;

  if v_promo.active_to is not null and now() > v_promo.active_to then
    return jsonb_build_object(
      'valid', false, 'discount', 0, 'scope', v_promo.scope::text,
      'reason_code', 'EXPIRED',
      'message_th', 'โค้ดส่วนลดนี้หมดอายุแล้ว');
  end if;

  if v_subtotal < v_promo.min_spend then
    return jsonb_build_object(
      'valid', false, 'discount', 0, 'scope', v_promo.scope::text,
      'reason_code', 'MIN_SPEND',
      'message_th', 'ยอดซื้อขั้นต่ำ ฿' || v_promo.min_spend || ' ถึงจะใช้โค้ดนี้ได้');
  end if;

  -- Total usage cap — count live (un-released) redemptions only.
  if v_promo.total_limit is not null then
    select count(*) into v_used
    from public.promo_redemptions
    where promo_code_id = v_promo.id and released_at is null;
    if v_used >= v_promo.total_limit then
      return jsonb_build_object(
        'valid', false, 'discount', 0, 'scope', v_promo.scope::text,
        'reason_code', 'USAGE_EXCEEDED',
        'message_th', 'โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว');
    end if;
  end if;

  -- Per-user cap — live (un-released) redemptions for this caller only.
  if v_promo.per_user_limit is not null then
    select count(*) into v_used
    from public.promo_redemptions
    where promo_code_id = v_promo.id and user_id = v_uid and released_at is null;
    if v_used >= v_promo.per_user_limit then
      return jsonb_build_object(
        'valid', false, 'discount', 0, 'scope', v_promo.scope::text,
        'reason_code', 'PER_USER_EXCEEDED',
        'message_th', 'คุณใช้โค้ดส่วนลดนี้ครบจำนวนแล้ว');
    end if;
  end if;

  -- Discount base depends on scope. delivery -> the fee this mode would charge
  -- (online: flat 40, free >=500; delivery: shop_settings, free >= threshold).
  if v_promo.scope = 'delivery'::public.promo_scope_t then
    if p_shop_mode = 'online'::public.shop_mode_t then
      v_base := case when v_subtotal >= 500 then 0 else 40 end;
    else
      select delivery_fee, free_delivery_threshold
        into v_fee, v_threshold
      from public.shop_settings where shop_id = v_shop;
      v_base := case when v_subtotal >= coalesce(v_threshold, 0)
                     then 0 else coalesce(v_fee, 0) end;
    end if;
  else
    v_base := v_subtotal;
  end if;

  -- Same math as place_order: percent floors and is capped at max_discount;
  -- fixed_baht is the flat value; either way clamp to the base it applies to.
  if v_promo.type = 'percent'::public.promo_type_t then
    v_discount := floor((v_base::numeric * v_promo.value) / 100)::int;
    if v_promo.max_discount is not null then
      v_discount := least(v_discount, v_promo.max_discount);
    end if;
  else
    v_discount := v_promo.value;
  end if;
  v_discount := greatest(least(v_discount, v_base), 0);

  return jsonb_build_object(
    'valid', true,
    'discount', v_discount,
    'scope', v_promo.scope::text,
    'reason_code', null,
    'message_th', case
      when v_discount > 0 then 'ใช้โค้ดส่วนลด ฿' || v_discount || ' ได้แล้ว'
      else 'ใช้โค้ดส่วนลดนี้ได้' end);
end $$;

revoke execute on function public.validate_promo(citext, int, public.shop_mode_t) from public;
grant  execute on function public.validate_promo(citext, int, public.shop_mode_t) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN: Checkout (place_order — atomic)
-- ═══════════════════════════════════════════════════════════════════════════
-- 0005_rpc_place_order.sql
-- อู้ฟู่ (Oofoo) — place_order: the critical checkout RPC (migration 0005).
-- One implicit transaction: auth + active + consent → idempotent replay →
-- lock cart variants (deterministic) → stock availability → fees/promo →
-- create order/items/payment/event → reserve stock (+ COD commit & auto-confirm)
-- → clear cart. SECURITY DEFINER, search_path='' (everything fully qualified).
-- Money = integer THB. payments.status is authoritative; orders.payment_status is
-- written only by the 0004 mirror trigger.

create or replace function public.place_order(
  p_idempotency_key uuid,
  p_shop_mode       public.shop_mode_t,
  p_payment_method  public.payment_method_t,
  p_address_id      uuid,
  p_promo_code      citext default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_shop_id uuid;
  v_state   public.account_state_t;
  v_consent boolean;
  v_existing uuid;
  v_cart_id uuid;
  -- shop settings
  v_delivery_fee   int;
  v_free_threshold int;
  v_cod_enabled    boolean;
  v_cod_cap        int;
  v_promo_rounding text;
  -- address snapshot
  v_recipient   text;
  v_phone       text;
  v_line        text;
  v_subdistrict text;
  v_district    text;
  v_province    text;
  v_postal      text;
  v_lat         double precision;
  v_lng         double precision;
  -- money
  v_subtotal int;
  v_fee      int := 0;
  v_discount int := 0;
  v_total    int;
  v_oos      uuid[];
  -- promo
  v_promo_id     uuid;
  v_promo_type   public.promo_type_t;
  v_promo_value  int;
  v_promo_max    int;
  v_promo_min    int;
  v_promo_scope  public.promo_scope_t;
  v_promo_active boolean;
  v_promo_from   timestamptz;
  v_promo_to     timestamptz;
  v_promo_tlimit int;
  v_promo_ulimit int;
  v_promo_base   int;
  v_promo_used   int;
  -- order
  v_seq          bigint;
  v_order_number text;
  v_order_id     uuid;
  v_is_cod       boolean := (p_payment_method = 'cod'::public.payment_method_t);
  rec            record;
  v_result       jsonb;
begin
  -- ── Auth ──────────────────────────────────────────────────────────────────
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- caller identity → shop scope + account state
  select au.shop_id, au.account_state
  into v_shop_id, v_state
  from public.app_users au
  where au.id = v_uid;
  if not found then
    raise exception 'ACCOUNT_INACTIVE' using errcode = 'P0001', detail = 'no_app_user';
  end if;

  -- ── Idempotency replay: return THAT order unchanged, no second write ───────
  select o.id into v_existing
  from public.orders o
  where o.shop_id = v_shop_id
    and o.idempotency_key = p_idempotency_key::text;
  if found then
    return (
      select jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_status', o.order_status,
        'payment_status', o.payment_status,
        'subtotal', o.subtotal,
        'delivery_fee', o.delivery_fee,
        'discount_amount', o.discount_amount,
        'total', o.total,
        'payment_method', o.payment_method,
        'shop_mode', o.shop_mode,
        'row_version', o.row_version)
      from public.orders o
      where o.id = v_existing);
  end if;

  -- ── Active + PDPA data_processing consent ─────────────────────────────────
  if v_state <> 'active'::public.account_state_t then
    raise exception 'ACCOUNT_INACTIVE' using errcode = 'P0001';
  end if;

  select (c.granted and c.withdrawn_at is null)
  into v_consent
  from public.pdpa_consents c
  where c.user_id = v_uid
    and c.purpose = 'data_processing'::public.consent_purpose_t
  order by c.granted_at desc
  limit 1;
  if v_consent is not true then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  -- ── Shop settings (defaults if a row is absent) ───────────────────────────
  select s.delivery_fee, s.free_delivery_threshold, s.cod_enabled, s.cod_cap, s.promo_rounding
  into v_delivery_fee, v_free_threshold, v_cod_enabled, v_cod_cap, v_promo_rounding
  from public.shop_settings s
  where s.shop_id = v_shop_id;
  v_delivery_fee   := coalesce(v_delivery_fee, 40);
  v_free_threshold := coalesce(v_free_threshold, 200);
  v_cod_enabled    := coalesce(v_cod_enabled, true);
  v_promo_rounding := coalesce(v_promo_rounding, 'floor');

  -- ── Cart must exist and be non-empty ──────────────────────────────────────
  -- Lock the cart row FOR UPDATE so concurrent place_orders (double-tap with
  -- distinct idempotency keys) for this user serialize on the single cart
  -- (carts.owner_user_id is UNIQUE). The loser blocks here, then the post-lock
  -- cart_items non-empty check below sees the emptied cart and raises EMPTY_CART
  -- instead of building a phantom, mischarged order.
  select ca.id into v_cart_id
  from public.carts ca
  where ca.owner_user_id = v_uid
  for update;
  if not found then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- Post-lock idempotency recheck: a concurrent same-key call may have committed
  -- (and emptied the cart) while we waited on the cart lock. Return its order
  -- instead of misreporting EMPTY_CART.
  select o.id into v_existing
  from public.orders o
  where o.shop_id = v_shop_id
    and o.idempotency_key = p_idempotency_key::text;
  if found then
    return (
      select jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_status', o.order_status,
        'payment_status', o.payment_status,
        'subtotal', o.subtotal,
        'delivery_fee', o.delivery_fee,
        'discount_amount', o.discount_amount,
        'total', o.total,
        'payment_method', o.payment_method,
        'shop_mode', o.shop_mode,
        'row_version', o.row_version)
      from public.orders o
      where o.id = v_existing);
  end if;

  perform 1 from public.cart_items where cart_id = v_cart_id limit 1;
  if not found then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- ── Address (required for both modes; must belong to caller) ──────────────
  if p_address_id is null then
    raise exception 'ADDRESS_REQUIRED' using errcode = 'P0001';
  end if;
  select a.recipient_name, a.recipient_phone, a.address_line, a.subdistrict,
         a.district, a.province, a.postal_code, a.lat, a.lng
  into v_recipient, v_phone, v_line, v_subdistrict, v_district, v_province,
       v_postal, v_lat, v_lng
  from public.addresses a
  where a.id = p_address_id and a.user_id = v_uid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'address';
  end if;

  -- ── Payment-method structural rules (pre-pricing) ─────────────────────────
  if p_shop_mode = 'online'::public.shop_mode_t
     and p_payment_method <> 'promptpay_slip'::public.payment_method_t then
    raise exception 'ONLINE_REQUIRES_PREPAY' using errcode = 'P0001';
  end if;
  if v_is_cod and p_shop_mode <> 'delivery'::public.shop_mode_t then
    raise exception 'COD_NOT_ALLOWED' using errcode = 'P0001', detail = 'online_mode';
  end if;
  if v_is_cod and not v_cod_enabled then
    raise exception 'COD_NOT_ALLOWED' using errcode = 'P0001', detail = 'cod_disabled';
  end if;

  -- ── Lock every cart variant FOR UPDATE in id order (deadlock-free) ────────
  perform v.id
  from public.product_variants v
  where v.id in (select ci.variant_id from public.cart_items ci where ci.cart_id = v_cart_id)
  order by v.id
  for update;

  -- ── Per-line stock availability (available_qty = stock - reserved >= qty) ─
  select array_agg(ci.variant_id order by ci.variant_id)
  into v_oos
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart_id
    and v.available_qty < ci.qty;
  if v_oos is not null then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001',
      detail = array_to_string(v_oos, ',');
  end if;

  -- ── Subtotal from per-variant price ───────────────────────────────────────
  select coalesce(sum(v.price * ci.qty), 0)
  into v_subtotal
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart_id;

  -- ── Delivery fee per mode ─────────────────────────────────────────────────
  if p_shop_mode = 'delivery'::public.shop_mode_t then
    v_fee := case when v_subtotal >= v_free_threshold then 0 else v_delivery_fee end;
  else  -- online: flat 40, free at subtotal >= 500
    v_fee := case when v_subtotal >= 500 then 0 else 40 end;
  end if;

  -- ── Promo: lock the code row, validate, compute discount ──────────────────
  if p_promo_code is not null then
    select pc.id, pc.type, pc.value, pc.max_discount, pc.min_spend, pc.scope,
           pc.active, pc.active_from, pc.active_to, pc.total_limit, pc.per_user_limit
    into v_promo_id, v_promo_type, v_promo_value, v_promo_max, v_promo_min,
         v_promo_scope, v_promo_active, v_promo_from, v_promo_to,
         v_promo_tlimit, v_promo_ulimit
    from public.promo_codes pc
    where pc.shop_id = v_shop_id and pc.code = p_promo_code
    for update;
    if not found then
      raise exception 'PROMO_INVALID' using errcode = 'P0001', detail = 'not_found';
    end if;
    if not v_promo_active then
      raise exception 'PROMO_INVALID' using errcode = 'P0001', detail = 'inactive';
    end if;
    if v_promo_from is not null and now() < v_promo_from then
      raise exception 'PROMO_INVALID' using errcode = 'P0001', detail = 'not_started';
    end if;
    if v_promo_to is not null and now() > v_promo_to then
      raise exception 'PROMO_INVALID' using errcode = 'P0001', detail = 'expired';
    end if;
    if v_subtotal < v_promo_min then
      raise exception 'PROMO_MIN_SPEND' using errcode = 'P0001', detail = v_promo_min::text;
    end if;
    if v_promo_tlimit is not null then
      select count(*) into v_promo_used
      from public.promo_redemptions r
      where r.promo_code_id = v_promo_id and r.released_at is null;
      if v_promo_used >= v_promo_tlimit then
        raise exception 'PROMO_USAGE_EXCEEDED' using errcode = 'P0001';
      end if;
    end if;
    if v_promo_ulimit is not null then
      select count(*) into v_promo_used
      from public.promo_redemptions r
      where r.promo_code_id = v_promo_id and r.user_id = v_uid and r.released_at is null;
      if v_promo_used >= v_promo_ulimit then
        raise exception 'PROMO_PER_USER_EXCEEDED' using errcode = 'P0001';
      end if;
    end if;

    -- base the discount applies to
    v_promo_base := case when v_promo_scope = 'delivery'::public.promo_scope_t
                         then v_fee else v_subtotal end;
    if v_promo_type = 'percent'::public.promo_type_t then
      v_discount := (case v_promo_rounding
                       when 'ceil'  then ceil (v_promo_base::numeric * v_promo_value / 100)
                       when 'round' then round(v_promo_base::numeric * v_promo_value / 100)
                       else              floor(v_promo_base::numeric * v_promo_value / 100)
                     end)::int;
      if v_promo_max is not null then
        v_discount := least(v_discount, v_promo_max);
      end if;
    else  -- fixed_baht
      v_discount := v_promo_value;
      if v_promo_max is not null then
        v_discount := least(v_discount, v_promo_max);
      end if;
    end if;
    -- never discount more than the base it applies to, never negative
    v_discount := least(v_discount, v_promo_base);
    if v_discount < 0 then v_discount := 0; end if;
  end if;

  -- ── Total + COD cap (cap is against the final total) ──────────────────────
  v_total := v_subtotal + v_fee - v_discount;
  if v_is_cod and v_cod_cap is not null and v_total > v_cod_cap then
    raise exception 'COD_NOT_ALLOWED' using errcode = 'P0001', detail = 'over_cap';
  end if;

  -- ── Per-shop order_number: row-locked counter (create row if missing) ─────
  insert into public.order_number_seq (shop_id, next_val)
  values (v_shop_id, 1)
  on conflict (shop_id) do nothing;
  select next_val into v_seq
  from public.order_number_seq
  where shop_id = v_shop_id
  for update;
  update public.order_number_seq set next_val = next_val + 1 where shop_id = v_shop_id;
  v_order_number := 'OF' || lpad(v_seq::text, 5, '0');

  -- ── Create order (order_status/payment_status default; placed_at default) ─
  insert into public.orders (
    shop_id, customer_user_id, order_number, shop_mode, payment_method,
    subtotal, delivery_fee, discount_amount, total, promo_code_id, address_id,
    ship_recipient, ship_phone, ship_address_text, ship_lat, ship_lng,
    idempotency_key
  ) values (
    v_shop_id, v_uid, v_order_number, p_shop_mode, p_payment_method,
    v_subtotal, v_fee, v_discount, v_total, v_promo_id, p_address_id,
    v_recipient, v_phone,
    nullif(concat_ws(' ', v_line, v_subdistrict, v_district, v_province, v_postal), ''),
    v_lat, v_lng,
    p_idempotency_key::text
  )
  returning id into v_order_id;

  -- order lines: server-side price/name snapshots; never write generated line_total
  insert into public.order_items (
    order_id, product_id, variant_id, name_snapshot, size_snapshot, unit_price, qty
  )
  select v_order_id, p.id, v.id, p.name, v.size, v.price, ci.qty
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = v_cart_id;

  -- payment row: authoritative; AFTER trigger (0004) mirrors status → orders.payment_status
  insert into public.payments (order_id, method, status, amount)
  values (v_order_id, p_payment_method, 'awaiting_payment'::public.payment_status_t, v_total);

  -- placement event (clock_timestamp so a same-tx COD confirm sorts strictly after)
  insert into public.order_status_events (
    order_id, from_status, to_status, actor_user_id, actor_role, is_system, created_at
  ) values (
    v_order_id, null, 'placed'::public.order_status_t, v_uid,
    'customer'::public.role_t, false, clock_timestamp()
  );

  -- promo redemption (+ bump counter), serialized by the promo_codes row lock above
  if v_promo_id is not null then
    insert into public.promo_redemptions (promo_code_id, user_id, order_id, amount_discounted)
    values (v_promo_id, v_uid, v_order_id, v_discount);
    update public.promo_codes set total_redeemed = total_redeemed + 1 where id = v_promo_id;
  end if;

  -- ── Stock: reserve at placement; COD commits immediately ──────────────────
  for rec in
    select ci.variant_id, ci.qty
    from public.cart_items ci
    where ci.cart_id = v_cart_id
    order by ci.variant_id
  loop
    update public.product_variants
       set reserved_qty = reserved_qty + rec.qty
     where id = rec.variant_id;
    insert into public.stock_movements (
      variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id, created_at
    ) values (
      rec.variant_id, v_order_id, 0, rec.qty,
      'reserve_placed'::public.stock_reason_t, v_uid, clock_timestamp()
    );

    if v_is_cod then
      update public.product_variants
         set stock_qty    = stock_qty - rec.qty,
             reserved_qty = reserved_qty - rec.qty
       where id = rec.variant_id;
      insert into public.stock_movements (
        variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id, created_at
      ) values (
        rec.variant_id, v_order_id, -rec.qty, -rec.qty,
        'commit_confirmed'::public.stock_reason_t, v_uid, clock_timestamp()
      );
    end if;
  end loop;

  -- ── COD auto-confirm: placed → confirmed (system) ─────────────────────────
  if v_is_cod then
    update public.orders
       set order_status = 'confirmed'::public.order_status_t,
           confirmed_at = now()
     where id = v_order_id;
    insert into public.order_status_events (
      order_id, from_status, to_status, actor_user_id, actor_role, is_system, reason, created_at
    ) values (
      v_order_id, 'placed'::public.order_status_t, 'confirmed'::public.order_status_t,
      null, null, true, 'cod_auto_confirm', clock_timestamp()
    );
  end if;

  -- ── Clear the caller's cart (items only) ──────────────────────────────────
  delete from public.cart_items where cart_id = v_cart_id;

  -- ── Result (re-read so COD shows confirmed + mirrored payment_status) ─────
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'discount_amount', o.discount_amount,
    'total', o.total,
    'payment_method', o.payment_method,
    'shop_mode', o.shop_mode,
    'row_version', o.row_version)
  into v_result
  from public.orders o
  where o.id = v_order_id;

  return v_result;
end $$;

revoke execute on function
  public.place_order(uuid, public.shop_mode_t, public.payment_method_t, uuid, citext)
  from public;
grant execute on function
  public.place_order(uuid, public.shop_mode_t, public.payment_method_t, uuid, citext)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN: Payment slip upload
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.attach_payment_slip(
  p_order_id        uuid,
  p_storage_path    text,
  p_observed_amount int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order   public.orders;
  v_slip_id uuid;
begin
  -- auth.uid() required (works inside SECURITY DEFINER).
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- Customer-callable RPC: caller must be an active account. A pending or
  -- deactivated user must not be able to mutate order/payment state.
  if (select au.account_state
        from public.app_users au
       where au.id = auth.uid()) <> 'active'::public.account_state_t then
    raise exception 'ACCOUNT_INACTIVE' using errcode = 'P0001';
  end if;

  -- Caller-owned order only. Lock the row to serialise concurrent uploads /
  -- admin verification (the payment_slips partial-unique-on-active index makes
  -- two simultaneous "is_active" inserts collide otherwise).
  select * into v_order
  from public.orders
  where id = p_order_id
    and customer_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002',
      detail = 'order not found or not owned by caller';
  end if;

  -- Payment slips apply ONLY to prepay (promptpay_slip) orders. A COD order
  -- keeps payments.status='awaiting_payment' (cash owed) for its entire
  -- lifecycle while order_status auto-advances confirmed->...->out_for_delivery
  -- (terminal_at stays null), so it would otherwise pass both the terminal and
  -- payment_status gates and get illegally driven back to 'slip_uploaded',
  -- corrupting an order whose stock is already committed. Reject before any
  -- mutation. (Explicit enum cast required under empty search_path.)
  if v_order.payment_method <> 'promptpay_slip'::public.payment_method_t then
    raise exception 'VALIDATION' using errcode = 'P0001',
      detail = 'payment slips apply to prepay (promptpay_slip) orders only';
  end if;

  -- Terminal orders (cancelled / delivered / returned / delivery_failed) are closed.
  if v_order.terminal_at is not null then
    raise exception 'ORDER_TERMINAL' using errcode = 'P0001',
      detail = 'order is in a terminal state';
  end if;

  -- A slip may be (re)uploaded only while still awaiting payment or after a
  -- prior slip was rejected. Gate on payment_status: a freshly placed prepay
  -- order is order_status='placed' but payment_status='awaiting_payment', and a
  -- rejected slip is payment_status='rejected' (order_status='payment_rejected').
  if v_order.payment_status not in (
       'awaiting_payment'::public.payment_status_t,
       'rejected'::public.payment_status_t
     ) then
    raise exception 'NOT_AWAITING' using errcode = 'P0001',
      detail = 'order is not awaiting payment';
  end if;

  -- Retire any existing active slip (honours the partial unique index).
  update public.payment_slips
     set is_active = false
   where order_id = p_order_id
     and is_active;

  -- Insert the new active slip.
  insert into public.payment_slips (
    order_id, storage_path, uploaded_by, observed_amount, is_active
  ) values (
    p_order_id, p_storage_path, auth.uid(), p_observed_amount, true
  )
  returning id into v_slip_id;

  -- Advance the order. Setting payments.status mirrors into orders.payment_status
  -- via the 0004 AFTER trigger — do NOT set orders.payment_status manually.
  update public.orders
     set order_status = 'slip_uploaded'::public.order_status_t
   where id = p_order_id;

  update public.payments
     set status = 'slip_uploaded'::public.payment_status_t
   where order_id = p_order_id;

  return jsonb_build_object(
    'order_status',   'slip_uploaded',
    'payment_status', 'slip_uploaded',
    'slip_id',        v_slip_id
  );
end $$;

revoke execute on function public.attach_payment_slip(uuid, text, int) from public;
grant  execute on function public.attach_payment_slip(uuid, text, int) to authenticated;
