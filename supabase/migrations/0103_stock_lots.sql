-- ต้นทุนแบบล็อต (FIFO) ขั้นที่ 1 — เก็บล็อต + บันทึกทุนที่ถูกตัดไปทุกครั้งที่สต๊อกลด
--
-- เจ้าของอธิบายเอง 5 ก.ย. 2026: "สต๊อกเก่าราคาเดิมและยังมีของอยู่ก็คือของทุนนั้น เหมือน
-- แม็กกาซีน พอเพิ่มของใหม่ที่ทุนใหม่ก็ต้องรอของเก่าหมดก่อน และวนไป" — ถูกต้องทุกประการ
-- และปัญหาที่จับได้ก็มีจริง: รับเข้าทีไร cost_price ถูกทับทั้งตัว ของเก่าที่ค้างอยู่เลยถูก
-- เปลี่ยนทุนย้อนหลังไปด้วย กำไรของบิลที่ขายไปแล้วก็เพี้ยนตาม
--
-- ★ ขั้นนี้ยังไม่เปลี่ยนวิธีคิดกำไรที่ไหนเลย ★ แค่เริ่มเก็บข้อมูลให้ถูกต้อง รายงานทุกตัว
-- ยังอ่านค่าเดิมเหมือนเดิมทุกประการ — เปลี่ยนพร้อมกันทั้งหมดในครั้งเดียวคือการเดิมพันกับ
-- ระบบที่ร้านใช้ขายจริงทุกวัน
--
-- ★ ทำที่ stock_movements ที่เดียว ไม่ไล่แก้ RPC ขายทีละตัว ★ ทุกการขยับสต๊อกในระบบนี้
-- เขียนลงสมุดสต๊อกเสมอ (ขาย POS / ออเดอร์ในแอป / ยกเลิก / คืนของ / ปรับยอด) — ดักที่
-- สมุดจึงครอบคลุมทุกทางโดยไม่ต้องแตะโค้ดขายซึ่งเป็นจุดที่พังแล้วร้านขายไม่ได้

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- ล็อตต้นทุน — หนึ่งแถวต่อของหนึ่งชุดที่เข้ามาด้วยทุนเดียวกัน
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.stock_lots (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references public.product_variants(id) on delete cascade,
  unit_cost     numeric not null default 0,
  qty_in        int not null check (qty_in > 0),
  -- เหลือกี่ชิ้นในล็อตนี้ ตัดลงเรื่อย ๆ ตามการขาย
  qty_left      int not null check (qty_left >= 0),
  /* ล็อตมาจากการขยับสต๊อกแถวไหน — null ได้เฉพาะล็อตตั้งต้นที่สร้างตอนย้ายระบบ */
  movement_id   uuid references public.stock_movements(id) on delete set null,
  received_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
/* ตัดของเก่าก่อนเสมอ — เรียงตามวันรับเข้า ไม่ใช่วันที่สร้างแถว เพราะใบรับเข้าลงวันที่
   ย้อนหลังได้ (0078) ของที่รับย้อนหลังต้องไปอยู่หน้าคิวตามวันจริง ไม่ใช่ท้ายคิว */
create index if not exists stock_lots_fifo_ix
  on public.stock_lots (variant_id, received_at, created_at) where qty_left > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- ตัดจากล็อตไหนไปเท่าไหร่ — นี่คือ "ทุนของบรรทัดที่ขาย" ที่ระบบไม่เคยมี
--
-- ★ ทำไมไม่เพิ่มคอลัมน์ทุนใน pos_sale_items ★ การขายมีสองทาง (POS กับออเดอร์ในแอป)
-- คนละตารางกัน ถ้าเพิ่มคอลัมน์ต้องทำสองที่และรายงานต้องรวมสองแหล่ง — แต่ทั้งสองทาง
-- เขียนลงสมุดสต๊อกเหมือนกัน ผูกกับ movement จึงครอบคลุมทั้งคู่ด้วยที่เก็บชุดเดียว
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.stock_lot_uses (
  id          uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.stock_movements(id) on delete cascade,
  lot_id      uuid references public.stock_lots(id) on delete set null,
  variant_id  uuid not null references public.product_variants(id) on delete cascade,
  qty         int not null check (qty > 0),
  unit_cost   numeric not null,
  created_at  timestamptz not null default now()
);
create index if not exists stock_lot_uses_movement_ix on public.stock_lot_uses (movement_id);
create index if not exists stock_lot_uses_variant_ix on public.stock_lot_uses (variant_id, created_at desc);

alter table public.stock_lots enable row level security;
alter table public.stock_lot_uses enable row level security;
/* ต้นทุนเป็นความลับทางการค้า — ลูกค้าห้ามเห็น เปิดเฉพาะแอดมิน (แบบเดียวกับที่ซ่อน
   cost_price จาก anon ไปแล้วใน 0069c) */
create policy stock_lots_admin on public.stock_lots for select
  using (public.app_role() = 'admin');
create policy stock_lot_uses_admin on public.stock_lot_uses for select
  using (public.app_role() = 'admin');
grant select on public.stock_lots, public.stock_lot_uses to authenticated;
grant select, insert, update, delete on public.stock_lots, public.stock_lot_uses to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ทริกเกอร์: สมุดสต๊อกขยับ → ล็อตขยับตาม
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_stock_lot_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_need int;
  v_take int;
  v_cost numeric;
  rec record;
begin
  if new.delta_stock is null or new.delta_stock = 0 then
    return new;
  end if;

  -- ── ของเข้า → ล็อตใหม่ ────────────────────────────────────────────────────
  if new.delta_stock > 0 then
    /* ทุนของล็อต: เอาจากใบรับเข้าก่อน (unit_cost ที่กรอกตามบิล) ถ้าไม่มี — เช่นของที่
       คืนกลับมาหรือปรับยอดเพิ่ม — ใช้ทุนล่าสุดของสินค้าแทน ไม่ใช่ 0 เพราะล็อตทุน 0
       จะทำให้กำไรที่คำนวณทีหลังพองผิดปกติโดยไม่มีใครสังเกต */
    select coalesce(new.unit_cost, v.cost_price, 0) into v_cost
      from public.product_variants v where v.id = new.variant_id;

    insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
    values (new.variant_id, coalesce(v_cost, 0), new.delta_stock, new.delta_stock, new.id,
            coalesce(new.created_at, now()));
    return new;
  end if;

  -- ── ของออก → ตัดล็อตเก่าก่อน ─────────────────────────────────────────────
  v_need := -new.delta_stock;

  for rec in
    select id, qty_left, unit_cost
      from public.stock_lots
     where variant_id = new.variant_id and qty_left > 0
     order by received_at, created_at
     /* ล็อกไว้กันสองบิลตัดล็อตเดียวกันพร้อมกันแล้วเหลือติดลบ — ขายหน้าร้านกับสั่งในแอป
        เกิดพร้อมกันได้จริงทุกวัน */
     for update
  loop
    exit when v_need <= 0;
    v_take := least(v_need, rec.qty_left);
    update public.stock_lots set qty_left = qty_left - v_take where id = rec.id;
    insert into public.stock_lot_uses (movement_id, lot_id, variant_id, qty, unit_cost)
    values (new.id, rec.id, new.variant_id, v_take, rec.unit_cost);
    v_need := v_need - v_take;
  end loop;

  /* ★ ล็อตไม่พอต้องไม่ทำให้ขายไม่ได้ ★ สต๊อกนับผิด/ปรับยอดมือ ทำให้ของออกมากกว่าล็อตที่มี
     ได้จริง — บันทึกส่วนที่เกินด้วยทุนล่าสุดแล้วปล่อยผ่าน ดีกว่าปฏิเสธการขายที่หน้าร้าน
     มีลูกค้ายืนรออยู่ ส่วนที่ไม่มีล็อตรองรับดูย้อนหลังได้จาก lot_id ที่เป็นค่าว่าง */
  if v_need > 0 then
    select coalesce(v.cost_price, 0) into v_cost
      from public.product_variants v where v.id = new.variant_id;
    insert into public.stock_lot_uses (movement_id, lot_id, variant_id, qty, unit_cost)
    values (new.id, null, new.variant_id, v_need, coalesce(v_cost, 0));
  end if;

  return new;
end $$;

drop trigger if exists apply_stock_lot_movement_t on public.stock_movements;
create trigger apply_stock_lot_movement_t
  after insert on public.stock_movements
  for each row execute function public.apply_stock_lot_movement();

-- ─────────────────────────────────────────────────────────────────────────────
-- ล็อตตั้งต้นของสต๊อกที่มีอยู่ตอนนี้
--
-- ★ ทำครั้งเดียว ★ ของที่ค้างอยู่ตอนนี้ไม่มีประวัติว่ามาด้วยทุนเท่าไหร่ทีละล็อต — ทางเดียว
-- ที่ทำได้คือตั้งเป็นล็อตเดียวด้วยทุนล่าสุดที่รู้ ล็อตนี้จะถูกตัดออกก่อนเพื่อนตามคิว FIFO
-- แล้วหลังจากนั้นทุกล็อตจะมีที่มาจริงจากใบรับเข้า
-- ไม่ผ่าน stock_movements เพราะไม่ได้เป็นการขยับสต๊อกจริง แค่ตั้งต้นบัญชีล็อต
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.stock_lots (variant_id, unit_cost, qty_in, qty_left, movement_id, received_at)
select v.id, coalesce(v.cost_price, 0), v.stock_qty, v.stock_qty, null,
       -- ย้อนหลังไปไกล ๆ ให้แน่ใจว่าอยู่หน้าคิวเสมอ ของที่มีอยู่แล้วต้องออกก่อนของที่รับใหม่
       timestamptz '2000-01-01'
  from public.product_variants v
 where v.stock_qty > 0
   and not exists (select 1 from public.stock_lots l where l.variant_id = v.id);

comment on table public.stock_lots is
  'ล็อตต้นทุนแบบ FIFO — ของที่เข้ามาด้วยทุนเดียวกันหนึ่งชุด ตัดของเก่าก่อนเสมอ (0103)';
comment on table public.stock_lot_uses is
  'ตัดจากล็อตไหนไปเท่าไหร่ต่อการขยับสต๊อกหนึ่งครั้ง = ทุนจริงของสิ่งที่ขายไป (0103)';

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.stock_lots') is null then raise exception 'stock_lots หายไป'; end if;
  if to_regclass('public.stock_lot_uses') is null then raise exception 'stock_lot_uses หายไป'; end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'apply_stock_lot_movement_t'
  ) then raise exception 'ทริกเกอร์ล็อตหายไป'; end if;
  raise notice '0103 พร้อม — ต้นทุนแบบล็อต FIFO ขั้นที่ 1';
end $$;
