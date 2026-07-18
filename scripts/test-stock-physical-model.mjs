#!/usr/bin/env node
/**
 * Proof for the "sell by physical stock" model (migrations 0065/0066).
 *
 * stock_qty is the single source of truth; reserved_qty is forced to 0.
 * Placement (online + COD) decrements stock immediately; approval moves no
 * stock; a rejected slip / cancel / expiry restocks it once. This drives the
 * real RPCs on a local stack and reads stock straight from the DB.
 *
 * Run (LOCAL only — places real orders and moves stock):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-stock-physical-model.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PHONE = '66812345678';
const OTP = '123456';

if (!URL || !ANON) { console.error('FATAL: SUPABASE_URL and SUPABASE_ANON_KEY required.'); process.exit(1); }
if (!SERVICE) { console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY required — DB reads are the proof.'); process.exit(1); }
const LOCAL = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
const hostOf = (u) => { try { return new globalThis.URL(u).hostname; } catch { return ''; } };
if (!LOCAL.has(hostOf(URL))) { console.error(`FATAL: refusing non-local host in ${URL}.`); process.exit(1); }

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => { failures++; console.log(`  FAIL  [${c}] ${m}`); if (d !== undefined) console.log(`        ↳ ${d}`); };
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const cust = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function stockOf(variantId) {
  const { data, error } = await db.from('product_variants').select('stock_qty, reserved_qty, available_qty').eq('id', variantId).single();
  if (error) throw new Error(`stockOf: ${error.message}`);
  return data;
}
async function setStock(variantId, qty) {
  const { error } = await db.from('product_variants').update({ stock_qty: qty }).eq('id', variantId);
  if (error) throw new Error(`setStock: ${error.message}`);
}
async function clearCart(client) { const { error } = await client.rpc('clear_cart'); if (error) throw new Error(`clear_cart: ${error.message}`); }
async function addItem(client, variantId, qty) { const { error } = await client.rpc('add_cart_item', { p_variant_id: variantId, p_qty: qty }); if (error) throw new Error(`add_cart_item: ${error.message}`); }
async function setMode(client, mode) { const { error } = await client.rpc('set_cart_mode', { p_shop_mode: mode }); if (error) throw new Error(`set_cart_mode: ${error.message}`); }

async function place(client, { key = randomUUID(), mode, method, address }) {
  const { data, error } = await client.rpc('place_order', {
    p_idempotency_key: key, p_shop_mode: mode, p_payment_method: method, p_address_id: address,
  });
  return { data, error, key };
}

async function main() {
  console.log(`\nsetup — ${URL} (local)`);
  // Customer session (test phone → test_otp).
  await cust.auth.signInWithOtp({ phone: PHONE });
  const v = await cust.auth.verifyOtp({ phone: PHONE, token: OTP, type: 'sms' });
  if (v.error) throw new Error(`customer signIn: ${v.error.message}`);
  const uid = v.data.user.id;
  await cust.rpc('grant_consent', { p_purpose: 'data_processing' });

  // Make the same user an admin session too (for approve/reject) via a second client.
  const shop = (await db.from('shops').select('id').limit(1).single()).data;
  // A separate admin account so customer stays a customer.
  const ADMIN_EMAIL = 'stockadmin@oofoo.local';
  let au = (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === ADMIN_EMAIL);
  if (!au) au = (await db.auth.admin.createUser({ email: ADMIN_EMAIL, password: 'admin1234', email_confirm: true })).data.user;
  else await db.auth.admin.updateUserById(au.id, { password: 'admin1234' });
  await db.from('app_users').upsert({ id: au.id, shop_id: shop.id, role: 'admin', admin_tier: 'owner', account_state: 'active', display_name: 'Stock Admin' }, { onConflict: 'id' });
  await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: 'admin1234' });

  // Address for the customer.
  let addr = (await cust.from('addresses').select('id').limit(1)).data?.[0]?.id;
  if (!addr) {
    addr = (await cust.from('addresses').insert({ user_id: uid, label: 'test', recipient_name: 'T', recipient_phone: '0812345678', address_line: '1', subdistrict: 'ในเมือง', district: 'เมือง', province: 'ขอนแก่น', postal_code: '40000', is_default: true }).select('id').single()).data.id;
  }

  // A variant with a known name to place against (online prepay).
  const variant = (await db.from('product_variants').select('id, price, products(name)').is('archived_at', null).gt('stock_qty', 0).order('id').limit(1).single()).data;
  const NAME = variant.products.name;
  console.log(`  variant ${variant.id} "${NAME}"`);

  /* 1 — online placement decrements stock immediately; reserved stays 0. */
  console.log('\n[1] online place → stock_qty decremented at placement, reserved 0');
  await setStock(variant.id, 5);
  const before = await stockOf(variant.id);
  await clearCart(cust); await addItem(cust, variant.id, 2); await setMode(cust, 'online');
  const p1 = await place(cust, { mode: 'online', method: 'promptpay_slip', address: addr });
  if (p1.error) { fail(1, 'online place succeeded', p1.error.message); throw new Error('cannot continue'); }
  const after = await stockOf(variant.id);
  check(1, after.stock_qty === before.stock_qty - 2, `stock 5 → ${after.stock_qty} (−2 at placement)`);
  check(1, after.reserved_qty === 0, `reserved stays 0 (${after.reserved_qty})`);
  check(1, after.available_qty === after.stock_qty, `available == stock (${after.available_qty})`);
  const orderA = p1.data.id;

  /* 2 — place until 0, then OUT_OF_STOCK with the M10 detail (name + remaining). */
  console.log('\n[2] place down to 0 → next place is OUT_OF_STOCK with name + remaining');
  await setStock(variant.id, 1);
  await clearCart(cust); await addItem(cust, variant.id, 2); await setMode(cust, 'online');
  const oos = await place(cust, { mode: 'online', method: 'promptpay_slip', address: addr });
  check(2, oos.error?.message === 'OUT_OF_STOCK', `raised OUT_OF_STOCK (${oos.error?.message})`);
  let detail = null;
  try { detail = JSON.parse(oos.error?.details ?? oos.error?.detail ?? 'null'); } catch { /* */ }
  check(2, detail?.code === 'OUT_OF_STOCK' && detail?.version === 1, 'detail is versioned JSON');
  const item = detail?.items?.[0];
  check(2, item?.name === NAME, `detail carries the product name (${item?.name})`);
  check(2, item?.available_qty === 1 && item?.requested_qty === 2, `detail: available 1, requested 2 (${item?.available_qty}/${item?.requested_qty})`);
  check(2, (await stockOf(variant.id)).stock_qty === 1, 'the failed order did NOT move stock (still 1)');

  /* 3 — idempotency: same key twice → one order, one decrement. */
  console.log('\n[3] idempotency: same key twice → one order, decremented once');
  await setStock(variant.id, 5);
  const key = randomUUID();
  await clearCart(cust); await addItem(cust, variant.id, 2); await setMode(cust, 'online');
  const r1 = await place(cust, { key, mode: 'online', method: 'promptpay_slip', address: addr });
  const s1 = await stockOf(variant.id);
  const r2 = await place(cust, { key, mode: 'online', method: 'promptpay_slip', address: addr });
  const s2 = await stockOf(variant.id);
  check(3, r1.data?.id === r2.data?.id, `same order id on replay (${r1.data?.id === r2.data?.id})`);
  check(3, s1.stock_qty === 3 && s2.stock_qty === 3, `decremented once only (5 → ${s1.stock_qty} → ${s2.stock_qty})`);

  /* 4 — cancel restocks once; second cancel is ALREADY_TERMINAL (no double restock). */
  console.log('\n[4] cancel restocks once; cancel again → ALREADY_TERMINAL, no double restock');
  const beforeCancel = (await stockOf(variant.id)).stock_qty;
  const orderNumberA = p1.data.order_number;
  const c1 = await cust.rpc('cancel_order', { p_order_id: orderA, p_reason: 'customer_request' });
  check(4, !c1.error, `cancel succeeded (${c1.error?.message ?? 'ok'})`);
  const afterCancel = (await stockOf(variant.id)).stock_qty;
  check(4, afterCancel === beforeCancel + 2, `restocked +2 (${beforeCancel} → ${afterCancel})`);
  const c2 = await cust.rpc('cancel_order', { p_order_id: orderA, p_reason: 'customer_request' });
  check(4, c2.error?.message === 'ALREADY_TERMINAL', `second cancel rejected (${c2.error?.message})`);
  check(4, (await stockOf(variant.id)).stock_qty === afterCancel, 'stock unchanged by the second cancel (no double restock)');

  /* 5 — approve moves NO stock; 6 — reject restocks. Needs the slip flow. */
  console.log('\n[5/6] approve moves no stock · reject restocks');
  await setStock(variant.id, 5);
  await clearCart(cust); await addItem(cust, variant.id, 1); await setMode(cust, 'online');
  const pB = await place(cust, { mode: 'online', method: 'promptpay_slip', address: addr });
  const afterPlaceB = (await stockOf(variant.id)).stock_qty; // 4
  // Attach a slip so payment_status → slip_uploaded, then move to verifying.
  await cust.rpc('attach_payment_slip', { p_order_id: pB.data.id, p_storage_path: `slips/t-${pB.data.id}.jpg`, p_observed_amount: pB.data.total });
  // Admin claims the slip (→ verifying) then approves.
  const claim = await admin.rpc('claim_slip', { p_order_id: pB.data.id });
  if (claim.error) { fail('5', 'claim_slip', claim.error.message); }
  const ap = await admin.rpc('approve_slip', { p_order_id: pB.data.id });
  check(5, !ap.error, `approve_slip ok (${ap.error?.message ?? 'ok'})`);
  check(5, (await stockOf(variant.id)).stock_qty === afterPlaceB, `approve moved NO stock (still ${afterPlaceB})`);

  await setStock(variant.id, 5);
  await clearCart(cust); await addItem(cust, variant.id, 1); await setMode(cust, 'online');
  const pC = await place(cust, { mode: 'online', method: 'promptpay_slip', address: addr });
  const afterPlaceC = (await stockOf(variant.id)).stock_qty; // 4
  await cust.rpc('attach_payment_slip', { p_order_id: pC.data.id, p_storage_path: `slips/t-${pC.data.id}.jpg`, p_observed_amount: pC.data.total });
  await admin.rpc('claim_slip', { p_order_id: pC.data.id });
  const rej = await admin.rpc('reject_slip', { p_order_id: pC.data.id, p_reason: 'amount_mismatch' });
  check(6, !rej.error, `reject_slip ok (${rej.error?.message ?? 'ok'})`);
  check(6, (await stockOf(variant.id)).stock_qty === afterPlaceC + 1, `reject restocked +1 (${afterPlaceC} → ${afterPlaceC + 1})`);

  /* 7 — COD decrements and auto-confirms. */
  console.log('\n[7] COD place → decrements + auto-confirms');
  await setStock(variant.id, 5);
  await clearCart(cust); await addItem(cust, variant.id, 1); await setMode(cust, 'delivery');
  const cod = await place(cust, { mode: 'delivery', method: 'cod', address: addr });
  check(7, !cod.error && cod.data?.order_status === 'confirmed', `COD auto-confirmed (${cod.data?.order_status ?? cod.error?.message})`);
  check(7, (await stockOf(variant.id)).stock_qty === 4, `COD decremented stock (5 → 4)`);

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  await cust.auth.signOut(); await admin.auth.signOut();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(`\nFATAL: ${e.message}`); process.exit(1); });
