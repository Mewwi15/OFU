/**
 * ใบเปิดรอบ — สลิปสั้น ๆ บนกระดาษความร้อน ที่มีหน้าที่จริงคือ "ทำให้ลิ้นชักเด้ง"
 *
 * ลิ้นชักไม่ได้ต่อกับคอม มันเสียบอยู่ที่ช่อง RJ11 ท้ายเครื่องพิมพ์ใบเสร็จ พอไดรเวอร์
 * เครื่องพิมพ์ถูกตั้งเป็น "เปิดลิ้นชักตอนพิมพ์" ทุกงานพิมพ์ที่วิ่งเข้าเครื่องนั้นจะ
 * กระตุกสลักให้เปิดเอง — เราจึงไม่ต้องยิง ESC/POS เอง (ซึ่งเบราว์เซอร์ทำไม่ได้อยู่แล้ว)
 * แค่ "มีอะไรพิมพ์" ก็พอ
 *
 * ตอนขายเงินสดลิ้นชักเปิดอยู่แล้วเพราะมีใบเสร็จออก แต่ตอนกดเปิดรอบเดิมไม่มีอะไร
 * พิมพ์เลย ลิ้นชักเลยไม่เด้ง ทั้งที่เป็นจังหวะที่ต้องเอาเงินทอนใส่ — ใบนี้มาอุดตรงนั้น
 * และได้ของแถมเป็นหลักฐานว่าใครเปิดรอบ ตั้งต้นเท่าไหร่ ติดไว้กับม้วนใบเสร็จของวันนั้น
 *
 * ใช้ค่ากระดาษต่อเครื่องชุดเดียวกับใบเสร็จ (receiptConfig) — ถ้าตั้งไว้ 58mm
 * สลิปนี้ก็ต้อง 58mm ไม่งั้นเครื่องพิมพ์ตีกลับเป็น Letter แล้วพ่นกระดาษยาวเป็นเมตร
 */

import type { CountLine } from '../components/CashCountModal';
import { printHtml } from './printOrder';
import { contentMm, getReceiptConfig } from './receiptConfig';
import { d } from './time';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** สไตล์ร่วมของสลิปทั้งสองใบ — ตัวเดียวกันเป๊ะ เพราะมันคือกระดาษม้วนเดียวกัน */
const slipCss = (paperWidth: number, cw: number) => `
    /* ต้องเป็นความยาวสองค่าเสมอ — "48mm auto" ไม่ถูกต้องตามสเปก Chrome จะถอย
       ไปใช้ Letter เงียบ ๆ แล้วได้กระดาษเปล่ายาวมาก (บทเรียนเดียวกับ Receipt.tsx) */
    @page { size: ${paperWidth}mm 210mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${cw}mm; margin: 0 auto; padding: 2mm 0 6mm;
      font-family: 'Mitr', system-ui, 'Noto Sans Thai', sans-serif;
      font-size: 9px; line-height: 1.45; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .shop { text-align: center; font-size: 12px; font-weight: 700; line-height: 1.25; }
    .doc { text-align: center; font-size: 11px; font-weight: 700; margin-top: 3px;
           border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; }
    .r { display: flex; justify-content: space-between; gap: 4mm; margin-top: 3px; }
    .r .v { font-weight: 700; text-align: right; white-space: nowrap; }
    .note { margin-top: 6px; text-align: center; font-size: 8px; }
    .sign { margin-top: 9mm; border-top: 1px dotted #000; padding-top: 3px;
            text-align: center; font-size: 8px; }`;

const row = (label: string, value: string) =>
  `<div class="r"><span>${label}</span><span class="v">${value}</span></div>`;

export type OpenSlip = {
  shopName: string;
  openedAt: string;
  openingFloat: number;
  cashier: string;
};

