-- 0026_pos_refund.sql
-- POS returns/refunds (P3): full refund of a POS sale — restock every line, log
-- pos_refund stock movements, refund store-credit if that was the tender, and mark
-- the sale 'refunded'. Idempotent (a refunded sale returns replay=true).

create or replace function public.refund_pos_sale(p_sale_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_sale public.pos_sales;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into v_sale from public.pos_sales where id = p_sale_id and shop_id = v_shop for update;
  if v_sale.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sale.status = 'refunded'::public.pos_sale_status_t then
    return jsonb_build_object('id', v_sale.id, 'sale_number', v_sale.sale_number, 'total', v_sale.total, 'replay', true);
  end if;

  -- restock every sold line + log refund movements
  update public.product_variants v set stock_qty = stock_qty + i.qty
  from public.pos_sale_items i where i.sale_id = p_sale_id and v.id = i.variant_id;

  insert into public.stock_movements (variant_id, delta_stock, reason, actor_user_id)
  select variant_id, qty, 'pos_refund'::public.stock_reason_t, auth.uid()
  from public.pos_sale_items where sale_id = p_sale_id;

  -- refund store-credit tender back to the customer wallet
  if v_sale.payment_method = 'store_credit'::public.pos_pay_method_t and v_sale.customer_user_id is not null then
    insert into public.store_credit_ledger (shop_id, user_id, delta, reason, sale_id)
    values (v_shop, v_sale.customer_user_id, v_sale.total, 'pos_refund', p_sale_id);
  end if;

  update public.pos_sales set status = 'refunded'::public.pos_sale_status_t where id = p_sale_id;
  perform public.write_audit(v_shop, 'refund_pos_sale', 'pos_sales', p_sale_id::text, 'refund ' || v_sale.total);

  return jsonb_build_object('id', v_sale.id, 'sale_number', v_sale.sale_number, 'total', v_sale.total, 'replay', false);
end $$;

grant execute on function public.refund_pos_sale(uuid) to authenticated;
