-- 0010_storage.sql
-- อู้ฟู่ (Oofoo) — Storage buckets + RLS.
--   payment-slips : PRIVATE. Customers upload their transfer slip; the uploader
--                   or a shop admin may read it (admin needs it to approve).
--   product-images: PUBLIC read; only admins write (admin web uploads).

insert into storage.buckets (id, name, public)
values
  ('payment-slips', 'payment-slips', false),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ── payment-slips (private) ──────────────────────────────────────────────────
create policy "slips_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-slips');

create policy "slips_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-slips'
    and (owner = auth.uid() or public.app_role() = 'admin')
  );

-- re-upload (upsert of an existing slip) → UPDATE; only the uploader may replace
create policy "slips_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-slips' and owner = auth.uid())
  with check (bucket_id = 'payment-slips');

-- ── product-images (public read, admin write) ────────────────────────────────
create policy "product_images_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "product_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.app_role() = 'admin');

create policy "product_images_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.app_role() = 'admin');

create policy "product_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.app_role() = 'admin');
