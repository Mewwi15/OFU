-- อุดรูการกระทบยอดเงินสดในลิ้นชัก — เจ้าของสั่ง 30 ส.ค. 2026 ("ลุยเลยครับ อุดทั้ง 4 รู")
--
-- เดิม close_shift คิดว่า  ควรมี = เงินตั้งต้น + sum(total) ของบิลที่ payment_method='cash'
-- ซึ่งผิดสี่ทาง ทำให้ยอดไม่มีทางตรงต่อให้แคชเชียร์ทำถูกทุกอย่าง:
--
--   1. บิลแบ่งจ่าย — จ่ายสด 500 + โอน 500 นับเป็นเงินสดทั้งบิล 1,000 → ขาด 500 ทุกครั้ง
--      (pos_sale_payments เก็บแยกวิธีไว้ครบอยู่แล้วตั้งแต่แรก แต่ไม่มีใครเรียกใช้)
--   2. คืนเงิน — คืนสดออกจากลิ้นชักจริง แต่สูตรไม่หัก → ขึ้นว่าขาด
--   3. COD — pos_dashboard บวกเข้าไปในช่อง cash แต่ close_shift ไม่บวก → ตัวเลขที่
--      เจ้าของเห็นทั้งวันกับตัวเลขที่ใช้ตัดสินตอนปิดรอบเป็นคนละตัว
--   4. เงินเข้า-ออกระหว่างวัน — เอาไปฝากธนาคาร จ่ายค่าของ เติมเงินทอน ระบบไม่รู้เลย
--
-- รูที่ 4 ต้องมีที่เก็บใหม่ ที่เหลือแก้สูตรอย่างเดียว
--
-- หลังจากนี้ "ขาด/เกิน" จะแปลว่าเงินหายจริง ๆ ไม่ใช่ระบบจดไม่ครบเหมือนก่อน

-- ── รูที่ 4: เงินเข้า-ออกระหว่างรอบ ──────────────────────────────────────────
-- ต่อยอดจากปุ่ม "เปิดลิ้นชักเปล่า" (0084) ที่บันทึกว่าใครเปิดแต่ไม่ได้ถามจำนวนเงิน
create table if not exists public.pos_cash_movements (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  shift_id      uuid references public.pos_shifts(id) on delete set null,
  direction     text not null check (direction in ('in', 'out')),
  amount        int  not null check (amount > 0),
  reason        text not null,
  cashier_code  text,
  actor_user_id uuid references public.app_users(id),
  created_at    timestamptz not null default now()
);
alter table public.pos_cash_movements enable row level security;
create index if not exists pos_cash_movements_shift_ix on public.pos_cash_movements (shift_id, created_at);

create or replace function public.record_cash_movement(
  p_direction text, p_amount int, p_reason text, p_cashier_code text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop  uuid := public.admin_shop();
  v_shift public.pos_shifts;
  v_code  text := nullif(btrim(coalesce(p_cashier_code, '')), '');
begin
  if p_direction not in ('in', 'out') then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'direction';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'amount_positive';
  end if;

  select * into v_shift from public.pos_shifts
   where shop_id = v_shop and cashier_user_id = auth.uid() and closed_at is null
   order by opened_at desc limit 1;

  insert into public.pos_cash_movements (shop_id, shift_id, direction, amount, reason, cashier_code, actor_user_id)
  values (v_shop, v_shift.id, p_direction, p_amount,
          left(coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'ไม่ระบุเหตุผล'), 120),
          v_code, auth.uid());

  perform public.write_audit(v_shop,
    case when p_direction = 'in' then 'cash_in' else 'cash_out' end,
    'pos_cash_movements', coalesce(v_shift.id::text, '-'),
    (case when p_direction = 'in' then 'นำเงินเข้าลิ้นชัก ' else 'นำเงินออกจากลิ้นชัก ' end) || p_amount || ' บาท');

  return jsonb_build_object('shift_id', v_shift.id);
end $$;

create or replace function public.list_cash_movements(p_shift_id uuid)
returns table (at timestamptz, direction text, amount int, reason text, who text)
language sql security definer set search_path = '' as $$
  select m.created_at, m.direction, m.amount, m.reason,
         coalesce(nullif(btrim(u.display_name), ''), m.cashier_code, 'ไม่ทราบชื่อ')
    from public.pos_cash_movements m
    left join public.app_users u on u.id = m.actor_user_id
   where m.shop_id = public.admin_shop() and m.shift_id = p_shift_id
   order by m.created_at desc;
$$;

