-- 0070_rider_location_broadcast.sql
-- อู้ฟู่ (Oofoo) — ตำแหน่งไรเดอร์แบบสด ผ่าน Realtime Broadcast (ephemeral)
--
-- ช่อง: delivery:{order_id}:location   payload {lat,lng,heading,at} ทุก ~5 วิ
--
-- ทำไม Broadcast ไม่ใช่ตาราง: ส่งทุก 5 วินาที × ครึ่งชั่วโมง = ~360 แถวต่อออเดอร์
-- ที่ไม่มีใครย้อนดู เก็บลง DB คือหนี้เปล่า ๆ · พิกัดที่ต้องเก็บจริงมีอย่างเดียวคือ
-- ตอนถ่ายรูปยืนยันส่ง (deliveries.pod_lat/lng) ซึ่งเป็นคนละเรื่อง
-- (ตามที่ 06-data-model / 07-api-contract ตัดสินไว้ตั้งแต่เฟสออกแบบ)
--
-- ใครทำอะไรได้:
--   ส่งพิกัด  = แอดมินของร้านเจ้าของออเดอร์ (ตอนนี้เจ้าของร้านเป็นไรเดอร์เอง)
--   ดูพิกัด   = แอดมินของร้าน + ลูกค้าเจ้าของออเดอร์
--   ทั้งสองฝั่งจำกัด "เฉพาะตอนออเดอร์อยู่สถานะกำลังนำส่ง"
--
-- ข้อจำกัดเวลานั้นสำคัญ: ถ้าไม่มี ลูกค้าเก่าที่เคยสั่งจะ subscribe ค้างไว้แล้ว
-- ตามดูได้ว่าเจ้าของร้านอยู่ที่ไหนตลอดเวลา แม้ไม่ได้กำลังส่งของให้เขา
--
-- หมายเหตุ: RLS บน realtime.messages เปิดอยู่แล้วโดย Supabase — ไฟล์นี้เพิ่มแต่ policy

-- ── 1. admin_shop_safe: เหมือน admin_shop() แต่คืน null แทนการ raise ─────────
-- admin_shop() โยน FORBIDDEN เมื่อไม่ใช่แอดมิน ซึ่งใช้ใน RLS policy ไม่ได้ —
-- exception จะทำให้ทั้ง query ล้ม ไม่ใช่แค่ปฏิเสธแถว ผลคือลูกค้าธรรมดาต่อ
-- realtime ไม่ได้เลยแม้แต่ช่องของตัวเอง
create or replace function public.admin_shop_safe()
returns uuid language sql stable security definer set search_path = '' as $$
  select shop_id from public.app_users
  where id = auth.uid()
    and role = 'admin'::public.role_t
    and account_state = 'active'::public.account_state_t;
$$;

revoke execute on function public.admin_shop_safe() from public;
grant execute on function public.admin_shop_safe() to authenticated;

comment on function public.admin_shop_safe() is
  'shop_id ของแอดมินที่ล็อกอินอยู่ · null ถ้าไม่ใช่แอดมิน (ใช้ใน RLS ที่ raise ไม่ได้)';

-- ── 2. แกะ order_id ออกจากชื่อ topic ─────────────────────────────────────────
-- topic รูปแบบ 'delivery:<uuid>:location' — คืน null ถ้ารูปแบบไม่ตรง เพื่อให้
-- policy ตกไปเป็น false แทนที่จะ error ทั้ง connection
create or replace function public.delivery_topic_order_id(p_topic text)
returns uuid language sql immutable set search_path = '' as $$
  select nullif(substring(p_topic from '^delivery:([0-9a-fA-F-]{36}):location$'), '')::uuid;
$$;

revoke execute on function public.delivery_topic_order_id(text) from public;
grant execute on function public.delivery_topic_order_id(text) to authenticated;

comment on function public.delivery_topic_order_id(text) is
  'แกะ order_id จาก topic delivery:{id}:location — null ถ้ารูปแบบไม่ตรง';

-- ── 3. สิทธิ์บนช่อง Broadcast ────────────────────────────────────────────────
drop policy if exists rider_location_send    on realtime.messages;
drop policy if exists rider_location_receive on realtime.messages;

-- ส่งพิกัด: แอดมินของร้านเจ้าของออเดอร์ และออเดอร์ต้องกำลังนำส่งอยู่จริง
-- (กันไม่ให้ส่งพิกัดของออเดอร์ที่ปิดไปแล้ว)
create policy rider_location_send on realtime.messages
for insert to authenticated
with check (
  extension = 'broadcast'
  and exists (
    select 1 from public.orders o
    where o.id = public.delivery_topic_order_id(realtime.topic())
      and o.shop_id = public.admin_shop_safe()
      and o.order_status = 'out_for_delivery'::public.order_status_t
  )
);

-- รับพิกัด: แอดมินของร้าน หรือ ลูกค้าเจ้าของออเดอร์ — เฉพาะตอนกำลังนำส่ง
create policy rider_location_receive on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and exists (
    select 1 from public.orders o
    where o.id = public.delivery_topic_order_id(realtime.topic())
      and o.order_status = 'out_for_delivery'::public.order_status_t
      and (o.shop_id = public.admin_shop_safe() or o.customer_user_id = auth.uid())
  )
);

-- ── 4. ตรวจว่าติดตั้งครบ ─────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_policies
  where schemaname = 'realtime' and tablename = 'messages'
    and policyname in ('rider_location_send', 'rider_location_receive');
  if v_n <> 2 then
    raise exception 'policy ไม่ครบ — เจอ % จาก 2', v_n;
  end if;
  raise notice 'ช่อง delivery:{order_id}:location พร้อมใช้แล้ว';
end $$;