export function printShiftOpenSlip(s: OpenSlip) {
  const cfg = getReceiptConfig();
  const cw = contentMm(cfg.paperWidth);

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบเปิดรอบ</title>
  <style>${slipCss(cfg.paperWidth, cw)}
    .float { margin-top: 5px; border-top: 1px solid #000; padding-top: 4px;
             display: flex; justify-content: space-between; align-items: baseline; }
    .float .t { font-size: 10px; font-weight: 700; }
    .float .n { font-size: 15px; font-weight: 700; }
  </style></head><body>
    <div class="shop">${esc(s.shopName)}</div>
    <div class="doc">เปิดรอบขาย</div>
    ${row('วันที่', d(s.openedAt).format('DD/MM/YYYY'))}
    ${row('เวลา', `${d(s.openedAt).format('HH:mm')} น.`)}
    ${s.cashier ? row('พนักงาน', esc(s.cashier)) : ''}
    <div class="float">
      <span class="t">เงินตั้งต้น</span>
      <span class="n">${baht(s.openingFloat)}</span>
    </div>
    <div class="note">เก็บใบนี้ไว้กับม้วนใบเสร็จของรอบ</div>
    <div class="sign">ผู้เปิดรอบ</div>
  </body></html>`);
}

export type NoSaleSlip = {
  shopName: string;
  at: string;
  cashier: string;
  reason: string;
  /** เปิดเปล่าเป็นครั้งที่เท่าไหร่ของรอบนี้ — null ถ้ากดตอนไม่มีรอบเปิดอยู่ */
  seq: number | null;
};

/**
 * สลิปเปิดลิ้นชักเปล่า — พิมพ์เพื่อให้ลิ้นชักเด้ง และเพื่อให้มีกระดาษคาอยู่ในม้วน
 *
 * ตั้งใจให้พิมพ์ครั้งที่เท่าไหร่ลงไปด้วย เพราะม้วนใบเสร็จคือหลักฐานที่แก้ย้อนหลัง
 * ไม่ได้ ต่างจากในฐานข้อมูลที่แอดมินมีสิทธิ์ยุ่งได้ ถ้าสองที่ไม่ตรงกันแปลว่ามีคน
 * ไปยุ่ง — เป็นการตรวจสอบไขว้ที่ได้มาฟรีจากการที่ต้องพิมพ์อยู่แล้ว
 */
export function printNoSaleSlip(s: NoSaleSlip) {
  const cfg = getReceiptConfig();
  const cw = contentMm(cfg.paperWidth);

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>เปิดลิ้นชัก</title>
  <style>${slipCss(cfg.paperWidth, cw)}
    .why { margin-top: 5px; border-top: 1px solid #000; padding-top: 4px;
           font-size: 10px; font-weight: 700; text-align: center;
           overflow-wrap: anywhere; }
  </style></head><body>
    <div class="shop">${esc(s.shopName)}</div>
    <div class="doc">เปิดลิ้นชัก (ไม่มีการขาย)</div>
    ${row('วันที่', d(s.at).format('DD/MM/YYYY'))}
    ${row('เวลา', `${d(s.at).format('HH:mm')} น.`)}
    ${s.cashier ? row('ผู้เปิด', esc(s.cashier)) : ''}
    ${s.seq != null ? row('ครั้งที่', `${s.seq} ของรอบนี้`) : ''}
    <div class="why">${esc(s.reason) || 'ไม่ระบุเหตุผล'}</div>
    <div class="note">บันทึกไว้ในระบบแล้ว</div>
    <div class="sign">ผู้เปิดลิ้นชัก</div>
  </body></html>`);
}

/**
 * สลิปสั้นตอนกดนับเงินเปิดรอบ — มีหน้าที่เดียวคือทำให้ลิ้นชักเด้งก่อนนับ
 *
 * เจ้าของทัก 30 ส.ค. 2026 ว่ากด "เริ่มนับ" แล้วลิ้นชักไม่เปิด ซึ่งเป็นลำดับที่ผม
 * วางผิดเอง — เดิมพิมพ์ใบเปิดรอบตอนกดเปิดรอบเสร็จ (คิดถึงแค่จังหวะเอาเงินทอนใส่)
 * ลืมไปว่าก่อนหน้านั้นต้องนับของที่อยู่ในลิ้นชักก่อน ซึ่งเปิดลิ้นชักไม่ได้เลย
 *
 * ตั้งใจให้สั้นที่สุดเท่าที่ยังอ่านรู้เรื่อง เพราะมันคือกระดาษที่พ่นออกมาเพื่อ
 * กระตุกสลักเท่านั้น ใบเปิดรอบเต็ม ๆ ที่มียอดเงินยังพิมพ์ตอนจบเหมือนเดิม
 */
