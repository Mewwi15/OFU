/**
 * ใบสั่งซื้อของ — the A4 sheet the owner carries into the wholesaler.
 *
 * Everything here is sized for reading at arm's length while standing in an
 * aisle holding a basket: the quantity to buy is the largest thing on the page,
 * each line has a tick box, and the barcode sits under the name so a doubtful
 * item can be checked against the shelf label.
 *
 * Prints through the same hidden iframe as the order sheets (no second window),
 * and the browser's own print dialog offers "Save as PDF" — so this is both the
 * printout and the PDF, with nothing extra to install.
 */

import { productThumb } from './image';
import { BASE_CSS, printHtml } from './printOrder';

export type BuyListRow = {
  name: string;
  size: string | null;
  barcode: string | null;
  category: string;
  unit: string | null;
  image: string | undefined;
  stock: number;
  buy: number;
  cost: number | null;
};

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function printBuyList(rows: BuyListRow[], shopName: string, coverDays: number) {
  const when = new Date().toLocaleString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const pieces = rows.reduce((s, r) => s + r.buy, 0);
  // Only lines with a known cost can be totalled; say so rather than quietly
  // under-reporting the bill.
  const priced = rows.filter((r) => r.cost != null);
  const estimate = priced.reduce((s, r) => s + (r.cost ?? 0) * r.buy, 0);

  const body = rows
    .map((r, idx) => {
      const img = r.image
        ? `<img src="${esc(productThumb(r.image, 120) ?? r.image)}" alt="">`
        : '<span class="noimg">ไม่มีรูป</span>';
      return `<tr>
        <td class="no">${idx + 1}</td>
        <td class="imgcell">${img}</td>
        <td class="nm">
          ${esc(r.name)}${r.size ? ` <span class="sz">(${esc(r.size)})</span>` : ''}
          <div class="meta">${esc(r.barcode ?? 'ไม่มีบาร์โค้ด')} · ${esc(r.category)}</div>
        </td>
        <td class="left">${r.stock}</td>
        <td class="buy">${r.buy}<span class="unit"> ${esc(r.unit ?? 'ชิ้น')}</span></td>
        <td class="tick"><span class="cbox"></span></td>
      </tr>`;
    })
    .join('');

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบสั่งซื้อของ ${esc(shopName)}</title>
  <style>
    ${BASE_CSS}
    @page { size: A4; margin: 12mm; }
    body { font-size: 15px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2.5px solid #000; padding-bottom: 10px; }
    .shop { font-size: 18px; font-weight: 800; }
    .doc { font-size: 30px; font-weight: 800; margin-top: 2px; }
    .when { text-align: right; font-size: 14px; line-height: 1.7; color: #333; }
    .sum { display: flex; gap: 26px; margin: 14px 0 10px; padding: 12px 16px; border: 2px solid #000; }
    .sum .k { font-size: 13px; color: #444; }
    .sum .v { font-size: 24px; font-weight: 800; line-height: 1.2; }
    .note { font-size: 13px; color: #444; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #444; padding: 9px 10px; vertical-align: middle; }
    th { background: #f0f0f0; font-size: 14px; text-align: center; }
    td.no { text-align: center; width: 34px; font-size: 15px; color: #555; }
    td.imgcell { width: 76px; text-align: center; padding: 5px; }
    td.imgcell img { width: 62px; height: 62px; object-fit: cover; border: 1px solid #ccc; display: block; margin: 0 auto; }
    td.imgcell .noimg { font-size: 11px; color: #999; }
    th.nm, td.nm { text-align: left; }
    td.nm { font-size: 18px; font-weight: 700; line-height: 1.3; }
    td.nm .sz { font-size: 15px; font-weight: 400; }
    td.nm .meta { font-size: 12px; font-weight: 400; color: #555; margin-top: 3px; }
    td.left { text-align: center; width: 78px; font-size: 16px; color: #333; }
    /* The number the trip exists to produce — biggest thing on the sheet. */
    td.buy { text-align: center; width: 96px; font-size: 30px; font-weight: 800; }
    td.buy .unit { font-size: 13px; font-weight: 400; color: #444; }
    td.tick { width: 46px; text-align: center; }
    .cbox { display: inline-block; width: 22px; height: 22px; border: 2px solid #000; }
    tfoot td { font-size: 15px; font-weight: 700; background: #f7f7f7; }
    .foot { margin-top: 16px; display: flex; justify-content: space-between; font-size: 13px; color: #333; }
    .sign { border-top: 1px dotted #666; width: 210px; text-align: center; padding-top: 5px; }
    tr { break-inside: avoid; }
    thead { display: table-header-group; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="shop">${esc(shopName)}</div>
        <div class="doc">ใบสั่งซื้อของ</div>
      </div>
      <div class="when">
        พิมพ์ ${esc(when)}<br>
        เผื่อของให้พอขาย ${coverDays} วัน
      </div>
    </div>

    <div class="sum">
      <div><div class="k">ต้องซื้อ</div><div class="v">${rows.length} รายการ</div></div>
      <div><div class="k">รวมจำนวน</div><div class="v">${pieces.toLocaleString('th-TH')} ชิ้น</div></div>
      <div><div class="k">ประมาณการเงิน${priced.length < rows.length ? ` (${priced.length}/${rows.length} รายการที่รู้ทุน)` : ''}</div><div class="v">${baht(Math.round(estimate))}</div></div>
    </div>

    <div class="note">คำนวณจากยอดขายเฉลี่ย 30 วันล่าสุด · ติ๊กช่องขวาสุดเมื่อหยิบของลงตะกร้าแล้ว</div>

    <table>
      <thead>
        <tr>
          <th>#</th><th>รูป</th><th class="nm">สินค้า</th>
          <th>เหลือ</th><th>ต้องซื้อ</th><th>✓</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="text-align:right">รวม</td>
          <td style="text-align:center">${pieces.toLocaleString('th-TH')}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <div class="foot">
      <div>ราคาประมาณการจากต้นทุนล่าสุดที่บันทึกไว้ อาจต่างจากราคาหน้าร้านส่ง</div>
      <div class="sign">ผู้ซื้อ / วันที่</div>
    </div>
  </body></html>`);
}
