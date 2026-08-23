-- 0079_void_goods_receipt.sql
-- อู้ฟู่ (Oofoo) — ยกเลิก/แก้ไขใบรับเข้า (เจ้าของขอ: ประวัติต้องลบ-แก้ได้)
--
-- หลักการ: สมุดสต๊อกไม่ลบทิ้ง — "ลบใบ" = void: ถอนจำนวนที่เคยบวกออก พร้อมลง
-- บรรทัดย้อน (reason 'receive_void') ใบเดิมติดป้ายยกเลิกไว้ดูย้อนหลัง ·
-- "แก้ไข" ฝั่งหน้าจอ = void ใบเดิมแล้วดึงบรรทัดกลับไปแก้ในฟอร์ม บันทึกเป็นใบใหม่
--
-- ข้อจำกัดตรงไปตรงมา: สต๊อกมีกติกาห้ามติดลบ (0002) — ถ้าของที่รับเข้าใบนั้น
-- ถูกขายไปแล้วจนเหลือไม่พอถอน จะยกเลิกไม่ได้ทั้งใบ พร้อมบอกว่าตัวไหนขาดเท่าไหร่
-- (ดีกว่าแอบตัดเหลือศูนย์แล้วตัวเลขโกหก) · ทุนที่เคยถูกทับไปแล้วไม่ย้อนให้
-- (ระบบไม่ได้เก็บทุนก่อนหน้า) — แจ้งไว้ใน UI

-- enum ใหม่ต้องอยู่นอก transaction (นิสัย Postgres — บทเรียน 0071)
alter type public.stock_reason_t add value if not exists 'receive_void';

begin;

alter table public.goods_receipts
  add column if not exists voided_at timestamptz,
  add column if not exists voided_reason text;

create or replace function public.void_goods_receipt(
  p_receipt_id uuid,
  p_reason     text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_r public.goods_receipts;
  v_short text := '';
  m record;
begin
  select * into v_r from public.goods_receipts
   where id = p_receipt_id and shop_id = v_shop for update;
  if v_r.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_r.voided_at is not null then
    return jsonb_build_object('receipt_number', v_r.receipt_number, 'replay', true);
  end if;

  -- เช็คก่อนแตะอะไร: ทุกบรรทัดต้องถอนได้จริง (ของยังเหลือพอ)
  for m in
    select mv.variant_id, mv.delta_stock, pv.stock_qty, p.name, pv.size
    from public.stock_movements mv
    join public.product_variants pv on pv.id = mv.variant_id
    join public.products p on p.id = pv.product_id
    where mv.receipt_id = p_receipt_id and mv.reason = 'receive'::public.stock_reason_t
  loop
    if m.stock_qty < m.delta_stock then
      v_short := v_short || m.name || coalesce(' ('||m.size||')','')
              || ' ขาด ' || (m.delta_stock - m.stock_qty) || ' ชิ้น · ';
    end if;
  end loop;
  if v_short <> '' then
    raise exception 'STOCK_SHORT' using errcode = 'P0001', detail = v_short;
  end if;

  -- ถอนจำนวน + ลงบรรทัดย้อนในสมุด
  update public.product_variants pv
     set stock_qty = pv.stock_qty - mv.delta_stock
    from public.stock_movements mv
   where mv.receipt_id = p_receipt_id
     and mv.reason = 'receive'::public.stock_reason_t
     and pv.id = mv.variant_id;

  insert into public.stock_movements (variant_id, delta_stock, reason, actor_user_id, receipt_id)
  select variant_id, -delta_stock, 'receive_void'::public.stock_reason_t, auth.uid(), p_receipt_id
  from public.stock_movements
  where receipt_id = p_receipt_id and reason = 'receive'::public.stock_reason_t;

  update public.goods_receipts
     set voided_at = now(), voided_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_receipt_id;

  perform public.write_audit(v_shop, 'void_goods_receipt', 'goods_receipts', v_r.receipt_number,
    coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'ยกเลิกใบรับเข้า'));

  return jsonb_build_object('receipt_number', v_r.receipt_number, 'replay', false);
end $$;

revoke execute on function public.void_goods_receipt(uuid, text) from public;
grant execute on function public.void_goods_receipt(uuid, text) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.void_goods_receipt(uuid,text)') is null then
    raise exception 'void_goods_receipt หายไป';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'stock_reason_t' and e.enumlabel = 'receive_void') then
    raise exception 'เหตุผล receive_void หายไป';
  end if;
  raise notice '0079 พร้อม — ยกเลิก/แก้ไขใบรับเข้าได้จากหน้าประวัติ';
end $$;
