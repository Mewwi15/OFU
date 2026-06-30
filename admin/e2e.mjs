// Quick admin-web E2E against the local stack. Run: node e2e.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOT = '/private/tmp/claude-501/-Users-mewwi-dev-my-rn-app/71564e90-f42d-4f1c-8e95-0a0856deefa8/scratchpad';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

try {
  // 1) Login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT}/admin-login.png` });

  // 2) Sign in as the dev admin
  await page.fill('input[type=email]', 'admin@oofoo.local');
  await page.fill('input[type=password]', 'admin1234');
  await page.click('button.btn');

  // 3) Products list should load (seeded catalog)
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const rows = await page.locator('table tbody tr').count();
  await page.screenshot({ path: `${SHOT}/admin-products.png` });
  console.log('PRODUCTS_ROWS=' + rows);

  // 4) Create a product via the modal
  await page.click('button.btn:has-text("เพิ่มสินค้า")');
  await page.fill('.modal input', 'สินค้าทดสอบ E2E');
  await page.click('.modal button.btn:has-text("บันทึก")');
  await page.waitForSelector('text=สินค้าทดสอบ E2E', { timeout: 10000 });
  console.log('CREATE_OK=1');
  await page.screenshot({ path: `${SHOT}/admin-products-after.png` });

  console.log('CONSOLE_ERRORS=' + errors.length);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} catch (e) {
  console.log('E2E_FAIL: ' + e.message);
  await page.screenshot({ path: `${SHOT}/admin-fail.png` });
  console.log('CONSOLE_ERRORS=' + errors.length);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
