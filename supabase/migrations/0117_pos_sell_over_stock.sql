-- ขายได้แม้สต๊อกในระบบไม่พอ — แต่ต้องบอกให้รู้ทุกครั้ง
--
-- เจ้าของตัดสิน 20 ก.ย. 2569 หลังเจอปัญหาจริงสามข้อที่หน้าเคาน์เตอร์:
--   "ข้อความไม่บอกว่าตัวไหน · เจอตอนกดชำระเงินแล้ว · หน้าขายไม่กันตั้งแต่ตอนยิง"
--
-- ★ ของเดิมบล็อกแข็ง ★ create_pos_sale ยกเลิกทั้งบิลทันทีที่เจอของไม่พอแม้แถวเดียว
-- (raise OUT_OF_STOCK) แปลว่าถ้าตัวเลขในระบบไม่ตรงกับของจริงบนชั้น ลูกค้ายืนถือของอยู่
-- ตรงหน้าแต่ร้านขายไม่ได้ ต้องไปแก้สต๊อกก่อน — ซึ่งเกิดบ่อยมากในร้านชำ (ของแตก แจก
-- นับพลาด รับเข้าไม่ครบ)
--
-- ตอนนี้ขายได้ สต๊อกติดลบ แล้วติดลบนั่นแหละคือป้ายบอกว่า "ตัวนี้ต้องไปนับใหม่"
-- ซึ่งเป็นสัญญาณที่มีประโยชน์กว่าการห้ามขาย
--
-- ★ เปลี่ยนเฉพาะทางขายหน้าร้าน ★ ออเดอร์ในแอป (place_order) ยังบล็อกเหมือนเดิม เพราะ
-- ลูกค้าที่สั่งออนไลน์ไม่ได้ยืนอยู่หน้าชั้น การรับออเดอร์ของที่ไม่มีคือการรับปากลอย ๆ
--
-- ★ ไม่เงียบ ★ ฟังก์ชันคืนช่อง oversold กลับไปด้วย = รายการที่ขายเกินสต๊อก พร้อมจำนวน
-- ที่อยากได้กับที่มีจริง หน้าขายเอาไปเตือนแคชเชียร์ได้ทันทีหลังปิดบิล
--
-- ฐานของไฟล์นี้คือฟังก์ชันตัวที่ทำงานอยู่จริงบนโปรดักชัน (ดึงด้วย pg_get_functiondef
-- ไม่ได้ก๊อปจากไฟล์ไมเกรชันเก่า เพราะตัวเดียวกันถูกเขียนทับข้ามไฟล์มาแล้วหลายรอบ)

begin;

