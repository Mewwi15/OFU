-- เก็บผลนับแยกชนิดของทั้งตอนเปิดและตอนปิดรอบ — เจ้าของสั่ง 30 ส.ค. 2026
-- ("ผมอยากเช็คชนิดด้วยครับ ให้นับตอนเปิดและปิดรอบด้วย ว่ายอดตรงมั้ย")
--
-- เดิมตัวนับทีละใบคำนวณยอดรวมแล้วทิ้งรายละเอียดทิ้งทั้งหมด เก็บแต่ตัวเลขก้อนเดียว
-- พอเงินไม่ตรงจึงบอกได้แค่ว่า "ขาด 140" แต่บอกไม่ได้ว่าหายเป็นแบงก์อะไร
--
-- มีสองอย่างที่ได้จากการเก็บ:
--   1. เทียบเปิด/ปิดได้ว่าแต่ละชนิดขยับไปเท่าไหร่ → รู้ว่าพรุ่งนี้ต้องเตรียมแบงก์
--      ย่อยเพิ่มไหม ซึ่งเป็นประโยชน์จริงของข้อมูลชนิดแบงก์ (ยอดรวมตรงหรือไม่ตรง
--      ไม่เกี่ยวกับชนิดแบงก์เลย — ทอนแบบไหนยอดก็เท่าเดิม)
--   2. ระบบตรวจเองได้ว่าที่แจกแจงมารวมแล้วเท่ากับยอดที่กรอกจริงไหม
--
-- รูปแบบ: [{"denom":1000,"count":3},{"denom":0.25,"count":8}]
-- เก็บเป็น jsonb ไม่ทำตารางลูก เพราะมันคือภาพนิ่งของรอบนั้น ไม่มีใครต้อง query
-- ทีละชนิดข้ามรอบ และไม่ต้อง join เวลาอ่านใบสรุป

alter table public.pos_shifts
  add column if not exists opening_breakdown jsonb,
  add column if not exists closing_breakdown jsonb;

/* รวมยอดจากรายการแยกชนิด — ใช้ตรวจว่าที่แจกแจงมาตรงกับยอดที่กรอก
 * คืน null ถ้าไม่ได้ส่งรายละเอียดมา (ยังต้องรองรับ เพราะหน้าเว็บเวอร์ชันเก่าที่
 * ค้างอยู่บนเครื่องลูกค้าจะยังไม่ส่งฟิลด์นี้มาจนกว่าจะรีเฟรช) */
create or replace function public.cash_breakdown_total(p jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case when p is null then null else coalesce((
    select sum((e->>'denom')::numeric * (e->>'count')::int)
    from jsonb_array_elements(p) e
  ), 0) end;
$$;

create or replace function public.open_shift(
  p_opening_float int default 0, p_cashier_code text default null, p_breakdown jsonb default null
) returns public.pos_shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_row  public.pos_shifts;
  v_code text := nullif(btrim(coalesce(p_cashier_code, '')), '');
  v_sum  numeric := public.cash_breakdown_total(p_breakdown);
begin
  if exists (select 1 from public.pos_shifts
             where shop_id = v_shop and cashier_user_id = auth.uid() and closed_at is null) then
    raise exception 'SHIFT_ALREADY_OPEN' using errcode = 'P0001';
  end if;
  if v_code is null then
    raise exception 'CASHIER_CODE_REQUIRED' using errcode = 'P0001', detail = 'ต้องใส่รหัสพนักงาน';
  end if;
  if not public.staff_code_ok(v_code) then
    raise exception 'UNKNOWN_STAFF_CODE' using errcode = 'P0001';
  end if;
  -- ที่แจกแจงมาต้องรวมได้เท่ากับยอดที่กรอก ไม่งั้นใบที่ปริ้นจะโกหกตัวเอง
  if v_sum is not null and round(v_sum) <> greatest(coalesce(p_opening_float, 0), 0) then
    raise exception 'BREAKDOWN_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.pos_shifts (shop_id, cashier_user_id, opening_float, cashier_code, opening_breakdown)
  values (v_shop, auth.uid(), greatest(coalesce(p_opening_float, 0), 0), left(v_code, 20), p_breakdown)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.close_shift(
  p_shift_id uuid, p_counted_cash int, p_cashier_code text default null, p_breakdown jsonb default null
) returns public.pos_shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shop     uuid := public.admin_shop();
  v_row      public.pos_shifts;
  v_cash     int;
  v_expected int;
  v_code     text := nullif(btrim(coalesce(p_cashier_code, '')), '');
  v_sum      numeric := public.cash_breakdown_total(p_breakdown);
begin
  select * into v_row from public.pos_shifts where id = p_shift_id and shop_id = v_shop for update;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_row.closed_at is not null then raise exception 'SHIFT_CLOSED' using errcode = 'P0001'; end if;
  if v_code is null then
    raise exception 'CASHIER_CODE_REQUIRED' using errcode = 'P0001', detail = 'ต้องใส่รหัสพนักงาน';
  end if;
  if not public.staff_code_ok(v_code) then
    raise exception 'UNKNOWN_STAFF_CODE' using errcode = 'P0001';
  end if;
  if v_sum is not null and round(v_sum) <> coalesce(p_counted_cash, 0) then
    raise exception 'BREAKDOWN_MISMATCH' using errcode = 'P0001';
  end if;

  select coalesce(sum(total), 0) into v_cash from public.pos_sales
   where shift_id = p_shift_id
     and payment_method = 'cash'::public.pos_pay_method_t
     and status = 'completed'::public.pos_sale_status_t;
  v_expected := v_row.opening_float + v_cash;
  update public.pos_shifts set
    closed_at = now(), counted_cash = p_counted_cash,
    expected_cash = v_expected, over_short = coalesce(p_counted_cash, 0) - v_expected,
    closed_by_code = left(v_code, 20), closing_breakdown = p_breakdown
  where id = p_shift_id returning * into v_row;
  return v_row;
end $$;

-- ลายเซ็นเปลี่ยน (เพิ่มพารามิเตอร์) ตัวเก่าจึงยังค้างอยู่เป็น overload — ต้องทิ้ง
-- ไม่งั้น PostgREST เลือกไม่ถูกว่าจะเรียกตัวไหนแล้วขึ้น PGRST203
drop function if exists public.open_shift(int, text);
drop function if exists public.close_shift(uuid, int, text);

revoke execute on function public.open_shift(int, text, jsonb)         from public;
revoke execute on function public.close_shift(uuid, int, text, jsonb)  from public;
revoke execute on function public.cash_breakdown_total(jsonb)          from public;
grant execute on function public.open_shift(int, text, jsonb)          to authenticated;
grant execute on function public.close_shift(uuid, int, text, jsonb)   to authenticated;
grant execute on function public.cash_breakdown_total(jsonb)           to authenticated;
