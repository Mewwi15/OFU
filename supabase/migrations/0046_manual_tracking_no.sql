-- 0046_manual_tracking_no.sql
-- อู้ฟู่ (Oofoo) — manual parcel tracking number + Flash-free push copy.
-- Context: Flash branding was stripped from the customer app (no merchant API
-- key yet; owner 2026-07-12). Until the courier API lands, the shop ships
-- parcels itself and TYPES the courier receipt's tracking number into the
-- admin when advancing an online order to picked_up.
--   • set_order_tracking_no RPC : admin-only upsert of parcel_shipments
--     (tracking_no + shipped_at). record_flash_shipment stays service_role-only
--     for the future Edge Function.
--   • notify_order_status       : reworded — no Flash wording; the picked_up
--     push now carries the tracking number when present; out_for_delivery copy
--     no longer says "ไรเดอร์" for online (parcel) orders.
--   • parcel_shipments.courier  : default 'Flash Express' → 'ร้านอู้ฟู่'
--     (brand-neutral until the courier integration is real).

alter table public.parcel_shipments alter column courier set default 'ร้านอู้ฟู่';

-- ── Admin types the tracking number when the parcel ships ────────────────────
create or replace function public.set_order_tracking_no(
  p_order_id uuid,
  p_tracking_no text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_shop  uuid;
  v_mode  public.shop_mode_t;
  v_track text := nullif(btrim(p_tracking_no), '');
begin
  select shop_id, shop_mode into v_shop, v_mode
  from public.orders where id = p_order_id;
  if v_shop is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if not public.is_admin_of(v_shop) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_mode <> 'online' then
    raise exception 'NOT_PARCEL_ORDER';
  end if;
  if v_track is null or length(v_track) > 40 then
    raise exception 'TRACKING_NO_INVALID';
  end if;

  begin
    insert into public.parcel_shipments (order_id, shop_id, tracking_no, shipped_at)
    values (p_order_id, v_shop, v_track, now())
    on conflict (order_id) do update
      set tracking_no = excluded.tracking_no,
          shipped_at  = coalesce(public.parcel_shipments.shipped_at, now());
  exception when unique_violation then
    -- parcel_shipments_tracking_uq: the number is already on another order
    raise exception 'TRACKING_NO_TAKEN';
  end;
end $$;

revoke execute on function public.set_order_tracking_no(uuid, text) from public;
grant execute on function public.set_order_tracking_no(uuid, text) to authenticated;

-- ── Push copy: Flash-free + tracking number in the picked_up push ────────────
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

  return new;
end $$;
