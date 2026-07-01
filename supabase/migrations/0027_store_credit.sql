-- 0027_store_credit.sql
-- Store-credit wallet (P3): admin looks a customer up by phone, tops up credit,
-- and views the ledger. Spending is already handled by create_pos_sale
-- (store_credit tender) + refunds by refund_pos_sale.

-- Find a customer by phone + their current shop credit balance.
create or replace function public.find_customer_by_phone(p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_u record; v_bal int;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select id, display_name, phone into v_u
  from public.app_users
  where phone = p_phone and role = 'customer'::public.role_t
  order by created_at limit 1;
  if v_u.id is null then return null; end if;
  select coalesce(sum(delta), 0) into v_bal
  from public.store_credit_ledger where user_id = v_u.id and shop_id = v_shop;
  return jsonb_build_object('user_id', v_u.id, 'display_name', v_u.display_name, 'phone', v_u.phone, 'balance', v_bal);
end $$;

-- Top up a customer's store credit.
create or replace function public.topup_store_credit(p_user_id uuid, p_amount int, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_bal int;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'amount > 0';
  end if;
  if not exists (select 1 from public.app_users where id = p_user_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.store_credit_ledger (shop_id, user_id, delta, reason)
  values (v_shop, p_user_id, p_amount, coalesce(p_note, 'topup'));
  select coalesce(sum(delta), 0) into v_bal from public.store_credit_ledger where user_id = p_user_id and shop_id = v_shop;
  perform public.write_audit(v_shop, 'topup_store_credit', 'store_credit_ledger', p_user_id::text, 'topup ' || p_amount);
  return jsonb_build_object('balance', v_bal);
end $$;

-- Recent ledger entries for a customer.
create or replace function public.list_store_credit(p_user_id uuid)
returns table (id uuid, delta int, reason text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop();
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return query
    select l.id, l.delta, l.reason, l.created_at
    from public.store_credit_ledger l
    where l.user_id = p_user_id and l.shop_id = v_shop
    order by l.created_at desc limit 50;
end $$;

grant execute on function public.find_customer_by_phone(text) to authenticated;
grant execute on function public.topup_store_credit(uuid, int, text) to authenticated;
grant execute on function public.list_store_credit(uuid) to authenticated;
