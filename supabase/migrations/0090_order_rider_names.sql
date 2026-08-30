-- ชื่อไรเดอร์ที่ถือออเดอร์อยู่ สำหรับหน้าออเดอร์ฝั่งแอดมิน
-- เจ้าของสั่ง 30 ส.ค. 2026 ให้คอลัมน์เลขพัสดุตอบได้ทั้งสองช่องทาง
--
-- คอลัมน์นี้มีไว้ตอบคำถามเดียว: ลูกค้าทักมาว่า "ของถึงไหนแล้ว"
--   ออเดอร์พัสดุ    → ตอบด้วยเลขพัสดุ (parcel_shipments, 0046)
--   ออเดอร์จัดส่งเอง → ตอบด้วยว่าใครถือของอยู่ ซึ่งข้อมูลมีอยู่แล้วใน deliveries
--                     แต่หน้าออเดอร์ไม่เคยดึงมาแสดง
--
-- ทำเป็น RPC ไม่ใช่ nested select เพราะชื่อคนอยู่ใน app_users ซึ่ง RLS ไม่ได้เปิด
-- ให้แอดมินอ่านแถวของไรเดอร์ตรง ๆ — security definer จึงเป็นทางที่ถูกกว่าการไป
-- คลาย policy ของตารางผู้ใช้ทั้งตารางเพื่อโชว์ชื่อคนเดียว

create or replace function public.list_order_riders()
returns table (order_id uuid, rider_name text, state text)
language sql security definer set search_path = '' as $$
  select d.order_id,
         coalesce(nullif(btrim(u.display_name), ''), 'ไรเดอร์'),
         d.assignment_state::text
    from public.deliveries d
    join public.orders o
      on o.id = d.order_id
     and o.shop_id = public.admin_shop()
     -- หน้าออเดอร์โหลดแค่ 100 ใบล่าสุดอยู่แล้ว ไม่ต้องลากประวัติทั้งร้านมาด้วย
     and o.placed_at > now() - interval '60 days'
    left join public.app_users u on u.id = d.rider_user_id
   where d.rider_user_id is not null;
$$;

revoke execute on function public.list_order_riders() from public;
grant execute on function public.list_order_riders() to authenticated;
