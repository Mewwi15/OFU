-- บอกให้รู้ว่าบาร์โค้ด/SKU ที่ซ้ำ อยู่กับสินค้าตัวไหน — เจ้าของเจอปัญหา 3 ก.ย. 2026
-- ("พอผมแก้บาร์โค้ดมันบอกมันมีอยู่แล้ว" ทั้งที่หาในหน้าสินค้าแล้วไม่เจอ)
--
-- ต้นเหตุ: การเช็คซ้ำมองเห็น product_variants ทุกแถวเพราะเป็น security definer
-- แต่หน้าสินค้าในแอดมินกรอง .is('archived_at', null) ทั้งชั้นสินค้าและชั้นขนาด
-- บาร์โค้ดที่ค้างอยู่กับสินค้าหรือขนาดที่เลิกขายไปแล้วจึงบล็อกการใช้ซ้ำ โดยที่
-- เจ้าของหาตัวที่ถืออยู่ไม่เจอเลยไม่ว่าจะกรองสถานะแบบไหน — ทางตัน
--
-- แก้ที่ข้อความ ไม่ใช่ที่กติกา: ยังบล็อกเหมือนเดิม เพราะดัชนี unique บนคอลัมน์
-- barcode เป็นดัชนีระดับตารางที่ไม่ได้ยกเว้นแถวที่เลิกขาย ถ้าปล่อยให้ผ่านการเช็ค
-- ไปมันจะไปตายที่ unique_violation แทน ซึ่งข้อความยิ่งอ่านไม่รู้เรื่องกว่าเดิม
-- (ถ้าจะให้ใช้ซ้ำได้จริงต้องแก้ดัชนีเป็น partial ที่ยกเว้นแถวเลิกขายด้วย —
--  คนละเรื่องกัน ยังไม่ทำในไมเกรชันนี้)
--
-- หมายเหตุที่ยังค้าง: การเช็คนี้ไม่ได้กรอง shop_id ตรวจข้ามร้านทั้งระบบ ตอนนี้
-- ยังมีร้านเดียวจึงไม่มีผล แต่ถ้าเปิดร้านที่สองเมื่อไหร่จะบล็อกข้ามร้านทันที
-- (ดัชนี unique ก็เป็นแบบทั้งระบบเหมือนกัน ต้องแก้คู่กัน)

-- ป้ายบอกว่าโค้ดนั้นอยู่กับใคร พร้อมสถานะ — สถานะสำคัญกว่าชื่อ เพราะถ้าเป็นตัวที่
-- เลิกขายไปแล้วเจ้าของจะหาไม่เจอในหน้าสินค้า ต้องบอกไปเลยว่าให้ไปหาที่ไหน
-- ไม่ grant ให้ใคร ใช้ภายในจากฟังก์ชัน security definer เท่านั้น (มันรันเป็นเจ้าของ
-- ฟังก์ชันอยู่แล้วจึงเรียกได้) ถ้าเปิดให้เรียกตรง ๆ = ช่องให้ไล่เดาบาร์โค้ดดูชื่อสินค้าร่าง
create or replace function public.code_owner_label(p_variant_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select p.name
         || coalesce(' (' || nullif(pv.size, '') || ')', '')
         || case
              when pv.archived_at is not null then ' · ขนาดนี้เลิกขายแล้ว'
              when p.archived_at is not null then ' · สินค้านี้เลิกขายแล้ว'
              when p.publish_state::text <> 'published' then ' · สินค้าร่าง ยังไม่เผยแพร่'
              else ' · ขายอยู่'
            end
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
   where pv.id = p_variant_id
$$;

revoke execute on function public.code_owner_label(uuid) from public;

create or replace function public.upsert_variant(
  p_id uuid default null,
  p_product_id uuid default null,
  p_size text default null,
  p_price int default null,
  p_stock_qty int default null,
  p_low_stock_threshold int default null,
  p_sku text default null,
  p_barcode text default null,
  p_cost_price numeric default null,
  p_unit text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := public.admin_shop();
  v_id uuid;
  v_new_stock int;
  v_owner text;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'price > 0 required';
  end if;
  if p_id is null and p_stock_qty is not null and p_stock_qty < 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'stock >= 0';
  end if;
  if p_product_id is null or not exists (
    select 1 from public.products where id = p_product_id and shop_id = v_shop
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'product';
  end if;

  if p_sku is not null then
    select public.code_owner_label(pv.id) into v_owner
      from public.product_variants pv
     where pv.sku = p_sku and (p_id is null or pv.id <> p_id)
     limit 1;
    if v_owner is not null then
      raise exception 'DUPLICATE_SKU' using errcode = 'P0001', detail = v_owner;
    end if;
  end if;

  if p_barcode is not null then
    select public.code_owner_label(pv.id) into v_owner
      from public.product_variants pv
     where pv.barcode = p_barcode and (p_id is null or pv.id <> p_id)
     limit 1;
    if v_owner is not null then
      raise exception 'DUPLICATE_BARCODE' using errcode = 'P0001', detail = v_owner;
    end if;
  end if;

  if p_id is null then
    begin
      insert into public.product_variants
        (product_id, size, price, stock_qty, low_stock_threshold, sku, barcode, cost_price, unit)
      values (p_product_id, p_size, p_price, coalesce(p_stock_qty, 0), coalesce(p_low_stock_threshold, 5),
              p_sku, p_barcode, p_cost_price, coalesce(p_unit, 'ชิ้น'))
      returning id, stock_qty into v_id, v_new_stock;
    exception when unique_violation then
      raise exception 'DUPLICATE_VARIANT' using errcode = 'P0001';
    end;
    if v_new_stock > 0 then
      insert into public.stock_movements (variant_id, delta_stock, delta_reserved, reason, actor_user_id)
      values (v_id, v_new_stock, 0, 'admin_adjust'::public.stock_reason_t, auth.uid());
    end if;
  else
    if not exists (
      select 1
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = p_id and p.id = p_product_id and p.shop_id = v_shop
    ) then raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'variant'; end if;

    update public.product_variants set
      size = p_size, price = p_price,
      low_stock_threshold = coalesce(p_low_stock_threshold, low_stock_threshold),
      sku = p_sku, barcode = p_barcode, cost_price = p_cost_price,
      unit = coalesce(p_unit, unit)
    where id = p_id returning id into v_id;
  end if;
  perform public.write_audit(v_shop, 'upsert_variant', 'product_variants', v_id::text, 'variant price=' || p_price);
  return jsonb_build_object('id', v_id);
end $$;

revoke execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, numeric, text) from public;
grant execute on function public.upsert_variant(uuid, uuid, text, int, int, int, text, text, numeric, text) to authenticated;
