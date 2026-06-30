-- 0011_notifications.sql
-- อู้ฟู่ (Oofoo) — order notifications.
--   • notify_order_status trigger: on every order_status change, fan a customer
--     notification + recipient + a pending push delivery row (the push worker in
--     a later migration drains the deliveries).
--   • register_push_token RPC: device registers its Expo push token.
--   • notification_recipients added to Realtime so the in-app feed lands live.
-- SECURITY DEFINER, search_path=''. Enum literals explicitly cast.

create or replace function public.notify_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_body  text;
  v_cat   public.notif_category_t;
  v_id    uuid;
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
      v_cat := 'delivery'; v_title := 'ไรเดอร์กำลังไปส่ง';
      v_body := 'ออเดอร์ ' || new.order_number || ' กำลังจัดส่งถึงคุณ';
    when 'picked_up' then
      v_cat := 'delivery'; v_title := 'Flash รับพัสดุแล้ว';
      v_body := 'พัสดุออเดอร์ ' || new.order_number || ' เข้าระบบขนส่งแล้ว';
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

  return new;
end $$;

drop trigger if exists trg_notify_order_status on public.orders;
create trigger trg_notify_order_status
  after update of order_status on public.orders
  for each row execute function public.notify_order_status();

-- ── Register an Expo push token for the signed-in user ───────────────────────
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  insert into public.push_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token)
    do update set user_id = auth.uid(), platform = excluded.platform, revoked_at = null;
end $$;

revoke execute on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ── Realtime: live in-app feed ───────────────────────────────────────────────
alter table public.notification_recipients replica identity full;
alter publication supabase_realtime add table public.notification_recipients;
