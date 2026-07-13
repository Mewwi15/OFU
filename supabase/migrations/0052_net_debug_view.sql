-- 0052_net_debug_view.sql
-- TEMPORARY diagnostics (will be dropped in a follow-up migration): expose the
-- pg_net response log + the dispatch settings' presence so we can see why the
-- LINE owner alert didn't arrive for a real order (2026-07-13). Response rows
-- carry only status/body of OUR function calls — no customer data, no keys.

create or replace view public._net_debug as
  select id, status_code, left(content, 300) as content, error_msg, created
  from net._http_response
  order by id desc
  limit 50;

create or replace view public._settings_debug as
  select
    (coalesce(current_setting('app.functions_url', true), '') <> '') as functions_url_set,
    (coalesce(current_setting('app.service_role_key', true), '') <> '') as service_key_set,
    current_setting('app.functions_url', true) as functions_url;

grant select on public._net_debug, public._settings_debug to service_role;
