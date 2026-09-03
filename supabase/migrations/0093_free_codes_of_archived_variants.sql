-- เลิกขายแล้วต้องคืนบาร์โค้ด/SKU ให้ใช้ซ้ำได้ — เจ้าของถาม 3 ก.ย. 2026
-- ("งงครับ เลิกขายแล้วทำไมยังมีบาร์โค้ด")
--
-- คำตอบคือการเลิกขายเป็นการลบแบบนิ่ม แถวยังอยู่ในตารางเพราะบิลเก่าชี้มาที่แถวนั้น
-- (pos_sale_items / order_items ผูกด้วย variant_id) ลบทิ้งจริงไม่ได้ ประวัติจะพัง
-- แต่ไม่มีใครล้างบาร์โค้ดออก และดัชนี unique ก็ไม่ได้ยกเว้นแถวที่เลิกขาย โค้ดนั้นจึง
-- ถูกจองไว้ตลอดกาลโดยแถวที่ไม่มีใครมองเห็น
--
-- ต้นตอที่ทำให้มีแถวแบบนี้เยอะคือไมเกรชัน 0033 ตอนเจ้าของเลิกใช้ระบบ "ขนาด" —
-- มันเก็บขนาดหลักไว้ตัวเดียวแล้ว archive ที่เหลือทั้งหมด พร้อมบาร์โค้ดติดไปด้วย
--
-- แก้สามจุดให้สอดคล้องกัน ถ้าแก้ไม่ครบจะเจอ unique_violation ดิบ ๆ แทน:
--   1. ดัชนี unique ยกเว้นแถวที่เลิกขาย — ตัวจริงที่บล็อกอยู่คือดัชนี ไม่ใช่โค้ดเช็ค
--   2. การเช็คซ้ำใน upsert_variant ก็ต้องข้ามแถวที่เลิกขายให้ตรงกับดัชนี
--   3. เลิกขายสินค้า = เลิกขายขนาดของมันด้วย ไม่งั้นแถวขนาดยังไม่ archive โค้ดก็ยัง
--      ถูกจองอยู่ (ดัชนีอ้างข้ามตารางไปดู products.archived_at ไม่ได้)
--
-- ปลอดภัยเพราะไม่มีทางกู้คืนของที่เลิกขายแล้วในระบบ ไม่มี RPC ไหนเซ็ต archived_at
-- กลับเป็น null เลย จึงไม่มีเคสที่ของเก่าฟื้นขึ้นมาแล้วชนกับโค้ดที่ถูกเอาไปใช้ใหม่

-- ── 1. ย้อนไปเลิกขายขนาดที่ค้างอยู่ใต้สินค้าที่เลิกขายไปแล้ว ──────────────────
update public.product_variants v
   set archived_at = p.archived_at
  from public.products p
 where p.id = v.product_id
   and p.archived_at is not null
   and v.archived_at is null;

-- ── 2. ดัชนี unique เวอร์ชันที่ยกเว้นของเลิกขาย ─────────────────────────────
drop index if exists public.product_variants_barcode_ux;
drop index if exists public.product_variants_sku_ux;
create unique index if not exists product_variants_barcode_ux
  on public.product_variants (barcode) where barcode is not null and archived_at is null;
create unique index if not exists product_variants_sku_ux
  on public.product_variants (sku) where sku is not null and archived_at is null;

-- ── 3. เลิกขายสินค้า = เลิกขายขนาดของมันด้วย ────────────────────────────────
create or replace function public.delete_product(
  p_id uuid,
  p_expected_row_version int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_rv int;
begin
  select row_version into v_rv from public.products where id = p_id and shop_id = v_shop;
  if v_rv is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_row_version is not null and p_expected_row_version <> v_rv then
    raise exception 'STALE_WRITE' using errcode = 'P0001';
  end if;
  update public.products
     set archived_at = now(), publish_state = 'draft'::public.publish_state_t,
         row_version = row_version + 1
   where id = p_id and shop_id = v_shop;
  -- ขนาดต้องเลิกขายตามสินค้า ไม่งั้นบาร์โค้ด/SKU ของมันยังถูกจองอยู่ทั้งที่ของไม่ขายแล้ว
  update public.product_variants
     set archived_at = now()
   where product_id = p_id and archived_at is null;
  perform public.write_audit(v_shop, 'archive_product', 'products', p_id::text, 'archived');
  return jsonb_build_object('id', p_id, 'archived', true);
end $$;

revoke execute on function public.delete_product(uuid, int) from public;
grant execute on function public.delete_product(uuid, int) to authenticated;

-- ── 4. การเช็คซ้ำต้องข้ามของเลิกขายให้ตรงกับดัชนี ───────────────────────────
create or replace function public.upsert_variant(
  p_id uuid default null,
  p_product_id uuid default null,
  p_size text default null,
  p_price int default null,
  p_stock_qty int default null,
  p_low_stock_threshold int default null,
  p_sku text default null,
  p_barcode text default null,
  p_cost_price numeric default null,
  p_unit text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id uuid;
  v_new_stock int;
  v_owner text;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'price > 0 required';
  end if;
  if p_id is null and p_stock_qty is not null and p_stock_qty < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'stock >= 0';
  end if;
  if p_product_id is null or not exists (
    select 1 from public.products where id = p_product_id and shop_id = v_shop
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'product';
  end if;

  if p_sku is not null then
    select public.code_owner_label(pv.id) into v_owner
      from public.product_variants pv
     where pv.sku = p_sku and pv.archived_at is null and (p_id is null or pv.id <> p_id)
     limit 1;
    if v_owner is not null then
      raise exception 'DUPLICATE_SKU' using errcode = 'P0001', detail = v_owner;
    end if;
  end if;

  if p_barcode is not null then
    select public.code_owner_label(pv.id) into v_owner
      from public.product_variants pv
     where pv.barcode = p_barcode and pv.archived_at is null and (p_id is null or pv.id <> p_id)
     limit 1;
    if v_owner is not null then
      raise exception 'DUPLICATE_BARCODE' using errcode = 'P0001', detail = v_owner;
    end if;
  end if;

  if p_id is null then
    begin
      insert into public.product_variants
        (product_id, size, price, stock_qty, low_stock_threshold, sku, barcode, cost_price, unit)
      values (p_product_id, p_size, p_price, coalesce(p_stock_qty, 0), coalesce(p_low_stock_threshold, 5),
              p_sku, p_barcode, p_cost_price, coalesce(p_unit, 'ชิ้น'))
      returning id, stock_qty into v_id, v_new_stock;
    exception when unique_violation then
      raise exception 'DUPLICATE_VARIANT' using errcode = 'P0001';
    end;
    if v_new_stock > 0 then
      insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (v_id, v_new_stock, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
    end if;
  else
    if not exists (
      select 1
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = p_id and p.id = p_product_id and p.shop_id = v_shop
    ) then raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant'; end if;

    update public.product_variants set
      size = p_size, price = p_price,
      low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold),
      sku = p_sku, barcode = p_barcode, cost_price = p_cost_price,
      unit = coalesce(p_unit, unit)
    where id = p_id returning id into v_id;
  end if;
  perform public.write_audit(v_shop, 'upsert_variant', 'product_variants', v_id::text, 'variant price=' || p_price);
  return jsonb_build_object('id', v_id);
end $$;

revoke execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, numeric, text) from public;
grant execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, numeric, text) to authenticated;
