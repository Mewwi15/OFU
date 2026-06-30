-- seed.sql — local dev fixtures (run by `supabase db reset` / first `start`).
-- A shop + settings (so the signup trigger has a shop to attach customers to)
-- and a starter catalog (categories / products / variants / images) mirroring
-- the old mock so the wired app has data. In production the catalog is managed
-- by the admin web (0006 RPCs) — this is dev-only scaffolding.

-- ── Shop ──────────────────────────────────────────────────────────────────────
insert into public.shops (id, name, slug, promptpay_id, promptpay_name, active)
values ('00000000-0000-0000-0000-0000000000a1', 'ร้าน อู้ฟู่', 'oofoo',
        '0812345678', 'อู้ฟู่ จำกัด', true)
on conflict (id) do nothing;

insert into public.shop_settings (shop_id)
values ('00000000-0000-0000-0000-0000000000a1')
on conflict (shop_id) do nothing;

-- Operating hours: every day 08:00–22:00
insert into public.shop_hours (shop_id, weekday, open_time, close_time)
select '00000000-0000-0000-0000-0000000000a1', wd, '08:00', '22:00'
from generate_series(0, 6) as wd
on conflict (shop_id, weekday) do nothing;

-- ── Promo (dev) ───────────────────────────────────────────────────────────────
insert into public.promo_codes (shop_id, code, type, value, min_spend, scope, active)
values ('00000000-0000-0000-0000-0000000000a1', 'OOFOO10', 'percent', 10, 0, 'subtotal', true)
on conflict (shop_id, code) do nothing;

-- ── Categories ────────────────────────────────────────────────────────────────
insert into public.categories (shop_id, name, display_order)
values
  ('00000000-0000-0000-0000-0000000000a1', 'ของสด', 1),
  ('00000000-0000-0000-0000-0000000000a1', 'เครื่องดื่ม', 2),
  ('00000000-0000-0000-0000-0000000000a1', 'ของแห้ง', 3),
  ('00000000-0000-0000-0000-0000000000a1', 'ของใช้ในบ้าน', 4),
  ('00000000-0000-0000-0000-0000000000a1', 'ขนม', 5),
  ('00000000-0000-0000-0000-0000000000a1', 'ยา', 6)
on conflict (shop_id, name) do nothing;

-- ── Products (published) ─────────────────────────────────────────────────────
insert into public.products (shop_id, category_id, name, subtitle, description, rating, publish_state)
select '00000000-0000-0000-0000-0000000000a1',
       (select id from public.categories where name = x.cat and shop_id = '00000000-0000-0000-0000-0000000000a1'),
       x.name, x.subtitle, x.description, x.rating, 'published'
from (values
  ('ข้าวหอมมะลิ', 'ของแห้ง', 'หอม นุ่ม คัดพิเศษ', 'ข้าวหอมมะลิแท้คัดพิเศษเมล็ดสวย หุงขึ้นหม้อ หอมนุ่มอร่อยทุกคำ เหมาะกับทุกมื้อของครอบครัว', 4.8),
  ('ไข่ไก่สด (แผง 30 ฟอง)', 'ของสด', 'สดใหม่ทุกวัน', 'ไข่ไก่สดคัดคุณภาพ แผงละ 30 ฟอง เก็บจากฟาร์มส่งตรงทุกวัน สดใหม่พร้อมปรุงได้สารพัดเมนู', 4.7),
  ('นมจืด UHT 1 ลิตร', 'เครื่องดื่ม', 'หอมมัน ดื่มง่าย', 'นมโคแท้รสจืด UHT ขนาด 1 ลิตร หอมมันกลมกล่อม ดื่มง่าย อุดมด้วยแคลเซียมเหมาะกับทุกวัย', 4.6),
  ('บะหมี่กึ่งสำเร็จรูป (แพ็ค 6)', 'ของแห้ง', 'อิ่มอร่อย สะดวก', 'บะหมี่กึ่งสำเร็จรูปแพ็ค 6 ซอง เส้นเหนียวนุ่ม รสชาติเข้มข้น ปรุงง่ายอิ่มเร็วทันใจทุกเวลา', 4.5),
  ('น้ำดื่ม', 'เครื่องดื่ม', 'สะอาด สดชื่น', 'น้ำดื่มสะอาดผ่านระบบกรองมาตรฐาน รสชาติสดชื่น ดื่มได้อย่างมั่นใจตลอดทั้งวัน', 4.9),
  ('น้ำมันพืช 1 ลิตร', 'ของแห้ง', 'ทอดกรอบ ไม่อมน้ำมัน', 'น้ำมันพืชคุณภาพ ขนาด 1 ลิตร ทอดอาหารได้กรอบอร่อย ไม่อมน้ำมัน เหมาะกับทุกเมนูในครัว', 4.4),
  ('ผงซักฟอก 800 ก.', 'ของใช้ในบ้าน', 'ขจัดคราบ หอมสะอาด', 'ผงซักฟอกสูตรเข้มข้น ขนาด 800 กรัม ขจัดคราบฝังลึกได้หมดจด ทิ้งกลิ่นหอมสะอาดยาวนาน', 4.3),
  ('มันฝรั่งทอดกรอบ', 'ขนม', 'กรอบ อร่อย เพลิน', 'มันฝรั่งทอดกรอบแผ่นบาง ปรุงรสกลมกล่อม กรอบอร่อยเพลินทุกคำ เหมาะเป็นของว่างทุกโอกาส', 4.6),
  ('พาราเซตามอล 500 มก. (แผง 10 เม็ด)', 'ยา', 'บรรเทาปวด ลดไข้', 'ยาพาราเซตามอล 500 มิลลิกรัม แผงละ 10 เม็ด บรรเทาอาการปวดศีรษะ ปวดเมื่อย และลดไข้ ใช้ได้ทั้งครอบครัว', 4.8),
  ('ยาแก้แพ้ ลดน้ำมูก (10 เม็ด)', 'ยา', 'บรรเทาภูมิแพ้', 'ยาบรรเทาอาการแพ้ คัดจมูก น้ำมูกไหล จากภูมิแพ้อากาศ แผงละ 10 เม็ด ออกฤทธิ์เร็ว ทานง่าย', 4.6),
  ('พลาสเตอร์ยา (กล่อง 20 ชิ้น)', 'ยา', 'ปิดแผล กันน้ำ', 'พลาสเตอร์ปิดแผลกันน้ำ กล่องละ 20 ชิ้น เนื้อนุ่มยืดหยุ่น ติดแน่นไม่หลุดง่าย ปกป้องแผลให้สะอาด', 4.7)
) as x(name, cat, subtitle, description, rating);

