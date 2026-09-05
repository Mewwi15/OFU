-- พิสูจน์ 0105 — ยกเลิก/แก้ไขใบรับเข้าต้องถอนล็อตของใบนั้นเอง
--
-- เคสจริงที่เจ้าของเจอ 5 ก.ย. 2026: รับของรอบเดียว แล้วกดแก้ไขใบ (= ยกเลิก + ออกใบใหม่)
-- ผลที่ได้คือหน้าสินค้ามีสองชุดทุนเท่ากัน ทั้งที่ของเข้ามาชุดเดียว
--
-- รัน (เครื่องตัวเองเท่านั้น — ทุกอย่างถูก rollback ทิ้งตอนจบ):
--   docker exec -i supabase_db_my-rn-app psql -U postgres -v ON_ERROR_STOP=1 \
--     < scripts/test-0105-receive-void-lots.sql

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_shop uuid;
  v_product uuid;
  v_variant uuid;
  v_r1 uuid;
  v_r2 uuid;
  v_mv uuid;
  v_open uuid;
  v_lots int;
  v_rows int;
  v_open_left int;
  v_cost numeric;
begin
  -- ── เตรียมของ: สินค้าหนึ่งตัว มีของเก่าค้างอยู่ 10 ชิ้น ทุน ฿15 ───────────
  select id into v_shop from public.shops limit 1;
  insert into public.products (shop_id, name) values (v_shop, 'ทดสอบล็อต 0105')
    returning id into v_product;
  insert into public.product_variants (product_id, price, cost_price, stock_qty)
    values (v_product, 20, 15, 10) returning id into v_variant;
  insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
    values (v_variant, 15, 10, 10, null, timestamptz '2000-01-01') returning id into v_open;

  insert into public.goods_receipts (shop_id, receipt_number) values (v_shop, 'INTEST-001')
    returning id into v_r1;
  insert into public.goods_receipts (shop_id, receipt_number) values (v_shop, 'INTEST-002')
    returning id into v_r2;

  -- ══ ฉาก ก. กติกาใหม่ ════════════════════════════════════════════════════
  -- 1) รับเข้า 6 ชิ้น ทุน ฿16 ตามใบที่ 1
  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, unit_cost, created_at)
    values (v_variant, 6, 'receive', v_r1, 16, now() - interval '10 min');
  update public.product_variants set stock_qty = stock_qty + 6, cost_price = 16 where id = v_variant;

  select count(*) into v_rows from public.stock_lots where variant_id = v_variant;
  if v_rows <> 2 then raise exception 'ก1: ควรมี 2 ล็อต (ยกมา + ใบที่ 1) แต่ได้ %', v_rows; end if;

  -- 2) กดแก้ไขใบ = ยกเลิกใบที่ 1 (สต๊อกถอนคืน 6)
  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, created_at)
    values (v_variant, -6, 'receive_void', v_r1, now() - interval '9 min');
  update public.product_variants set stock_qty = stock_qty - 6 where id = v_variant;

  select count(*) into v_rows from public.stock_lots where variant_id = v_variant;
  select qty_left into v_open_left from public.stock_lots where id = v_open;
  if v_rows <> 1 then
    raise exception 'ก2: ล็อตของใบที่ยกเลิกต้องหายไป เหลือแค่ล็อตยกมา แต่มี % ล็อต', v_rows;
  end if;
  if v_open_left <> 10 then
    raise exception 'ก2: ล็อตเก่าต้องไม่ถูกแตะ (ของไม่ได้ออกจากร้าน) แต่เหลือ %', v_open_left;
  end if;

  -- 3) บันทึกเป็นใบใหม่ 6 ชิ้น ทุน ฿16
  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, unit_cost, created_at)
    values (v_variant, 6, 'receive', v_r2, 16, now() - interval '8 min');
  update public.product_variants set stock_qty = stock_qty + 6 where id = v_variant;

  -- 4) ขายไป 9 ชิ้น — ต้องกินของเก่า (฿15) ก่อนจนหมด แล้วค่อยแตะของใหม่
  insert into public.stock_movements (variant_id, delta_stock, reason, created_at)
    values (v_variant, -9, 'commit_confirmed', now() - interval '5 min');
  update public.product_variants set stock_qty = stock_qty - 9 where id = v_variant;

  select count(*), coalesce(sum(qty_left), 0) into v_rows, v_lots
    from public.stock_lots where variant_id = v_variant;
  select qty_left into v_open_left from public.stock_lots where id = v_open;
  if v_rows <> 2 then raise exception 'ก4: ควรเหลือ 2 ล็อต แต่ได้ %', v_rows; end if;
  if v_lots <> 7 then raise exception 'ก4: ล็อตรวมต้องเท่าสต๊อก 7 แต่ได้ %', v_lots; end if;
  if v_open_left <> 1 then raise exception 'ก4: ของเก่าต้องเหลือ 1 แต่เหลือ %', v_open_left; end if;

  select unit_cost into v_cost from public.stock_lots
   where variant_id = v_variant and qty_left > 0 order by received_at limit 1;
  if v_cost <> 15 then raise exception 'ก4: ชุดที่กำลังขายต้องเป็นทุน ฿15 แต่ได้ %', v_cost; end if;

  raise notice 'ฉาก ก. ผ่าน — ยกเลิกใบแล้วล็อตของใบนั้นหายไป ของเก่าไม่ถูกแตะ';

  -- ══ ฉาก ข. ซ่อมของที่พังไปแล้ว ══════════════════════════════════════════
  -- สร้างสภาพก่อนแก้ขึ้นมาใหม่: ยกเลิกใบแล้วไปกินล็อตเก่าตามคิว (พฤติกรรมเดิมของ 0103)
  delete from public.stock_lot_uses where variant_id = v_variant;
  delete from public.stock_lots where variant_id = v_variant;
  delete from public.stock_movements where variant_id = v_variant;
  update public.product_variants set stock_qty = 10, cost_price = 15 where id = v_variant;
  insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
    values (v_variant, 15, 10, 10, null, timestamptz '2000-01-01') returning id into v_open;

  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, unit_cost, created_at)
    values (v_variant, 6, 'receive', v_r1, 16, now() - interval '10 min');
  update public.product_variants set stock_qty = stock_qty + 6, cost_price = 16 where id = v_variant;

  alter table public.stock_movements disable trigger apply_stock_lot_movement_t;
  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, created_at)
    values (v_variant, -6, 'receive_void', v_r1, now() - interval '9 min') returning id into v_mv;
  alter table public.stock_movements enable trigger apply_stock_lot_movement_t;
  -- ตัดแบบเดิม: ไม่รู้จักการยกเลิก เลยไปกินล็อตเก่าสุดในคิว
  perform public.consume_stock_lots(v_mv, v_variant, 6, 'admin_adjust'::public.stock_reason_t, null);
  update public.product_variants set stock_qty = stock_qty - 6 where id = v_variant;

  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, unit_cost, created_at)
    values (v_variant, 6, 'receive', v_r2, 16, now() - interval '8 min');
  update public.product_variants set stock_qty = stock_qty + 6 where id = v_variant;

  insert into public.stock_movements (variant_id, delta_stock, reason, created_at)
    values (v_variant, -9, 'commit_confirmed', now() - interval '5 min');
  update public.product_variants set stock_qty = stock_qty - 9 where id = v_variant;

  -- สภาพพัง: ของเก่าโดนกินเกลี้ยง เหลือชุดผีทุน ฿16 สองชุด (ตรงกับที่เจ้าของเห็น)
  select count(*) into v_rows from public.stock_lots where variant_id = v_variant and qty_left > 0;
  select qty_left into v_open_left from public.stock_lots where id = v_open;
  if v_rows <> 2 or v_open_left <> 0 then
    raise exception 'ข1: สร้างสภาพพังไม่สำเร็จ (ล็อตค้าง % · ของเก่าเหลือ %)', v_rows, v_open_left;
  end if;

  -- ซ่อม
  perform public.rebuild_stock_lots(v_variant);

  select count(*), coalesce(sum(qty_left), 0) into v_rows, v_lots
    from public.stock_lots where variant_id = v_variant;
  select qty_left into v_open_left from public.stock_lots where id = v_open;
  if v_lots <> 7 then raise exception 'ข2: ซ่อมแล้วล็อตรวมต้องเท่าสต๊อก 7 แต่ได้ %', v_lots; end if;
  if v_rows <> 2 then raise exception 'ข2: ซ่อมแล้วควรเหลือ 2 ล็อต (ยกมา + ใบใหม่) แต่ได้ %', v_rows; end if;
  if v_open_left <> 1 then raise exception 'ข2: ซ่อมแล้วของเก่าต้องเหลือ 1 แต่เหลือ %', v_open_left; end if;
  if exists (
    select 1 from public.stock_lots l join public.stock_movements m on m.id = l.movement_id
     where l.variant_id = v_variant and m.receipt_id = v_r1
  ) then
    raise exception 'ข2: ล็อตของใบที่ยกเลิกยังอยู่';
  end if;

  raise notice 'ฉาก ข. ผ่าน — เล่นประวัติซ้ำแล้วชุดผีหายไป ของเก่ากลับมาเป็นชุดที่กำลังขาย';

  -- ══ ฉาก ค. ยกเลิกทั้งที่ขายไปบางส่วนแล้ว ═══════════════════════════════
  delete from public.stock_lot_uses where variant_id = v_variant;
  delete from public.stock_lots where variant_id = v_variant;
  delete from public.stock_movements where variant_id = v_variant;
  update public.product_variants set stock_qty = 10, cost_price = 15 where id = v_variant;
  insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
    values (v_variant, 15, 10, 10, null, timestamptz '2000-01-01') returning id into v_open;

  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, unit_cost, created_at)
    values (v_variant, 6, 'receive', v_r1, 16, now() - interval '10 min');
  update public.product_variants set stock_qty = stock_qty + 6, cost_price = 16 where id = v_variant;

  -- ขาย 12 → กินของเก่า 10 แล้วต่อด้วยของใหม่ 2 (เหลือใบที่ 1 อยู่ 4)
  insert into public.stock_movements (variant_id, delta_stock, reason, created_at)
    values (v_variant, -12, 'commit_confirmed', now() - interval '7 min');
  update public.product_variants set stock_qty = stock_qty - 12 where id = v_variant;

  -- แล้วค่อยยกเลิกใบ: ถอนได้ 4 จากล็อตของใบเอง ที่เหลือ 0 (สต๊อกมี 4 พอดี)
  insert into public.stock_movements (variant_id, delta_stock, reason, receipt_id, created_at)
    values (v_variant, -4, 'receive_void', v_r1, now() - interval '6 min');
  update public.product_variants set stock_qty = stock_qty - 4 where id = v_variant;

  select coalesce(sum(qty_left), 0) into v_lots from public.stock_lots where variant_id = v_variant;
  if v_lots <> 0 then raise exception 'ค1: ล็อตรวมต้องเป็น 0 แต่ได้ %', v_lots; end if;
  -- ล็อตที่เคยถูกขายไปบางส่วนต้องยังอยู่ (เป็นประวัติจริงว่าเคยขายของทุนนั้นไป)
  if not exists (
    select 1 from public.stock_lots l join public.stock_movements m on m.id = l.movement_id
     where l.variant_id = v_variant and m.receipt_id = v_r1
  ) then
    raise exception 'ค1: ล็อตที่ขายไปแล้วบางส่วนไม่ควรถูกลบ (เสียประวัติทุนที่ขายจริง)';
  end if;

  raise notice 'ฉาก ค. ผ่าน — ยกเลิกหลังขายไปบางส่วน ถอนเท่าที่มี ประวัติที่ขายจริงยังอยู่';
end $$;

rollback;
