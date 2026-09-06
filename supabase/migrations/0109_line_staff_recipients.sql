-- แจ้งเตือน LINE ถึงพนักงานได้หลายเครื่อง ไม่ใช่แค่เจ้าของคนเดียว
--
-- เจ้าของสั่ง 6 ก.ย. 2026: "อยากให้อีก 2 เครื่องที่เป็นแอดมินได้ไลน์ OA ของเราด้วย"
--
-- ★ เดิมมีผู้รับได้คนเดียวต่อร้าน ★ shops.line_owner_user_id เก็บ LINE ของเจ้าของไว้ช่อง
-- เดียว ออเดอร์ใหม่/สลิปที่ลูกค้าแนบจึงเข้าเครื่องเดียว — วันที่เจ้าของไม่ได้ถือเครื่อง
-- ออเดอร์ก็ไม่มีใครเห็นจนกว่าจะมีคนเปิดหลังร้าน
--
-- ★ ไม่ทิ้งช่องเดิม ★ line_owner_user_id ยังเป็น "เจ้าของตัวจริง" ต่อไป (ใช้ตัดสินสิทธิ์
-- ตอบคำสั่งบอทและเป็นทางกู้คืนถ้าผูกผิดคน) ตารางนี้เพิ่ม "คนที่รับแจ้งเตือนด้วย" เข้ามา
-- แยกกันชัดเจน: เป็นเจ้าของ = คนละเรื่องกับ ได้รับแจ้งเตือน

begin;

create table if not exists public.shop_line_recipients (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  /* LINE userId ของเครื่องนั้น — ได้มาตอนคนพิมพ์รหัสผูกในแชท OA */
  line_user_id text not null,
  /* ชื่อเรียกไว้ให้เจ้าของรู้ว่าเครื่องไหน (ตั้งจากหลังร้านทีหลังได้) */
  label        text,
  created_at   timestamptz not null default now(),
  unique (shop_id, line_user_id)
);

alter table public.shop_line_recipients enable row level security;
/* ★ ลูกค้าห้ามเห็นเลย ★ LINE userId เป็นตัวระบุตัวบุคคล และรายชื่อนี้คือ "ใครเป็นคนของร้าน"
   เปิดให้อ่านได้เท่ากับบอกว่าพนักงานร้านมีใครบ้าง */
create policy line_recipients_admin on public.shop_line_recipients for select
  using (public.app_role() = 'admin');
grant select on public.shop_line_recipients to authenticated;
grant select, insert, update, delete on public.shop_line_recipients to service_role;

/**
 * ผู้รับแจ้งเตือนทั้งหมดของร้าน = เจ้าของ + คนที่ผูกเพิ่ม (ไม่ซ้ำกัน)
 *
 * ★ รวมเจ้าของไว้ในนี้ด้วย ★ ฝั่งที่ส่งจะได้ถามที่เดียวจบ ไม่ต้องจำว่ามีสองแหล่ง แล้ว
 * วันหนึ่งเผลอส่งจากแหล่งเดียวจนเจ้าของไม่ได้รับ
 */
create or replace function public.line_alert_targets(p_shop_id uuid)
returns table (line_user_id text)
language sql stable security definer set search_path = '' as $$
  select s.line_owner_user_id
    from public.shops s
   where s.id = p_shop_id and s.line_owner_user_id is not null
  union
  select r.line_user_id
    from public.shop_line_recipients r
   where r.shop_id = p_shop_id;
$$;

revoke execute on function public.line_alert_targets(uuid) from public;
grant execute on function public.line_alert_targets(uuid) to service_role;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.shop_line_recipients') is null then
    raise exception 'ตารางผู้รับแจ้งเตือน LINE หายไป';
  end if;
  if to_regprocedure('public.line_alert_targets(uuid)') is null then
    raise exception 'line_alert_targets หายไป';
  end if;
  raise notice '0109 พร้อม — แจ้งเตือน LINE ถึงหลายเครื่องได้';
end $$;