CREATE OR REPLACE FUNCTION public.create_pos_sale(p_client_op_id uuid, p_items jsonb, p_payment_method pos_pay_method_t, p_cash_tendered integer DEFAULT NULL::integer, p_discount integer DEFAULT 0, p_customer_user_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_tax_id text DEFAULT NULL::text, p_tax_invoice boolean DEFAULT false, p_payments jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_shop uuid := public.admin_shop();
  v_cashier uuid := auth.uid();
  v_ex public.pos_sales;
  v_subtotal int := 0; v_total int; v_vat int := 0; v_net int;
  v_reg boolean; v_rate numeric; v_incl boolean;
  v_saleno bigint; v_taxno bigint := null;
  v_sale uuid; v_change int := 0; v_bal int;
  v_split boolean := false; v_paysum int; v_method public.pos_pay_method_t := p_payment_method;
  rec record;
  v_short jsonb := '[]'::jsonb;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select * into v_ex from public.pos_sales where client_op_id = p_client_op_id;
  if v_ex.id is not null then
    -- H5: return the FULL receipt contract from the committed row, matching the
    -- normal-path return below. Read-only; no field is recomputed. (0060
    -- returned only id/sale_number/tax_invoice_no/total/vat_amount/change here,
    -- which crashed the receipt formatter on the missing fields.)
    return jsonb_build_object('id', v_ex.id, 'sale_number', v_ex.sale_number,
      'tax_invoice_no', v_ex.tax_invoice_no, 'subtotal', v_ex.subtotal,
      'discount', v_ex.discount, 'total', v_ex.total, 'vat_amount', v_ex.vat_amount,
      'net_amount', v_ex.net_amount, 'change', v_ex.change, 'replay', true, 'oversold', '[]'::jsonb,
      'is_split', v_ex.is_split);
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_SALE' using errcode = 'P0001';
  end if;

  create temp table _lines (variant_id uuid, product_name text, size text,
    unit_price int, unit_cost numeric(10,2), qty int, line_discount int, line_total int) on commit drop;
  for rec in
    select (i->>'variant_id')::uuid vid, (i->>'qty')::int qty, coalesce((i->>'line_discount')::int, 0) ld
    from jsonb_array_elements(p_items) i order by (i->>'variant_id')::uuid
  loop
    declare v_price int; v_cost numeric(10,2); v_stock int; v_name text; v_size text;
    begin
      select v.price, v.cost_price, v.stock_qty, p.name, v.size into v_price, v_cost, v_stock, v_name, v_size
      from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = rec.vid and p.shop_id = v_shop for update of v;
      if v_price is null then raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0002'; end if;
      -- ★ ของบนชั้นสำคัญกว่าตัวเลขในระบบ ★ (เจ้าของตัดสิน 20 ก.ย. 2569 เลือกทาง B)
      -- ของเดิมยกเลิกทั้งบิลทันทีที่เจอของไม่พอแม้แถวเดียว ซึ่งแปลว่าลูกค้ายืนถือของอยู่
      -- ตรงหน้าแต่ร้านขายไม่ได้ เพราะตัวเลขในระบบไม่ตรงกับของจริง (ของแตก แจก นับพลาด
      -- รับเข้าไม่ครบ — เรื่องปกติของร้านชำ) · ตอนนี้ขายได้ สต๊อกติดลบ แล้วติดลบนั่นแหละ
      -- คือป้ายบอกว่า "ตัวนี้ต้องไปนับใหม่" ซึ่งมีประโยชน์กว่าการห้ามขาย
      -- ★ ยังต้องบอกให้รู้ ★ ไม่ใช่ปล่อยเงียบ — ส่งรายการที่ไม่พอกลับไปให้หน้าขายเตือน
      -- และเก็บเป็นหลักฐานว่าบิลนี้ขายเกินสต๊อกไปเท่าไหร่
      if v_stock < rec.qty then
        v_short := v_short || jsonb_build_object(
          'name', v_name, 'size', v_size, 'want', rec.qty, 'have', greatest(v_stock, 0));
      end if;
      insert into _lines values (rec.vid, v_name, v_size, v_price, v_cost, rec.qty, rec.ld, v_price * rec.qty - rec.ld);
      v_subtotal := v_subtotal + (v_price * rec.qty - rec.ld);
    end;
  end loop;

  v_total := v_subtotal - greatest(coalesce(p_discount, 0), 0);
  if v_total < 0 then raise exception 'VALIDATION' using errcode = 'P0001', detail = 'discount exceeds subtotal'; end if;

  select vat_registered, vat_rate, price_includes_vat into v_reg, v_rate, v_incl
  from public.shop_settings where shop_id = v_shop;
  if coalesce(v_reg, false) and coalesce(v_incl, true) then
    v_vat := round(v_total * v_rate / (100 + v_rate));
  end if;
  v_net := v_total - v_vat;

  -- payment
  if p_payments is not null and jsonb_array_length(p_payments) >= 1 then
    -- split / multi-tender (cash + promptpay only)
    if exists (select 1 from jsonb_array_elements(p_payments) e
               where (e->>'method') not in ('cash', 'promptpay')) then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'split allows cash/promptpay only';
    end if;
    select coalesce(sum((e->>'amount')::int), 0) into v_paysum from jsonb_array_elements(p_payments) e;
    if v_paysum <> v_total then raise exception 'VALIDATION' using errcode = 'P0001', detail = 'payments must sum to total'; end if;
    v_split := jsonb_array_length(p_payments) > 1;
    select (e->>'method')::public.pos_pay_method_t into v_method from jsonb_array_elements(p_payments) e limit 1;
  elsif p_payment_method = 'cash'::public.pos_pay_method_t then
    if coalesce(p_cash_tendered, 0) < v_total then raise exception 'INSUFFICIENT_CASH' using errcode = 'P0001'; end if;
    v_change := p_cash_tendered - v_total;
  elsif p_payment_method = 'store_credit'::public.pos_pay_method_t then
    if p_customer_user_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode = 'P0001'; end if;
    select coalesce(sum(delta), 0) into v_bal from public.store_credit_ledger
     where user_id = p_customer_user_id and shop_id = v_shop;
    if v_bal < v_total then raise exception 'INSUFFICIENT_CREDIT' using errcode = 'P0001'; end if;
  end if;

  insert into public.pos_counters (shop_id, kind, value) values (v_shop, 'sale', 1)
  on conflict (shop_id, kind) do update set value = public.pos_counters.value + 1 returning value into v_saleno;
  if p_tax_invoice then
    insert into public.pos_counters (shop_id, kind, value) values (v_shop, 'tax_invoice', 1)
    on conflict (shop_id, kind) do update set value = public.pos_counters.value + 1 returning value into v_taxno;
  end if;

  insert into public.pos_sales (shop_id, cashier_user_id, shift_id, sale_number, tax_invoice_no,
    subtotal, discount, total, vat_amount, net_amount, payment_method, cash_tendered, change,
    customer_name, customer_tax_id, customer_user_id, client_op_id, is_split)
  values (v_shop, v_cashier, null, 'POS' || to_char(v_saleno, 'FM000000'),
    case when p_tax_invoice then to_char(v_taxno, 'FM00000000') else null end,
    v_subtotal, greatest(coalesce(p_discount, 0), 0), v_total, v_vat, v_net, v_method,
    case when not v_split and p_payment_method = 'cash'::public.pos_pay_method_t then p_cash_tendered end,
    case when not v_split and p_payment_method = 'cash'::public.pos_pay_method_t then v_change end,
    p_customer_name, p_customer_tax_id, p_customer_user_id, p_client_op_id, v_split)
  returning id into v_sale;

  insert into public.pos_sale_items (sale_id, variant_id, product_name, size, unit_price, unit_cost, qty, line_discount)
  select v_sale, variant_id, product_name, size, unit_price, unit_cost, qty, line_discount from _lines;

  -- record tender(s) — skip when there's nothing to record (฿0 = free sale);
  -- pos_sale_payments.amount has a `> 0` check, same rule the split branch
  -- above already applies per-leg.
  if p_payments is not null then
    insert into public.pos_sale_payments (sale_id, method, amount)
    select v_sale, (e->>'method')::public.pos_pay_method_t, (e->>'amount')::int
    from jsonb_array_elements(p_payments) e where (e->>'amount')::int > 0;
  elsif v_total > 0 then
    insert into public.pos_sale_payments (sale_id, method, amount) values (v_sale, v_method, v_total);
  end if;

  update public.product_variants v set stock_qty = stock_qty - l.qty from _lines l where v.id = l.variant_id;
  insert into public.stock_movements (variant_id, delta_stock, reason, actor_user_id)
  select variant_id, -qty, 'pos_sale'::public.stock_reason_t, v_cashier from _lines;

  if not v_split and p_payment_method = 'store_credit'::public.pos_pay_method_t then
    insert into public.store_credit_ledger (shop_id, user_id, delta, reason, sale_id)
    values (v_shop, p_customer_user_id, -v_total, 'pos_sale', v_sale);
  end if;

  return jsonb_build_object('id', v_sale, 'sale_number', 'POS' || to_char(v_saleno, 'FM000000'),
    'tax_invoice_no', case when p_tax_invoice then to_char(v_taxno, 'FM00000000') else null end,
    'subtotal', v_subtotal, 'discount', greatest(coalesce(p_discount, 0), 0), 'total', v_total,
    'vat_amount', v_vat, 'net_amount', v_net, 'change', v_change, 'replay', false, 'is_split', v_split,
    'oversold', v_short);
end $function$;

revoke execute on function public.create_pos_sale(uuid, jsonb, public.pos_pay_method_t, int, int, uuid, text, text, boolean, jsonb) from public;
grant execute on function public.create_pos_sale(uuid, jsonb, public.pos_pay_method_t, int, int, uuid, text, text, boolean, jsonb) to authenticated;

-- ═══ 2. ยกด่านที่ห้ามสต๊อกติดลบ ════════════════════════════════════════════════
-- ★ ถ้าไม่แก้ตรงนี้ ข้างบนไม่มีความหมายเลย ★ ตาราง product_variants มีด่านกันไว้ว่า
-- stock_qty ต้องไม่ติดลบ (ตั้งไว้ตั้งแต่ไฟล์ 0002) พอฟังก์ชันขายเลิกบล็อกแล้วเดินไป
-- ตัดสต๊อกจริง ด่านนี้จะเป็นตัวที่ยิงแทน แล้วบิลก็ล่มเหมือนเดิม ต่างกันแค่ข้อความที่
-- โผล่มาจะเป็นภาษาฐานข้อมูลดิบ ๆ ที่แคชเชียร์อ่านไม่รู้เรื่องยิ่งกว่าเดิม
--
-- ★ ไม่ได้ถอดทิ้งเฉย ๆ ★ ทางอื่นที่แตะสต๊อกมีด่านของตัวเองอยู่แล้ว ไม่ได้พึ่งด่านนี้:
--   · adjust_stock   → เช็คก่อนแล้ว raise INSUFFICIENT_STOCK
--   · place_order    → เช็คก่อนแล้ว raise OUT_OF_STOCK (ออเดอร์ในแอป ยังบล็อกอยู่)
--   · set_stock_qty  → เจ้าของพิมพ์ตัวเลขเอง ติดลบไม่ได้อยู่แล้ว
-- ที่เหลือคือทางขายหน้าร้าน ซึ่งตั้งใจให้ติดลบได้
--
-- ★ ยังเหลือเพดานไว้ ★ -100000 ไม่ใช่เลขที่การขายจริงจะแตะถึง (ขายเกินจริงเต็มที่
-- หลักสิบ) แต่ถ้าวันหลังมีโค้ดพลาดไปลบรัว ๆ ทั้งตาราง ด่านนี้จะหยุดไว้ก่อนที่ตัวเลข
-- ทั้งร้านจะเละจนกู้ไม่ได้ — ถอดทิ้งไปเลยคือไม่เหลืออะไรกันเลย
alter table public.product_variants drop constraint if exists product_variants_stock_qty_check;
alter table public.product_variants add constraint product_variants_stock_qty_check
  check (stock_qty >= -100000);

-- ═══ 3. เตือน "ของหมด" ต้องยังเตือนตอนติดลบด้วย ═══════════════════════════════
-- ★ กับดักที่จะเงียบหายไปเอง ★ ตัวส่ง LINE แจ้งของหมดเช็คว่า stock_qty = 0 เป๊ะ ๆ
-- ซึ่งใช้ได้ตอนที่ติดลบไม่ได้ แต่พอขายเกินได้แล้ว ของที่เหลือ 2 แล้วขายไป 5 จะกลาย
-- เป็น -3 ข้ามเลข 0 ไปเลย เงื่อนไขไม่เข้า เจ้าของก็จะไม่ได้รับแจ้งว่าของหมด
-- ทั้งที่ของหมดหนักกว่าเดิมด้วยซ้ำ — เปลี่ยนเป็น <= 0 และเขียนข้อความแยกกรณีติดลบ
-- ให้อ่านรู้เรื่อง ("ติดลบ 3 ชิ้น" ไม่ใช่ "เหลือ -3 ชิ้น")
CREATE OR REPLACE FUNCTION public.line_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name text;
  v_shop uuid;
  v_text text;
  v_url  text;
  v_key  text;
begin
  if new.stock_qty is not distinct from old.stock_qty then return new; end if;

  -- Restock resets the alert latches so the next dip alerts again.
  if new.stock_qty > new.low_stock_threshold then new.low_stock_alerted_at := null; end if;
  if new.stock_qty > 0 then new.out_of_stock_alerted_at := null; end if;

  if new.stock_qty <= 0 and old.stock_qty > 0
     and (old.out_of_stock_alerted_at is null
          or old.out_of_stock_alerted_at < now() - interval '6 hours') then
    v_text := case when new.stock_qty < 0 then 'สินค้าหมดสต๊อก (ขายเกินไปแล้ว)'
                   else 'สินค้าหมดสต๊อก' end;
    new.out_of_stock_alerted_at := now();
  elsif new.stock_qty > 0
     and new.stock_qty <= new.low_stock_threshold
     and old.stock_qty > old.low_stock_threshold
     and (old.low_stock_alerted_at is null
          or old.low_stock_alerted_at < now() - interval '6 hours') then
    v_text := 'สินค้าใกล้หมด';
    new.low_stock_alerted_at := now();
  else
    return new;
  end if;

  select p.name, p.shop_id into v_name, v_shop
  from public.products p where p.id = new.product_id;

  v_text := v_text || chr(10)
         || v_name || coalesce(' (' || new.size || ')', '')
         || case when new.stock_qty < 0
                 then ' ติดลบ ' || abs(new.stock_qty) || ' ชิ้น — ต้องไปนับใหม่'
                 else ' เหลือ ' || new.stock_qty || ' ชิ้น' end
         || case when new.stock_qty > 0
                 then ' (เกณฑ์เตือน ' || new.low_stock_threshold || ')'
                 else '' end
         || chr(10) || 'เติมสต๊อกได้ที่เมนู "สต๊อก" ในระบบหลังร้าน';

  v_url := coalesce(
    nullif(current_setting('app.functions_url', true), ''),
    'https://ejohcdbzvscgakpvgytj.supabase.co/functions/v1'
  );
  v_key := coalesce(
    nullif(current_setting('app.service_role_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqb2hjZGJ6dnNjZ2FrcHZneXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDI1MzEsImV4cCI6MjA5ODkxODUzMX0.nhkPBFuYXnkLm-caHP9uNoss3E1_FyqRnwtfudPh2CQ'
  );
  begin
    perform net.http_post(
      url := v_url || '/send-line',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('owner_text', v_text, 'shop_id', v_shop)
    );
  exception when others then
    null; -- alerting must never break the stock write
  end;

  return new;
end $function$;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $verify$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_pos_sale';

  if v_src is null then
    raise exception 'create_pos_sale หายไป';
  end if;
  if v_src like '%OUT_OF_STOCK%' then
    raise exception 'ยังมีด่านบล็อกของไม่พออยู่ — ไม่ได้ถูกแทนที่';
  end if;
  if v_src not like '%oversold%' then
    raise exception 'ไม่ได้คืนช่อง oversold กลับไป';
  end if;

  -- ★ ออเดอร์ในแอปต้องยังบล็อกอยู่ ★ ถ้าเผลอไปแก้ place_order ด้วยจะกลายเป็นรับออเดอร์
  -- ของที่ไม่มีในร้าน ซึ่งไม่ใช่สิ่งที่เจ้าของสั่ง
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'place_order';
  if v_src is not null and v_src not like '%OUT_OF_STOCK%' then
    raise exception 'place_order ต้องยังบล็อกของไม่พออยู่';
  end if;

  -- ★ ด่านของตาราง ★ ถ้ายังเป็น >= 0 อยู่ บิลจะล่มตอนตัดสต๊อก ทั้งที่ฟังก์ชันปล่อยผ่านแล้ว
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.product_variants'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%stock_qty >= 0%'
  ) then
    raise exception 'ด่านห้ามสต๊อกติดลบยังอยู่ — ขายเกินแล้วบิลจะล่มตอนตัดสต๊อก';
  end if;

  -- ★ เตือนของหมด ★ ต้องจับตอนข้ามเลข 0 ลงไปติดลบได้ด้วย ไม่ใช่เฉพาะที่ 0 เป๊ะ
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'line_stock_alert';
  if v_src is null or v_src not like '%new.stock_qty <= 0 and old.stock_qty > 0%' then
    raise exception 'ตัวเตือนของหมดยังจับแค่ 0 เป๊ะ — ของที่ขายข้ามไปติดลบจะไม่เตือน';
  end if;

  raise notice '0117 พร้อม — ขายหน้าร้านได้แม้สต๊อกไม่พอ และบอกรายการที่เกินกลับมา';
end $verify$;
