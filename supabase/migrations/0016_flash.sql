-- 0016_flash.sql
-- อู้ฟู่ (Oofoo) — Flash Express integration (backend, code-ready).
--   record_flash_shipment : store the Flash tracking no (pno) on the order's
--                           parcel_shipments row (called by create-flash-shipment fn).
--   apply_flash_state     : map a Flash tracking state (1–9) → order_status +
--                           stamp parcel timestamps (called by flash-webhook fn).
--                           Updating orders.order_status re-uses notify_order_status
--                           (0011) so each Flash state change notifies the customer.
--   dispatch_flash trigger: when an ONLINE order is confirmed, pg_net-invoke
--                           create-flash-shipment (env-portable; no-ops until the
--                           app.functions_url / app.service_role_key settings exist).
-- Flash state codes are centralized here — VERIFY against your Flash merchant docs
-- when the API key arrives (numbering can differ per contract). See docs/flash-setup.md.

create or replace function public.record_flash_shipment(
  p_order_id uuid,
  p_pno text,
  p_express_category int default null,
  p_weight_g int default null,
  p_cod_amount int default 0
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.parcel_shipments set
    tracking_no      = p_pno,
    express_category = coalesce(p_express_category, express_category),
    weight_g         = coalesce(p_weight_g, weight_g),
    cod_amount       = coalesce(p_cod_amount, cod_amount),
    flash_state      = coalesce(flash_state, 1)
  where order_id = p_order_id;
  if not found then
    insert into public.parcel_shipments (order_id, shop_id, tracking_no, express_category, weight_g, cod_amount, flash_state)
    select p_order_id, o.shop_id, p_pno, p_express_category, p_weight_g, coalesce(p_cod_amount, 0), 1
    from public.orders o where o.id = p_order_id;
  end if;
end $$;

create or replace function public.apply_flash_state(
  p_pno text,
  p_state int,
  p_state_text text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_status public.order_status_t;
begin
  select order_id into v_order from public.parcel_shipments where tracking_no = p_pno;
  if v_order is null then
    return jsonb_build_object('matched', false);
  end if;

  v_status := (case p_state
    when 1 then 'preparing'
    when 2 then 'picked_up'
    when 3 then 'in_transit'
    when 4 then 'in_transit'
    when 5 then 'out_for_delivery'
    when 6 then 'delivered'
    when 7 then 'delivery_failed'
    when 8 then 'returned'
    when 9 then 'cancelled'
    else null
  end)::public.order_status_t;

  update public.parcel_shipments set
    flash_state      = p_state,
    flash_state_text = coalesce(p_state_text, flash_state_text),
    shipped_at   = case when p_state = 2 then coalesce(shipped_at, now())   else shipped_at   end,
    delivered_at = case when p_state = 6 then coalesce(delivered_at, now()) else delivered_at end,
    returned_at  = case when p_state = 8 then coalesce(returned_at, now())  else returned_at  end,
    failed_at    = case when p_state = 7 then coalesce(failed_at, now())    else failed_at    end
  where order_id = v_order;

  if v_status is not null then
    update public.orders set
      order_status = v_status,
      delivered_at = case when v_status = 'delivered'::public.order_status_t then coalesce(delivered_at, now()) else delivered_at end
    where id = v_order and order_status is distinct from v_status;
  end if;

  return jsonb_build_object('matched', true, 'order_id', v_order, 'status', v_status);
end $$;

grant execute on function public.record_flash_shipment(uuid, text, int, int, int) to service_role;
grant execute on function public.apply_flash_state(text, int, text) to service_role;

-- ── Auto-create a Flash shipment when an online order is confirmed ────────────
create or replace function public.dispatch_flash()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  if exists (select 1 from public.parcel_shipments where order_id = new.id and tracking_no is not null) then
    return new; -- already shipped
  end if;
  v_url := current_setting('app.functions_url', true);
  v_key := current_setting('app.service_role_key', true);
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return new; -- not configured here
  end if;
  perform net.http_post(
    url := v_url || '/create-flash-shipment',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('order_id', new.id)
  );
  return new;
end $$;

drop trigger if exists trg_dispatch_flash on public.orders;
create trigger trg_dispatch_flash
  after update of order_status on public.orders
  for each row
  when (new.shop_mode = 'online'::public.shop_mode_t
        and new.order_status = 'confirmed'::public.order_status_t)
  execute function public.dispatch_flash();
