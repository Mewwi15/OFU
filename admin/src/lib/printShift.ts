/**
 * ใบสรุปปิดรอบ (Z-report) — กระดาษที่เก็บเข้าแฟ้มตอนปิดร้าน
 *
 * มีไว้เพราะตอนนี้พอกดปิดรอบแล้ว ตัวเลขหายไปจากจอทันที ถ้าเงินขาดแล้วอยาก
 * ย้อนดูว่ารอบนั้นขายอะไรไปบ้าง ต้องไปไล่หน้าบิลขายเอง ใบนี้ตรึงทุกอย่างของ
 * รอบไว้บนกระดาษแผ่นเดียว: เวลาเปิด-ปิด · เงินตั้งต้น · ยอดขายแยกวิธีจ่าย ·
 * ลิ้นชักควรมีเท่าไหร่ · นับได้จริงเท่าไหร่ · ขาด/เกิน · ช่องเซ็นชื่อผู้นับ
 *
 * พิมพ์ผ่าน iframe ซ่อนตัวเดียวกับใบอื่น ๆ และกด "Save as PDF" ในกล่องพิมพ์
 * ของเบราว์เซอร์เพื่อเก็บเป็นไฟล์ได้เลย
 */


import { BASE_CSS, printHtml } from './printOrder';
import { d } from './time';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type ShiftReport = {
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  cash: number;
  promptpay: number;
  storeCredit: number;
  refunds: number;
  discount: number;
  bills: number;
  gross: number;
  expected: number;
  counted: number;
  overShort: number;
  top: { name: string; qty: number; amount: number }[];
};

export function printShiftReport(r: ShiftReport, shopName: string) {
  const fmt = (iso: string | null) => (iso ? d(iso).format('DD/MM/YYYY HH:mm') : '—');
  const verdict =
    r.overShort === 0 ? 'พอดีเป๊ะ' : r.overShort < 0 ? `ขาด ${baht(-r.overShort)}` : `เกิน ${baht(r.overShort)}`;
  const verdictColor = r.overShort === 0 ? '#1E7A46' : r.overShort < 0 ? '#B3261E' : '#8A5A00';

  const topRows = r.top.slice(0, 10).map((t, i) => `
    <tr>
      <td class="no">${i + 1}</td>
      <td>${esc(t.name)}</td>
      <td class="num">${t.qty}</td>
      <td class="num">${baht(t.amount)}</td>
    </tr>`).join('');

  const line = (label: string, value: string, strong = false) => `
    <tr class="${strong ? 'strong' : ''}">
      <td class="lbl">${label}</td><td class="val">${value}</td>
    </tr>`;

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบสรุปปิดรอบ ${esc(shopName)}</title>
  <style>
    ${BASE_CSS}
    @page { size: A4; margin: 16mm; }
    body { font-size: 15px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2.5px solid #000; padding-bottom: 10px; }
    .shop { font-size: 18px; font-weight: 800; }
    .doc { font-size: 28px; font-weight: 800; margin-top: 2px; }
    .when { text-align: right; font-size: 14px; line-height: 1.8; color: #333; }
    h2 { font-size: 14px; margin: 18px 0 6px; color: #444; letter-spacing: .04em; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv td { padding: 7px 10px; border-bottom: 1px solid #ddd; }
    table.kv td.lbl { color: #333; }
    table.kv td.val { text-align: right; white-space: nowrap; }
    table.kv tr.strong td { font-weight: 800; font-size: 17px; border-bottom: 2px solid #000; }
    .verdict { margin-top: 14px; padding: 14px 18px; border: 2.5px solid ${verdictColor};
               display: flex; justify-content: space-between; align-items: center; }
    .verdict .t { font-size: 14px; color: #333; }
    .verdict .v { font-size: 30px; font-weight: 800; color: ${verdictColor}; }
    table.top { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.top th, table.top td { border: 1px solid #444; padding: 7px 9px; font-size: 14px; }
    table.top th { background: #f0f0f0; }
    table.top td.no { text-align: center; width: 32px; color: #555; }
    table.top td.num { text-align: right; white-space: nowrap; width: 92px; }
    .sign { margin-top: 34px; display: flex; gap: 40px; }
    .sign div { flex: 1; border-top: 1px dotted #666; padding-top: 6px; text-align: center; font-size: 13px; color: #333; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="shop">${esc(shopName)}</div>
        <div class="doc">ใบสรุปปิดรอบ</div>
      </div>
      <div class="when">
        เปิดรอบ ${fmt(r.openedAt)}<br>
        ปิดรอบ ${fmt(r.closedAt)}
      </div>
    </div>

    <h2>ยอดขายในรอบ</h2>
    <table class="kv">
      ${line('จำนวนบิล', `${r.bills} บิล`)}
      ${line('เงินสด', baht(r.cash))}
      ${line('โอน / PromptPay', baht(r.promptpay))}
      ${line('เครดิตร้าน', baht(r.storeCredit))}
      ${line('ส่วนลด', `- ${baht(r.discount)}`)}
      ${line('คืนเงิน', `- ${baht(r.refunds)}`)}
      ${line('ยอดขายรวม', baht(r.gross), true)}
    </table>

    <h2>ลิ้นชักเงิน</h2>
    <table class="kv">
      ${line('เงินตั้งต้น', baht(r.openingFloat))}
      ${line('เงินสดรับในรอบ', baht(r.cash))}
      ${line('ควรมีในลิ้นชัก', baht(r.expected), true)}
      ${line('นับได้จริง', baht(r.counted), true)}
    </table>

    <div class="verdict">
      <span class="t">ผลต่าง</span>
      <span class="v">${verdict}</span>
    </div>

    ${topRows ? `<h2>สินค้าขายดีในรอบ</h2>
    <table class="top">
      <thead><tr><th>#</th><th>สินค้า</th><th>จำนวน</th><th>ยอด</th></tr></thead>
      <tbody>${topRows}</tbody>
    </table>` : ''}

    <div class="sign">
      <div>ผู้นับเงิน</div>
      <div>ผู้ตรวจสอบ</div>
    </div>
  </body></html>`);
}
