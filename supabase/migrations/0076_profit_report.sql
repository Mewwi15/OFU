-- 0076_profit_report.sql
-- อู้ฟู่ (Oofoo) — รายงานกำไรขั้นต้น (เจ้าของเลือกเป็นงานถัดไป 23 ส.ค.)
--
-- เพิ่งเป็นไปได้เพราะใบรับเข้า (0074) ทำให้ทุนล่าสุดไหลเข้าระบบอัตโนมัติ —
-- แต่บิลขาย (pos_sale_items) และออเดอร์แอป (order_items) ไม่เคยเก็บ "ทุน ณ
-- ตอนขาย" ไว้เลย ถ้าคำนวณย้อนหลังด้วยทุนปัจจุบันตลอด รายงานจะเพี้ยนทุกครั้ง
-- ที่ทุนเปลี่ยน
--
--   1. เพิ่ม unit_cost ในบรรทัดขายทั้งสองทาง + trigger เติมจากทุนปัจจุบัน
--      ตอน insert (แนว trigger เดิม 0073/0075 — ไม่แตะฟังก์ชันใหญ่)
--   2. profit_report(from,to) — สรุปกำไรรวม/รายช่องทาง/รายสินค้า
--      บรรทัดเก่าที่ไม่มี snapshot ใช้ทุนปัจจุบันแทน (fallback) และนับบอกไว้
--      ตรง ๆ ว่ามีกี่บรรทัดที่ยังไม่มีทุนเลย — รายงานที่ซื่อสัตย์กว่ารายงานสวย

begin;

-- ── 1. snapshot ทุน ณ ตอนขาย ─────────────────────────────────────────────────
alter table public.pos_sale_items add column if not exists unit_cost numeric;
alter table public.order_items    add column if not exists unit_cost numeric;

create or replace function public.snapshot_line_cost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.unit_cost is null and new.variant_id is not null then
    select cost_price into new.unit_cost
    from public.product_variants where id = new.variant_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_cost_pos_sale_items on public.pos_sale_items;
create trigger trg_cost_pos_sale_items
  before insert on public.pos_sale_items
  for each row execute function public.snapshot_line_cost();

drop trigger if exists trg_cost_order_items on public.order_items;
create trigger trg_cost_order_items
  before insert on public.order_items
  for each row execute function public.snapshot_line_cost();

-- ── 2. รายงานกำไรขั้นต้น ─────────────────────────────────────────────────────
-- POS = บิล completed ในช่วง · แอป/เว็บ = ออเดอร์จ่ายแล้วที่สั่งในช่วง
-- (นิยามช่วงเดียวกับ pos_dashboard เพื่อให้ตัวเลขสองหน้าตรงกัน)
create or replace function public.profit_report(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_pos jsonb; v_online jsonb; v_products jsonb; v_missing int;
begin
  if v_shop is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select jsonb_build_object(
      'revenue', coalesce(sum(i.line_total), 0),
      'cost',    coalesce(sum(coalesce(i.unit_cost, v.cost_price, 0) * i.qty), 0),
      'bill_discount', coalesce((
        select sum(discount) from public.pos_sales
        where shop_id = v_shop and status = 'completed'::public.pos_sale_status_t
          and created_at >= p_from and created_at < p_to), 0)
    )
  into v_pos
  from public.pos_sale_items i
  join public.pos_sales s on s.id = i.sale_id
  left join public.product_variants v on v.id = i.variant_id
  where s.shop_id = v_shop and s.status = 'completed'::public.pos_sale_status_t
    and s.created_at >= p_from and s.created_at < p_to;

  select jsonb_build_object(
      'revenue', coalesce(sum(i.line_total), 0),
      'cost',    coalesce(sum(coalesce(i.unit_cost, v.cost_price, 0) * i.qty), 0)
    )
  into v_online
  from public.order_items i
  join public.orders o on o.id = i.order_id
  left join public.product_variants v on v.id = i.variant_id
  where o.shop_id = v_shop and o.payment_status = 'paid'::public.payment_status_t
    and o.placed_at >= p_from and o.placed_at < p_to;

  -- รายสินค้า (รวมสองช่องทาง) — เรียงตามยอดขาย จำกัด 300 แถว
  select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb),
         coalesce(sum(t.no_cost_lines), 0)
  into v_products, v_missing
  from (
    select
      u.name, u.size,
      sum(u.qty)::int                                   as qty,
      sum(u.line_total)                                 as revenue,
      sum(u.cost_amt)                                   as cost,
      sum(u.line_total) - sum(u.cost_amt)               as profit,
      sum(case when u.has_cost then 0 else 1 end)::int  as no_cost_lines
    from (
      select i.product_name as name, i.size, i.qty, i.line_total,
             coalesce(i.unit_cost, v.cost_price, 0) * i.qty as cost_amt,
             (coalesce(i.unit_cost, v.cost_price) is not null) as has_cost
      from public.pos_sale_items i
      join public.pos_sales s on s.id = i.sale_id
      left join public.product_variants v on v.id = i.variant_id
      where s.shop_id = v_shop and s.status = 'completed'::public.pos_sale_status_t
        and s.created_at >= p_from and s.created_at < p_to
      union all
      select i.name_snapshot, i.size_snapshot, i.qty, i.line_total,
             coalesce(i.unit_cost, v.cost_price, 0) * i.qty,
             (coalesce(i.unit_cost, v.cost_price) is not null)
      from public.order_items i
      join public.orders o on o.id = i.order_id
      left join public.product_variants v on v.id = i.variant_id
      where o.shop_id = v_shop and o.payment_status = 'paid'::public.payment_status_t
        and o.placed_at >= p_from and o.placed_at < p_to
    ) u
    group by u.name, u.size
    order by revenue desc
    limit 300
  ) t;

  return jsonb_build_object(
    'pos', v_pos, 'online', v_online,
    'products', v_products, 'missing_cost_lines', v_missing
  );
end $$;

revoke execute on function public.profit_report(timestamptz, timestamptz) from public;
grant execute on function public.profit_report(timestamptz, timestamptz) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_cost_pos_sale_items') then
    raise exception 'trigger ทุนบิล POS หายไป';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_cost_order_items') then
    raise exception 'trigger ทุนออเดอร์แอปหายไป';
  end if;
  if to_regprocedure('public.profit_report(timestamptz,timestamptz)') is null then
    raise exception 'profit_report หายไป';
  end if;
  raise notice '0076 พร้อม — รายงานกำไรใช้ได้ในหน้ารายงาน · บิลใหม่เก็บทุน ณ ตอนขาย';
end $$;
