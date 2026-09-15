import type { ShopInfo } from '../lib/api';
import { contentMm, useReceiptConfig } from '../lib/receiptConfig';
import { Barcode } from './Barcode';

export type ReceiptLine = { name: string; size: string | null; qty: number; unitPrice: number; lineTotal: number };

export type ReceiptProps = {
  shop: ShopInfo;
  saleNumber: string;
  at: string;
  taxInvoiceNo?: string | null;
  customerName?: string | null;
  customerTaxId?: string | null;
  items: ReceiptLine[];
  /* ออเดอร์ในแอปมีค่าส่ง — ถ้าไม่มีบรรทัดนี้ ยอดสินค้ากับยอดสุทธิบนบิลจะไม่เท่ากันแล้ว
     ลูกค้าเถียงไม่ได้ว่าส่วนต่างมาจากไหน (บิลหน้าร้านไม่มีค่าส่ง จึงเป็น optional) */
  deliveryFee?: number | null;
  // Nullable on purpose: a replayed sale (double-tap / re-pay) can arrive with
  // these missing if it came from an older create_pos_sale, and a receipt that
  // renders a stale/undefined amount must degrade to 0, never crash the till
  // (H5). The DB replay contract is the real fix; this is defence in depth.
  subtotal: number | null | undefined;
  discount: number | null | undefined;
  vatAmount: number | null | undefined;
  netAmount: number | null | undefined;
  total: number | null | undefined;
  paymentMethod: string; // 'cash' | 'promptpay' | 'store_credit'
  cashPaid?: number | null; // amount tendered (only known right after a cash sale)
  change?: number | null;
  offline?: boolean;
};

const PAY_LABEL: Record<string, string> = {
  cash: 'เงินสด',
  promptpay: 'พร้อมเพย์',
  store_credit: 'เครดิตร้าน',
  // ออเดอร์ในแอป (0002): โอนแล้วแนบสลิป / เก็บเงินปลายทาง
  promptpay_slip: 'โอน (พร้อมเพย์)',
  cod: 'เก็บเงินปลายทาง',
};
// Null-safe: `undefined.toLocaleString()` is exactly what blanked the whole POS
// on a receipt replay (H5). A missing amount prints as 0 rather than throwing.
const baht = (n: number | null | undefined) => (n ?? 0).toLocaleString('th-TH');

function Line2({ label, value, bold }: { label: string; value: number | null | undefined; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-sm' : ''}`}>
      <span>{label}</span>
      <span>{baht(value)}</span>
    </div>
  );
}

/** Thermal-style receipt (id="pos-receipt" so the print CSS isolates it). Layout
 *  mixes the อู้ฟู่ brand (tiger logo) with a mini-mart style: item table, a
 *  sale-number barcode, shop phone/address, and a footer note — all driven by
 *  the per-machine receipt config (paper width 48/58mm, etc.). */
