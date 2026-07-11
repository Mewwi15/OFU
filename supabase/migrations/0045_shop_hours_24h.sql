-- 0045_shop_hours_24h.sql
-- อู้ฟู่ (Oofoo) — the shop now runs 24 hours (owner decision 2026-07-11).
--
-- Data migration: widen every weekday's window to 00:00–24:00. The app reads
-- these rows (lib/data/shop.ts) and treats 00:00–24:00 as "always open"
-- (data/shop.ts isAllDay) — the closed-shop banner and checkout gate go
-- dormant. Rider delivery is paused separately in the app (coming soon).

update public.shop_hours
set open_time = '00:00', close_time = '24:00';
