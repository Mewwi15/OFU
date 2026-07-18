#!/usr/bin/env node
/**
 * H5 proof at the RPC layer — create_pos_sale replay returns the FULL receipt.
 *
 * H5: pressing pay twice replays the sale, the receipt renders, and the whole
 * POS white-screens. The DB half of the bug is that create_pos_sale's replay
 * branch (0060) returned a thin object missing subtotal/discount/net_amount/
 * is_split — the fields the receipt formatter then crashes on. 0065 makes the
 * replay return the same contract as a first sale, read from the committed row.
 *
 * This calls the RPC with the SAME client_op_id twice and proves:
 *   - the 2nd call is replay=true with the same id/sale_number
 *   - every receipt field is present AND equal to the 1st call's values
 *   - NO second sale / stock movement / payment row was written
 * plus regressions that must still work: normal, zero-total, split tender.
 *
 * Truth is read from the DATABASE, not the RPC's own echo.
 *
 * Run (LOCAL ONLY):
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role> node e2e-h5-replay-rpc.mjs
 * Fails fast; refuses any non-local Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_EMAIL = 'admin@oofoo.local';
const ADMIN_PASSWORD = 'admin1234';

/* ── local-only gate ─────────────────────────────────────────────────────── */
function readEnvLocal() {
  let raw;
  try {
    raw = readFileSync(join(HERE, '.env.local'), 'utf8');
  } catch {
    console.error('FATAL: admin/.env.local not found.');
    process.exit(1);
  }
  const get = (k) => raw.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
  return { url: get('VITE_SUPABASE_URL'), anon: get('VITE_SUPABASE_ANON_KEY') };
}
const { url: SUPABASE_URL, anon: ANON_KEY } = readEnvLocal();
const LOCAL = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
if (!LOCAL.has((() => { try { return new URL(SUPABASE_URL).hostname; } catch { return ''; } })())) {
  console.error(`FATAL: admin/.env.local points at "${SUPABASE_URL}" — refusing. This creates sales.`);
  process.exit(1);
}
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY required — the DB reads are the proof.');
  console.error('  Get it with: npx supabase status -o env');
  process.exit(1);
}

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => { failures++; console.log(`  FAIL  [${c}] ${m}`); if (d !== undefined) console.log(`        ↳ ${d}`); };
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const asAdmin = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

/** The 11 keys every create_pos_sale return must carry. */
const CONTRACT = ['id', 'sale_number', 'tax_invoice_no', 'subtotal', 'discount', 'total',
  'vat_amount', 'net_amount', 'change', 'replay', 'is_split'];

async function sale(payload) {
  const { data, error } = await asAdmin.rpc('create_pos_sale', payload);
  if (error) throw new Error(`create_pos_sale: ${error.message}`);
  return data;
}
async function countFor(saleId) {
  const [items, pays, movesForSale] = await Promise.all([
    db.from('pos_sale_items').select('id').eq('sale_id', saleId),
    db.from('pos_sale_payments').select('id, amount').eq('sale_id', saleId),
    db.from('pos_sales').select('id').eq('id', saleId),
  ]);
  return {
    items: items.data?.length ?? 0,
    payments: pays.data?.length ?? 0,
    paymentTotal: (pays.data ?? []).reduce((s, p) => s + p.amount, 0),
    saleRows: movesForSale.data?.length ?? 0,
  };
}

