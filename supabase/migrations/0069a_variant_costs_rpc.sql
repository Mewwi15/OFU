-- 0069a_variant_costs_rpc.sql
-- อู้ฟู่ (Oofoo) — ปิดช่องโหว่ต้นทุนสินค้า · ส่วนที่ 1 จาก 2 (เพิ่มอย่างเดียว ยังไม่ตัดอะไร)
--
-- ปัญหา: RLS คุมได้แค่ "แถวไหนอ่านได้" ไม่ใช่ "คอลัมน์ไหนอ่านได้" นโยบาย
-- variants_read (0003) เปิดให้ทุกคนอ่านแถวของสินค้าที่เผยแพร่ ซึ่งถูกต้องสำหรับ
-- ชื่อ/ราคา/สต็อก แต่ทำให้ cost_price ติดไปด้วย — ใครก็ตามที่มี anon key
-- (ซึ่งฝังอยู่ในเว็บร้านและในแอป) ยิง REST ตรง ๆ ก็อ่านต้นทุนได้ทั้งร้าน
--
-- ทางแก้: ยึดคืนสิทธิ์อ่านคอลัมน์ cost_price จาก anon และ authenticated แล้วให้
-- แอดมินอ่านผ่านฟังก์ชันนี้แทน — ซึ่งเช็คว่าเป็นแอดมินของร้านก่อนเสมอ
-- (ลูกค้าที่ล็อกอินแล้วก็เป็น role authenticated เหมือนกัน จึงตัดสิทธิ์ทั้งสอง role
--  แล้วแยกแอดมินด้วย admin_shop() ไม่ใช่ด้วย role)
--
-- ⚠️ ลำดับสำคัญ — รันไฟล์นี้ก่อน แล้ว deploy แอดมิน แล้วค่อยรัน 0069b
--    ถ้ารัน 0069b ก่อน deploy หน้าสินค้าและหน้าสต๊อกจะพังทันที

create or replace function public.admin_variant_costs()
returns table (variant_id uuid, cost_price numeric)
language sql stable security definer set search_path = '' as $$
  select pv.id, pv.cost_price
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where p.shop_id = public.admin_shop();
$$;

revoke execute on function public.admin_variant_costs() from public;
grant execute on function public.admin_variant_costs() to authenticated;

comment on function public.admin_variant_costs() is
  'ต้นทุนสินค้าทั้งร้าน สำหรับแอดมินเท่านั้น — admin_shop() โยน FORBIDDEN ถ้าไม่ใช่แอดมิน';
