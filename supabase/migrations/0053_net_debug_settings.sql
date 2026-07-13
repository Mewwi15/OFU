-- 0053_net_debug_settings.sql
-- TEMPORARY diagnostics part 2: where exactly are app.functions_url /
-- app.service_role_key configured (database-level vs role-level), and is
-- there a pg_cron drain job? (Follow-up migration drops all _*_debug views.)

create or replace view public._role_settings_debug as
  select
    coalesce(d.datname, '(all databases)') as database,
    coalesce(r.rolname, '(all roles)') as role,
    s.setconfig::text as setconfig
  from pg_db_role_setting s
  left join pg_database d on d.oid = s.setdatabase
  left join pg_roles r on r.oid = s.setrole;

-- pg_cron only exists where it's been enabled (prod) — create conditionally.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'create or replace view public._cron_debug as
      select jobid, schedule, command, active from cron.job';
    execute 'grant select on public._cron_debug to service_role';
  end if;
end $$;

grant select on public._role_settings_debug to service_role;
