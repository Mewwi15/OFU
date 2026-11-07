// Browser regression: node admin/receive.test.mjs (all API calls are fixtures).
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('.', import.meta.url));
const server = await createServer({
  root, configFile: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54399'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('receipt-test-key'),
  },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [react(), {
    name: 'receipt-test-page',
    resolveId(id) { if (id === '/__receipt-entry.tsx') return id; },
    load(id) {
      if (id !== '/__receipt-entry.tsx') return;
      return `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {BrowserRouter, Routes, Route} from 'react-router-dom';
        import {Receive} from '/src/pages/Receive.tsx';
        createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null,
          React.createElement(Routes, null,
            React.createElement(Route, {path:'/receive',element:React.createElement(Receive)}),
            React.createElement(Route, {path:'/receive/:receiptId/edit',element:React.createElement(Receive)}))));`;
    },
    configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/receive')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await s.transformIndexHtml(req.url,
          '<div id="root"></div><script type="module" src="/__receipt-entry.tsx"></script>'));
      });
    },
  }],
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const receipt = { id: '33333333-3333-4333-8333-333333333333', receipt_number: 'IN-TEST-001',
    supplier: 'ผู้ขายทดสอบ', doc_number: 'DOC-1', note: 'บันทึกเดิม', total_cost: 160, line_count: 2,
    received_at: new Date(Date.now()-86400000).toISOString(), created_at: new Date().toISOString(), voided_at: null };
  const lines = [
    { variant_id: a, product_name: 'สินค้าไม่มีบาร์โค้ด', size: null, barcode: null, sku: null, price: 20, stock_qty: 10, qty: 10, unit_cost: 10 },
    { variant_id: b, product_name: 'สินค้าเปลี่ยนบาร์โค้ด', size: null, barcode: 'changed-code', sku: null, price: 30, stock_qty: 5, qty: 5, unit_cost: 12 },
  ];
  let history = [receipt];
  const writes = [];
  let rejectSave = true;
  await page.route('http://127.0.0.1:54399/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    let data = [];
    if (path.endsWith('/products')) data = lines.map((l) => ({ id: l.variant_id, name: l.product_name,
      product_images: [], product_variants: [{ id: l.variant_id, size: null, barcode: l.barcode, sku: null,
        price: l.price, stock_qty: l.stock_qty, archived_at: null }] }));
    else if (path.endsWith('/goods_receipts')) {
      const idFilter = new URL(request.url()).searchParams.get('id');
      data = idFilter ? history.find((r) => `eq.${r.id}` === idFilter) ?? null : history;
    }
    else if (path.endsWith('/admin_variant_costs')) data = lines.map((l) => ({ variant_id: l.variant_id, cost_price: l.unit_cost }));
    else if (path.endsWith('/get_goods_receipt_lines')) data = lines;
    else if (request.method() === 'POST') {
      writes.push({ path, body: request.postDataJSON() });
      assert.ok(path.endsWith('/replace_goods_receipt'), `Unexpected mutation: ${path}`);
      if (rejectSave) return route.fulfill({ status: 400, headers, json: { message: 'VALIDATION', details: 'fixture failure' } });
      history = [{ ...receipt, id: '44444444-4444-4444-8444-444444444444', receipt_number: 'IN-TEST-002' }];
      data = { ...history[0], negative: [] };
    }
    return route.fulfill({ status: 200, headers, json: data });
  });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/receive`;
  await page.goto(url);
  await page.getByRole('button', { name: 'แก้ไขใบ IN-TEST-001' }).click();
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, `/receive/${receipt.id}/edit`);
  assert.equal(await page.getByText('ประวัติใบรับเข้า', { exact: true }).count(), 0, 'Editor must be a separate form page');
  assert.equal(await page.getByLabel('ผู้ขาย', { exact: true }).inputValue(), receipt.supplier);
  assert.equal(await page.getByLabel('เลขที่เอกสารผู้ขาย').inputValue(), receipt.doc_number);
  assert.equal(await page.getByLabel('หมายเหตุ', { exact: true }).inputValue(), receipt.note);
  assert.equal(writes.length, 0, 'Opening the pencil must not mutate');
  assert.equal(await page.getByRole('spinbutton').count(), 4, 'All receipt lines must load, including no barcode');
  await page.getByRole('spinbutton').first().fill('12');
  await page.getByRole('button', { name: 'ยกเลิกการแก้ไข', exact: true }).click();
  await page.locator('.ant-modal').getByRole('button', { name: 'ยกเลิกการแก้ไข', exact: true }).click();
  await page.getByText('สร้างใบรับเข้าสินค้า', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/receive');
  assert.equal(writes.length, 0, 'Cancel must not mutate');

  await page.getByLabel('ผู้ขาย', { exact: true }).fill('ร่างใบใหม่');
  await page.getByRole('button', { name: 'แก้ไขใบ IN-TEST-001' }).click();
  await page.getByRole('spinbutton').first().fill('12');
  await page.getByRole('button', { name: 'กลับหน้ารับเข้า', exact: true }).click();
  await page.getByRole('button', { name: 'ทำต่อจากเดิม', exact: true }).click();
  assert.equal(await page.getByLabel('ผู้ขาย', { exact: true }).inputValue(), 'ร่างใบใหม่', 'Editing must preserve the separate new-receipt draft');
  await page.getByRole('button', { name: 'แก้ไขใบ IN-TEST-001' }).click();
  await page.getByRole('button', { name: 'ทำต่อจากเดิม', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton').first().inputValue(), '12');
  await page.reload();
  await page.getByText('มีการแก้ไขใบ IN-TEST-001 ค้างไว้', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'ทำต่อจากเดิม', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton').first().inputValue(), '12');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await page.getByText('ข้อมูลไม่ถูกต้อง', { exact: true }).waitFor();
  assert.equal(await page.getByRole('spinbutton').first().inputValue(), '12', 'Failed save must retain edits');
  assert.equal(history[0].id, receipt.id);
  rejectSave = false;
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await page.getByRole('button', { name: 'แก้ไขใบ IN-TEST-002' }).waitFor();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].body, writes[1].body, 'Retry must use the same request ID and payload');
  assert.equal(writes[1].body.p_receipt_id, receipt.id);
  assert.equal(writes[1].body.p_note, receipt.note);
  assert.equal(writes[1].body.p_received_at, receipt.received_at);
  assert.equal(writes[1].body.p_items[0].variant_id, a);
  assert.equal(writes[1].body.p_items[0].qty, 12);
  assert.equal(new URL(page.url()).pathname, '/receive');
  await page.getByRole('button', { name: 'ทำต่อจากเดิม', exact: true }).click();
  assert.equal(await page.getByLabel('ผู้ขาย', { exact: true }).inputValue(), 'ร่างใบใหม่');

  await page.goto(`${url}/99999999-9999-4999-8999-999999999999/edit`);
  await page.getByText('เปิดเอกสารไม่ได้', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).count(), 0);
  assert.equal(writes.length, 2, 'An unavailable document must never become a new intake');
  assert.deepEqual(errors, []);
  console.log('PASS: separate document page; original fields; independent drafts; back/cancel/reload; failed save retains draft; atomic retry; unavailable document protection.');
} finally {
  await browser?.close();
  await server.close();
}
