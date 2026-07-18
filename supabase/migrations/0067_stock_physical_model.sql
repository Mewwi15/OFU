-- 0067_stock_physical_model.sql
-- อู้ฟู่ (Oofoo) — "sell by physical stock": stock_qty is the single source of
-- truth and reserved_qty is forced to 0.
--
-- Old model: online placement RESERVED stock (reserved_qty += qty) and only the
-- slip approval COMMITTED it (stock_qty -= qty). New model: placement (online
-- AND COD) decrements stock_qty immediately; approval moves no stock; a
-- non-terminal cancel / rejected slip / expiry restocks it once. Because
-- available_qty is GREATEST(0, stock_qty - reserved_qty) and reserved_qty is now
-- always 0, available_qty == stock_qty, so catalog / product sold-out logic is
-- unchanged (regression-tested, not modified).
--
-- This migration is ONE transaction:
--   1. lock product_variants (no concurrent stock writes during conversion),
--   2. PREFLIGHT: reserved_qty must equal the hold implied by open unpaid
--      prepay orders, and stock_qty >= reserved_qty — else ABORT (no
--      greatest(0,) papering over a wrong number),
--   3. convert each open reservation into a physical decrement (order-bound
--      ledger row) then aggregate `stock_qty -= reserved_qty, reserved_qty = 0`,
--   4. add CHECK (reserved_qty = 0),
--   5. replace place_order (from 0057), approve_slip / reject_slip /
--      cancel_order (from 0007) and expire_stale_orders (from 0064) — each
--      diffed against its LATEST source so ONLY the stock/reserved logic (and
--      place_order's OUT_OF_STOCK detail, M10) changed; money / promo /
--      sequence logic is byte-identical,
--   6. VERIFY reserved all 0 and no negative stock before commit.
--
-- HARD STOP: do not apply to prod without CEO approval (run the preflight report
-- first). Rollback = a migration restoring the old function bodies and undoing
-- the conversion from the ledger.
--
-- Wrapped in an explicit begin/commit: the Supabase migration runner executes
-- statements in autocommit, but this must be ONE atomic transaction (the LOCK,
-- the preflight abort, the conversion, the CHECK and the verify all stand or
-- fall together). The new enum values are already committed by 0066, so using
-- them here is fine.
begin;

-- Freeze the whole write path so an order cannot change (e.g. claim_slip moving
-- it to payment_verifying) between the preflight and the conversion. Locks are
-- taken orders → order_items → product_variants — the SAME order the RPCs take
-- their row locks in (place/cancel/reject/expire touch the order row, then
-- variants by id) — so this migration and any straggler RPC can't deadlock.
-- EXCLUSIVE blocks all writes and SELECT ... FOR UPDATE while still allowing
-- plain reads (catalog browsing); the migration runs once, in a maintenance
-- window, so the brief freeze is acceptable.
lock table public.orders            in exclusive mode;
lock table public.order_items       in exclusive mode;
lock table public.product_variants  in exclusive mode;

-- ── 1+2. Preflight / reconcile ───────────────────────────────────────────────
-- The set of orders still HOLDING reserved stock, defined from the LEDGER (not a
-- fragile status list): an order holds reserved iff it has a reserve_placed
-- movement and NO commit_confirmed / release_cancel / release_payment_rejected /
-- release_expiry movement. This is exactly what cancel/reject/expire release,
-- and it spans every pre-confirmation state — placed, slip_uploaded AND
-- payment_verifying (a slip mid-review) — which the old order_status='placed'
-- filter wrongly dropped. COD orders have reserve_placed + commit_confirmed, so
-- they're correctly excluded. The SAME set drives preflight and conversion.
create temp table _held on commit drop as
select oi.variant_id, oi.order_id, sum(oi.qty)::int as qty
from public.order_items oi
where oi.variant_id is not null
  and exists (
    select 1 from public.stock_movements sm
    where sm.order_id = oi.order_id and sm.reason = 'reserve_placed'::public.stock_reason_t)
  and not exists (
    select 1 from public.stock_movements sm
    where sm.order_id = oi.order_id
      and sm.reason in ('commit_confirmed'::public.stock_reason_t,
                        'release_cancel'::public.stock_reason_t,
                        'release_payment_rejected'::public.stock_reason_t,
                        'release_expiry'::public.stock_reason_t))
group by oi.variant_id, oi.order_id;

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from public.product_variants v
  left join (select variant_id, sum(qty)::int as held from _held group by variant_id) h
    on h.variant_id = v.id
  where v.reserved_qty <> coalesce(h.held, 0)
     or v.stock_qty < v.reserved_qty;
  if v_bad > 0 then
    raise exception
      'stock reconcile preflight FAILED: % variant(s) where reserved_qty <> held (reserve_placed not yet committed/released), or stock_qty < reserved_qty. Aborting — investigate before converting (no greatest(0,) cover-up).',
      v_bad using errcode = 'P0001';
  end if;
end $$;

-- ── 3. Convert reservations → physical decrement ─────────────────────────────
-- One order-bound ledger row per held reservation line, so the physical
-- decrement is auditable back to the order that held it. delta_reserved = -qty
-- (removes the original reserve_placed hold), delta_stock = -qty (takes it off
-- the shelf) — net reserved for the variant returns to 0.
insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
select variant_id, order_id, -qty, -qty, 'online_place'::public.stock_reason_t, null
from _held;

-- Aggregate flip: physical stock absorbs the reservation; reserved → 0.
-- reserved_qty was preflight-verified to equal the held sum. Example: 3/2 → 1/0,
-- 6/4 → 2/0 (available_qty unchanged).
update public.product_variants
   set stock_qty = stock_qty - reserved_qty,
       reserved_qty = 0
 where reserved_qty <> 0;

-- ── 4. Enforce the invariant going forward ───────────────────────────────────
alter table public.product_variants
  add constraint product_variants_reserved_zero check (reserved_qty = 0);

-- ── 5. Replace the RPCs (only stock/reserved logic changes; see header) ──────

-- place_order — from 0057. Changes: (a) OUT_OF_STOCK detail is now versioned
-- JSON with per-item shortage (M10); (b) placement decrements stock_qty for
-- every order (online + COD), reserved stays 0, one 'online_place' ledger row.
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
  v_online_fee     int;
  v_online_threshold int;
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
  v_shortages jsonb;
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
  v_seq_name     text;
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
  select s.delivery_fee, s.free_delivery_threshold, s.cod_enabled, s.cod_cap, s.promo_rounding,
         s.online_fee, s.online_free_threshold
  into v_delivery_fee, v_free_threshold, v_cod_enabled, v_cod_cap, v_promo_rounding,
       v_online_fee, v_online_threshold
  from public.shop_settings s
  where s.shop_id = v_shop_id;
  v_delivery_fee   := coalesce(v_delivery_fee, 40);
  v_online_fee     := coalesce(v_online_fee, 150);
  -- v_online_threshold stays NULL when unset -> no free-shipping tier.
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

  -- ── Per-line stock availability (available_qty = stock_qty; reserved = 0) ─
  -- M10: gather ALL shortages (not just the first) with product name/size, and
  -- raise OUT_OF_STOCK with a versioned JSON detail the client can turn into a
  -- friendly per-item message. Variants are locked above.
  select coalesce(jsonb_agg(jsonb_build_object(
             'variant_id', ci.variant_id,
             'name',          p.name,
             'size',          v.size,
             'requested_qty', ci.qty,
             'available_qty', v.available_qty)
           order by ci.variant_id), '[]'::jsonb)
  into v_shortages
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = v_cart_id
    and v.available_qty < ci.qty;
  if v_shortages <> '[]'::jsonb then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0001',
      detail = jsonb_build_object('code', 'OUT_OF_STOCK', 'version', 1, 'items', v_shortages)::text;
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
  else  -- online: parcel fee from shop_settings; NULL threshold = no free tier (0049)
    v_fee := case when v_online_threshold is not null and v_subtotal >= v_online_threshold
                  then 0 else v_online_fee end;
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

  -- ── Per-shop order_number: a real sequence, not a locked counter row ──────
  -- (0057) nextval() advances without taking a row lock that would otherwise
  -- be held through every remaining insert/update below until commit.
  v_seq_name := 'order_seq_' || replace(v_shop_id::text, '-', '_');
  execute format('create sequence if not exists public.%I', v_seq_name);
  execute format('select nextval(%L)', 'public.' || v_seq_name) into v_seq;
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

  -- ── Stock: physical decrement at placement (online AND COD); reserved stays
  --    0. A non-terminal cancel / rejected slip / expiry restocks it once. ───
  for rec in
    select ci.variant_id, ci.qty
    from public.cart_items ci
    where ci.cart_id = v_cart_id
    order by ci.variant_id
  loop
    update public.product_variants
       set stock_qty = stock_qty - rec.qty
     where id = rec.variant_id;
    insert into public.stock_movements (
      variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id, created_at
    ) values (
      rec.variant_id, v_order_id, -rec.qty, 0,
      'online_place'::public.stock_reason_t, v_uid, clock_timestamp()
    );
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

-- approve_slip — from 0007. Change: stock was already decremented at placement,
-- so approval moves NO stock (the whole commit loop + variant lock are removed).
create or replace function public.approve_slip(
  p_order_id uuid,
  p_observed_amount int default null,
  p_bank_ref text default null,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_ps public.payment_status_t; v_rv int;
begin
  select payment_status, row_version into v_ps, v_rv
  from public.orders where id = p_order_id and shop_id = v_shop for update;
  if v_ps is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ps <> 'verifying'::public.payment_status_t then
    raise exception 'NOT_IN_VERIFYING' using errcode = 'P0001';
  end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;

  -- No stock movement: physical stock was taken at placement (online_place).

  update public.payments
     set status = 'paid'::public.payment_status_t, paid_at = now(), funds_received = true
   where order_id = p_order_id;
  update public.orders
     set order_status = 'confirmed'::public.order_status_t, confirmed_at = now(), row_version = row_version + 1
   where id = p_order_id;
  update public.payment_slips
     set verified_by = auth.uid(), verified_at = now(),
         bank_ref = coalesce(p_bank_ref, bank_ref),
         observed_amount = coalesce(p_observed_amount, observed_amount)
   where order_id = p_order_id and is_active;
  insert into public.order_status_events (order_id, from_status, to_status, actor_user_id, actor_role, reason)
  values (p_order_id, 'payment_verifying'::public.order_status_t, 'confirmed'::public.order_status_t, auth.uid(), 'admin'::public.role_t, 'approve_slip');
  perform public.write_audit(v_shop, 'approve_slip', 'orders', p_order_id::text, 'paid + confirmed');
  return jsonb_build_object('order_id', p_order_id, 'order_status', 'confirmed', 'payment_status', 'paid');
end $$;

-- reject_slip — from 0007. Change: RESTOCK the physical stock taken at placement
-- (stock_qty += qty, online_reject_restock) instead of releasing a reservation.
create or replace function public.reject_slip(
  p_order_id uuid,
  p_reason public.slip_reject_t,
  p_note text default null,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_ps public.payment_status_t; v_rv int; rec record;
begin
  select payment_status, row_version into v_ps, v_rv
  from public.orders where id = p_order_id and shop_id = v_shop for update;
  if v_ps is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ps <> 'verifying'::public.payment_status_t then
    raise exception 'NOT_IN_VERIFYING' using errcode = 'P0001';
  end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;

  perform pv.id from public.product_variants pv
   where pv.id in (select variant_id from public.order_items where order_id = p_order_id and variant_id is not null)
   order by pv.id for update;
  for rec in
    select variant_id, sum(qty) as qty from public.order_items
     where order_id = p_order_id and variant_id is not null group by variant_id
  loop
    update public.product_variants
       set stock_qty = stock_qty + rec.qty
     where id = rec.variant_id;
    insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
    values (rec.variant_id, p_order_id, rec.qty, 0, 'online_reject_restock'::public.stock_reason_t, auth.uid());
  end loop;

  update public.payments set status = 'rejected'::public.payment_status_t where order_id = p_order_id;
  update public.orders
     set order_status = 'payment_rejected'::public.order_status_t, row_version = row_version + 1
   where id = p_order_id;
  update public.payment_slips
     set reject_reason = p_reason, reject_note = p_note, verified_by = auth.uid(), verified_at = now()
   where order_id = p_order_id and is_active;
  insert into public.order_status_events (order_id, from_status, to_status, actor_user_id, actor_role, reason)
  values (p_order_id, 'payment_verifying'::public.order_status_t, 'payment_rejected'::public.order_status_t, auth.uid(), 'admin'::public.role_t, 'reject_slip:' || p_reason);
  perform public.write_audit(v_shop, 'reject_slip', 'orders', p_order_id::text, 'rejected:' || p_reason);
  return jsonb_build_object('order_id', p_order_id, 'order_status', 'payment_rejected');
end $$;

-- cancel_order — from 0007. Change: every placed order decremented stock at
-- placement, so cancellation always RESTOCKS (stock_qty += qty,
-- online_cancel_restock). The old reserved-vs-committed branch is gone; the
-- terminal-status guards above still make the restock happen at most once.
create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason public.cancel_reason_t,
  p_note text default null,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid; v_customer uuid; v_status public.order_status_t; v_rv int;
  v_total int; v_funds boolean; v_is_admin boolean; rec record;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  -- Lock the order only (FOR UPDATE can't be applied to the nullable side of a
  -- left join), then read the payment row separately.
  select o.shop_id, o.customer_user_id, o.order_status, o.row_version, o.total
  into v_shop, v_customer, v_status, v_rv, v_total
  from public.orders o where o.id = p_order_id for update;
  if v_shop is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select coalesce(funds_received, false) into v_funds
  from public.payments where order_id = p_order_id;
  v_funds := coalesce(v_funds, false);

  v_is_admin := public.is_admin_of(v_shop);
  if not v_is_admin and v_customer <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_status::text in ('delivered','cancelled','payment_rejected','returned','delivery_failed') then
    raise exception 'ALREADY_TERMINAL' using errcode = 'P0001';
  end if;
  -- Customers may only cancel before it is out for delivery.
  if not v_is_admin and v_status::text in ('assigned_to_rider','out_for_delivery','picked_up','in_transit') then
    raise exception 'FORBIDDEN' using errcode = 'P0001', detail = 'too late to cancel';
  end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;

  perform pv.id from public.product_variants pv
   where pv.id in (select variant_id from public.order_items where order_id = p_order_id and variant_id is not null)
   order by pv.id for update;
  for rec in
    select variant_id, sum(qty) as qty from public.order_items
     where order_id = p_order_id and variant_id is not null group by variant_id
  loop
    update public.product_variants set stock_qty = stock_qty + rec.qty where id = rec.variant_id;
    insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
    values (rec.variant_id, p_order_id, rec.qty, 0, 'online_cancel_restock'::public.stock_reason_t, auth.uid());
  end loop;

  -- Release any active promo redemption so the code count frees up.
  update public.promo_redemptions set released_at = now()
   where order_id = p_order_id and released_at is null;

  update public.orders set
    order_status = 'cancelled'::public.order_status_t,
    cancel_reason = p_reason, cancel_note = p_note,
    terminal_at = now(), row_version = row_version + 1
  where id = p_order_id;
  insert into public.order_status_events (order_id, from_status, to_status, actor_user_id, actor_role, reason)
  values (p_order_id, v_status, 'cancelled'::public.order_status_t, auth.uid(),
          (case when v_is_admin then 'admin' else 'customer' end)::public.role_t, 'cancel:' || p_reason);

  -- Refund only if money was actually received (paid). COD never-collected → none.
  if v_funds then
    insert into public.refunds (order_id, shop_id, amount, reason, created_by)
    values (p_order_id, v_shop, v_total, 'cancelled'::public.refund_reason_t, auth.uid())
    on conflict do nothing;
  end if;

  if v_is_admin then
    perform public.write_audit(v_shop, 'cancel_order', 'orders', p_order_id::text, 'cancelled:' || p_reason);
  end if;
  return jsonb_build_object('order_id', p_order_id, 'order_status', 'cancelled', 'refund_owed', v_funds);
end $$;

-- expire_stale_orders — from 0064. Change: RESTOCK the physical stock taken at
-- placement (stock_qty += qty, online_expiry_restock) instead of releasing a
-- reservation. Everything else (per-shop window, SKIP LOCKED, re-read, guards,
-- promo release, status event) is byte-identical.
create or replace function public.expire_stale_orders(
  p_before timestamptz default null,
  p_limit  int         default 500
) returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_expired   int := 0;
  v_remaining int := p_limit;
  v_cutoff    timestamptz;
  v_from      public.order_status_t;
  shop        record;
  rec         record;
  r           record;
begin
  for shop in
    select s.id as shop_id, ss.payment_window_min
    from public.shops s
    left join public.shop_settings ss on ss.shop_id = s.id
    order by s.id
  loop
    exit when v_remaining <= 0;

    if p_before is null and shop.payment_window_min is null then
      raise warning
        'expire_stale_orders: shop % has no shop_settings row (no payment_window_min); skipped',
        shop.shop_id;
      continue;
    end if;

    v_cutoff := coalesce(p_before, now() - make_interval(mins => shop.payment_window_min));

    for rec in
      select o.id
      from public.orders o
      where o.shop_id        = shop.shop_id
        and o.order_status   = 'placed'::public.order_status_t
        and o.payment_status = 'awaiting_payment'::public.payment_status_t
        and o.payment_method = 'promptpay_slip'::public.payment_method_t
        and o.terminal_at is null
        and o.placed_at < v_cutoff
      order by o.placed_at
      limit v_remaining
      for update skip locked
    loop
      select o.order_status into v_from
      from public.orders o
      where o.id = rec.id
        and o.order_status   = 'placed'::public.order_status_t
        and o.payment_status = 'awaiting_payment'::public.payment_status_t
        and o.payment_method = 'promptpay_slip'::public.payment_method_t
        and o.terminal_at is null
        and o.placed_at < v_cutoff;
      if not found then
        continue;  -- the other side won; it decides the outcome, not us
      end if;

      -- Lock the variants in id order — the same order place_order and
      -- cancel_order use, so these three can never deadlock against each other.
      perform pv.id
      from public.product_variants pv
      where pv.id in (
        select oi.variant_id from public.order_items oi
        where oi.order_id = rec.id and oi.variant_id is not null
      )
      order by pv.id
      for update;

      for r in
        select oi.variant_id, sum(oi.qty) as qty
        from public.order_items oi
        where oi.order_id = rec.id and oi.variant_id is not null
        group by oi.variant_id
      loop
        -- Restock: the physical stock taken at placement goes back on the shelf.
        update public.product_variants
           set stock_qty = stock_qty + r.qty
         where id = r.variant_id;
        insert into public.stock_movements (
          variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id
        ) values (
          r.variant_id, rec.id, r.qty, 0,
          'online_expiry_restock'::public.stock_reason_t, null  -- no actor: this is the system
        );
      end loop;

      -- Free the promo back up, exactly as cancel_order does.
      update public.promo_redemptions
         set released_at = now()
       where order_id = rec.id
         and released_at is null;

      update public.orders
         set order_status = 'cancelled'::public.order_status_t,
             cancel_reason = 'payment_timeout'::public.cancel_reason_t,
             cancel_note   = 'expired automatically: no payment slip within the payment window',
             terminal_at   = now(),
             row_version   = row_version + 1
       where id = rec.id;

      insert into public.order_status_events (
        order_id, from_status, to_status, actor_user_id, actor_role, is_system, reason
      ) values (
        rec.id, v_from, 'cancelled'::public.order_status_t, null, null, true,
        'cancel:payment_timeout'
      );

      v_expired   := v_expired + 1;
      v_remaining := v_remaining - 1;
      exit when v_remaining <= 0;
    end loop;
  end loop;

  return v_expired;
end
$fn$;

-- ── 6. Verify before commit ──────────────────────────────────────────────────
do $$
declare v_bad int;
begin
  select count(*) into v_bad
  from public.product_variants
  where reserved_qty <> 0 or stock_qty < 0;
  if v_bad > 0 then
    raise exception 'post-conversion verify FAILED: % variant(s) with reserved_qty<>0 or stock_qty<0', v_bad
      using errcode = 'P0001';
  end if;
end $$;

commit;
