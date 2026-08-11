-- 0069b_revoke_cost_price.sql
-- อู้ฟู่ (Oofoo) — ปิดช่องโหว่ต้นทุนสินค้า · ส่วนที่ 2 จาก 2 (ตัดสิทธิ์จริง)
--
-- ⚠️ รันไฟล์นี้ "หลัง" deploy แอดมินตัวใหม่แล้วเท่านั้น
--    แอดมินตัวเก่ายังขอคอลัมน์ cost_price ตรง ๆ อยู่ ถ้าตัดสิทธิ์ก่อน deploy
--    หน้าสินค้ากับหน้าสต๊อกจะขึ้น error ทันที
--
--    ลำดับที่ถูกต้อง: 0069a -> deploy แอดมิน -> 0069b (ไฟล์นี้)
--
-- หลังรันแล้ว: ยิง REST ขอ cost_price ด้วย anon key จะได้ 42501 permission denied
-- ส่วนแอดมินอ่านผ่าน admin_variant_costs() ซึ่งเช็คสิทธิ์ก่อนเสมอ
--
-- คอลัมน์อื่นไม่ถูกแตะ — ชื่อ ราคาขาย สต็อก บาร์โค้ด ยังอ่านได้ตามเดิม
-- (แอปลูกค้าและเว็บร้านไม่เคยอ่าน cost_price อยู่แล้ว จึงไม่กระทบ)

revoke select (cost_price) on public.product_variants from anon;
revoke select (cost_price) on public.product_variants from authenticated;

-- ── ตรวจว่าตัดสำเร็จจริง ─────────────────────────────────────────────────────
do $$
declare v_left text;
begin
  select string_agg(grantee, ', ') into v_left
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name   = 'product_variants'
    and column_name  = 'cost_price'
    and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated');
  if v_left is not null then
    raise exception 'ยังตัดไม่หมด — % ยังอ่าน cost_price ได้', v_left;
  end if;
  raise notice 'cost_price ถูกซ่อนจาก anon และ authenticated แล้ว';
end $$;