async function main() {
  console.log(`\nsetup — ${SUPABASE_URL} (local)`);
  const { error: sErr } = await asAdmin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (sErr) throw new Error(`admin signIn: ${sErr.message} (run the B2 test once to provision the admin, or check seed)`);

  // Two variants with stock, deterministic order.
  const { data: vs, error: vErr } = await db
    .from('product_variants')
    .select('id, price, stock_qty')
    .gte('stock_qty', 5).is('archived_at', null).order('id').limit(2);
  if (vErr || !vs || vs.length < 2) throw new Error(`need 2 stocked variants: ${vErr?.message ?? 'not enough'}`);
  console.log(`  variants ${vs[0].id} (${vs[0].price}), ${vs[1].id} (${vs[1].price})`);

  /* 1 — the H5 case: same client_op_id twice, replay must be the full receipt. */
  console.log('\n[1] same client_op_id twice → replay returns the FULL receipt contract');
  const opId = randomUUID();
  const items = [{ variant_id: vs[0].id, qty: 2, line_discount: 0 }];
  const payload = {
    p_client_op_id: opId, p_items: items, p_payment_method: 'cash',
    p_cash_tendered: vs[0].price * 2 + 100, p_discount: 5,
  };
  const stockBefore = (await db.from('product_variants').select('stock_qty').eq('id', vs[0].id).single()).data.stock_qty;

  const first = await sale(payload);
  check(1, first.replay === false, `first call is a real sale (replay=${first.replay})`);
  const replay = await sale(payload);

  check(1, replay.replay === true, `second call is a replay (replay=${replay.replay})`);
  check(1, replay.id === first.id, `same sale id (${replay.id === first.id})`);
  check(1, replay.sale_number === first.sale_number, `same sale_number (${replay.sale_number})`);

  const missing = CONTRACT.filter((k) => !(k in replay));
  check(1, missing.length === 0, `replay carries all ${CONTRACT.length} receipt keys`,
    missing.length ? `MISSING: ${missing.join(', ')} — this is exactly the H5 crash` : undefined);

  // The fields 0060 dropped, now equal to the first sale.
  for (const k of ['subtotal', 'discount', 'total', 'vat_amount', 'net_amount', 'change', 'is_split']) {
    check(1, replay[k] === first[k], `replay.${k} equals the first sale (${JSON.stringify(replay[k])})`,
      `first=${JSON.stringify(first[k])} replay=${JSON.stringify(replay[k])}`);
  }
  // None of them is null/undefined — the actual thing the formatter chokes on.
  const nullish = ['subtotal', 'discount', 'total', 'vat_amount', 'net_amount', 'change']
    .filter((k) => replay[k] === null || replay[k] === undefined);
  check(1, nullish.length === 0, 'no receipt amount is null/undefined on replay',
    nullish.length ? `nullish: ${nullish.join(', ')}` : undefined);

  /* 2 — the replay wrote NOTHING new. */
  console.log('\n[2] replay is side-effect free (no duplicate sale / stock / payment)');
  const c = await countFor(first.id);
  check(2, c.saleRows === 1, `exactly one pos_sales row for this id`);
  check(2, c.items === 1, `one pos_sale_items row (not doubled)`);
  check(2, c.payments === 1, `one pos_sale_payments row (not doubled)`);
  const stockAfter = (await db.from('product_variants').select('stock_qty').eq('id', vs[0].id).single()).data.stock_qty;
  check(2, stockBefore - stockAfter === 2, `stock moved by the sale qty ONCE (${stockBefore} → ${stockAfter})`,
    'a replay that re-ran the sale would drop stock by 4');
  const { data: moves } = await db.from('stock_movements').select('id')
    .eq('variant_id', vs[0].id).eq('reason', 'pos_sale').order('created_at', { ascending: false }).limit(5);
  // Can't isolate by sale_id (stock_movements has none for pos), so assert stock delta above is the real guard.
  check(2, (moves?.length ?? 0) >= 1, 'a pos_sale stock movement exists for the sale');

  /* 3 — regressions: normal, zero-total, split. */
  console.log('\n[3] regressions still work (normal / zero-total / split)');

  // zero-total: full discount, no payment row should be written.
  const zOp = randomUUID();
  const zPrice = vs[1].price;
  const zero = await sale({
    p_client_op_id: zOp, p_items: [{ variant_id: vs[1].id, qty: 1, line_discount: 0 }],
    p_payment_method: 'cash', p_cash_tendered: 0, p_discount: zPrice,
  });
  check(3, zero.total === 0 && zero.replay === false, `zero-total sale placed (total=${zero.total})`);
  const zc = await countFor(zero.id);
  check(3, zc.payments === 0, 'zero-total wrote NO payment row (฿0 free sale)');
  // and its replay is also full + side-effect free
  const zeroReplay = await sale({
    p_client_op_id: zOp, p_items: [{ variant_id: vs[1].id, qty: 1, line_discount: 0 }],
    p_payment_method: 'cash', p_cash_tendered: 0, p_discount: zPrice,
  });
  check(3, zeroReplay.replay === true && CONTRACT.every((k) => k in zeroReplay),
    'zero-total replay is full contract too');

  // split tender: cash + promptpay summing to total.
  const sOp = randomUUID();
  const sTotal = vs[0].price; // qty 1, no discount
  const half = Math.floor(sTotal / 2);
  const split = await sale({
    p_client_op_id: sOp, p_items: [{ variant_id: vs[0].id, qty: 1, line_discount: 0 }],
    p_payment_method: 'cash',
    p_payments: [{ method: 'cash', amount: half }, { method: 'promptpay', amount: sTotal - half }],
  });
  check(3, split.is_split === true && split.replay === false, `split sale placed (is_split=${split.is_split})`);
  const sc = await countFor(split.id);
  check(3, sc.payments === 2, `split wrote 2 payment legs`);
  check(3, sc.paymentTotal === sTotal, `split legs sum to total (${sc.paymentTotal})`);
  const splitReplay = await sale({
    p_client_op_id: sOp, p_items: [{ variant_id: vs[0].id, qty: 1, line_discount: 0 }],
    p_payment_method: 'cash',
    p_payments: [{ method: 'cash', amount: half }, { method: 'promptpay', amount: sTotal - half }],
  });
  check(3, splitReplay.replay === true && splitReplay.is_split === true, 'split replay preserves is_split=true');
  const sc2 = await countFor(split.id);
  check(3, sc2.payments === 2, 'split replay did NOT add more payment legs');

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  await asAdmin.auth.signOut();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  process.exit(1);
});
