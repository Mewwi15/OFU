-- รายงานการขายของรอบ สำหรับใบสรุปปิดรอบ — เจ้าของสั่ง 30 ส.ค. 2026
-- ("ตอนปิดรอบมีรายงานการขายมั้ย ขายอะไรออกไปบ้าง สต๊อกลดเท่าไหร่")
--
-- ใบปิดรอบเดิมมีแต่ "สินค้าขายดี 5 อันดับ" ซึ่ง pos_dashboard ตัด limit 5 ไว้ตั้งแต่
-- ในฐานข้อมูล รอบที่ขายของ 40 ชนิดจึงเห็นแค่ 5 อีก 35 หายไปเลย
--
-- สามอย่างที่เพิ่ม:
--   1. รายการสินค้าที่ขายทั้งหมด ไม่ตัด — เรียงตามยอดเงินเพราะเวลาไล่ตรวจคนดูของ
--      ที่เป็นเงินก้อนใหญ่ก่อน หักจำนวนที่คืนออกให้แล้ว ตัวเลขจึงเป็นของที่ขายจริง
--   2. สต๊อกที่ขยับในรอบ — "ขายไปกี่ชิ้น" กับ "สต๊อกลดเท่าไหร่" ไม่เท่ากัน เพราะ
--      รอบเดียวกันอาจมีของคืนเข้าสต๊อกหรือรับของเข้าด้วย อ่านจาก stock_movements
--      ที่บันทึกทุกการขยับพร้อมเหตุผลอยู่แล้ว
--   3. กำไรขั้นต้น — unit_cost ถูกบันทึกลงบรรทัดบิล ณ ตอนขายอยู่แล้ว (ทุน ณ วันนั้น
--      ไม่ใช่ทุนวันนี้) คำนวณได้ตรง ๆ ไม่ต้องไปดึงราคาทุนปัจจุบันมาย้อนคิด

create or replace function public.shift_sales_report(p_shift_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop  uuid := public.admin_shop();
  v_row   public.pos_shifts;
  v_to    timestamptz;
  v_items jsonb;
  v_stock jsonb;
  v_rev   numeric;
  v_cost  numeric;
begin
  select * into v_row from public.pos_shifts where id = p_shift_id and shop_id = v_shop;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_to := coalesce(v_row.closed_at, now());

  -- 1. ขายอะไรออกไปบ้าง (ทุกชนิด) — qty กับยอดหักส่วนที่คืนแล้วออกให้
  select coalesce(jsonb_agg(t order by t.amount desc), '[]'::jsonb) into v_items
  from (
    select i.product_name as name,
           sum(i.qty - i.refunded_qty)                                   as qty,
           sum(i.line_total - (i.unit_price * i.refunded_qty))           as amount
      from public.pos_sale_items i
      join public.pos_sales s on s.id = i.sale_id
     where s.shift_id = p_shift_id
       and s.status <> 'voided'::public.pos_sale_status_t
     group by i.product_name
    having sum(i.qty - i.refunded_qty) > 0
  ) t;

  -- 2. สต๊อกขยับเท่าไหร่ในช่วงเวลาของรอบ แยกตามเหตุผล
  select jsonb_build_object(
           'sold',     coalesce(-sum(delta_stock) filter (where reason = 'pos_sale'::public.stock_reason_t), 0),
           'returned', coalesce( sum(delta_stock) filter (where reason = 'pos_refund'::public.stock_reason_t), 0),
           'received', coalesce( sum(delta_stock) filter (where reason = 'receive'::public.stock_reason_t), 0),
           'adjusted', coalesce( sum(delta_stock) filter (where reason = 'admin_adjust'::public.stock_reason_t), 0)
         ) into v_stock
    from public.stock_movements
   where created_at >= v_row.opened_at and created_at < v_to;

  -- 3. กำไรขั้นต้น — ทุนที่ตรึงไว้ ณ ตอนขาย ไม่ใช่ทุนวันนี้
  select coalesce(sum(i.line_total - (i.unit_price * i.refunded_qty)), 0),
         coalesce(sum(coalesce(i.unit_cost, 0) * (i.qty - i.refunded_qty)), 0)
    into v_rev, v_cost
    from public.pos_sale_items i
    join public.pos_sales s on s.id = i.sale_id
   where s.shift_id = p_shift_id
     and s.status <> 'voided'::public.pos_sale_status_t;

  return jsonb_build_object(
    'items', v_items,
    'stock', v_stock,
    'revenue', round(v_rev),
    'cost',    round(v_cost),
    'gross',   round(v_rev - v_cost),
    -- ไม่มีทุนบันทึกไว้เลย = คิดกำไรไม่ได้ ต้องบอกให้รู้ ไม่ใช่โชว์กำไร 100%
    'cost_missing', (select count(*) > 0 from public.pos_sale_items i
                      join public.pos_sales s on s.id = i.sale_id
                     where s.shift_id = p_shift_id
                       and s.status <> 'voided'::public.pos_sale_status_t
                       and coalesce(i.unit_cost, 0) = 0)
  );
end $$;

revoke execute on function public.shift_sales_report(uuid) from public;
grant execute on function public.shift_sales_report(uuid) to authenticated;
