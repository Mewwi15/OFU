-- ยกเลิก/แก้ไขใบรับเข้า ต้องถอนล็อตของใบนั้นเอง ไม่ใช่ไปกินของเก่าในคิว
--
-- เจ้าของทัก 5 ก.ย. 2026: "แต่ผมรับแค่รอบเดียวนะครับวันนี้" — แต่ในหน้าสินค้ามีสองชุด
-- ทุน ฿16 ห่างกันหนึ่งนาที เพราะ "แก้ไขใบรับเข้า" = ยกเลิกใบเดิมแล้วออกใบใหม่ (0079)
--
-- ★ ต้นตอ ★ การยกเลิกลงบรรทัดสต๊อกติดลบ ทริกเกอร์ล็อต (0103) เห็นของออกก็ตัดตามคิว FIFO
-- คือไปกินล็อต "เก่าที่สุด" — แต่ของที่ถอนคืนคือของที่เพิ่งรับเข้ามาเมื่อกี้ ผลคือล็อตของ
-- ใบที่ยกเลิกไปแล้วยังค้างเต็มจำนวนอยู่ ส่วนล็อตเก่าถูกกินฟรี ๆ ทั้งที่ของไม่ได้ออกจากร้าน
--   · ยอดรวมไม่เพี้ยน (บวกเท่ากับลบ) แต่ "ของที่เหลือเป็นทุนไหน" ผิด และตารางล็อตโผล่
--     ชุดผีที่เจ้าของไม่ได้รับเข้ามาจริง
--
-- ไฟล์นี้ทำสองอย่าง: แก้กติกาให้ถูกตั้งแต่นี้ไป + ซ่อนของที่พังไปแล้วโดยเล่นประวัติซ้ำ

begin;

/**
 * ตัดของออกจากล็อต — แยกออกมาเป็นฟังก์ชันของตัวเองเพราะทั้งทริกเกอร์และตัวซ่อมประวัติ
 * ต้องใช้กติกาชุดเดียวกันเป๊ะ ๆ ถ้าลอกไว้สองที่ วันหนึ่งมันจะเพี้ยนคนละทาง
 */
create or replace function public.consume_stock_lots(
  p_movement_id uuid,
  p_variant_id  uuid,
  p_qty         int,
  p_reason      public.stock_reason_t,
  p_receipt_id  uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_need int := p_qty;
  v_take int;
  v_cost numeric;
  rec record;
begin
  if v_need is null or v_need <= 0 then return; end if;

  -- ── ยกเลิกใบรับเข้า → ถอนออกจากล็อตของใบนั้นก่อนเสมอ ─────────────────────
  if p_reason = 'receive_void'::public.stock_reason_t and p_receipt_id is not null then
    for rec in
      select l.id, l.qty_left
        from public.stock_lots l
        join public.stock_movements m on m.id = l.movement_id
       where l.variant_id = p_variant_id
         and m.receipt_id = p_receipt_id
         and m.reason = 'receive'::public.stock_reason_t
         and l.qty_left > 0
       -- ใบเดียวลงหลายบรรทัดของสินค้าตัวเดียวกันได้ — ถอนใบหลังสุดก่อน (กลับทางกับตอนรับ)
       order by l.received_at desc, l.created_at desc
       for update of l
    loop
      exit when v_need <= 0;
      v_take := least(v_need, rec.qty_left);
      update public.stock_lots set qty_left = qty_left - v_take where id = rec.id;
      v_need := v_need - v_take;
      /* ถอนคืนหมดและยังไม่เคยถูกตัดไปขาย = ของชุดนี้ไม่เคยมีอยู่จริง ลบทิ้งเลย ไม่งั้นมันจะ
         ไปโผล่ในตารางเป็น "ชุดที่ขายหมดแล้ว" ทั้งที่เจ้าของไม่เคยได้รับของชุดนั้น */
      delete from public.stock_lots l2
       where l2.id = rec.id and l2.qty_left = 0
         and not exists (select 1 from public.stock_lot_uses u where u.lot_id = l2.id);
    end loop;
  end if;

  -- ── ที่เหลือ (หรือของออกตามปกติ) → ตัดตามคิว เก่าก่อน ────────────────────
  for rec in
    select id, qty_left, unit_cost
      from public.stock_lots
     where variant_id = p_variant_id and qty_left > 0
     order by received_at, created_at
     for update
  loop
    exit when v_need <= 0;
    v_take := least(v_need, rec.qty_left);
    update public.stock_lots set qty_left = qty_left - v_take where id = rec.id;
    insert into public.stock_lot_uses (movement_id, lot_id, variant_id, qty, unit_cost)
    values (p_movement_id, rec.id, p_variant_id, v_take, rec.unit_cost);
    v_need := v_need - v_take;
  end loop;

  -- ล็อตไม่พอ (สต๊อกนับผิด/ปรับยอดมือ) — บันทึกส่วนที่เกินด้วยทุนล่าสุด เหตุผลเดิมจาก 0103
  if v_need > 0 then
    select coalesce(cost_price, 0) into v_cost
      from public.product_variants where id = p_variant_id;
    insert into public.stock_lot_uses (movement_id, lot_id, variant_id, qty, unit_cost)
    values (p_movement_id, null, p_variant_id, v_need, coalesce(v_cost, 0));
  end if;
end $$;

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
            coalesce(new.created_at, now()));
    return new;
  end if;

  perform public.consume_stock_lots(
    new.id, new.variant_id, -new.delta_stock, new.reason, new.receipt_id);
  return new;
