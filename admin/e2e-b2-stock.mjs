#!/usr/bin/env node
/**
 * B2 proof, driven through the REAL POS admin UI.
 *
 * B2: editing a product's price clobbered its stock. The admin form loaded
 * stock into a field and posted it straight back on save, so whatever the form
 * had read minutes ago overwrote whatever the POS had sold since. It was fixed
 * in two independent layers, both live, and neither had ever been watched work:
 *
 *   layer 1 (client, PR #4)  — Products.tsx stops sending stock_qty on update
 *   layer 2 (DB, 0063)       — upsert_variant ignores p_stock_qty on update
 *
 * Layer 1 alone would leave every other caller (an old cached tab, a script,
 * a future screen) still able to clobber stock, so this proves BOTH: the UI
 * path through Playwright, and the RPC path by calling upsert_variant directly
 * with a poisoned p_stock_qty the way a stale client would.
 *
 * Truth comes from the DATABASE, never the screen — the screen is the thing on
 * trial here.
 *
 * Run (LOCAL ONLY — the real shop is open and the owner is behind the counter):
 *   cd admin && npm run dev            # vite on :5173, .env.local must be 127.0.0.1
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role> node e2e-b2-stock.mjs
 *
 * Fails fast rather than skipping: an unproven case is not a pass.
 */

import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(HERE, 'screenshots');
const BASE = process.env.ADMIN_BASE ?? 'http://localhost:5173';
const ADMIN_EMAIL = 'admin@oofoo.local';
const ADMIN_PASSWORD = 'admin1234';

/* ── Safety: local only, no override ─────────────────────────────────────── */

// The admin points wherever .env.local says. This test EDITS PRODUCTS and MOVES
// STOCK, so read that file and refuse anything that isn't a local host. The
// live shop is ejohcdbzvscgakpvgytj — there is no flag to aim this at it.
function readEnvLocal() {
  let raw;
  try {
    raw = readFileSync(join(HERE, '.env.local'), 'utf8');
  } catch {
    console.error('FATAL: admin/.env.local not found — cannot verify which backend the admin targets.');
    process.exit(1);
  }
  const get = (k) => raw.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
  return { url: get('VITE_SUPABASE_URL'), anon: get('VITE_SUPABASE_ANON_KEY') };
}

const { url: SUPABASE_URL, anon: ANON_KEY } = readEnvLocal();
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
const host = (() => {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return '';
  }
})();
if (!LOCAL_HOSTS.has(host)) {
  console.error(`FATAL: admin/.env.local points at "${SUPABASE_URL}" — refusing to run.`);
  console.error('This test edits products and moves stock. Local Supabase only.');
  process.exit(1);
}
if (!LOCAL_HOSTS.has(new URL(BASE).hostname)) {
  console.error(`FATAL: ADMIN_BASE "${BASE}" is not local — refusing to run.`);
  process.exit(1);
}
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY required — the DB reads ARE the proof.');
  console.error('  Get it with: npx supabase status -o env');
  process.exit(1);
}

/* ── Harness ─────────────────────────────────────────────────────────────── */

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => {
  failures++;
  console.log(`  FAIL  [${c}] ${m}`);
  if (d !== undefined) console.log(`        ↳ ${d}`);
};
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/**
 * A SECOND, genuinely signed-in admin session — this is what plays the part of
 * the POS selling behind the form's back. adjust_stock is granted to
 * `authenticated` only (service_role is deliberately NOT allowed), so reaching
 * for the service key here would have been a backdoor that proves nothing about
 * the real path. This calls the same RPC the till calls, and writes the same
 * ledger row.
 */
const asAdmin = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

/** Stock straight from the table — the screen doesn't get a vote. */
async function stockOf(variantId) {
  const { data, error } = await db
    .from('product_variants')
    .select('stock_qty, price')
    .eq('id', variantId)
    .single();
  if (error) throw new Error(`stockOf: ${error.message}`);
  return data;
}

/** The admin account the UI logs in with. Provisioned here so the test is
 *  self-contained on a freshly reset local DB. */
