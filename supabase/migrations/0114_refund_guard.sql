-- 0114_refund_guard.sql
-- กันคืนเงินซ้ำ — "คืนบางรายการ" ยิงซ้ำแล้วต้องไม่คืนของ/คืนเงินสองรอบ
--
-- อาการที่เกิดได้จริงและเป็นเงินจริง: ลูกค้าซื้อนม 10 คืน 3 · แคชเชียร์กด "ยืนยันคืนเงิน"
-- ตอน WiFi ร้านกระตุก คำสั่งถึงฐานข้อมูลและ commit เรียบร้อยแล้ว แต่คำตอบหายกลางทาง
-- หน้าจอจึงขึ้นข้อความแดงโดยที่โมดัลยังเปิดค้างพร้อมจำนวนเดิมทุกช่อง กดซ้ำตามสัญชาตญาณ
-- = นมเด้งกลับเข้าสต๊อก 6 กล่องทั้งที่รับคืนมาจริง 3 และ refunded_amount ถูกบวกสองรอบ
--
-- ด่านเดียวที่ 0077 มีคือ "คืนได้ไม่เกินที่เหลือ" (0077:66) ซึ่งกันได้เฉพาะตอนกดคืนเต็ม
-- จำนวนที่เหลือของบรรทัดนั้น — คืนบางจำนวน (3 จาก 10) ทะลุด่านนี้ไปเต็ม ๆ
-- ผลพ่วงที่แพงกว่าตัวสต๊อกเอง:
--   · 0089 เอา refunded_amount ไปหักเงินที่ควรมีในลิ้นชักตามสัดส่วนที่จ่ายสด ยอดที่ถูก
--     บวกซ้ำจึงทำให้ตอนปิดรอบขึ้น "เงินเกิน" ทั้งที่จ่ายคืนไปครั้งเดียว
--   · บิลที่จ่ายด้วยเครดิตร้าน (0077:90-94) จะ insert store_credit_ledger สองรอบ
--     = คืนเครดิตให้ลูกค้าซ้ำ ซึ่งลูกค้าเอาไปใช้ซื้อของได้จริง
--
-- ทางอื่นกันไว้หมดแล้ว มีทางนี้ทางเดียวที่โล่ง: create_pos_sale dedup ด้วย client_op_id
-- มาตั้งแต่ 0019 · refund_pos_sale (เต็มบิล) รอดเพราะบิลที่ status=refunded แล้วจะตอบ
-- replay กลับไปเฉย ๆ (0077:123-125) — เติมด่านเดียวกันให้ refund_pos_sale_items
--
-- ★ ลำดับการขึ้นระบบ: ไมเกรชันนี้ก่อน แล้วค่อย deploy หน้าแอดมิน ★ หน้าแอดมินรุ่นใหม่
-- ส่ง p_client_op_id มาด้วย ถ้าฐานข้อมูลยังไม่มีช่องนี้จะหาฟังก์ชันไม่เจอและคืนเงินไม่ได้
-- ทั้งร้าน · กลับด้าน (ขึ้น DB ก่อน) ไม่มีปัญหา หน้าเดิมเรียกแบบ 3 ตัวได้ตามเดิมเพราะ
-- ตัวที่สี่มีค่าตั้งต้น แค่ยังไม่มีด่านกันซ้ำให้จนกว่าจะ deploy หน้าใหม่

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- สมุดจำ "คำสั่งคืนเงินที่ทำไปแล้ว" — หนึ่งแถวต่อคำสั่งคืนเงินหนึ่งคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pos_refund_ops (
  /* หน้าจอสร้าง id นี้ตอนเปิดโมดัลคืนเงิน แล้วใช้ตัวเดิมทุกครั้งที่กดยืนยันในโมดัลนั้น
     (กดซ้ำหลังขึ้น error ก็ยังเป็น id เดิม) — เป็น primary key เพราะนี่คือตัวกันซ้ำตัวจริง
     ไม่ใช่แค่ดัชนีไว้ค้นหา */
  client_op_id uuid primary key,
  shop_id      uuid not null references public.shops(id) on delete cascade,
  sale_id      uuid not null references public.pos_sales(id) on delete cascade,
  /* ผลลัพธ์ที่ตอบกลับไปรอบแรก — รอบซ้ำต้องได้ตัวเลขชุดเดียวกันเป๊ะ ไม่งั้นใบเสร็จ/
     ข้อความบนจอของสองรอบจะบอกยอดคนละยอดทั้งที่เป็นการคืนครั้งเดียวกัน */
  result       jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists pos_refund_ops_sale_ix
  on public.pos_refund_ops (sale_id, created_at desc);

alter table public.pos_refund_ops enable row level security;
/* ★ ไม่มี policy = ไม่มีใครอ่านผ่าน PostgREST ได้เลย ★ ตั้งใจให้เป็นสมุดภายในของ
   ฟังก์ชัน security definer อย่างเดียว ถ้าวันหลังต้องเปิดให้หน้าไหนอ่าน ให้เพิ่ม policy
   เฉพาะแอดมินเหมือนตารางอื่น อย่าปลด RLS ทิ้ง */
grant select on public.pos_refund_ops to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- refund_pos_sale_items + p_client_op_id (เนื้อในเหมือน 0077 ทุกบรรทัด)
-- ─────────────────────────────────────────────────────────────────────────────
/* ตัวเก่าเป็น 3 อาร์กิวเมนต์ ถ้าปล่อยไว้คู่กับตัวใหม่ที่มีค่าตั้งต้น การเรียกแบบ 3 ตัวจะ
   กำกวม (function is not unique) — ต้องทิ้งตัวเก่าก่อน · หน้าจอรุ่นเก่าที่ยังค้างอยู่ใน
   แท็บของเครื่องในร้านเรียกด้วยชื่อพารามิเตอร์ 3 ตัวเหมือนเดิมได้ต่อ เพราะตัวที่สี่มี
   default (แค่ไม่มีด่านกันซ้ำให้จนกว่าจะรีเฟรชหน้า) */
drop function if exists public.refund_pos_sale_items(uuid, jsonb, text);
create or replace function public.refund_pos_sale_items(
  p_sale_id      uuid,
  p_items        jsonb,
  p_reason       text,
  p_client_op_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_sale public.pos_sales;
  v_it jsonb; v_item public.pos_sale_items;
  v_qty int; v_line_refund numeric := 0; v_gross numeric := 0;
  v_refund int; v_fully boolean;
  v_prev jsonb; v_result jsonb;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'no_items';
  end if;

  select * into v_sale from public.pos_sales
   where id = p_sale_id and shop_id = v_shop for update;
  if v_sale.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  /* ★ ต้องเช็คหลังจับ for update ของบิลแล้วเท่านั้น ★ ถ้าเช็คก่อน สองคำสั่งที่วิ่งมา
     พร้อมกันจะอ่านสมุดตอนที่ยังไม่มีใครเขียน แล้วผ่านด่านไปคืนซ้ำทั้งคู่ — ล็อกบิลก่อน
     ทำให้ตัวที่สองได้อ่านสมุดหลังตัวแรก commit เสมอ
     (เช็คก่อนด่าน NOT_REFUNDABLE ด้วย เพราะถ้ารอบแรกคืนจนครบใบไปแล้ว การกดซ้ำควรได้
     คำตอบเดิมกลับไปเงียบ ๆ ไม่ใช่ข้อความแดงว่าบิลนี้คืนไม่ได้ ซึ่งชวนให้คนหน้าร้านงงว่า
     ตกลงคืนไปหรือยัง) */
  if p_client_op_id is not null then
    select result into v_prev from public.pos_refund_ops where client_op_id = p_client_op_id;
    if v_prev is not null then
      return v_prev || jsonb_build_object('replay', true);
    end if;
  end if;

  if v_sale.status <> 'completed'::public.pos_sale_status_t then
    raise exception 'NOT_REFUNDABLE' using errcode = 'P0001', detail = v_sale.status::text;
  end if;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_it->>'qty')::int;
    select * into v_item from public.pos_sale_items
     where id = (v_it->>'item_id')::uuid and sale_id = p_sale_id for update;
    if v_item.id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'item';
    end if;
    if v_qty is null or v_qty <= 0 or v_qty > v_item.qty - v_item.refunded_qty then
      raise exception 'VALIDATION' using errcode = 'P0001',
        detail = 'คืนได้ไม่เกิน ' || (v_item.qty - v_item.refunded_qty) || ' ชิ้น';
    end if;

    -- เงินคืนของบรรทัด = สัดส่วนของ line_total (ซึ่งหักส่วนลดรายตัวแล้ว)
    v_line_refund := v_line_refund + (v_item.line_total::numeric * v_qty / v_item.qty);

    update public.pos_sale_items set refunded_qty = refunded_qty + v_qty
     where id = v_item.id;
    update public.product_variants set stock_qty = stock_qty + v_qty
     where id = v_item.variant_id;
    insert into public.stock_movements (variant_id, delta_stock, reason, actor_user_id)
    values (v_item.variant_id, v_qty, 'pos_refund'::public.stock_reason_t, auth.uid());
  end loop;

  -- สัดส่วนส่วนลดทั้งบิล: ลูกค้าจ่ายจริง total จาก subtotal → คืนตามสัดส่วนเดียวกัน
  select coalesce(sum(line_total), 0) into v_gross
  from public.pos_sale_items where sale_id = p_sale_id;
  v_refund := least(
    round(v_line_refund * v_sale.total / nullif(v_gross, 0))::int,
    v_sale.total - v_sale.refunded_amount
  );

  if v_sale.payment_method = 'store_credit'::public.pos_pay_method_t
     and v_sale.customer_user_id is not null then
    insert into public.store_credit_ledger (shop_id, user_id, delta, reason, sale_id)
    values (v_shop, v_sale.customer_user_id, v_refund, 'pos_refund', p_sale_id);
  end if;

  v_fully := (v_sale.refunded_amount + v_refund) >= v_sale.total;
  update public.pos_sales set
    refunded_amount = refunded_amount + v_refund,
    refund_reason = case when refund_reason is null then btrim(p_reason)
                         else refund_reason || ' | ' || btrim(p_reason) end,
    status = case when v_fully then 'refunded'::public.pos_sale_status_t else status end
  where id = p_sale_id;

  perform public.write_audit(v_shop, 'refund_pos_sale_items', 'pos_sales', p_sale_id::text,
    'คืน ' || v_refund || ' บาท · ' || btrim(p_reason));

  v_result := jsonb_build_object('sale_number', v_sale.sale_number,
                                 'refund_amount', v_refund, 'fully_refunded', v_fully);

  if p_client_op_id is not null then
    /* ไม่ดัก unique_violation ไว้ — ถ้าชนแปลว่ามีอีกคำสั่งคืนเงินด้วย id เดียวกันแทรกเข้ามา
       ได้จริง ปล่อยให้ทั้งรายการ rollback คือผลที่ถูกต้องกว่าการคืนซ้ำแล้วค่อยมาตามแก้ */
    insert into public.pos_refund_ops (client_op_id, shop_id, sale_id, result)
    values (p_client_op_id, v_shop, p_sale_id, v_result);
  end if;

  return v_result;
end $$;

revoke execute on function public.refund_pos_sale_items(uuid, jsonb, text, uuid) from public;
grant execute on function public.refund_pos_sale_items(uuid, jsonb, text, uuid) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.pos_refund_ops') is null then
    raise exception 'สมุดกันคืนเงินซ้ำ (pos_refund_ops) หายไป';
  end if;
  if to_regprocedure('public.refund_pos_sale_items(uuid,jsonb,text,uuid)') is null then
    raise exception 'refund_pos_sale_items ที่รับ client_op_id หายไป';
  end if;
  if to_regprocedure('public.refund_pos_sale_items(uuid,jsonb,text)') is not null then
    raise exception 'ตัวเก่า 3 อาร์กิวเมนต์ยังอยู่ — การเรียกจะกำกวม';
  end if;
  raise notice '0114 พร้อม — คืนบางรายการยิงซ้ำด้วย client_op_id เดิมแล้วไม่คืนซ้ำ';
end $$;
