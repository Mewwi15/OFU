-- ช่องแบนเนอร์ของหน้าออนไลน์ — เจ้าของสั่ง 4 ก.ย. 2026 ให้ทำหน้าออนไลน์ตามโครงของ
-- หน้าเดลิเวอรี่ ("ลอกกันไปเลยแต่ว่าเป็นสีน้ำเงิน") หน้าเดลิเวอรี่มีช่องแบนเนอร์ใต้
-- หมวดหมู่ หน้าออนไลน์จึงต้องมีของตัวเองด้วย ไม่งั้นจะมีรูโหว่ตรงที่อีกหน้ามีของ
--
-- ช่องของตัวเอง ไม่ยืมของเดลิเวอรี่ — สองโหมดขายคนละแบบ (ส่งไรเดอร์ในพื้นที่ กับ
-- ส่งพัสดุทั่วไทย) โปรโมชั่นคนละชุดกันแน่นอน ยืมกันแล้วเปลี่ยนรูปหน้าหนึ่งอีกหน้า
-- จะเปลี่ยนตามโดยไม่ได้ตั้งใจ (เหตุผลเดียวกับตอนเพิ่ม delivery_promo ใน 0094)

alter table public.banners drop constraint if exists banners_placement_chk;
alter table public.banners add constraint banners_placement_chk
  check (placement in (
    'home', 'search_hero', 'search_trending', 'search_promo', 'search_hot',
    'delivery_promo', 'online_promo'
  ));
