-- 0020_pos_reports.sql
-- อู้ฟู่ POS (P3) — dashboard RPC: on-site vs online sales, payment split, VAT,
-- and top products for a time range. Read-only, guarded by admin_shop().

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
