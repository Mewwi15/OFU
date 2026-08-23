-- 0074_goods_receipts.sql
-- อู้ฟู่ (Oofoo) — ใบรับเข้าสินค้า (ทาง ก: ย้ายการรับของจาก ETS POS มาอยู่ที่นี่)
--
-- เจ้าของตัดสินใจ 23 ส.ค.: OFU เป็นระบบเดียวที่แตะสต๊อก — ETS เก็บไว้ดูย้อนหลัง
-- สิ่งที่ ETS มีแล้ว OFU ขาดคือ "ใบรับเข้า" ที่ผูกผู้ขาย + เลขเอกสาร + หลายรายการ
-- ต่อใบ (ปุ่มเติมเดิมรับได้ทีละรายการ ไม่มีหัวเอกสาร)
--
-- โครง: หัวใบ (goods_receipts) + บรรทัด = stock_movements เดิมที่เพิ่มคอลัมน์
-- receipt_id/unit_cost — ไม่สร้างตารางบรรทัดใหม่ เพราะ movement คือบรรทัดรับของ
-- อยู่แล้วโดยธรรมชาติ สมุดสต๊อกเล่มเดียวเล่าได้ทั้งเรื่อง
--
-- เลขใบ: IN + YYMMDD + '-' + เลขวิ่งจาก sequence (race-free — บทเรียนจาก 0057:
-- นับ max()+1 ชนกันได้ ต้องใช้ sequence จริง) เช่น IN260823-001

begin;

-- ── 1. หัวใบรับเข้า ──────────────────────────────────────────────────────────
create sequence if not exists goods_receipt_seq;

create table if not exists public.goods_receipts (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id),
  receipt_number text not null unique,
  supplier       text,                          -- ชื่อผู้ขาย (พิมพ์อิสระ เหมือน ETS)
  doc_number     text,                          -- เลขที่เอกสารจากบิลผู้ขาย
  note           text,
  total_cost     numeric not null default 0,    -- รวมทุน เฉพาะบรรทัดที่กรอกทุน
  line_count     int not null default 0,
  created_by     uuid references public.app_users(id),
  created_at     timestamptz not null default now()
);

comment on table public.goods_receipts is
  'ใบรับเข้าสินค้า — หัวเอกสาร; บรรทัดคือ stock_movements ที่ receipt_id ชี้มาที่นี่';

-- แอดมินของร้านอ่านได้ตรง ๆ (ใช้ list ในหน้า POS) · เขียนผ่าน RPC เท่านั้น
alter table public.goods_receipts enable row level security;
drop policy if exists goods_receipts_admin_read on public.goods_receipts;
create policy goods_receipts_admin_read on public.goods_receipts
  for select to authenticated
  using (shop_id = public.admin_shop_safe());
grant select on public.goods_receipts to authenticated;
-- Supabase แจกสิทธิ์ตารางใหม่ให้ anon/authenticated อัตโนมัติ (default privileges)
-- — ถอนทิ้งชัด ๆ: anon ห้ามเห็น (ผู้ขาย/ทุนเป็นข้อมูลภายใน) และ authenticated
-- เขียนตรงไม่ได้ ต้องผ่าน RPC เท่านั้น · เช็คท้ายไฟล์คือตัวจับตอนลืมบรรทัดพวกนี้
revoke all on public.goods_receipts from anon;
revoke insert, update, delete on public.goods_receipts from authenticated;
revoke all on sequence public.goods_receipt_seq from anon, authenticated;

-- ── 2. บรรทัด = stock_movements เดิม + ที่ผูกใบ + ทุนต่อหน่วย ────────────────
alter table public.stock_movements
  add column if not exists receipt_id uuid references public.goods_receipts(id),
  add column if not exists unit_cost numeric;

create index if not exists stock_movements_receipt_ix on public.stock_movements (receipt_id);

