-- รหัสพนักงานบนรอบขาย — เจ้าของสั่ง 30 ส.ค. 2026 ("ใส่รหัสด้วย รหัสพนักงานนะครับ")
--
-- ระบบเดิมรู้แค่ cashier_user_id คือบัญชีที่ล็อกอินค้างไว้บนเครื่อง POS ซึ่งใน
-- ร้านจริงมีบัญชีเดียวแล้วทุกคนใช้ร่วมกัน — พอเงินขาดจึงชี้ไม่ได้ว่าใครอยู่หน้า
-- เครื่องตอนนั้น รหัสพนักงานเป็นตัวแยกคนออกจากบัญชี และเป็นคนละคนกันได้ระหว่าง
-- เปิดกับปิดรอบ (เข้ากะเช้าคนหนึ่ง ปิดร้านอีกคนหนึ่ง) จึงเก็บสองช่อง
--
-- ตั้งใจไม่ทำตารางพนักงานกับระบบตรวจรหัส ณ ตอนนี้ — ร้านเดียว ไม่กี่คน และเจ้าของ
-- ยังไม่ได้สั่ง สิ่งที่ต้องการตอนนี้คือร่องรอยบนกระดาษกับในฐานข้อมูลว่าใครอยู่เวรนั้น

alter table public.pos_shifts
  add column if not exists cashier_code   text,   -- คนเปิดรอบ
  add column if not exists closed_by_code text;   -- คนปิดรอบ (คนละคนได้)

-- เปลี่ยนลายเซ็นฟังก์ชัน จึงต้อง drop ก่อน ไม่งั้นจะกลายเป็น overload ซ้อนกัน
-- แล้ว PostgREST เลือกไม่ถูกว่าจะเรียกตัวไหน
drop function if exists public.open_shift(int);
drop function if exists public.close_shift(uuid, int);

create function public.open_shift(p_opening_float int default 0, p_cashier_code text default null)
returns public.pos_shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_row  public.pos_shifts;
  v_code text := nullif(btrim(coalesce(p_cashier_code, '')), '');
begin
  if exists (select 1 from public.pos_shifts
             where shop_id = v_shop and cashier_user_id = auth.uid() and closed_at is null) then
    raise exception 'SHIFT_ALREADY_OPEN' using errcode = 'P0001';
  end if;
  if v_code is null then
    raise exception 'CASHIER_CODE_REQUIRED' using errcode = 'P0001', detail = 'ต้องใส่รหัสพนักงาน';
  end if;
  insert into public.pos_shifts (shop_id, cashier_user_id, opening_float, cashier_code)
  values (v_shop, auth.uid(), greatest(coalesce(p_opening_float, 0), 0), left(v_code, 20))
  returning * into v_row;
  return v_row;
end $$;

create function public.close_shift(p_shift_id uuid, p_counted_cash int, p_cashier_code text default null)
returns public.pos_shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shop     uuid := public.admin_shop();
  v_row      public.pos_shifts;
  v_cash     int;
  v_expected int;
  v_code     text := nullif(btrim(coalesce(p_cashier_code, '')), '');
begin
  select * into v_row from public.pos_shifts where id = p_shift_id and shop_id = v_shop for update;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_row.closed_at is not null then raise exception 'SHIFT_CLOSED' using errcode = 'P0001'; end if;
  if v_code is null then
    raise exception 'CASHIER_CODE_REQUIRED' using errcode = 'P0001', detail = 'ต้องใส่รหัสพนักงาน';
  end if;
  select coalesce(sum(total), 0) into v_cash from public.pos_sales
   where shift_id = p_shift_id
     and payment_method = 'cash'::public.pos_pay_method_t
     and status = 'completed'::public.pos_sale_status_t;
  v_expected := v_row.opening_float + v_cash;
  update public.pos_shifts set
    closed_at = now(), counted_cash = p_counted_cash,
    expected_cash = v_expected, over_short = coalesce(p_counted_cash, 0) - v_expected,
    closed_by_code = left(v_code, 20)
  where id = p_shift_id returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.open_shift(int, text) from public;
revoke execute on function public.close_shift(uuid, int, text) from public;
grant execute on function public.open_shift(int, text) to authenticated;
grant execute on function public.close_shift(uuid, int, text) to authenticated;

-- คอลัมน์ใหม่ต้อง grant ด้วยมือ — select(*) ของ PostgREST ใช้ column grant ไม่ได้
-- สืบทอดมาจาก grant เดิมของตาราง (บทเรียนเดียวกับ 0069c/0081)
grant select (cashier_code, closed_by_code) on public.pos_shifts to authenticated;
