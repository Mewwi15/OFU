-- ใบรับเข้าที่ลงวันที่ย้อนหลัง ต้องเข้าคิว FIFO ตามวันรับจริง ไม่ใช่วันที่คีย์ใบ
--
-- ★ ต้นตอ ★ ทริกเกอร์ล็อต (0103 · 0105:98-100) ประทับ received_at ของล็อตด้วย
-- coalesce(new.created_at, now()) ซึ่งคือ "เวลาที่คีย์ใบ" ไม่ใช่ "วันที่รับของ" —
-- 0078 เปิดให้ใบรับเข้าลงวันย้อนหลังได้ และเก็บวันรับจริงไว้ที่หัวใบ
-- (goods_receipts.received_at) ที่เดียว ตอน insert stock_movements ไม่ได้ส่งลงไปด้วย
-- ของเก่าที่เก็บตกมาคีย์ตามหลังจึงไปต่อท้ายคิว แทนที่จะอยู่หน้าคิวตามวันจริง
--   · จำนวนสต๊อกและเงินสดไม่เพี้ยน สิ่งที่เพี้ยนคือ "ของที่ตัดขายไปเป็นทุนของล็อตไหน"
--     → ทุนที่เก็บลงบรรทัดบิล (0104 fifo_unit_cost/snapshot_line_cost) และรายงานกำไร
--       (0076 · 0091) เพี้ยนตามไปทุกใบจนกว่าล็อตนั้นจะหมด
--   · ตารางล็อตหน้าสินค้าโชว์ "รับเข้าเมื่อ" เป็นวันคีย์ ไม่ตรงกับวันในใบรับเข้า
-- คอมเมนต์ของดัชนี stock_lots_fifo_ix (0103:33-34) เขียนกติกานี้ไว้ตั้งแต่แรกแล้ว
-- ("เรียงตามวันรับเข้า ไม่ใช่วันที่สร้างแถว เพราะใบรับเข้าลงวันที่ย้อนหลังได้") —
-- แต่ตัวที่เขียนค่าลงไปไม่เคยทำตาม
--
-- ★ ทำไมไม่ยัดวันรับจริงลง stock_movements.created_at ★ คอลัมน์นั้นคือไทม์ไลน์ของ
-- "สมุดสต๊อก" ซึ่งมีคนอื่นใช้อยู่ — ดัชนี stock_movements_variant_ix (variant_id,
-- created_at) ที่ 0002 และ get_goods_receipt_lines ที่ order by m.created_at (0074)
-- ถ้าย้อนวันตรงนั้น ลำดับเหตุการณ์ในสมุดจะสลับและประวัติของใบจะอ่านผิด ให้ล็อตไปอ่าน
-- วันจากหัวใบผ่าน receipt_id แทน แล้วปล่อย created_at ไว้เป็นเวลาที่คีย์เหมือนเดิม
--
-- ไฟล์นี้แก้ทั้งทริกเกอร์และตัวซ่อมประวัติ — rebuild_stock_lots (0105:152-154) ประทับ
-- วันคีย์แบบเดียวกัน ถ้าแก้แต่ทริกเกอร์ การสั่งซ่อมย้อนหลังจะเอาวันผิดกลับมาอีก

begin;

/**
 * วันรับของจริงของบรรทัดสมุดสต๊อกหนึ่งบรรทัด
 *
 * ★ แยกเป็นฟังก์ชันเพราะทั้งทริกเกอร์และตัวซ่อมประวัติต้องใช้กติกาเดียวกันเป๊ะ ★
 * (เหตุผลเดียวกับ consume_stock_lots ใน 0105 — ลอกไว้สองที่เมื่อไหร่ วันหนึ่งมันจะ
 *  เพี้ยนคนละทาง แล้วสั่งซ่อมแล้วยิ่งพัง)
 *
 * บรรทัดที่ไม่ได้มาจากใบรับเข้า (ปรับยอดมือ / ของคืนจากลูกค้า) ไม่มีวันในเอกสารให้ใช้
 * จึงตกกลับมาที่เวลาที่บันทึกตามเดิม
 */
create or replace function public.movement_received_at(
  p_receipt_id uuid,
  p_created_at timestamptz
) returns timestamptz language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select gr.received_at from public.goods_receipts gr where gr.id = p_receipt_id),
    p_created_at,
    now());
$$;

revoke execute on function public.movement_received_at(uuid, timestamptz) from public;

/**
 * สมุดสต๊อกขยับ → ล็อตขยับตาม (ตัวเดิมจาก 0105 เปลี่ยนเฉพาะวันที่ประทับลงล็อต)
 */
create or replace function public.apply_stock_lot_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_cost numeric;
begin
  if new.delta_stock is null or new.delta_stock = 0 then
    return new;
  end if;

  if new.delta_stock > 0 then
    select coalesce(new.unit_cost, v.cost_price, 0) into v_cost
      from public.product_variants v where v.id = new.variant_id;
    insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
    values (new.variant_id, coalesce(v_cost, 0), new.delta_stock, new.delta_stock, new.id,
            public.movement_received_at(new.receipt_id, new.created_at));
    return new;
  end if;

  perform public.consume_stock_lots(
    new.id, new.variant_id, -new.delta_stock, new.reason, new.receipt_id);
  return new;
end $$;

/**
 * เล่นประวัติสต๊อกซ้ำ (ตัวเดิมจาก 0105 เปลี่ยนเฉพาะวันที่ประทับลงล็อต)
 *
 * ★ ลำดับการเล่นซ้ำยังเป็น created_at เหมือนเดิม ไม่ใช่วันรับจริง ★ เพราะของที่คีย์
 * ตามหลังยังไม่มีอยู่ในระบบตอนที่บิลก่อนหน้าถูกขาย จะให้บิลเก่าไปตัดล็อตที่ยังไม่เข้า
 * ระบบไม่ได้ — ที่ต้องย้อนคือ "ตำแหน่งในคิว" ของล็อตนั้นนับจากตอนที่มันเข้ามาแล้วเท่านั้น
 */
