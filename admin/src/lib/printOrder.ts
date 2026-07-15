/**
 * Order print sheets (owner 2026-07-13):
 *  • printPickList     — ใบจัดสินค้า A4: product photo + qty per line, plus the
 *    recipient / shipping block. Big type for arm's-length reading while packing.
 *  • printAddressLabel — ใบจ่าหน้า 100×150มม. (สติ๊กเกอร์/A6): sender (shop
 *    name + phone/address from receiptConfig) + big recipient block + order/
 *    tracking no. The official Flash waybill still comes from Flash's own
 *    system/printer app once the shipment exists there.
 *
 * Both print through a HIDDEN IFRAME (no second popup window — owner: "ทำไมมัน
 * เปิด 2 หน้าต่าง"), so the only thing that appears is the browser's own print
 * dialog. All order-sourced text is HTML-escaped. No popup-blocker dance needed
 * (an iframe isn't a popup), so these can be called after an await.
 */

import { productThumb } from './image';
import type { Order, OrderItem } from './orders';
import { getReceiptConfig } from './receiptConfig';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MODE_LABEL: Record<Order['shop_mode'], string> = {
  delivery: 'เดลิเวอรี่',
  online: 'ส่งพัสดุ',
};

/** Print `html` via an off-screen iframe: fires the print dialog once the
 * content (incl. images) has loaded, then removes the iframe afterwards. No
 * visible popup window. A timeout fallback prints even if `onload` is missed
 * (e.g. a slow/broken image) and a longer one guarantees cleanup. */
function printHtml(html: string) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore — nothing else we can do */
    }
  };
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.onafterprint = cleanup;
  win.onload = doPrint;
  setTimeout(doPrint, 2500); // fallback if onload never fires
  setTimeout(cleanup, 60000); // safety net so the iframe never lingers
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', system-ui, sans-serif; color: #000; }
  .muted { color: #333; }
`;

/** ใบจัดสินค้า — full A4 pack sheet: product photo + qty per line, plus the
 * recipient / shipping block so the packer sees whose order it is and where it
 * ships (owner 2026-07-16, replacing the earlier thermal-roll version). */
export function printPickList(order: Order, items: OrderItem[], shopName: string) {
  const pieces = items.reduce((s, i) => s + i.qty, 0);
  const when = new Date(order.placed_at).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const rows = items
    .map((i, idx) => {
      const thumb = productThumb(i.image, 120);
      const img = thumb
        ? `<img src="${esc(thumb)}" alt="">`
        : `<span class="noimg">ไม่มีรูป</span>`;
      return `
      <tr>
        <td class="no">${idx + 1}</td>
        <td class="imgcell">${img}</td>
        <td class="nm">${esc(i.name_snapshot)}${i.size_snapshot ? `<div class="sz">${esc(i.size_snapshot)}</div>` : ''}</td>
        <td class="qty">${i.qty}</td>
        <td class="tick"><span class="cbox"></span></td>
      </tr>`;
    })
    .join('');

  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบจัดสินค้า ${esc(order.order_number)}</title>
  <style>
    ${BASE_CSS}
    @page { size: A4; margin: 14mm; }
    body { font-size: 15px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2.5px solid #000; padding-bottom: 10px; }
    .shop { font-size: 19px; font-weight: 800; }
    .doc { font-size: 30px; font-weight: 800; margin-top: 2px; }
    .ord { text-align: right; font-size: 15px; line-height: 1.7; }
    .to { margin: 16px 0; padding: 14px 18px; border: 2px solid #000; }
    .to .tag { font-size: 13px; color: #555; }
    .to .name { font-size: 24px; font-weight: 800; line-height: 1.3; }
    .to .phone { font-size: 19px; font-weight: 700; margin-top: 2px; }
    .to .addr { font-size: 17px; line-height: 1.5; margin-top: 5px; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #444; padding: 12px 12px; vertical-align: middle; }
    th { background: #f0f0f0; font-size: 15px; text-align: center; }
    th.nm, td.nm { text-align: left; }
    td.no { text-align: center; width: 36px; font-size: 16px; color: #555; }
    td.imgcell { width: 116px; text-align: center; padding: 6px; }
    td.imgcell img { width: 96px; height: 96px; object-fit: cover; border: 1px solid #ccc; display: block; margin: 0 auto; }
    td.imgcell .noimg { font-size: 12px; color: #999; }
    td.nm { font-size: 19px; font-weight: 700; line-height: 1.35; }
    td.nm .sz { font-size: 15px; font-weight: 400; color: #333; margin-top: 2px; }
    td.qty { text-align: center; font-size: 30px; font-weight: 800; width: 90px; }
    td.tick { text-align: center; width: 80px; }
    td.tick .cbox { display: inline-block; width: 30px; height: 30px; border: 2.5px solid #000; }
    .foot { display: flex; justify-content: space-between; align-items: center;
            margin-top: 14px; font-size: 17px; font-weight: 700; }
    .note { margin-top: 20px; font-size: 15px; }
    .line { display: inline-block; width: 70%; border-bottom: 1px solid #000; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="shop">${esc(shopName)}</div>
        <div class="doc">ใบจัดสินค้า</div>
      </div>
      <div class="ord">
        ออเดอร์ <b>${esc(order.order_number)}</b><br>
        ${MODE_LABEL[order.shop_mode]}<br>
        ${esc(when)}
      </div>
    </div>

    <div class="to">
      <div class="tag">ผู้รับ / ส่งที่</div>
      <div class="name">${esc(order.ship_recipient ?? '-')}</div>
      ${order.ship_phone ? `<div class="phone">โทร ${esc(order.ship_phone)}</div>` : ''}
      <div class="addr">${esc(order.ship_address_text ?? '-')}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>รูป</th>
          <th class="nm">รายการสินค้า</th>
          <th>จำนวน</th>
          <th>จัดแล้ว</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="foot">
      <span>รวม ${items.length} รายการ · ${pieces} ชิ้น</span>
    </div>
    <div class="note">หมายเหตุ: <span class="line">&nbsp;</span></div>
  </body></html>`);
}

