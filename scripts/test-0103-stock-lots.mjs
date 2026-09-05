#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0103 — ต้นทุนแบบล็อต (FIFO) ขั้นที่ 1
 *
 * สิ่งที่ต้องพิสูจน์ (เจ้าของอธิบายเองว่า "เหมือนแม็กกาซีน"):
 *   1. ของเก่าถูกตัดก่อนเสมอ แม้ล็อตใหม่จะถูกสร้างทีหลัง
 *   2. ขายคร่อมสองล็อตต้องตัดถูกสัดส่วน (เหลือ 10 ที่ ฿10 ขาย 12 → 10@10 + 2@12)
 *   3. ★ ล็อตไม่พอต้องขายได้ ★ ร้านมีลูกค้ายืนรออยู่ ห้ามปฏิเสธเพราะบัญชีล็อตไม่ตรง
 *   4. ใบรับเข้าลงวันที่ย้อนหลังต้องไปอยู่หน้าคิว ไม่ใช่ท้ายคิว
 *   5. ของคืน/ปรับยอดเพิ่มที่ไม่มีทุนติดมา ต้องไม่กลายเป็นล็อตทุน 0
 *
 * รัน (เครื่องตัวเองเท่านั้น):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0103-stock-lots.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('FATAL: ต้องมี SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const LOCAL = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
const hostOf = (u) => { try { return new globalThis.URL(u).hostname; } catch { return ''; } };
if (!LOCAL.has(hostOf(URL))) { console.error(`FATAL: ไม่ยอมรันกับโฮสต์ที่ไม่ใช่เครื่องตัวเอง (${URL})`); process.exit(1); }

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => { failures++; console.log(`  FAIL  [${c}] ${m}`); if (d !== undefined) console.log(`        ↳ ${d}`); };
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const cust = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

console.log('\n0103 — ต้นทุนแบบล็อต (FIFO)\n');

/* ── สินค้าทดสอบของตัวเอง ไม่ยุ่งกับของจริง ─────────────────────────────── */
const stamp = Date.now();
const { data: shop } = await db.from('shops').select('id').limit(1).single();
const { data: prod, error: pErr } = await db
  .from('products')
  .insert({ shop_id: shop.id, name: `ทดสอบล็อต ${stamp}` })
  .select('id')
  .single();
if (pErr) { console.error('FATAL: สร้างสินค้าไม่ได้', pErr.message); process.exit(1); }
const { data: variant, error: vErr } = await db
  .from('product_variants')
  .insert({ product_id: prod.id, price: 20, cost_price: 10, stock_qty: 0 })
  .select('id')
  .single();
if (vErr) { console.error('FATAL: สร้างตัวเลือกสินค้าไม่ได้', vErr.message); process.exit(1); }
const VID = variant.id;

/** ขยับสต๊อกผ่านสมุด — ทางเดียวกับที่ RPC ขายจริงใช้ */
const move = async (delta, reason, unitCost, at) => {
  const row = { variant_id: VID, delta_stock: delta, reason };
  if (unitCost != null) row.unit_cost = unitCost;
  if (at) row.created_at = at;
  const { data, error } = await db.from('stock_movements').insert(row).select('id').single();
  if (error) throw new Error(`${reason}: ${error.message}`);
  await db.from('product_variants').update({ stock_qty: await stockOf() + delta }).eq('id', VID);
  return data.id;
};
const stockOf = async () => {
  const { data } = await db.from('product_variants').select('stock_qty').eq('id', VID).single();
  return data?.stock_qty ?? 0;
};
const lots = async () => {
  const { data } = await db
    .from('stock_lots')
    .select('unit_cost, qty_in, qty_left, received_at')
    .eq('variant_id', VID)
    .order('received_at');
  return data ?? [];
};
const usesOf = async (movementId) => {
  const { data } = await db
    .from('stock_lot_uses')
    .select('qty, unit_cost, lot_id')
    .eq('movement_id', movementId);
  return data ?? [];
};

/* ── A. ของเข้า → ล็อตเกิด ────────────────────────────────────────────────── */
await move(10, 'admin_adjust', 10, '2026-01-01T00:00:00Z');
await move(20, 'admin_adjust', 12, '2026-02-01T00:00:00Z');
{
  const L = await lots();
  check('A1', L.length === 2, 'รับเข้าสองครั้ง ได้สองล็อต', `ได้ ${L.length}`);
  check('A2', Number(L[0].unit_cost) === 10 && Number(L[1].unit_cost) === 12,
    'ล็อตเก็บทุนตามบิลของแต่ละครั้ง', JSON.stringify(L.map((l) => l.unit_cost)));
}

/* ── B. ขายคร่อมสองล็อต ตัดของเก่าก่อน ───────────────────────────────────── */
{
  const mid = await move(-12, 'commit_confirmed');
  const u = await usesOf(mid);
  const at10 = u.filter((x) => Number(x.unit_cost) === 10).reduce((s, x) => s + x.qty, 0);
  const at12 = u.filter((x) => Number(x.unit_cost) === 12).reduce((s, x) => s + x.qty, 0);
  check('B1', at10 === 10, 'ตัดล็อตเก่า (฿10) จนหมดก่อน 10 ชิ้น', `ได้ ${at10}`);
  check('B2', at12 === 2, 'ที่เหลืออีก 2 ชิ้นตัดจากล็อตใหม่ (฿12)', `ได้ ${at12}`);
  check('B3', u.every((x) => x.lot_id), 'ทุกชิ้นมีล็อตรองรับ');

  const L = await lots();
  check('B4', L[0].qty_left === 0 && L[1].qty_left === 18,
    'ยอดคงเหลือในล็อตถูกตัดถูกต้อง', JSON.stringify(L.map((l) => l.qty_left)));
}

/* ── C. ล็อตไม่พอ ต้องขายได้ ไม่ใช่ล้ม ────────────────────────────────────── */
{
  let threw = null;
  let mid = null;
  try {
    mid = await move(-100, 'commit_confirmed'); // เหลือจริง 18
  } catch (e) {
    threw = e;
  }
  check('C1', !threw, 'ขายเกินล็อตที่มีแล้วไม่ล้ม (ร้านต้องขายต่อได้)', threw?.message);
  if (mid) {
    const u = await usesOf(mid);
    const orphan = u.filter((x) => !x.lot_id).reduce((s, x) => s + x.qty, 0);
    check('C2', orphan === 82, 'ส่วนที่ไม่มีล็อตรองรับถูกบันทึกแยกไว้ตรวจได้', `ได้ ${orphan}`);
    check('C3', u.filter((x) => x.lot_id).reduce((s, x) => s + x.qty, 0) === 18,
      'ส่วนที่มีล็อตถูกตัดจนหมดก่อน');
  }
}

/* ── D. ใบรับเข้าลงวันที่ย้อนหลัง ต้องไปหน้าคิว ──────────────────────────── */
{
  await move(5, 'admin_adjust', 30, '2026-03-01T00:00:00Z');
  await move(5, 'admin_adjust', 7, '2026-01-15T00:00:00Z'); // ย้อนหลัง ทุนถูกกว่า
  const mid = await move(-5, 'commit_confirmed');
  const u = await usesOf(mid);
  check('D1', u.length === 1 && Number(u[0].unit_cost) === 7,
    'ของที่รับย้อนหลังถูกตัดก่อน (เรียงตามวันรับจริง ไม่ใช่ลำดับที่บันทึก)',
    JSON.stringify(u.map((x) => x.unit_cost)));
}

/* ── E. ของเข้าที่ไม่มีทุนติดมา ต้องไม่เป็นล็อตทุน 0 ─────────────────────── */
{
  await db.from('product_variants').update({ cost_price: 15 }).eq('id', VID);
  await move(3, 'restock_cancel'); // คืนของ ไม่มี unit_cost
  const L = await lots();
  const newest = L[L.length - 1];
  check('E1', Number(newest.unit_cost) === 15,
    'ของคืน/ปรับยอดใช้ทุนล่าสุดของสินค้า ไม่ใช่ 0', `ได้ ${newest.unit_cost}`);
}

/* ── F. ลูกค้าต้องไม่เห็นต้นทุน ─────────────────────────────────────────── */
{
  const { data, error } = await cust.from('stock_lots').select('unit_cost').limit(1);
  check('F1', !!error || (data ?? []).length === 0, 'ลูกค้าอ่านล็อตต้นทุนไม่ได้',
    error ? undefined : `อ่านได้ ${(data ?? []).length} แถว`);
}
{
  const { data, error } = await cust.from('stock_lot_uses').select('unit_cost').limit(1);
  check('F2', !!error || (data ?? []).length === 0, 'ลูกค้าอ่านทุนที่ถูกตัดไม่ได้',
    error ? undefined : `อ่านได้ ${(data ?? []).length} แถว`);
}

/* ── ล้างของทดสอบ ────────────────────────────────────────────────────────── */
await db.from('stock_lot_uses').delete().eq('variant_id', VID);
await db.from('stock_lots').delete().eq('variant_id', VID);
await db.from('stock_movements').delete().eq('variant_id', VID);
await db.from('product_variants').delete().eq('id', VID);
await db.from('products').delete().eq('id', prod.id);

console.log(`\n${failures === 0 ? 'ผ่านทั้งหมด' : `ตก ${failures} ข้อ`}\n`);
process.exit(failures === 0 ? 0 : 1);