-- ── 3. RPC: สร้างใบรับเข้า (atomic ทั้งใบ) ───────────────────────────────────
-- p_items: [{variant_id, qty, unit_cost?}] · unit_cost ที่กรอก = อัปเดตทุนล่าสุด
-- ของ variant ด้วย (ธรรมเนียมเดียวกับ ETS: รับของ = รู้ทุนใหม่)
create or replace function public.create_goods_receipt(
  p_supplier   text,
  p_doc_number text,
  p_note       text,
  p_items      jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id uuid; v_no text;
  v_item jsonb; v_variant uuid; v_qty int; v_cost numeric;
  v_total numeric := 0; v_lines int := 0; v_new int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'no_items';
  end if;

  v_no := 'IN' || to_char(now() at time zone 'Asia/Bangkok', 'YYMMDD')
       || '-' || lpad(nextval('public.goods_receipt_seq')::text, 3, '0');

  insert into public.goods_receipts (shop_id, receipt_number, supplier, doc_number, note, created_by)
  values (v_shop, v_no, nullif(btrim(p_supplier), ''), nullif(btrim(p_doc_number), ''),
          nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_item->>'variant_id')::uuid;
    v_qty     := (v_item->>'qty')::int;
    v_cost    := nullif(v_item->>'unit_cost', '')::numeric;

    if v_qty is null or v_qty <= 0 or v_qty > 100000 then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'qty 1..100000';
    end if;
    if v_cost is not null and (v_cost < 0 or v_cost > 1000000) then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'unit_cost';
    end if;

    update public.product_variants pv
       set stock_qty  = pv.stock_qty + v_qty,
           cost_price = coalesce(v_cost, pv.cost_price)
      from public.products p
     where pv.id = v_variant and p.id = pv.product_id and p.shop_id = v_shop
    returning pv.stock_qty into v_new;
    if v_new is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = v_variant::text;
    end if;

    insert into public.stock_movements
      (variant_id, delta_stock, delta_reserved, reason, actor_user_id, receipt_id, unit_cost)
    values
      (v_variant, v_qty, 0, 'receive'::public.stock_reason_t, auth.uid(), v_id, v_cost);

    v_total := v_total + coalesce(v_cost, 0) * v_qty;
    v_lines := v_lines + 1;
  end loop;

  update public.goods_receipts
     set total_cost = v_total, line_count = v_lines
   where id = v_id;

  perform public.write_audit(v_shop, 'goods_receipt', 'goods_receipts', v_no,
    coalesce(nullif(btrim(p_supplier), ''), '-') || ' · ' || v_lines || ' รายการ · ทุนรวม ' || v_total);

  return jsonb_build_object('id', v_id, 'receipt_number', v_no,
                            'total_cost', v_total, 'line_count', v_lines);
end $$;

revoke execute on function public.create_goods_receipt(text, text, text, jsonb) from public;
grant execute on function public.create_goods_receipt(text, text, text, jsonb) to authenticated;

-- ── 4. RPC: อ่านบรรทัดของใบ (โชว์ตอนกดขยายในหน้า list) ──────────────────────
create or replace function public.get_goods_receipt_lines(p_receipt_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_name', p.name,
           'size', v.size,
           'barcode', v.barcode,
           'qty', m.delta_stock,
           'unit_cost', m.unit_cost
         ) order by m.created_at), '[]'::jsonb)
  from public.stock_movements m
  join public.product_variants v on v.id = m.variant_id
  join public.products p on p.id = v.product_id
  join public.goods_receipts r on r.id = m.receipt_id
  where m.receipt_id = p_receipt_id
    and r.shop_id = public.admin_shop_safe();
$$;

revoke execute on function public.get_goods_receipt_lines(uuid) from public;
grant execute on function public.get_goods_receipt_lines(uuid) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ (กฎเหล็กตั้งแต่ 0069b: migration สิทธิ์ต้องพิสูจน์ตัวเอง) ═══
do $$
begin
  if to_regclass('public.goods_receipts') is null then
    raise exception 'ตาราง goods_receipts หายไป';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='stock_movements'
                   and column_name='receipt_id') then
    raise exception 'stock_movements.receipt_id หายไป';
  end if;
  if to_regprocedure('public.create_goods_receipt(text,text,text,jsonb)') is null then
    raise exception 'create_goods_receipt หายไป';
  end if;
  if to_regprocedure('public.get_goods_receipt_lines(uuid)') is null then
    raise exception 'get_goods_receipt_lines หายไป';
  end if;
  -- anon ต้องอ่านใบรับเข้าไม่ได้ (ผู้ขาย/ทุนเป็นข้อมูลภายใน)
  if exists (select 1 from information_schema.role_table_grants
             where table_schema='public' and table_name='goods_receipts'
               and grantee='anon') then
    raise exception 'goods_receipts รั่วถึง anon';
  end if;
  raise notice '0074 พร้อม — หน้ารับของเข้าใน POS ใช้ได้ทันทีที่ deploy';
end $$;
