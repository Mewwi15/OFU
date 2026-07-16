#!/usr/bin/env node
/**
 * H2 + M1 proof — the money on screen must be the server's, not ours.
 *
 * The PR makes the PromptPay QR render from `PlacedOrder.total`. That is only
 * worth anything if `place_order` really does re-price against live state, so
 * this drives the RPC and proves the two drifts the client cannot see:
 *
 *   H2 — a promo priced at apply time goes stale when the basket moves, and a
 *        cart that drops under min_spend must FAIL rather than quietly charge
 *        a frozen discount (an error before any QR is drawn).
 *   M1 — `FLASH_FEE` is a client constant; the owner edits the real fee in
 *        shop_settings.online_fee and place_order charges from there. The day
 *        those diverge, anything the client computes is wrong.
 *
 * The client constant is parsed out of store/mode.ts rather than retyped here,
 * so this compares against what the app would genuinely have shown.
 *
 * Run (LOCAL Supabase only):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<local anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role> \
 *     node scripts/test-h2-m1-server-total.mjs
 *
 * The service-role key is only used to move shop settings / seed a promo — the
 * things an owner would change in the admin. Without it those cases SKIP loudly
 * rather than pretend to pass.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PHONE = process.env.TEST_PHONE ?? '66812345678';
const TEST_OTP = process.env.TEST_OTP ?? '123456';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('FATAL: set SUPABASE_URL and SUPABASE_ANON_KEY (never hardcode prod).');
  process.exit(1);
}
// The fee/promo cases ARE this test — without them it proves nothing about H2
// or M1. Stop here rather than run a rump of it and report success.
if (!SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is required — the M1 fee case and');
  console.error('the H2 min-spend case both need it, and they are the whole point.');
  console.error('  Get it with: npx supabase status -o env');
  process.exit(1);
}

// Places real orders and edits shop settings. Local only, no override flag.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', 'host.docker.internal']);
const host = new URL(SUPABASE_URL).hostname;
if (!LOCAL_HOSTS.has(host)) {
  console.error(`FATAL: refusing to run against non-local host "${host}".`);
  process.exit(1);
}

let failures = 0;
let skipped = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => {
  failures++;
  console.log(`  FAIL  [${c}] ${m}`);
  if (d !== undefined) console.log(`        ↳ ${d}`);
};
/** A skipped case is an UNPROVEN case. It must never read as green — this
 *  previously logged and moved on, so a run with no service key skipped the
 *  only two cases that matter and still printed ALL PASS + exit 0. */
const skip = (c, m) => {
  skipped++;
  console.log(`  SKIP  [${c}] ${m}`);
};
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

/** The fee the CLIENT would have used — read from the real source, not retyped. */
function clientFlashFee() {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'store', 'mode.ts'), 'utf8');
  const m = src.match(/export const FLASH_FEE\s*=\s*(\d+)/);
  if (!m) throw new Error('could not parse FLASH_FEE from store/mode.ts');
  return Number(m[1]);
}

async function placeOrder(key, addressId, promoCode) {
  const { data, error } = await supa.rpc('place_order', {
    p_idempotency_key: key,
    p_shop_mode: 'online',
    p_payment_method: 'promptpay_slip',
    p_address_id: addressId,
    p_promo_code: promoCode ?? undefined,
  });
  return { order: data, error };
}

async function fillCart(variantId, qty) {
  const c = await supa.rpc('clear_cart');
  if (c.error) throw new Error(`clear_cart: ${c.error.message}`);
  const a = await supa.rpc('add_cart_item', { p_variant_id: variantId, p_qty: qty });
  if (a.error) throw new Error(`add_cart_item: ${a.error.message}`);
  const m = await supa.rpc('set_cart_mode', { p_shop_mode: 'online' });
  if (m.error) throw new Error(`set_cart_mode: ${m.error.message}`);
}

