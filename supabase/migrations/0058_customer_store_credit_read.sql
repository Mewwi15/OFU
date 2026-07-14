-- อู้ฟู่ (Oofoo) — let a customer read their OWN store-credit balance/history.
-- store_credit_ledger's only existing policy (0018_pos_schema.sql) is
-- admin-only (`is_admin_of(shop_id)`) — a customer currently has no way to
-- see their own balance, not even read-only, despite the shop being able to
-- grant/spend it. Matches this codebase's established pattern (place_order,
-- get_consent_status, etc.): a narrowly-scoped SECURITY DEFINER RPC reading
-- only auth.uid()'s own rows, rather than widening the table's own RLS.
create or replace function public.list_my_store_credit()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_balance int;
  v_entries jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select coalesce(sum(delta), 0) into v_balance
  from public.store_credit_ledger
  where user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'delta', e.delta, 'reason', e.reason, 'created_at', e.created_at
         ) order by e.created_at desc), '[]'::jsonb)
  into v_entries
  from (
    select id, delta, reason, created_at
    from public.store_credit_ledger
    where user_id = v_uid
    order by created_at desc
    limit 50
  ) e;

  return jsonb_build_object('balance', v_balance, 'entries', v_entries);
end $$;

revoke execute on function public.list_my_store_credit() from public;
grant execute on function public.list_my_store_credit() to authenticated;
