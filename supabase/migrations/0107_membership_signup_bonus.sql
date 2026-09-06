-- สมัครสมาชิกด้วยเบอร์ → รับ 100 แต้มทันที
--
-- เจ้าของสั่ง 6 ก.ย. 2026: "ลูกค้าที่ยังไม่มีระบบสมาชิกต้องมาสมัคร กรอกเบอร์ครับ
-- ได้รับแต้ม 100"
--
-- ★ เบอร์คือบัตรสมาชิก ★ แคชเชียร์ค้นสมาชิกที่หน้าร้านด้วยเบอร์ (0102) คนที่สมัครด้วย
-- Google/Apple/อีเมลแล้วไม่เคยกรอกเบอร์ จึงสะสมแต้มจากการซื้อหน้าร้านไม่ได้เลย —
-- แต้มต้อนรับ 100 แต้มคือแรงจูงใจให้กรอก ไม่ใช่ของแถมเปล่า ๆ
--
-- ★ ไม่ต้องยืนยันด้วย OTP ★ ตั้งใจ: SMS มีค่าใช้จ่ายต่อข้อความ และของที่ได้คือแต้ม
-- ต้อนรับก้อนเดียวที่แลกได้เฉพาะของในร้าน ไม่ใช่เงิน — ความเสี่ยงต่ำกว่าค่า SMS ที่ต้อง
-- จ่ายทุกครั้งที่มีคนสมัคร · กติกา "หนึ่งเบอร์ = หนึ่งบัญชี" (0002) กันเบอร์ซ้ำอยู่แล้ว
-- และคนที่ล็อกอินด้วยเบอร์ก็ผ่าน OTP มาตั้งแต่ต้นทางอยู่ดี

begin;

/* แจกได้ครั้งเดียวต่อบัญชี — ★ บังคับที่ฐานข้อมูล ไม่ใช่แค่เช็คในโค้ด ★ ถ้ากดรัวจนสอง
   คำขอวิ่งพร้อมกัน การเช็คก่อนแทรกจะผ่านทั้งคู่แล้วแจกสองรอบ ดัชนีนี้ทำให้ครั้งที่สอง
   เข้าไม่ได้เสมอ ไม่ว่าจะยิงมาพร้อมกันแค่ไหน */
create unique index if not exists member_points_welcome_once
  on public.member_points_ledger (user_id) where reason = 'welcome_bonus';

/**
 * สมัครสมาชิกด้วยเบอร์โทร แล้วรับแต้มต้อนรับ
 *
 * คืนค่า: jsonb { points, awarded, phone }
 *   points  = แต้มคงเหลือหลังสมัคร
 *   awarded = เพิ่งได้แต้มต้อนรับรอบนี้หรือเปล่า (ใช้เลือกข้อความให้ตรงกับที่เกิดขึ้นจริง)
 */
create or replace function public.join_membership(p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_shop uuid;
  v_digits text;
  v_e164 text;
  v_current text;
  v_awarded boolean := false;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  /* ทำให้เป็นรูปแบบเดียวกับที่ทั้งระบบใช้ (E.164 ไม่มีเครื่องหมายบวก เช่น 66812345678)
     ลูกค้าพิมพ์ 0 นำมาตามปกติของคนไทย ระบบตัดให้เอง — ห้ามให้ลูกค้าคิดแทน */
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_digits ~ '^66' then v_digits := '0' || substr(v_digits, 3); end if;
  if v_digits !~ '^0[689]\d{8}$' then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;
  v_e164 := '66' || substr(v_digits, 2);

  select shop_id, phone into v_shop, v_current
    from public.app_users where id = v_user for update;
  if v_shop is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  /* เบอร์นี้เป็นของบัญชีอื่นแล้ว — บอกให้ชัด ลูกค้าจะได้รู้ว่าต้องเข้าด้วยบัญชีเดิม
     ไม่ใช่ปล่อยให้ไปชนกฎ unique แล้วเห็น error ดิบ ๆ ที่อ่านไม่รู้เรื่อง */
  if exists (
    select 1 from public.app_users
     where shop_id = v_shop and phone = v_e164 and is_anonymized = false and id <> v_user
  ) then
    raise exception 'PHONE_TAKEN' using errcode = 'P0001';
  end if;

  if v_current is distinct from v_e164 then
    update public.app_users set phone = v_e164, updated_at = now() where id = v_user;
  end if;

  /* แต้มต้อนรับ — ดัชนีด้านบนกันซ้ำ ชนแล้วเงียบ ไม่ล้มทั้งการสมัคร เพราะเป้าหมายหลัก
     ของปุ่มนี้คือ "ผูกเบอร์ให้สำเร็จ" ส่วนแต้มเป็นของแถมที่ให้ได้ครั้งเดียวอยู่แล้ว */
  begin
    insert into public.member_points_ledger (shop_id, user_id, delta, reason)
    values (v_shop, v_user, 100, 'welcome_bonus');
    v_awarded := true;
  exception when unique_violation then
    v_awarded := false;
  end;

  return jsonb_build_object(
    'points', (select coalesce(sum(delta), 0)::int
                 from public.member_points_ledger where user_id = v_user),
    'awarded', v_awarded,
    'phone', v_e164
  );
end $$;

revoke execute on function public.join_membership(text) from public;
grant execute on function public.join_membership(text) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.join_membership(text)') is null then
    raise exception 'join_membership หายไป';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'member_points_welcome_once') then
    raise exception 'ดัชนีกันแจกแต้มต้อนรับซ้ำหายไป';
  end if;
  raise notice '0107 พร้อม — สมัครสมาชิกด้วยเบอร์ รับ 100 แต้ม';
end $$;
