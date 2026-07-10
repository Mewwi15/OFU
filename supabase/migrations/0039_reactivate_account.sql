-- 0039_reactivate_account.sql
-- อู้ฟู่ (Oofoo) — ปลุกบัญชีที่เคยกด "ลบบัญชี" ให้กลับมาใช้งานได้
--
-- delete_my_account (0015) ล้าง PII และปิดบัญชี (deactivated) แต่ตัว login ใน
-- auth.users ยังอยู่ → สมัครซ้ำด้วยเมลเดิมไม่ได้ และ login ได้แต่สั่งซื้อไม่ได้
-- (ACCOUNT_INACTIVE) = ลูกค้าที่เปลี่ยนใจกลับมาไม่ได้เลย
--
-- ทางออก: การ "เข้าสู่ระบบสำเร็จ" ด้วยบัญชีเดิมคือการพิสูจน์ตัวตน + เจตนากลับมาใช้
-- แอปเรียก RPC นี้หลัง login; ถ้าบัญชีถูกปิดจากการลบ → เปิดกลับเป็น active
-- (PII ที่ล้างไปแล้วไม่ถูกกู้คืน — ผู้ใช้กรอกโปรไฟล์/ที่อยู่ใหม่เอง)
-- ปลอดภัย: ทำงานเฉพาะบัญชีของผู้เรียกเอง และเฉพาะสถานะ deactivated เท่านั้น
-- (บัญชี pending ของ admin/rider ที่รอเปิดใช้ ไม่ถูกแตะ)

create or replace function public.reactivate_my_account()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_state public.account_state_t;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select account_state into v_state from public.app_users where id = v_uid;
  if v_state is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_state <> 'deactivated'::public.account_state_t then
    return jsonb_build_object('reactivated', false, 'state', v_state);
  end if;

  update public.app_users set
    account_state  = 'active'::public.account_state_t,
    deactivated_at = null,
    display_name   = coalesce(nullif(display_name, 'ผู้ใช้ที่ลบบัญชี'), 'คุณอู้ฟู่')
  where id = v_uid;

  return jsonb_build_object('reactivated', true, 'state', 'active');
end $$;

revoke execute on function public.reactivate_my_account() from public;
grant execute on function public.reactivate_my_account() to authenticated;
