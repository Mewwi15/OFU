-- สินค้าโปรด — เจ้าของสั่ง 5 ก.ย. 2026 ให้แถบล่างของโหมดออนไลน์มีเมนู "สินค้าโปรด"
-- ซึ่งยังไม่มีอะไรในระบบเลย ต้องทำใหม่ทั้งชุด
--
-- ★ เก็บที่ฐานข้อมูล ไม่ใช่ในเครื่อง ★ ของโปรดคือสิ่งที่ลูกค้าค่อย ๆ สะสมไว้เป็นเดือน
-- ถ้าเก็บไว้ในเครื่องอย่างเดียว เปลี่ยนเครื่องหรือลบแอปทีเดียวหายหมด และลูกค้าคนเดียว
-- ที่ใช้ทั้งมือถือและเว็บจะเห็นคนละรายการ
--
-- ไม่มีคอลัมน์ shop_id — ร้านเดียว และ product_id ชี้ไปที่สินค้าซึ่งผูกกับร้านอยู่แล้ว
-- ใส่เพิ่มก็เป็นข้อมูลซ้ำที่ต้องคอยดูแลให้ตรงกัน

create table if not exists public.favorites (
  user_id    uuid not null references public.app_users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- คู่เดียวต่อคนต่อสินค้า — กดหัวใจรัว ๆ ต้องได้แถวเดียว ไม่ใช่กองซ้ำ
  primary key (user_id, product_id)
);
-- เรียงของโปรดจากใหม่ไปเก่า เป็นการอ่านหลักของหน้ารายการ
create index if not exists favorites_user_ix
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

/* ลูกค้าเห็นและแก้ได้เฉพาะของตัวเอง — ★ ต้องมี with check ด้วย ไม่ใช่แค่ using ★
   using คุมว่าเห็น/แตะแถวไหนได้ ส่วน with check คุมว่าเขียนแถวที่มี user_id เป็นใครได้
   ถ้ามีแต่ using จะกดหัวใจใส่บัญชีคนอื่นได้ */
create policy favorites_select on public.favorites for select
  using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert
  with check (user_id = auth.uid());
create policy favorites_delete on public.favorites for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.favorites to authenticated;
-- service_role ข้าม RLS ได้ แต่ข้าม GRANT ระดับตารางไม่ได้ ตารางใหม่ต้อง grant มือทุกครั้ง
grant select, insert, delete on public.favorites to service_role;
