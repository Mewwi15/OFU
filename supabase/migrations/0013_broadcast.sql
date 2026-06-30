-- 0013_broadcast.sql
-- อู้ฟู่ (Oofoo) — admin broadcasts a notification (e.g. a promo) to every active
-- customer of the shop. Reuses the notification pipeline: one notification row,
-- a recipient per customer (in-app feed), and a pending push delivery per customer
-- who allows push (the send-push worker delivers them). admin_shop() guards it.

create or replace function public.broadcast_notification(
  p_title text,
  p_body text default null,
  p_category public.notif_category_t default 'promo',
  p_classification public.notif_class_t default 'marketing'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id uuid;
  v_recipients int;
  v_push int;
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'title required';
  end if;

  insert into public.notifications
    (shop_id, audience, classification, category, title, body, target_type, dedupe_key)
  values
    (v_shop, 'customer'::public.notif_audience_t, p_classification, p_category,
     btrim(p_title), nullif(btrim(p_body), ''), 'broadcast', gen_random_uuid()::text)
  returning id into v_id;

  -- in-app feed: every active customer of the shop
  insert into public.notification_recipients (notification_id, user_id)
  select v_id, u.id
  from public.app_users u
  where u.shop_id = v_shop
    and u.role = 'customer'::public.role_t
    and u.account_state = 'active'::public.account_state_t
  on conflict (notification_id, user_id) do nothing;
  get diagnostics v_recipients = row_count;

  -- push: only customers who allow push (preference defaults to true)
  insert into public.notification_deliveries (notification_id, user_id, channel, status)
  select v_id, u.id, 'push'::public.notif_channel_t, 'pending'::public.notif_delivery_status_t
  from public.app_users u
  left join public.notification_preferences np on np.user_id = u.id
  where u.shop_id = v_shop
    and u.role = 'customer'::public.role_t
    and u.account_state = 'active'::public.account_state_t
    and coalesce(np.push_enabled, true);
  get diagnostics v_push = row_count;

  perform public.write_audit(
    v_shop, 'broadcast_notification', 'notifications', v_id::text,
    'ส่งแจ้งเตือน: ' || btrim(p_title), null
  );

  return jsonb_build_object('notification_id', v_id, 'recipients', v_recipients, 'push', v_push);
end $$;

revoke execute on function public.broadcast_notification(text, text, public.notif_category_t, public.notif_class_t) from public;
grant execute on function public.broadcast_notification(text, text, public.notif_category_t, public.notif_class_t) to authenticated;
