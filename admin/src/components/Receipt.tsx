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
  subtotal: number;
  discount: number;
  vatAmount: number;
  netAmount: number;
  total: number;
  paymentMethod: string; // 'cash' | 'promptpay' | 'store_credit'
  cashPaid?: number | null; // amount tendered (only known right after a cash sale)
  change?: number | null;
  offline?: boolean;
};

const PAY_LABEL: Record<string, string> = { cash: 'เงินสด', promptpay: 'พร้อมเพย์', store_credit: 'เครดิตร้าน' };
const baht = (n: number) => n.toLocaleString('th-TH');

function Line2({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
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
  const cw = contentMm(cfg.paperWidth);

  return (
    <>
      {/* Page size follows the configured roll; margins 0 (dialog "None" still
          wins, so we tell the user, but this covers kiosk-printing). */}
      <style>{`@page{size:${cfg.paperWidth}mm 210mm;margin:0}`}</style>
      <div
        id="pos-receipt"
        style={{ width: `${cw}mm` }}
        className="font-mono text-[9px] text-black leading-snug pt-1 mx-auto [overflow-wrap:anywhere]">
        <div className="text-center mb-1">
          <img
            src="/logo-oofoo.png"
            alt=""
            className="h-8 mx-auto mb-1 object-contain"
            style={{ filter: 'grayscale(1) contrast(1.25)' }}
          />
          <div className="text-sm font-bold leading-tight">{shop.receipt_header || shop.name}</div>
          {cfg.phone ? <div className="text-[10px]">โทร {cfg.phone}</div> : null}
          {cfg.address ? <div className="text-[10px]">{cfg.address}</div> : null}
          {shop.vat_registered && shop.tax_id && (
            <div className="text-[10px]">
              เลขผู้เสียภาษี {shop.tax_id} ({shop.branch_code})
            </div>
          )}
          <div className="text-[10px] mt-0.5">
            {taxInvoiceNo ? 'ใบกำกับภาษี' : 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ'}
          </div>
        </div>

        <div className="text-[10px]">เลขที่ {saleNumber}</div>
        <div className="text-[10px]">{at}</div>
        {cfg.cashierName ? <div className="text-[10px]">พนักงาน {cfg.cashierName}</div> : null}
        {taxInvoiceNo && <div className="text-[10px]">เลขใบกำกับ {taxInvoiceNo}</div>}
        {taxInvoiceNo && customerName && (
          <div className="text-[10px]">
            ชื่อผู้ซื้อ {customerName}
            {customerTaxId ? ` เลขผู้เสียภาษี ${customerTaxId}` : ''}
          </div>
        )}
        {offline && (
          <div className="mt-1 text-[10px] text-center border border-dashed border-black rounded py-0.5">
            บิลออฟไลน์ — จะออกเลขที่จริงเมื่อซิงค์
          </div>
        )}

        <div className="border-t border-dashed border-black my-1.5" />
        {/* Item table: name | qty | amount */}
        <div className="flex gap-1 text-[9px] font-bold">
          <div className="flex-1">สินค้า</div>
          <div className="w-9 text-center">จำนวน</div>
          <div className="w-14 text-right">รวม</div>
        </div>
        <div className="border-t border-dotted border-black my-1" />
        {items.map((l, i) => (
          <div key={i} className="flex gap-1 mb-0.5">
            <div className="flex-1">
              {l.name}
              {l.size ? ` (${l.size})` : ''}
              <div className="text-[9px] text-black/70">@ {baht(l.unitPrice)}</div>
            </div>
            <div className="w-6 text-center">{l.qty}</div>
            <div className="w-14 text-right">{baht(l.lineTotal)}</div>
          </div>
        ))}

        <div className="border-t border-dashed border-black my-1.5" />
        <Line2 label="ยอดรวม" value={subtotal} />
        {discount > 0 && <Line2 label="ส่วนลด" value={-discount} />}
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
            <div className="text-[9px] mt-0.5 tracking-widest">{saleNumber}</div>
          </div>
        )}

        <div className="text-center text-[10px] mt-3 font-bold">{shop.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>
        {cfg.footerNote ? <div className="text-center text-[9px] mt-0.5">{cfg.footerNote}</div> : null}
      </div>
    </>
  );
}
