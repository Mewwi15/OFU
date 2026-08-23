-- 0077_partial_refund.sql
-- อู้ฟู่ (Oofoo) — คืนเงินบางรายการ + บังคับเหตุผล (เจ้าของสั่งครบชุด 23 ส.ค.)
--
-- เดิม refund_pos_sale (0026) คืนได้ทั้งบิลเท่านั้น ไม่ถามเหตุผล — ลูกค้าซื้อ 10
-- คืน 1 ต้องคืนหมดแล้วขายใหม่ · เพิ่ม:
--   1. คอลัมน์ติดตาม: refunded_qty รายบรรทัด · refunded_amount + refund_reason รายบิล
--   2. refund_pos_sale_items — คืนบางรายการ/บางจำนวน คืนสต๊อกเฉพาะที่คืน
--      ยอดเงินคืนคิดสัดส่วนจาก line_total และส่วนลดทั้งบิล
--   3. refund_pos_sale เวอร์ชันใหม่ รับเหตุผล (ค่าเดิมเรียกได้เหมือนเดิม)
--   4. pos_dashboard: ช่อง refunds นับยอดคืนจริง (เต็ม+บางส่วน) ไม่ใช่นับเฉพาะบิล
--      ที่ status = refunded

begin;

-- ── 1. คอลัมน์ติดตามการคืน ───────────────────────────────────────────────────
alter table public.pos_sale_items
  add column if not exists refunded_qty int not null default 0;
alter table public.pos_sales
  add column if not exists refunded_amount int not null default 0,
  add column if not exists refund_reason text;

-- backfill บิลที่เคยคืนเต็มไปแล้ว ให้ตัวเลขใหม่เล่าเรื่องเดิมถูกต้อง
update public.pos_sales set refunded_amount = total
 where status = 'refunded'::public.pos_sale_status_t and refunded_amount = 0;
update public.pos_sale_items i set refunded_qty = i.qty
  from public.pos_sales s
 where s.id = i.sale_id and s.status = 'refunded'::public.pos_sale_status_t
   and i.refunded_qty = 0;

