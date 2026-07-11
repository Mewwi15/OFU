-- 0044_chat.sql
-- อู้ฟู่ (Oofoo) — customer ↔ shop-admin chat.
--
--   • chat_threads   : ONE thread per customer per shop (LINE-OA style). Carries
--                      denormalised last-message + per-side unread counters so
--                      the admin list and app badge render without aggregation.
--   • chat_messages  : text and/or image messages. Counters/preview maintained
--                      by trigger (SECURITY DEFINER) — clients can't tamper.
--   • pgmq           : admin replies are queued on 'chat_push' and drained by
--                      the chat-push edge function, which materialises rows in
--                      the EXISTING notifications pipeline (0011/0012) — the
--                      dispatch trigger then sends the Expo push. The queue
--                      gives durability + retry (visibility timeout) and lets
--                      the worker collapse bursts into one push per minute.
--   • chat-images    : private storage bucket, path convention
--                      <customer_user_id>/<uuid>.<ext> for BOTH sides, so the
--                      folder alone decides visibility (owner or admin).
--
-- SECURITY DEFINER functions pin search_path=''. Enum literals explicitly cast.

create extension if not exists pgmq;
select pgmq.create('chat_push');

-- Push categories: the in-app feed maps unknown categories conservatively, so
-- adding 'chat' is safe for already-shipped app builds. (Not referenced in this
-- transaction — only by the edge function at runtime.)
alter type notif_category_t add value if not exists 'chat';

create type chat_sender_t as enum ('customer', 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table chat_threads (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references shops(id),
  user_id              uuid not null references app_users(id) on delete cascade,
  last_message_at      timestamptz,
  last_message_preview text,
  customer_unread      int not null default 0,
  admin_unread         int not null default 0,
  created_at           timestamptz not null default now(),
  unique (shop_id, user_id)
);
create index chat_threads_shop_recent_ix on chat_threads (shop_id, last_message_at desc nulls last);

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references chat_threads(id) on delete cascade,
  sender     chat_sender_t not null,
  sender_id  uuid not null references app_users(id),
  body       text,
  image_path text,
  created_at timestamptz not null default now(),
  constraint chat_message_has_content check (body is not null or image_path is not null),
  constraint chat_body_length check (body is null or char_length(body) <= 2000)
);
create index chat_messages_thread_ix on chat_messages (thread_id, created_at);

alter table chat_threads  enable row level security;
alter table chat_messages enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — customer sees own thread; shop admins see all threads of their shop.
-- Threads are written ONLY by definer functions (no insert/update policies).
-- ─────────────────────────────────────────────────────────────────────────────
-- 0003 granted per-table (no default privileges) — new tables grant explicitly.
-- Writes to chat_threads happen only in definer functions; RLS has no
-- insert/update policies, so the broad grant is still gated by policy.
grant select on chat_threads, chat_messages to authenticated;
grant insert on chat_messages to authenticated;
-- The chat-push worker (service role) resolves threads while draining the
-- queue; 0003 revoked default privileges, so service_role needs its own grant.
grant select on chat_threads, chat_messages to service_role;

create policy chat_threads_read on chat_threads for select
  using (user_id = auth.uid() or public.is_admin_of(shop_id));

create policy chat_messages_read on chat_messages for select
  using (exists (
    select 1 from chat_threads t
    where t.id = thread_id
      and (t.user_id = auth.uid() or public.is_admin_of(t.shop_id))
  ));

create policy chat_messages_insert_customer on chat_messages for insert to authenticated
  with check (
    sender = 'customer'::chat_sender_t
    and sender_id = auth.uid()
    and exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid())
  );

create policy chat_messages_insert_admin on chat_messages for insert to authenticated
  with check (
    sender = 'admin'::chat_sender_t
    and sender_id = auth.uid()
    and exists (select 1 from chat_threads t where t.id = thread_id and public.is_admin_of(t.shop_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────────────────────
-- Get-or-create the caller's thread with the shop (single-shop system).
create or replace function public.ensure_chat_thread()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_shop uuid; v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  select id into v_shop from public.shops order by created_at asc limit 1;
  insert into public.chat_threads (shop_id, user_id)
  values (v_shop, auth.uid())
  on conflict (shop_id, user_id) do nothing;
  select id into v_id from public.chat_threads
  where shop_id = v_shop and user_id = auth.uid();
  return v_id;
end $$;

-- Zero the caller's side of the unread counter.
create or replace function public.chat_mark_read(p_thread uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_shop uuid;
begin
  select user_id, shop_id into v_user, v_shop
  from public.chat_threads where id = p_thread;
  if v_user is null then return; end if;

  if v_user = auth.uid() then
    update public.chat_threads set customer_unread = 0 where id = p_thread;
  elsif public.is_admin_of(v_shop) then
    update public.chat_threads set admin_unread = 0 where id = p_thread;
  end if;
end $$;

revoke execute on function public.ensure_chat_thread(), public.chat_mark_read(uuid) from public;
grant execute on function public.ensure_chat_thread(), public.chat_mark_read(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Message trigger — maintain thread denorm + queue admin replies for push.
-- Ping is best-effort (same fallback constants as 0037); the pgmq row is the
-- durable record: an unpinged message is picked up on the next drain.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.on_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  update public.chat_threads set
    last_message_at      = new.created_at,
    last_message_preview = left(coalesce(new.body, 'รูปภาพ'), 120),
    customer_unread      = customer_unread + (new.sender = 'admin'::public.chat_sender_t)::int,
    admin_unread         = admin_unread    + (new.sender = 'customer'::public.chat_sender_t)::int
  where id = new.thread_id;

  if new.sender = 'admin'::public.chat_sender_t then
    perform pgmq.send('chat_push', jsonb_build_object(
      'message_id', new.id,
      'thread_id',  new.thread_id,
      'preview',    left(coalesce(new.body, 'รูปภาพ'), 120)
    ));

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
        url := v_url || '/chat-push',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_key,
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    exception when others then
      null; -- push dispatch must never block a chat write
    end;
  end if;

  return new;
end $$;

create trigger trg_on_chat_message
  after insert on chat_messages
  for each row execute function public.on_chat_message();

-- ─────────────────────────────────────────────────────────────────────────────
-- pgmq access for the worker — PostgREST only exposes `public`, so wrap the
-- queue ops in definer RPCs granted to service_role alone.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.chat_queue_read(p_batch int default 20, p_vt int default 60)
returns setof pgmq.message_record
language sql security definer set search_path = '' as $$
  select * from pgmq.read('chat_push', p_vt, p_batch);
$$;

create or replace function public.chat_queue_delete(p_msg_id bigint)
returns boolean language sql security definer set search_path = '' as $$
  select pgmq.delete('chat_push', p_msg_id);
$$;

revoke execute on function public.chat_queue_read(int, int), public.chat_queue_delete(bigint) from public;
grant execute on function public.chat_queue_read(int, int), public.chat_queue_delete(bigint) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime — thread rows update live (badges, admin list); messages land live.
-- ─────────────────────────────────────────────────────────────────────────────
alter table chat_threads replica identity full;
alter publication supabase_realtime add table public.chat_threads;
alter publication supabase_realtime add table public.chat_messages;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage — private chat-images bucket, customer-folder convention.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

create policy chat_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.app_role() = 'admin')
  );

create policy chat_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.app_role() = 'admin')
  );
