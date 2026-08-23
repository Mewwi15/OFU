-- 0078_receipt_backdate.sql
-- อู้ฟู่ (Oofoo) — ใบรับเข้าลงวันที่ย้อนหลังได้ (ตามฟอร์ม ETS ที่เจ้าของใช้)
--
-- เคสจริง: คีย์ใบรับของของเมื่อวาน/สัปดาห์ก่อนตามหลัง (เช่นเก็บตกช่วง 9–22 ส.ค.
-- ที่ค้างใน ETS) — วันที่ในเอกสารต้องเป็นวันรับจริง ไม่ใช่วันคีย์
--   · received_at = วันที่รับของ (ธุรกิจ) · created_at = เวลาคีย์ (ระบบ) แยกกันชัด
--   · เลขใบ INyymmdd ใช้วันที่รับ ให้เรียงอ่านเหมือน ETS

begin;

alter table public.goods_receipts
  add column if not exists received_at timestamptz not null default now();
update public.goods_receipts set received_at = created_at where received_at = created_at is false;

create or replace function public.create_goods_receipt(
  p_supplier    text,
  p_doc_number  text,
  p_note        text,
  p_items       jsonb,
  p_received_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id uuid; v_no text; v_recv timestamptz := coalesce(p_received_at, now());
  v_item jsonb; v_variant uuid; v_qty int; v_cost numeric;
  v_total numeric := 0; v_lines int := 0; v_pieces int := 0; v_new int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'no_items';
  end if;
  if v_recv > now() + interval '1 day' or v_recv < now() - interval '1 year' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'received_at';
  end if;

  v_no := 'IN' || to_char(v_recv at time zone 'Asia/Bangkok', 'YYMMDD')
       || '-' || lpad(nextval('public.goods_receipt_seq')::text, 3, '0');

  insert into public.goods_receipts (shop_id, receipt_number, supplier, doc_number, note, created_by, received_at)
  values (v_shop, v_no, nullif(btrim(p_supplier), ''), nullif(btrim(p_doc_number), ''),
          nullif(btrim(p_note), ''), auth.uid(), v_recv)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_item->>'variant_id')::uuid;
    v_qty     := (v_item->>'qty')::int;
    v_cost    := nullif(v_item->>'unit_cost', '')::numeric;

    if v_qty is null or v_qty <= 0 or v_qty > 100000 then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'qty 1..100000';
    end if;
    if v_cost is not null and (v_cost < 0 or v_cost > 1000000) then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'unit_cost';
    end if;

    update public.product_variants pv
       set stock_qty  = pv.stock_qty + v_qty,
           cost_price = coalesce(v_cost, pv.cost_price)
      from public.products p
     where pv.id = v_variant and p.id = pv.product_id and p.shop_id = v_shop
    returning pv.stock_qty into v_new;
    if v_new is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = v_variant::text;
    end if;

    insert into public.stock_movements
      (variant_id, delta_stock, delta_reserved, reason, actor_user_id, receipt_id, unit_cost)
    values
      (v_variant, v_qty, 0, 'receive'::public.stock_reason_t, auth.uid(), v_id, v_cost);

    v_total  := v_total + coalesce(v_cost, 0) * v_qty;
    v_lines  := v_lines + 1;
    v_pieces := v_pieces + v_qty;
  end loop;

  update public.goods_receipts
     set total_cost = v_total, line_count = v_lines
   where id = v_id;

  perform public.write_audit(v_shop, 'goods_receipt', 'goods_receipts', v_no,
    coalesce(nullif(btrim(p_supplier), ''), '-') || ' · ' || v_lines || ' รายการ ' || v_pieces || ' ชิ้น · ทุนรวม ' || v_total);

  return jsonb_build_object('id', v_id, 'receipt_number', v_no,
                            'total_cost', v_total, 'line_count', v_lines,
                            'piece_count', v_pieces, 'received_at', v_recv);
end $$;

-- ลบ signature เก่า (4 อาร์กิวเมนต์) กันเรียกสับสน — ตัวใหม่ default ครอบเคสเดิม
drop function if exists public.create_goods_receipt(text, text, text, jsonb);
revoke execute on function public.create_goods_receipt(text, text, text, jsonb, timestamptz) from public;
grant execute on function public.create_goods_receipt(text, text, text, jsonb, timestamptz) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.create_goods_receipt(text,text,text,jsonb,timestamptz)') is null then
    raise exception 'create_goods_receipt v2 หายไป';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='goods_receipts'
                   and column_name='received_at') then
    raise exception 'received_at หายไป';
  end if;
  raise notice '0078 พร้อม — ใบรับเข้าลงวันที่ย้อนหลัง + นับจำนวนชิ้นรวม';
end $$;
