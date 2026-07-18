#!/usr/bin/env node
/**
 * 0064/0067 proof — stale prepay orders expire and their stock comes back.
 *
 * Physical-stock model (0067): placement decrements stock_qty and expiry
 * restocks it (reserved_qty stays 0). An abandoned PromptPay checkout holds
 * physical stock nobody can buy; expire_stale_orders cancels those past the
 * payment window and puts the stock back. This drives the real RPC and proves
 * the restock AND — more importantly — the four things it must never touch.
 *
 *   1. stale prepay  → cancelled(payment_timeout), stock_qty restocked +qty,
 *                      an online_expiry_restock ledger row written
 *   2. fresh prepay  → untouched (inside the window)
 *   3. COD           → untouched (COD also sits at awaiting_payment for life;
 *                      only payment_method separates it from a dead prepay)
 *   4. slip attached → untouched (the customer paid)
 *   5. re-run        → idempotent: no double cancel, no double release
 *   6. attach vs expire → ONE outcome, and the loser fails loudly
 *   7. the cutoff follows shop_settings.payment_window_min — the owner's
 *      setting, not a constant in the migration. Same order, only the setting
 *      moves, opposite outcomes.
 *
 * Run (LOCAL Supabase only):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service role> \
 *     node scripts/test-0064-expire-stale-orders.mjs
 *
 * FAILS FAST rather than reporting green on what it did not prove: a missing
 * key is exit 1, not a SKIP with a cheerful summary.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PHONE = process.env.TEST_PHONE ?? '66812345678';
const TEST_OTP = process.env.TEST_OTP ?? '123456';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('FATAL: set SUPABASE_URL and SUPABASE_ANON_KEY (never hardcode prod).');
  process.exit(1);
}
// Not optional. Backdating placed_at and calling the (correctly revoked)
// expiry function both need it, so without it there is no test — say so and
// stop, rather than skipping cases and printing a green summary anyway.
if (!SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is required — every case needs it.');
  console.error('  Get it with: npx supabase status -o env');
  process.exit(1);
}

// Cancels orders and moves stock. Local only, no override flag.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', 'host.docker.internal']);
const host = new URL(SUPABASE_URL).hostname;
if (!LOCAL_HOSTS.has(host)) {
  console.error(`FATAL: refusing to run against non-local host "${host}".`);
  process.exit(1);
}

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => {
  failures++;
  console.log(`  FAIL  [${c}] ${m}`);
  if (d !== undefined) console.log(`        ↳ ${d}`);
};
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let SHOP_ID = null;
let ORIGINAL_WINDOW = null;

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function fillCart(variantId, qty, mode) {
  const c = await supa.rpc('clear_cart');
  if (c.error) throw new Error(`clear_cart: ${c.error.message}`);
  const a = await supa.rpc('add_cart_item', { p_variant_id: variantId, p_qty: qty });
  if (a.error) throw new Error(`add_cart_item: ${a.error.message}`);
  const m = await supa.rpc('set_cart_mode', { p_shop_mode: mode });
  if (m.error) throw new Error(`set_cart_mode: ${m.error.message}`);
}

async function place(addressId, mode, method) {
  const { data, error } = await supa.rpc('place_order', {
    p_idempotency_key: randomUUID(),
    p_shop_mode: mode,
    p_payment_method: method,
    p_address_id: addressId,
  });
  if (error) throw new Error(`place_order(${mode}/${method}): ${error.message}`);
  return data;
}

/** Age an order so it falls outside the payment window. */
async function backdate(orderId, minutes) {
  const when = new Date(Date.now() - minutes * 60_000).toISOString();
  const { error } = await admin.from('orders').update({ placed_at: when }).eq('id', orderId);
  if (error) throw new Error(`backdate: ${error.message}`);
}

/** No argument = the production path: each shop's own payment_window_min. */
async function expire(before) {
  const args = before === undefined ? {} : { p_before: before };
  const { data, error } = await admin.rpc('expire_stale_orders', args);
  if (error) throw new Error(`expire_stale_orders: ${error.message}`);
  return data;
}

/** The owner moving the payment window in the admin. */
async function setPaymentWindow(minutes) {
  const { error } = await admin
    .from('shop_settings')
    .update({ payment_window_min: minutes })
    .eq('shop_id', SHOP_ID);
  if (error) throw new Error(`set payment_window_min: ${error.message}`);
}

async function getOrder(orderId) {
  const { data, error } = await admin
    .from('orders')
    .select('id, order_status, payment_status, payment_method, cancel_reason, terminal_at, row_version')
    .eq('id', orderId)
    .single();
  if (error) throw new Error(`getOrder: ${error.message}`);
  return data;
}

