#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0096 — ระบบเก็บคูปองเข้าบัญชี
 *
 * สองเรื่องที่ต้องพิสูจน์:
 *   1. เก็บได้จริงและกดซ้ำไม่พัง
 *   2. เก็บ ≠ ได้สิทธิ์ — เก็บโค้ดลับไม่ได้ เก็บของหมดอายุไม่ได้ และการเก็บต้องไม่
 *      ไปแตะโควตาการใช้จริง (ร้านเปิดขายอยู่ พลาดตรงนี้คือเสียเงิน)
 *
 * รัน (เครื่องตัวเองเท่านั้น):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0096-coupon-claims.mjs
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

const STAMP = Date.now();
const code = (tag) => `C${STAMP}${tag}`;

async function listed() {
  const { data, error } = await cust.rpc('list_app_coupons');
  if (error) throw new Error(`list_app_coupons: ${error.message}`);
  return data ?? [];
}
async function claim(id) {
  const { data, error } = await cust.rpc('claim_coupon', { p_promo_id: id });
  if (error) throw new Error(`claim_coupon: ${error.message}`);
  return data ?? {};
}

async function main() {
  console.log(`\nsetup — ${URL} (local)`);
  const shop = (await db.from('shops').select('id').limit(1).single()).data;

  const EMAIL = 'claims@oofoo.local';
  let au = (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === EMAIL);
  if (!au) au = (await db.auth.admin.createUser({ email: EMAIL, password: 'cust1234', email_confirm: true })).data.user;
  else await db.auth.admin.updateUserById(au.id, { password: 'cust1234' });
  await db.from('app_users').upsert(
    { id: au.id, shop_id: shop.id, role: 'customer', account_state: 'active', display_name: 'Claim Tester' },
    { onConflict: 'id' },
  );
  const signIn = await cust.auth.signInWithPassword({ email: EMAIL, password: 'cust1234' });
  if (signIn.error) throw new Error(`customer signIn: ${signIn.error.message}`);
  console.log(`  customer ${au.id}`);

  const addPromo = async (over) => {
    const r = await db.from('promo_codes').insert({
      shop_id: shop.id, type: 'percent', value: 10, min_spend: 0,
      scope: 'subtotal', active: true, visible_in_app: true, ...over,
    }).select('id').single();
    if (r.error) throw new Error(`สร้างคูปอง ${over.code} ไม่สำเร็จ: ${r.error.message}`);
    return r.data;
  };

  /* ── A. เก็บได้ และสถานะเปลี่ยนจริง ─────────────────────────────────── */
  console.log('\nA — เก็บคูปอง');
  const OK = code('OK');
  const okRow = await addPromo({ code: OK });
  let before = (await listed()).find((c) => c.code === OK);
  check('A1', before && before.claimed === false, 'ก่อนเก็บ สถานะเป็นยังไม่เก็บ', JSON.stringify(before));

  const r1 = await claim(okRow.id);
  check('A2', r1.ok === true, 'เก็บสำเร็จ', JSON.stringify(r1));
  let after = (await listed()).find((c) => c.code === OK);
  check('A3', after && after.claimed === true, 'หลังเก็บ สถานะเปลี่ยนเป็นเก็บแล้ว', JSON.stringify(after));

  /* ── B. กดซ้ำต้องไม่พังและไม่เกิดแถวซ้ำ ─────────────────────────────── */
  console.log('\nB — กดซ้ำ');
  const r2 = await claim(okRow.id);
  check('B1', r2.ok === true, 'กดเก็บซ้ำยังตอบสำเร็จ ไม่ error', JSON.stringify(r2));
  /* เช็ค error ด้วย — รอบแรกอ่านไม่ได้เพราะตารางไม่ได้ grant ให้ service_role แล้ว
     .data ?? [] กลืนมันเป็น 0 แถว เทสต์เลยฟ้องว่าไม่มีแถว ทั้งที่จริงเก็บติดแล้ว */
  const claimRows = await db.from('coupon_claims').select('id')
    .eq('promo_code_id', okRow.id).eq('user_id', au.id);
  if (claimRows.error) throw new Error(`อ่าน coupon_claims ไม่ได้: ${claimRows.error.message}`);
  check('B2', claimRows.data.length === 1, 'มีแถวเก็บเพียงแถวเดียว ไม่ซ้ำ', `${claimRows.data.length} แถว`);

  /* ── C. โค้ดลับต้องเก็บไม่ได้ แม้รู้ id ────────────────────────────── */
  console.log('\nC — โค้ดลับต้องเก็บไม่ได้');
  const SECRET = code('SECRET');
  const secretRow = await addPromo({ code: SECRET, visible_in_app: false });
  const rc = await claim(secretRow.id);
  check('C1', rc.ok === false && rc.reason === 'NOT_FOUND', 'เก็บโค้ดที่ไม่ได้เปิดให้เห็นไม่ได้ และตอบเหมือนไม่มีใบนี้', JSON.stringify(rc));
  const sc = await db.from('coupon_claims').select('id').eq('promo_code_id', secretRow.id);
  if (sc.error) throw new Error(`อ่าน coupon_claims ไม่ได้: ${sc.error.message}`);
  const secretClaims = sc.data;
  check('C2', secretClaims.length === 0, 'ไม่มีแถวเก็บของโค้ดลับเกิดขึ้นเลย', `${secretClaims.length} แถว`);

  /* ── D. หมดอายุ / ปิดใช้งาน เก็บไม่ได้ ──────────────────────────────── */
  console.log('\nD — หมดอายุ/ปิดใช้งาน');
  const EXP = code('EXP');
  const expRow = await addPromo({ code: EXP, active_to: new Date(Date.now() - 86400e3).toISOString() });
  const rd = await claim(expRow.id);
  check('D1', rd.ok === false && rd.reason === 'EXPIRED', 'เก็บคูปองหมดอายุไม่ได้', JSON.stringify(rd));

  const OFF = code('OFF');
  const offRow = await addPromo({ code: OFF, active: false });
  const rd2 = await claim(offRow.id);
  check('D2', rd2.ok === false && rd2.reason === 'INACTIVE', 'เก็บคูปองที่ปิดใช้งานไม่ได้', JSON.stringify(rd2));

  /* ── E. ★ เก็บต้องไม่กินโควตาการใช้จริง ★ ───────────────────────────── */
  console.log('\nE — เก็บไม่กินโควตา');
  const QUOTA = code('QUOTA');
  const quotaRow = await addPromo({ code: QUOTA, total_limit: 1 });
  await claim(quotaRow.id);
  const redemptions = (await db.from('promo_redemptions').select('id').eq('promo_code_id', quotaRow.id)).data ?? [];
  check('E1', redemptions.length === 0, 'การเก็บไม่สร้างแถวการใช้ (promo_redemptions) เลย', `${redemptions.length} แถว`);
  const stillListed = (await listed()).find((c) => c.code === QUOTA);
  check('E2', !!stillListed, 'คูปองยังอยู่ในรายการหลังเก็บ (โควตายังไม่ถูกใช้)', JSON.stringify(stillListed));
  const redeemed = (await db.from('promo_codes').select('total_redeemed').eq('id', quotaRow.id).single()).data;
  check('E3', redeemed?.total_redeemed === 0, 'ตัวนับการใช้ยังเป็นศูนย์', JSON.stringify(redeemed));

  /* ── F. โควตาเต็มแล้วเก็บไม่ได้ (เก็บไปก็ใช้ไม่ได้) ─────────────────── */
  console.log('\nF — โควตาเต็มแล้วเก็บไม่ได้');
  const FULL = code('FULL');
  const fullRow = await addPromo({ code: FULL, total_limit: 1 });
  const order = await db.from('orders').insert({
    shop_id: shop.id, customer_user_id: au.id, order_number: `CLM-${STAMP}`,
    shop_mode: 'delivery', payment_method: 'cod',
    subtotal: 100, delivery_fee: 0, discount_amount: 10, total: 90,
    promo_code_id: fullRow.id,
  }).select('id').single();
  if (order.error) throw new Error(`สร้างออเดอร์ทดสอบไม่สำเร็จ: ${order.error.message}`);
  const red = await db.from('promo_redemptions').insert({
    promo_code_id: fullRow.id, user_id: au.id, order_id: order.data.id, amount_discounted: 10,
  });
  if (red.error) throw new Error(`บันทึกการใช้คูปองไม่สำเร็จ: ${red.error.message}`);
  const rf = await claim(fullRow.id);
  check('F1', rf.ok === false && rf.reason === 'USAGE_EXCEEDED', 'โควตาเต็มแล้วเก็บไม่ได้', JSON.stringify(rf));

  /* ── G. ตาราง coupon_claims ปิดจาก client ───────────────────────────── */
  console.log('\nG — ตารางปิดจาก client');
  const { data: direct } = await cust.from('coupon_claims').select('id');
  check('G1', (direct ?? []).length === 0, 'ลูกค้าอ่าน coupon_claims ตรง ๆ ไม่ได้ (ต้องผ่าน RPC)', JSON.stringify(direct));

  /* ── ล้างของที่สร้างไว้ ─────────────────────────────────────────────── */
  const codes = [OK, SECRET, EXP, OFF, QUOTA, FULL];
  const ids = (await db.from('promo_codes').select('id').in('code', codes)).data ?? [];
  const idList = ids.map((r) => r.id);
  await db.from('coupon_claims').delete().in('promo_code_id', idList);
  await db.from('promo_redemptions').delete().in('promo_code_id', idList);
  await db.from('orders').delete().eq('order_number', `CLM-${STAMP}`);
  await db.from('promo_codes').delete().in('code', codes);

  console.log(failures === 0 ? '\nOK — ผ่านทั้งหมด\n' : `\nFAILED — ${failures} ข้อ\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
