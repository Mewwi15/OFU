// Chat E2E against the local stack. Run: node e2e-chat.mjs
// Logs in as the local test admin, opens the customer thread, replies, then
// simulates a customer message via psql and waits for Realtime to surface it.
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';
const SHOT = '/private/tmp/claude-501/-Users-mewwi-dev-my-rn-app/71564e90-f42d-4f1c-8e95-0a0856deefa8/scratchpad';
const PSQL = 'docker exec supabase_db_my-rn-app psql -U postgres -d postgres -tAc';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'admin2@test.dev');
  await page.fill('input[type=password]', 'test1234');
  await page.click('button:has-text("เข้าสู่ระบบ")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/chat-0-postlogin.png` });

  // Straight to the chat page (sidebar item may be collapsed on first paint)
  await page.goto(`${BASE}/chat`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT}/chat-1-list.png` });
  await page.waitForSelector('h3:has-text("แชตลูกค้า")', { timeout: 8000 });

  // Open the test customer's thread
  await page.click('text=คุณทดสอบ');
  await page.waitForSelector('input[placeholder="พิมพ์ข้อความ…"]', { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT}/chat-2-thread.png` });

  // Reply as admin
  await page.fill('input[placeholder="พิมพ์ข้อความ…"]', 'ตอบจากหน้า POS ครับ');
  await page.click('button:has-text("ส่ง")');
  await page.waitForSelector('text=ตอบจากหน้า POS ครับ', { timeout: 8000 });
  console.log('ADMIN_REPLY=ok');

  // Customer message lands over Realtime (no reload!)
  execSync(
    `${PSQL} "insert into chat_messages (thread_id, sender, sender_id, body) values ((select id from chat_threads limit 1),'customer','11111111-1111-1111-1111-111111111111','เห็นข้อความแบบเรียลไทม์ไหม');"`,
  );
  await page.waitForSelector('text=เห็นข้อความแบบเรียลไทม์ไหม', { timeout: 10000 });
  console.log('REALTIME_IN=ok');
  await page.screenshot({ path: `${SHOT}/chat-3-realtime.png` });
} finally {
  console.log('CONSOLE_ERRORS=' + JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}
