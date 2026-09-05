-- ล็อกอินด้วยเบอร์ต้องเข้าบัญชีเดิม ไม่ใช่สร้างบัญชีใหม่
--
-- เจ้าของเลือกไว้ 5 ก.ย. 2026: "เข้าบัญชีเดิมได้เลย" — คนที่เคยสมัครด้วยอีเมล/Google
-- แล้วกรอกเบอร์ไว้ พอมาล็อกอินด้วยเบอร์ต้องได้แต้ม/ประวัติ/ที่อยู่ชุดเดิม
--
-- ★ อาการที่เจอตอนทดสอบจริง ★ ยิง OTP เข้าเบอร์ที่มีบัญชีอยู่แล้ว ได้:
--   duplicate key value violates unique constraint "app_users_shop_phone_uq"
-- เพราะระบบยืนยันตัวตนสร้าง "ผู้ใช้ใหม่" ให้ทุกครั้งที่เจอเบอร์ที่มันไม่รู้จัก แล้วทริกเกอร์
-- ก็ไปสร้างแถวลูกค้าใหม่ด้วยเบอร์เดิม ซึ่งชนกฎ "หนึ่งเบอร์ = หนึ่งบัญชี" ที่วางไว้แต่แรก
-- (SMS ส่งออกไปแล้วด้วย = เสียเงินฟรีทุกครั้งที่ลูกค้าเก่ากดล็อกอิน)
--
-- ★ แก้ที่ต้นเหตุ: ทำให้ระบบยืนยันตัวตน "รู้จัก" เบอร์นั้นตั้งแต่แรก ★ ย้ายเบอร์ที่ลูกค้า
-- กรอกไว้ในโปรไฟล์ ขึ้นไปเป็นเบอร์ประจำตัวของบัญชีนั้นในระบบยืนยันตัวตนด้วย — พอเบอร์
-- ถูกรู้จักแล้ว การขอ OTP จะวิ่งเข้าบัญชีเดิม ไม่มีการสร้างผู้ใช้ใหม่ ไม่มีอะไรชนกัน
--   · ไม่ต้องแก้แอป ไม่ต้องแก้ระบบรวมบัญชี — เป็นการเติมข้อมูลที่ขาดไปเฉย ๆ
--   · ทำครั้งเดียวสำหรับของเก่า ส่วนของใหม่มีทริกเกอร์ดูแลต่อ (ข้างล่าง)

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ของเก่า: ยกเบอร์จากโปรไฟล์ขึ้นไปเป็นเบอร์ประจำตัวของบัญชี
--
-- ★ ถือว่ายืนยันแล้ว ★ ตั้ง phone_confirmed_at ไปเลย ไม่งั้นระบบจะบังคับให้ยืนยันเบอร์
-- ก่อนเข้าใช้ ซึ่งลูกค้าเก่าจะเจอด่านเพิ่มขึ้นมาเฉย ๆ ทั้งที่เขาเคยใช้บัญชีนี้อยู่แล้ว
-- (การขอ OTP รอบต่อไปก็คือการยืนยันเบอร์อยู่ดี)
--
-- ข้ามแถวที่จะชนกัน: บัญชีที่มีเบอร์ประจำตัวอยู่แล้ว และเบอร์ที่มีคนอื่นถือไปแล้ว
-- ─────────────────────────────────────────────────────────────────────────────
update auth.users u
   set phone = a.phone,
       phone_confirmed_at = coalesce(u.phone_confirmed_at, now()),
       updated_at = now()
  from public.app_users a
 where a.id = u.id
   and a.phone is not null
   and a.phone <> ''
   and a.is_anonymized = false
   and (u.phone is null or u.phone = '')
   and not exists (
     select 1 from auth.users x where x.phone = a.phone and x.id <> u.id
   );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ของใหม่: ทริกเกอร์ต้องไม่ล้มทั้งการสมัครเพราะเบอร์ชน
