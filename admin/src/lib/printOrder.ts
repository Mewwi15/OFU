/**
 * Order print sheets (owner 2026-07-13):
 *  • printPickList     — ใบจัดสินค้า: big-type packing checklist per order (A4).
 *  • printAddressLabel — ใบจ่าหน้า 100×150มม. (สติ๊กเกอร์/A6): sender + big
 *    recipient block + order/tracking no. This is the shop's own label — the
 *    official Flash waybill still comes from Flash's system/printer app once
 *    the shipment exists there.
 *
 * Both open a print window (user picks the printer; window stays open for
 * reprints). All order-sourced text is HTML-escaped.
 */

import type { Order, OrderItem } from './orders';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MODE_LABEL: Record<Order['shop_mode'], string> = {
  delivery: 'เดลิเวอรี่',
  online: 'ส่งพัสดุ',
};

function openPrint(html: string) {
  const w = window.open('', '_blank', 'width=720,height=860');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', system-ui, sans-serif; color: #111; }
  .muted { color: #555; }
`;

export function printPickList(order: Order, items: OrderItem[], shopName: string) {
  const pieces = items.reduce((s, i) => s + i.qty, 0);
  const when = new Date(order.placed_at).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const rows = items
    .map(
      (i) => `
      <tr>
        <td class="box"><span></span></td>
        <td class="name">${esc(i.name_snapshot)}${i.size_snapshot ? ` <span class="muted">(${esc(i.size_snapshot)})</span>` : ''}</td>
        <td class="qty">× ${i.qty}</td>
      </tr>`,
    )
    .join('');

  openPrint(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบจัดสินค้า ${esc(order.order_number)}</title>
  <style>
    ${BASE_CSS}
    @page { size: A4; margin: 14mm; }
    body { padding: 8px; font-size: 18px; }
    h1 { font-size: 26px; margin-bottom: 2px; }
    .head { display: flex; justify-content: space-between; align-items: baseline;
            border-bottom: 3px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
    .meta { font-size: 16px; line-height: 1.6; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 12px 6px; border-bottom: 1px dashed #999; vertical-align: middle; }
    .box { width: 44px; }
    .box span { display: inline-block; width: 26px; height: 26px; border: 2.5px solid #111; border-radius: 5px; }
    .name { font-size: 20px; font-weight: 600; }
    .qty { font-size: 24px; font-weight: 700; text-align: right; width: 90px; white-space: nowrap; }
    .total { margin-top: 14px; font-size: 18px; font-weight: 700; text-align: right; }
    .note { margin-top: 26px; font-size: 16px; }
    .note .line { display: inline-block; width: 70%; border-bottom: 1.5px solid #777; }
  </style></head><body>
    <div class="head">
      <h1>ใบจัดสินค้า</h1>
      <div>${esc(shopName)}</div>
    </div>
    <div class="meta">
      <b>ออเดอร์ ${esc(order.order_number)}</b> · ${MODE_LABEL[order.shop_mode]} · ${esc(when)}<br>
      ผู้รับ: ${esc(order.ship_recipient ?? '-')} ${order.ship_phone ? `· โทร ${esc(order.ship_phone)}` : ''}
    </div>
    <table>${rows}</table>
    <div class="total">รวม ${items.length} รายการ · ${pieces} ชิ้น</div>
    <div class="note">หมายเหตุ: <span class="line">&nbsp;</span></div>
    <script>window.onload = () => window.print();</script>
  </body></html>`);
}

export function printAddressLabel(
  order: Order,
  shopName: string,
  trackingNo: string | null,
) {
  openPrint(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบจ่าหน้า ${esc(order.order_number)}</title>
  <style>
    ${BASE_CSS}
    @page { size: 100mm 150mm; margin: 6mm; }
    body { width: 88mm; font-size: 14px; }
    .sender { border-bottom: 1.5px solid #111; padding-bottom: 6px; margin-bottom: 10px; font-size: 13px; }
    .to-tag { font-size: 13px; color: #555; margin-bottom: 2px; }
    .name { font-size: 22px; font-weight: 800; line-height: 1.3; }
    .phone { font-size: 19px; font-weight: 700; margin: 2px 0 8px; }
    .addr { font-size: 16px; line-height: 1.55; word-break: break-word; }
    .foot { margin-top: 12px; border-top: 1.5px dashed #666; padding-top: 8px; font-size: 13px; line-height: 1.6; }
  </style></head><body>
    <div class="sender">ผู้ส่ง: ${esc(shopName)}</div>
    <div class="to-tag">ผู้รับ</div>
    <div class="name">${esc(order.ship_recipient ?? '-')}</div>
    <div class="phone">${esc(order.ship_phone ?? '-')}</div>
    <div class="addr">${esc(order.ship_address_text ?? '-')}</div>
    <div class="foot">
      ออเดอร์ ${esc(order.order_number)}<br>
      เลขพัสดุ: ${trackingNo ? esc(trackingNo) : '________________'}
    </div>
    <script>window.onload = () => window.print();</script>
  </body></html>`);
}
