-- 0082_stock_buy_list_rpc.sql
-- "วันนี้ต้องซื้ออะไร" ในที่เดียว — ใช้ทั้งหน้าสต๊อกและบอท LINE
--
-- กฎ (เจ้าของเคาะ 29 ส.ค.): เหลือน้อยกว่า 3 ชิ้น = ต้องซื้อ. จำนวนที่เสนอใช้
-- ยอดขายเฉลี่ย 30 วันคูณระยะเผื่อ 7 วัน แต่อย่างน้อยต้องดันให้พ้นเกณฑ์ 3 ชิ้น
-- และไม่ต่ำกว่า 1 (ของที่ไม่เคยขายจึงยังเสนอ 1 ชิ้น ไม่ใช่ 0)
--
-- อยู่ใน SQL เพราะมีผู้เรียกสองทางแล้ว: หน้าเว็บแอดมิน กับ edge function ของ
-- LINE ถ้าปล่อยให้ต่างคนต่างคำนวณ วันหนึ่งมันจะตอบคนละเลขโดยไม่มีใครรู้ตัว

create or replace function public.stock_buy_list(p_limit int default 20)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with v as (
    select
      pv.id, pv.stock_qty, pv.unit,
      p.name as product_name, pv.size,
      coalesce(c.name, 'ไม่ระบุหมวด') as category
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    left join public.categories c on c.id = p.category_id
    where pv.archived_at is null
  ),
  rate as (
    select
      m.variant_id,
      greatest(-sum(m.delta_stock), 0) / 30.0 as per_day
    from public.stock_movements m
    where m.reason in (
            'online_place', 'pos_sale',                    -- ออกจากสต๊อก
            'online_cancel_restock', 'online_expiry_restock',
            'online_reject_restock', 'pos_refund'          -- คืนกลับเข้าสต๊อก
          )
      and m.created_at > now() - interval '30 days'
    group by m.variant_id
  ),
  scored as (
    select
      v.*,
      coalesce(r.per_day, 0) as per_day,
      greatest(3 - v.stock_qty, ceil(coalesce(r.per_day, 0) * 7 - v.stock_qty), 1)::int as buy_qty
    from v left join rate r on r.variant_id = v.id
  )
  select jsonb_build_object(
    'total',    (select count(*) from scored),
    'buy',      (select count(*) from scored where stock_qty < 3),
    'out',      (select count(*) from scored where stock_qty = 0),
    'idle',     (select count(*) from scored where stock_qty >= 3 and per_day = 0),
    'ok',       (select count(*) from scored where stock_qty >= 3 and per_day > 0),
    'pieces',   (select coalesce(sum(stock_qty), 0) from scored),
    'by_category', coalesce((
      -- ::int สำคัญ — เรียงเป็นข้อความจะได้ '40' มาก่อน '121'
      select jsonb_agg(x order by (x->>'buy')::int desc, (x->>'count')::int desc)
      from (
        select jsonb_build_object(
                 'category', category,
                 'count', count(*),
                 'buy', count(*) filter (where stock_qty < 3)
               ) as x
        from scored group by category
      ) c
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(y)
      from (
        select jsonb_build_object(
                 'name', product_name || coalesce(' (' || size || ')', ''),
                 'category', category,
                 'stock', stock_qty,
                 'unit', coalesce(unit, 'ชิ้น'),
                 'qty', buy_qty
               ) as y
        from scored
        where stock_qty < 3
        order by stock_qty, per_day desc
        limit greatest(p_limit, 0)
      ) i
    ), '[]'::jsonb)
  );
$$;

comment on function public.stock_buy_list(int) is
  'สรุปสต๊อก + รายการที่ต้องซื้อ (เหลือ < 3 ชิ้น) ใช้ร่วมกันระหว่างหน้าแอดมินกับบอท LINE';

-- อ่านได้เฉพาะฝั่งเซิร์ฟเวอร์: มีทั้งจำนวนคงเหลือและรายการสินค้าทั้งร้าน
-- ไม่ควรเปิดให้ anon/authenticated ยิงเอาได้
revoke all on function public.stock_buy_list(int) from public, anon, authenticated;
grant execute on function public.stock_buy_list(int) to service_role;
