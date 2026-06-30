-- 0009_realtime.sql
-- อู้ฟู่ (Oofoo) — Realtime: stream order status changes to the customer app.
-- The orders table is added to the supabase_realtime publication; RLS still
-- applies to postgres_changes, so a customer only receives their own orders'
-- changes. REPLICA IDENTITY FULL so RLS can evaluate the row on UPDATE/DELETE.

alter table public.orders replica identity full;
alter publication supabase_realtime add table public.orders;