export function Receipt({
  shop,
  saleNumber,
  at,
  taxInvoiceNo,
  customerName,
  customerTaxId,
  items,
  deliveryFee,
  subtotal,
  discount,
  vatAmount,
  netAmount,
  total,
  paymentMethod,
  cashPaid,
  change,
  offline,
}: ReceiptProps) {
  const [cfg] = useReceiptConfig();
  const payLabel = PAY_LABEL[paymentMethod] ?? paymentMethod;
  const payValue = paymentMethod === 'cash' && cashPaid != null ? cashPaid : total;
  const cw = contentMm(cfg.paperWidth, cfg.contentWidthMm);

  return (
    <>
      {/* Page size follows the configured roll; margins 0 (dialog "None" still
          wins, so we tell the user, but this covers kiosk-printing). */}
      <style>{`@page{size:${cfg.paperWidth}mm 210mm;margin:0}`}</style>
      {/* ★ ขนาดตัวอักษรคุมจากที่เดียว ★ เจ้าของสั่ง 15 ก.ย. 2026 "font ใหญ่ไปด้วยครับ
          เราลองลดลงมาหน่อยครับเพื่อประหยัดกระดาษ" — ทุกบรรทัดในบิลวัดเป็นสัดส่วนของ
          ขนาดนี้ (em) ไม่ใช่ตัวเลข px ตายตัว ปรับที่นี่ทีเดียวแล้วบิลย่อ/ขยายทั้งใบพร้อมกัน
          โดยสัดส่วนหัวบิล/ยอดรวม/ตัวเล็กยังเท่าเดิม ไม่เพี้ยนไปทีละส่วน */}
      <div
        id="pos-receipt"
        style={{ width: `${cw}mm`, fontSize: `${cfg.fontPx}px` }}
        /* ★ ต้องมีที่ว่างท้ายบิลจริง ๆ ★ ไม่ใช่แค่กันพลาด — บรรทัดสุดท้ายที่ชิดขอบกล่อง
           พอดีคือต้นเหตุที่ "สินค้าซื้อแล้วไม่รับคืน" หายไปตอนถ่ายเป็นรูป (เจ้าของเจอกับ
           กระดาษจริง 15 ก.ย. 2026) เผื่อไว้สองบรรทัด ใครปัดเศษพลาดก็กินที่ว่างนี้แทน
           ไม่ใช่กินตัวหนังสือ · เสียกระดาษไม่ถึงครึ่งเซนติเมตร */
        className="font-mono text-black leading-snug pt-1 pb-[2em] [overflow-wrap:anywhere]">
        <div className="text-center mb-1">
          <img
            src="/logo-oofoo.png"
            alt=""
            className="h-8 mx-auto mb-1 object-contain"
            style={{ filter: 'grayscale(1) contrast(1.25)' }}
          />
          <div className="text-[1.36em] font-bold leading-tight">{shop.receipt_header || shop.name}</div>
          {cfg.phone ? <div className="text-[1em]">โทร {cfg.phone}</div> : null}
          {cfg.address ? <div className="text-[1em]">{cfg.address}</div> : null}
          {shop.vat_registered && shop.tax_id && (
            <div className="text-[1em]">
              เลขผู้เสียภาษี {shop.tax_id} ({shop.branch_code})
            </div>
          )}
          <div className="text-[1em] mt-0.5">
            {taxInvoiceNo ? 'ใบกำกับภาษี' : 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ'}
          </div>
        </div>

        <div className="text-[1em]">เลขที่ {saleNumber}</div>
        <div className="text-[1em]">{at}</div>
        {cfg.cashierName ? <div className="text-[1em]">พนักงาน {cfg.cashierName}</div> : null}
        {taxInvoiceNo && <div className="text-[1em]">เลขใบกำกับ {taxInvoiceNo}</div>}
        {taxInvoiceNo && customerName && (
          <div className="text-[1em]">
            ชื่อผู้ซื้อ {customerName}
            {customerTaxId ? ` เลขผู้เสียภาษี ${customerTaxId}` : ''}
          </div>
        )}
        {offline && (
          <div className="mt-1 text-[1em] text-center border border-dashed border-black rounded py-0.5">
            บิลออฟไลน์ — จะออกเลขที่จริงเมื่อซิงค์
          </div>
        )}

        <div className="border-t border-dashed border-black my-1.5" />
        {/* Item table: name | qty | amount */}
        {/* ★ ชื่อสินค้าอยู่บรรทัดของตัวเอง เต็มความกว้าง ★ (แก้ 8 ก.ย. 2026 หลังเจ้าของ
            บอกว่าลูกค้าว่าบิลอ่านยาก) — เดิมชื่อถูกบีบอยู่ในคอลัมน์แคบ ๆ ที่เหลือจากช่อง
            จำนวนกับช่องรวม ชื่อจริงของร้านชำอย่าง "ครีมอาบน้ำ บีไนท์ สีชมพู 400 มล"
            เลยตกบรรทัดสี่บรรทัด กินกระดาษและอ่านไม่รู้เรื่อง
            แบบใหม่: ชื่อเต็มบรรทัดแรก แล้วบรรทัดที่สองเป็น "จำนวน x ราคา ...... รวม"
            ซึ่งเป็นทรงเดียวกับใบเสร็จร้านค้าทั่วไปที่คนไทยอ่านคุ้นอยู่แล้ว
            ตัดบรรทัด "@ ราคา" แยกออกไปด้วย เพราะรวมอยู่ในบรรทัดที่สองแล้ว */}
        <div className="flex gap-1 text-[0.91em] font-bold">
          <div className="flex-1">รายการ</div>
          <div className="w-12 text-right">รวม</div>
        </div>
        <div className="border-t border-dotted border-black my-1" />
        {items.map((l, i) => (
          <div key={i} className="mb-1">
            <div className="leading-tight">
              {l.name}
              {l.size ? ` (${l.size})` : ''}
            </div>
            <div className="flex gap-1">
              <div className="flex-1 text-black/70">
                {l.qty} x {baht(l.unitPrice)}
              </div>
              <div className="w-12 text-right">{baht(l.lineTotal)}</div>
            </div>
          </div>
        ))}

        <div className="border-t border-dashed border-black my-1.5" />
        <Line2 label="ยอดรวม" value={subtotal} />
        {(discount ?? 0) > 0 && <Line2 label="ส่วนลด" value={-(discount ?? 0)} />}
        {(deliveryFee ?? 0) > 0 && <Line2 label="ค่าจัดส่ง" value={deliveryFee} />}
        {shop.vat_registered && (
          <>
            <Line2 label="มูลค่าก่อน VAT" value={netAmount} />
            <Line2 label={`VAT ${shop.vat_rate}%`} value={vatAmount} />
          </>
        )}
        <Line2 label="สุทธิ" value={total} bold />
        <div className="border-t border-dashed border-black my-1.5" />
        <Line2 label={payLabel} value={payValue} />
        {paymentMethod === 'cash' && change != null && <Line2 label="เงินทอน" value={change} />}

        {/* No barcode for an offline provisional receipt — saleNumber is the
            Thai placeholder "ออฟไลน์" (a real number is issued on sync), which
            isn't valid CODE128 and rendered as a blank gap. */}
        {cfg.showBarcode && !offline && (
          <div className="mt-3 text-center">
            <Barcode value={saleNumber} />
            <div className="text-[0.91em] mt-0.5 tracking-widest">{saleNumber}</div>
          </div>
        )}

        <div className="text-center text-[1.09em] mt-3 font-bold">{shop.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>
        {cfg.footerNote ? <div className="text-center text-[0.91em] mt-0.5">{cfg.footerNote}</div> : null}
      </div>
    </>
  );
}
