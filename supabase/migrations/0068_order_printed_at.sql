-- 0068_order_printed_at.sql
-- อู้ฟู่ (Oofoo) — "พิมพ์ใบจัดสินค้าแล้วหรือยัง" ติดตามที่ออเดอร์
--
-- เดิมคนจัดของไม่มีทางรู้ว่าใบไหนพิมพ์ไปแล้ว ต้องจำเอง พอมีสองคนช่วยกันจัด
-- ก็พิมพ์ซ้ำใบเดิมหรือข้ามใบที่ยังไม่ได้พิมพ์ เก็บลง DB ไม่ใช่ในเครื่อง เพราะ
-- ร้านพิมพ์จากเครื่องหนึ่งแล้วเช็คจากอีกเครื่อง
--
-- printed_at = เวลาที่พิมพ์ "ครั้งแรก" — พิมพ์ซ้ำไม่ทับค่าเดิม เพราะคำถามที่
-- ต้องการคำตอบคือ "ใบนี้ผ่านมือคนจัดหรือยัง" ไม่ใช่ "พิมพ์ล่าสุดเมื่อไหร่"

alter table public.orders
  add column if not exists printed_at timestamptz;

comment on column public.orders.printed_at is
  'เวลาที่พิมพ์ใบจัดสินค้าครั้งแรก (null = ยังไม่พิมพ์) ตั้งผ่าน mark_order_printed';

-- ── ทำเครื่องหมายว่าพิมพ์แล้ว ────────────────────────────────────────────────
-- ไม่รับ row_version เพราะไม่ใช่การแก้ข้อมูลออเดอร์ที่แข่งกันได้ และไม่ขยับ
-- row_version ด้วย — ไม่งั้นการพิมพ์จะไปทำให้หน้าจอที่เปิดค้างอยู่ของอีกคน
-- กลายเป็น STALE_WRITE ทั้งที่ไม่มีอะไรเปลี่ยนจริง
create or replace function public.mark_order_printed(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_printed timestamptz; v_num text;
begin
  select printed_at, order_number into v_printed, v_num
  from public.orders where id = p_order_id and shop_id = v_shop for update;
  if v_num is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'order';
  end if;

  -- พิมพ์ซ้ำ: คืนค่าเดิม ไม่เขียนทับ ไม่เขียน audit ซ้ำ
  if v_printed is not null then
    return jsonb_build_object('order_id', p_order_id, 'printed_at', v_printed, 'first', false);
  end if;

  update public.orders set printed_at = now() where id = p_order_id
  returning printed_at into v_printed;

  perform public.write_audit(v_shop, 'mark_order_printed', 'orders', p_order_id::text,
    'พิมพ์ใบจัดสินค้า ' || v_num);

  return jsonb_build_object('order_id', p_order_id, 'printed_at', v_printed, 'first', true);
end $$;

revoke execute on function public.mark_order_printed(uuid) from public;
grant execute on function public.mark_order_printed(uuid) to authenticated;
