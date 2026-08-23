-- 0075_shift_close_flow.sql
-- อู้ฟู่ (Oofoo) — เปิด-ปิดรอบขาย (นับลิ้นชัก) ใช้งานได้จริง
--
-- open_shift/close_shift มีมาตั้งแต่ 0019 แต่ไม่เคยมีหน้าจอเรียก และที่แย่กว่า:
-- create_pos_sale (0065) บันทึก shift_id = null ตายตัว — ต่อให้เปิดรอบ บิลก็ไม่
-- ผูกกับรอบ ยอด "เงินสดที่ควรมี" ตอนปิดรอบจะเท่ากับเงินตั้งต้นเสมอ
--
--   1. trigger เติม shift_id ให้บิลอัตโนมัติ — จับรอบที่เปิดอยู่ของแคชเชียร์คนนั้น
--      (เลือก trigger แทนการ recreate create_pos_sale ทั้งก้อน: ฟังก์ชันนั้นยาว
--      และเคยผ่านการแก้บั๊กเงินมาหลายรอบ ไม่แตะถ้าไม่จำเป็น — แนวเดียวกับ 0073)
--      บิลออฟไลน์ที่ sync หลังปิดรอบ = shift_id ว่างตามจริง (เงินไม่ได้อยู่ในรอบนั้น)
--   2. close_shift v2 — รวมเงินสด COD ที่เก็บระหว่างรอบด้วย (ร้านคนเดียว เงิน
--      เดลิเวอรี่ลงลิ้นชักเดียวกัน — ตรรกะเดียวกับ pos_dashboard ที่รวม COD เข้า cash)

begin;

-- ── 1. บิลใหม่ผูกรอบที่เปิดอยู่เสมอ ─────────────────────────────────────────
create or replace function public.attach_pos_shift()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.shift_id is null and new.cashier_user_id is not null then
    select s.id into new.shift_id
    from public.pos_shifts s
    where s.shop_id = new.shop_id
      and s.cashier_user_id = new.cashier_user_id
      and s.closed_at is null
    order by s.opened_at desc
    limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_attach_pos_shift on public.pos_sales;
create trigger trg_attach_pos_shift
  before insert on public.pos_sales
  for each row execute function public.attach_pos_shift();

-- ── 2. ปิดรอบ: เงินที่ควรมี = ตั้งต้น + เงินสด POS ในรอบ + COD ที่เก็บช่วงรอบ ──
create or replace function public.close_shift(p_shift_id uuid, p_counted_cash int)
returns public.pos_shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_row public.pos_shifts; v_cash int; v_cod int; v_expected int;
begin
  select * into v_row from public.pos_shifts where id = p_shift_id and shop_id = v_shop for update;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_row.closed_at is not null then raise exception 'SHIFT_CLOSED' using errcode = 'P0001'; end if;

  select coalesce(sum(total), 0) into v_cash from public.pos_sales
   where shift_id = p_shift_id
     and payment_method = 'cash'::public.pos_pay_method_t
     and status = 'completed'::public.pos_sale_status_t;

  -- เงินสดปลายทางที่เก็บระหว่างรอบ — ลงกระเป๋า/ลิ้นชักเดียวกัน (ร้านคนเดียว)
  select coalesce(sum(cod_amount), 0) into v_cod from public.orders
   where shop_id = v_shop
     and cod_collected_at >= v_row.opened_at
     and cod_collected_at < now();

  v_expected := v_row.opening_float + v_cash + v_cod;
  update public.pos_shifts set
    closed_at = now(), counted_cash = p_counted_cash,
    expected_cash = v_expected, over_short = coalesce(p_counted_cash, 0) - v_expected
  where id = p_shift_id returning * into v_row;
  return v_row;
end $$;

-- (สิทธิ์ execute ของ close_shift คงเดิมจาก 0019 — create or replace ไม่ล้าง grant)

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_attach_pos_shift') then
    raise exception 'trigger ผูกบิลกับรอบหายไป';
  end if;
  if to_regprocedure('public.close_shift(uuid,int)') is null then
    raise exception 'close_shift หายไป';
  end if;
  raise notice '0075 พร้อม — เปิดรอบ/ปิดรอบใช้งานได้จริง บิลผูกรอบอัตโนมัติ';
end $$;
