-- พิสูจน์ 0108 — นอกเวลาทำการไม่รับออเดอร์
--
-- รัน (เครื่องตัวเองเท่านั้น — rollback ทิ้งตอนจบ):
--   docker exec -i supabase_db_my-rn-app psql -U postgres -v ON_ERROR_STOP=1 \
--     < scripts/test-0108-shop-hours.sql

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_shop uuid;
  v_dow smallint := extract(dow from (now() at time zone 'Asia/Bangkok'))::smallint;
  v_now time := (now() at time zone 'Asia/Bangkok')::time;
  v_ok boolean;
begin
  select id into v_shop from public.shops limit 1;

  -- เก็บตารางเดิมไว้ก่อน แล้วค่อยคืนตอนจบ (ทั้งบล็อกอยู่ใน transaction ที่ rollback อยู่แล้ว)
  delete from public.shop_hours where shop_id = v_shop and weekday = v_dow;

  -- ── ก. ไม่ได้ตั้งตาราง = เปิด ──────────────────────────────────────────────
  v_ok := public.shop_is_open(v_shop);
  if not v_ok then raise exception 'ก: ร้านที่ยังไม่ได้ตั้งตารางต้องถือว่าเปิด'; end if;

  -- ── ข. เปิดตลอด 24 ชม. ───────────────────────────────────────────────────
  insert into public.shop_hours (shop_id, weekday, open_time, close_time)
  values (v_shop, v_dow, time '00:00', time '23:59');
  if not public.shop_is_open(v_shop) then raise exception 'ข: 00:00–23:59 ต้องเปิดตลอด'; end if;

  -- ── ค. ช่วงที่ครอบเวลาปัจจุบัน = เปิด ─────────────────────────────────────
  update public.shop_hours
     set open_time = greatest(time '00:00', v_now - interval '1 hour'),
         close_time = least(time '23:59', v_now + interval '1 hour')
   where shop_id = v_shop and weekday = v_dow;
  if not public.shop_is_open(v_shop) then raise exception 'ค: เวลานี้อยู่ในช่วงเปิด ต้องเปิด'; end if;

  -- ── ง. ช่วงที่ไม่ครอบเวลาปัจจุบัน = ปิด + ออเดอร์ต้องถูกปฏิเสธ ─────────────
  /* เลือกช่วงสั้น ๆ ที่อยู่คนละฝั่งกับเวลาปัจจุบันแน่ ๆ ไม่ว่าตอนรันจะกี่โมง */
  update public.shop_hours
     set open_time  = case when v_now < time '12:00' then time '22:00' else time '01:00' end,
         close_time = case when v_now < time '12:00' then time '23:00' else time '02:00' end
   where shop_id = v_shop and weekday = v_dow;
  if public.shop_is_open(v_shop) then raise exception 'ง: เวลานี้อยู่นอกช่วง ต้องปิด'; end if;

  begin
    /* แถวออเดอร์ขั้นต่ำที่ผ่านคอลัมน์บังคับทั้งหมด — ทริกเกอร์เวลาทำการทำงานก่อนอย่างอื่น
       อยู่แล้ว ถ้ามันไม่ยิง แถวนี้จะเข้าไปได้จริงซึ่งคือสิ่งที่เราต้องการจับ */
    insert into public.orders (shop_id, customer_user_id, order_number, shop_mode,
                               payment_method, subtotal, total)
    values (v_shop, (select id from public.app_users limit 1), 'TEST-HOURS-1',
            'delivery', 'cod', 100, 100);
    raise exception 'ง: ออเดอร์นอกเวลาทำการต้องถูกปฏิเสธ แต่บันทึกผ่าน';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%SHOP_CLOSED%' then
      raise exception 'ง: ถูกปฏิเสธด้วยเหตุผลอื่น: %', sqlerrm;
    end if;
  end;

  -- ── จ. ขายหน้าร้านไม่โดนกติกานี้ ─────────────────────────────────────────
  /* เจ้าของเคลียร์ของหน้าเคาน์เตอร์หลังปิดร้านเป็นเรื่องปกติ — ทริกเกอร์ต้องไม่ไปแตะ
     ตรวจแค่ว่าไม่มีทริกเกอร์เวลาทำการเกาะอยู่บนตารางการขายหน้าร้าน */
  if exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'pos_sales' and t.tgname = 'trg_enforce_shop_hours'
  ) then
    raise exception 'จ: การขายหน้าร้านไม่ควรติดกติกาเวลาทำการ';
  end if;

  raise notice 'ผ่านทั้งหมด — เปิด/ปิด/ปฏิเสธออเดอร์นอกเวลา/ไม่แตะการขายหน้าร้าน';
end $$;

rollback;
