#!/usr/bin/env node
/**
 * H5 client defence, through the real POS UI.
 *
 * The DB fix (0065) is proven separately by e2e-h5-replay-rpc.mjs. This proves
 * the CLIENT survives even when a receipt payload arrives in the broken shape —
 * i.e. an old create_pos_sale still deployed, or any future thin/nullish
 * response. The receipt must render (missing amounts as 0), the POS must NOT
 * white-screen, and the cashier must be able to close it and keep selling.
 *
 * It drives a genuine sale in the POS, but rewrites the create_pos_sale RESPONSE
 * on the way back to the exact pathological shapes:
 *   A) thin  — the literal 0060 replay: subtotal/discount/net_amount removed
 *   B) null  — those fields explicitly null (the formatter's nullish path)
 *
 * Run (LOCAL ONLY):
 *   cd admin && npm run dev            # vite :5173, .env.local must be 127.0.0.1
 *   node e2e-h5-receipt.mjs
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(HERE, 'screenshots');
const BASE = process.env.ADMIN_BASE ?? 'http://localhost:5173';
const ADMIN_EMAIL = 'admin@oofoo.local';
const ADMIN_PASSWORD = 'admin1234';

/* ── local-only gate ─────────────────────────────────────────────────────── */
const raw = (() => {
  try { return readFileSync(join(HERE, '.env.local'), 'utf8'); }
  catch { console.error('FATAL: admin/.env.local not found.'); process.exit(1); }
})();
const SUPABASE_URL = raw.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim() ?? '';
const LOCAL = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
if (!LOCAL.has((() => { try { return new URL(SUPABASE_URL).hostname; } catch { return ''; } })())) {
  console.error(`FATAL: admin/.env.local points at "${SUPABASE_URL}" — refusing. This creates sales.`);
  process.exit(1);
}
if (!LOCAL.has(new URL(BASE).hostname)) { console.error(`FATAL: ADMIN_BASE "${BASE}" not local.`); process.exit(1); }

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => { failures++; console.log(`  FAIL  [${c}] ${m}`); if (d !== undefined) console.log(`        ↳ ${d}`); };
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

mkdirSync(SHOT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });

// A white-screen shows up as a render throw reaching the global boundary.
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button:has-text("เข้าสู่ระบบ")');
  await page.waitForURL('**/pos', { timeout: 20000 });
  await page.waitForSelector('.ant-card', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

/** Rewrite the next create_pos_sale response with `mutate(json)`. One-shot. */
async function interceptSaleOnce(mutate) {
  await page.route('**/rest/v1/rpc/create_pos_sale', async (route) => {
    const res = await route.fetch();
    let body = await res.json();
    // supabase RPC returns the jsonb object directly.
    body = mutate(body) ?? body;
    await route.fulfill({ response: res, body: JSON.stringify(body) });
    await page.unroute('**/rest/v1/rpc/create_pos_sale');
  });
}

/** Add a product, pay by promptpay (no cash-tendered step), given a response mutator. */
async function sellOnce(mutate, shotName) {
  // Add the first in-stock product to the cart.
  const card = page.locator('.ant-card', { hasNot: page.locator('[style*="not-allowed"]') }).first();
  await card.click();
  // Pay by promptpay so there's no cash-tendered gate.
  await page.locator('.ant-segmented-item:has-text("พร้อมเพย์")').click();
  await interceptSaleOnce(mutate);
  await page.locator('button:has-text("ชำระเงิน")').first().click();
  // The receipt modal (#pos-receipt lives inside it).
  await page.waitForSelector('#pos-receipt', { timeout: 15000 });
  if (shotName) await page.screenshot({ path: join(SHOT_DIR, shotName), fullPage: true });
}

async function closeReceipt() {
  // Either the normal "ขายต่อ" footer button, or the boundary's fallback button.
  const boundaryBtn = page.locator('button:has-text("ปิดใบเสร็จและขายต่อ")');
  if (await boundaryBtn.count()) await boundaryBtn.click();
  else await page.locator('.ant-modal-footer button:has-text("ขายต่อ")').click();
  await page.waitForSelector('#pos-receipt', { state: 'detached', timeout: 10000 });
}

/** The global boundary's title — its presence == the white-screen we're preventing. */
async function whiteScreened() {
  return (await page.locator('text=เกิดข้อผิดพลาด').count()) > 0;
}

try {
  console.log(`\nsetup — admin ${BASE} → supabase ${SUPABASE_URL} (local)`);
  await login();
  pass(0, 'logged into POS');

  /* A — the literal 0060 thin replay: subtotal/discount/net_amount gone. */
  console.log('\n[A] receipt payload missing subtotal/discount/net_amount (the 0060 shape)');
  const errsBeforeA = pageErrors.length;
  await sellOnce((j) => {
    delete j.subtotal; delete j.discount; delete j.net_amount; j.replay = true;
    return j;
  }, 'h5-A-thin-replay.png');
  check('A', true, 'receipt rendered (did not white-screen the till)');
  check('A', !(await whiteScreened()), 'global error screen NOT shown');
  check('A', pageErrors.length === errsBeforeA, `no page error thrown (${pageErrors.length - errsBeforeA})`,
    pageErrors.slice(errsBeforeA).join(' | '));
  check('A', (await page.locator('#pos-receipt:has-text("ยอดรวม")').count()) > 0,
    'the total rows still render (missing amounts shown, not crashed)');
  await closeReceipt();
  check('A', (await page.locator('.ant-card').count()) > 0, 'after closing, the POS is still usable');

  /* B — explicit nulls: the formatter's nullish branch. */
  console.log('\n[B] receipt payload with explicit null amounts');
  const errsBeforeB = pageErrors.length;
  await sellOnce((j) => {
    j.subtotal = null; j.discount = null; j.net_amount = null; j.vat_amount = null; j.total = null;
    return j;
  }, 'h5-B-null-amounts.png');
  check('B', !(await whiteScreened()), 'null amounts did not white-screen');
  check('B', pageErrors.length === errsBeforeB, `no page error thrown (${pageErrors.length - errsBeforeB})`,
    pageErrors.slice(errsBeforeB).join(' | '));
  check('B', (await page.locator('#pos-receipt').count()) > 0, 'receipt still on screen with null amounts');
  await closeReceipt();

  /* C — a healthy sale still renders normally and keeps selling. */
  console.log('\n[C] a normal receipt still works (regression)');
  const errsBeforeC = pageErrors.length;
  await sellOnce((j) => j, 'h5-C-normal.png');
  check('C', pageErrors.length === errsBeforeC, 'normal sale threw nothing');
  check('C', (await page.locator('#pos-receipt:has-text("สุทธิ")').count()) > 0, 'normal receipt shows the net total');
  await closeReceipt();
  check('C', (await page.locator('.ant-card').count()) > 0, 'POS still usable after a normal sale');
} catch (e) {
  fail('run', 'the test completed', e.message);
  try { await page.screenshot({ path: join(SHOT_DIR, 'h5-99-failure.png'), fullPage: true }); } catch { /* gone */ }
} finally {
  await browser.close();
}

console.log(`\nscreenshots → ${SHOT_DIR}`);
console.log(`${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
