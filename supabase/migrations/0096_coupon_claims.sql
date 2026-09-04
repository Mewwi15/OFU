-- ระบบ "เก็บคูปอง" เข้าบัญชีลูกค้าจริง — เจ้าของสั่ง 4 ก.ย. 2026 "ทำระบบคูปองเดี๋ยวนี้เลย"
--
-- รอบก่อน (0095) แท็บคูปองแค่ "แสดงรายการ" แล้วปุ่มเก็บทำได้แค่คัดลอกโค้ด เพราะไม่มี
-- ตารางเก็บคูปองรายคน — คราวนี้ทำของจริง กดเก็บแล้วผูกกับบัญชี ไปเลือกใช้ที่ตะกร้าได้
-- โดยไม่ต้องจำโค้ด
--
-- ★ เก็บ ≠ ใช้ ★
-- การเก็บไม่กินโควตา ไม่จองสิทธิ์ และไม่การันตีว่าจะใช้ได้ — คนเก็บ 500 คนบนคูปองที่
-- จำกัด 100 ครั้ง ก็ยังใช้ได้แค่ 100 คนแรกที่สั่งจริง โควตายังนับจาก promo_redemptions
-- ที่ place_order เขียนตอนสั่งซื้อเหมือนเดิมทุกอย่าง ไม่แตะตรงนั้นเลย
-- (ถ้าให้การเก็บกินโควตา คนกดเก็บทิ้งไว้เฉย ๆ จะล็อกสิทธิ์คนที่ตั้งใจซื้อจริง)

create table if not exists public.coupon_claims (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id),
  user_id       uuid not null references public.app_users(id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  claimed_at    timestamptz not null default now(),
  -- เก็บซ้ำใบเดิมไม่ได้ ใช้เป็นตัวกัน race ตอนกดรัว ๆ ด้วย (on conflict do nothing)
  unique (user_id, promo_code_id)
);
create index if not exists coupon_claims_user_ix
  on public.coupon_claims (user_id, claimed_at desc);

-- RLS เปิดแต่ไม่มี policy และไม่ grant ให้ anon/authenticated — ลูกค้าเข้าถึงผ่าน RPC
-- เท่านั้น (แบบเดียวกับตารางอื่นที่ไม่อยากให้ client แตะตรง ๆ)
alter table public.coupon_claims enable row level security;

-- service_role อ่านได้เหมือนตารางอื่นทั้งระบบ — เป็นบทบาทของงานหลังบ้าน/สำรองข้อมูล
-- ที่ข้าม RLS อยู่แล้วทุกตาราง ถ้าไม่ให้สิทธิ์ตารางนี้ตารางเดียวจะกลายเป็นจุดบอดเวลา
-- ต้องไล่ตรวจปัญหา (เจอมาแล้วตอนเขียนเทสต์ อ่านไม่ได้เลยแม้ใช้ service_role)
grant select, insert, update, delete on public.coupon_claims to service_role;

