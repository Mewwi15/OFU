-- 0042: สินค้าขายดีในรายงานต้องรวมออเดอร์ออนไลน์ด้วย
--
-- หน้ารายงานเขียนว่า "หน้าร้าน + ออนไลน์" และการ์ดยอดขายก็รวมออนไลน์แล้ว
-- แต่ตาราง "สินค้าขายดี" (key `top`) เดิมนับเฉพาะ pos_sale_items → ขายผ่านแอป
-- เท่าไหร่ก็ไม่ติดอันดับ ทำให้ตัวเลขขัดกันเองในหน้าเดียว
--
-- แก้: union รายการ POS (บิล completed) กับ order_items ของออเดอร์ที่จ่ายแล้ว
-- (payment_status = paid) ในช่วงเวลาเดียวกัน แล้วค่อยจัดอันดับ

create or replace function public.pos_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_out jsonb;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select jsonb_build_object(
    'onsite', (
      select jsonb_build_object(
        'count',        count(*) filter (where status = 'completed'::public.pos_sale_status_t),
        'gross',        coalesce(sum(total)      filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'vat',          coalesce(sum(vat_amount) filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'net',          coalesce(sum(net_amount) filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'discount',     coalesce(sum(discount)   filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'cash',         coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'cash'::public.pos_pay_method_t), 0),
        'promptpay',    coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'promptpay'::public.pos_pay_method_t), 0),
        'store_credit', coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'store_credit'::public.pos_pay_method_t), 0),
        'refunds',      coalesce(sum(total) filter (where status = 'refunded'::public.pos_sale_status_t), 0)
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
        select u.name, sum(u.qty) as qty, sum(u.amount) as amount
        from (
          -- หน้าร้าน: บิล POS ที่จบแล้ว
          select i.product_name as name, i.qty, i.line_total as amount
          from public.pos_sale_items i
          join public.pos_sales s on s.id = i.sale_id
          where s.shop_id = v_shop
            and s.status = 'completed'::public.pos_sale_status_t
            and s.created_at >= p_from and s.created_at < p_to
          union all
          -- ออนไลน์: ออเดอร์ที่ชำระแล้ว
          select oi.name_snapshot as name, oi.qty, oi.line_total as amount
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where o.shop_id = v_shop
            and o.payment_status = 'paid'::public.payment_status_t
            and o.placed_at >= p_from and o.placed_at < p_to
        ) u
        group by u.name
        order by sum(u.qty) desc
        limit 5
      ) t
    )
  ) into v_out;

  return v_out;
end $$;
