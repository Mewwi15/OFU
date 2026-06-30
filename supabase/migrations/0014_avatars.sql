-- 0014_avatars.sql
-- อู้ฟู่ (Oofoo) — avatars bucket (public read; users upload/replace their own,
-- keyed by <uid>.jpg). Profile photo upload from the account screen.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars');
