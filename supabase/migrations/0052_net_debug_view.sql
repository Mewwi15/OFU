-- 0052_net_debug_view.sql
-- TEMPORARY diagnostics (will be dropped in a follow-up migration): expose the
-- pg_net response log + the dispatch settings' presence so we can see why the
-- LINE owner alert didn't arrive for a real order (2026-07-13). Response rows
-- carry only status/body of OUR function calls — no customer data, no keys.
--
-- `net._http_response` only exists once pg_net has been enabled, which is true
-- on the hosted project but NOT on a freshly reset local stack — an
-- unconditional reference here aborted `supabase db reset` at this migration
-- and left the local database half-built. Guard on the table so a rebuild from
-- zero completes; where pg_net IS present (prod) the view is created exactly as
-- before.

do $$
begin
  if to_regclass('net._http_response') is not null then
    execute $v$
      create or replace view public._net_debug as
        select id, status_code, left(content, 300) as content, error_msg, created
        from net._http_response
        order by id desc
        limit 50
    $v$;
    execute 'grant select on public._net_debug to service_role';
  end if;
end $$;

create or replace view public._settings_debug as
  select
    (coalesce(current_setting('app.functions_url', true), '') <> '') as functions_url_set,
    (coalesce(current_setting('app.service_role_key', true), '') <> '') as service_key_set,
    current_setting('app.functions_url', true) as functions_url;

grant select on public._settings_debug to service_role;
