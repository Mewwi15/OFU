-- ช่องแบนเนอร์ตัวที่สองของหน้าแรก — เจ้าของสั่ง 4 ก.ย. 2026 ให้หน้าแรกเลิกโชว์สินค้า
-- แล้วเหลือสองอย่าง "คูปองใหญ่เต็มจอ" กับ "แบนเนอร์" ที่ไล่ลงมาข้างล่าง
--
-- ช่องนี้คนละใบกับ 'home' ที่เป็นสไลด์บนสุด — 'home' ไหลใต้แถบสถานะและมีการ์ดเลือก
-- โหมดทับขอบล่างอยู่ จึงครอป 1.55:1 ส่วนช่องนี้อยู่กลางหน้าไม่มีอะไรทับ ครอป 2:1
-- เท่าแถบของหน้าเดลิเวอรี่/ออนไลน์ ถ้าใช้ช่องเดียวกันทั้งสองที่ รูปเดียวจะโผล่ซ้ำสองรอบ
-- บนหน้าเดียวกัน และครอปให้พอดีทั้งสองกรอบพร้อมกันไม่ได้

alter table public.banners drop constraint if exists banners_placement_chk;
alter table public.banners add constraint banners_placement_chk
  check (placement in (
    'home', 'home_promo', 'search_hero', 'search_trending', 'search_promo', 'search_hot',
    'delivery_promo', 'online_promo'
  ));
