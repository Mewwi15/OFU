#!/usr/bin/env node
/**
 * H1 proof — `place_order` idempotency, driven against the RPC directly.
 *
 * PR #8 makes the checkout screen hold ONE idempotency key across retries so a
 * lost response replays the committed order instead of charging twice. That PR
 * is client-only: it leans entirely on `place_order` already replaying by
 * `orders.idempotency_key`. This script exercises that server contract for real
 * rather than reading it off the migration, which is the blocking review note.
 *
 * Cases:
 *   1. lost response      — same key twice → the SAME order, exactly one row
 *   2. different key      — a fresh key → a genuinely NEW order (not a blind replay)
 *   3. replay, empty cart — same key again once the cart is consumed → still
 *                           replays, never raises EMPTY_CART
 *
 * Run (LOCAL Supabase only):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<local anon> \
 *     node scripts/test-h1-idempotency.mjs
 *
 * It places real orders, so it refuses to run against anything but a local
 * host — the shop is live and this must never touch it.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_PHONE = process.env.TEST_PHONE ?? '66812345678';
const TEST_OTP = process.env.TEST_OTP ?? '123456';

/* ── Safety: local stack only ─────────────────────────────────────────────── */

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('FATAL: set SUPABASE_URL and SUPABASE_ANON_KEY (never hardcode prod).');
  process.exit(1);
}

// This script COMMITS ORDERS and MOVES STOCK. Pointed at the live shop it would
// place real ones, so the host allow-list is a hard gate with no override flag.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', 'host.docker.internal']);
const host = new URL(SUPABASE_URL).hostname;
if (!LOCAL_HOSTS.has(host)) {
  console.error(`FATAL: refusing to run against non-local host "${host}".`);
  console.error('This places real orders. Local Supabase only (npx supabase start).');
  process.exit(1);
}

/* ── Tiny assertion harness ───────────────────────────────────────────────── */

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, detail) => {
  failures++;
  console.log(`  FAIL  [${c}] ${m}`);
  if (detail !== undefined) console.log(`        ↳ ${detail}`);
};
const check = (c, cond, m, detail) => (cond ? pass(c, m) : fail(c, m, detail));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** place_order for one key. Returns {order, error} — never throws, so the
 *  EMPTY_CART case can be asserted on rather than crashing the run. */
async function placeOrder(key, { mode = 'delivery', payment = 'cod', addressId }) {
  const { data, error } = await supa.rpc('place_order', {
    p_idempotency_key: key,
    p_shop_mode: mode,
    p_payment_method: payment,
    p_address_id: addressId,
  });
  return { order: data, error };
}

async function fillCart(variantId, qty = 1) {
  const c = await supa.rpc('clear_cart');
  if (c.error) throw new Error(`clear_cart: ${c.error.message}`);
  const a = await supa.rpc('add_cart_item', { p_variant_id: variantId, p_qty: qty });
  if (a.error) throw new Error(`add_cart_item: ${a.error.message}`);
  const m = await supa.rpc('set_cart_mode', { p_shop_mode: 'delivery' });
  if (m.error) throw new Error(`set_cart_mode: ${m.error.message}`);
}

/** Cart lines visible to this user (RLS scopes to their own cart). */
async function cartLineCount() {
  const { data, error } = await supa.from('cart_items').select('id');
  if (error) throw new Error(`cart_items read: ${error.message}`);
  return data.length;
}

/** Sellable stock for one variant — a replay must not commit it a second time. */
async function availableQty(variantId) {
  const { data, error } = await supa
    .from('product_variants')
    .select('available_qty')
    .eq('id', variantId)
    .single();
  if (error) throw new Error(`variant read: ${error.message}`);
  return data.available_qty;
}

/** Rows actually stored under one idempotency key — the real duplicate check. */
async function ordersForKey(key) {
  const { data, error } = await supa
    .from('orders')
    .select('id, order_number, total')
    .eq('idempotency_key', key);
  if (error) throw new Error(`orders read: ${error.message}`);
  return data;
}

/* ── Setup ────────────────────────────────────────────────────────────────── */

