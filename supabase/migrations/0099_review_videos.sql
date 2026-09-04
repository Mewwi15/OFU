-- แถบรีวิวสินค้าเป็นวิดีโอบนหน้าแรก — เจ้าของสั่ง 4 ก.ย. 2026 "ล่างแบรนเนอร์จะเป็น
-- วิดีโอครับ ทำเหมือนการ์ดสินค้าแหละครับแต่เป็นวีดิโอ คือแถบรีวิวสินค้าครับ"
-- และเลือกว่า "เล่นเองในแถบ เหมือน TikTok" + "อัปไฟล์วิดีโอในหลังร้านเอง"
--
-- ★ ทำไมเป็นตารางใหม่ ไม่ยัดลง banners ★
-- banners เป็นภาพนิ่งที่มีปุ่ม CTA และผูกกับ "ช่อง" (placement) ที่ตายตัวช่องละหนึ่งชุด
-- ส่วนรีวิวเป็นวิดีโอที่ผูกกับ "สินค้า" หนึ่งชิ้น มีภาพปก มีความยาว และจะมีกี่คลิปก็ได้
-- ยัดรวมกันแล้วคอลัมน์ครึ่งหนึ่งจะว่างตลอดในแต่ละฝั่ง และ query ของหน้าแรกต้องกรอง
-- ประเภทเองทุกครั้ง
--
-- ภาพปก (poster) แยกจากตัววิดีโอ ไม่ได้ถอดเฟรมแรกตอนแสดงผล — เฟรมแรกของคลิปมักเป็น
-- ภาพเบลอตอนกล้องยังไม่โฟกัส และการถอดเฟรมต้องโหลดวิดีโอมาก่อนซึ่งช้ากว่าโหลดรูปมาก
-- แถวนี้มีหลายคลิปเรียงกัน ถ้าไม่มีภาพปกจะเห็นกล่องดำเรียงกันจนกว่าจะโหลดครบ

create table if not exists public.review_videos (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id),
  -- ไฟล์ในบักเก็ต review-videos (เก็บ path ไม่ใช่ URL เต็ม — โดเมนของ storage
  -- เปลี่ยนได้ตอนย้ายโปรเจกต์ ถ้าเก็บ URL เต็มไว้ทุกแถวจะต้องไล่แก้ทั้งตาราง)
  video_path    text not null,
  -- ภาพปกในบักเก็ต product-images (บักเก็ตเดิม ไม่ต้องเปิดของใหม่ให้ซ้ำซ้อน)
  poster_path   text,
  caption       text,
  -- คลิปนี้รีวิวสินค้าชิ้นไหน — ให้กดจากคลิปไปหน้าสินค้าได้เลย
  -- ลบสินค้าแล้วคลิปไม่ต้องหายตาม แค่ไม่มีปลายทางให้กด (set null)
  product_id    uuid references public.products(id) on delete set null,
  display_order int not null default 0,
  publish_state public.publish_state_t not null default 'draft',
  created_by    uuid references public.app_users(id),
  created_at    timestamptz not null default now()
);
create index if not exists review_videos_ix
  on public.review_videos (shop_id, publish_state, display_order);

alter table public.review_videos enable row level security;

-- อ่านได้เฉพาะที่เผยแพร่แล้ว (ลูกค้า) หรือทุกใบถ้าเป็นแอดมินของร้านนั้น —
-- แบบเดียวกับ banners_read ทุกประการ
create policy review_videos_read on public.review_videos for select
  using (publish_state = 'published' or public.is_admin_of(shop_id));

grant select on public.review_videos to anon, authenticated;
-- ★ ต้อง grant ให้ service_role ด้วยมือ ★ service_role ข้าม RLS ก็จริง แต่ข้าม GRANT
-- ระดับตารางไม่ได้ ตารางใหม่จึงถูกปฏิเสธด้วย "permission denied" ทั้งที่เป็นคีย์ผู้ดูแล
-- (เจอมาแล้วตอน coupon_claims ใน 0096 — สคริปต์ทดสอบตกเพราะเรื่องนี้ ไม่ใช่เพราะ RLS)
grant select, insert, update, delete on public.review_videos to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- บักเก็ตวิดีโอ — อ่านสาธารณะ เขียนเฉพาะแอดมิน (สูตรเดียวกับ product-images)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-videos', 'review-videos', true,
  -- 50 MB ต่อคลิป — คลิปรีวิวสั้น ๆ 15-30 วินาทีที่บีบอัดแล้วอยู่ราว 5-15 MB
  -- ตั้งเพดานไว้ที่ฐานข้อมูลด้วย ไม่ใช่เช็คแค่ในหน้าแอดมิน เพราะฝั่งหน้าเว็บ
  -- ถูกข้ามได้ด้วยการยิง API ตรง แต่กฎของบักเก็ตข้ามไม่ได้
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists review_videos_storage_read on storage.objects;
create policy review_videos_storage_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'review-videos');

drop policy if exists review_videos_storage_insert on storage.objects;
create policy review_videos_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-videos' and public.app_role() = 'admin');

drop policy if exists review_videos_storage_update on storage.objects;
create policy review_videos_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'review-videos' and public.app_role() = 'admin');

drop policy if exists review_videos_storage_delete on storage.objects;
create policy review_videos_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'review-videos' and public.app_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC ฝั่งแอดมิน — เขียนผ่านฟังก์ชันเสมอ ไม่เปิด insert/update ตรงให้ตาราง
-- (สูตรเดียวกับ upsert_banner ใน 0006) admin_shop() เป็นตัวกันไม่ให้คนที่ไม่ใช่
-- แอดมินเขียนได้ ต่อให้เรียกฟังก์ชันตรง ๆ
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_review_video(
  p_id uuid default null,
  p_video_path text default null,
  p_poster_path text default null,
  p_caption text default null,
  p_product_id uuid default null,
  p_display_order int default 0,
  p_publish_state public.publish_state_t default 'draft'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  if p_video_path is null or btrim(p_video_path) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'video required';
  end if;
  if p_id is null then
    insert into public.review_videos (
      shop_id, video_path, poster_path, caption, product_id,
      display_order, publish_state, created_by
    ) values (
      v_shop, p_video_path, p_poster_path, p_caption, p_product_id,
      coalesce(p_display_order, 0),
      coalesce(p_publish_state, 'draft'::public.publish_state_t), auth.uid()
    ) returning id into v_id;
  else
    update public.review_videos set
      video_path = p_video_path,
      poster_path = p_poster_path,
      caption = p_caption,
      product_id = p_product_id,
      display_order = coalesce(p_display_order, display_order),
      publish_state = coalesce(p_publish_state, publish_state)
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  perform public.write_audit(v_shop, 'upsert_review_video', 'review_videos', v_id::text, 'review video');
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.delete_review_video(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_id uuid;
begin
  delete from public.review_videos where id = p_id and shop_id = v_shop returning id into v_id;
  if v_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.write_audit(v_shop, 'delete_review_video', 'review_videos', p_id::text, 'deleted');
  return jsonb_build_object('id', p_id, 'deleted', true);
end $$;

grant execute on function public.upsert_review_video(uuid, text, text, text, uuid, int, public.publish_state_t) to authenticated;
grant execute on function public.delete_review_video(uuid) to authenticated;
