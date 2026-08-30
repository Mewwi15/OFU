-- เปิดลิ้นชักเปล่า (no-sale) — บันทึกว่าใครกด ตอนไหน เพราะอะไร
--
-- เจ้าของสั่งเพิ่ม 30 ส.ค. 2026 พร้อมกับปุ่มเปิดลิ้นชักเปล่า เหตุผลคือจังหวะนี้เป็น
-- จังหวะเดียวที่ลิ้นชักเปิดโดยไม่มีรายการขายผูกอยู่ ถ้าเงินหายแล้วไม่มีร่องรอยตรงนี้
-- ก็ไล่ไม่ได้เลยว่าหายช่วงไหน ร้านค้าปลีกจึงนับ "จำนวนครั้งที่เปิดเปล่า" เป็นสัญญาณ
-- เตือนมาตรฐาน โดยเฉพาะเวลามันกระจุกอยู่กับคนใดคนหนึ่งหรือกับรอบที่เงินขาด
--
-- ไม่สร้างตารางใหม่ — audit_log มีอยู่แล้วตั้งแต่ 0002 และมีครบทุกช่องที่ต้องใช้
-- (ใคร/บทบาท/เมื่อไหร่/ทำอะไร/อ้างถึงอะไร) เขียนผ่าน write_audit() ตัวเดิมเพื่อให้
-- actor_role กับ actor_tier ถูกเติมเหมือนกับ mutation อื่นทุกตัว

-- บันทึกหนึ่งครั้งที่กดเปิดลิ้นชักเปล่า แล้วคืนจำนวนครั้งสะสมของรอบที่เปิดอยู่
-- ให้หน้าจอเอาไปแสดงได้ทันทีโดยไม่ต้องยิงอ่านซ้ำ
create or replace function public.log_drawer_open(p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop   uuid := public.admin_shop();
  v_shift  public.pos_shifts;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_count  int;
begin
  -- ผูกกับรอบที่เปิดอยู่ของคนกด ถ้ายังไม่เปิดรอบก็ยังบันทึกได้ (เปิดลิ้นชักนอกรอบ
  -- ยิ่งน่าสนใจกว่าเดิม) แค่ไม่มี target ให้อ้าง
  select * into v_shift from public.pos_shifts
   where shop_id = v_shop and cashier_user_id = auth.uid() and closed_at is null
   order by opened_at desc limit 1;

  perform public.write_audit(
    v_shop,
    'no_sale_drawer',
    'pos_shifts',
    v_shift.id::text,
    case when v_reason is null then 'เปิดลิ้นชักเปล่า'
         else 'เปิดลิ้นชักเปล่า — ' || left(v_reason, 120) end
  );

  if v_shift.id is null then
    return jsonb_build_object('shift_id', null, 'count', null);
  end if;

  select count(*) into v_count from public.audit_log a
   where a.shop_id = v_shop
     and a.action = 'no_sale_drawer'
     and a.created_at >= v_shift.opened_at;

  return jsonb_build_object('shift_id', v_shift.id, 'count', v_count);
end $$;

-- รายการเปิดเปล่าของรอบหนึ่ง ๆ ให้หน้าเปิด-ปิดรอบแสดง — ต้องเห็นชื่อคนกด ไม่งั้น
-- ตัวเลขเฉย ๆ ไม่ช่วยอะไร แต่ยังคุมอยู่ในร้านตัวเองด้วย admin_shop()
create or replace function public.list_drawer_opens(p_shift_id uuid)
returns table (at timestamptz, who text, note text)
language sql security definer set search_path = '' as $$
  select a.created_at,
         coalesce(nullif(btrim(u.display_name), ''), 'ไม่ทราบชื่อ'),
         a.summary
    from public.audit_log a
    left join public.app_users u on u.id = a.actor_user_id
    join public.pos_shifts s on s.id = p_shift_id and s.shop_id = a.shop_id
   where a.shop_id = public.admin_shop()
     and a.action = 'no_sale_drawer'
     and a.created_at >= s.opened_at
     and a.created_at <= coalesce(s.closed_at, now())
   order by a.created_at desc;
$$;

revoke execute on function public.log_drawer_open(text) from public;
revoke execute on function public.list_drawer_opens(uuid) from public;
grant execute on function public.log_drawer_open(text) to authenticated;
grant execute on function public.list_drawer_opens(uuid) to authenticated;
