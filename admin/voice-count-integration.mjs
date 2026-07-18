#!/usr/bin/env node
/**
 * Integration check for the item-count query OrderAlerts runs on a new order.
 * Inserts a real order + N order_items into the LOCAL db, then runs the exact
 * query from OrderAlerts as the admin session and asserts the count matches —
 * proving the query and its RLS scope work end to end. Local-only, hard-gated.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role> node voice-count-integration.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = (() => {
  try { return readFileSync(join(HERE, '.env.local'), 'utf8'); }
  catch { console.error('FATAL: admin/.env.local not found.'); process.exit(1); }
})();
const SUPABASE_URL = raw.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim() ?? '';
const ANON = raw.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim() ?? '';
const LOCAL = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
if (!LOCAL.has((() => { try { return new URL(SUPABASE_URL).hostname; } catch { return ''; } })())) {
  console.error(`FATAL: admin/.env.local points at "${SUPABASE_URL}" — refusing. This inserts orders.`);
  process.exit(1);
}
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY required.'); process.exit(1); }

let failures = 0;
const check = (cond, m, d) => { if (cond) console.log(`  PASS  ${m}`); else { failures++; console.log(`  FAIL  ${m}`); if (d) console.log(`        ↳ ${d}`); } };

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const asAdmin = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });

/** Exactly the query OrderAlerts runs. */
async function countItems(client, orderId) {
  const { count, error } = await client
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  return { count, error };
}

let orderId = null;
try {
  console.log(`\nsetup — ${SUPABASE_URL} (local)`);
  const { error: sErr } = await asAdmin.auth.signInWithPassword({ email: 'admin@oofoo.local', password: 'admin1234' });
  if (sErr) throw new Error(`admin signIn: ${sErr.message}`);

  const shop = (await db.from('shops').select('id').limit(1).single()).data;
  const cust = (await db.from('orders').select('customer_user_id').not('customer_user_id', 'is', null).limit(1).single()).data;
  const N = 3;
  const suffix = String(Date.now()).slice(-6);

  const ins = await db.from('orders').insert({
    shop_id: shop.id, customer_user_id: cust.customer_user_id,
    order_number: `VOICE-${suffix}`, shop_mode: 'online', payment_method: 'promptpay_slip',
    subtotal: 300, total: 300,
  }).select('id').single();
  if (ins.error) throw new Error(`order insert: ${ins.error.message}`);
  orderId = ins.data.id;
  const itemsIns = await db.from('order_items').insert(
    Array.from({ length: N }, (_, i) => ({
      order_id: orderId, name_snapshot: `สินค้า ${i + 1}`, unit_price: 100, qty: 1,
    })),
  );
  if (itemsIns.error) throw new Error(`items insert: ${itemsIns.error.message}`);
  console.log(`  inserted order ${orderId} with ${N} items`);

  // Admin session — the real path OrderAlerts uses.
  const a = await countItems(asAdmin, orderId);
  check(!a.error, 'admin count query has no error (RLS allows the read)', a.error?.message);
  check(a.count === N, `admin sees the true item count (${a.count} === ${N})`);

  // A non-existent order → count 0, not null → builder drops the tail (never "0 รายการ").
  const z = await countItems(asAdmin, '00000000-0000-0000-0000-000000000000');
  check(!z.error && z.count === 0, `unknown order → count 0, not null (${z.count})`, z.error?.message);
} catch (e) {
  failures++;
  console.log(`  FAIL  run — ${e.message}`);
} finally {
  if (orderId) {
    await db.from('order_items').delete().eq('order_id', orderId);
    await db.from('orders').delete().eq('id', orderId);
    console.log('  (cleaned up the test order)');
  }
  await asAdmin.auth.signOut();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
