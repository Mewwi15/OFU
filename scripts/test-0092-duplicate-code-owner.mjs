#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0092 — บาร์โค้ด/SKU ซ้ำต้องบอกว่าไปซ้ำกับตัวไหน
 *
 * ที่มา: เจ้าของแก้บาร์โค้ดแล้วระบบบอก "บาร์โค้ดนี้ถูกใช้แล้ว" แต่หาในหน้าสินค้าไม่เจอ
 * เพราะตัวที่ถือบาร์โค้ดอยู่เป็นสินค้า/ขนาดที่เลิกขายแล้ว ซึ่งหน้าสินค้ากรองทิ้ง
 * เทสต์นี้จำลองทั้งสามสถานะที่หาไม่เจอหรือหายาก แล้วเช็คว่า detail บอกชื่อ+สถานะจริง
 *
 * รัน (เครื่องตัวเองเท่านั้น — สร้าง/แก้ข้อมูลจริง):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0092-duplicate-code-owner.mjs
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
const admin = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const STAMP = Date.now();
const code = (tag) => `T${STAMP}${tag}`;

/** เรียก upsert_variant แล้วคืน { ok, code, detail } แทนที่จะโยน */
async function tryVariant(args) {
  const { error } = await admin.rpc('upsert_variant', args);
  if (!error) return { ok: true };
  return { ok: false, code: error.message, detail: error.details ?? null };
}

async function newProduct(name) {
  const { data, error } = await admin.rpc('upsert_product', { p_name: name });
  if (error) throw new Error(`upsert_product ${name}: ${error.message}`);
  return data.id;
}

