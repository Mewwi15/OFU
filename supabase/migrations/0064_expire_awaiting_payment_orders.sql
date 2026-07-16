-- ─────────────────────────────────────────────────────────────────────────────
-- 0064 — expire stale awaiting-payment orders and give their stock back
--
-- A prepay order reserves its stock the moment it is placed (place_order:
-- reserved_qty += qty, reason 'reserve_placed') and only commits it when the
-- slip is approved. So a customer who reaches the PromptPay QR and walks away
-- leaves an order sitting in placed/awaiting_payment holding stock that nobody
-- can buy — forever. Nothing in the system ever released it. This closes that:
-- past the payment window the order is cancelled as 'payment_timeout' and its
-- reservation is handed back to the shelf.
--
-- THE WINDOW IS THE OWNER'S, per shop: shop_settings.payment_window_min. It is
-- read at run time and never copied into this file. A constant here would be a
-- second source of truth for a number the owner can already change in the
-- admin — they would move it, the cron would keep cancelling on the old clock,
-- and nothing on screen would explain why orders died early.
--
-- WHY NOT cancel_order: it opens with `if auth.uid() is null then raise
-- UNAUTHENTICATED` (0007_admin_orders.sql). A pg_cron job has no auth.uid(), so
-- it could never call it. The expiry path below is therefore internal, and is a
-- deliberate mirror of cancel_order's not-yet-committed branch.
--
-- SCOPE — this touches exactly one shape of order:
--   order_status   = 'placed'
--   payment_status = 'awaiting_payment'
--   payment_method = 'promptpay_slip'
-- and nothing else. COD is excluded BY DESIGN, not by accident: a COD order
-- also sits at payment_status='awaiting_payment' (cash is owed until the rider
-- collects it) for its entire life, so filtering on payment_status alone would
-- cancel live COD orders and restock goods already on their way.
--
-- Today COD is excluded twice over: place_order commits COD stock immediately
-- and lands it on order_status='confirmed', so 'placed' alone would miss it.
-- The payment_method predicate is therefore defence in depth rather than the
-- last line — and it is kept precisely because that first line is an accident
-- of the current COD flow. If COD ever starts life at 'placed', this filter is
-- what stops that day from cancelling every outstanding COD order.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. pg_cron ───────────────────────────────────────────────────────────────
-- Fail loudly rather than apply a migration whose job never runs: a silently
-- unscheduled expiry looks identical to a working one until stock quietly rots.
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise exception
      E'pg_cron is not available on this instance.\n'
      '  RUNBOOK: enable it in the Supabase Dashboard →\n'
      '    Database → Extensions → search "pg_cron" → enable,\n'
      '  then re-run `supabase db push`.';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute 'create extension pg_cron';
    exception
      when insufficient_privilege or feature_not_supported then
        raise exception
          E'pg_cron exists but this role may not enable it from SQL.\n'
          '  RUNBOOK: enable it in the Supabase Dashboard →\n'
          '    Database → Extensions → search "pg_cron" → enable,\n'
          '  then re-run `supabase db push`. (This migration is safe to re-run.)';
    end;
  end if;
end
$do$;

-- ── 2. Partial index ─────────────────────────────────────────────────────────
-- The job runs every 5 minutes forever, so its scan must never become a seq
-- scan over a growing orders table. Predicate mirrors the function's filter
-- exactly.
--
-- shop_id LEADS, and that is the whole index strategy: the payment window is
-- per shop, so there is no single global cutoff to range-scan on any more.
-- Each shop is swept with its own cutoff — `shop_id = X and placed_at < cutoff_X`
-- — which is an equality on the leading column plus a range on the second, and
-- returns already in placed_at order for the LIMIT. A cutoff can never live in
-- the predicate itself: index predicates must be IMMUTABLE, and now() is not.
--
-- Dropped first rather than `if not exists`-ed: this index shipped in an
-- earlier revision of THIS migration as (placed_at), and `create index if not
-- exists` would silently keep that older shape on any database where the WIP
-- was already applied.
drop index if exists public.orders_awaiting_payment_expiry_idx;
create index if not exists orders_awaiting_payment_expiry_idx
  on public.orders (shop_id, placed_at)
  where order_status = 'placed'::public.order_status_t
    and payment_status = 'awaiting_payment'::public.payment_status_t
    and payment_method = 'promptpay_slip'::public.payment_method_t;