-- ── เก็บคูปอง ────────────────────────────────────────────────────────────
-- ตรวจให้ครบเหมือนตอนแสดงรายการ ก่อนยอมให้เก็บ — ไม่งั้นคนยิง RPC ตรง ๆ จะเก็บคูปอง
-- ที่ไม่ได้เปิดให้เห็น (visible_in_app = false) ซึ่งคือโค้ดลับทั้งหมดของร้าน
create or replace function public.claim_coupon(p_promo_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_shop  uuid;
  v_promo public.promo_codes%rowtype;
  v_used  int;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select shop_id into v_shop from public.app_users where id = v_uid;

  select * into v_promo
    from public.promo_codes
   where id = p_promo_id and shop_id = v_shop;

  -- ไม่แยกเหตุผลว่า "ไม่มีใบนี้" กับ "มีแต่เป็นโค้ดลับ" — ตอบเหมือนกันทั้งคู่ ไม่งั้น
  -- คนไล่ยิง id จะรู้ได้ว่าใบไหนมีอยู่จริงบ้าง
  if not found or not v_promo.visible_in_app then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND',
      'message_th', 'ไม่พบคูปองนี้');
  end if;
  if not v_promo.active then
    return jsonb_build_object('ok', false, 'reason', 'INACTIVE',
      'message_th', 'คูปองนี้ถูกปิดใช้งานแล้ว');
  end if;
  if v_promo.active_from is not null and now() < v_promo.active_from then
    return jsonb_build_object('ok', false, 'reason', 'NOT_STARTED',
      'message_th', 'คูปองนี้ยังไม่เริ่มใช้งาน');
  end if;
  if v_promo.active_to is not null and now() > v_promo.active_to then
    return jsonb_build_object('ok', false, 'reason', 'EXPIRED',
      'message_th', 'คูปองนี้หมดอายุแล้ว');
  end if;

  -- โควตารวมเต็มแล้วไม่ต้องให้เก็บ เก็บไปก็ใช้ไม่ได้
  if v_promo.total_limit is not null then
    select count(*) into v_used from public.promo_redemptions
     where promo_code_id = v_promo.id and released_at is null;
    if v_used >= v_promo.total_limit then
      return jsonb_build_object('ok', false, 'reason', 'USAGE_EXCEEDED',
        'message_th', 'คูปองนี้ถูกใช้ครบจำนวนแล้ว');
    end if;
  end if;

  -- กดซ้ำไม่เป็นไร ถือว่าเก็บแล้วเหมือนเดิม (ปุ่มกดรัวหรือเน็ตกระตุกแล้วยิงซ้ำ)
  insert into public.coupon_claims (shop_id, user_id, promo_code_id)
  values (v_shop, v_uid, v_promo.id)
  on conflict (user_id, promo_code_id) do nothing;

  return jsonb_build_object('ok', true, 'code', v_promo.code::text,
    'message_th', 'เก็บคูปองแล้ว');
end $$;

revoke execute on function public.claim_coupon(uuid) from public;
grant execute on function public.claim_coupon(uuid) to authenticated;

-- ── รายการคูปอง + สถานะว่าเก็บแล้วหรือยัง ────────────────────────────────
-- แทนที่ตัวเดิมจาก 0095 — เพิ่มฟิลด์ claimed อย่างเดียว ลายเซ็นเท่าเดิมจึง replace ได้เลย
-- ไม่ต้อง drop (ไม่เกิด PGRST203)
create or replace function public.list_app_coupons()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_shop uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  select shop_id into v_shop from public.app_users where id = v_uid;
  if v_shop is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    -- เก็บแล้วขึ้นก่อน แล้วค่อยเรียงตามยอดขั้นต่ำ — คูปองที่เป็นของตัวเองแล้วสำคัญกว่า
    select jsonb_agg(c order by c.claimed desc, c.min_spend, c.code)
    from (
      select p.id,
             p.code::text  as code,
             p.type::text  as type,
             p.value,
             p.max_discount,
             p.min_spend,
             p.scope::text as scope,
             p.active_to,
             exists (
               select 1 from public.coupon_claims cc
                where cc.promo_code_id = p.id and cc.user_id = v_uid
             ) as claimed
        from public.promo_codes p
       where p.shop_id = v_shop
         and p.active
         and p.visible_in_app
         and (p.active_from is null or now() >= p.active_from)
         and (p.active_to   is null or now() <= p.active_to)
         and (
           p.total_limit is null
           or (select count(*) from public.promo_redemptions r
                where r.promo_code_id = p.id and r.released_at is null) < p.total_limit
         )
         and (
           p.per_user_limit is null
           or (select count(*) from public.promo_redemptions r
                where r.promo_code_id = p.id and r.user_id = v_uid and r.released_at is null)
              < p.per_user_limit
         )
    ) c
  ), '[]'::jsonb);
end $$;

revoke execute on function public.list_app_coupons() from public;
grant execute on function public.list_app_coupons() to authenticated;
