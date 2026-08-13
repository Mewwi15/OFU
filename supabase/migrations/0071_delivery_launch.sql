-- 0071_delivery_launch.sql
-- อู้ฟู่ (Oofoo) — ของที่ต้องมีก่อนเปิดโหมดเดลิเวอรี่ให้ลูกค้าจริง
--
--   1. get_fulfilment_fees() — ให้แอปอ่านค่าส่งจากเซิร์ฟเวอร์ เลิกฝังเลขในโค้ด
--   2. เหตุผลยกเลิกใหม่ 'out_of_area' — ไกลเกินไปจนส่งไม่ไหว
--   3. บันทึกการเก็บเงินปลายทาง (COD) + รวมเข้ารายงานเงินสด
--
-- ไม่มี begin/commit ทั้งไฟล์: `alter type ... add value` ใช้ค่าที่เพิ่งเพิ่ม
-- ใน transaction เดียวกันไม่ได้ ปล่อยให้ runner autocommit ทีละคำสั่งแทน

-- ═══ 1. ค่าส่ง — ให้แอปอ่านได้ ═══════════════════════════════════════════════
-- RLS ปิด shop_settings ไว้ทั้งตาราง (มี VAT/tax id/เลขใบเสร็จ) แอปลูกค้าจึง
-- อ่านไม่ได้เลย ผลคือ store/mode.ts ฝังเลข 40/200/150 ไว้ในโค้ด แล้วโชว์เลขนั้น
-- ตอนลูกค้ากำลังตัดสินใจ ทั้งที่ place_order คิดจากค่าจริงในตาราง — พอเจ้าของ
-- แก้ค่าส่ง หน้าจอกับเงินที่เก็บจะไม่ตรงกันทันที (บั๊ก M1 ใน bug audit)
--
-- ฟังก์ชันนี้เปิดเฉพาะ "ตัวเลขที่ลูกค้าเห็นตอนเช็คเอาต์อยู่แล้ว" ไม่แตะฟิลด์อื่น
create or replace function public.get_fulfilment_fees()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'delivery_fee',          coalesce(s.delivery_fee, 40),
    'free_delivery_min',     coalesce(s.free_delivery_threshold, 200),
    'online_fee',            coalesce(s.online_fee, 150),
    'online_free_min',       s.online_free_threshold,   -- null = ไม่มีส่งฟรี
    'cod_enabled',           coalesce(s.cod_enabled, true),
    'cod_cap',               s.cod_cap
  )
  from public.shop_settings s
  limit 1;
$$;

grant execute on function public.get_fulfilment_fees() to anon, authenticated;

comment on function public.get_fulfilment_fees() is
  'ค่าส่ง/ยอดส่งฟรี/เงื่อนไข COD สำหรับแสดงในแอป — เปิดอ่านได้ทุกคน เพราะเป็น
   ตัวเลขที่ลูกค้าเห็นตอนเช็คเอาต์อยู่แล้ว · ยอดที่เก็บจริงยังมาจาก place_order';

-- ═══ 2. เหตุผลยกเลิก: อยู่นอกพื้นที่จัดส่ง ═══════════════════════════════════
-- ร้านไม่จำกัดระยะตอนสั่ง (เจ้าของตัดสินใจ) — กันด้วยการยกเลิกทีหลังแทน
-- ลูกค้าต้องได้รู้เหตุผล ไม่ใช่เห็นแค่ "ยกเลิก" ลอย ๆ หลังจากรออยู่
alter type public.cancel_reason_t add value if not exists 'out_of_area';

-- ═══ 3. เก็บเงินปลายทาง ══════════════════════════════════════════════════════
alter table public.orders
  add column if not exists cod_collected_at timestamptz,
  add column if not exists cod_collected_by uuid references public.app_users(id),
  add column if not exists cod_amount int;

comment on column public.orders.cod_collected_at is
  'เวลาที่ไรเดอร์รับเงินสดปลายทาง · null = ยังไม่เก็บ';