-- ── 3. The expiry path ───────────────────────────────────────────────────────
-- p_before defaults to NULL, meaning "ask each shop how long its window is".
-- A literal default here (the previous `now() - interval '30 minutes'`) would
-- be a second source of truth for a number the owner already controls in
-- shop_settings.payment_window_min — the owner would change the setting and the
-- cron would keep cancelling on the old clock, with nothing to show why. That
-- is the same bug as M1, one layer down. Pass p_before explicitly to override
-- the window (tests need a deterministic cutoff); leave it NULL in production.
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
  v_committed boolean;
  shop        record;
  rec         record;
  r           record;
begin
  -- One sweep per shop, because each shop's cutoff is its own. shops is tiny,
  -- and every sweep is an index range scan (shop_id, placed_at).
  for shop in
    select s.id as shop_id, ss.payment_window_min
    from public.shops s
    left join public.shop_settings ss on ss.shop_id = s.id
    order by s.id
  loop
    exit when v_remaining <= 0;

    -- No settings row → no window → we do not get to guess. Defaulting to a
    -- hardcoded 30 here would smuggle the magic number back in; cancelling
    -- paid-for orders on an invented clock is worse than not cancelling.
    if p_before is null and shop.payment_window_min is null then
      raise warning
        'expire_stale_orders: shop % has no shop_settings row (no payment_window_min); skipped',
        shop.shop_id;
      continue;
    end if;

    v_cutoff := coalesce(p_before, now() - make_interval(mins => shop.payment_window_min));

    -- SKIP LOCKED: a row another transaction is already holding (an
    -- attach_payment_slip in flight, or an overlapping run of this job) is left
    -- alone rather than waited on. The next tick picks it up if it still counts.
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
      -- Re-read under the lock. Postgres re-checks the predicate after acquiring
      -- a lock on a concurrently-updated row, but this states the requirement
      -- outright instead of resting on that: if the customer's slip landed while
      -- we queued for the row, this order is no longer ours to cancel.
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

      -- Defensive: an order whose stock was already committed must never have its
      -- reservation "released" — that would invent inventory. It should be
      -- unreachable here (a commit moves payment_status off awaiting_payment), so
      -- skip rather than guess, and leave it visible for a human.
      select exists (
        select 1 from public.stock_movements sm
        where sm.order_id = rec.id
          and sm.reason = 'commit_confirmed'::public.stock_reason_t
      ) into v_committed;
      if v_committed then
        raise warning 'expire_stale_orders: order % has committed stock; skipped', rec.id;
        continue;
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
        update public.product_variants
           set reserved_qty = greatest(0, reserved_qty - r.qty)
         where id = r.variant_id;

        -- Ledger row: delta_reserved is negative, stock is untouched (it was
        -- never taken off the shelf — only held).
        insert into public.stock_movements (
          variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id
        ) values (
          r.variant_id, rec.id, 0, -r.qty,
          'release_expiry'::public.stock_reason_t, null  -- no actor: this is the system
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

      -- is_system = true, no actor: role_t has no 'system' member, and this is
      -- what that column is for.
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

comment on function public.expire_stale_orders(timestamptz, int) is
  'Cancels prepay orders left unpaid past each shop''s '
  'shop_settings.payment_window_min and releases their reserved stock (reason '
  'release_expiry). Pass p_before to override the window with a fixed cutoff '
  '(tests); leave NULL in production so the owner''s setting is the only clock. '
  'Internal/cron only — never exposed to clients. Never touches COD, '
  'slip_uploaded/verifying, paid or terminal orders.';

-- ── 4. Privileges ────────────────────────────────────────────────────────────
-- No customer may ever cancel other people's orders wholesale. EXECUTE is
-- granted to PUBLIC by default, so revoke first, then hand it back to
-- service_role only (ops/admin + the test harness). The cron job runs as the
-- function owner and does not need a grant.
revoke all on function public.expire_stale_orders(timestamptz, int) from public;
revoke all on function public.expire_stale_orders(timestamptz, int) from anon;
revoke all on function public.expire_stale_orders(timestamptz, int) from authenticated;
grant execute on function public.expire_stale_orders(timestamptz, int) to service_role;

-- ── 5. Schedule ──────────────────────────────────────────────────────────────
-- Fixed name + unschedule-then-schedule so re-running this migration replaces
-- the job instead of stacking duplicates (or failing on the second apply).
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'expire-stale-orders') then
    perform cron.unschedule('expire-stale-orders');
  end if;
  perform cron.schedule(
    'expire-stale-orders',
    '*/5 * * * *',
    $job$select public.expire_stale_orders();$job$
  );
end
$do$;
