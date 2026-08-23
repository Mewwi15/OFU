-- 0073_delivery_zone.sql
-- อู้ฟู่ (Oofoo) — เขตจัดส่งเดลิเวอรี่: เกินรัศมีที่กำหนด (ค่าเริ่มต้น 15 กม.) สั่งไม่ได้
--
-- เจ้าของเปลี่ยนนโยบาย 23 ส.ค.: จากเดิม "ไม่จำกัดระยะ แล้วค่อยยกเลิกด้วยเหตุผล
-- out_of_area ทีหลัง" (0071) → ตัดตั้งแต่ตอนสั่งเลย ลูกค้าไม่ต้องรอแล้วผิดหวัง
--
-- ระยะ = เส้นตรง (haversine) ไม่ใช่ระยะถนน — ไม่ต้องพึ่ง API เสียเงิน และในเมือง
-- ขนาดนี้ต่างกันไม่กี่กิโล เจ้าของปรับรัศมีชดเชยเองได้ในตาราง
--
-- การบังคับอยู่ที่ trigger ตอน insert ออเดอร์ ไม่ใช่ใน place_order — เพราะ
-- place_order ยาวมากและถูก recreate มาแล้วหลายรอบ (0005→0048→0067) แก้ตรงนั้น
-- ต้องคัดลอกทั้งฟังก์ชันมาเสี่ยงพลาด ส่วน trigger ครอบทุกเส้นทางที่สร้างออเดอร์
-- delivery โดยแตะโค้ดเดิมศูนย์บรรทัด และ abort ใน transaction เดียวกัน
-- (สต๊อกที่กันไว้ rollback เอง)
--
-- ยังไม่ตั้งพิกัดร้าน (shop_lat/lng = null) = ระบบเงียบ ไม่บล็อกอะไร

begin;

-- ── 1. ค่าตั้ง: พิกัดร้าน + รัศมี ────────────────────────────────────────────
alter table public.shop_settings
  add column if not exists shop_lat double precision,
  add column if not exists shop_lng double precision,
  add column if not exists delivery_radius_km numeric not null default 15
    check (delivery_radius_km > 0);

comment on column public.shop_settings.delivery_radius_km is
  'รัศมีจัดส่งเดลิเวอรี่ (กม. เส้นตรงจากพิกัดร้าน) · มีผลเมื่อ shop_lat/lng ถูกตั้ง';

-- ── 2. ระยะเส้นตรงเป็นกิโลเมตร (haversine) ───────────────────────────────────
create or replace function public.km_between(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

grant execute on function public.km_between(double precision, double precision, double precision, double precision)
  to anon, authenticated;

-- ── 3. ด่านตรวจตอนสร้างออเดอร์ delivery ──────────────────────────────────────
create or replace function public.enforce_delivery_zone()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_lat double precision; v_lng double precision; v_radius numeric; v_km double precision;
begin
  if new.shop_mode <> 'delivery'::public.shop_mode_t then return new; end if;

  select s.shop_lat, s.shop_lng, s.delivery_radius_km
  into v_lat, v_lng, v_radius
  from public.shop_settings s where s.shop_id = new.shop_id;

  -- ยังไม่ตั้งพิกัดร้าน = ยังไม่เปิดใช้เขต
  if v_lat is null or v_lng is null then return new; end if;

  -- เปิดเขตแล้ว ที่อยู่ต้องมีหมุด — ไม่มีหมุดก็วัดระยะไม่ได้ ปล่อยผ่านไม่ได้
  if new.ship_lat is null or new.ship_lng is null then
    raise exception 'OUT_OF_AREA' using errcode = 'P0001', detail = 'no_pin';
  end if;

  v_km := public.km_between(v_lat, v_lng, new.ship_lat, new.ship_lng);
  if v_km > v_radius then
    raise exception 'OUT_OF_AREA' using errcode = 'P0001',
      detail = json_build_object('km', round(v_km::numeric, 1), 'radius_km', v_radius)::text;
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_delivery_zone on public.orders;
create trigger trg_enforce_delivery_zone
  before insert on public.orders
  for each row execute function public.enforce_delivery_zone();

-- ── 4. เปิดให้แอปอ่านเขต (โชว์ก่อนลูกค้ากดสั่ง — UX ดีกว่ารอ error) ─────────
-- พิกัดร้านเป็นข้อมูลสาธารณะอยู่แล้ว (หน้าร้านจริง ลูกค้าต้องรู้ว่าร้านอยู่ไหน)
create or replace function public.get_fulfilment_fees()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'delivery_fee',       coalesce(s.delivery_fee, 40),
    'free_delivery_min',  coalesce(s.free_delivery_threshold, 200),
    'online_fee',         coalesce(s.online_fee, 150),
    'online_free_min',    s.online_free_threshold,
    'cod_enabled',        coalesce(s.cod_enabled, true),
    'cod_cap',            s.cod_cap,
    'shop_lat',           s.shop_lat,
    'shop_lng',           s.shop_lng,
    'delivery_radius_km', s.delivery_radius_km
  )
  from public.shop_settings s
  limit 1;
$$;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.km_between(double precision,double precision,double precision,double precision)') is null then
    raise exception 'km_between หายไป';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_enforce_delivery_zone') then
    raise exception 'trigger เขตจัดส่งหายไป';
  end if;
  -- ระยะ กทม.→นนทบุรี ~16-17 กม. ต้องคำนวณได้ค่าสมเหตุผล
  if abs(public.km_between(13.7563, 100.5018, 13.8621, 100.5144) - 11.8) > 1 then
    raise exception 'km_between คำนวณเพี้ยน: %',
      public.km_between(13.7563, 100.5018, 13.8621, 100.5144);
  end if;
  raise notice '0073 พร้อม — ตั้งพิกัดร้านเพื่อเปิดใช้:';
  raise notice 'update shop_settings set shop_lat = xx.xxxxxx, shop_lng = yyy.yyyyyy;';
end $$;
