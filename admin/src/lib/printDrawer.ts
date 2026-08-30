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

import { printHtml } from './printOrder';
import { contentMm, getReceiptConfig } from './receiptConfig';
import { d } from './time';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type OpenSlip = {
  shopName: string;
  openedAt: string;
  openingFloat: number;
  cashier: string;
};

export function printShiftOpenSlip(s: OpenSlip) {
  const cfg = getReceiptConfig();
  const cw = contentMm(cfg.paperWidth);

  const row = (label: string, value: string) =>
    `<div class="r"><span>${label}</span><span class="v">${value}</span></div>`;

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบเปิดรอบ</title>
  <style>
    /* ต้องเป็นความยาวสองค่าเสมอ — "48mm auto" ไม่ถูกต้องตามสเปก Chrome จะถอย
       ไปใช้ Letter เงียบ ๆ แล้วได้กระดาษเปล่ายาวมาก (บทเรียนเดียวกับ Receipt.tsx) */
    @page { size: ${cfg.paperWidth}mm 210mm; margin: 0; }
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
    .float { margin-top: 5px; border-top: 1px solid #000; padding-top: 4px;
             display: flex; justify-content: space-between; align-items: baseline; }
    .float .t { font-size: 10px; font-weight: 700; }
    .float .n { font-size: 15px; font-weight: 700; }
    .note { margin-top: 6px; text-align: center; font-size: 8px; }
    .sign { margin-top: 9mm; border-top: 1px dotted #000; padding-top: 3px;
            text-align: center; font-size: 8px; }
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
