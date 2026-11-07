-- อู้ฟู่ — sync 2026-08-08 · ไฟล์ที่ 3/4 : สร้างสินค้าใหม่ 162 รายการ
--
-- เข้าเป็นสถานะ "ร่าง" — ยังไม่ขายในแอปจนกว่าจะกดเผยแพร่เอง
-- DO block = คำสั่งเดียว = atomic · รันซ้ำได้ ไม่ดับเบิล (เช็คบาร์โค้ดทุกตัว)
-- ต้องรันไฟล์ที่ 1 ก่อน

do $$
declare v_pid uuid; v_vid uuid; v_n int := 0;
begin
  if not exists (select 1 from public.product_variants where barcode = '0020') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ข้าวไข่เจียว 15 โล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 630, 4, '0020', 610, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 630, 610, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0021') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซองจดหมายสี ซองละ 1 บาท', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 1, 500, '0021', 0.32, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 500, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 1, 0.32, 500, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0022') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซองจดหมายสีขาว 1 บาท', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 1, 500, '0022', 0.28, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 500, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 1, 0.28, 500, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0024') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ธูปสั้นสัปปะรด', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 2, '0024', 20, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 20, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0025') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ธูปสั้นเจ้าแม่กวนอิม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 2, '0025', 15, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 15, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0026') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'ไมดี้ 1 บาท', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 1, 22, '0026', 0.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 22, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 1, 0.83, 22, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0027') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'จูปาจุ๊บ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 3, 50, '0027', 2.3, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 50, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 3, 2.3, 50, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0028') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ยาแปกผง', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 15, 12, '0028', 11.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 15, 11.67, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0029') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ยาหอมฤาษีทรงม้า', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '0029', 4.58, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.58, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0030') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'เห็ดหอม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 10, 5, '0030', 8, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 5, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 10, 8, 5, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '0032') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เท็นจัง 1 บาท', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 1, 60, '0032', 0.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 60, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 1, 0.83, 60, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4005808828869') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'นีเวียคูลคิก 50 มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 99, 0, '4005808828869', 80, 'ชิ้น')
    returning id into v_vid;
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 99, 80, 0, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4902430417860') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ดาวน์นี่ดอกไม้แสนน่ารัก450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 18, '4902430417860', 34.44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 34.44, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4902430628204') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'เฮดแอนโชว์เดอร์60มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 4, '4902430628204', 17.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 17.83, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4902430694124') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แอมปิเพอร์กลิ่นลาเวนเดอร์', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 69, 2, '4902430694124', 56.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 69, 56.33, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4902430694131') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แอมปิเพอร์กลิ่นเลม่อนเฟรช', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 69, 3, '4902430694131', 56.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 69, 56.33, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4902430694186') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แอมปิเพอร์โรแมนติกโรส', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 69, 3, '4902430694186', 56.3, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 69, 56.3, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4902430883740') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แอมปิเพอร์เจลเฟรช', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 69, 2, '4902430883740', 59.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 69, 59.5, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4987176060792') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ดาวน์นี่กลิ่นหอมยามเช้า450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 18, '4987176060792', 34.44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 34.44, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4987176060846') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ดาวน์นี่สวนดอกไม้450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 18, '4987176060846', 34.44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 34.44, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4987176077011') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ดาวน์นี่มิสทีค450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 18, '4987176077011', 34.44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 34.44, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4987176077028') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ดาวน์นี่แพชชั่น450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 18, '4987176077028', 34.44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 34.44, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4987176137012') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ดาวน์นี่กลิ่นคอตตอน 450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 18, '4987176137012', 34.44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 34.44, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '4987176138804') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แขมพูรีจอย70มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 6, '4987176138804', 13.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 13.33, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64848917') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'เคลียร์ซากุระเฟรช350มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 89, 4, '64848917', 65, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 89, 65, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64895347') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แชมพูโดฟสีทอง 360 ml.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 115, 1, '64895347', 66.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 115, 66.67, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64895351') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ครีมนวดโดฟสีทอง 320 ml.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 115, 1, '64895351', 66.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 115, 66.67, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64931256LB1') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซันซิลแชมพูสีชมพู 325 ml.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 89, 12, '64931256LB1', 56.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 89, 56.67, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64931258LB1') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แชมพูซันซิลสีเขียว 325 ml.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 89, 12, '64931258LB1', 56.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 89, 56.67, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64970346') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แชมพูโดฟไมเซล่าสีชมพู 360 ml.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 115, 10, '64970346', 66.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 115, 66.67, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64985854') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'เคลียร์แอปเปิ้ล350มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 89, 4, '64985854', 65, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 89, 65, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '64985864') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'เคลียร์เมนน้ำเงิน350มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 89, 4, '64985864', 65, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 89, 65, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8801073113312') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'Buldak เหลือง แบบซอง140กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 5, '8801073113312', 36, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 5, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 36, 5, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8801073113893') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'Buldak ชมพู แบบซอง140กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 5, '8801073113893', 36, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 5, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 36, 5, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8801073140578') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'Buldak ดำ แบบแพ็ก 700 กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 239, 7, '8801073140578', 180, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 7, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 239, 180, 7, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8801073141780') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'Buldak เหลือง แบบแพ็ก 700 กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 239, 7, '8801073141780', 180, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 7, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 239, 180, 7, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8801073142312') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'Buldak ชมพู แบบแพ็ก 700 กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 239, 7, '8801073142312', 180, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 7, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 239, 180, 7, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002006577') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโคโดโมฟ้า350กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 35, 6, '8850002006577', 29, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 35, 29, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002006638') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโคโดโมชมพู350กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 35, 6, '8850002006638', 29, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 35, 29, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002016620') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ครีมอาบน้ำโชกุบุสซึ ส้ม 400มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 3, '8850002016620', 55, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 55, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002022225') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ผงซักฟอก 3 แจ๋ว 1000กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 12, '8850002022225', 36.66, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 36.66, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002029354') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโคโดโมเหลือง350กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 35, 6, '8850002029354', 29, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 35, 29, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002033726') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ครีมอาบน้ำโชกุบุสซึ ชมเข้ม 400มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 3, '8850002033726', 55, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 55, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002039759') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโคโดโมเขียว350กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 35, 6, '8850002039759', 29, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 35, 29, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002041165') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ผงซักฟอก 3 แจ๋ว 2600กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 105, 6, '8850002041165', 86.66, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 105, 86.66, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002851665') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ครีมอาบน้ำโชกุบุสซึ ชมพู 400มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 3, '8850002851665', 55, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 55, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002851696') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ครีมอาบน้ำโชกุบุสซึ เขียว400มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 3, '8850002851696', 55, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 55, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850002905207') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไลปอนเอฟ แพ็ก3ห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 6, '8850002905207', 55.05, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 55.05, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006490846') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่โพรเทคส์ฟอร์เมน90กรัม*4ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 3, '8850006490846', 50, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 50, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006491751') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่โพรเทคส์ สปอร์ตเมน 60กรัม*4', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 62, 3, '8850006491751', 47, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 62, 47, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006534311') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่โพรเทคส์บลอสซั่มแคร์60กรัม*4ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 62, 4, '8850006534311', 47, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 62, 47, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006534373') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่โพรเทคส์พรอพโพลิส60กรัม*4ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 62, 3, '8850006534373', 47, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 62, 47, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006572061') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งเด็กแคร์คลาสสิกฟ้า160กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 35, 6, '8850006572061', 26.6, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 35, 26.6, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006582015') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งเด็กแคร์พิงค์ซอฟท์160กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 35, 6, '8850006582015', 26.6, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 35, 26.6, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006603178') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโพเทคบอสซั่ม140กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 38, 6, '8850006603178', 30, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 38, 30, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006603185') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโพเทคไอซี่คูล140กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 38, 6, '8850006603185', 30, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 38, 30, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850006603826') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งโพเทคสปอร์ตเมน140กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 38, 6, '8850006603826', 30, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 38, 30, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850029037684') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'นิเวียเฟลแอนบิวตี้ 50 มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 85, 3, '8850029037684', 68.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 85, 68.33, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850029212821') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'นิเวียเพิร์ลแอนบิวตี้ 25มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 4, '8850029212821', 40.6, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 40.6, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092016210') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาล้างห้องน้ำ วิคซอลม่วง900มล.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 40, 6, '8850092016210', 31.6, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 40, 31.6, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092019204') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาล้างห้องน้ำ วิคซอลโกล900มล.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 40, 6, '8850092019204', 31.66, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 40, 31.66, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092254650') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาซักผ้าไฮยีนเลิฟทัช 600มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 3, '8850092254650', 39.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 39.16, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092257163') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาซักผ้าไฮยีนแฮปปี้ซันชายน์ 600มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 9, '8850092257163', 39.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 9, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 39.16, 9, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092281502') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮยีนเอ็กซ์เพิร์ทแคร์480มล บลูมมิ่งทัช', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8850092281502', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092285708') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮยีนเอ็กซ์เพิร์ทแคร์480มล แฮปปี้ซันชายน์', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8850092285708', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092287504') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮยีนเอ็กซ์เพิร์ทแคร์480มล เลิฟทัช', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8850092287504', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092288808') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮยีนปรับผ้านุ่ม กลิ่นดรีมมี่ฮัก 1000 มล.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 99, 12, '8850092288808', 80, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 99, 80, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850092298708') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มไฮยีน ดำ 480มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 9, '8850092298708', null, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 9, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, null, 9, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850100004895') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ไวไวรสหมูสับแบบแพ็ก 10 ห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 70, 1, '8850100004895', 62, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 70, 62, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850100005328') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ไวไวหมูสับแพ็ก10ซอง', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 70, 2, '8850100005328', 56, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 70, 56, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850100101044') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ไวไวหมูสับแบบซอง60กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 7, 10, '8850100101044', 6.2, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 7, 6.2, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850100205049') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ไวไวหมูสับ 55 กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 7, 10, '8850100205049', 5.6, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 7, 5.6, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850157100526') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เจเล่บิวตี้องุ่น', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 10, 6, '8850157100526', 8.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 10, 8.33, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850157102674') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เจเล่บิวตี่ ลินจี่', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 10, 6, '8850157102674', 8.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 10, 8.33, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850188901574') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'โฟโมทรสจืด 180มล แพ็ก12กล่อง', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 144, 3, '8850188901574', 108.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 144, 108.33, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850195770163') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ลีโอโพวิโดน ยาใส่แผล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 30, 6, '8850195770163', 25.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 30, 25.83, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850206010028') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ซีอิ๊วขาวเห็ดหอม 700มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 12, '8850206010028', 50.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 50.83, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850250000150') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'ยำยำหมูสับแบบแพ็ก10ห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 70, 1, '8850250000150', 60, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 70, 60, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850250007425') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'เบอร์ดี้โรบัสต้าแดงแบบห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 110, 18, '8850250007425', 87.77, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 18, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 110, 87.77, 18, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850273220108') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'เดรี่เพรชพลอร่า 300 cc', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 84, 2, '8850273220108', 67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 84, 67, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850273221105') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'เดรี่เพรชบิวตี้ฟูล 300 cc', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 85, 2, '8850273221105', 67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 85, 67, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850273229101') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'เดรี่เพรชออเรน 300 cc', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 85, 1, '8850273229101', 67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 85, 67, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850309207752') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'จัมโบ้ลูเบอร์รี่', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 1, 24, '8850309207752', 0.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 24, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 1, 0.83, 24, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850718822249') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เลย์รสไข่เค็ม44กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 6, '8850718822249', 16.66, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 16.66, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850718823079') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'ตะวันรสสาหร่าย75กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 3, '8850718823079', 16.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 16.33, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850718823093') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'ตะวันรสหมึก3รส', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 2, '8850718823093', 16.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 16.33, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850718823109') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'ตะวันรสลาบแซ่บ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 3, '8850718823109', 16.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 16.33, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850718823116') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'ตะวันรสต้นตำหรับ 75 กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 0, '8850718823116', 16.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 16.33, 0, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850800100033') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'น้ำมันมะกอก', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 6, '8850800100033', 21.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 21.67, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850921000083') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'พาราแคป100เม็ด', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 70, 5, '8850921000083', 65, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 5, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 70, 65, 5, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850987148200') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'มาม่าฮอตเกาหลี ซองดำ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 15, 2, '8850987148200', 13.06, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 15, 13.06, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850987148248') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'มาม่าฮอตเกาหลี ซองดำ แพ็ก 4 ห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 58, 35, '8850987148248', 52.22, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 35, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 58, 52.22, 35, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8850987201479') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'มาม่าเส้นหมีน้ำใสแบบแพ็ค 10 ห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 70, 2, '8850987201479', 65, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 70, 65, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851111175321') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'โซฟีแบบกางกางใน XL-XXL', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 60, 6, '8851111175321', 49.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 60, 49.5, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851123120005') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'อุทัยทิพย์', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 1, '8851123120005', 40, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 40, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851467011403') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'พาราฟ้าขาว', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 40, 6, '8851467011403', 37.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 40, 37.5, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851473007698') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ทิฟฟี่', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 10, 25, '8851473007698', 8.8, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 25, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 10, 8.8, 25, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851818602304') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮเตอร์ฟ้า 250 มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 15, 6, '8851818602304', 11.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 15, 11.16, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851818612303') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮเตอร์ชมพู 250 มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 15, 6, '8851818612303', 11.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 15, 11.16, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851818636903') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ไฮเตอร์เหลือง 250 มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 15, 6, '8851818636903', 11.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 15, 11.16, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851824060631') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'เครมิลแบบเม็ด', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 30, 6, '8851824060631', 25, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 30, 25, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851824336378') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ดีคอลเจนแบบเม็ด', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 10, 25, '8851824336378', 8.8, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 25, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 10, 8.8, 25, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851847000904') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ยาธาตุน้ำขาว 200 มล.', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 65, 3, '8851847000904', 61.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 65, 61.67, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929004981') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้าเขียวแบบแพ็ค105กรัม*4ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 3, '8851929004981', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929010890') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วเหลืองแบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 2, '8851929010890', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929011385') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วบุปผชาติแบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 2, '8851929011385', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 44, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929012511') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วลีลาวดีแบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 2, '8851929012511', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929018339') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วทานาคาแบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 2, '8851929018339', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929020325') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วพีชแบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 3, '8851929020325', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929022039') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วโรสเบอร์รี่แบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 2, '8851929022039', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851929023425') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่นกแก้วพีโอนี่ออร่าแบบแพ็ค 105กรัม*4 ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 59, 2, '8851929023425', 44, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 59, 44, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932183567') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่ลักชมพู 70กรัม*4ก้อน', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 38, 3, '8851932183567', 32, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 38, 32, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932191265') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มคอมฟอร์ทกลิ่นสะอาดสีฟ้า500มล แบบแพ็ต', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 50, 8, '8851932191265', 30.63, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 8, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 50, 30.63, 8, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932191289') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มคอมฟอร์ทกลิ่นกุหลาบสีชมพู 500มลแบบแพ็ค', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 50, 8, '8851932191289', 30.63, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 8, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 50, 30.63, 8, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932191296') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มคอมฟอร์ทสบายสีม่วง500มลแบบแพ็ค', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 50, 8, '8851932191296', 30.63, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 8, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 50, 30.63, 8, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932288071') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มคอมฟอร์ทกลิ่นสวนดอกทิวลิป 500มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 18, 6, '8851932288071', 10.2, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 18, 10.2, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932288095') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มคอมฟอร์ทกลิ่นสวนดอกทิวลิป 500มลแบบแพ็ค', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 50, 6, '8851932288095', 30.63, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 50, 30.63, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932375719') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'วาสลีนเพียวเจลลี่50มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 79, 3, '8851932375719', 53.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 79, 53.33, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932415781') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซันซิลส้ม90มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 6, '8851932415781', 19.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 19.16, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932415798') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซันซิลเขียว90มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 6, '8851932415798', 19.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 19.16, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932460255') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซันซิลเหลือง90มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 6, '8851932460255', 19.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 19.16, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932479158') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'โอโมซันชาย 850กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 40, 11, '8851932479158', 30, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 11, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 40, 30, 11, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932487542') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ซันไลต์ 500 มล แพ็ก3ห่อ', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 69, 2, '8851932487542', 56.88, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 2, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 69, 56.88, 2, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932491396') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'โอโมซันชายน์2600กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 95, 5, '8851932491396', 77.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 5, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 95, 77.5, 5, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851932495691') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'เคลียร์2in1ชมพู60มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 6, '8851932495691', 15, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 15, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989011448') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งเอเวอร์เซนชมพู280กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 4, '8851989011448', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 35, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989011455') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งเอเวอร์เซนเขียว280กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 4, '8851989011455', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 35, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989011554') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'แป้งเอเวอร์เซนม่วง280กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 4, '8851989011554', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 35, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989012711') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'แป้งเอเวอร์เซนพีช280กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 4, '8851989012711', 35, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 35, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989033143') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาซักผ้าไฟน์ไลน์ดีลักซืดำ550มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8851989033143', 35.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35.83, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989033211') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาซักผ้าไฟน์แฮปปี้เนส ชมพู550มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8851989033211', 35.88, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35.88, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989033365') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาซักผ้าไฟน์ไลน์พลัสทอง 550มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8851989033365', 35.83, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35.83, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989033785') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มไฟน์ไลน์ดรีมมิ่งคิส 450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 39, 12, '8851989033785', 27.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 39, 27.5, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989033792') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ปรับผ้านุ่มไฟน์ไลน์สวีสพิงค์ 450มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 39, 12, '8851989033792', 27.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 39, 27.5, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8851989036694') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'น้ำยาซักผ้าไฟน์แฮปปี้เนส ม่วง550มล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 49, 12, '8851989036694', 35.88, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 49, 35.88, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8852761000063') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ยาอมแก้ไอตราตะขาบ5ตัว', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 18, 6, '8852761000063', 16.67, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 18, 16.67, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8852913910219') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ยาขมื้นชันอ้วยอันแคปซูล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 90, 6, '8852913910219', 70, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 90, 70, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8853965003089') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ผงเกลือแร่โอไลน์', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 6, '8853965003089', 4.17, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.17, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8857022000530') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'อาปาเช่แบบขวด', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 6, '8857022000530', 18.33, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 18.33, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8857022000653') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '4106615f-8fd3-4bb1-849b-bee436e10d25'::uuid, 'ยาอมมะขามป้อม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 6, '8857022000653', 20, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 6, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 20, 6, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8857129275107') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'LIS ผ้าอนามัยกางเกงไซด์ M', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 10, '8857129275107', 15, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 15, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8857129275114') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'LIS ผ้าอนามัยกางเกงไซด์ L', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 10, '8857129275114', 15, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 15, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8857129275121') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'LIS ผ้าอนามัยกางเกงไซด์ XL', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 25, 10, '8857129275121', 15, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 25, 15, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858587001048') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'd1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid, 'สบู่น้ำนมข้าวอิงอร160กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 38, 3, '8858587001048', 29, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 38, 29, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858587001338') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สบู่มะขามอิงอร160กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 38, 4, '8858587001338', 29, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 4, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 38, 29, 4, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858817011212') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ถงร้อน 8*12 500กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 45, 10, '8858817011212', 38, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 45, 38, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858817011960') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ถุงหิ้วไฮโซ 7*15 500กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 69, 10, '8858817011960', 42, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 69, 42, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858817014084') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ยางวงแดง', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 1, 1, '8858817014084', 53, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 1, 53, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858817019478') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ถุงหิ้วระฆังน้ำเงิน 8*16 160กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 22, 30, '8858817019478', 15.8, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 30, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 22, 15.8, 30, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858817019485') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'ถุงหิ้วระฆังน้ำเงิน9*18  260กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 28, 10, '8858817019485', 24, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 10, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 28, 24, 10, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858954206991') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'แคร์แบร์ชิวแคนดี้ สตอเบอร์รี่', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '8858954206991', 4.08, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.08, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858954207011') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'แคร์แบร์ชิวแคนดี้องุ่น', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '8858954207011', 4.08, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.08, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8858954215221') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เจลลี่ OK', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '8858954215221', 4.16, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.16, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8859744000171') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid, 'สมุดฉีกมีเส้น', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 15, 20, '8859744000171', 7.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 20, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 15, 7.5, 20, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8990102000621') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'มิกซ์เบอร์เกอร์', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 2, 24, '8990102000621', 1.5, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 24, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 2, 1.5, 24, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8992741945271') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'พิซว่ากัมมี่', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '8992741945271', 4.08, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.08, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8992760121021') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'โอรีโอ้ไส้ครีม24กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '8992760121021', 4.06, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.06, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8992760223022') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'โอริโอ้ครีมช๊อกโกแลต 24 กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 5, 12, '8992760223022', 4.06, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 12, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 5, 4.06, 12, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '8992760223046') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'โอริโอ้ใส้ครีมช๊อกโกแลตแบบแพ็ก12ชิ้น', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 60, 1, '8992760223046', 48.69, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 1, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 60, 48.69, 1, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '9310022866104') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid, 'อาหารแมววิสกัสรสปลาทะเล', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 150, 0, '9310022866104', 147, 'ชิ้น')
    returning id into v_vid;
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 150, 147, 0, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '93682961') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เอ็มแอนเอ็มมิลช๊อกโกแลต', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 3, '93682961', 19, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 19, 3, true);
    v_n := v_n + 1;
  end if;
  if not exists (select 1 from public.product_variants where barcode = '93682978') then
    insert into public.products (shop_id, category_id, name, publish_state)
    values ('00000000-0000-0000-0000-0000000000a1'::uuid, '41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid, 'เอ็มแอนเอ็มพีนัท37กรัม', 'draft')
    returning id into v_pid;
    insert into public.product_variants (product_id, price, stock_qty, barcode, cost_price, unit)
    values (v_pid, 20, 3, '93682978', 19, 'ชิ้น')
    returning id into v_vid;
    insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
    values (v_vid, 3, 0, 'receive');
    insert into public.sync_backup_20260808 (variant_id, product_id, stock_qty, price, cost_price, applied_delta, was_created)
    values (v_vid, v_pid, 0, 20, 19, 3, true);
    v_n := v_n + 1;
  end if;
  raise notice 'สร้างสินค้าใหม่ % รายการ', v_n;
end $$;