async function setOnlineFee(fee) {
  const { error } = await admin
    .from('shop_settings')
    .update({ online_fee: fee })
    .eq('shop_id', SHOP_ID);
  if (error) throw new Error(`online_fee update: ${error.message}`);
}

let SHOP_ID = null;

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
        label: 'H2 test',
        recipient_name: 'H2 Test',
        recipient_phone: '0812345678',
        address_line: '1 server-total test',
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

  const variant = await supa
    .from('product_variants')
    .select('id, price, available_qty')
    .is('archived_at', null)
    .gt('available_qty', 20)
    .order('price', { ascending: true })
    .limit(1)
    .single();
  if (variant.error) throw new Error(`variant: ${variant.error.message}`);

  if (admin) {
    const s = await admin.from('shop_settings').select('shop_id, online_fee').limit(1).single();
    if (s.error) throw new Error(`shop_settings: ${s.error.message}`);
    SHOP_ID = s.data.shop_id;
  }

  console.log(`  user ${uid}`);
  console.log(`  variant ${variant.data.id} @ ${variant.data.price} (stock ${variant.data.available_qty})`);
  return { addressId, variantId: variant.data.id, price: variant.data.price };
}

async function main() {
  const { addressId, variantId, price } = await setup();
  const CLIENT_FEE = clientFlashFee();
  console.log(`  client FLASH_FEE (store/mode.ts) = ${CLIENT_FEE}`);

  let originalFee = null;
  let promoCode = null;

  try {
    /* ── 1. the order's total is the server's arithmetic ─────────────────── */
    console.log('\n[1] order.total comes from the server, and the QR renders THAT');
    await fillCart(variantId, 2);
    const r1 = await placeOrder(randomUUID(), addressId);
    if (r1.error) {
      fail(1, 'baseline online order placed', r1.error.message);
      throw new Error('cannot continue without a baseline order');
    }
    const expectedSubtotal = price * 2;
    check(1, r1.order.subtotal === expectedSubtotal,
      `subtotal is the server's (${r1.order.subtotal})`, `expected ${expectedSubtotal}`);
    check(1, r1.order.total === r1.order.subtotal + r1.order.delivery_fee - r1.order.discount_amount,
      `total = subtotal + fee - discount (${r1.order.total})`);
    console.log(`      server fee: ${r1.order.delivery_fee} · client would say: ${CLIENT_FEE}`);

    /* ── 2. M1: owner edits the fee → the client constant is instantly wrong ─ */
    console.log('\n[2] M1 — owner changes online_fee; the charged amount follows the SERVER');
    if (!admin) {
      skip(2, 'no SUPABASE_SERVICE_ROLE_KEY — cannot edit shop_settings (NOT proven)');
    } else {
      const cur = await admin.from('shop_settings').select('online_fee').eq('shop_id', SHOP_ID).single();
      originalFee = cur.data.online_fee;
      const newFee = originalFee + 25; // the owner nudges shipping, as they may
      await setOnlineFee(newFee);

      await fillCart(variantId, 2);
      const r2 = await placeOrder(randomUUID(), addressId);
      if (r2.error) {
        fail(2, 'order placed after the fee change', r2.error.message);
      } else {
        check(2, r2.order.delivery_fee === newFee,
          `order charges the NEW fee ${newFee} (was ${originalFee})`,
          `got ${r2.order.delivery_fee}`);
        // The heart of M1: what the app's own constant would have produced.
        const clientTotal = r2.order.subtotal + CLIENT_FEE - r2.order.discount_amount;
        check(2, clientTotal !== r2.order.total,
          `client math (${clientTotal}) now DISAGREES with the charge (${r2.order.total}) — a client-drawn QR would be wrong by ${Math.abs(clientTotal - r2.order.total)}`);
        check(2, r2.order.total === r2.order.subtotal + newFee - r2.order.discount_amount,
          `the QR amount (order.total=${r2.order.total}) tracks the owner's setting`);
      }
      await setOnlineFee(originalFee);
      originalFee = null;
      console.log('      (fee restored)');
    }

    /* ── 3. H2: promo is re-priced against the LIVE subtotal ─────────────── */
    console.log('\n[3] H2 — a promo is re-priced against the live subtotal, never frozen');
    if (!admin) {
      skip(3, 'no SUPABASE_SERVICE_ROLE_KEY — cannot seed a min_spend promo (NOT proven)');
    } else {
      promoCode = `H2TEST${Math.floor(Math.random() * 100000)}`;
      const minSpend = price * 4;
      const ins = await admin.from('promo_codes').insert({
        shop_id: SHOP_ID,
        code: promoCode,
        type: 'percent',
        value: 10,
        min_spend: minSpend,
        scope: 'subtotal',
        active: true,
      });
      if (ins.error) throw new Error(`promo insert: ${ins.error.message}`);
      console.log(`      promo ${promoCode}: 10% off, min_spend ${minSpend}`);

      // Big cart: qualifies. Discount must track THIS subtotal.
      await fillCart(variantId, 5);
      const big = await placeOrder(randomUUID(), addressId, promoCode);
      if (big.error) {
        fail(3, 'promo applies on a qualifying cart', big.error.message);
      } else {
        const expected = Math.floor((price * 5 * 10) / 100);
        check(3, big.order.discount_amount === expected,
          `discount priced against the live subtotal (${big.order.discount_amount})`,
          `expected ~${expected} for subtotal ${big.order.subtotal}`);
        check(3, big.order.total === big.order.subtotal + big.order.delivery_fee - big.order.discount_amount,
          `total reflects that discount (${big.order.total})`);
      }

      // Small cart, same code: the frozen discount from the big cart must NOT
      // survive — the server refuses, and it refuses BEFORE any QR is drawn.
      await fillCart(variantId, 1);
      const small = await placeOrder(randomUUID(), addressId, promoCode);
      check(3, !!small.error,
        'a cart that fell under min_spend is REJECTED, not charged a stale discount',
        small.error ? undefined : `placed anyway: total ${small.order?.total}`);
      if (small.error) {
        check(3, /PROMO_MIN_SPEND/.test(small.error.message),
          `rejected with PROMO_MIN_SPEND (${small.error.message})`);
        console.log('      → in the app this error lands BEFORE the QR exists, which is the point');
      }
    }
  } finally {
    // Never leave the shop's fee moved or a test promo live, even if an
    // assertion threw. A query builder is thenable but has no .catch, so these
    // need real try/catch — cleanup must not become the thing that fails.
    if (admin && originalFee !== null) {
      try {
        await setOnlineFee(originalFee);
        console.log('      (fee restored in cleanup)');
      } catch (e) {
        console.error(`      WARNING: could not restore online_fee to ${originalFee}: ${e.message}`);
      }
    }
    if (admin && promoCode) {
      // Deactivate, don't delete: orders.promo_code_id FKs to this row, so a
      // promo the test actually used cannot be removed. supabase-js RETURNS
      // errors rather than throwing, so this has to be inspected or it fails
      // silently and leaves a live discount code behind.
      const { error } = await admin
        .from('promo_codes')
        .update({ active: false })
        .eq('code', promoCode);
      if (error) console.error(`      WARNING: test promo ${promoCode} left ACTIVE: ${error.message}`);
      else console.log(`      (test promo ${promoCode} deactivated)`);
    }
  }

  // Green ONLY when everything actually ran and passed. Anything else exits
  // nonzero: an unproven case is not a pass.
  if (failures > 0) console.log(`\n${failures} FAILURE(S)`);
  else if (skipped > 0) console.log(`\nINCOMPLETE — ${skipped} case(s) SKIPPED and therefore NOT PROVEN`);
  else console.log('\nALL PASS');
  await supa.auth.signOut();
  process.exit(failures === 0 && skipped === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  process.exit(1);
});
