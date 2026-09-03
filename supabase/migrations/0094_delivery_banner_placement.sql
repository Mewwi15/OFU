-- ช่องแบนเนอร์ของหน้าเดลิเวอรี่ — เจ้าของสั่ง 3 ก.ย. 2026 ("ตรงนั้นเพิ่มเป็นแบนเนอร์")
-- หลังจากสั่งเอาแถบ "สั่งตอนนี้ ได้ของวันนี้" ออก
--
-- ทำเป็นตำแหน่งของตัวเอง ไม่ยืมของหน้าค้นหามาใช้ เพราะยืมแล้วเปลี่ยนรูปหน้าหนึ่ง
-- อีกหน้าจะเปลี่ยนตามโดยไม่ได้ตั้งใจ เจ้าของคุมสองหน้านี้แยกกันอยู่แล้ว
--
-- ตัวคุมค่าที่ยอมรับคือ check constraint ตัวเดียว ฟังก์ชัน upsert_banner ไม่ได้มี
-- รายชื่อของตัวเอง จึงแก้ที่นี่ที่เดียวจบ

alter table public.banners drop constraint if exists banners_placement_chk;
alter table public.banners add constraint banners_placement_chk
  check (placement in (
    'home', 'search_hero', 'search_trending', 'search_promo', 'search_hot',
    'delivery_promo'
  ));