async function reservedQty(variantId) {
  const { data, error } = await admin
    .from('product_variants')
    .select('reserved_qty')
    .eq('id', variantId)
    .single();
  if (error) throw new Error(`reservedQty: ${error.message}`);
  return data.reserved_qty;
}

// Physical-stock model (0067): placement decrements stock_qty; expire restocks
// it. reserved_qty stays 0 throughout.
async function stockQty(variantId) {
  const { data, error } = await admin
    .from('product_variants')
    .select('stock_qty')
    .eq('id', variantId)
    .single();
  if (error) throw new Error(`stockQty: ${error.message}`);
  return data.stock_qty;
}

async function movements(orderId, reason) {
  const { data, error } = await admin
    .from('stock_movements')
    .select('reason, delta_stock, delta_reserved')
    .eq('order_id', orderId)
    .eq('reason', reason);
  if (error) throw new Error(`movements: ${error.message}`);
  return data;
}

/* ── setup ────────────────────────────────────────────────────────────────── */

async function setup() {
  console.log(`\nsetup — ${SUPABASE_URL} (local)`);
  const sent = await supa.auth.signInWithOtp({ phone: TEST_PHONE });
  if (sent.error) throw new Error(`signInWithOtp: ${sent.error.message}`);
  const v = await supa.auth.verifyOtp({ phone: TEST_PHONE, token: TEST_OTP, type: 'sms' });
  if (v.error) throw new Error(`verifyOtp: ${v.error.message}`);
  const uid = v.data.user?.id;

  const g = await supa.rpc('grant_consent', { p_purpose: 'data_processing' });
  if (g.error) throw new Error(`grant_consent: ${g.error.message}`);

  const existing = await supa.from('addresses').select('id').limit(1);
  if (existing.error) throw new Error(`addresses: ${existing.error.message}`);
  let addressId = existing.data[0]?.id;
  if (!addressId) {
    const ins = await supa
      .from('addresses')
      .insert({
        user_id: uid,
        label: '0064 test',
        recipient_name: '0064 Test',
        recipient_phone: '0812345678',
        address_line: '1 expiry test',
        subdistrict: 'ในเมือง',
        district: 'เมือง',
        province: 'ขอนแก่น',
        postal_code: '40000',
        is_default: true,
      })
      .select('id')
      .single();
    if (ins.error) throw new Error(`address insert: ${ins.error.message}`);
    addressId = ins.data.id;
  }

  // Plenty of headroom: this run places several orders against one variant.
  const variant = await supa
    .from('product_variants')
    .select('id, price, available_qty')
    .is('archived_at', null)
    .gt('available_qty', 20)
    .limit(1)
    .single();
  if (variant.error) throw new Error(`variant: ${variant.error.message}`);

  const s = await admin.from('shop_settings').select('shop_id, payment_window_min').limit(1).single();
  if (s.error) throw new Error(`shop_settings: ${s.error.message}`);
  SHOP_ID = s.data.shop_id;
  ORIGINAL_WINDOW = s.data.payment_window_min;

  console.log(`  user ${uid}`);
  console.log(`  variant ${variant.data.id} (available ${variant.data.available_qty})`);
  console.log(`  shop ${SHOP_ID} · payment_window_min = ${ORIGINAL_WINDOW}`);
  return { addressId, variantId: variant.data.id };
}

/* ── cases ────────────────────────────────────────────────────────────────── */

