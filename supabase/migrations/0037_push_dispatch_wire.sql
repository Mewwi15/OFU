-- 0037_push_dispatch_wire.sql
-- อู้ฟู่ (Oofoo) — wire the push dispatch trigger to the cloud project.
--
-- 0012 read the function URL + key from database settings, but Supabase cloud
-- denies ALTER DATABASE SET for custom GUCs to the postgres role — so the
-- settings could never be configured and the trigger no-oped forever. Fall back
-- to the project's own values: the URL and the ANON key are public client
-- values (not secrets); the send-push function only needs *a* valid project JWT
-- to pass gateway verification and holds its own service-role env internally.
-- current_setting still wins when present (e.g. a future self-hosted env).

create or replace function public.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  v_url := coalesce(
    nullif(current_setting('app.functions_url', true), ''),
    'https://ejohcdbzvscgakpvgytj.supabase.co/functions/v1'
  );
  v_key := coalesce(
    nullif(current_setting('app.service_role_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqb2hjZGJ6dnNjZ2FrcHZneXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDI1MzEsImV4cCI6MjA5ODkxODUzMX0.nhkPBFuYXnkLm-caHP9uNoss3E1_FyqRnwtfudPh2CQ'
  );
  perform net.http_post(
    url := v_url || '/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  return new;
exception when others then
  return new; -- push dispatch must never block an order-status write
end $$;
