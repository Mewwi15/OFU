-- Opening the receipt editor is read-only. Replace a receipt only when Save
-- succeeds, in one transaction, with a retry key and protection from stale edits.
begin;

alter table public.goods_receipts
  add column if not exists replaces_receipt_id uuid unique references public.goods_receipts(id),
  add column if not exists edit_request_id uuid unique;

create or replace function public.get_goods_receipt_lines(p_receipt_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_id', v.id, 'product_name', p.name, 'size', v.size,
    'barcode', v.barcode, 'sku', v.sku, 'price', v.price, 'stock_qty', v.stock_qty,
    'qty', m.delta_stock, 'unit_cost', m.unit_cost
  ) order by m.created_at, m.id), '[]'::jsonb)
  from public.stock_movements m
  join public.product_variants v on v.id = m.variant_id
  join public.products p on p.id = v.product_id
  join public.goods_receipts r on r.id = m.receipt_id
  where m.receipt_id = p_receipt_id and m.reason = 'receive'
    and r.shop_id = public.admin_shop_safe();
$$;

create or replace function public.replace_goods_receipt(
  p_receipt_id uuid, p_request_id uuid,
  p_supplier text, p_doc_number text, p_note text,
  p_items jsonb, p_received_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_old public.goods_receipts;
  v_new public.goods_receipts;
  v_result jsonb;
  v_variants uuid[];
  v_negative jsonb;
  v_compare public.goods_receipts;
  v_same boolean;
begin
  select * into v_old from public.goods_receipts
    where id = p_receipt_id and shop_id = v_shop for update;
  if v_old.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_request_id is null then raise exception 'VALIDATION' using detail = 'request_id'; end if;

  select * into v_new from public.goods_receipts where replaces_receipt_id = p_receipt_id;
  if (v_old.voided_at is not null or v_new.id is not null)
     and (v_new.id is null or v_new.edit_request_id is distinct from p_request_id) then
    raise exception 'STALE_WRITE';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'VALIDATION' using detail = 'no_items';
  end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'VALIDATION' using detail = 'no_items'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) i group by i->>'variant_id' having count(*)>1) then
    raise exception 'VALIDATION' using detail = 'duplicate_receipt_variant';
  end if;

  -- An unchanged save does nothing. A retry of a committed save must have the
  -- same content; otherwise a changed draft must not be silently discarded.
  v_compare := case when v_new.id is not null then v_new else v_old end;
  select v_compare.supplier is not distinct from nullif(btrim(p_supplier),'')
    and v_compare.doc_number is not distinct from nullif(btrim(p_doc_number),'')
    and v_compare.note is not distinct from nullif(btrim(p_note),'')
    and v_compare.received_at = p_received_at
    and (select jsonb_agg(jsonb_build_array(m.variant_id,m.delta_stock,m.unit_cost) order by m.variant_id)
         from public.stock_movements m where m.receipt_id=v_compare.id and m.reason='receive')
      = (select jsonb_agg(jsonb_build_array((i->>'variant_id')::uuid,(i->>'qty')::int,
              nullif(i->>'unit_cost','')::numeric) order by (i->>'variant_id')::uuid)
         from jsonb_array_elements(p_items) i)
    into v_same;
  if v_new.id is not null and (not coalesce(v_same,false) or v_new.voided_at is not null) then
    raise exception 'STALE_WRITE';
  end if;
  if v_same then
    return jsonb_build_object('id',v_compare.id,'receipt_number',v_compare.receipt_number,
      'line_count',v_compare.line_count,'total_cost',v_compare.total_cost,'replay',v_new.id is not null);
  end if;

  -- Lock all affected stock rows in a consistent order before either operation.
  select array_agg(id order by id) into v_variants from (
    select variant_id as id from public.stock_movements where receipt_id=p_receipt_id and reason='receive'
    union select (i->>'variant_id')::uuid from jsonb_array_elements(p_items) i
  ) ids;
  perform 1 from public.product_variants where id=any(v_variants) order by id for update;

  perform public.void_goods_receipt(p_receipt_id, 'แก้ไขใบเมื่อบันทึก');
  v_result := public.create_goods_receipt(p_supplier,p_doc_number,p_note,p_items,p_received_at);
  update public.goods_receipts set replaces_receipt_id=p_receipt_id, edit_request_id=p_request_id
    where id=(v_result->>'id')::uuid;

  -- Report only final stock, never the temporary withdrawal inside this transaction.
  select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'size',v.size,'after',v.stock_qty)), '[]'::jsonb)
    into v_negative
  from public.product_variants v join public.products p on p.id=v.product_id
  where v.id=any(v_variants) and v.stock_qty<0;
  perform public.write_audit(v_shop,'edit_goods_receipt','goods_receipts',v_old.receipt_number,
    'บันทึกการแก้ไขเป็น ' || (v_result->>'receipt_number'));
  return v_result || jsonb_build_object('negative',v_negative,'replay',false);
end $$;

revoke execute on function public.get_goods_receipt_lines(uuid) from public;
grant execute on function public.get_goods_receipt_lines(uuid) to authenticated;
revoke execute on function public.replace_goods_receipt(uuid,uuid,text,text,text,jsonb,timestamptz) from public;
grant execute on function public.replace_goods_receipt(uuid,uuid,text,text,text,jsonb,timestamptz) to authenticated;

commit;