export function printCountKickSlip(shopName: string, cashier: string) {
  const cfg = getReceiptConfig();
  const cw = contentMm(cfg.paperWidth);
  const at = new Date().toISOString();

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>นับเงินเปิดรอบ</title>
  <style>${slipCss(cfg.paperWidth, cw)}
    body { padding: 2mm 0 3mm; }
  </style></head><body>
    <div class="shop">${esc(shopName)}</div>
    <div class="doc">นับเงินเปิดรอบ</div>
    ${row('เวลา', `${d(at).format('DD/MM HH:mm')} น.`)}
    ${cashier ? row('ผู้นับ', esc(cashier)) : ''}
  </body></html>`);
}

const denomLabel = (v: number) =>
  v >= 20 ? `ธนบัตร ${v.toLocaleString('th-TH')}` : v >= 1 ? `เหรียญ ${v}` : `เหรียญ ${v * 100} สต.`;

/**
 * ใบนับเงินในลิ้นชัก — แจกแจงทีละชนิดว่าแบงก์อะไรกี่ใบ รวมเท่าไหร่
 *
 * เจ้าของสั่ง 30 ส.ค. 2026: นับเสร็จถึงขั้นที่ 3 ต้องปริ้นได้ว่าเงินในลิ้นชักมีเท่าไหร่
 *
 * ตั้งใจแจกแจงทีละชนิด ไม่ใช่พิมพ์แต่ยอดรวม เพราะยอดรวมอย่างเดียวตรวจย้อนหลังไม่ได้
 * ว่านับพลาดตรงไหน ถ้าพรุ่งนี้เงินไม่ตรง กระดาษใบนี้บอกได้ว่าเมื่อวานนับแบงก์พัน
 * ไว้กี่ใบ แล้วไปไล่เทียบกับของจริงได้ทันที
 */
export function printCashCountSheet(p: {
  shopName: string;
  at: string;
  cashier: string;
  lines: CountLine[];
  total: number;
}) {
  const cfg = getReceiptConfig();
  const cw = contentMm(cfg.paperWidth);

  const rows = p.lines
    .map((l) => `<tr>
      <td>${denomLabel(l.denom)}</td>
      <td class="c">${l.count}</td>
      <td class="n">${(l.denom * l.count).toLocaleString('th-TH')}</td>
    </tr>`)
    .join('');

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบนับเงินในลิ้นชัก</title>
  <style>${slipCss(cfg.paperWidth, cw)}
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    td { padding: 2px 0; font-size: 9px; }
    td.c { text-align: center; width: 22%; }
    td.n { text-align: right; width: 30%; white-space: nowrap; }
    thead td { font-weight: 700; border-bottom: 1px solid #000; }
    .sum { margin-top: 5px; border-top: 1px solid #000; padding-top: 4px;
           display: flex; justify-content: space-between; align-items: baseline; }
    .sum .t { font-size: 10px; font-weight: 700; }
    .sum .n { font-size: 16px; font-weight: 700; }
  </style></head><body>
    <div class="shop">${esc(p.shopName)}</div>
    <div class="doc">ใบนับเงินในลิ้นชัก</div>
    ${row('เวลา', `${d(p.at).format('DD/MM HH:mm')} น.`)}
    ${p.cashier ? row('ผู้นับ', esc(p.cashier)) : ''}
    <table>
      <thead><tr><td>ชนิด</td><td class="c">จำนวน</td><td class="n">รวม</td></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">— ไม่มี —</td></tr>'}</tbody>
    </table>
    <div class="sum">
      <span class="t">รวมทั้งสิ้น</span>
      <span class="n">${baht(p.total)}</span>
    </div>
    <div class="sign">ผู้นับเงิน</div>
  </body></html>`);
}
