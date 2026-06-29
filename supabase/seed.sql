-- seed.sql — local dev fixtures (run by `supabase db reset` / first `start`).
-- Minimal for the Auth slice: one shop + settings so the signup trigger has a
-- shop to attach new customers to. Catalog / test accounts come later.

insert into public.shops (id, name, slug, promptpay_id, promptpay_name, active)
values ('00000000-0000-0000-0000-0000000000a1', 'ร้าน อู้ฟู่', 'oofoo',
        '0812345678', 'อู้ฟู่ จำกัด', true)
on conflict (id) do nothing;

insert into public.shop_settings (shop_id)
values ('00000000-0000-0000-0000-0000000000a1')
on conflict (shop_id) do nothing;
