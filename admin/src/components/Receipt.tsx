import type { ShopInfo } from '../lib/api';

export type ReceiptLine = { name: string; size: string | null; qty: number; unitPrice: number; lineTotal: number };

export type ReceiptProps = {
  shop: ShopInfo;
  saleNumber: string;
  at: string;
  taxInvoiceNo?: string | null;
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

function Line2({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value.toLocaleString('th-TH')}</span>
    </div>
  );
}

/** Thermal-style receipt. Rendered with id="pos-receipt" so the print CSS in
 *  index.css can isolate and print just this block (used by POS + bills history). */
export function Receipt({
  shop,
  saleNumber,
  at,
  taxInvoiceNo,
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
  const payLabel = PAY_LABEL[paymentMethod] ?? paymentMethod;
  const payValue = paymentMethod === 'cash' && cashPaid != null ? cashPaid : total;
  return (
    <div
      id="pos-receipt"
      style={{ width: '46mm' }}
      className="font-mono text-[11px] text-black leading-snug pt-1 mx-auto [overflow-wrap:anywhere]">
      <div className="text-center mb-2">
        <img
          src="/logo-oofoo.png"
          alt=""
          className="h-12 mx-auto mb-1 object-contain"
          /* Grayscale + slight contrast: keeps the tiger recognisable while the
             thermal driver dithers it. (A detailed logo can't go pure 1-bit
             without falling apart; swap in a mono logo later if wanted.) */
          style={{ filter: 'grayscale(1) contrast(1.25)' }}
        />
        <div className="text-base font-bold">{shop.receipt_header || shop.name}</div>
        {shop.vat_registered && shop.tax_id && (
          <div className="text-[11px]">
            เลขผู้เสียภาษี {shop.tax_id} ({shop.branch_code})
          </div>
        )}
        <div className="text-[11px]">{taxInvoiceNo ? 'ใบกำกับภาษี' : 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ'}</div>
      </div>
      {/* Stacked so the long date never forces the 48mm row to overflow. */}
      <div className="text-[10px]">เลขที่ {saleNumber}</div>
      <div className="text-[10px]">{at}</div>
      {taxInvoiceNo && <div className="text-[11px]">เลขใบกำกับ {taxInvoiceNo}</div>}
      {offline && (
        <div className="mt-1 text-[11px] text-center border border-dashed border-black rounded py-0.5">
          บิลออฟไลน์ — จะออกเลขที่จริงเมื่อซิงค์
        </div>
      )}
      <div className="border-t border-dashed border-black my-2" />
      {items.map((l, i) => (
        <div key={i} className="mb-1">
          <div>
            {l.name}
            {l.size ? ` (${l.size})` : ''}
          </div>
          <div className="flex justify-between">
            <span>
              {l.qty} x {l.unitPrice.toLocaleString('th-TH')}
            </span>
            <span>{l.lineTotal.toLocaleString('th-TH')}</span>
          </div>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <Line2 label="ยอดรวม" value={subtotal} />
      {discount > 0 && <Line2 label="ส่วนลด" value={-discount} />}
      {shop.vat_registered && (
        <>
          <Line2 label="มูลค่าก่อน VAT" value={netAmount} />
          <Line2 label={`VAT ${shop.vat_rate}%`} value={vatAmount} />
        </>
      )}
      <div className="flex justify-between font-bold text-sm mt-1">
        <span>สุทธิ</span>
        <span>{total.toLocaleString('th-TH')}</span>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <Line2 label={payLabel} value={payValue} />
      {paymentMethod === 'cash' && change != null && <Line2 label="เงินทอน" value={change} />}
      <div className="text-center text-[11px] mt-3">{shop.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>
    </div>
  );
}
