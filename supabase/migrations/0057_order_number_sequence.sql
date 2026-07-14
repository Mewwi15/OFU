-- Fix: order numbering was a row-locked counter (`order_number_seq`, `for
-- update` + separate `update`). Postgres holds a `for update`/`update` row
-- lock until the ENCLOSING TRANSACTION commits — for place_order that's the
-- whole function — so this one lock, taken by every single checkout
-- regardless of cart contents, serialized nearly the entire order-creation
-- write path (orders/order_items/payments/order_status_events/promo
-- redemption/stock movements/cart clear) store-wide. Under a synchronized
-- burst of checkouts (a promo, a busy evening) this turns into a growing
-- queue: throughput caps at roughly 1/(critical-section time), independent
-- of how many DB connections or how fast Postgres otherwise is.
--
-- Fix: a real Postgres SEQUENCE. `nextval()` is specifically designed to
-- NOT participate in normal MVCC/row locking — the counter advances
-- immediately and is visible to other sessions regardless of whether the
-- calling transaction ever commits, so it can never block or collide the
-- way a plain locked-row counter can. (An earlier idea — take a manual
-- `pg_advisory_lock`, increment, then release it immediately instead of
-- waiting for commit — was considered and rejected: releasing the advisory
-- lock early does NOT make the still-uncommitted counter update visible to
-- the next waiter under READ COMMITTED, so two concurrent callers could
-- both read the same "next" value and mint a duplicate order number. Only
-- a real sequence has the right visibility semantics for this.)
--
-- One sequence per shop (matching order_number_seq's per-shop design;
-- created lazily in place_order via `create sequence if not exists` the
-- first time an order is placed for that shop — cheap after the first call,
-- and avoids needing a trigger on shop creation for a single-shop app).
-- Gaps become possible if a transaction aborts after claiming a number —
-- normal, accepted behavior for customer order numbers (this is NOT the
-- gapless tax-invoice counter; the shop is not VAT-registered, and POS's
-- separate `pos_counters` is untouched by this migration).
--
-- Backfill: seed each existing shop's new sequence to continue exactly
-- where its old `order_number_seq.next_val` left off, so no already-issued
-- order number is ever reissued. `order_number_seq` itself is left in place
-- (unused after this migration, not dropped) — a live prod table with no
-- other purpose is a safer thing to leave inert than to drop in the same
-- migration as a functional change.
do $$
declare
  rec record;
  v_seq_name text;
begin
  for rec in select shop_id, next_val from public.order_number_seq loop
    v_seq_name := 'order_seq_' || replace(rec.shop_id::text, '-', '_');
    execute format('create sequence if not exists public.%I', v_seq_name);
    -- setval(..., n, false) => the NEXT nextval() returns exactly n, matching
    -- next_val's old meaning ("the next number to be issued").
    execute format('select setval(%L, %s, false)', 'public.' || v_seq_name, rec.next_val);
  end loop;
end $$;

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
