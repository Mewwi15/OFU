-- อู้ฟู่ — รายการสินค้าที่ยังไม่มีรูป (อ่านอย่างเดียว)
--
-- เรียงตามสถานะ แล้วตามสต็อกมากไปน้อย — ตัวที่ของเยอะควรใส่รูปก่อน
-- คอลัมน์ "สร้างรอบ sync" บอกว่าเป็นสินค้าที่เพิ่งนำเข้า 2026-08-08 หรือของเดิม

select
  row_number() over (
    order by p.publish_state, coalesce(pv.stock_qty, 0) desc, p.name
  )                                                   as ลำดับ,
  case p.publish_state when 'published' then 'เผยแพร่แล้ว' else 'ร่าง' end as สถานะ,
  p.name                                              as ชื่อสินค้า,
  c.name                                              as หมวดหมู่,
  pv.barcode                                          as บาร์โค้ด,
  pv.price                                            as ราคาขาย,
  pv.stock_qty                                        as สต็อก,
  (pv.price * pv.stock_qty)                           as มูลค่าขาย,
  (b.variant_id is not null and b.was_created)        as สร้างรอบ_sync
from public.products p
left join public.product_variants pv
       on pv.product_id = p.id and pv.archived_at is null
left join public.categories c on c.id = p.category_id
left join public.sync_backup_20260808 b on b.variant_id = pv.id
where p.archived_at is null
  and not exists (select 1 from public.product_images pi where pi.product_id = p.id)
order by ลำดับ;
