-- ทำให้ระบบสมาชิกครบวง — เจ้าของสั่ง 5 ก.ย. 2026 ให้ทำสามข้อที่ค้าง
--   1. หลังร้านสร้าง/แก้ของรางวัลได้
--   2. แคชเชียร์กดยืนยันว่าจ่ายของรางวัลให้ลูกค้าแล้ว (ปิดงานได้)
--   3. POS ผูกบิลกับบัญชีลูกค้าเพื่อให้แต้มเดิน
--
-- 0100 ทำฝั่งลูกค้าไว้ครบแล้ว (ดูแต้ม กดแลก ได้โค้ด) แต่ไม่มีทางฝั่งร้านเลย — ลูกค้า
-- จึงเห็นแต้มขึ้นแต่แลกอะไรไม่ได้ และโค้ดที่แลกไปแล้วค้างเป็น "รอรับ" ตลอดไป

-- ─────────────────────────────────────────────────────────────────────────────
-- ของรางวัล (ฝั่งแอดมิน) — สูตรเดียวกับ upsert_banner ใน 0006
-- admin_shop() เป็นตัวกันไม่ให้คนที่ไม่ใช่แอดมินเขียน ต่อให้เรียกฟังก์ชันตรง ๆ
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_member_reward(
  p_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_image_path text default null,
  p_points_cost int default null,
  p_stock int default null,
  p_display_order int default 0,
  p_publish_state public.publish_state_t default 'draft'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name required';
  end if;
  if coalesce(p_points_cost, 0) <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'points required';
  end if;

  if p_id is null then
    insert into public.member_rewards (
      shop_id, name, description, image_path, points_cost, stock, display_order, publish_state
    ) values (
      v_shop, p_name, p_description, p_image_path, p_points_cost, p_stock,
      coalesce(p_display_order, 0),
      coalesce(p_publish_state, 'draft'::public.publish_state_t)
    ) returning id into v_id;
  else
    update public.member_rewards set
      name = p_name,
      description = p_description,
      image_path = p_image_path,
      points_cost = p_points_cost,
      stock = p_stock,
      display_order = coalesce(p_display_order, display_order),
      publish_state = coalesce(p_publish_state, publish_state)
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_member_reward', 'member_rewards', v_id::text, 'reward');
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.delete_member_reward(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  /* ★ ลบไม่ได้ถ้ามีคนแลกไปแล้ว ★ โค้ดที่ลูกค้าถืออยู่ชี้มาที่ของรางวัลใบนี้ ลบทิ้งแล้ว
     ลูกค้าจะยื่นโค้ดที่ไม่มีของรองรับ และประวัติแต้มที่หักไปจะอธิบายไม่ได้ว่าหักค่าอะไร
     ให้ปิดการแสดง (publish_state = draft) แทน */
  if exists (select 1 from public.member_redemptions where reward_id = p_id) then
    raise exception 'IN_USE' using errcode = 'P0001', detail = 'reward has redemptions';
  end if;
  delete from public.member_rewards where id = p_id and shop_id = v_shop returning id into v_id;
  if v_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.write_audit(v_shop, 'delete_member_reward', 'member_rewards', p_id::text, 'deleted');
  return jsonb_build_object('id', p_id, 'deleted', true);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- แคชเชียร์ปิดงานแลกของ
-- ─────────────────────────────────────────────────────────────────────────────

/** ดูรายละเอียดโค้ดก่อนกดยืนยัน — แคชเชียร์ต้องเห็นว่าจะจ่ายอะไรให้ใคร */
create or replace function public.find_redemption(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_row record;
begin
  select r.id, r.code, r.status, r.points_cost, r.created_at,
         w.name as reward_name, u.display_name as customer_name
    into v_row
    from public.member_redemptions r
    join public.member_rewards w on w.id = r.reward_id
    left join public.app_users u on u.id = r.user_id
   where r.shop_id = v_shop and upper(btrim(r.code)) = upper(btrim(p_code));
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message_th', 'ไม่พบโค้ดนี้');
  end if;
  return jsonb_build_object(
    'ok', true, 'id', v_row.id, 'code', v_row.code, 'status', v_row.status,
    'points_cost', v_row.points_cost, 'reward_name', v_row.reward_name,
    'customer_name', v_row.customer_name, 'created_at', v_row.created_at
  );
end $$;

/**
 * ยืนยันว่าจ่ายของรางวัลให้ลูกค้าแล้ว
 *
 * ★ กดซ้ำต้องไม่ผ่าน ★ ใบที่ปิดไปแล้วต้องตอบว่า "รับไปแล้ว" ไม่ใช่ปิดซ้ำเงียบ ๆ —
 * ไม่งั้นลูกค้ายื่นโค้ดเดิมสองรอบแล้วได้ของสองชิ้น แคชเชียร์ไม่มีทางรู้เลย
 * แต้มถูกตัดไปตั้งแต่ตอนกดแลกแล้ว ที่นี่จึงไม่แตะแต้ม แค่ปิดสถานะ
 */
create or replace function public.collect_redemption(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_row record;
begin
  select r.*, w.name as reward_name into v_row
    from public.member_redemptions r
    join public.member_rewards w on w.id = r.reward_id
   where r.shop_id = v_shop and upper(btrim(r.code)) = upper(btrim(p_code))
   for update of r;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message_th', 'ไม่พบโค้ดนี้');
  end if;
  if v_row.status = 'collected' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY',
      'message_th', 'โค้ดนี้รับของไปแล้ว');
  end if;
  if v_row.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'CANCELLED',
      'message_th', 'โค้ดนี้ถูกยกเลิกไปแล้ว');
  end if;

  update public.member_redemptions
     set status = 'collected', collected_at = now()
   where id = v_row.id;
  perform public.write_audit(v_shop, 'collect_redemption', 'member_redemptions',
                             v_row.id::text, v_row.reward_name);
  return jsonb_build_object('ok', true, 'reward_name', v_row.reward_name);
end $$;

grant execute on function public.upsert_member_reward(uuid, text, text, text, int, int, int, public.publish_state_t) to authenticated;
grant execute on function public.delete_member_reward(uuid) to authenticated;
grant execute on function public.find_redemption(text) to authenticated;
grant execute on function public.collect_redemption(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- POS หาลูกค้าจาก "คิวอาร์สมาชิก" ได้ด้วย
-- คิวอาร์เข้ารหัสเป็นเบอร์โทรตามที่หน้าสมาชิกทำไว้ แต่มาในรูป +66… ส่วนที่เก็บใน
-- ฐานข้อมูลเป็น 66… หรือ 0… แล้วแต่ทาง — ทำให้ฟังก์ชันเดิมรับได้ทุกรูปแบบ แทนที่จะ
-- ให้แคชเชียร์มานั่งเดาว่าต้องพิมพ์แบบไหน
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.normalize_phone(p_phone text)
returns text language sql immutable set search_path = '' as $$
  -- เหลือแต่ตัวเลข แล้วตัดรหัสประเทศไทยออกให้เป็นเลขในประเทศเสมอ (0812345678)
  select case
    when digits like '66%' and length(digits) = 11 then '0' || substr(digits, 3)
    when digits like '0%' then digits
    when length(digits) = 9 then '0' || digits
    else digits
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits) t;
$$;
grant execute on function public.normalize_phone(text) to authenticated;

/**
 * ค้นลูกค้าแบบไม่แคร์รูปแบบเบอร์ + คืนแต้มสะสมมาด้วย
 *
 * ★ เดิมเทียบเบอร์แบบตรงตัวเป๊ะ ★ คิวอาร์สมาชิกในแอปเข้ารหัสเป็น "+66943973385" ส่วนที่
 * เก็บในฐานข้อมูลเป็น "66943973385" — สแกนแล้วหาไม่เจอทั้งที่เป็นคนเดียวกัน และแคชเชียร์
 * ก็ไม่มีทางรู้ว่าต้องพิมพ์แบบไหนถึงจะเจอ · เทียบด้วยเลขที่ตัดรูปแบบทิ้งแล้วทั้งสองฝั่ง
 *
 * คืนแต้มมาด้วยเพื่อให้แคชเชียร์บอกลูกค้าได้ทันทีว่ามีกี่แต้ม โดยไม่ต้องเปิดอีกหน้า
 */
create or replace function public.find_customer_by_phone(p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_u record; v_bal int; v_points int;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select id, display_name, phone into v_u
  from public.app_users
  where public.normalize_phone(phone) = public.normalize_phone(p_phone)
    and role = 'customer'::public.role_t
  order by created_at limit 1;
  if v_u.id is null then return null; end if;

  select coalesce(sum(delta), 0) into v_bal
  from public.store_credit_ledger where user_id = v_u.id and shop_id = v_shop;
  select coalesce(sum(delta), 0) into v_points
  from public.member_points_ledger where user_id = v_u.id and shop_id = v_shop;

  return jsonb_build_object(
    'user_id', v_u.id, 'display_name', v_u.display_name, 'phone', v_u.phone,
    'balance', v_bal, 'points', v_points
  );
end $$;
