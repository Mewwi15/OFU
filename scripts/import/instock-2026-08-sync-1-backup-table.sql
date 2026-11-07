-- อู้ฟู่ — sync 2026-08-08 · ไฟล์ที่ 1/4 : สร้างตารางสำรองสำหรับ rollback
--
-- ตารางนี้เก็บ สต็อก/ราคา/ทุน ก่อนแก้ ของทุกตัวที่จะถูกแตะ
-- เปิด RLS ไม่มี policy -> อ่านผ่าน anon/authenticated key ไม่ได้ (มีข้อมูลต้นทุน)
--
-- ถ้า SQL Editor ถามเรื่อง RLS ให้กด "Run and enable RLS" ได้เลย

create table if not exists public.sync_backup_20260808 (
  variant_id    uuid primary key,
  product_id    uuid not null,
  stock_qty     int,
  price         int,
  cost_price    numeric,
  applied_delta int  not null default 0,
  was_created   bool not null default false,
  saved_at      timestamptz not null default now()
);

alter table public.sync_backup_20260808 enable row level security;
