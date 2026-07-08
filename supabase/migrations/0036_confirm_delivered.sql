-- 0036_confirm_delivered.sql
-- อู้ฟู่ (Oofoo) — the CUSTOMER confirms receipt of their own order.
--
-- Backs the app's "ได้รับสินค้าแล้ว / ฉันได้รับพัสดุแล้ว" buttons, which until
-- now only flipped local state (the DB stayed out_for_delivery and the screen
-- reverted on reload). Legal only from out_for_delivery → delivered, own order
-- only. COD: receiving the goods means cash changed hands → mark the payment
-- paid + funds_received (mirrors to orders.payment_status via the 0004 trigger).
-- SECURITY DEFINER, search_path=''. Keyed by order_number for the client,
-- mirroring submit_rating (0008).

create or replace function public.confirm_delivered(
  p_order_number text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_from public.order_status_t;
  v_method public.payment_method_t;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select id, order_status, payment_method into v_id, v_from, v_method
  from public.orders
  where order_number = p_order_number and customer_user_id = auth.uid()
  for update;
  if v_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_from::text <> 'out_for_delivery' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001',
      detail = v_from::text || ' → delivered';
  end if;

  update public.orders set
    order_status = 'delivered'::public.order_status_t,
    delivered_at = now(),
    terminal_at  = now(),
    row_version  = row_version + 1
  where id = v_id;

  if v_method = 'cod'::public.payment_method_t then
    update public.payments
       set status = 'paid'::public.payment_status_t, paid_at = now(), funds_received = true
     where order_id = v_id;
  end if;

  insert into public.order_status_events (order_id, from_status, to_status, actor_user_id, actor_role, reason)
  values (v_id, v_from, 'delivered'::public.order_status_t, auth.uid(), 'customer'::public.role_t, 'customer_confirmed');

  return jsonb_build_object('order_id', v_id, 'order_status', 'delivered');
end $$;

revoke execute on function public.confirm_delivered(text) from public;
grant execute on function public.confirm_delivered(text) to authenticated;