async function setup() {
  console.log(`\nsetup — ${SUPABASE_URL} (local)`);

  // Phone OTP: config.toml's [auth.sms.test_otp] intercepts this number, so no
  // SMS provider is involved. signInWithOtp provisions the user on first run.
  const sent = await supa.auth.signInWithOtp({ phone: TEST_PHONE });
  if (sent.error) throw new Error(`signInWithOtp: ${sent.error.message}`);
  const v = await supa.auth.verifyOtp({ phone: TEST_PHONE, token: TEST_OTP, type: 'sms' });
  if (v.error) throw new Error(`verifyOtp: ${v.error.message}`);
  const uid = v.data.user?.id;
  console.log(`  signed in: ${TEST_PHONE} (${uid})`);

  // place_order gates on PDPA consent before it reaches the cart.
  const g = await supa.rpc('grant_consent', { p_purpose: 'data_processing' });
  if (g.error) throw new Error(`grant_consent: ${g.error.message}`);

  // Reuse an address if the run already made one; place_order needs a real row.
  const existing = await supa.from('addresses').select('id').limit(1);
  if (existing.error) throw new Error(`addresses read: ${existing.error.message}`);
  let addressId = existing.data[0]?.id;
  if (!addressId) {
    const ins = await supa
      .from('addresses')
      .insert({
        user_id: uid,
        label: 'H1 test',
        recipient_name: 'H1 Test',
        recipient_phone: '0812345678',
        address_line: '1 H1 idempotency test',
        is_default: true,
      })
      .select('id')
      .single();
    if (ins.error) throw new Error(`address insert: ${ins.error.message}`);
    addressId = ins.data.id;
  }
  console.log(`  address:   ${addressId}`);

  // Any in-stock variant; qty 1 keeps the run cheap against seeded stock.
  const variant = await supa
    .from('product_variants')
    .select('id, price, available_qty')
    .is('archived_at', null)
    .gt('available_qty', 5)
    .limit(1)
    .single();
  if (variant.error) throw new Error(`variant read: ${variant.error.message}`);
  console.log(`  variant:   ${variant.data.id} (stock ${variant.data.available_qty})`);

  return { addressId, variantId: variant.data.id };
}

/* ── Cases ────────────────────────────────────────────────────────────────── */

async function main() {
  const { addressId, variantId } = await setup();

  const KEY = randomUUID();
  const KEY2 = randomUUID();

  /* 1 — lost response: server committed, client never heard back, user retaps. */
  console.log('\n[1] lost response — same key twice must return the same order');
  await fillCart(variantId);
  const stockBefore = await availableQty(variantId);
  const first = await placeOrder(KEY, { addressId });
  if (first.error) {
    fail(1, 'first place_order succeeded', first.error.message);
    console.log('\nsetup could not place a baseline order — aborting.');
    process.exit(1);
  }
  const A = first.order;
  console.log(`      order A: ${A.order_number} (${A.id})`);
  const stockAfterFirst = await availableQty(variantId);

  // The retry: identical key, exactly what PR #8 makes the client send.
  const retry = await placeOrder(KEY, { addressId });
  if (retry.error) {
    fail(1, 'retry with same key replays instead of erroring', retry.error.message);
  } else {
    const B = retry.order;
    console.log(`      order B: ${B.order_number} (${B.id})`);
    check(1, B.id === A.id, 'retry returns the SAME order id', `A=${A.id} B=${B.id}`);
    check(1, B.order_number === A.order_number, 'retry returns the SAME order_number',
      `A=${A.order_number} B=${B.order_number}`);
  }
  const rows = await ordersForKey(KEY);
  check(1, rows.length === 1, `orders has exactly ONE row for this key (got ${rows.length})`,
    rows.map((r) => r.order_number).join(', '));

  // A replay that quietly committed stock again would be the same double-charge
  // wearing a different hat: one order, but two units gone from the shelf.
  const stockAfterRetry = await availableQty(variantId);
  check(1, stockAfterFirst === stockBefore - 1,
    `the order committed stock once (${stockBefore} → ${stockAfterFirst})`);
  check(1, stockAfterRetry === stockAfterFirst,
    `the replay did NOT commit stock again (${stockAfterFirst} → ${stockAfterRetry})`);

  /* 3 — the cart is consumed by now; the same key must still replay. Asserted
   * here (before case 2 refills) so "cart is empty" is unambiguous. */
  console.log('\n[3] replay after the cart is empty — must NOT raise EMPTY_CART');
  const lines = await cartLineCount();
  check(3, lines === 0, `cart is actually empty after the order (${lines} lines)`);
  const afterEmpty = await placeOrder(KEY, { addressId });
  if (afterEmpty.error) {
    fail(3, 'replay works with an empty cart', `raised: ${afterEmpty.error.message}`);
  } else {
    pass(3, 'replay works with an empty cart (no EMPTY_CART)');
    check(3, afterEmpty.order.id === A.id, 'still returns the original order',
      `expected ${A.id}, got ${afterEmpty.order.id}`);
  }

  /* 2 — a different key is a different order (proves it isn't replaying blindly). */
  console.log('\n[2] different key — must create a NEW order');
  await fillCart(variantId);
  const second = await placeOrder(KEY2, { addressId });
  if (second.error) {
    fail(2, 'place_order with a new key succeeded', second.error.message);
  } else {
    const C = second.order;
    console.log(`      order C: ${C.order_number} (${C.id})`);
    check(2, C.id !== A.id, 'new key yields a DIFFERENT order id', `A=${A.id} C=${C.id}`);
    check(2, C.order_number !== A.order_number, 'new key yields a different order_number');
    const rows2 = await ordersForKey(KEY2);
    check(2, rows2.length === 1, `orders has exactly ONE row for the new key (got ${rows2.length})`);
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  await supa.auth.signOut();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  console.error('(setup problem, not necessarily an H1 failure — see message above)');
  process.exit(1);
});
