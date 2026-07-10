-- 0040_drop_self_delete.sql
-- อู้ฟู่ (Oofoo) — ถอดระบบ "ลบบัญชีด้วยตัวเอง" ออก (เจ้าของร้านตัดสินใจ 2026-07-10)
--
-- แอปเหลือเฉพาะ "ออกจากระบบ"; คำขอลบข้อมูลตาม PDPA ให้ลูกค้าติดต่อร้านโดยตรง
-- (ร้านจัดการผ่านผู้ดูแลระบบ). ลบ RPC ที่เกี่ยวทั้งคู่:
--   * delete_my_account (0015) — ต้นเหตุบัญชีค้างสถานะ deactivated สมัครซ้ำไม่ได้
--   * reactivate_my_account (0039) — หมดความจำเป็นเมื่อไม่มีทางเกิด deactivated

drop function if exists public.delete_my_account();
drop function if exists public.reactivate_my_account();