-- ทำเครื่องหมายว่ารับเงินสดแล้ว
--
-- ไม่สร้างบิล pos_sales ปลอม: ออเดอร์นี้ตัดสต็อกไปแล้วตอนลูกค้าสั่ง และบิล POS
-- กินเลขใบเสร็จ/ใบกำกับภาษีของจริง — บันทึกบนตัวออเดอร์แล้วให้รายงานรวมให้
-- ตอนอ่าน สะอาดกว่าและย้อนดูได้ว่าเงินก้อนไหนมาจากเดลิเวอรี่
create or replace function public.mark_cod_collected(
  p_order_id uuid,
  p_amount   int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_o public.orders;
begin
  select * into v_o from public.orders
  where id = p_order_id and shop_id = v_shop for update;
  if v_o.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'order';
  end if;
  if v_o.payment_method <> 'cod'::public.payment_method_t then
    raise exception 'NOT_COD' using errcode = 'P0001';
  end if;

  -- กดซ้ำไม่เปลี่ยนอะไร (ปุ่มเดียวกันอาจถูกกดสองครั้งตอนสัญญาณไม่ดี)
  if v_o.cod_collected_at is not null then
    return jsonb_build_object('order_id', p_order_id,
      'collected_at', v_o.cod_collected_at, 'amount', v_o.cod_amount, 'first', false);
  end if;

  update public.orders
     set cod_collected_at = now(),
         cod_collected_by = auth.uid(),
         cod_amount       = coalesce(p_amount, total),
         payment_status   = 'paid'::public.payment_status_t
   where id = p_order_id
  returning * into v_o;

  update public.payments
     set status = 'paid'::public.payment_status_t, paid_at = now(), funds_received = true
   where order_id = p_order_id;

  perform public.write_audit(v_shop, 'mark_cod_collected', 'orders', p_order_id::text,
    'รับเงินสด ' || v_o.cod_amount || ' บาท · ' || v_o.order_number);

  return jsonb_build_object('order_id', p_order_id,
    'collected_at', v_o.cod_collected_at, 'amount', v_o.cod_amount, 'first', true);
end $$;

revoke execute on function public.mark_cod_collected(uuid, int) from public;
grant execute on function public.mark_cod_collected(uuid, int) to authenticated;

-- ═══ 4. รายงาน: เงินสดก้อนเดียว ══════════════════════════════════════════════
-- เจ้าของเป็นทั้งคนขายหน้าร้านและคนส่งของ เงินอยู่กระเป๋าเดียวกัน — ปิดยอด
-- สิ้นวันจึงต้องเห็นก้อนเดียว `onsite.cash` รวม COD เข้าไปด้วย และแยก
-- `cod_cash` ไว้ให้ดูว่ามาจากเดลิเวอรี่เท่าไหร่
create or replace function public.pos_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_out jsonb; v_cod bigint;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select coalesce(sum(cod_amount), 0) into v_cod
  from public.orders
  where shop_id = v_shop
    and cod_collected_at >= p_from and cod_collected_at < p_to;

  select jsonb_build_object(
    'onsite', (
      select jsonb_build_object(
        'count',        count(*) filter (where status = 'completed'::public.pos_sale_status_t),
        'gross',        coalesce(sum(total)      filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'vat',          coalesce(sum(vat_amount) filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'net',          coalesce(sum(net_amount) filter (where status = 'completed'::public.pos_sale_status_t), 0),
        'discount',     coalesce(sum(discount)   filter (where status = 'completed'::public.pos_sale_status_t), 0),
        -- เงินสดในกระเป๋า = ขายหน้าร้าน + เก็บปลายทาง
        'cash',         coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'cash'::public.pos_pay_method_t), 0) + v_cod,
        'cod_cash',     v_cod,
        'promptpay',    coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'promptpay'::public.pos_pay_method_t), 0),
        'store_credit', coalesce(sum(total) filter (where status = 'completed'::public.pos_sale_status_t and payment_method = 'store_credit'::public.pos_pay_method_t), 0),
        'refunds',      coalesce(sum(total) filter (where status = 'refunded'::public.pos_sale_status_t), 0)
      )
      from public.pos_sales
      where shop_id = v_shop and created_at >= p_from and created_at < p_to
    ),
    'online', (
      select jsonb_build_object(
        'count', count(*) filter (where payment_status = 'paid'::public.payment_status_t),
        'gross', coalesce(sum(total) filter (where payment_status = 'paid'::public.payment_status_t), 0)
      )
      from public.orders
      where shop_id = v_shop and placed_at >= p_from and placed_at < p_to
    ),
    'top', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select i.product_name as name, sum(i.qty) as qty, sum(i.line_total) as amount
        from public.pos_sale_items i
        join public.pos_sales s on s.id = i.sale_id
        where s.shop_id = v_shop
          and s.status = 'completed'::public.pos_sale_status_t
          and s.created_at >= p_from and s.created_at < p_to
        group by i.product_name
        order by sum(i.qty) desc
        limit 5
      ) t
    )
  ) into v_out;

  return v_out;
end $$;

revoke execute on function public.pos_dashboard(timestamptz, timestamptz) from public;
grant execute on function public.pos_dashboard(timestamptz, timestamptz) to authenticated;

-- ═══ ตรวจ ════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.get_fulfilment_fees()') is null then
    raise exception 'get_fulfilment_fees หายไป';
  end if;
  if to_regprocedure('public.mark_cod_collected(uuid,int)') is null then
    raise exception 'mark_cod_collected หายไป';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='orders'
                   and column_name='cod_collected_at') then
    raise exception 'คอลัมน์ cod_collected_at หายไป';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'cancel_reason_t' and e.enumlabel = 'out_of_area') then
    raise exception 'เหตุผล out_of_area หายไป';
  end if;
  raise notice '0071 ติดตั้งครบ — ค่าส่ง/เหตุผลยกเลิก/COD พร้อมใช้';
end $$;