create or replace function public.rebuild_stock_lots(p_variant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_cost numeric;
  mv record;
begin
  select array_agg(id) into v_ids from (
    select movement_id as id from public.stock_lots
     where variant_id = p_variant_id and movement_id is not null
    union
    select movement_id from public.stock_lot_uses where variant_id = p_variant_id
  ) s;

  delete from public.stock_lot_uses where variant_id = p_variant_id;
  delete from public.stock_lots where variant_id = p_variant_id and movement_id is not null;
  update public.stock_lots set qty_left = qty_in
   where variant_id = p_variant_id and movement_id is null;

  if v_ids is null then return; end if;

  for mv in
    select * from public.stock_movements
     where id = any(v_ids)
     order by created_at, id
  loop
    if mv.delta_stock is null or mv.delta_stock = 0 then
      continue;
    elsif mv.delta_stock > 0 then
      select coalesce(mv.unit_cost, v.cost_price, 0) into v_cost
        from public.product_variants v where v.id = mv.variant_id;
      insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
      values (mv.variant_id, coalesce(v_cost, 0), mv.delta_stock, mv.delta_stock, mv.id,
              public.movement_received_at(mv.receipt_id, mv.created_at));
    else
      perform public.consume_stock_lots(
        mv.id, mv.variant_id, -mv.delta_stock, mv.reason, mv.receipt_id);
    end if;
  end loop;
end $$;

revoke execute on function public.rebuild_stock_lots(uuid) from public;

commit;

-- ═══ ซ่อมของที่พังไปแล้ว ═════════════════════════════════════════════════════
-- เฉพาะสินค้าที่มีล็อตซึ่งวันที่ประทับไว้ไม่ตรงกับวันในหัวใบรับเข้า — ตัวอื่นไม่ต้องแตะ
-- เผื่อไว้เกิน 1 นาทีเพราะใบที่คีย์วันเดียวกันห่างกันแค่เสี้ยววินาที (received_at ของหัวใบ
-- กับ created_at ของบรรทัดถูกบันทึกคนละจังหวะในธุรกรรมเดียวกัน) ไม่ใช่ใบย้อนหลัง
-- รันซ้ำได้: รอบสองจะไม่เจอแถวไหนแล้วเพราะวันตรงกันหมด
do $$
declare
  v record;
  v_lots int;
  v_stock int;
  v_fixed int := 0;
begin
  for v in
    select distinct l.variant_id
      from public.stock_lots l
      join public.stock_movements m on m.id = l.movement_id
      join public.goods_receipts gr on gr.id = m.receipt_id
     where m.reason = 'receive'::public.stock_reason_t
       and abs(extract(epoch from (gr.received_at - l.received_at))) > 60
  loop
    perform public.rebuild_stock_lots(v.variant_id);
    v_fixed := v_fixed + 1;

    select coalesce(sum(qty_left), 0) into v_lots
      from public.stock_lots where variant_id = v.variant_id;
    select stock_qty into v_stock
      from public.product_variants where id = v.variant_id;
    /* ไม่ raise exception ทิ้งทั้งไมเกรชัน — เหตุผลเดียวกับ 0105:189-191 ถ้ายอดไม่ตรง
       แปลว่าสมุดสต๊อกกับยอดคงเหลือเพี้ยนกันมาก่อนแล้ว ซึ่งเป็นคนละเรื่องกับบั๊กนี้ และ
       การล้มไมเกรชันจะทำให้กติกาที่แก้แล้วไม่ได้ขึ้นใช้ */
    if v_lots <> coalesce(v_stock, 0) then
      raise warning 'ซ่อมคิวล็อตแล้วยอดยังไม่ตรง variant=% ล็อตรวม=% สต๊อก=%',
        v.variant_id, v_lots, v_stock;
    end if;
  end loop;
  raise notice '0116 พร้อม — ล็อตเข้าคิวตามวันรับจริง · ซ่อมย้อนหลัง % รายการ', v_fixed;
end $$;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
declare v_left int;
begin
  if to_regprocedure('public.movement_received_at(uuid,timestamptz)') is null then
    raise exception 'movement_received_at หายไป';
  end if;
  if to_regprocedure('public.rebuild_stock_lots(uuid)') is null then
    raise exception 'rebuild_stock_lots หายไป';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'apply_stock_lot_movement_t') then
    raise exception 'ทริกเกอร์ล็อตหายไป';
  end if;
  -- ทริกเกอร์ตัวใหม่ต้องอ่านวันจากหัวใบ ไม่ใช่ created_at เปล่า ๆ
  if not exists (
    select 1 from pg_proc
     where proname = 'apply_stock_lot_movement'
       and prosrc like '%movement_received_at%'
  ) then
    raise exception 'ทริกเกอร์ล็อตยังประทับวันที่คีย์ใบอยู่';
  end if;
  select count(*) into v_left
    from public.stock_lots l
    join public.stock_movements m on m.id = l.movement_id
    join public.goods_receipts gr on gr.id = m.receipt_id
   where m.reason = 'receive'::public.stock_reason_t
     and abs(extract(epoch from (gr.received_at - l.received_at))) > 60;
  if v_left > 0 then
    raise warning 'ยังมีล็อตที่วันไม่ตรงกับหัวใบอีก % ชุด — ตามดูด้วย', v_left;
  end if;
end $$;
