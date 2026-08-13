-- 0069c_revoke_cost_price_fixed.sql
-- อู้ฟู่ (Oofoo) — ปิดช่องโหว่ต้นทุนสินค้า · แทนที่ 0069b ที่ไม่ได้ผล
--
-- ทำไม 0069b ไม่ได้ผล: Supabase ให้สิทธิ์ SELECT ไว้ "ทั้งตาราง" กับ anon และ
-- authenticated (grant select on product_variants) ซึ่ง Postgres ไม่ยอมให้ถอน
-- ทีละคอลัมน์ออกจากสิทธิ์ระดับตาราง — คำสั่ง revoke select (cost_price) จึงผ่าน
-- ไปเงียบ ๆ โดยไม่เปลี่ยนอะไรเลย
--
-- วิธีที่ได้ผล: ถอนสิทธิ์ระดับตารางทิ้ง แล้วให้คืนเป็นรายคอลัมน์ทั้ง 15 คอลัมน์
-- ที่เหลือ เว้น cost_price ไว้ตัวเดียว
--
-- ⚠️ ยังคงต้องรันหลัง deploy แอดมินตัวใหม่แล้วเท่านั้น (เหมือน 0069b)
-- ⚠️ ถ้าเพิ่มคอลัมน์ใหม่ให้ product_variants ในอนาคต ต้อง grant ให้ role พวกนี้
--    ด้วยมือ ไม่งั้นแอปจะอ่านคอลัมน์นั้นไม่เห็น

begin;

revoke select on public.product_variants from anon;
revoke select on public.product_variants from authenticated;

grant select (
  id, product_id, size, size_key, price, stock_qty, reserved_qty,
  low_stock_threshold, available_qty, low_stock_alerted_at,
  out_of_stock_alerted_at, barcode, sku, unit, archived_at
) on public.product_variants to anon;

grant select (
  id, product_id, size, size_key, price, stock_qty, reserved_qty,
  low_stock_threshold, available_qty, low_stock_alerted_at,
  out_of_stock_alerted_at, barcode, sku, unit, archived_at
) on public.product_variants to authenticated;

-- ── ตรวจว่าตัดสำเร็จจริง และไม่ได้ตัดคอลัมน์อื่นไปด้วย ────────────────────────
do $$
declare v_cost text; v_missing text;
begin
  -- cost_price ต้องไม่มี role ไหนอ่านได้แล้ว
  select string_agg(distinct grantee, ', ') into v_cost
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'product_variants'
    and column_name = 'cost_price' and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated');
  if v_cost is not null then
    raise exception 'ยังตัดไม่หมด — % ยังอ่าน cost_price ได้', v_cost;
  end if;

  -- คอลัมน์อื่นต้องอ่านได้ครบทั้ง 15 ตัว ไม่งั้นแอปลูกค้าพัง
  select string_agg(c.column_name, ', ') into v_missing
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'product_variants'
    and c.column_name <> 'cost_price'
    and not exists (
      select 1 from information_schema.column_privileges p
      where p.table_schema = 'public' and p.table_name = 'product_variants'
        and p.column_name = c.column_name and p.privilege_type = 'SELECT'
        and p.grantee = 'anon');
  if v_missing is not null then
    raise exception 'ให้สิทธิ์คืนไม่ครบ — anon อ่านไม่ได้: %', v_missing;
  end if;

  raise notice 'สำเร็จ — cost_price ถูกซ่อนแล้ว คอลัมน์อื่นอ่านได้ครบตามเดิม';
end $$;

commit;
