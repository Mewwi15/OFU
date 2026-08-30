-- 0083_orders_summary_rpc.sql
-- "ตอนนี้ออเดอร์เป็นยังไง" สำหรับบอท LINE (คู่กับ 0082 ที่เป็นฝั่งสต๊อก)
--
-- จัดกลุ่มตามสิ่งที่เจ้าของต้องลงมือทำ ไม่ใช่ตามชื่อสถานะในระบบ — เปิดดูตอน
-- อยู่นอกร้านแล้วต้องตอบได้ทันทีว่า "มีอะไรค้างรอเราอยู่ไหม"
--
--   รอตรวจสลิป  slip_uploaded / payment_verifying  ← ลูกค้าจ่ายแล้ว รอเรายืนยัน
--   รอจัดของ    confirmed / preparing              ← ยืนยันแล้ว ยังไม่ออกจากร้าน
--   กำลังส่ง     assigned_to_rider … out_for_delivery
--   รอชำระ      placed / awaiting_payment          ← ยังไม่จ่าย ไม่ต้องรีบ
--
-- ไม่คืนชื่อ/เบอร์/ที่อยู่ลูกค้าออกมา — ข้อความวิ่งผ่าน LINE ซึ่งอยู่นอกระบบเรา
-- เลขออเดอร์พอให้ไปเปิดดูรายละเอียดบนเว็บได้แล้ว

create or replace function public.orders_summary(p_limit int default 10)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with o as (
    select
      order_number, order_status::text as status, total, placed_at,
      shop_mode::text as mode, payment_method::text as pay
    from public.orders
    where order_status not in ('delivered', 'cancelled', 'returned', 'payment_rejected', 'delivery_failed')
  ),
  today as (
    select count(*) n, coalesce(sum(total), 0) baht
    from public.orders
    where placed_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
      and order_status not in ('cancelled', 'payment_rejected')
  )
  select jsonb_build_object(
    'today_count',  (select n from today),
    'today_baht',   (select baht from today),
    'open',         (select count(*) from o),
    'need_slip',    (select count(*) from o where status in ('slip_uploaded', 'payment_verifying')),
    'to_prepare',   (select count(*) from o where status in ('confirmed', 'preparing')),
    'shipping',     (select count(*) from o where status in ('assigned_to_rider', 'picked_up', 'in_transit', 'out_for_delivery')),
    'unpaid',       (select count(*) from o where status in ('placed', 'awaiting_payment')),
    'delivered_today', (
      select count(*) from public.orders
      where delivered_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
    ),
    'items', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
                 'no', order_number,
                 'status', status,
                 'total', total,
                 'mode', mode,
                 'pay', pay,
                 'placed_at', placed_at
               ) as x
        from o
        -- เรียงตามความเร่ง: รอเราตรวจสลิปก่อน แล้วค่อยรอจัดของ ที่เหลือตามเวลา
        order by case
                   when status in ('slip_uploaded', 'payment_verifying') then 0
                   when status in ('confirmed', 'preparing') then 1
                   else 2
                 end,
                 placed_at
        limit greatest(p_limit, 0)
      ) i
    ), '[]'::jsonb)
  );
$$;

comment on function public.orders_summary(int) is
  'สรุปออเดอร์ที่ยังไม่จบ จัดกลุ่มตามงานที่ต้องทำ — ใช้โดยบอท LINE (ไม่คืนข้อมูลส่วนตัวลูกค้า)';

revoke all on function public.orders_summary(int) from public, anon, authenticated;
grant execute on function public.orders_summary(int) to service_role;