-- ── 2. คืนบางรายการ ──────────────────────────────────────────────────────────
-- p_items: [{item_id, qty}] · เหตุผลบังคับ
create or replace function public.refund_pos_sale_items(
  p_sale_id uuid,
  p_items   jsonb,
  p_reason  text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_sale public.pos_sales;
  v_it jsonb; v_item public.pos_sale_items;
  v_qty int; v_line_refund numeric := 0; v_gross numeric := 0;
  v_refund int; v_fully boolean;
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

  return jsonb_build_object('sale_number', v_sale.sale_number,
                            'refund_amount', v_refund, 'fully_refunded', v_fully);
end $$;

revoke execute on function public.refund_pos_sale_items(uuid, jsonb, text) from public;
grant execute on function public.refund_pos_sale_items(uuid, jsonb, text) to authenticated;

-- ── 3. คืนทั้งบิล v2 — รับเหตุผล (เรียกแบบเดิมไม่พังเพราะ default) ────────────
drop function if exists public.refund_pos_sale(uuid);
create or replace function public.refund_pos_sale(p_sale_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_sale public.pos_sales;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into v_sale from public.pos_sales where id = p_sale_id and shop_id = v_shop for update;
  if v_sale.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sale.status = 'refunded'::public.pos_sale_status_t then
    return jsonb_build_object('id', v_sale.id, 'sale_number', v_sale.sale_number, 'total', v_sale.total, 'replay', true);
  end if;

  -- คืนสต๊อกเฉพาะส่วนที่ยังไม่เคยคืน (บิลที่เคยคืนบางรายการไปแล้วต้องไม่คืนซ้ำ)
  update public.product_variants v set stock_qty = stock_qty + (i.qty - i.refunded_qty)
  from public.pos_sale_items i
  where i.sale_id = p_sale_id and v.id = i.variant_id and i.qty > i.refunded_qty;

  insert into public.stock_movements (variant_id, delta_stock, reason, actor_user_id)
  select variant_id, qty - refunded_qty, 'pos_refund'::public.stock_reason_t, auth.uid()
  from public.pos_sale_items where sale_id = p_sale_id and qty > refunded_qty;

  if v_sale.payment_method = 'store_credit'::public.pos_pay_method_t and v_sale.customer_user_id is not null then
    insert into public.store_credit_ledger (shop_id, user_id, delta, reason, sale_id)
    values (v_shop, v_sale.customer_user_id, v_sale.total - v_sale.refunded_amount, 'pos_refund', p_sale_id);
  end if;

  update public.pos_sale_items set refunded_qty = qty where sale_id = p_sale_id;
  update public.pos_sales set
    status = 'refunded'::public.pos_sale_status_t,
    refunded_amount = total,
    refund_reason = case when p_reason is null or btrim(p_reason) = '' then refund_reason
                         when refund_reason is null then btrim(p_reason)
                         else refund_reason || ' | ' || btrim(p_reason) end
  where id = p_sale_id;

  perform public.write_audit(v_shop, 'refund_pos_sale', 'pos_sales', p_sale_id::text,
    'refund ' || v_sale.total || coalesce(' · ' || nullif(btrim(p_reason), ''), ''));

  return jsonb_build_object('id', v_sale.id, 'sale_number', v_sale.sale_number, 'total', v_sale.total, 'replay', false);
end $$;

revoke execute on function public.refund_pos_sale(uuid, text) from public;
grant execute on function public.refund_pos_sale(uuid, text) to authenticated;

-- ── 4. รายงาน: ช่องคืนเงินนับยอดคืนจริง (เต็ม + บางส่วน) ─────────────────────
create or replace function public.pos_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_out jsonb; v_cod bigint;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select coalesce(sum(cod_amount), 0) into v_cod
  from public.orders
  where shop_id = v_shop
    and cod_collected_at >= p_from and cod_collected_at < p_to;

  select jsonb_build_object(
    'onsite', (
      select jsonb_build_object(
        'count',        count(*) filter (where status = 'completed'::public.pos_sale_status_t),
        'gross',        coalesce(sum(total)      filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'vat',          coalesce(sum(vat_amount) filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'net',          coalesce(sum(net_amount) filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'discount',     coalesce(sum(discount)   filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'cash',         coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'cash'::public.pos_pay_method_t), 0) + v_cod,
        'cod_cash',     v_cod,
        'promptpay',    coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'promptpay'::public.pos_pay_method_t), 0),
        'store_credit', coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'store_credit'::public.pos_pay_method_t), 0),
        -- ยอดคืนจริงทั้งหมด (เต็มบิล + บางรายการ) — เดิมนับเฉพาะบิล status=refunded
        'refunds',      coalesce(sum(refunded_amount), 0)
      )
      from public.pos_sales
      where shop_id = v_shop and created_at >= p_from and created_at < p_to
    ),
    'online', (
      select jsonb_build_object(
        'count', count(*) filter (where payment_status = 'paid'::public.payment_status_t),
        'gross', coalesce(sum(total) filter (where payment_status = 'paid'::public.payment_status_t), 0)
      )
      from public.orders
      where shop_id = v_shop and placed_at >= p_from and placed_at < p_to
    ),
    'top', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select i.product_name as name, sum(i.qty) as qty, sum(i.line_total) as amount
        from public.pos_sale_items i
        join public.pos_sales s on s.id = i.sale_id
        where s.shop_id = v_shop
          and s.status = 'completed'::public.pos_sale_status_t
          and s.created_at >= p_from and s.created_at < p_to
        group by i.product_name
        order by sum(i.qty) desc
        limit 5
      ) t
    )
  ) into v_out;

  return v_out;
end $$;

revoke execute on function public.pos_dashboard(timestamptz, timestamptz) from public;
grant execute on function public.pos_dashboard(timestamptz, timestamptz) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.refund_pos_sale_items(uuid,jsonb,text)') is null then
    raise exception 'refund_pos_sale_items หายไป';
  end if;
  if to_regprocedure('public.refund_pos_sale(uuid,text)') is null then
    raise exception 'refund_pos_sale v2 หายไป';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='pos_sale_items'
                   and column_name='refunded_qty') then
    raise exception 'refunded_qty หายไป';
  end if;
  raise notice '0077 พร้อม — คืนเงินบางรายการ + เหตุผล ใช้ได้ในหน้าบิลขาย';
end $$;