async function ensureAdminUser() {
  const { data: list, error: lErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (lErr) throw new Error(`listUsers: ${lErr.message}`);
  let user = list.users.find((u) => u.email === ADMIN_EMAIL);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    user = data.user;
    console.log(`  created admin user ${ADMIN_EMAIL}`);
  } else {
    // Make sure the password matches what the UI will type.
    const { error } = await db.auth.admin.updateUserById(user.id, { password: ADMIN_PASSWORD });
    if (error) throw new Error(`updateUser: ${error.message}`);
  }

  const { data: shop, error: sErr } = await db.from('shops').select('id').limit(1).single();
  if (sErr) throw new Error(`shops: ${sErr.message}`);

  // is_admin_of() wants role=admin + active + the right shop.
  const { error: uErr } = await db
    .from('app_users')
    .upsert(
      {
        id: user.id,
        shop_id: shop.id,
        role: 'admin',
        admin_tier: 'owner',
        account_state: 'active',
        display_name: 'E2E Admin',
      },
      { onConflict: 'id' },
    );
  if (uErr) throw new Error(`app_users upsert: ${uErr.message}`);

  // Sign the "POS" session in now that the account is an active admin.
  const { error: sInErr } = await asAdmin.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (sInErr) throw new Error(`admin signIn (for the concurrent sale): ${sInErr.message}`);
  return user.id;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button:has-text("เข้าสู่ระบบ")');
  // Login redirects to the POS till (Login.tsx: <Navigate to="/pos">), not the
  // product list — wait for that, then go to /products explicitly.
  await page.waitForURL('**/pos', { timeout: 20000 });
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ant-table-row', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

/** Open the edit modal for a product by name via the search box. */
async function openEdit(page, productName) {
  const search = page.locator('input[placeholder="ค้นหาสินค้า…"]');
  await search.fill('');
  await search.fill(productName);
  await page.waitForTimeout(600); // debounce
  const row = page.locator('.ant-table-row', { hasText: productName }).first();
  await row.waitFor({ timeout: 10000 });
  await row.locator('button:has-text("แก้ไข")').click();
  // NB: this antd build renders `.ant-modal` with no `.ant-modal-content`
  // wrapper — verified against the live DOM, don't "fix" it back.
  await page.waitForSelector('.ant-modal:has-text("แก้ไขสินค้า")', { timeout: 10000 });
  await page.waitForSelector('#price', { state: 'visible', timeout: 10000 });
}

async function saveModal(page) {
  await page.locator('.ant-modal-footer button:has-text("บันทึก")').click();
  // destroyOnHidden means the form is torn down on a successful close; a
  // validation error would keep it mounted and this would (correctly) time out.
  await page.waitForSelector('#price', { state: 'detached', timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

mkdirSync(SHOT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
// antd logs its deprecation notices through console.error, so they arrive as
// "errors". They are library housekeeping, not a fault in this flow — kept
// separate and REPORTED rather than swallowed, but they don't fail B2.
const isLibDeprecation = (t) => /\[antd:.*\]\s*`?\w+`? is deprecated/i.test(t) || /Warning: \[antd:/i.test(t);
const consoleErrors = [];
const deprecations = [];
const noteConsole = (t) => (isLibDeprecation(t) ? deprecations : consoleErrors).push(t);
page.on('console', (m) => m.type() === 'error' && noteConsole(m.text()));
page.on('pageerror', (e) => noteConsole(String(e)));

let restore = null;

try {
  console.log(`\nsetup — admin ${BASE} → supabase ${SUPABASE_URL} (local)`);
  await ensureAdminUser();

  // A product that actually has stock to lose.
  const { data: v, error: vErr } = await db
    .from('product_variants')
    .select('id, product_id, stock_qty, price, products(name)')
    .gt('stock_qty', 0)
    .is('archived_at', null)
    .limit(1)
    .single();
  if (vErr) throw new Error(`pick variant: ${vErr.message}`);
  const NAME = v.products.name;
  restore = { id: v.id, price: v.price };
  console.log(`  product "${NAME}" variant ${v.id}`);
  console.log(`  stock ${v.stock_qty} · price ${v.price}`);

  await login(page);
  await page.screenshot({ path: join(SHOT_DIR, 'b2-01-products.png'), fullPage: true });
  pass(1, `logged in as ${ADMIN_EMAIL}`);

  /* 2-4 — edit ONLY the price; stock must not move. */
  console.log('\n[2] edit price only → stock must be untouched');
  const before = await stockOf(v.id);
  await openEdit(page, NAME);
  await page.screenshot({ path: join(SHOT_DIR, 'b2-02-edit-modal.png') });

  const newPrice = before.price + 7;
  await page.fill('#price', String(newPrice));
  await saveModal(page);

  const after = await stockOf(v.id);
  check(2, after.price === newPrice, `price actually changed (${before.price} → ${after.price})`);
  check(
    2,
    after.stock_qty === before.stock_qty,
    `stock survived the price edit (${before.stock_qty} → ${after.stock_qty})`,
    'B2 IS BACK: saving a price rewrote stock',
  );

  /* 5 — the stock field must not be editable from this form. */
  console.log('\n[5] stock field is read-only here, with a separate way to adjust');
  await openEdit(page, NAME);
  const stockInput = page.locator('#stock_qty');
  const disabled = await stockInput.isDisabled();
  check(5, disabled, 'stock input is disabled in the edit form');
  const hasAdjust = await page.locator('.ant-modal button:has-text("ปรับสต็อก")').count();
  check(5, hasAdjust > 0, 'a separate "ปรับสต็อก" route exists (stock moves keep a ledger)');
  await page.screenshot({ path: join(SHOT_DIR, 'b2-03-stock-readonly.png') });

  /* 6 — THE REAL B2: the POS sells while the admin has the form open. */
  console.log('\n[6] POS sells WHILE the edit form is open → the sale must win');
  // The modal is already open from case 5 and is holding the old stock value.
  const held = await stockOf(v.id);
  console.log(`      form opened holding stock = ${held.stock_qty}`);

  const { error: adjErr } = await asAdmin.rpc('adjust_stock', {
    p_variant_id: v.id,
    p_delta: -1,
    p_note: 'e2e-b2: POS sale while admin edit form is open',
  });
  if (adjErr) throw new Error(`adjust_stock (as signed-in admin): ${adjErr.message}`);
  const sold = await stockOf(v.id);
  console.log(`      sale landed behind the form: stock now = ${sold.stock_qty}`);
  check(6, sold.stock_qty === held.stock_qty - 1, 'the concurrent sale really did move stock');

  // Now save the form, which is still holding the PRE-SALE number.
  const price2 = sold.price + 3;
  await page.fill('#price', String(price2));
  await saveModal(page);

  const final = await stockOf(v.id);
  await page.screenshot({ path: join(SHOT_DIR, 'b2-04-after-concurrent-sale.png'), fullPage: true });
  check(6, final.price === price2, `price edit still applied (${price2})`);
  check(
    6,
    final.stock_qty === sold.stock_qty,
    `stock is the SALE's value ${sold.stock_qty}, not the form's stale ${held.stock_qty}`,
    `B2 IS BACK: the form clobbered the sale (stock=${final.stock_qty})`,
  );

  /* 6b — layer 2 on its own: a stale/other caller poisoning p_stock_qty. */
  console.log('\n[6b] upsert_variant with a poisoned p_stock_qty → DB must ignore it (0063)');
  const pre = await stockOf(v.id);
  const poison = pre.stock_qty + 999;
  // Same signed-in admin, not service_role: upsert_variant is granted to
  // `authenticated`, and this must impersonate a real (stale) client anyway.
  const { error: upErr } = await asAdmin.rpc('upsert_variant', {
    p_id: v.id,
    p_product_id: v.product_id, // required: it checks the product is in the admin's shop
    p_price: pre.price,
    p_stock_qty: poison, // exactly what the old client sent
  });
  if (upErr) {
    fail('6b', 'upsert_variant accepted the call', upErr.message);
  } else {
    const post = await stockOf(v.id);
    check(
      '6b',
      post.stock_qty === pre.stock_qty,
      `DB ignored p_stock_qty=${poison} on update (stock stayed ${post.stock_qty})`,
      `0063 NOT holding: stock became ${post.stock_qty}`,
    );
  }

  check('ui', consoleErrors.length === 0, `no real console errors during the run (${consoleErrors.length})`,
    consoleErrors.slice(0, 3).join(' | '));
  if (deprecations.length) {
    console.log(`  NOTE  [ui] ${deprecations.length} antd deprecation warning(s) — not a B2 fault, but real:`);
    [...new Set(deprecations)].slice(0, 3).forEach((d) => console.log(`        · ${d}`));
  }
} catch (e) {
  fail('run', 'the test completed', e.message);
  try {
    await page.screenshot({ path: join(SHOT_DIR, 'b2-99-failure.png'), fullPage: true });
  } catch {
    /* page may be gone */
  }
} finally {
  // Put the price back; stock deltas are local-only and left in the ledger.
  if (restore) {
    await db.from('product_variants').update({ price: restore.price }).eq('id', restore.id);
  }
  await browser.close();
}

console.log(`\nscreenshots → ${SHOT_DIR}`);
console.log(`${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
