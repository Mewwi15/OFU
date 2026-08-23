-- 0074b_goods_receipts_grants.sql
-- อู้ฟู่ (Oofoo) — ก้อนตามแก้สำหรับเครื่องที่รัน 0074 ฉบับแรกไปแล้ว
--
-- 0074 ฉบับแรกสร้างของครบ แต่บล็อกตรวจท้ายไฟล์ล้มด้วย "goods_receipts รั่วถึง
-- anon" — เพราะ Supabase มี default privileges แจกสิทธิ์ตารางใหม่ให้
-- anon/authenticated อัตโนมัติ ต้องถอนออกเองเสมอ (ไฟล์ 0074 ในโค้ดปัจจุบัน
-- แก้รวมไว้แล้ว ไฟล์นี้มีไว้ตามเก็บ production ที่รันฉบับแรกไป)

revoke all on public.goods_receipts from anon;
revoke insert, update, delete on public.goods_receipts from authenticated;
revoke all on sequence public.goods_receipt_seq from anon, authenticated;

-- ═══ ตรวจซ้ำ ═════════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from information_schema.role_table_grants
             where table_schema='public' and table_name='goods_receipts'
               and grantee='anon') then
    raise exception 'goods_receipts ยังรั่วถึง anon';
  end if;
  if not exists (select 1 from information_schema.role_table_grants
                 where table_schema='public' and table_name='goods_receipts'
                   and grantee='authenticated' and privilege_type='SELECT') then
    raise exception 'authenticated อ่านใบรับเข้าไม่ได้ — หน้า POS จะว่างเปล่า';
  end if;
  raise notice '0074 พร้อมใช้งานสมบูรณ์ — เปิดหน้า รับของเข้า ได้เลย';
end $$;
