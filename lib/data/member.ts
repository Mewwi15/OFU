/**
 * OFU MEMBER — แต้มสะสมและของแลก (0100)
 *
 * แต้มเข้าอัตโนมัติจากทั้งสองช่องทาง: ออเดอร์ในแอปตอนส่งถึงแล้ว และบิลหน้าร้านที่
 * แคชเชียร์ผูกบัญชีลูกค้าไว้ — ฝั่งแอปจึงมีแต่การอ่านกับการกดแลก ไม่มีการบวกแต้มเอง
 * (แต้มต้องมาจากยอดขายจริงเท่านั้น ไม่ใช่จากสิ่งที่แอปคำนวณเองแล้วส่งขึ้นไป)
 */

import { supabase } from '@/lib/supabase/client';

/** 100 บาท = 1 แต้ม (เจ้าของกำหนด 4 ก.ย. 2026) — ตัวเลขจริงอยู่ที่ member_points_for()
 *  ในฐานข้อมูล ค่านี้มีไว้อธิบายให้ลูกค้าอ่านบนหน้าจอเท่านั้น */
export const BAHT_PER_POINT = 100;

export type Reward = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  pointsCost: number;
  /** null = ไม่จำกัดจำนวน */
  stock: number | null;
};

export type Redemption = {
  id: string;
  code: string;
  rewardName: string;
  pointsCost: number;
  status: 'pending' | 'collected' | 'cancelled';
  createdAt: string;
};

export type PointsEntry = {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export async function myPoints(): Promise<number> {
  const { data, error } = await supabase.rpc('my_member_points');
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/** แต้มที่ได้ตอนสมัครสมาชิก — ตัวเลขจริงอยู่ใน join_membership() ที่ฐานข้อมูล */
export const WELCOME_POINTS = 100;

export type JoinResult =
  | { ok: true; points: number; awarded: boolean }
  /* แยกเหตุผลออกจากกัน เพราะลูกค้าต้องทำคนละอย่าง: เบอร์ผิดให้แก้เบอร์
     เบอร์ซ้ำให้ไปเข้าบัญชีเดิม ส่วน error อื่นให้ลองใหม่ */
  | { ok: false; reason: 'BAD_PHONE' | 'PHONE_TAKEN' | 'OTHER' };

/** สมัครสมาชิกด้วยเบอร์โทร (ผูกเบอร์กับบัญชี + รับแต้มต้อนรับครั้งเดียว) */
export async function joinMembership(phone: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('join_membership', { p_phone: phone });
  if (error) {
    const m = error.message ?? '';
    if (m.includes('PHONE_TAKEN')) return { ok: false, reason: 'PHONE_TAKEN' };
    if (m.includes('BAD_PHONE')) return { ok: false, reason: 'BAD_PHONE' };
    return { ok: false, reason: 'OTHER' };
  }
  const d = data as { points: number; awarded: boolean };
  return { ok: true, points: d.points, awarded: d.awarded };
}

export async function listRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('member_rewards')
    .select('id, name, description, image_path, points_cost, stock')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      name: string;
      description: string | null;
      image_path: string | null;
      points_cost: number;
      stock: number | null;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    image: r.image_path
      ? r.image_path.startsWith('http')
        ? r.image_path
        : supabase.storage.from('product-images').getPublicUrl(r.image_path).data.publicUrl
      : null,
    pointsCost: r.points_cost,
    stock: r.stock,
  }));
}

export async function listPointsHistory(limit = 20): Promise<PointsEntry[]> {
  const { data, error } = await supabase
    .from('member_points_ledger')
    .select('id, delta, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as { id: string; delta: number; reason: string; created_at: string }[]).map(
    (r) => ({ id: r.id, delta: r.delta, reason: r.reason, createdAt: r.created_at }),
  );
}

export async function listMyRedemptions(): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from('member_redemptions')
    .select('id, code, points_cost, status, created_at, member_rewards(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      id: string;
      code: string;
      points_cost: number;
      status: Redemption['status'];
      created_at: string;
      member_rewards: { name: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    code: r.code,
    rewardName: r.member_rewards?.name ?? 'ของรางวัล',
    pointsCost: r.points_cost,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export type RedeemResult =
  | { ok: true; code: string }
  | { ok: false; code: string; messageTh: string };

/** กดแลก — แต้มถูกตัดทันทีและได้โค้ดไปยื่นรับของที่ร้าน (ดูเหตุผลใน 0100) */
export async function redeemReward(rewardId: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
  if (error) throw error;
  const res = data as { ok: boolean; code?: string; message_th?: string };
  return res.ok
    ? { ok: true, code: res.code as string }
    : { ok: false, code: res.code ?? 'ERROR', messageTh: res.message_th ?? 'แลกไม่สำเร็จ' };
}