end $$;

/**
 * เล่นประวัติสต๊อกซ้ำเพื่อสร้างล็อตของสินค้าตัวหนึ่งใหม่ทั้งหมด
 *
 * ★ ทำไมต้องเล่นซ้ำ ไม่ใช่ไล่แก้ทีละจุด ★ ของที่ถูกกินผิดล็อตไปแล้ว ทำให้การขาย "หลังจากนั้น"
 * ไปตัดผิดล็อตต่อกันเป็นทอด ๆ การไล่ย้อนทีละรายการต้องเดาว่าอะไรควรเกิดก่อนหลัง — เล่นซ้ำ
 * จากสมุดสต๊อกซึ่งเป็นบันทึกจริงได้ผลลัพธ์เดียวกับที่ควรจะเป็นถ้ากติกาถูกมาตั้งแต่ต้น
 *
 * เล่นซ้ำเฉพาะช่วงที่ระบบล็อตดูแล (ตั้งแต่ 0103) — ก่อนหน้านั้นไม่มีข้อมูลทุนรายล็อตให้เล่น
 * จุดตั้งต้นคือ "ล็อตยกมาตอนเริ่มระบบ" ที่ 0103 สร้างไว้ ตั้งค่ากลับเป็นเต็มจำนวนแล้วเดินใหม่
 */
create or replace function public.rebuild_stock_lots(p_variant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_cost numeric;
  mv record;
begin
  /* บรรทัดสต๊อกที่ "อยู่ในยุคล็อต" ดูจากการที่มันเคยสร้างล็อตหรือเคยตัดล็อต — ต้องเก็บ
     รายการไว้ก่อนลบ ไม่งั้นพอลบแล้วจะไม่รู้ว่าต้องเล่นซ้ำถึงบรรทัดไหน */
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
              coalesce(mv.created_at, now()));
    else
      perform public.consume_stock_lots(
        mv.id, mv.variant_id, -mv.delta_stock, mv.reason, mv.receipt_id);
    end if;
  end loop;
end $$;

revoke execute on function public.consume_stock_lots(uuid, uuid, int, public.stock_reason_t, uuid) from public;
revoke execute on function public.rebuild_stock_lots(uuid) from public;

commit;

-- ═══ ซ่อมของที่พังไปแล้ว ═════════════════════════════════════════════════════
-- เฉพาะสินค้าที่เคยมีการยกเลิกใบรับเข้าหลังระบบล็อตเริ่มทำงาน — ตัวอื่นไม่ต้องแตะ
do $$
declare
  v record;
  v_lots int;
  v_stock int;
  v_fixed int := 0;
begin
  for v in
    select distinct m.variant_id
      from public.stock_movements m
     where m.reason = 'receive_void'::public.stock_reason_t
       and exists (select 1 from public.stock_lot_uses u where u.movement_id = m.id)
  loop
    perform public.rebuild_stock_lots(v.variant_id);
    v_fixed := v_fixed + 1;

    select coalesce(sum(qty_left), 0) into v_lots
      from public.stock_lots where variant_id = v.variant_id;
    select stock_qty into v_stock
      from public.product_variants where id = v.variant_id;
    /* ไม่ raise exception ทิ้งทั้งไมเกรชัน — ถ้ายอดไม่ตรงแปลว่าสมุดสต๊อกกับยอดคงเหลือเพี้ยน
       กันมาก่อนหน้านี้แล้ว ซึ่งเป็นคนละเรื่องกับบั๊กนี้ และการล้มไมเกรชันจะทำให้กติกาที่
       แก้แล้วไม่ได้ขึ้นใช้ ปล่อยขึ้นแล้วบอกไว้ให้ตามดูดีกว่า */
    if v_lots <> coalesce(v_stock, 0) then
      raise warning 'ซ่อมล็อตแล้วยอดยังไม่ตรง variant=% ล็อตรวม=% สต๊อก=%',
        v.variant_id, v_lots, v_stock;
    end if;
  end loop;
  raise notice '0105 พร้อม — ยกเลิกใบรับเข้าถอนล็อตของตัวเอง · ซ่อมย้อนหลัง % รายการ', v_fixed;
end $$;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.consume_stock_lots(uuid,uuid,int,public.stock_reason_t,uuid)') is null then
    raise exception 'consume_stock_lots หายไป';
  end if;
  if to_regprocedure('public.rebuild_stock_lots(uuid)') is null then
    raise exception 'rebuild_stock_lots หายไป';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'apply_stock_lot_movement_t') then
    raise exception 'ทริกเกอร์ล็อตหายไป';
  end if;
end $$;