--
-- หลังเติมข้อมูลข้อ 1 แล้วเคสนี้แทบไม่เกิด แต่ยังเป็นไปได้ (เช่นลูกค้าเปลี่ยนเบอร์กันไปมา
-- แล้วเบอร์เก่าไปค้างในโปรไฟล์ของอีกคน) — ★ ยอมให้เข้าระบบได้โดยยังไม่มีเบอร์ ดีกว่า
-- ปฏิเสธทั้งการสมัคร ★ ของเดิมทริกเกอร์ระเบิดกลางคัน ผลคือระบบยืนยันตัวตนตอบ error 500
-- ที่ลูกค้าอ่านไม่รู้เรื่อง และ SMS ที่ส่งไปแล้วก็เสียเปล่า
-- แถวลูกค้ายังถูกสร้าง เข้าใช้งานได้ปกติ แค่ช่องเบอร์ว่างไว้ให้ไปกรอกเองทีหลัง
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid;
  v_role public.role_t;
  v_phone text := nullif(new.phone, '');
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.role_t, 'customer');
  v_shop := coalesce(
    (new.raw_user_meta_data ->> 'shop_id')::uuid,
    (select id from public.shops where active order by created_at limit 1)
  );

  /* เบอร์นี้มีคนถือไปแล้วในร้านนี้ → ปล่อยว่างไว้ ไม่ล้มทั้งการสมัคร */
  if v_phone is not null and exists (
    select 1 from public.app_users a
     where a.shop_id = v_shop and a.phone = v_phone and a.is_anonymized = false
  ) then
    raise warning 'เบอร์ % ถูกใช้ในร้าน % แล้ว — สร้างบัญชีใหม่โดยยังไม่ผูกเบอร์', v_phone, v_shop;
    v_phone := null;
  end if;

  insert into public.app_users (
    id, shop_id, role, admin_tier, account_state, display_name, email, phone
  ) values (
    new.id,
    v_shop,
    v_role,
    case when v_role = 'admin'
         then coalesce((new.raw_user_meta_data ->> 'admin_tier')::public.admin_tier_t, 'staff')
         else null end,
    -- customers are live immediately; invited admin/rider stay pending until activated
    (case when v_role = 'customer' then 'active' else 'pending' end)::public.account_state_t,
    new.raw_user_meta_data ->> 'display_name',
    new.email,
    v_phone
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ต่อจากนี้ไป: กรอกเบอร์ในโปรไฟล์ = ผูกเบอร์กับบัญชีเลย
--
-- ไม่งั้นลูกค้าที่สมัครด้วยอีเมลวันนี้ แล้วกรอกเบอร์ตอนสั่งของ จะกลับมาเจอปัญหาเดิมเป๊ะ
-- ตอนลองล็อกอินด้วยเบอร์ในวันหลัง — ข้อ 1 แก้ได้เฉพาะของที่มีอยู่ ณ วันนี้เท่านั้น
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_auth_phone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is distinct from old.phone and nullif(new.phone, '') is not null then
    /* เบอร์ที่บัญชีอื่นถือในระบบยืนยันตัวตนอยู่แล้ว ห้ามแย่ง — ปล่อยไว้เฉย ๆ
       (ฝั่งโปรไฟล์มีกฎ unique ของตัวเองกันอีกชั้นอยู่แล้ว) */
    if not exists (select 1 from auth.users x where x.phone = new.phone and x.id <> new.id) then
      update auth.users
         set phone = new.phone,
             phone_confirmed_at = coalesce(phone_confirmed_at, now()),
             updated_at = now()
       where id = new.id and (phone is null or phone = '' or phone <> new.phone);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists sync_auth_phone_t on public.app_users;
create trigger sync_auth_phone_t
  after update of phone on public.app_users
  for each row execute function public.sync_auth_phone();

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
declare v_left int;
begin
  if not exists (select 1 from pg_trigger where tgname = 'sync_auth_phone_t') then
    raise exception 'ทริกเกอร์ซิงก์เบอร์หายไป';
  end if;
  select count(*) into v_left
    from public.app_users a join auth.users u on u.id = a.id
   where a.phone is not null and a.phone <> '' and a.is_anonymized = false
     and (u.phone is null or u.phone = '');
  if v_left > 0 then
    /* เหลือได้เฉพาะกรณีเบอร์ซ้ำกับบัญชีอื่นจริง ๆ — บอกไว้ให้ตามดู ไม่ล้มไมเกรชัน */
    raise warning '0106: ยังมี % บัญชีที่ยกเบอร์ขึ้นไม่ได้ (เบอร์ซ้ำกับบัญชีอื่น)', v_left;
  end if;
  raise notice '0106 พร้อม — ล็อกอินด้วยเบอร์เข้าบัญชีเดิม';
end $$;
