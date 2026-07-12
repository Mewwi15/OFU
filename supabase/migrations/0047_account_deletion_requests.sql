-- 0047_account_deletion_requests.sql
-- อู้ฟู่ (Oofoo) — customer-initiated account-deletion REQUESTS (store prep).
--
-- Context: self-service deletion was removed in 0040 (owner decision — the
-- auto-delete left auth logins orphaned). App Store guideline 5.1.1(v) still
-- requires that deletion can be INITIATED in-app, and Play's Data Safety form
-- needs a declared deletion path. So v2 is request-based:
--   customer taps ขอลบบัญชี → row here (audit) + an automatic chat message
--   (the owner already watches chat) → the owner deletes the auth user in the
--   Supabase dashboard within the promised window and marks the request done.
--
--   • account_deletion_requests : one open (pending) request per user.
--     email_snapshot is captured because deleting the auth user nulls user_id
--     (on delete set null) — the owner needs a durable handle for the audit
--     trail and to find the account in the dashboard.
--   • request_account_deletion()        : customer creates/reuses the pending
--     request and posts the chat message. Idempotent.
--   • cancel_account_deletion_request() : customer withdraws it (chat note too).
--   • complete_deletion_request(p_id)   : admin marks a request done.
--
-- SECURITY DEFINER functions pin search_path=''. Enum literals explicitly cast.

create type deletion_request_status_t as enum ('pending', 'done', 'cancelled');

create table account_deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  -- set null (not cascade) so the audit row survives the actual user deletion
  user_id        uuid references app_users(id) on delete set null,
  email_snapshot text,
  status         deletion_request_status_t not null default 'pending',
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz,
  processed_by   uuid references app_users(id)
);
create unique index account_deletion_open_uq
  on account_deletion_requests (user_id) where status = 'pending';
create index account_deletion_status_ix
  on account_deletion_requests (status, requested_at desc);

alter table account_deletion_requests enable row level security;
grant select on account_deletion_requests to authenticated;

-- Customer sees own request; any shop admin sees all (single-shop system).
create policy deletion_requests_read on account_deletion_requests for select
  using (user_id = auth.uid() or public.app_role() = 'admin'::public.role_t);

-- All writes go through the definer RPCs below (no insert/update policies).

-- ── Customer: file the request ───────────────────────────────────────────────
create or replace function public.request_account_deletion()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_shop  uuid;
  v_thread uuid;
  v_at    timestamptz;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- already pending → idempotent success
  select requested_at into v_at from public.account_deletion_requests
  where user_id = auth.uid() and status = 'pending';
  if v_at is not null then return v_at; end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.account_deletion_requests (user_id, email_snapshot)
  values (auth.uid(), v_email)
  returning requested_at into v_at;

  -- Surface it where the owner already looks: the customer's chat thread.
  select id into v_shop from public.shops order by created_at asc limit 1;
  insert into public.chat_threads (shop_id, user_id)
  values (v_shop, auth.uid())
  on conflict (shop_id, user_id) do nothing;
  select id into v_thread from public.chat_threads
  where shop_id = v_shop and user_id = auth.uid();
  insert into public.chat_messages (thread_id, sender, sender_id, body)
  values (v_thread, 'customer'::public.chat_sender_t, auth.uid(),
          'ขอลบบัญชีถาวร (ส่งจากเมนูบัญชีในแอป)');

  return v_at;
end $$;

-- ── Customer: withdraw it ────────────────────────────────────────────────────
create or replace function public.cancel_account_deletion_request()
returns void language plpgsql security definer set search_path = '' as $$
declare v_thread uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  update public.account_deletion_requests
     set status = 'cancelled'::public.deletion_request_status_t,
         processed_at = now()
   where user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'NO_PENDING_REQUEST';
  end if;

  select t.id into v_thread from public.chat_threads t
  join public.shops s on s.id = t.shop_id
  where t.user_id = auth.uid()
  order by s.created_at asc limit 1;
  if v_thread is not null then
    insert into public.chat_messages (thread_id, sender, sender_id, body)
    values (v_thread, 'customer'::public.chat_sender_t, auth.uid(),
            'ยกเลิกคำขอลบบัญชีแล้ว');
  end if;
end $$;

-- ── Admin: mark done after deleting the auth user in the dashboard ──────────
create or replace function public.complete_deletion_request(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.app_role() <> 'admin'::public.role_t then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.account_deletion_requests
     set status = 'done'::public.deletion_request_status_t,
         processed_at = now(),
         processed_by = auth.uid()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'NOT_PENDING';
  end if;
end $$;

revoke execute on function
  public.request_account_deletion(),
  public.cancel_account_deletion_request(),
  public.complete_deletion_request(uuid)
from public;
grant execute on function
  public.request_account_deletion(),
  public.cancel_account_deletion_request(),
  public.complete_deletion_request(uuid)
to authenticated;
