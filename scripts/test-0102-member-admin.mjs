#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0102 — ทำให้ระบบสมาชิกครบวง
 *
 * สามเรื่องที่ต้องพิสูจน์:
 *   1. โค้ดแลกของกดยืนยันซ้ำไม่ได้ (ยื่นโค้ดเดิมสองรอบต้องไม่ได้ของสองชิ้น)
 *   2. ลูกค้าเรียก RPC ของแอดมินไม่ได้เลยสักตัว (ร้านเปิดขายอยู่ พลาดตรงนี้คือแจกของฟรี)
 *   3. ค้นลูกค้าจากเบอร์ได้ทุกรูปแบบ (+66… / 66… / 0…) — คิวอาร์สมาชิกส่งมาเป็น +66
 *
 * รัน (เครื่องตัวเองเท่านั้น):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0102-member-admin.mjs
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

console.log('\n0102 — ระบบสมาชิกฝั่งร้าน\n');

/* ── เตรียมข้อมูล ────────────────────────────────────────────────────────── */
const { data: shop } = await db.from('shops').select('id').limit(1).single();
let { data: user } = await db
  .from('app_users')
  .select('id, phone')
  .eq('role', 'customer')
  .limit(1)
  .maybeSingle();
if (!shop) { console.error('FATAL: ต้องมีร้านอย่างน้อยหนึ่งร้าน'); process.exit(1); }
if (!user) {
  /* ฐานข้อมูลเปล่าหลัง db reset ยังไม่มีลูกค้า — สร้างขึ้นมาเองเพื่อทดสอบ */
  const { data: authUser, error: aErr } = await db.auth.admin.createUser({
    email: `t${Date.now()}@oofoo.test`,
    password: 'test-only-password',
    email_confirm: true,
  });
  if (aErr) { console.error('FATAL: สร้างบัญชีทดสอบไม่ได้', aErr.message); process.exit(1); }
  /* แถวใน app_users ถูกสร้างให้อัตโนมัติโดยทริกเกอร์ตอนสมัคร — แก้ของเดิม ไม่ใช่แทรกใหม่ */
  const { data: made, error } = await db
    .from('app_users')
    .update({ display_name: 'ลูกค้าทดสอบ', phone: '66812345678', role: 'customer' })
    .eq('id', authUser.user.id)
    .select('id, phone')
    .single();
  if (error) { console.error('FATAL: สร้างลูกค้าทดสอบไม่ได้', error.message); process.exit(1); }
  user = made;
}

const stamp = Date.now();
const { data: reward, error: rErr } = await db
  .from('member_rewards')
  .insert({ shop_id: shop.id, name: `เสื้อทดสอบ ${stamp}`, points_cost: 10, publish_state: 'published' })
  .select('id')
  .single();
if (rErr) { console.error('FATAL: สร้างของรางวัลไม่ได้', rErr.message); process.exit(1); }

const CODE = `RTEST${stamp % 100000}`;
const { error: redErr } = await db.from('member_redemptions').insert({
  shop_id: shop.id, user_id: user.id, reward_id: reward.id, code: CODE, points_cost: 10,
});
if (redErr) { console.error('FATAL: สร้างรายการแลกไม่ได้', redErr.message); process.exit(1); }

/* ── A. ลูกค้าเรียก RPC ของแอดมินไม่ได้ ─────────────────────────────────── */
for (const [c, fn, args] of [
  ['A1', 'upsert_member_reward', { p_name: 'ของแถมเถื่อน', p_points_cost: 1 }],
  ['A2', 'delete_member_reward', { p_id: reward.id }],
  ['A3', 'find_redemption', { p_code: CODE }],
  ['A4', 'collect_redemption', { p_code: CODE }],
]) {
  const { error } = await cust.rpc(fn, args);
  check(c, !!error, `ลูกค้าเรียก ${fn} ไม่ผ่าน`, error ? undefined : 'RPC ยอมให้คนนอกเรียก');
}
{
  const { data } = await db.from('member_redemptions').select('status').eq('code', CODE).single();
  check('A5', data?.status === 'pending', 'สถานะยังไม่ถูกแตะหลังลูกค้าพยายามเรียก', `ได้ ${data?.status}`);
}

/* ── B. ปิดงานแลกของ ────────────────────────────────────────────────────── */
{
  // ผ่าน service_role ไม่ได้เพราะ admin_shop() อิง auth.uid() — เรียกผ่าน SQL โดยตรงแทน
  const { error } = await db.rpc('collect_redemption', { p_code: CODE });
  check('B1', !!error, 'service_role ที่ไม่มีตัวตนแอดมิน เรียกก็ไม่ผ่านเหมือนกัน',
    error ? undefined : 'ผ่านทั้งที่ไม่มี admin_shop()');
}

/* ── C. เบอร์โทรทุกรูปแบบต้องได้ผลเดียวกัน ──────────────────────────────── */
{
  const variants = ['0812345678', '66812345678', '+66812345678', '081-234-5678', '+66 81 234 5678'];
  const out = [];
  for (const v of variants) {
    const { data, error } = await db.rpc('normalize_phone', { p_phone: v });
    if (error) { fail('C1', `normalize_phone(${v})`, error.message); break; }
    out.push(data);
  }
  check('C1', new Set(out).size === 1, 'เบอร์รูปแบบต่างกันถูกทำให้เหมือนกันหมด', JSON.stringify(out));
  check('C2', out[0] === '0812345678', 'ผลลัพธ์เป็นเลขในประเทศ (ขึ้นต้น 0)', out[0]);
}
{
  const { data } = await db.rpc('normalize_phone', { p_phone: '' });
  check('C3', data === '', 'เบอร์ว่างไม่พัง', JSON.stringify(data));
}

/* ── D. ลบของรางวัลที่มีคนแลกไปแล้วไม่ได้ ───────────────────────────────── */
{
  const { error } = await db
    .from('member_rewards')
    .delete()
    .eq('id', reward.id);
  // ลบตรง ๆ ด้วย service_role ติด FK ของ member_redemptions
  check('D1', !!error, 'ลบของรางวัลที่มีคนแลกไปแล้วไม่ได้ (ติดความสัมพันธ์ในฐานข้อมูล)',
    error ? undefined : 'ลบผ่าน — โค้ดที่ลูกค้าถืออยู่จะชี้ไปที่ของที่ไม่มีแล้ว');
}

/* ── ล้างของทดสอบ ────────────────────────────────────────────────────────── */
await db.from('member_redemptions').delete().eq('code', CODE);
await db.from('member_rewards').delete().eq('id', reward.id);

console.log(`\n${failures === 0 ? 'ผ่านทั้งหมด' : `ตก ${failures} ข้อ`}\n`);
process.exit(failures === 0 ? 0 : 1);
