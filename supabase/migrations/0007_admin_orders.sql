-- 0007_admin_orders.sql
-- อู้ฟู่ (Oofoo) — admin order/payment RPCs: slip verification (claim/approve/
-- reject), order state machine (advance), and cancellation (release/restock +
-- refund). Closes the prepay loop (slip → verify → paid → confirmed + commit
-- stock). SECURITY DEFINER, search_path='', enums explicitly cast.
-- Uses public.admin_shop() / public.write_audit() from migration 0006.
-- Reminder: setting payments.status mirrors to orders.payment_status (0004 trigger).

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_slip: slip_uploaded → verifying (lock for this admin)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.claim_slip(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_ps public.payment_status_t;
begin
  select payment_status into v_ps
  from public.orders where id = p_order_id and shop_id = v_shop for update;
  if v_ps is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ps <> 'slip_uploaded'::public.payment_status_t then
    raise exception 'NOT_IN_SLIP_UPLOADED' using errcode = 'P0001';
  end if;
  update public.payments
     set status = 'verifying'::public.payment_status_t, locked_by = auth.uid(), locked_at = now()
   where order_id = p_order_id;
  update public.orders
     set order_status = 'payment_verifying'::public.order_status_t
   where id = p_order_id;
  insert into public.order_status_events (order_id, to_status, actor_user_id, actor_role, reason)
  values (p_order_id, 'payment_verifying'::public.order_status_t, auth.uid(), 'admin'::public.role_t, 'claim_slip');
  perform public.write_audit(v_shop, 'claim_slip', 'orders', p_order_id::text, 'verifying');
  return jsonb_build_object('order_id', p_order_id, 'payment_status', 'verifying');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- approve_slip: verifying → paid + confirmed, COMMIT the reserved stock
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.approve_slip(
  p_order_id uuid,
  p_observed_amount int default null,
  p_bank_ref text default null,
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

  -- Commit the stock reserved at place_order (lock variants deterministically).
  perform pv.id from public.product_variants pv
   where pv.id in (select variant_id from public.order_items where order_id = p_order_id and variant_id is not null)
   order by pv.id for update;
  for rec in
    select variant_id, sum(qty) as qty from public.order_items
     where order_id = p_order_id and variant_id is not null group by variant_id
  loop
    update public.product_variants
       set stock_qty = greatest(0, stock_qty - rec.qty),
           reserved_qty = greatest(0, reserved_qty - rec.qty)
     where id = rec.variant_id;
    insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
    values (rec.variant_id, p_order_id, -rec.qty, -rec.qty, 'commit_confirmed'::public.stock_reason_t, auth.uid());
  end loop;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- reject_slip: verifying → rejected, RELEASE the reservation
-- ─────────────────────────────────────────────────────────────────────────────
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
       set reserved_qty = greatest(0, reserved_qty - rec.qty)
     where id = rec.variant_id;
    insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
    values (rec.variant_id, p_order_id, 0, -rec.qty, 'release_payment_rejected'::public.stock_reason_t, auth.uid());
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

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_order: forward-only state machine (admin), validated by shop_mode
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.advance_order(
  p_order_id uuid,
  p_to_status public.order_status_t,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_mode public.shop_mode_t; v_from public.order_status_t; v_rv int;
  v_ok boolean; v_to text := p_to_status::text;
begin
  select shop_mode, order_status, row_version into v_mode, v_from, v_rv
  from public.orders where id = p_order_id and shop_id = v_shop for update;
  if v_from is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;

  if v_mode = 'delivery'::public.shop_mode_t then
    v_ok := (v_from::text = 'confirmed'         and v_to = 'preparing')
         or (v_from::text = 'preparing'         and v_to = 'assigned_to_rider')
         or (v_from::text = 'assigned_to_rider' and v_to = 'out_for_delivery')
         or (v_from::text = 'out_for_delivery'  and v_to = 'delivered');
  else  -- online (Flash); courier states normally arrive via apply_flash_webhook,
        -- but an admin may also push them through.
    v_ok := (v_from::text = 'confirmed'        and v_to = 'preparing')
         or (v_from::text = 'preparing'        and v_to = 'picked_up')
         or (v_from::text = 'picked_up'        and v_to = 'in_transit')
         or (v_from::text = 'in_transit'       and v_to = 'out_for_delivery')
         or (v_from::text = 'out_for_delivery' and v_to = 'delivered');
  end if;
  if not v_ok then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001',
      detail = v_from::text || ' → ' || v_to;
  end if;

  update public.orders set
    order_status = p_to_status,
    preparing_at        = case when v_to = 'preparing'        then now() else preparing_at end,
    shipped_at          = case when v_to = 'picked_up'        then now() else shipped_at end,
    picked_up_at        = case when v_to = 'picked_up'        then now() else picked_up_at end,
    out_for_delivery_at = case when v_to = 'out_for_delivery' then now() else out_for_delivery_at end,
    delivered_at        = case when v_to = 'delivered'        then now() else delivered_at end,
    terminal_at         = case when v_to = 'delivered'        then now() else terminal_at end,
    row_version = row_version + 1
  where id = p_order_id;
  insert into public.order_status_events (order_id, from_status, to_status, actor_user_id, actor_role, reason)
  values (p_order_id, v_from, p_to_status, auth.uid(), 'admin'::public.role_t, 'advance');
  perform public.write_audit(v_shop, 'advance_order', 'orders', p_order_id::text, v_from::text || '→' || v_to);
  return jsonb_build_object('order_id', p_order_id, 'order_status', v_to);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- cancel_order: customer (pre-fulfilment) or admin. Release-or-restock stock
-- (depending on whether it was committed) + refund(owed) if money was received.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason public.cancel_reason_t,
  p_note text default null,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid; v_customer uuid; v_status public.order_status_t; v_rv int;
  v_total int; v_funds boolean; v_committed boolean; v_is_admin boolean; rec record;
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

  -- Was the stock committed? (a commit_confirmed ledger row exists for this order)
  v_committed := exists (
    select 1 from public.stock_movements
    where order_id = p_order_id and reason = 'commit_confirmed'::public.stock_reason_t
  );

  perform pv.id from public.product_variants pv
   where pv.id in (select variant_id from public.order_items where order_id = p_order_id and variant_id is not null)
   order by pv.id for update;
  for rec in
    select variant_id, sum(qty) as qty from public.order_items
     where order_id = p_order_id and variant_id is not null group by variant_id
  loop
    if v_committed then
      update public.product_variants set stock_qty = stock_qty + rec.qty where id = rec.variant_id;
      insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (rec.variant_id, p_order_id, rec.qty, 0, 'restock_cancel'::public.stock_reason_t, auth.uid());
    else
      update public.product_variants set reserved_qty = greatest(0, reserved_qty - rec.qty) where id = rec.variant_id;
      insert into public.stock_movements (variant_id, order_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (rec.variant_id, p_order_id, 0, -rec.qty, 'release_cancel'::public.stock_reason_t, auth.uid());
    end if;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute privileges
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function
  public.claim_slip(uuid),
  public.approve_slip(uuid, int, text, int),
  public.reject_slip(uuid, public.slip_reject_t, text, int),
  public.advance_order(uuid, public.order_status_t, int),
  public.cancel_order(uuid, public.cancel_reason_t, text, int)
  from public;

grant execute on function
  public.claim_slip(uuid),
  public.approve_slip(uuid, int, text, int),
  public.reject_slip(uuid, public.slip_reject_t, text, int),
  public.advance_order(uuid, public.order_status_t, int),
  public.cancel_order(uuid, public.cancel_reason_t, text, int)
  to authenticated;
