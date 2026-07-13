-- 0054_line_dispatch_fallback.sql
-- Fix: LINE dispatch/owner alerts never fired in prod — 0051 copied the 0012
-- pattern that reads app.functions_url / app.service_role_key, but those DB
-- settings were never configured (verified via pg_db_role_setting: nothing).
-- 0044 (chat) already solved this: fall back to the hardcoded prod functions
-- URL + the PUBLIC anon key (the gateway only needs a valid JWT; the functions
-- use their own service env internally). Also drops the temporary debug views
-- from 0052/0053.

create or replace function public.dispatch_line()
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
  begin
    perform net.http_post(
      url := v_url || '/send-line',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  exception when others then
    null; -- notifying must never break the write that triggered it
  end;
  return new;
end $$;

create or replace function public.line_owner_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url  text;
  v_key  text;
  v_text text;
  v_mode text;
begin
  v_mode := case new.shop_mode::text when 'online' then 'ส่งพัสดุ' else 'เดลิเวอรี่' end;

  if tg_op = 'INSERT' then
    v_text := 'ออเดอร์ใหม่ ' || new.order_number || ' (' || v_mode || ')'
           || chr(10) || 'ยอดรวม ' || new.total || ' บาท';
  elsif new.order_status = 'slip_uploaded'::public.order_status_t
        and old.order_status is distinct from new.order_status then
    v_text := 'ลูกค้าแนบสลิปออเดอร์ ' || new.order_number
           || chr(10) || 'ยอด ' || new.total || ' บาท — รอตรวจสอบในระบบหลังร้าน';
  else
    return new;
  end if;

  v_url := coalesce(
    nullif(current_setting('app.functions_url', true), ''),
    'https://ejohcdbzvscgakpvgytj.supabase.co/functions/v1'
  );
  v_key := coalesce(
    nullif(current_setting('app.service_role_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqb2hjZGJ6dnNjZ2FrcHZneXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDI1MzEsImV4cCI6MjA5ODkxODUzMX0.nhkPBFuYXnkLm-caHP9uNoss3E1_FyqRnwtfudPh2CQ'
  );
  begin
    perform net.http_post(
      url := v_url || '/send-line',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('owner_text', v_text, 'shop_id', new.shop_id)
    );
  exception when others then
    null;
  end;
  return new;
end $$;

-- ── Cleanup: the temporary diagnostics from 0052/0053 ────────────────────────
drop view if exists public._net_debug;
drop view if exists public._settings_debug;
drop view if exists public._role_settings_debug;
drop view if exists public._cron_debug;
