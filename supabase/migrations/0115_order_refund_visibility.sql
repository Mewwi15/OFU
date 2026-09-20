-- เงินที่ต้องโอนคืนลูกค้า ต้องมีที่ให้เห็น และมีปุ่มปิดงาน
--
-- ★ ตาราง refunds เป็น write-only มาตั้งแต่วันแรก ★ cancel_order เปิดแถว status='owed'
-- ให้ทุกครั้งที่ยกเลิกออเดอร์ที่ลูกค้าโอนเงินมาแล้ว (0067:693-703 และของเดิม 0007:269)
-- แต่ไล่ทั้งโฟลเดอร์นี้แล้วไม่มี view / RPC / ทริกเกอร์ไหน select หรือ update ตารางนี้เลย
-- สักที่ หนี้ก้อนนั้นจึงค้างที่ 'owed' ตลอดกาล — sent_at / sent_by / confirmed_at
-- ไม่มีทางถูกเติม และไม่มีหน้าจอไหนบอกว่าร้านถือเงินลูกค้าอยู่เท่าไหร่
--   · เกิดจริงได้ทั้งตอนแอดมินกดยกเลิก และตอน "ลูกค้ากดยกเลิกเอง" ในแอป
--     (cancel_order ยอมให้ลูกค้ายกเลิกก่อนของออกจากร้าน — 0067:654-660)
--     เคสหลังไม่มีแอดมินอยู่ตรงนั้นด้วยซ้ำ เงินจึงค้างที่ร้านเงียบ ๆ จนลูกค้าทวง
--
-- ★ ไฟล์นี้ไม่แตะ cancel_order ★ ตรรกะการตั้งหนี้ถูกอยู่แล้ว ที่ขาดคือ "ทางอ่าน" กับ
-- "ทางปิดงาน" เท่านั้น จึงเติมแค่สองฟังก์ชัน ไม่ไปยุ่งกับเส้นทางที่ขยับเงิน/สต๊อก

begin;

/**
 * รายการที่ร้านยังติดค้างคืนเงินลูกค้า (status='owed')
 *
 * ★ เป็น security definer แต่กรองด้วย is_admin_of เอง ★ ฝั่งอ่านมี policy refunds_read
 * (0003:182) อยู่แล้วก็จริง แต่หน้าจอต้องการเลขออเดอร์/ชื่อ/เบอร์ผู้รับมาด้วยในคราวเดียว
 * ถ้าปล่อยให้หน้าจอ join เอง จะต้องพึ่งการเดาความสัมพันธ์ของ PostgREST ซึ่งเพี้ยนได้
 * เวลาเพิ่มคอลัมน์ทีหลัง — แถบ "รอคืนเงิน" หายไปเงียบ ๆ = เงินลูกค้าหายไปกับมัน
 */
create or replace function public.list_owed_refunds()
returns table (
  id uuid,
  order_id uuid,
  order_number text,
  amount int,
  reason public.refund_reason_t,
  created_at timestamptz,
  ship_recipient text,
  ship_phone text
) language sql stable security definer set search_path = '' as $$
  select r.id, r.order_id, o.order_number, r.amount, r.reason, r.created_at,
         o.ship_recipient, o.ship_phone
    from public.refunds r
    join public.orders o on o.id = r.order_id
   where r.status = 'owed'::public.refund_status_t
     and public.is_admin_of(r.shop_id)
   order by r.created_at;
$$;

/**
 * บันทึกว่าโอนคืนลูกค้าแล้ว — owed → sent
 *
 * ★ กดซ้ำไม่ทับของเดิม ★ คืนค่าเฉย ๆ ถ้าแถวไม่ได้อยู่ที่ 'owed' แล้ว เพราะ sent_at /
 * sent_by คือหลักฐานว่า "ใครโอนตอนไหน" ถ้าเขียนทับได้ วันที่ต้องใช้เคลียร์กับลูกค้า
 * มันจะกลายเป็นเวลาที่ใครก็ไม่รู้เผลอกดปุ่มซ้ำ
 *
 * ★ ไม่มี policy update บน refunds โดยตั้งใจ ★ ทางเดียวที่แก้แถวนี้ได้คือผ่านฟังก์ชันนี้
 * ยอดเงิน (amount) จึงแก้ด้วยมือไม่ได้เลย — ยอดหนี้ต้องเท่ากับยอดที่ระบบตั้งไว้ตอนยกเลิก
 */
create or replace function public.mark_refund_sent(
  p_refund_id uuid,
  p_ref text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid; v_status public.refund_status_t;
begin
  select shop_id, status into v_shop, v_status
    from public.refunds where id = p_refund_id for update;
  if v_shop is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.is_admin_of(v_shop) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  if v_status <> 'owed'::public.refund_status_t then
    return jsonb_build_object('refund_id', p_refund_id, 'status', v_status);
  end if;

  update public.refunds
     set status = 'sent'::public.refund_status_t,
         sent_by = auth.uid(),
         sent_at = now(),
         /* เลขอ้างอิงการโอนเป็นของแถม — ไม่กรอกก็ปิดงานได้ ไม่งั้นเวลารีบจะไม่มีใครกด */
         promptpay_ref = coalesce(nullif(btrim(p_ref), ''), promptpay_ref)
   where id = p_refund_id;

  perform public.write_audit(v_shop, 'mark_refund_sent', 'refunds', p_refund_id::text,
                             'owed → sent');
  return jsonb_build_object('refund_id', p_refund_id, 'status', 'sent');
end $$;

revoke execute on function public.list_owed_refunds() from public;
revoke execute on function public.mark_refund_sent(uuid, text) from public;
grant execute on function public.list_owed_refunds() to authenticated;
grant execute on function public.mark_refund_sent(uuid, text) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.list_owed_refunds()') is null then
    raise exception 'list_owed_refunds หายไป';
  end if;
  if to_regprocedure('public.mark_refund_sent(uuid, text)') is null then
    raise exception 'mark_refund_sent หายไป';
  end if;
  raise notice '0115 พร้อม — หนี้ค้างคืนเงินอ่านได้และกดปิดงานได้แล้ว';
end $$;
