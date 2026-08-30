-- ระบบพนักงาน — เจ้าของสั่ง 30 ส.ค. 2026 ("ทำระบบพนักงานเลยครับ")
--
-- 0085 เพิ่มช่องรหัสพนักงานบนรอบขาย แต่เป็นช่องให้พิมพ์เฉย ๆ ใครพิมพ์อะไรก็ผ่าน
-- ระบบไม่รู้ว่า 07 เป็นของใคร และไม่มีอะไรกันพนักงานพิมพ์รหัสคนอื่น เจ้าของถามว่า
-- "รหัสพนักงานดูตรงไหน" — ตอบว่าดูได้แต่จัดการไม่ได้ จึงทำให้มันมีความหมายจริง
--
-- ตารางนี้ทำให้ได้สามอย่าง: มีที่ตั้งว่ารหัสไหนเป็นของใคร · ใส่รหัสมั่วเปิดรอบไม่ได้
-- · ประวัติแสดงชื่อคนแทนตัวเลข

create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  code       text not null,
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, code)
);

alter table public.staff enable row level security;
create index if not exists staff_shop_ix on public.staff (shop_id, active);

-- อ่านได้เฉพาะแอดมินของร้านตัวเอง ผ่าน RPC เท่านั้น ไม่เปิด grant ตรงให้ตาราง
create or replace function public.list_staff()
returns setof public.staff language sql security definer set search_path = '' as $$
  select * from public.staff where shop_id = public.admin_shop() order by active desc, code;
$$;

create or replace function public.upsert_staff(
  p_id uuid default null, p_code text default null,
  p_name text default null, p_active boolean default true
) returns public.staff language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_row  public.staff;
begin
  if not exists (select 1 from public.app_users
                 where id = auth.uid() and admin_tier = 'owner'::public.admin_tier_t) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_code is null or v_code !~ '^[0-9]{1,20}$' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'staff_code_format';
  end if;
  if v_name is null then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'staff_name_required';
  end if;

  begin
    if p_id is null then
      insert into public.staff (shop_id, code, name, active)
      values (v_shop, v_code, v_name, coalesce(p_active, true)) returning * into v_row;
    else
      update public.staff set code = v_code, name = v_name, active = coalesce(p_active, true)
       where id = p_id and shop_id = v_shop returning * into v_row;
      if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    end if;
  exception when unique_violation then
    raise exception 'DUPLICATE_STAFF_CODE' using errcode = 'P0001';
  end;

  perform public.write_audit(v_shop, 'upsert_staff', 'staff', v_row.id::text,
                             'พนักงาน ' || v_row.code || ' ' || v_row.name);
  return v_row;
end $$;

-- ลบได้จริง ไม่ใช่ soft delete เพราะรอบเก่าเก็บรหัสเป็นข้อความของตัวเอง (0085)
-- ประวัติจึงไม่หายไปด้วย · ถ้าแค่พักงานชั่วคราวให้ปิด active แทน
create or replace function public.delete_staff(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_row public.staff;
begin
  if not exists (select 1 from public.app_users
                 where id = auth.uid() and admin_tier = 'owner'::public.admin_tier_t) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  delete from public.staff where id = p_id and shop_id = v_shop returning * into v_row;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.write_audit(v_shop, 'delete_staff', 'staff', p_id::text,
                             'ลบพนักงาน ' || v_row.code || ' ' || v_row.name);
end $$;

/* ตรวจว่ารหัสนี้ใช้เปิดรอบได้ไหม
 *
 * ยังไม่ได้เพิ่มพนักงานสักคน = ผ่านทุกรหัส — ต้องเป็นแบบนี้ ไม่งั้นร้านที่อัปเดต
 * ระบบมาจะเปิดรอบไม่ได้เลยจนกว่าจะไปเพิ่มพนักงานก่อน ซึ่งแปลว่าขายของไม่ได้
 * (หลักเดียวกับรหัสหลังร้านใน 0086) หน้าจอมีหน้าที่บอกให้เจ้าของรู้ว่ายังไม่ได้ตั้ง
 */
create or replace function public.staff_code_ok(p_code text)
returns boolean language sql security definer set search_path = '' as $$
  select not exists (select 1 from public.staff where shop_id = public.admin_shop())
      or exists (select 1 from public.staff
                  where shop_id = public.admin_shop()
                    and code = btrim(coalesce(p_code, '')) and active);
$$;

revoke execute on function public.list_staff()                       from public;
revoke execute on function public.upsert_staff(uuid, text, text, boolean) from public;
revoke execute on function public.delete_staff(uuid)                 from public;
revoke execute on function public.staff_code_ok(text)                from public;
grant execute on function public.list_staff()                        to authenticated;
grant execute on function public.upsert_staff(uuid, text, text, boolean) to authenticated;
grant execute on function public.delete_staff(uuid)                  to authenticated;
grant execute on function public.staff_code_ok(text)                 to authenticated;

-- ── บังคับที่ RPC เปิด/ปิดรอบ ไม่ใช่แค่ที่หน้าจอ ─────────────────────────────
create or replace function public.open_shift(p_opening_float int default 0, p_cashier_code text default null)
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
  if not public.staff_code_ok(v_code) then
    raise exception 'UNKNOWN_STAFF_CODE' using errcode = 'P0001';
  end if;
  insert into public.pos_shifts (shop_id, cashier_user_id, opening_float, cashier_code)
  values (v_shop, auth.uid(), greatest(coalesce(p_opening_float, 0), 0), left(v_code, 20))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.close_shift(p_shift_id uuid, p_counted_cash int, p_cashier_code text default null)
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
  if not public.staff_code_ok(v_code) then
    raise exception 'UNKNOWN_STAFF_CODE' using errcode = 'P0001';
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
