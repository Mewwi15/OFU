#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0092 + 0093 — เรื่องบาร์โค้ด/SKU ซ้ำ
 *
 * ที่มา: เจ้าของแก้บาร์โค้ดแล้วระบบบอก "บาร์โค้ดนี้ถูกใช้แล้ว" แต่หาในหน้าสินค้าไม่เจอ
 * เพราะโค้ดนั้นค้างอยู่กับสินค้า/ขนาดที่เลิกขายแล้ว ซึ่งหน้าสินค้ากรองทิ้ง
 *
 * กติกาใหม่:
 *   - เลิกขายแล้ว = คืนโค้ดให้ใช้ซ้ำได้ (0093) ทั้งดัชนี unique และการเช็คในโค้ด
 *   - ที่ยังใช้อยู่จริง (รวมสินค้าร่าง) = ยังบล็อก แต่ต้องบอกว่าไปซ้ำกับตัวไหน (0092)
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

/** เรียก upsert_variant แล้วคืนผลแทนที่จะโยน — เทสต์นี้สนใจโค้ดกับ detail */
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

  const target = await newProduct(`สินค้าที่จะรับโค้ดต่อ ${STAMP}`);

  /* ── A. เลิกขายทั้งสินค้า → โค้ดต้องว่างให้ใช้ต่อได้ (เคสของเจ้าของ) ──────── */
  console.log('\nA — เลิกขายทั้งสินค้า แล้วเอาบาร์โค้ดไปใช้ต่อ');
  const BC_A = code('A');
  const holderA = await newProduct(`ตัวถือบาร์โค้ด เลิกขาย ${STAMP}`);
  await tryVariant({ p_product_id: holderA, p_price: 10, p_barcode: BC_A });
  const del = await admin.rpc('delete_product', { p_id: holderA });
  check('A1', !del.error, 'เลิกขายสินค้าได้', del.error?.message);

  const vA = (await db.from('product_variants').select('archived_at').eq('product_id', holderA)).data ?? [];
  check('A2', vA.length > 0 && vA.every((v) => v.archived_at), 'เลิกขายสินค้าแล้วขนาดของมันถูกเลิกขายตามด้วย', JSON.stringify(vA));

  const rA = await tryVariant({ p_product_id: target, p_price: 20, p_barcode: BC_A });
  check('A3', rA.ok, 'เอาบาร์โค้ดของสินค้าที่เลิกขายแล้วมาใช้ต่อได้ (ทั้งโค้ดเช็คและดัชนี unique)', `${rA.code} ${rA.detail ?? ''}`);

  /* ── B. เลิกขายเฉพาะ "ขนาด" ทั้งที่สินค้ายังอยู่ → โค้ดต้องว่างเหมือนกัน ──── */
  console.log('\nB — เลิกขายเฉพาะขนาด (สินค้ายังอยู่)');
  const BC_B = code('B');
  const holderB = await newProduct(`สินค้ายังขายอยู่ ขนาดเลิกขาย ${STAMP}`);
  await tryVariant({ p_product_id: holderB, p_price: 30, p_barcode: BC_B, p_size: 'เลิกทำ' });
  await db.from('product_variants').update({ archived_at: new Date().toISOString() }).eq('barcode', BC_B);
  const target2 = await newProduct(`สินค้าที่จะรับโค้ด B ${STAMP}`);
  const rB = await tryVariant({ p_product_id: target2, p_price: 40, p_barcode: BC_B });
  check('B1', rB.ok, 'เอาบาร์โค้ดของขนาดที่เลิกขายมาใช้ต่อได้', `${rB.code} ${rB.detail ?? ''}`);

  /* ── C. ยังขายอยู่จริง (สินค้าร่าง) → ต้องบล็อก และบอกว่าซ้ำกับตัวไหน ────── */
  console.log('\nC — บาร์โค้ดที่ยังถูกใช้อยู่จริง (สินค้าร่าง)');
  const BC_C = code('C');
  const holderC = await newProduct(`สินค้าร่างถือบาร์โค้ด ${STAMP}`);
  await tryVariant({ p_product_id: holderC, p_price: 50, p_barcode: BC_C });
  const target3 = await newProduct(`สินค้าที่จะรับโค้ด C ${STAMP}`);
  const rC = await tryVariant({ p_product_id: target3, p_price: 60, p_barcode: BC_C });
  check('C1', !rC.ok && rC.code === 'DUPLICATE_BARCODE', 'ยังบล็อกบาร์โค้ดที่ของยังใช้อยู่', `${rC.code}`);
  check('C2', !!rC.detail && rC.detail.includes(String(STAMP)), 'ข้อความบอกชื่อสินค้าที่ถือบาร์โค้ดอยู่', rC.detail);
  check('C3', !!rC.detail && rC.detail.includes('ร่าง'), 'ข้อความบอกสถานะว่าเป็นสินค้าร่าง', rC.detail);

  /* ── D. SKU ก็ต้องบอกเจ้าของเหมือนกัน ──────────────────────────────────── */
  console.log('\nD — SKU ซ้ำ');
  const SKU_D = code('D');
  const holderD = await newProduct(`สินค้าถือ SKU ${STAMP}`);
  await tryVariant({ p_product_id: holderD, p_price: 70, p_sku: SKU_D });
  const target4 = await newProduct(`สินค้าที่จะรับ SKU ${STAMP}`);
  const rD = await tryVariant({ p_product_id: target4, p_price: 80, p_sku: SKU_D });
  check('D1', !rD.ok && rD.code === 'DUPLICATE_SKU', 'บล็อก SKU ซ้ำที่ยังใช้อยู่', `${rD.code}`);
  check('D2', !!rD.detail && rD.detail.includes(String(STAMP)), 'ข้อความบอกชื่อสินค้าที่ถือ SKU อยู่', rD.detail);

  /* ── E. แก้แถวตัวเองโดยคงบาร์โค้ดเดิม ต้องไม่ติดว่าซ้ำกับตัวเอง ──────────── */
  console.log('\nE — แก้แถวตัวเอง');
  const BC_E = code('E');
  const holderE = await newProduct(`แก้ตัวเอง ${STAMP}`);
  await tryVariant({ p_product_id: holderE, p_price: 90, p_barcode: BC_E });
  const own = (await db.from('product_variants').select('id').eq('barcode', BC_E).is('archived_at', null).single()).data;
  const rE = await tryVariant({ p_id: own.id, p_product_id: holderE, p_price: 95, p_barcode: BC_E });
  check('E1', rE.ok, 'แก้ราคาโดยคงบาร์โค้ดเดิมไว้ยังทำได้', `${rE.code} ${rE.detail ?? ''}`);

  /* ── F. ประวัติต้องไม่หาย — แถวที่เลิกขายยังอยู่ครบ ─────────────────────── */
  console.log('\nF — แถวที่เลิกขายยังอยู่ ประวัติไม่หาย');
  const kept = (await db.from('product_variants').select('id, barcode').eq('product_id', holderA)).data ?? [];
  check('F1', kept.length > 0, 'แถวของสินค้าที่เลิกขายยังอยู่ในตาราง ไม่ได้ถูกลบทิ้ง', `${kept.length} แถว`);
  check('F2', kept.some((v) => v.barcode === BC_A), 'บาร์โค้ดเดิมยังติดอยู่กับแถวเก่า บิลเก่ายังสาวกลับได้', JSON.stringify(kept));

  /* ── ล้างของที่สร้างไว้ ─────────────────────────────────────────────────── */
  const ids = [holderA, holderB, holderC, holderD, holderE, target, target2, target3, target4];
  await db.from('product_variants').delete().in('product_id', ids);
  await db.from('products').delete().in('id', ids);

  console.log(failures === 0 ? '\nOK — ผ่านทั้งหมด\n' : `\nFAILED — ${failures} ข้อ\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
