-- 0008_submit_rating.sql
-- อู้ฟู่ (Oofoo) — customer submits a rating for their delivered order.
-- SECURITY DEFINER, search_path=''. Keyed by order_number for the client.

create or replace function public.submit_rating(
  p_order_number text,
  p_rating int,
  p_comment text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_status public.order_status_t;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'rating must be 1..5';
  end if;

  select id, order_status into v_order_id, v_status
  from public.orders
  where order_number = p_order_number and customer_user_id = auth.uid();
  if v_order_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status <> 'delivered'::public.order_status_t then
    raise exception 'NOT_DELIVERED' using errcode = 'P0001';
  end if;

  insert into public.order_ratings (order_id, rating, comment)
  values (v_order_id, p_rating::smallint, p_comment)
  on conflict (order_id) do update set rating = excluded.rating, comment = excluded.comment;

  return jsonb_build_object('order_id', v_order_id, 'rating', p_rating);
end $$;

revoke execute on function public.submit_rating(text, int, text) from public;
grant execute on function public.submit_rating(text, int, text) to authenticated;
