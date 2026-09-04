#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0095 — คูปองที่ลูกค้าเห็นได้ในแอป
 *
 * ประเด็นที่ต้องพิสูจน์คือ "ไม่หลุด" เป็นหลัก: โค้ดลับ/ยิงเฉพาะรายต้องไม่โผล่ในแอป
 * เพราะร้านเปิดขายจริง ถ้าหลุดคือเสียเงินจริง
 *
 * รัน (เครื่องตัวเองเท่านั้น — สร้าง/แก้ข้อมูลจริง):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0095-app-coupons.mjs
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
const code = (tag) => `T${STAMP}${tag}`;

/** โค้ดที่แอปมองเห็น ณ ตอนนี้ */
async function visibleCodes() {
  const { data, error } = await cust.rpc('list_app_coupons');
  if (error) throw new Error(`list_app_coupons: ${error.message}`);
  return (data ?? []).map((c) => c.code);
}

async function main() {
  console.log(`\nsetup — ${URL} (local)`);
  const shop = (await db.from('shops').select('id').limit(1).single()).data;

  const EMAIL = 'coupons@oofoo.local';
  let au = (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === EMAIL);
  if (!au) au = (await db.auth.admin.createUser({ email: EMAIL, password: 'cust1234', email_confirm: true })).data.user;
  else await db.auth.admin.updateUserById(au.id, { password: 'cust1234' });
  await db.from('app_users').upsert(
    { id: au.id, shop_id: shop.id, role: 'customer', account_state: 'active', display_name: 'Coupon Tester' },
    { onConflict: 'id' },
  );
  const signIn = await cust.auth.signInWithPassword({ email: EMAIL, password: 'cust1234' });
  if (signIn.error) throw new Error(`customer signIn: ${signIn.error.message}`);
  console.log(`  customer ${au.id}`);

  const mk = (over) => ({
    shop_id: shop.id, type: 'percent', value: 10, min_spend: 0,
    scope: 'subtotal', active: true, visible_in_app: false, ...over,
  });
  /* แทรกแล้วต้องเช็ค error เสมอ — supabase-js ไม่โยน แต่คืน { error } ถ้าปล่อยผ่าน
     แถวที่แทรกไม่ติดจะทำให้เทสต์ "ผ่าน" ทั้งที่ไม่ได้ทดสอบอะไรเลย (เจอมาแล้วในเคส E) */
  const addPromo = async (over) => {
    const r = await db.from('promo_codes').insert(mk(over)).select('id').single();
    if (r.error) throw new Error(`สร้างคูปอง ${over.code} ไม่สำเร็จ: ${r.error.message}`);
    return r.data;
  };

  /* ── A. ค่าตั้งต้นต้องเป็น "ไม่แสดง" ─────────────────────────────────── */
  console.log('\nA — ค่าตั้งต้นต้องปลอดภัย');
  const SECRET = code('SECRET');
  await addPromo({ code: SECRET });
  let seen = await visibleCodes();
  check('A1', !seen.includes(SECRET), 'โค้ดที่ไม่ได้ติ๊ก "แสดงในแอป" ไม่โผล่ (แม้ active อยู่)', SECRET);

  /* ── B. ติ๊กแล้วถึงจะเห็น ────────────────────────────────────────────── */
  console.log('\nB — ติ๊กแล้วเห็น');
  const SHOWN = code('SHOWN');
  await addPromo({ code: SHOWN, visible_in_app: true });
  seen = await visibleCodes();
  check('B1', seen.includes(SHOWN), 'โค้ดที่ติ๊กแสดงในแอปแล้วโผล่จริง', SHOWN);

  /* ── C. ปิดใช้งานแล้วต้องหาย แม้ยังติ๊กแสดงอยู่ ────────────────────── */
  console.log('\nC — ปิดใช้งานต้องหาย');
  const OFF = code('OFF');
  await addPromo({ code: OFF, visible_in_app: true, active: false });
  seen = await visibleCodes();
  check('C1', !seen.includes(OFF), 'โค้ดที่ปิดใช้งานไม่โผล่ แม้ติ๊กแสดงในแอปไว้', OFF);

  /* ── D. หมดอายุ / ยังไม่เริ่ม ต้องไม่โผล่ ───────────────────────────── */
  console.log('\nD — นอกช่วงเวลาต้องไม่โผล่');
  const EXPIRED = code('EXP');
  const FUTURE = code('FUT');
  await addPromo({ code: EXPIRED, active_to: new Date(Date.now() - 86400e3).toISOString(), visible_in_app: true });
  await addPromo({ code: FUTURE, active_from: new Date(Date.now() + 86400e3).toISOString(), visible_in_app: true });
  seen = await visibleCodes();
  check('D1', !seen.includes(EXPIRED), 'โค้ดหมดอายุไม่โผล่', EXPIRED);
  check('D2', !seen.includes(FUTURE), 'โค้ดที่ยังไม่ถึงวันเริ่มไม่โผล่', FUTURE);

  /* ── E. โควตาต่อคนเต็มแล้วต้องไม่โผล่ให้เก้อ ────────────────────────── */
  console.log('\nE — โควตาต่อคนเต็มแล้วไม่โผล่');
  const USED = code('USED');
  const usedRow = await addPromo({ code: USED, visible_in_app: true, per_user_limit: 1 });
  seen = await visibleCodes();
  check('E1', seen.includes(USED), 'ก่อนใช้ ยังเห็นอยู่', USED);

  /* promo_redemptions บังคับให้ผูกกับออเดอร์จริง (order_id not null unique) จะแทรก
     แถวลอย ๆ ไม่ได้ ต้องสร้างออเดอร์ขั้นต่ำให้ผ่าน check (total = subtotal + ค่าส่ง
     - ส่วนลด) ก่อน — เคยแทรกโดยไม่ใส่ order_id แล้วมันเงียบ ทำให้เทสต์ผ่านเป็นเท็จ
     จึงต้องเช็ค error ของทุก insert ในเทสต์นี้ ไม่ปล่อยผ่าน */
  const order = await db.from('orders').insert({
    shop_id: shop.id, customer_user_id: au.id, order_number: `TST-${STAMP}`,
    shop_mode: 'delivery', payment_method: 'cod',
    subtotal: 100, delivery_fee: 0, discount_amount: 10, total: 90,
    promo_code_id: usedRow.id,
  }).select('id').single();
  if (order.error) throw new Error(`สร้างออเดอร์ทดสอบไม่สำเร็จ: ${order.error.message}`);

  const red = await db.from('promo_redemptions').insert({
    promo_code_id: usedRow.id, user_id: au.id,
    order_id: order.data.id, amount_discounted: 10,
  });
  if (red.error) throw new Error(`บันทึกการใช้คูปองไม่สำเร็จ: ${red.error.message}`);
  seen = await visibleCodes();
  check('E2', !seen.includes(USED), 'พอคนนี้ใช้ครบโควตาต่อคนแล้ว หายไปจากรายการ', USED);

  /* ── F. ข้อมูลที่ส่งกลับพอให้แสดงเงื่อนไขได้ครบ ─────────────────────── */
  console.log('\nF — ข้อมูลที่ส่งกลับ');
  const FULL = code('FULL');
  await addPromo({
    code: FULL, visible_in_app: true, type: 'percent', value: 15,
    max_discount: 80, min_spend: 300, scope: 'delivery',
    active_to: new Date(Date.now() + 7 * 86400e3).toISOString(),
  });
  const { data: rows } = await cust.rpc('list_app_coupons');
  const full = (rows ?? []).find((c) => c.code === FULL);
  check('F1', !!full, 'เจอใบที่เพิ่งสร้าง');
  check('F2', full?.value === 15 && full?.max_discount === 80, 'ส่งค่าส่วนลดกับเพดานมาครบ', JSON.stringify(full));
  check('F3', full?.min_spend === 300, 'ส่งยอดขั้นต่ำมาด้วย (RPC ไม่กรองทิ้ง เพราะขึ้นกับตะกร้า)', String(full?.min_spend));
  check('F4', full?.scope === 'delivery' && !!full?.active_to, 'ส่งขอบเขตกับวันหมดอายุมาให้แสดงได้', JSON.stringify(full));

  /* ── G. ลูกค้ายังอ่านตาราง promo_codes ตรง ๆ ไม่ได้เหมือนเดิม ───────── */
  console.log('\nG — ตารางยังปิดอยู่');
  const { data: direct } = await cust.from('promo_codes').select('code');
  check('G1', (direct ?? []).length === 0, 'อ่าน promo_codes ตรง ๆ ยังไม่ได้ (RLS ยังปิดเหมือนเดิม)', JSON.stringify(direct));

  /* ── ล้างของที่สร้างไว้ ─────────────────────────────────────────────── */
  const codes = [SECRET, SHOWN, OFF, EXPIRED, FUTURE, USED, FULL];
  const ids = (await db.from('promo_codes').select('id').in('code', codes)).data ?? [];
  await db.from('promo_redemptions').delete().in('promo_code_id', ids.map((r) => r.id));
  await db.from('orders').delete().eq('order_number', `TST-${STAMP}`);
  await db.from('promo_codes').delete().in('code', codes);

  console.log(failures === 0 ? '\nOK — ผ่านทั้งหมด\n' : `\nFAILED — ${failures} ข้อ\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
