-- ลบใบรับเข้าได้เสมอ แม้ของจะถูกขายไปแล้ว
--
-- เจ้าของตัดสิน 3 ต.ค. 2569 "ยอมให้ติดลบเลยครับ ลบใบเก่าได้เสมอ"
-- หลังเจอกับตัวเองว่ากดลบใบแล้วขึ้น STOCK_SHORT โดยไม่รู้ว่าแปลว่าอะไร
--
-- ★ ของเดิมห้ามลบถ้าถอนคืนไม่ครบ ★ ใบรับเข้าหนึ่งใบรับนมข้นหวานมา 12 กระป๋อง
-- ขายไปแล้ว 5 เหลือ 7 · การลบใบต้องถอนคืน 12 แต่มีให้ถอนแค่ 7 ระบบจึงไม่ยอมทำทั้งใบ
-- ผลคือยิ่งใบเก่ายิ่งลบไม่ได้ ซึ่งกลับหัวกลับหางกับความจริง เพราะใบที่พิมพ์ผิดแล้ว
-- เพิ่งมารู้ตัวทีหลัง มักเป็นใบเก่าเสมอ
--
-- ★ ทำไมยอมให้ติดลบได้แล้ว ★ ตั้งแต่ 0117 หน้าขายขายเกินสต๊อกได้และสต๊อกติดลบได้
-- โดยถือว่าเลขติดลบคือป้ายบอกว่า "ตัวนี้ต้องไปนับใหม่" · การลบใบรับเข้าใช้ตรรกะเดียวกัน
-- ถ้าใบนั้นรับเข้ามาผิดตั้งแต่แรก ของที่ขายออกไปก็ขายจากตัวเลขที่ผิดอยู่แล้ว
-- การถอนคืนให้ครบจึงเป็นการคืนความจริง ไม่ใช่การทำให้ผิดเพิ่ม
--
-- ★ ไม่เงียบ ★ ยังรวบรายการที่ถอนแล้วติดลบส่งกลับไปให้หน้าจอเตือน เหมือนที่หน้าขายทำ

begin;

CREATE OR REPLACE FUNCTION public.void_goods_receipt(p_receipt_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_shop uuid := public.admin_shop();
  v_r public.goods_receipts;
  v_neg jsonb := '[]'::jsonb;
  m record;
begin
  select * into v_r from public.goods_receipts
   where id = p_receipt_id and shop_id = v_shop for update;
  if v_r.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_r.voided_at is not null then
    return jsonb_build_object('receipt_number', v_r.receipt_number, 'replay', true,
                              'negative', '[]'::jsonb);
  end if;

  -- ★ ไม่ห้ามแล้ว แต่ต้องบอก ★ รวบรายการที่ถอนคืนแล้วสต๊อกจะติดลบ เพื่อให้หน้าจอ
  -- เตือนทันทีว่าของพวกนี้ต้องไปนับใหม่ · เก็บก่อนถอน เพราะหลังถอนตัวเลขเปลี่ยนแล้ว
  for m in
    select mv.variant_id, mv.delta_stock, pv.stock_qty, p.name, pv.size
    from public.stock_movements mv
    join public.product_variants pv on pv.id = mv.variant_id
    join public.products p on p.id = pv.product_id
    where mv.receipt_id = p_receipt_id and mv.reason = 'receive'::public.stock_reason_t
  loop
    if m.stock_qty < m.delta_stock then
      v_neg := v_neg || jsonb_build_object(
        'name', m.name, 'size', m.size,
        'after', m.stock_qty - m.delta_stock);
    end if;
  end loop;

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
    coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'ยกเลิกใบรับเข้า')
    || case when jsonb_array_length(v_neg) > 0
            then ' · สต๊อกติดลบ ' || jsonb_array_length(v_neg) || ' รายการ' else '' end);

  return jsonb_build_object('receipt_number', v_r.receipt_number, 'replay', false,
                            'negative', v_neg);
end $function$;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $verify$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'void_goods_receipt';

  if v_src is null then raise exception 'void_goods_receipt หายไป'; end if;
  if v_src like '%STOCK_SHORT%' then
    raise exception 'ยังมีด่านห้ามลบใบอยู่ — ไม่ได้ถูกแทนที่';
  end if;
  if v_src not like '%negative%' then
    raise exception 'ไม่ได้คืนรายการที่ติดลบกลับไป';
  end if;

  -- ★ ด่านของตารางต้องยอมให้ติดลบ ★ ถ้ายังเป็น >= 0 อยู่ การถอนคืนจะล่มตรงนี้แทน
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.product_variants'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%stock_qty >= 0%'
  ) then
    raise exception 'ด่านห้ามสต๊อกติดลบยังอยู่ — ลบใบแล้วจะล่มตอนถอนคืน';
  end if;

  raise notice '0118 พร้อม — ลบใบรับเข้าได้เสมอ และบอกรายการที่ติดลบกลับมา';
end $verify$;
