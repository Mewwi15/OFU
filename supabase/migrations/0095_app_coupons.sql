-- คูปองที่ลูกค้าเห็นได้ในแอป — เจ้าของสั่ง 4 ก.ย. 2026 "หน้าสินค้าเราไม่เอาแล้ว
-- เปลี่ยนเป็นคูปองแทน" (แทนที่แท็บสินค้าใน bottom bar ด้วยแท็บคูปอง)
--
-- ตอนนี้ลูกค้าอ่านตาราง promo_codes ไม่ได้เลย — RLS เปิดให้เฉพาะแอดมิน (0003) ลูกค้า
-- ทำได้แค่พิมพ์โค้ดที่รู้อยู่แล้วเข้าไปเช็คผ่าน validate_promo ซึ่งเป็น security definer
-- แท็บคูปองต้อง "แสดงรายการ" ได้ จึงต้องมีทางอ่านใหม่
--
-- ★ ไม่เปิดคูปองทุกใบให้เห็นอัตโนมัติ ★
-- โค้ดส่วนลดจำนวนมากเป็นของลับ/ยิงเฉพาะราย (ส่งให้ลูกค้าคนเดียว ชดเชยเคสมีปัญหา
-- ให้พนักงาน ฯลฯ) ถ้าเปิดทุกใบที่ active ให้เห็นในแอป โค้ดพวกนั้นจะกลายเป็นของ
-- สาธารณะทันทีและร้านเสียเงินจริง — ร้านเปิดขายอยู่ ความผิดพลาดตรงนี้มีต้นทุน
-- จึงเพิ่มธง visible_in_app แยกต่างหาก ตั้งต้นเป็น false ทุกใบรวมถึงใบที่มีอยู่แล้ว
-- เจ้าของต้องติ๊กเลือกเองว่าใบไหนจะโชว์ในแอป (ปลอดภัยโดยปริยาย ไม่ใช่เปิดโดยปริยาย)

alter table public.promo_codes
  add column if not exists visible_in_app boolean not null default false;

comment on column public.promo_codes.visible_in_app is
  'ให้คูปองใบนี้โผล่ในแท็บคูปองของแอปลูกค้า — ตั้งต้น false เพราะโค้ดลับ/ยิงเฉพาะราย '
  'ต้องไม่หลุดเป็นสาธารณะเอง';

-- ── รายการคูปองที่ลูกค้าคนนี้ใช้ได้ตอนนี้ ────────────────────────────────
-- security definer เพราะต้องอ่าน promo_codes ที่ RLS ปิดไว้ และต้องนับการใช้งานของ
-- ผู้เรียกเองจาก promo_redemptions ซึ่งลูกค้าอ่านตรง ๆ ไม่ได้เหมือนกัน
--
-- เงื่อนไขการคัดกรองสะท้อน validate_promo (0005) ทุกข้อยกเว้นยอดขั้นต่ำ — min_spend
-- ขึ้นกับตะกร้า ณ ตอนนั้น ซึ่งหน้ารวมคูปองยังไม่รู้ จึงส่ง min_spend กลับไปให้แอป
-- แสดงเป็นเงื่อนไขแทนที่จะตัดใบนั้นทิ้ง (คนดูคูปองก่อนหยิบของเป็นเรื่องปกติ)
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
    select jsonb_agg(c order by c.min_spend, c.code)
    from (
      select p.id,
             p.code::text                as code,
             p.type::text                as type,
             p.value,
             p.max_discount,
             p.min_spend,
             p.scope::text               as scope,
             p.active_to
        from public.promo_codes p
       where p.shop_id = v_shop
         and p.active
         and p.visible_in_app
         and (p.active_from is null or now() >= p.active_from)
         and (p.active_to   is null or now() <= p.active_to)
         -- โควตารวมยังไม่เต็ม — นับเฉพาะที่ยังไม่ถูกคืน เหมือน validate_promo
         and (
           p.total_limit is null
           or (select count(*) from public.promo_redemptions r
                where r.promo_code_id = p.id and r.released_at is null) < p.total_limit
         )
         -- โควตาต่อคนของผู้เรียกยังไม่เต็ม — ใบที่คนนี้ใช้ครบแล้วไม่ต้องโชว์ให้เก้อ
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

-- ── upsert_promo_code รับธงใหม่ ─────────────────────────────────────────
-- ต้อง drop ก่อน เพราะการเพิ่มพารามิเตอร์ = ลายเซ็นใหม่ ถ้าไม่ drop PostgREST จะเห็น
-- สองตัวแล้วเลือกไม่ถูก (PGRST203) — บทเรียนเดิมจาก 0035 ที่ทำแบบเดียวกัน
drop function if exists public.upsert_promo_code(
  citext, public.promo_type_t, int, uuid, int, int, public.promo_scope_t,
  timestamptz, timestamptz, int, int, boolean
);

create or replace function public.upsert_promo_code(
  p_code             citext,
  p_type             public.promo_type_t,
  p_value            int,
  p_id               uuid default null,
  p_max_discount     int default null,
  p_min_spend        int default 0,
  p_scope            public.promo_scope_t default 'subtotal',
  p_active_from      timestamptz default null,
  p_active_to        timestamptz default null,
  p_total_limit      int default null,
  p_per_user_limit   int default null,
  p_active           boolean default true,
  p_visible_in_app   boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id   uuid;
begin
  if v_shop is null or not public.is_owner_of(v_shop) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_code is null or btrim(p_code::text) = '' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'code_required';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'value_must_be_positive';
  end if;
  if p_type = 'percent'::public.promo_type_t and p_value > 100 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'percent_over_100';
  end if;
  if p_min_spend < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'min_spend_negative';
  end if;
  if p_active_from is not null and p_active_to is not null and p_active_from > p_active_to then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'date_range';
  end if;

  if p_id is null then
    insert into public.promo_codes (
      shop_id, code, type, value, max_discount, min_spend, scope,
      active_from, active_to, total_limit, per_user_limit, active,
      visible_in_app, created_by
    ) values (
      v_shop, p_code, p_type, p_value, p_max_discount, p_min_spend, p_scope,
      p_active_from, p_active_to, p_total_limit, p_per_user_limit, p_active,
      coalesce(p_visible_in_app, false), auth.uid()
    )
    returning id into v_id;
  else
    update public.promo_codes set
      code            = p_code,
      type            = p_type,
      value           = p_value,
      max_discount    = p_max_discount,
      min_spend       = p_min_spend,
      scope           = p_scope,
      active_from     = p_active_from,
      active_to       = p_active_to,
      total_limit     = p_total_limit,
      per_user_limit  = p_per_user_limit,
      active          = p_active,
      visible_in_app  = coalesce(p_visible_in_app, false)
    where id = p_id and shop_id = v_shop
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  perform public.write_audit(v_shop, 'upsert_promo_code', 'promo_codes', v_id::text, p_code::text);
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    raise exception 'DUPLICATE_PROMO_CODE' using errcode = 'P0001';
  when check_violation then
    raise exception 'VALIDATION' using errcode = 'P0001';
end $$;

revoke execute on function public.upsert_promo_code(
  citext, public.promo_type_t, int, uuid, int, int, public.promo_scope_t,
  timestamptz, timestamptz, int, int, boolean, boolean
) from public;
grant execute on function public.upsert_promo_code(
  citext, public.promo_type_t, int, uuid, int, int, public.promo_scope_t,
  timestamptz, timestamptz, int, int, boolean, boolean
) to authenticated;