export function printAddressLabel(order: Order, shopName: string, trackingNo: string | null) {
  const cfg = getReceiptConfig();
  const senderBits = [shopName, cfg.phone && `โทร ${cfg.phone}`, cfg.address]
    .filter(Boolean)
    .map((x) => esc(x as string))
    .join(' · ');
  printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบจ่าหน้า ${esc(order.order_number)}</title>
  <style>
    ${BASE_CSS}
    @page { size: 100mm 150mm; margin: 6mm; }
    body { width: 88mm; font-size: 14px; }
    .sender { border-bottom: 1.5px solid #111; padding-bottom: 6px; margin-bottom: 10px;
              font-size: 12.5px; line-height: 1.5; }
    .to-tag { font-size: 13px; color: #555; margin-bottom: 2px; }
    .name { font-size: 22px; font-weight: 800; line-height: 1.3; }
    .phone { font-size: 19px; font-weight: 700; margin: 2px 0 8px; }
    .addr { font-size: 16px; line-height: 1.55; word-break: break-word; }
    .foot { margin-top: 12px; border-top: 1.5px dashed #666; padding-top: 8px;
            font-size: 13px; line-height: 1.6; }
  </style></head><body>
    <div class="sender">ผู้ส่ง: ${senderBits}</div>
    <div class="to-tag">ผู้รับ</div>
    <div class="name">${esc(order.ship_recipient ?? '-')}</div>
    <div class="phone">${esc(order.ship_phone ?? '-')}</div>
    <div class="addr">${esc(order.ship_address_text ?? '-')}</div>
    <div class="foot">
      ออเดอร์ ${esc(order.order_number)}<br>
      เลขพัสดุ: ${trackingNo ? esc(trackingNo) : '________________'}
    </div>
  </body></html>`);
}
