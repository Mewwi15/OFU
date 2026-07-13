-- 0055_stock_management.sql
-- อู้ฟู่ (Oofoo) — stock workspace for the admin (owner 2026-07-13):
--   • 'receive' stock reason + receive_stock RPC (goods-in with its own ledger
--     reason so history reads แยกจากการปรับแก้ทั่วไป)
--   • stock_movements_view — the movements ledger joined with names for the
--     history tab (security_invoker: underlying admin RLS applies)
--   • line_stock_alert trigger — LOW/OUT of stock pushes to the owner's LINE
--     through send-line (0044-style hardcoded fallback URL/key, 6h cooldown,
--     resets when restocked; uses the alerted_at columns prepared in 0002)

alter type public.stock_reason_t add value if not exists 'receive';

-- ── Goods receiving ──────────────────────────────────────────────────────────
create or replace function public.receive_stock(
  p_variant_id uuid,
  p_qty int,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := public.admin_shop(); v_new int;
begin
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'qty 1..100000';
  end if;

  update public.product_variants pv
  set stock_qty = pv.stock_qty + p_qty
  from public.products p
  where pv.id = p_variant_id and p.id = pv.product_id and p.shop_id = v_shop
  returning pv.stock_qty into v_new;
  if v_new is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant';
  end if;

  insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
  values (p_variant_id, p_qty, 0, 'receive'::public.stock_reason_t, auth.uid());

  perform public.write_audit(v_shop, 'receive_stock', 'product_variants', p_variant_id::text,
    '+' || p_qty || coalesce(' · ' || nullif(btrim(p_note), ''), ''));

  return jsonb_build_object('variant_id', p_variant_id, 'stock_qty', v_new);
end $$;

revoke execute on function public.receive_stock(uuid, int, text) from public;
grant execute on function public.receive_stock(uuid, int, text) to authenticated;

-- ── Movements history (admin UI) ─────────────────────────────────────────────
create or replace view public.stock_movements_view
with (security_invoker = true) as
select
  m.id,
  m.created_at,
  m.reason,
  m.delta_stock,
  m.delta_reserved,
  v.id   as variant_id,
  v.size,
  p.name as product_name,
  o.order_number,
  au.display_name as actor_name
from public.stock_movements m
join public.product_variants v on v.id = m.variant_id
join public.products p on p.id = v.product_id
left join public.orders o on o.id = m.order_id
left join public.app_users au on au.id = m.actor_user_id;

grant select on public.stock_movements_view to authenticated;

-- ── LOW / OUT of stock → owner's LINE ────────────────────────────────────────
create or replace function public.line_stock_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
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

  if new.stock_qty = 0 and old.stock_qty > 0
     and (old.out_of_stock_alerted_at is null
          or old.out_of_stock_alerted_at < now() - interval '6 hours') then
    v_text := 'สินค้าหมดสต๊อก';
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
         || ' เหลือ ' || new.stock_qty || ' ชิ้น'
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
end $$;

drop trigger if exists trg_line_stock_alert on public.product_variants;
create trigger trg_line_stock_alert
  before update of stock_qty on public.product_variants
  for each row execute function public.line_stock_alert();