async function main() {
  const { addressId, variantId } = await setup();
  const QTY = 2;

  /* 1 — the whole point: stale prepay is cancelled and the stock comes back
   *     (physical-stock model 0067: place decrements stock, expire restocks it;
   *     reserved_qty stays 0 throughout). */
  console.log('\n[1] stale prepay order → cancelled + physical stock restocked (reserved stays 0)');
  const stockBefore = await stockQty(variantId);
  await fillCart(variantId, QTY, 'online');
  const A = await place(addressId, 'online', 'promptpay_slip');
  const stockHeld = await stockQty(variantId);
  check(1, stockHeld === stockBefore - QTY,
    `placing decrements physical stock (${stockBefore} → ${stockHeld})`);
  check(1, (await reservedQty(variantId)) === 0, 'reserved_qty stays 0 at placement');

  await backdate(A.id, 60); // well past the 30-minute window
  const n = await expire();
  console.log(`      expire_stale_orders() cancelled ${n} order(s)`);

  const a1 = await getOrder(A.id);
  check(1, a1.order_status === 'cancelled', `order is cancelled (${a1.order_status})`);
  check(1, a1.cancel_reason === 'payment_timeout', `reason is payment_timeout (${a1.cancel_reason})`);
  check(1, a1.terminal_at !== null, 'terminal_at is stamped');

  const stockAfter = await stockQty(variantId);
  check(1, stockAfter === stockBefore,
    `stock restocked (${stockHeld} → ${stockAfter}, started ${stockBefore})`);
  check(1, (await reservedQty(variantId)) === 0, 'reserved_qty still 0 after expire');

  const rel = await movements(A.id, 'online_expiry_restock');
  check(1, rel.length > 0, 'an online_expiry_restock movement was written');
  check(1, rel.every((m) => m.delta_stock > 0 && m.delta_reserved === 0),
    'the movement restocks physical stock and leaves reserved at 0',
    JSON.stringify(rel));

  /* 2 — inside the window: hands off. */
  console.log('\n[2] fresh prepay order (inside the window) → untouched');
  await fillCart(variantId, 1, 'online');
  const B = await place(addressId, 'online', 'promptpay_slip');
  await expire();
  const b1 = await getOrder(B.id);
  check(2, b1.order_status === 'placed', `still placed (${b1.order_status})`);
  check(2, b1.terminal_at === null, 'not terminal');

  /* 3 — COD is the dangerous lookalike: same payment_status, must not be hit. */
  console.log('\n[3] COD order, aged past the window → untouched');
  await fillCart(variantId, 1, 'delivery');
  let C = null;
  try {
    C = await place(addressId, 'delivery', 'cod');
  } catch (e) {
    fail(3, 'could not place a COD order to test with', e.message);
  }
  if (C) {
    const codBefore = await getOrder(C.id);
    check(3, codBefore.payment_status === 'awaiting_payment',
      `COD really does sit at awaiting_payment (${codBefore.payment_status}) — this is the trap`);
    await backdate(C.id, 120);
    await expire();
    const c1 = await getOrder(C.id);
    check(3, c1.order_status !== 'cancelled', `COD untouched (${c1.order_status})`);
    check(3, c1.terminal_at === null, 'COD not terminal');

    // The above passes for TWO reasons — COD is 'confirmed', so order_status
    // alone already excluded it, and the case would pass even if the
    // payment_method filter were deleted. Force the one state where only
    // payment_method can save it, so the guard is actually under test.
    console.log(`      (COD lands on order_status=${codBefore.order_status}, so 'placed' already excludes it —`);
    console.log("       forcing it to 'placed' to test the payment_method filter on its own)");
    const forced = await admin
      .from('orders')
      .update({ order_status: 'placed' })
      .eq('id', C.id);
    if (forced.error) {
      fail(3, 'could not force COD to placed to isolate the payment_method guard', forced.error.message);
    } else {
      await expire();
      const c2 = await getOrder(C.id);
      check(3, c2.order_status !== 'cancelled',
        'a COD order sitting at placed/awaiting_payment is STILL untouched (payment_method filter alone)',
        `got ${c2.order_status} — the payment_method predicate is not holding`);
      // Put it back so the rest of the run sees a truthful world.
      await admin.from('orders').update({ order_status: codBefore.order_status }).eq('id', C.id);
    }
  }

  /* 4 — the customer paid: hands off. */
  console.log('\n[4] prepay order with a slip attached, aged → untouched');
  await fillCart(variantId, 1, 'online');
  const D = await place(addressId, 'online', 'promptpay_slip');
  const att = await supa.rpc('attach_payment_slip', {
    p_order_id: D.id,
    p_storage_path: `slips/test-0064-${D.id}.jpg`,
    p_observed_amount: D.total,
  });
  if (att.error) {
    fail(4, 'could not attach a slip to set up this case', att.error.message);
  } else {
    const dBefore = await getOrder(D.id);
    console.log(`      after attach: order_status=${dBefore.order_status} payment_status=${dBefore.payment_status}`);
    await backdate(D.id, 120);
    await expire();
    const d1 = await getOrder(D.id);
    check(4, d1.order_status !== 'cancelled',
      `a paid-and-slipped order is untouched (${d1.order_status})`);
    check(4, d1.terminal_at === null, 'not terminal');
  }

  /* 5 — the job runs every 5 minutes forever; a second pass must be a no-op. */
  console.log('\n[5] re-run → idempotent (no double cancel, no double restock)');
  const rvBefore = (await getOrder(A.id)).row_version;
  const stockPre = await stockQty(variantId);
  const relPre = (await movements(A.id, 'online_expiry_restock')).length;
  const n2 = await expire();
  const a2 = await getOrder(A.id);
  const stockPost = await stockQty(variantId);
  const relPost = (await movements(A.id, 'online_expiry_restock')).length;
  check(5, a2.row_version === rvBefore, `the cancelled order was not written again (row_version ${rvBefore})`);
  check(5, stockPost === stockPre, `stock not restocked twice (${stockPre} → ${stockPost})`);
  check(5, relPost === relPre, `no duplicate online_expiry_restock rows (${relPre})`);
  console.log(`      second pass cancelled ${n2} order(s) — expected 0 for already-expired ones`);

  /* 6 — attach and expire racing for the same order. */
  console.log('\n[6] attach vs expire on the same order → exactly ONE outcome');
  await fillCart(variantId, 1, 'online');
  const E = await place(addressId, 'online', 'promptpay_slip');
  await backdate(E.id, 60);

  // Fire together. Whoever takes the row lock first decides; the point is that
  // the loser is refused, not that a particular side wins.
  const [attachRes, expireRes] = await Promise.allSettled([
    supa.rpc('attach_payment_slip', {
      p_order_id: E.id,
      p_storage_path: `slips/test-0064-race-${E.id}.jpg`,
      p_observed_amount: E.total,
    }),
    expire(),
  ]);
  const attachErr =
    attachRes.status === 'rejected' ? String(attachRes.reason) : attachRes.value?.error?.message ?? null;
  const attachOk = attachRes.status === 'fulfilled' && !attachRes.value?.error;
  const e1 = await getOrder(E.id);
  const cancelled = e1.order_status === 'cancelled';

  console.log(`      attach: ${attachOk ? 'succeeded' : `refused (${attachErr})`}`);
  console.log(`      expire: ${expireRes.status === 'fulfilled' ? `${expireRes.value} cancelled` : 'threw'}`);
  console.log(`      final:  order_status=${e1.order_status} payment_status=${e1.payment_status}`);

  // The invariant: never both. Either the slip landed and the order lives, or
  // the order expired and the slip was refused — never a cancelled order that
  // also accepted a payment.
  check(6, !(cancelled && attachOk),
    'the order was NOT both cancelled and given a slip (one outcome, not two)',
    `cancelled=${cancelled} attachOk=${attachOk}`);
  check(6, cancelled || attachOk, 'exactly one side took effect (not neither)');
  if (cancelled) {
    check(6, !attachOk && !!attachErr,
      `expire won → attach was refused LOUDLY, not silently (${attachErr})`);
  } else {
    check(6, e1.order_status !== 'cancelled', 'attach won → the order survived and was not expired');
  }

  /* 7 — the window is the OWNER'S, not a constant in the migration. */
  console.log("\n[7] payment_window_min drives the cutoff (the owner's setting, not a magic 30)");
  try {
    await setPaymentWindow(30);
    await fillCart(variantId, 1, 'online');
    const F = await place(addressId, 'online', 'promptpay_slip');
    // 10 minutes old: inside a 30-minute window, outside a 5-minute one. The
    // ONLY thing that changes between the two checks below is the setting.
    await backdate(F.id, 10);

    await expire();
    const f30 = await getOrder(F.id);
    check(7, f30.order_status === 'placed',
      `window=30: a 10-minute-old order survives (${f30.order_status})`);

    // The owner shortens the window in the admin.
    await setPaymentWindow(5);
    await expire();
    const f5 = await getOrder(F.id);
    check(7, f5.order_status === 'cancelled',
      `window=5: the SAME order now expires (${f5.order_status}) — the setting drove it`,
      'the cutoff is not reading shop_settings.payment_window_min');
    check(7, f5.cancel_reason === 'payment_timeout', `still payment_timeout (${f5.cancel_reason})`);

    // And a longer window must protect an order the default would have killed.
    await setPaymentWindow(240);
    await fillCart(variantId, 1, 'online');
    const G = await place(addressId, 'online', 'promptpay_slip');
    await backdate(G.id, 60); // would die under the old hardcoded 30
    await expire();
    const g = await getOrder(G.id);
    check(7, g.order_status === 'placed',
      `window=240: a 60-minute-old order is spared (${g.order_status}) — a hardcoded 30 would have cancelled it`);
  } finally {
    if (ORIGINAL_WINDOW !== null) {
      try {
        await setPaymentWindow(ORIGINAL_WINDOW);
        console.log(`      (payment_window_min restored to ${ORIGINAL_WINDOW})`);
      } catch (e) {
        console.error(`      WARNING: could not restore payment_window_min: ${e.message}`);
      }
    }
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  await supa.auth.signOut();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  console.error('(setup problem — nothing was proven; treat as a failure)');
  process.exit(1);
});
