-- 0012_push_dispatch.sql
-- อู้ฟู่ (Oofoo) — auto-invoke the send-push Edge Function when a pending push
-- delivery is inserted (pg_net, fire-and-forget). The function URL + service key
-- come from DB settings so this is env-portable; if they aren't configured (e.g.
-- local without secrets) the trigger no-ops and deliveries are drained by a
-- scheduled invocation instead.
--
--   In prod, configure once:
--     alter database postgres set app.functions_url = 'https://<ref>.supabase.co/functions/v1';
--     alter database postgres set app.service_role_key = '<service_role_key>';

create or replace function public.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  v_url := current_setting('app.functions_url', true);
  v_key := current_setting('app.service_role_key', true);
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return new; -- not configured here; scheduled drain handles it
  end if;
  perform net.http_post(
    url := v_url || '/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  return new;
end $$;

-- The send-push Edge Function runs as service_role; give it table access
-- (matches Supabase cloud defaults — our 0003 grants only covered anon/authenticated).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

drop trigger if exists trg_dispatch_push on public.notification_deliveries;
create trigger trg_dispatch_push
  after insert on public.notification_deliveries
  for each row
  when (new.channel = 'push'::public.notif_channel_t
        and new.status = 'pending'::public.notif_delivery_status_t)
  execute function public.dispatch_push();
