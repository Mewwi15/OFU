-- รายงานกำไร/ขายดี นับ "ของที่ขายจริง" — หักของที่คืนไปแล้ว และหักส่วนลดโค้ดออนไลน์
--
-- ★ อ่านก่อนแก้ ★ ตัวเลขในหน้ารายงานจะ "ลดลง" จากที่เจ้าของเคยเห็นย้อนหลังทุกช่วงเวลา
-- นั่นคือของที่ถูก ไม่ใช่รายงานพัง — สองรูที่อุดในไฟล์นี้ดันตัวเลขให้สูงเกินจริงมาตลอด:
--
--   1. คืนเงินบางรายการ (0077) ทำให้บิลยังเป็น completed แล้วบวก refunded_qty รายบรรทัด
--      คืนของเข้าสต๊อกด้วย — แต่ profit_report (0076) กับ "สินค้าขายดี" ใน pos_dashboard
--      (0077) sum(qty)/sum(line_total) ดิบ ๆ ไม่เคยอ่าน refunded_qty ของที่ลูกค้าเอามาคืน
--      จึงยังนับเป็นยอดขายเต็ม และพอเอาของชิ้นเดิมไปขายใหม่ก็นับซ้ำอีกรอบ
--   2. ฝั่งออนไลน์ revenue = sum(order_items.line_total) = ยอด "ก่อน" หักโค้ดส่วนลด
--      (ตัวเลขส่วนลดจริงอยู่ที่ orders.discount_amount ซึ่งไม่เคยถูกอ่านเลย) ยิ่งจัดโปรฯ แรง
--      กำไรยิ่งหลอกตา และหลอกไปทางที่ทำให้กล้าลดราคาเพิ่ม
--
-- ★ ทำไมหักตามสัดส่วน line_total ไม่ใช่ unit_price × refunded_qty ★ บรรทัดที่กด "ลด"
-- รายชิ้นมี line_discount อยู่ด้วย (line_total = unit_price*qty - line_discount) ถ้าหักด้วย
-- ราคาเต็มอย่างที่รายงานรอบขาย 0091 ทำ บรรทัดที่คืนหมดจะกลายเป็นยอดติดลบเท่าส่วนลด —
-- สัดส่วนของ line_total คือตัวเดียวกับที่ refund_pos_sale_items (0077:72) ใช้คิดเงินคืนจริง
-- ตัวเลขในรายงานจึงตรงกับเงินที่จ่ายคืนลูกค้าไปจริง ๆ

begin;

-- ── 1. รายงานกำไรขั้นต้น ─────────────────────────────────────────────────────
-- แทน 0076 (ทุนรายล็อตของ 0104 อยู่ที่ snapshot_line_cost ไม่ได้อยู่ในนี้ จึงไม่กระทบกัน)
create or replace function public.profit_report(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_pos jsonb; v_online jsonb; v_products jsonb; v_missing int;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  /* หน้าร้าน — ยอด/ทุน/ส่วนลดท้ายบิล คิดเฉพาะของที่ยังอยู่กับลูกค้า
     ★ ส่วนลดท้ายบิลต้องหดตามของที่คืนด้วย ★ ไม่งั้นบิล ฿1,000 ลด ฿100 ที่คืนครึ่งบิล
     จะเหลือยอด 500 แต่ยังหักส่วนลดเต็ม 100 = กำไรต่ำกว่าจริง ทั้งที่เงินคืนไป 450 */
  select jsonb_build_object(
      'revenue',       coalesce(round(sum(b.net)), 0),
      'cost',          coalesce(round(sum(b.cost)), 0),
      'bill_discount', coalesce(round(sum(b.bill_discount * b.net / nullif(b.gross, 0))), 0)
    )
  into v_pos
  from (
    select l.sale_id,
           max(l.bill_discount) as bill_discount,
           sum(l.gross) as gross,
           sum(l.net)   as net,
           sum(l.cost)  as cost
    from (
      select s.id as sale_id, s.discount as bill_discount,
             i.line_total::numeric                                              as gross,
             i.line_total::numeric * (i.qty - i.refunded_qty) / nullif(i.qty, 0) as net,
             coalesce(i.unit_cost, v.cost_price, 0) * (i.qty - i.refunded_qty)   as cost
      from public.pos_sale_items i
      join public.pos_sales s on s.id = i.sale_id
      left join public.product_variants v on v.id = i.variant_id
      where s.shop_id = v_shop and s.status = 'completed'::public.pos_sale_status_t
        and s.created_at >= p_from and s.created_at < p_to
    ) l
    group by l.sale_id
  ) b;

  /* ออนไลน์ — revenue คือยอดสินค้าก่อนหักโค้ด ส่วนลดจึงต้องดึงมาเป็นบรรทัดของมันเอง
     ★ หักเฉพาะโค้ดที่ scope = 'subtotal' ★ โค้ดที่ลดค่าส่ง (promo_scope_t ใน 0001) ไปลดที่
     ค่าส่ง ซึ่งไม่เคยถูกนับเป็น revenue ของรายงานนี้อยู่แล้ว (order_items ไม่มีบรรทัดค่าส่ง)
     ถ้าหัก discount_amount ทั้งก้อนดื้อ ๆ จะกลายเป็นกำไรต่ำกว่าจริงแทน */
  select jsonb_build_object(
      'revenue', coalesce(sum(i.line_total), 0),
      'cost',    coalesce(sum(coalesce(i.unit_cost, v.cost_price, 0) * i.qty), 0),
      'bill_discount', coalesce((
        select sum(o2.discount_amount)
        from public.orders o2
        join public.promo_codes pc on pc.id = o2.promo_code_id
        where o2.shop_id = v_shop
          and o2.payment_status = 'paid'::public.payment_status_t
          and o2.placed_at >= p_from and o2.placed_at < p_to
          and pc.scope = 'subtotal'::public.promo_scope_t), 0)
    )
  into v_online
  from public.order_items i
  join public.orders o on o.id = i.order_id
  left join public.product_variants v on v.id = i.variant_id
  where o.shop_id = v_shop and o.payment_status = 'paid'::public.payment_status_t
    and o.placed_at >= p_from and o.placed_at < p_to;

  -- รายสินค้า (รวมสองช่องทาง) — เรียงตามยอดขาย จำกัด 300 แถว
  select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb),
         coalesce(sum(t.no_cost_lines), 0)
  into v_products, v_missing
  from (
    select
      u.name, u.size,
      sum(u.qty)::int                                          as qty,
      round(sum(u.line_total))                                 as revenue,
      round(sum(u.cost_amt))                                   as cost,
      round(sum(u.line_total)) - round(sum(u.cost_amt))        as profit,
      sum(case when u.has_cost then 0 else 1 end)::int         as no_cost_lines
    from (
      select i.product_name as name, i.size,
             (i.qty - i.refunded_qty) as qty,
             i.line_total::numeric * (i.qty - i.refunded_qty) / nullif(i.qty, 0) as line_total,
             coalesce(i.unit_cost, v.cost_price, 0) * (i.qty - i.refunded_qty) as cost_amt,
             (coalesce(i.unit_cost, v.cost_price) is not null) as has_cost
      from public.pos_sale_items i
      join public.pos_sales s on s.id = i.sale_id
      left join public.product_variants v on v.id = i.variant_id
      where s.shop_id = v_shop and s.status = 'completed'::public.pos_sale_status_t
        and s.created_at >= p_from and s.created_at < p_to
      union all
      select i.name_snapshot, i.size_snapshot, i.qty, i.line_total,
             coalesce(i.unit_cost, v.cost_price, 0) * i.qty,
             (coalesce(i.unit_cost, v.cost_price) is not null)
      from public.order_items i
      join public.orders o on o.id = i.order_id
      left join public.product_variants v on v.id = i.variant_id
      where o.shop_id = v_shop and o.payment_status = 'paid'::public.payment_status_t
        and o.placed_at >= p_from and o.placed_at < p_to
    ) u
    group by u.name, u.size
    -- ขายแล้วลูกค้าเอามาคืนครบ = ไม่ได้ขาย ไม่ต้องมีแถวศูนย์รกตาราง
    having sum(u.qty) > 0
    order by revenue desc
    limit 300
  ) t;

  return jsonb_build_object(
    'pos', v_pos, 'online', v_online,
    'products', v_products, 'missing_cost_lines', v_missing
  );
