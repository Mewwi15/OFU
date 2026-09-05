-- ต้นทุนแบบล็อต (FIFO) ขั้นที่ 2 — กำไรใช้ทุนจากล็อตจริง ไม่ใช่ทุนล่าสุด
--
-- 0076 เก็บ "ทุน ณ ตอนขาย" ลงบรรทัดบิลไว้แล้ว (pos_sale_items.unit_cost /
-- order_items.unit_cost) ซึ่งถูกทางแล้ว — แต่ค่าที่เก็บมาจาก product_variants.cost_price
-- คือ "ทุนล่าสุด" ซึ่งเป็นต้นตอของปัญหาที่เจ้าของจับได้พอดี:
--
--   รับของใหม่ทุน ฿12 วันที่ 1 → cost_price กลายเป็น 12 ทันที
--   ขายของเก่า (ที่ซื้อมา ฿10) วันที่ 2 → บิลบันทึกทุน ฿12
--   กำไรของบิลนั้นต่ำกว่าความจริง ทั้งที่ของชิ้นนั้นต้นทุน ฿10 จริง ๆ
--
-- ★ แก้ที่จุดเดียว ★ เปลี่ยนแค่ "ทุนที่เก็บลงบรรทัด" ให้มาจากล็อตหน้าคิว (FIFO) —
-- รายงานกำไรทุกตัว (profit_report 0076, รายงานรอบขาย 0091) อ่านคอลัมน์เดิม จึงถูกต้อง
-- ตามไปเองทั้งหมดโดยไม่ต้องแก้รายงานสักตัว
--
-- ★ อ่านล็อตเฉย ๆ ไม่ตัด ★ การตัดล็อตจริงเกิดตอนสต๊อกขยับ (ทริกเกอร์ใน 0103) ตัวนี้แค่
-- คำนวณว่า "ถ้าตัดตามคิวตอนนี้ ทุนเฉลี่ยจะเป็นเท่าไหร่" — ทำงานก่อนสต๊อกขยับในธุรกรรม
-- เดียวกัน ตัวเลขจึงตรงกับที่ล็อตถูกตัดจริงเสมอ

begin;

/**
 * ทุนเฉลี่ยของ p_qty ชิ้นถัดไปตามคิว FIFO ของสินค้าตัวนั้น
 *
 * ขายคร่อมสองล็อตได้ (เหลือ 10 ที่ ฿10 ขาย 12 → (10×10 + 2×12) / 12 = ฿10.33)
 * ของไม่พอในล็อต ส่วนที่เกินคิดด้วยทุนล่าสุด — เหตุผลเดียวกับใน 0103 คือสต๊อกนับผิด
 * เกิดขึ้นจริง และการคืน null กลับไปจะทำให้รายงานนับบรรทัดนั้นเป็น "ไม่มีทุน"
 */
create or replace function public.fifo_unit_cost(p_variant_id uuid, p_qty int)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  v_need int := greatest(coalesce(p_qty, 0), 0);
  v_take int;
  v_sum numeric := 0;
  v_counted int := 0;
  v_fallback numeric;
  rec record;
begin
  if v_need = 0 then return null; end if;

  for rec in
    select qty_left, unit_cost
      from public.stock_lots
     where variant_id = p_variant_id and qty_left > 0
     order by received_at, created_at
  loop
    exit when v_need <= 0;
    v_take := least(v_need, rec.qty_left);
    v_sum := v_sum + v_take * rec.unit_cost;
    v_counted := v_counted + v_take;
    v_need := v_need - v_take;
  end loop;

  -- ไม่มีล็อตเลย (สินค้าที่ยังไม่เคยรับเข้า) — ปล่อยให้ผู้เรียกใช้ทุนล่าสุดตามเดิม
  if v_counted = 0 then return null; end if;

  if v_need > 0 then
    select coalesce(cost_price, 0) into v_fallback
      from public.product_variants where id = p_variant_id;
    v_sum := v_sum + v_need * coalesce(v_fallback, 0);
    v_counted := v_counted + v_need;
  end if;

  return round(v_sum / v_counted, 4);
end $$;

/**
 * เก็บทุน ณ ตอนขายลงบรรทัดบิล — ใช้ทุนจากล็อตก่อน ตกลงมาที่ทุนล่าสุดถ้าไม่มีล็อต
 *
 * แทนที่ตัวเดิมจาก 0076 ซึ่งอ่าน cost_price ตรง ๆ · ชื่อฟังก์ชันเดิม ทริกเกอร์เดิมทั้งสอง
 * ตัวจึงใช้ต่อได้โดยไม่ต้องสร้างใหม่
 */
create or replace function public.snapshot_line_cost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.unit_cost is null and new.variant_id is not null then
    new.unit_cost := public.fifo_unit_cost(new.variant_id, new.qty);
    if new.unit_cost is null then
      select cost_price into new.unit_cost
      from public.product_variants where id = new.variant_id;
    end if;
  end if;
  return new;
end $$;

grant execute on function public.fifo_unit_cost(uuid, int) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.fifo_unit_cost(uuid,int)') is null then
    raise exception 'fifo_unit_cost หายไป';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_cost_pos_sale_items') then
    raise exception 'ทริกเกอร์เก็บทุนของบิล POS หายไป';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_cost_order_items') then
    raise exception 'ทริกเกอร์เก็บทุนของออเดอร์แอปหายไป';
  end if;
  raise notice '0104 พร้อม — กำไรใช้ทุนจากล็อต FIFO';
end $$;
