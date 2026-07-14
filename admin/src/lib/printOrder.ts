/**
 * Order print sheets (owner 2026-07-13):
 *  • printPickList     — ใบจัดสินค้าแบบบิลความร้อน: same roll + width as the
 *    POS receipt (receiptConfig 48/58mm), big type, tick box per line.
 *  • printAddressLabel — ใบจ่าหน้า 100×150มม. (สติ๊กเกอร์/A6): sender (shop
 *    name + phone/address from receiptConfig) + big recipient block + order/
 *    tracking no. The official Flash waybill still comes from Flash's own
 *    system/printer app once the shipment exists there.
 *
 * Both open a print window (user picks the printer; window stays open for
 * reprints). All order-sourced text is HTML-escaped.
 *
 * The window itself must open synchronously, inside the click handler and
 * before any `await` (openPrintWindow) — browsers only let window.open()
 * bypass the popup blocker while still inside a user gesture's call stack.
 * Anything needing an async fetch first (shop name, etc.) resolves after,
 * and gets written into that already-open window.
 */

import type { Order, OrderItem } from './orders';
import { contentMm, getReceiptConfig } from './receiptConfig';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MODE_LABEL: Record<Order['shop_mode'], string> = {
  delivery: 'เดลิเวอรี่',
  online: 'ส่งพัสดุ',
};

/** Open the (still blank) print window. Call this FIRST, synchronously, from
 * the click handler — before awaiting anything — or the browser may silently
 * block it as an unrequested popup. Returns null if it got blocked anyway. */
export function openPrintWindow(): Window | null {
  return window.open('', '_blank', 'width=460,height=760');
}

function writePrint(w: Window, html: string) {
  w.document.write(html);
  w.document.close();
  w.focus();
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', system-ui, sans-serif; color: #000; }
  .muted { color: #333; }
`;

/** ใบจัดสินค้า — thermal bill format on the same roll as the POS receipt. */
export function printPickList(w: Window, order: Order, items: OrderItem[], shopName: string) {
  const cfg = getReceiptConfig();
  const width = contentMm(cfg.paperWidth);
  const pieces = items.reduce((s, i) => s + i.qty, 0);
  const when = new Date(order.placed_at).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const rows = items
    .map(
      (i) => `
      <div class="row">
        <span class="box"></span>
        <span class="nm">${esc(i.name_snapshot)}${i.size_snapshot ? `<span class="muted"> (${esc(i.size_snapshot)})</span>` : ''}</span>
        <span class="qty">×${i.qty}</span>
      </div>`,
    )
    .join('');

  writePrint(w, `<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบจัดสินค้า ${esc(order.order_number)}</title>
  <style>
    ${BASE_CSS}
    @page { size: ${cfg.paperWidth}mm auto; margin: 0; }
    body { width: ${width}mm; margin: 0 auto; padding: 2mm 0 6mm; font-size: 12px; }
    .center { text-align: center; }
    .shop { font-size: 14px; font-weight: 700; }
    .doc { font-size: 15px; font-weight: 800; margin: 1mm 0; }
    .meta { font-size: 11.5px; line-height: 1.5; margin-top: 1mm; }
    .hr { border-top: 1.5px dashed #000; margin: 2mm 0; }
    .row { display: flex; align-items: flex-start; gap: 2mm; padding: 1.6mm 0;
           border-bottom: 1px dashed #888; }
    .box { flex: none; width: 4.2mm; height: 4.2mm; border: 1.8px solid #000;
           border-radius: 1mm; margin-top: 0.6mm; }
    .nm { flex: 1; font-size: 13.5px; font-weight: 700; line-height: 1.35; word-break: break-word; }
    .qty { flex: none; font-size: 16px; font-weight: 800; }
    .total { font-size: 13px; font-weight: 800; text-align: right; margin-top: 2mm; }
    .note { margin-top: 3mm; font-size: 11.5px; }
    .line { display: inline-block; width: 60%; border-bottom: 1px solid #000; }
  </style></head><body>
    <div class="center shop">${esc(shopName)}</div>
    <div class="center doc">ใบจัดสินค้า</div>
    <div class="meta">
      ออเดอร์ <b>${esc(order.order_number)}</b><br>
      ${MODE_LABEL[order.shop_mode]} · ${esc(when)}<br>
      ผู้รับ: ${esc(order.ship_recipient ?? '-')}${order.ship_phone ? `<br>โทร ${esc(order.ship_phone)}` : ''}
    </div>
    <div class="hr"></div>
    ${rows}
    <div class="total">รวม ${items.length} รายการ · ${pieces} ชิ้น</div>
    <div class="note">หมายเหตุ: <span class="line">&nbsp;</span></div>
    <script>window.onload = () => window.print();</script>
  </body></html>`);
}

export function printAddressLabel(
  w: Window,
  order: Order,
  shopName: string,
  trackingNo: string | null,
) {
  const cfg = getReceiptConfig();
  const senderBits = [shopName, cfg.phone && `โทร ${cfg.phone}`, cfg.address]
    .filter(Boolean)
    .map((x) => esc(x as string))
    .join(' · ');
  writePrint(w, `<!doctype html><html lang="th"><head><meta charset="utf-8">
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
    <script>window.onload = () => window.print();</script>
  </body></html>`);
}