-- ── สูตรกระทบยอด ที่เดียวสำหรับทั้งจอระหว่างวัน ตอนปิดรอบ และใบที่ปริ้น ────────
-- เดิมจอกับตอนปิดรอบคำนวณคนละที่ด้วยคนละสูตร จึงเพี้ยนกันได้เงียบ ๆ
create or replace function public.shift_cash_summary(p_shift_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop     uuid := public.admin_shop();
  v_row      public.pos_shifts;
  v_to       timestamptz;
  v_sales    bigint;
  v_refunds  bigint;
  v_cod      bigint;
  v_in       bigint;
  v_out      bigint;
begin
  select * into v_row from public.pos_shifts where id = p_shift_id and shop_id = v_shop;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_to := coalesce(v_row.closed_at, now());

  /* รูที่ 1 — เงินสดต้องมาจากยอดที่จ่ายสดจริงรายวิธี ไม่ใช่ยอดรวมทั้งบิล
     นับบิลที่คืนเงินไปแล้วด้วย (status='refunded') เพราะเงินเคยเข้าลิ้นชักจริง
     แล้วค่อยไปหักตอนคืนข้างล่าง ไม่งั้นบิลที่คืนเต็มจำนวนจะหายไปทั้งขาเข้าและขาออก
     ส่วน voided คือรายการที่ไม่เคยเกิด ตัดทิ้งทั้งคู่ */
  select coalesce(sum(pp.amount), 0) into v_sales
    from public.pos_sale_payments pp
    join public.pos_sales s on s.id = pp.sale_id
   where s.shift_id = p_shift_id
     and s.status <> 'voided'::public.pos_sale_status_t
     and pp.method = 'cash'::public.pos_pay_method_t;

  /* รูที่ 2 — คืนเงิน หักตามสัดส่วนที่บิลนั้นจ่ายสดมา บิลที่จ่ายโอนล้วนคืนไปก็ไม่
     กระทบลิ้นชัก จึงต้องคิดตามสัดส่วน ไม่ใช่หักเต็มจำนวนทุกใบ */
  select coalesce(sum(
           s.refunded_amount * (
             coalesce((select sum(pp.amount) from public.pos_sale_payments pp
                        where pp.sale_id = s.id
                          and pp.method = 'cash'::public.pos_pay_method_t), 0)::numeric
             / nullif(s.total, 0)
           )
         ), 0)::bigint into v_refunds
    from public.pos_sales s
   where s.shift_id = p_shift_id
     and s.status <> 'voided'::public.pos_sale_status_t
     and s.refunded_amount > 0;

  -- รูที่ 3 — COD ใช้นิยามเดียวกับ pos_dashboard เป๊ะ ๆ จอกับตอนปิดจะได้ไม่เพี้ยนกัน
  select coalesce(sum(o.cod_amount), 0) into v_cod
    from public.orders o
   where o.shop_id = v_shop
     and o.cod_collected_at >= v_row.opened_at and o.cod_collected_at < v_to;

  -- รูที่ 4
  select coalesce(sum(amount) filter (where direction = 'in'), 0),
         coalesce(sum(amount) filter (where direction = 'out'), 0)
    into v_in, v_out
    from public.pos_cash_movements where shift_id = p_shift_id;

  return jsonb_build_object(
    'opening',   v_row.opening_float,
    'sales',     v_sales,
    'cod',       v_cod,
    'refunds',   v_refunds,
    'paid_in',   v_in,
    'paid_out',  v_out,
    'expected',  v_row.opening_float + v_sales + v_cod - v_refunds + v_in - v_out
  );
end $$;

create or replace function public.close_shift(
  p_shift_id uuid, p_counted_cash int, p_cashier_code text default null, p_breakdown jsonb default null
) returns public.pos_shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shop     uuid := public.admin_shop();
  v_row      public.pos_shifts;
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

  v_expected := (public.shift_cash_summary(p_shift_id) ->> 'expected')::int;

  update public.pos_shifts set
    closed_at = now(), counted_cash = p_counted_cash,
    expected_cash = v_expected, over_short = coalesce(p_counted_cash, 0) - v_expected,
    closed_by_code = left(v_code, 20), closing_breakdown = p_breakdown
  where id = p_shift_id returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.record_cash_movement(text, int, text, text) from public;
revoke execute on function public.list_cash_movements(uuid)                   from public;
revoke execute on function public.shift_cash_summary(uuid)                    from public;
grant execute on function public.record_cash_movement(text, int, text, text)  to authenticated;
grant execute on function public.list_cash_movements(uuid)                    to authenticated;
grant execute on function public.shift_cash_summary(uuid)                     to authenticated;