async function main() {
  console.log(`\nsetup — ${URL} (local)`);
  const shop = (await db.from('shops').select('id').limit(1).single()).data;
  const EMAIL = 'dupcode@oofoo.local';
  let au = (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === EMAIL);
  if (!au) au = (await db.auth.admin.createUser({ email: EMAIL, password: 'admin1234', email_confirm: true })).data.user;
  else await db.auth.admin.updateUserById(au.id, { password: 'admin1234' });
  await db.from('app_users').upsert(
    { id: au.id, shop_id: shop.id, role: 'admin', admin_tier: 'owner', account_state: 'active', display_name: 'Dup Code' },
    { onConflict: 'id' },
  );
  const signIn = await admin.auth.signInWithPassword({ email: EMAIL, password: 'admin1234' });
  if (signIn.error) throw new Error(`admin signIn: ${signIn.error.message}`);
  console.log(`  admin ${au.id}`);

  /* ── A. บาร์โค้ดค้างกับสินค้าที่เลิกขายแล้ว (เคสของเจ้าของ) ─────────────────── */
  console.log('\nA — บาร์โค้ดค้างกับสินค้าที่เลิกขายแล้ว');
  const BC_A = code('A');
  const holderA = await newProduct(`ตัวถือบาร์โค้ด เลิกขาย ${STAMP}`);
  await tryVariant({ p_product_id: holderA, p_price: 10, p_barcode: BC_A });
  await db.from('products').update({ archived_at: new Date().toISOString() }).eq('id', holderA);

  const seen = await admin
    .from('products')
    .select('id')
    .eq('id', holderA)
    .is('archived_at', null);
  check('A1', (seen.data ?? []).length === 0, 'ตัวที่ถือบาร์โค้ดหายไปจากรายการที่หน้าสินค้าดึง (กรอง archived_at)');

  const other = await newProduct(`สินค้าที่จะแก้บาร์โค้ด ${STAMP}`);
  const rA = await tryVariant({ p_product_id: other, p_price: 20, p_barcode: BC_A });
  check('A2', !rA.ok && rA.code === 'DUPLICATE_BARCODE', 'ยังบล็อกบาร์โค้ดซ้ำเหมือนเดิม', `${rA.code}`);
  check('A3', !!rA.detail && rA.detail.includes('เลิกขาย'), 'ข้อความบอกว่าตัวที่ถืออยู่เลิกขายแล้ว', rA.detail);
  check('A4', !!rA.detail && rA.detail.includes(String(STAMP)), 'ข้อความบอกชื่อสินค้าที่ถือบาร์โค้ดอยู่', rA.detail);

  /* ── B. บาร์โค้ดค้างกับ "ขนาด" ที่เลิกขาย ทั้งที่สินค้ายังขายอยู่ ───────────── */
  console.log('\nB — บาร์โค้ดค้างกับขนาดที่เลิกขาย (สินค้ายังอยู่)');
  const BC_B = code('B');
  const holderB = await newProduct(`สินค้ายังขายอยู่ ขนาดเลิกขาย ${STAMP}`);
  await tryVariant({ p_product_id: holderB, p_price: 30, p_barcode: BC_B, p_size: 'เลิกทำ' });
  await db
    .from('product_variants')
    .update({ archived_at: new Date().toISOString() })
    .eq('barcode', BC_B);
  const rB = await tryVariant({ p_product_id: other, p_price: 40, p_barcode: BC_B });
  check('B1', !rB.ok && rB.code === 'DUPLICATE_BARCODE', 'บล็อกบาร์โค้ดที่ค้างกับขนาดที่เลิกขาย', `${rB.code}`);
  check('B2', !!rB.detail && rB.detail.includes('ขนาดนี้เลิกขายแล้ว'), 'ข้อความชี้ว่าเป็นขนาดที่เลิกขาย ไม่ใช่ทั้งสินค้า', rB.detail);
  check('B3', !!rB.detail && rB.detail.includes('เลิกทำ'), 'ข้อความบอกชื่อขนาดด้วย จะได้รู้ว่าแถวไหน', rB.detail);

  /* ── C. สินค้าร่าง — เห็นในหน้าสินค้าได้ แต่ต้องบอกสถานะให้ชัด ───────────── */
  console.log('\nC — บาร์โค้ดค้างกับสินค้าร่าง');
  const BC_C = code('C');
  const holderC = await newProduct(`สินค้าร่างถือบาร์โค้ด ${STAMP}`);
  await tryVariant({ p_product_id: holderC, p_price: 50, p_barcode: BC_C });
  const rC = await tryVariant({ p_product_id: other, p_price: 60, p_barcode: BC_C });
  check('C1', !rC.ok && rC.code === 'DUPLICATE_BARCODE', 'บล็อกบาร์โค้ดที่ค้างกับสินค้าร่าง', `${rC.code}`);
  check('C2', !!rC.detail && rC.detail.includes('ร่าง'), 'ข้อความบอกว่าเป็นสินค้าร่าง', rC.detail);

  /* ── D. SKU ก็ต้องบอกเจ้าของเหมือนกัน ──────────────────────────────────── */
  console.log('\nD — SKU ซ้ำ');
  const SKU_D = code('D');
  const holderD = await newProduct(`สินค้าถือ SKU ${STAMP}`);
  await tryVariant({ p_product_id: holderD, p_price: 70, p_sku: SKU_D });
  const rD = await tryVariant({ p_product_id: other, p_price: 80, p_sku: SKU_D });
  check('D1', !rD.ok && rD.code === 'DUPLICATE_SKU', 'บล็อก SKU ซ้ำ', `${rD.code}`);
  check('D2', !!rD.detail && rD.detail.includes(String(STAMP)), 'ข้อความบอกชื่อสินค้าที่ถือ SKU อยู่', rD.detail);

  /* ── E. แก้ของตัวเองโดยไม่เปลี่ยนบาร์โค้ด ต้องไม่โดนบล็อก ─────────────────── */
  console.log('\nE — แก้แถวตัวเองต้องไม่ติดว่าซ้ำกับตัวเอง');
  const BC_E = code('E');
  const holderE = await newProduct(`แก้ตัวเอง ${STAMP}`);
  await tryVariant({ p_product_id: holderE, p_price: 90, p_barcode: BC_E });
  const own = (await db.from('product_variants').select('id').eq('barcode', BC_E).single()).data;
  const rE = await tryVariant({ p_id: own.id, p_product_id: holderE, p_price: 95, p_barcode: BC_E });
  check('E1', rE.ok, 'แก้ราคาโดยคงบาร์โค้ดเดิมไว้ยังทำได้', `${rE.code} ${rE.detail ?? ''}`);

  /* ── ล้างของที่สร้างไว้ ─────────────────────────────────────────────────── */
  const ids = [holderA, holderB, holderC, holderD, holderE, other];
  await db.from('product_variants').delete().in('product_id', ids);
  await db.from('products').delete().in('id', ids);

  console.log(failures === 0 ? '\nOK — ผ่านทั้งหมด\n' : `\nFAILED — ${failures} ข้อ\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