end $$;

revoke execute on function public.profit_report(timestamptz, timestamptz) from public;
grant execute on function public.profit_report(timestamptz, timestamptz) to authenticated;

-- ── 2. สินค้าขายดี: นับจำนวนสุทธิ ────────────────────────────────────────────
-- เหมือน 0077 ทุกอย่าง เปลี่ยนแค่ก้อน top — ของที่ลูกค้าคืนไปแล้วไม่ควรดันสินค้าขึ้นอันดับ
-- ขายดี (การ์ดนี้ยังไปโผล่บนใบสรุปปิดรอบด้วย จึงต้องแก้ที่ฐานข้อมูล ไม่ใช่ที่หน้าเว็บ)
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
        -- ★ cash ก้อนนี้ = เงินสดที่ควรเข้าลิ้นชักทั้งหมด (รวม COD) ★ อย่าเอา v_cod ออก
        -- ใบปิดรอบ (printShift) อ่านช่องนี้เป็น "เงินสดของรอบ" อยู่ — หน้ารายงานที่อยากได้
        -- เฉพาะเงินสดหน้าร้านให้ลบ cod_cash เอาเองฝั่งเว็บ
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
        select i.product_name as name,
               sum(i.qty - i.refunded_qty) as qty,
               round(sum(i.line_total::numeric * (i.qty - i.refunded_qty) / nullif(i.qty, 0))) as amount
        from public.pos_sale_items i
        join public.pos_sales s on s.id = i.sale_id
        where s.shop_id = v_shop
          and s.status = 'completed'::public.pos_sale_status_t
          and s.created_at >= p_from and s.created_at < p_to
        group by i.product_name
        having sum(i.qty - i.refunded_qty) > 0
        order by sum(i.qty - i.refunded_qty) desc
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
declare v_src text;
begin
  if to_regprocedure('public.profit_report(timestamptz,timestamptz)') is null then
    raise exception 'profit_report หายไป';
  end if;
  if to_regprocedure('public.pos_dashboard(timestamptz,timestamptz)') is null then
    raise exception 'pos_dashboard หายไป';
  end if;

  /* กันไมเกรชันเก่ารันทับทีหลัง (0076/0077 ก็ create or replace ตัวเดียวกัน) — ถ้าวันหนึ่ง
     ตัวเลขกำไรเด้งกลับขึ้นไปสูงผิดปกติ ให้มาดูสองด่านนี้ก่อนว่ายังผ่านอยู่ไหม */
  select prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'profit_report';
  if v_src not like '%refunded_qty%' or v_src not like '%promo_scope_t%' then
    raise exception 'profit_report ยังเป็นตัวเก่า (ไม่หักของคืน/ส่วนลดออนไลน์)';
  end if;

  select prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'pos_dashboard';
  if v_src not like '%refunded_qty%' then
    raise exception 'pos_dashboard ยังนับสินค้าขายดีแบบไม่หักของคืน';
  end if;

  raise notice '0112 พร้อม — กำไร/ขายดี หักของที่คืนแล้ว · ออนไลน์หักส่วนลดโค้ดแล้ว';
end $$;
