-- อู้ฟู่ — ROLLBACK ของการ sync 2026-08-08
--
-- คืนค่าจากตาราง public.sync_backup_20260808 ที่ APPLY เก็บไว้ ไม่ได้พึ่งค่าที่อ่านมาจากภายนอก
--
-- คืนสต็อกด้วยวิธี "หักส่วนต่างที่เคยบวกเข้าไป" ไม่ใช่ตั้งทับด้วยเลขเก่า
-- ถ้าขายของไปแล้วระหว่างนี้ ยอดที่ขายจะยังถูกหักไว้ถูกต้อง
--
-- ABORT เองถ้าสินค้าที่สร้างใหม่ถูกสั่งซื้อหรือขายไปแล้ว

begin;

do $$
declare v_n int;
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'sync_backup_20260808') then
    raise exception 'ไม่พบตารางสำรอง — ยังไม่ได้รัน APPLY หรือถูกลบไปแล้ว';
  end if;

  select count(*) into v_n from public.order_items oi
    join public.sync_backup_20260808 b on b.variant_id = oi.variant_id and b.was_created;
  if v_n > 0 then raise exception 'ABORT: สินค้าที่สร้างใหม่ถูกสั่งซื้อไปแล้ว % รายการ', v_n; end if;

  select count(*) into v_n from public.pos_sale_items si
    join public.sync_backup_20260808 b on b.variant_id = si.variant_id and b.was_created;
  if v_n > 0 then raise exception 'ABORT: สินค้าที่สร้างใหม่ถูกขายที่ POS ไปแล้ว % รายการ', v_n; end if;
end $$;

-- ── 1. ลบสินค้าที่สร้างใหม่ (ตามลำดับ FK) ───────────────────────────────────
delete from public.cart_items      where variant_id in (select variant_id from public.sync_backup_20260808 where was_created);
delete from public.stock_movements where variant_id in (select variant_id from public.sync_backup_20260808 where was_created);
delete from public.product_images  where product_id in (select product_id from public.sync_backup_20260808 where was_created);
delete from public.product_variants where id       in (select variant_id from public.sync_backup_20260808 where was_created);
delete from public.products         where id       in (select product_id from public.sync_backup_20260808 where was_created);

-- ── 2. คืนสต็อก / ราคา / ทุน ของเดิม ────────────────────────────────────────
insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason)
select b.variant_id, -b.applied_delta, 0, 'admin_adjust'
from public.sync_backup_20260808 b join public.product_variants pv on pv.id = b.variant_id
where not b.was_created and b.applied_delta <> 0;

update public.product_variants pv
set stock_qty  = greatest(0, pv.stock_qty - b.applied_delta),
    price      = b.price,
    cost_price = b.cost_price
from public.sync_backup_20260808 b
where b.variant_id = pv.id and not b.was_created;

-- ── 3. ตรวจก่อน commit ──────────────────────────────────────────────────────
do $$
declare v_left int; v_neg int;
begin
  select count(*) into v_left from public.sync_backup_20260808 b where b.was_created
    and exists (select 1 from public.product_variants pv where pv.id = b.variant_id);
  select count(*) into v_neg from public.product_variants where stock_qty < 0;
  if v_left <> 0 then raise exception 'ลบสินค้าใหม่ไม่หมด เหลือ %', v_left; end if;
  if v_neg  <> 0 then raise exception 'มีสต็อกติดลบ % รายการ', v_neg; end if;
  raise notice 'rollback สำเร็จ';
end $$;

drop table public.sync_backup_20260808;

commit;
