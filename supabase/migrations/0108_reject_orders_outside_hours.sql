-- นอกเวลาทำการ = ไม่รับออเดอร์ (ปฏิเสธที่ฐานข้อมูล)
--
-- เจ้าของสั่ง 6 ก.ย. 2026: "ปฏิเสธเลยครับ นอกเวลาไม่ต้องรับ"
--
-- ★ ก่อนหน้านี้ไม่มีด่านนี้เลยฝั่งเซิร์ฟเวอร์ ★ place_order ไม่เคยดูเวลาเปิดร้าน มีแต่หน้า
-- ตะกร้าในแอปที่เช็ค — ซึ่งข้ามได้จริงหลายทาง (เปิดตะกร้าตอนร้านเปิดแล้วกดจ่ายหลังร้านปิด,
-- กลับมาต่อออเดอร์ที่ค้างไว้ซึ่งข้ามหน้าตะกร้าไปเลย, ยิง API ตรง)
-- ผลคือออเดอร์ตอนตีสามเข้าจริง แล้วเจ้าของต้องมาตามยกเลิกเอง
--
-- ★ ทำเป็นทริกเกอร์บนตาราง orders ไม่ใช่แก้ใน place_order ★ เหตุผลเดียวกับด่านเขตส่ง
-- (0073): ออเดอร์ถูกสร้างได้จากหลายทาง ทริกเกอร์ดักได้ทุกทางในที่เดียว และแก้กติกา
-- ทีหลังไม่ต้องไปยุ่งกับ RPC ที่ยาวและเป็นเส้นทางที่ร้านใช้ขายจริงทุกวัน

begin;

/**
 * ร้านเปิดอยู่ไหม ณ เวลานี้ (เวลาไทย)
 *
 * ★ ต้องคิดด้วยเวลาไทยเสมอ ★ เซิร์ฟเวอร์เดินด้วย UTC ถ้าเทียบตรง ๆ ร้านที่เปิด 08:00–21:00
 * จะกลายเป็นเปิด 15:00–04:00 ตามเวลาไทย — ปฏิเสธลูกค้าทั้งวันแล้วเปิดรับตอนดึกแทน
 *
 * กติกาเดียวกับฝั่งแอป (data/shop.ts): 00:00–24:00 หรือ 00:00–23:59 = เปิดตลอด ·
 * ช่วงที่คร่อมเที่ยงคืน (เช่น 18:00–02:00) นับต่อเนื่องข้ามวัน · ไม่ได้ตั้งเวลาของวันนั้น
 * ไว้เลย = เปิด (ร้านที่ยังไม่ได้กรอกตารางไม่ควรขายไม่ได้)
 */
create or replace function public.shop_is_open(p_shop_id uuid, p_at timestamptz default now())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Bangkok';
  v_open time;
  v_close time;
  v_now time := v_local::time;
begin
  select h.open_time, h.close_time into v_open, v_close
    from public.shop_hours h
   where h.shop_id = p_shop_id
     and h.weekday = extract(dow from v_local)::smallint;

  if v_open is null then return true; end if;                       -- ยังไม่ได้ตั้งตาราง
  if v_open = time '00:00' and v_close in (time '23:59', time '00:00') then
    return true;                                                    -- เปิดตลอด 24 ชม.
  end if;
  if v_open <= v_close then
    return v_now >= v_open and v_now < v_close;
  end if;
  return v_now >= v_open or v_now < v_close;                        -- คร่อมเที่ยงคืน
end $$;

grant execute on function public.shop_is_open(uuid, timestamptz) to authenticated;

create or replace function public.enforce_shop_hours()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.shop_is_open(new.shop_id) then
    /* ส่งเวลาเปิด-ปิดของวันนี้กลับไปด้วย แอปจะได้บอกลูกค้าได้ว่ากลับมาตอนไหน
       ไม่ใช่แค่ "สั่งไม่ได้" เฉย ๆ */
    raise exception 'SHOP_CLOSED' using errcode = 'P0001',
      detail = coalesce((
        select json_build_object('open', to_char(h.open_time, 'HH24:MI'),
                                 'close', to_char(h.close_time, 'HH24:MI'))::text
          from public.shop_hours h
         where h.shop_id = new.shop_id
           and h.weekday = extract(dow from (now() at time zone 'Asia/Bangkok'))::smallint
      ), 'closed');
  end if;
  return new;
end $$;

/* ★ เฉพาะออเดอร์ของลูกค้า ★ การขายหน้าร้าน (pos_sales) ไม่เกี่ยว — เจ้าของขายเองนอกเวลา
   ได้เสมอ ปิดร้านแล้วเคลียร์ของหน้าเคาน์เตอร์เป็นเรื่องปกติ */
drop trigger if exists trg_enforce_shop_hours on public.orders;
create trigger trg_enforce_shop_hours
  before insert on public.orders
  for each row execute function public.enforce_shop_hours();

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_enforce_shop_hours') then
    raise exception 'ทริกเกอร์เวลาทำการหายไป';
  end if;
  raise notice '0108 พร้อม — นอกเวลาทำการไม่รับออเดอร์';
end $$;
