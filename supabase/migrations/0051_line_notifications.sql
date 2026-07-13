-- 0051_line_notifications.sql
-- อู้ฟู่ (Oofoo) — LINE OA notifications (owner 2026-07-13: web-first pivot,
-- everything notifies through LINE; the web has no push channel).
--   • app_users.line_user_id    : customer's LINE userId (set by the LINE link
--     flow / webhook — service-role writes only, never by the client directly)
--   • shops.line_owner_user_id  : the owner's LINE userId (captured when the
--     owner messages the OA with the link phrase — see line-webhook function)
--   • notify_order_status       : same copy as 0046, plus a 'line' delivery
--     row when the customer has LINE linked (send-line Edge Function drains)
--   • dispatch_line             : pg_net trigger → /send-line (mirrors 0012)
--   • line_owner_alert          : LINE ping to the owner on new customer
--     orders and on slip upload (action needed)

alter table public.app_users add column if not exists line_user_id text unique;
alter table public.shops add column if not exists line_owner_user_id text;

-- ── Customer order-status notification: add the LINE channel ─────────────────
create or replace function public.notify_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_body  text;
  v_cat   public.notif_category_t;
  v_id    uuid;
  v_track text;
begin
  if new.order_status is not distinct from old.order_status then return new; end if;
  if new.customer_user_id is null then return new; end if;

  case new.order_status::text
    when 'confirmed' then
      v_cat := 'order'; v_title := 'ยืนยันคำสั่งซื้อแล้ว';
      v_body := 'ออเดอร์ ' || new.order_number || ' ได้รับการยืนยันแล้ว';
    when 'preparing' then
      v_cat := 'order'; v_title := 'กำลังเตรียมสินค้า';
      v_body := 'ร้านกำลังจัดเตรียมออเดอร์ ' || new.order_number;
    when 'out_for_delivery' then
      v_cat := 'delivery';
      if new.shop_mode = 'online' then
        v_title := 'พัสดุกำลังนำจ่าย';
        v_body := 'พัสดุออเดอร์ ' || new.order_number || ' กำลังนำจ่ายถึงคุณ';
      else
        v_title := 'ไรเดอร์กำลังไปส่ง';
        v_body := 'ออเดอร์ ' || new.order_number || ' กำลังจัดส่งถึงคุณ';
      end if;
    when 'picked_up' then
      v_cat := 'delivery'; v_title := 'ร้านส่งพัสดุแล้ว';
      select tracking_no into v_track
      from public.parcel_shipments where order_id = new.id;
      v_body := 'พัสดุออเดอร์ ' || new.order_number || ' เข้าระบบขนส่งแล้ว'
             || coalesce(' เลขพัสดุ ' || v_track, '');
    when 'in_transit' then
      v_cat := 'delivery'; v_title := 'พัสดุกำลังขนส่ง';
      v_body := 'ออเดอร์ ' || new.order_number || ' กำลังเดินทางไปหาคุณ';
    when 'delivered' then
      v_cat := 'delivery'; v_title := 'จัดส่งสำเร็จ';
      v_body := 'ออเดอร์ ' || new.order_number || ' ส่งถึงแล้ว ขอบคุณที่ใช้บริการ';
    when 'cancelled' then
      v_cat := 'order'; v_title := 'ออเดอร์ถูกยกเลิก';
      v_body := 'ออเดอร์ ' || new.order_number || ' ถูกยกเลิกแล้ว';
    when 'payment_rejected' then
      v_cat := 'payment'; v_title := 'การชำระเงินไม่ผ่าน';
      v_body := 'สลิปออเดอร์ ' || new.order_number || ' ไม่ผ่านการตรวจสอบ กรุณาแนบใหม่';
    else
      return new; -- statuses we don't notify on
  end case;

  insert into public.notifications
    (shop_id, audience, classification, category, title, body, target_type, target_id, dedupe_key)
  values
    (new.shop_id, 'customer'::public.notif_audience_t, 'transactional'::public.notif_class_t,
     v_cat, v_title, v_body, 'order', new.order_number,
     new.order_number || ':' || new.order_status::text)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then return new; end if; -- duplicate (already notified)

  insert into public.notification_recipients (notification_id, user_id)
  values (v_id, new.customer_user_id)
  on conflict (notification_id, user_id) do nothing;

  insert into public.notification_deliveries (notification_id, user_id, channel, status)
  values (v_id, new.customer_user_id, 'push'::public.notif_channel_t, 'pending'::public.notif_delivery_status_t);

  -- LINE delivery only when the customer has linked their LINE account.
  insert into public.notification_deliveries (notification_id, user_id, channel, status)
  select v_id, new.customer_user_id,
         'line'::public.notif_channel_t, 'pending'::public.notif_delivery_status_t
  from public.app_users u
  where u.id = new.customer_user_id and u.line_user_id is not null;

  return new;
end $$;

-- ── pg_net dispatch: pending LINE delivery → send-line Edge Function ─────────
create or replace function public.dispatch_line()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  v_url := current_setting('app.functions_url', true);
  v_key := current_setting('app.service_role_key', true);
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return new; -- not configured here (local) — nothing to drain against
  end if;
  perform net.http_post(
    url := v_url || '/send-line',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  return new;
end $$;

drop trigger if exists trg_dispatch_line on public.notification_deliveries;
create trigger trg_dispatch_line
  after insert on public.notification_deliveries
  for each row
  when (new.channel = 'line'::public.notif_channel_t
        and new.status = 'pending'::public.notif_delivery_status_t)
  execute function public.dispatch_line();

-- ── Owner alerts: new order / slip uploaded → owner's LINE ───────────────────
create or replace function public.line_owner_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url  text;
  v_key  text;
  v_text text;
  v_mode text;
begin
  v_url := current_setting('app.functions_url', true);
  v_key := current_setting('app.service_role_key', true);
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return new;
  end if;

  v_mode := case new.shop_mode::text when 'online' then 'ส่งพัสดุ' else 'เดลิเวอรี่' end;

  if tg_op = 'INSERT' then
    v_text := 'ออเดอร์ใหม่ ' || new.order_number || ' (' || v_mode || ')'
           || chr(10) || 'ยอดรวม ' || new.total || ' บาท';
  elsif new.order_status = 'slip_uploaded'::public.order_status_t
        and old.order_status is distinct from new.order_status then
    v_text := 'ลูกค้าแนบสลิปออเดอร์ ' || new.order_number
           || chr(10) || 'ยอด ' || new.total || ' บาท — รอตรวจสอบในระบบหลังร้าน';
  else
    return new;
  end if;

  perform net.http_post(
    url := v_url || '/send-line',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('owner_text', v_text, 'shop_id', new.shop_id)
  );
  return new;
end $$;

drop trigger if exists trg_line_owner_new_order on public.orders;
create trigger trg_line_owner_new_order
  after insert on public.orders
  for each row execute function public.line_owner_alert();

drop trigger if exists trg_line_owner_slip on public.orders;
create trigger trg_line_owner_slip
  after update of order_status on public.orders
  for each row execute function public.line_owner_alert();
