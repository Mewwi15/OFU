-- รหัสเข้าหลังร้าน — เจ้าของสั่ง 30 ส.ค. 2026 ("จะเข้าหลังร้านต้องมีรหัสด้วยนะครับ")
--
-- เมนูถูกแบ่งเป็นหน้าร้าน/หลังร้านไปแล้ว ด่านนี้คือทำให้เส้นแบ่งนั้นมีผลจริง —
-- เครื่อง POS ตั้งอยู่หน้าเคาน์เตอร์และล็อกอินค้างไว้ทั้งวัน ใครเดินมาก็กดเข้า
-- รายงาน ต้นทุน เครดิตลูกค้า หรือตั้งค่าได้หมด
--
-- ⚠️ นี่คือด่านกันคนเดินผ่าน ไม่ใช่ระบบสิทธิ์ ตัวจริงยังเป็น RLS + admin_tier
--    เหมือนเดิม รหัสนี้แค่ทำให้ "เผลอกด" กับ "ตั้งใจเข้า" ไม่ใช่เรื่องเดียวกัน
--
-- เก็บในตารางของตัวเอง ไม่ยัดใส่ shop_settings เพราะตารางนั้น client อ่านได้อยู่แล้ว
-- แล้ว Postgres ถอนสิทธิ์ทีละคอลัมน์ออกจาก grant ระดับตารางไม่ได้ (บทเรียนจาก
-- 0069b ที่ผ่านไปเงียบ ๆ โดยไม่กันอะไรเลย) ตารางนี้ไม่ grant ให้ใครทั้งนั้น
-- แตะได้เฉพาะผ่านฟังก์ชัน security definer ข้างล่าง

create table if not exists public.back_office_pins (
  shop_id      uuid primary key references public.shops(id) on delete cascade,
  pin_hash     text        not null,
  fail_count   int         not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.app_users(id)
);

alter table public.back_office_pins enable row level security;
-- ไม่มี policy และไม่มี grant โดยตั้งใจ — ไม่มีทางอ่าน/เขียนจากฝั่ง client เลย

-- ตั้ง/เปลี่ยนรหัส — เจ้าของเท่านั้น พนักงานเปลี่ยนรหัสที่กันตัวเองไม่ได้
create or replace function public.set_back_office_pin(p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_pin text := btrim(coalesce(p_pin, ''));
begin
  if not exists (select 1 from public.app_users
                 where id = auth.uid() and admin_tier = 'owner'::public.admin_tier_t) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_pin !~ '^[0-9]{4,8}$' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'pin_format';
  end if;
  insert into public.back_office_pins (shop_id, pin_hash, updated_by)
  values (v_shop, extensions.crypt(v_pin, extensions.gen_salt('bf')), auth.uid())
  on conflict (shop_id) do update
    set pin_hash = excluded.pin_hash, updated_by = excluded.updated_by,
        updated_at = now(), fail_count = 0, locked_until = null;
  perform public.write_audit(v_shop, 'set_back_office_pin', 'back_office_pins', v_shop::text,
                             'ตั้งรหัสเข้าหลังร้านใหม่');
end $$;

-- ยังไม่ได้ตั้งรหัส = หลังร้านเปิดโล่ง หน้าจอต้องรู้เพื่อไม่ไปขึ้นด่านให้เปล่า ๆ
-- (และเจ้าของต้องเข้าหน้าตั้งค่าซึ่งอยู่หลังร้านได้ เพื่อไปตั้งรหัสครั้งแรก)
create or replace function public.back_office_pin_set()
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from public.back_office_pins where shop_id = public.admin_shop());
$$;

-- ตรวจรหัส — คืนแค่จริง/เท็จ ไม่คืนอะไรที่เดารหัสต่อได้
-- ผิดติดกัน 5 ครั้งล็อก 5 นาที เพราะรหัส 4 หลักมีแค่ 10,000 แบบ ถ้ายิงรัวได้ก็ไม่ต่าง
-- จากไม่มีรหัส
create or replace function public.verify_back_office_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_row public.back_office_pins; v_ok boolean;
begin
  select * into v_row from public.back_office_pins where shop_id = v_shop for update;
  if v_row.shop_id is null then return true; end if;   -- ยังไม่ได้ตั้งรหัส = ผ่าน

  if v_row.locked_until is not null and v_row.locked_until > now() then
    raise exception 'PIN_LOCKED' using errcode = 'P0001',
      detail = extract(epoch from (v_row.locked_until - now()))::int::text;
  end if;

  v_ok := v_row.pin_hash = extensions.crypt(btrim(coalesce(p_pin, '')), v_row.pin_hash);

  if v_ok then
    update public.back_office_pins set fail_count = 0, locked_until = null where shop_id = v_shop;
  else
    update public.back_office_pins
       set fail_count = v_row.fail_count + 1,
           locked_until = case when v_row.fail_count + 1 >= 5 then now() + interval '5 minutes' end
     where shop_id = v_shop;
    -- กดผิดซ้ำ ๆ คือสัญญาณที่เจ้าของควรเห็นย้อนหลังได้ ไม่ใช่แค่เด้งข้อความแล้วหาย
    if v_row.fail_count + 1 >= 5 then
      perform public.write_audit(v_shop, 'back_office_pin_locked', 'back_office_pins', v_shop::text,
                                 'ใส่รหัสหลังร้านผิดติดกัน 5 ครั้ง ล็อก 5 นาที');
    end if;
  end if;
  return v_ok;
end $$;

revoke execute on function public.set_back_office_pin(text)    from public;
revoke execute on function public.verify_back_office_pin(text) from public;
revoke execute on function public.back_office_pin_set()        from public;
grant execute on function public.set_back_office_pin(text)     to authenticated;
grant execute on function public.verify_back_office_pin(text)  to authenticated;
grant execute on function public.back_office_pin_set()         to authenticated;
