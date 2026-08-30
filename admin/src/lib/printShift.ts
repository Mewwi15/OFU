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


import type { CashLine, CashSummary, ShiftSalesReport } from './api';
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
  openedBy: string | null;
  closedBy: string | null;
  /* บรรทัดกระทบยอดจาก shift_cash_summary (0089) — ใบนี้ต้องพิมพ์สูตรทีละบรรทัด
     ไม่ใช่โชว์แค่ "ขาด 140" ไม่งั้นเวลาไม่ตรงก็ไม่รู้จะไปเพ่งตรงไหน */
  recon: CashSummary | null;
  /* รายงานการขายของรอบ (0091) — ขายอะไรไปบ้าง สต๊อกขยับเท่าไหร่ กำไรเท่าไหร่ */
  sales: ShiftSalesReport | null;
  openingBreakdown: CashLine[] | null;
  closingBreakdown: CashLine[] | null;
  top: { name: string; qty: number; amount: number }[];
};

export function printShiftReport(r: ShiftReport, shopName: string) {
  const fmt = (iso: string | null) => (iso ? d(iso).format('DD/MM/YYYY HH:mm') : '—');
  const verdict =
    r.overShort === 0 ? 'พอดีเป๊ะ' : r.overShort < 0 ? `ขาด ${baht(-r.overShort)}` : `เกิน ${baht(r.overShort)}`;
  const verdictColor = r.overShort === 0 ? '#1E7A46' : r.overShort < 0 ? '#B3261E' : '#8A5A00';

  /* ตารางเทียบชนิดแบงก์ระหว่างเปิดกับปิดรอบ (เจ้าของสั่ง 30 ส.ค. 2026)
   *
   * ยอดรวมตรงหรือไม่ตรงไม่เกี่ยวกับชนิดแบงก์เลย — ทอน 84 บาทเป็นแบงก์ 50+20+10
   * หรือเป็นเหรียญบาท 84 เหรียญ ลิ้นชักก็ได้เพิ่มเท่ากัน ตารางนี้จึงไม่ได้มีไว้
   * ตรวจว่าเงินตรงไหม แต่มีไว้ตอบสองคำถามที่ยอดรวมตอบไม่ได้:
   *   1. พรุ่งนี้ต้องเตรียมแบงก์ย่อยเพิ่มไหม (ชนิดไหนร่อยหรอ)
   *   2. ถ้าเงินขาด หายเป็นแบงก์อะไร ไปไล่ต่อได้ถูกที่
   */
  const denomLabel = (v: number) =>
    v >= 20 ? `ธนบัตร ${v.toLocaleString('th-TH')}` : v >= 1 ? `เหรียญ ${v}` : `เหรียญ ${v * 100} สต.`;

  const denoms = [
    ...new Set([...(r.openingBreakdown ?? []), ...(r.closingBreakdown ?? [])].map((l) => l.denom)),
  ].sort((a, b) => b - a);

  const countAt = (list: CashLine[] | null, denom: number) =>
    list?.find((l) => l.denom === denom)?.count ?? 0;

  const cashRows = denoms.map((dn) => {
    const o = countAt(r.openingBreakdown, dn);
    const c = countAt(r.closingBreakdown, dn);
    const delta = c - o;
    return `<tr>
      <td>${denomLabel(dn)}</td>
      <td class="num">${o}</td>
      <td class="num">${c}</td>
      <td class="num" style="color:${delta < 0 ? '#B3261E' : delta > 0 ? '#1E7A46' : '#666'}">
        ${delta > 0 ? '+' : ''}${delta}
      </td>
    </tr>`;
  }).join('');

  /* รายการสินค้าที่ขายทั้งหมด ไม่ตัดที่ 5 อันดับเหมือนเดิม — เจ้าของถามว่า "ขายอะไร
   * ออกไปบ้าง" ซึ่ง 5 อันดับตอบไม่ได้ถ้ารอบนั้นขายของ 40 ชนิด
   * ใช้ของจาก shift_sales_report ถ้ามี ไม่มีค่อยถอยไปใช้ top เดิม (ใบเก่าที่พิมพ์ซ้ำ) */
  const soldRows = (r.sales?.items ?? []).map((t, i) => `
    <tr>
      <td class="no">${i + 1}</td>
      <td>${esc(t.name)}</td>
      <td class="num">${t.qty}</td>
      <td class="num">${baht(t.amount)}</td>
    </tr>`).join('');

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
        เปิดรอบ ${fmt(r.openedAt)}${r.openedBy ? ` · พนักงาน ${esc(r.openedBy)}` : ''}<br>
        ปิดรอบ ${fmt(r.closedAt)}${r.closedBy ? ` · พนักงาน ${esc(r.closedBy)}` : ''}
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

    <h2>ลิ้นชักเงิน — ที่มาของยอด "ควรมี" ทีละบรรทัด</h2>
    <table class="kv">
      ${line('เงินตั้งต้น', baht(r.recon?.opening ?? r.openingFloat))}
      ${line('+ ขายรับเป็นเงินสด', baht(r.recon?.sales ?? r.cash)) }
      ${(r.recon?.cod ?? 0) !== 0 ? line('+ เงินสด COD', baht(r.recon?.cod ?? 0)) : ''}
      ${(r.recon?.refunds ?? 0) !== 0 ? line('− คืนเงินลูกค้า', `- ${baht(r.recon?.refunds ?? 0)}`) : ''}
      ${(r.recon?.paid_in ?? 0) !== 0 ? line('+ นำเงินเข้าระหว่างรอบ', baht(r.recon?.paid_in ?? 0)) : ''}
      ${(r.recon?.paid_out ?? 0) !== 0 ? line('− นำเงินออกระหว่างรอบ', `- ${baht(r.recon?.paid_out ?? 0)}`) : ''}
      ${line('ควรมีในลิ้นชัก', baht(r.expected), true)}
      ${line('นับได้จริง', baht(r.counted), true)}
    </table>

    <div class="verdict">
      <span class="t">ผลต่าง</span>
      <span class="v">${verdict}</span>
    </div>

    ${cashRows ? `<h2>ชนิดเงินในลิ้นชัก — เทียบเปิดรอบกับปิดรอบ</h2>
    <table class="top">
      <thead><tr><th>ชนิด</th><th>เปิดรอบ</th><th>ปิดรอบ</th><th>เปลี่ยนไป</th></tr></thead>
      <tbody>${cashRows}</tbody>
    </table>
    <p style="font-size:12px;color:#555;margin-top:5px">
      ติดลบมาก = ชนิดนั้นร่อยหรอ ควรเตรียมเพิ่มสำหรับรอบหน้า
    </p>` : ''}

    ${r.sales ? `<h2>กำไรในรอบ</h2>
    <table class="kv">
      ${line('ยอดขาย (หักคืนแล้ว)', baht(r.sales.revenue))}
      ${line('ต้นทุนสินค้า', `- ${baht(r.sales.cost)}`)}
      ${line('กำไรขั้นต้น', baht(r.sales.gross), true)}
    </table>
    ${r.sales.cost_missing ? `<p style="font-size:12px;color:#B3261E;margin-top:5px">
      มีสินค้าบางรายการไม่ได้บันทึกต้นทุนไว้ กำไรที่แสดงจึงสูงกว่าความจริง
    </p>` : ''}

    <h2>สต๊อกที่ขยับในรอบ</h2>
    <table class="kv">
      ${line('ตัดออกจากการขาย', `- ${r.sales.stock.sold} ชิ้น`)}
      ${r.sales.stock.returned ? line('คืนเข้าจากการคืนเงิน', `+ ${r.sales.stock.returned} ชิ้น`) : ''}
      ${r.sales.stock.received ? line('รับของเข้า', `+ ${r.sales.stock.received} ชิ้น`) : ''}
      ${r.sales.stock.adjusted ? line('ปรับสต๊อกด้วยมือ', `${r.sales.stock.adjusted > 0 ? '+' : ''}${r.sales.stock.adjusted} ชิ้น`) : ''}
      ${line('สต๊อกเปลี่ยนสุทธิ',
        `${(-r.sales.stock.sold + r.sales.stock.returned + r.sales.stock.received + r.sales.stock.adjusted) > 0 ? '+' : ''}${
          -r.sales.stock.sold + r.sales.stock.returned + r.sales.stock.received + r.sales.stock.adjusted} ชิ้น`, true)}
    </table>` : ''}

    ${soldRows ? `<h2>สินค้าที่ขายในรอบ (ทั้งหมด ${r.sales?.items.length} รายการ)</h2>
    <table class="top">
      <thead><tr><th>#</th><th>สินค้า</th><th>จำนวน</th><th>ยอด</th></tr></thead>
      <tbody>${soldRows}</tbody>
    </table>` : topRows ? `<h2>สินค้าขายดีในรอบ</h2>
    <table class="top">
      <thead><tr><th>#</th><th>สินค้า</th><th>จำนวน</th><th>ยอด</th></tr></thead>
      <tbody>${topRows}</tbody>
    </table>` : ''}

    <div class="sign">
      <div>ผู้นับเงิน${r.closedBy ? ` (${esc(r.closedBy)})` : ''}</div>
      <div>ผู้ตรวจสอบ</div>
    </div>
  </body></html>`);
}