-- ── Variants (per size for sized products; one default variant otherwise) ─────
-- sized products: a variant per size (mock had one price → reuse it per size)
insert into public.product_variants (product_id, size, price, stock_qty)
select p.id, x.size, x.price, 50
from (values
  ('ข้าวหอมมะลิ', '1 กก.', 165),
  ('ข้าวหอมมะลิ', '5 กก.', 165),
  ('น้ำดื่ม', '600 มล.', 14),
  ('น้ำดื่ม', '1.5 ลิตร', 14),
  ('พาราเซตามอล 500 มก. (แผง 10 เม็ด)', 'แผง 10 เม็ด', 12),
  ('พาราเซตามอล 500 มก. (แผง 10 เม็ด)', 'กล่อง 100 เม็ด', 12)
) as x(pname, size, price)
join public.products p on p.name = x.pname and p.shop_id = '00000000-0000-0000-0000-0000000000a1';

-- sizeless products: one default variant (size null)
insert into public.product_variants (product_id, size, price, stock_qty)
select p.id, null, x.price, 50
from (values
  ('ไข่ไก่สด (แผง 30 ฟอง)', 125),
  ('นมจืด UHT 1 ลิตร', 55),
  ('บะหมี่กึ่งสำเร็จรูป (แพ็ค 6)', 42),
  ('น้ำมันพืช 1 ลิตร', 58),
  ('ผงซักฟอก 800 ก.', 69),
  ('มันฝรั่งทอดกรอบ', 25),
  ('ยาแก้แพ้ ลดน้ำมูก (10 เม็ด)', 28),
  ('พลาสเตอร์ยา (กล่อง 20 ชิ้น)', 35)
) as x(pname, price)
join public.products p on p.name = x.pname and p.shop_id = '00000000-0000-0000-0000-0000000000a1';

-- ── Images (one primary picsum placeholder per product) ──────────────────────
insert into public.product_images (product_id, storage_path, is_primary, display_order)
select p.id, x.url, true, 0
from (values
  ('ข้าวหอมมะลิ', 'https://picsum.photos/seed/oofoo1/600/800'),
  ('ไข่ไก่สด (แผง 30 ฟอง)', 'https://picsum.photos/seed/oofoo2/600/800'),
  ('นมจืด UHT 1 ลิตร', 'https://picsum.photos/seed/oofoo3/600/800'),
  ('บะหมี่กึ่งสำเร็จรูป (แพ็ค 6)', 'https://picsum.photos/seed/oofoo4/600/800'),
  ('น้ำดื่ม', 'https://picsum.photos/seed/oofoo5/600/800'),
  ('น้ำมันพืช 1 ลิตร', 'https://picsum.photos/seed/oofoo6/600/800'),
  ('ผงซักฟอก 800 ก.', 'https://picsum.photos/seed/oofoo7/600/800'),
  ('มันฝรั่งทอดกรอบ', 'https://picsum.photos/seed/oofoo8/600/800'),
  ('พาราเซตามอล 500 มก. (แผง 10 เม็ด)', 'https://picsum.photos/seed/oofoo9/600/800'),
  ('ยาแก้แพ้ ลดน้ำมูก (10 เม็ด)', 'https://picsum.photos/seed/oofoo10/600/800'),
  ('พลาสเตอร์ยา (กล่อง 20 ชิ้น)', 'https://picsum.photos/seed/oofoo11/600/800')
) as x(pname, url)
join public.products p on p.name = x.pname and p.shop_id = '00000000-0000-0000-0000-0000000000a1';
