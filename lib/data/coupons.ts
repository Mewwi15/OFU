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
  /** ลูกค้าคนนี้กดเก็บใบนี้ไว้แล้วหรือยัง (0096) */
  claimed: boolean;
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
  claimed: boolean;
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
    claimed: !!r.claimed,
  }));
}

/**
 * เก็บคูปองเข้าบัญชี — ไม่กินโควตาและไม่จองสิทธิ์ เป็นแค่การบันทึกว่า "ใบนี้เป็นของฉัน"
 * เพื่อให้ไปเลือกใช้ที่ตะกร้าได้โดยไม่ต้องจำโค้ด สิทธิ์จริงยังตัดสินตอนสั่งซื้อเหมือนเดิม
 *
 * ไม่โยนเมื่อคูปองใช้ไม่ได้ (หมดอายุ/ปิด/โควตาเต็ม) — คืน ok:false พร้อมข้อความไทย
 * ให้เอาไปบอกลูกค้าตรง ๆ โยนเฉพาะตอนเครือข่าย/เซิร์ฟเวอร์มีปัญหาจริง
 */
export async function claimCoupon(
  promoId: string,
): Promise<{ ok: boolean; messageTh: string }> {
  const { data, error } = await supabase.rpc('claim_coupon', { p_promo_id: promoId });
  if (error) throw error;
  const d = (data ?? {}) as { ok?: boolean; message_th?: string };
  return { ok: !!d.ok, messageTh: d.message_th ?? '' };
}

/** เฉพาะใบที่เก็บไว้แล้ว — ตะกร้าใช้ตัวนี้ให้เลือกโดยไม่ต้องพิมพ์โค้ด */
export async function listClaimedCoupons(): Promise<Coupon[]> {
  return (await listCoupons()).filter((c) => c.claimed);
}
