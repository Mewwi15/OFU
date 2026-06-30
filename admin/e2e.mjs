// Quick admin-web E2E against the local stack. Run: node e2e.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOT = '/private/tmp/claude-501/-Users-mewwi-dev-my-rn-app/71564e90-f42d-4f1c-8e95-0a0856deefa8/scratchpad';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT}/admin-login.png` });

  await page.fill('input[type=email]', 'admin@oofoo.local');
  await page.fill('input[type=password]', 'admin1234');
  await page.click('button:has-text("เข้าสู่ระบบ")');

  // Products page = card grid (each card has an <h3> name)
  await page.waitForSelector('main h3', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  const cards = await page.locator('main h3').count();
  console.log('PRODUCT_CARDS=' + cards);
  await page.screenshot({ path: `${SHOT}/admin-products.png`, fullPage: true });

  // Create a product via the custom modal (scope to the overlay)
  await page.click('button:has-text("เพิ่มสินค้า")');
  const modal = page.locator('.fixed.inset-0');
  await modal.locator('input').first().fill('สินค้าทดสอบ E2E');
  await page.screenshot({ path: `${SHOT}/admin-modal.png` });
  await modal.locator('button:has-text("บันทึก")').click();
  await page.waitForSelector('h3:has-text("สินค้าทดสอบ E2E")', { timeout: 10000 });
  console.log('CREATE_OK=1');

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
