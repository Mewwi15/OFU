/**
 * คูปองที่ลูกค้าใช้ได้ — อ่านผ่าน RPC `list_app_coupons` (0095)
 *
 * อ่านตาราง promo_codes ตรง ๆ ไม่ได้ RLS เปิดให้เฉพาะแอดมิน RPC เป็น security definer
 * และคัดกรองให้แล้วทั้งช่วงเวลา โควตารวม และโควตาต่อคนของผู้เรียก — ฝั่งแอปจึงไม่ต้อง
 * กรองซ้ำ ได้อะไรมาก็แสดงอันนั้น
 *
 * ยกเว้นยอดขั้นต่ำ (minSpend) ที่ RPC ไม่กรองให้ เพราะขึ้นกับตะกร้า ณ ตอนนั้นซึ่ง
 * หน้ารวมคูปองยังไม่รู้ — ส่งกลับมาให้แสดงเป็นเงื่อนไขแทน
 */

import { supabase } from '@/lib/supabase/client';

export type Coupon = {
  id: string;
  code: string;
  /** 'percent' = ลดเป็น % · 'fixed_baht' = ลดเป็นบาท */
  type: 'percent' | 'fixed_baht';
  value: number;
  /** เพดานส่วนลดเป็นบาท (ใช้กับแบบ % เท่านั้น) — null = ไม่มีเพดาน */
  maxDiscount: number | null;
  /** ยอดซื้อขั้นต่ำถึงจะใช้ได้ — 0 = ไม่มีขั้นต่ำ */
  minSpend: number;
  /** 'subtotal' = ลดค่าสินค้า · 'delivery' = ลดค่าส่ง */
  scope: 'subtotal' | 'delivery';
  /** วันหมดอายุ — null = ไม่มีกำหนด */
  activeTo: string | null;
};

type Row = {
  id: string;
  code: string;
  type: string;
  value: number;
  max_discount: number | null;
  min_spend: number;
  scope: string;
  active_to: string | null;
};

export async function listCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase.rpc('list_app_coupons');
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type === 'percent' ? 'percent' : 'fixed_baht',
    value: r.value,
    maxDiscount: r.max_discount,
    minSpend: r.min_spend,
    scope: r.scope === 'delivery' ? 'delivery' : 'subtotal',
    activeTo: r.active_to,
  }));
}
