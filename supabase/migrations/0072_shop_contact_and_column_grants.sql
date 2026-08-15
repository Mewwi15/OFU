-- 0072_shop_contact_and_column_grants.sql
-- อู้ฟู่ (Oofoo) — เบอร์ติดต่อร้าน + ปิดคอลัมน์ที่ไม่ควรเปิดใน public.shops
--
--   1. shops.contact_phone — เบอร์ที่ลูกค้ากดโทรได้จากหน้าติดตามออเดอร์
--   2. ปิด line_owner_user_id ไม่ให้ anon อ่าน (ปัญหาเดียวกับ cost_price/0069c)
--
-- ── ทำไมข้อ 2 ถึงจำเป็น ──────────────────────────────────────────────────────
-- ตาราง shops เปิด public-read เพราะแอปต้องอ่านชื่อร้าน/พร้อมเพย์ แต่ RLS คุมได้
-- แค่ระดับแถว — เปิดแถวก็เปิดทุกคอลัมน์ในแถวนั้น ผลคือ:
--
--   curl '.../rest/v1/shops?select=*'  →  line_owner_user_id: 'U79bf...'
--
-- LINE userId ของเจ้าของร้านหลุดออกไปกับทุก request ที่ยิงตาราง shops
--
-- ตัวมันเองเอาไปสวมสิทธิ์ไม่ได้ (ต้องคุมบัญชี LINE นั้นจริง ๆ ถึงจะส่งข้อความใน
-- นามนั้นได้) แต่มันคือ identifier ถาวรของบุคคล ผูกกับบัญชี LINE ส่วนตัว และไม่มี
-- เหตุผลใดที่ลูกค้าต้องอ่านได้ — คอลัมน์ที่ไม่มีใครต้องใช้ ไม่ควรเปิด
--
-- ── บทเรียนจาก 0069b ────────────────────────────────────────────────────────
-- `revoke select (col) on t from anon` เมื่อ anon มีสิทธิ์ระดับตารางอยู่ = ผ่าน
-- เงียบ ๆ โดยไม่เปลี่ยนอะไร Postgres ไม่ยอมลบคอลัมน์เดียวออกจากสิทธิ์ทั้งตาราง
-- ต้องถอนสิทธิ์ตารางทิ้ง แล้ว grant กลับเป็นรายคอลัมน์ — และต้องมีบล็อกตรวจผล
-- ท้ายไฟล์เสมอ ไม่งั้นจะไม่มีทางรู้ว่ามันไม่ได้ทำงาน

begin;

-- ═══ 1. เบอร์ติดต่อร้าน ══════════════════════════════════════════════════════
-- ตอนนี้เจ้าของร้านเป็นคนส่งของเอง หน้าติดตามออเดอร์จึงโชว์ร้านเป็นผู้จัดส่ง
-- และปุ่มโทรต้องต่อถึงร้านจริง (ก่อนหน้านี้ต่อไปที่ 089-555-0123 ซึ่งไม่มีอยู่จริง)
alter table public.shops
  add column if not exists contact_phone text;

comment on column public.shops.contact_phone is
  'เบอร์ร้านที่ลูกค้ากดโทรได้จากหน้าติดตามออเดอร์ · เปิดอ่านสาธารณะโดยตั้งใจ';

-- ═══ 2. ปิดคอลัมน์ที่ไม่ควรเปิด ══════════════════════════════════════════════
-- ถอนสิทธิ์ระดับตารางก่อน แล้วให้กลับเฉพาะคอลัมน์ที่แอปลูกค้าใช้จริง
-- (ที่เหลืออยู่นอกลิสต์นี้ = line_owner_user_id)
revoke select on public.shops from anon, authenticated;

grant select (
  id,
  name,
  slug,
  timezone,
  promptpay_id,
  promptpay_name,
  contact_phone,
  active,
  created_at
) on public.shops to anon, authenticated;

-- แอดมินยังต้องอ่าน/แก้ได้ครบ — ฝั่งนั้นไปทาง service_role และ RPC ที่ตรวจสิทธิ์
-- อยู่แล้ว จึงไม่ได้รับผลจากการถอนข้างบน

commit;

-- ═══ ตรวจว่าได้ผลจริง ════════════════════════════════════════════════════════
do $$
declare
  v_table_grant int;
  v_leak        int;
  v_needed      int;
begin
  -- 2a. ต้องไม่มีสิทธิ์ระดับตารางหลงเหลือ (ตัวที่ทำให้ 0069b เป็นหมัน)
  select count(*) into v_table_grant
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'shops'
    and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT';
  if v_table_grant > 0 then
    raise exception 'ยังมีสิทธิ์ระดับตารางเหลืออยู่ % รายการ — การปิดคอลัมน์ไม่มีผล', v_table_grant;
  end if;

  -- 2b. line_owner_user_id ต้องอ่านไม่ได้แล้ว
  select count(*) into v_leak
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'shops'
    and column_name = 'line_owner_user_id'
    and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT';
  if v_leak > 0 then
    raise exception 'line_owner_user_id ยังเปิดอ่านได้อยู่';
  end if;

  -- 2c. คอลัมน์ที่แอปต้องใช้ต้องยังอ่านได้ครบ ไม่งั้นหน้าร้านพัง
  select count(distinct column_name) into v_needed
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'shops'
    and grantee = 'anon' and privilege_type = 'SELECT'
    and column_name in ('id','name','slug','promptpay_id','promptpay_name','contact_phone','active');
  if v_needed <> 7 then
    raise exception 'คอลัมน์ที่แอปต้องใช้ขาดไป — เจอ % จาก 7', v_needed;
  end if;

  raise notice '0072 ผ่าน — line_owner_user_id ปิดแล้ว · contact_phone พร้อมใช้';
  raise notice 'อย่าลืมใส่เบอร์ร้าน: update shops set contact_phone = ''0846503474'';';
end $$;
