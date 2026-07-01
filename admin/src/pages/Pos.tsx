import {
  RiAddLine,
  RiDeleteBin6Line,
  RiMoneyDollarCircleLine,
  RiQrCodeLine,
  RiSearchLine,
  RiSubtractLine,
} from '@remixicon/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import {
  apiError,
  closeShift,
  createPosSale,
  getOpenShift,
  getShopInfo,
  listPosCatalog,
  openShift,
  type PosProduct,
  type PosVariant,
  type SaleResult,
  type Shift,
  type ShopInfo,
} from '../lib/api';
import { promptpayPayload } from '../lib/promptpay';

type Line = {
  variantId: string;
  name: string;
  size: string | null;
  unitPrice: number;
  qty: number;
  image: string | null;
};
type PayMethod = 'cash' | 'promptpay';
type ReceiptData = { sale: SaleResult; lines: Line[]; method: PayMethod; at: string };

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

export function Pos() {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState<PosProduct | null>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [tendered, setTendered] = useState<number | ''>('');
  const [taxInvoice, setTaxInvoice] = useState(false);
  const [custName, setCustName] = useState('');
  const [custTaxId, setCustTaxId] = useState('');

  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, sh, c] = await Promise.all([getShopInfo(), getOpenShift(), listPosCatalog()]);
        setShop(s);
        setShift(sh);
        setCatalog(c);
      } catch (e) {
        setError(apiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog) if (p.category_id) map.set(p.category_id, p.category_name ?? '—');
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [catalog]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((p) => {
      if (cat && p.category_id !== cat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, cat, query]);

  /* ── cart ops ──────────────────────────────────────────────────────────── */
  function addVariant(p: PosProduct, v: PosVariant) {
    setLines((cur) => {
      const i = cur.findIndex((l) => l.variantId === v.id);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [
        ...cur,
        { variantId: v.id, name: p.name, size: v.size, unitPrice: v.price, qty: 1, image: p.image },
      ];
    });
  }
  function pick(p: PosProduct) {
    const avail = p.variants;
    if (avail.length === 0) return;
    if (avail.length === 1) addVariant(p, avail[0]);
    else setPicker(p);
  }
  function setQty(variantId: string, qty: number) {
    setLines((cur) =>
      qty <= 0
        ? cur.filter((l) => l.variantId !== variantId)
        : cur.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
    );
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const code = query.trim();
    if (!code) return;
    // barcode scanner: exact barcode match → add + clear
    for (const p of catalog) {
      const v = p.variants.find((x) => x.barcode && x.barcode === code);
      if (v) {
        addVariant(p, v);
        setQuery('');
        return;
      }
    }
  }

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);
  const total = Math.max(0, subtotal - discount);
  const vat =
    shop?.vat_registered && total > 0 ? Math.round((total * shop.vat_rate) / (100 + shop.vat_rate)) : 0;
  const net = total - vat;
  const change = method === 'cash' && typeof tendered === 'number' ? tendered - total : 0;

  function resetSale() {
    setLines([]);
    setDiscount(0);
    setTendered('');
    setTaxInvoice(false);
    setCustName('');
    setCustTaxId('');
    setQuery('');
    searchRef.current?.focus();
  }

  async function checkout() {
    if (!lines.length || busy) return;
    if (method === 'cash' && (typeof tendered !== 'number' || tendered < total)) {
      setError('เงินที่รับมาไม่พอ');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sale = await createPosSale({
        client_op_id: crypto.randomUUID(),
        items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
        payment_method: method,
        cash_tendered: method === 'cash' ? (tendered as number) : undefined,
        discount,
        tax_invoice: taxInvoice,
        customer_name: taxInvoice ? custName || undefined : undefined,
        customer_tax_id: taxInvoice ? custTaxId || undefined : undefined,
      });
      setReceipt({ sale, lines, method, at: new Date().toLocaleString('th-TH') });
      resetSale();
      // reflect stock locally (best-effort; server is source of truth)
      setCatalog((cur) =>
        cur.map((p) => ({
          ...p,
          variants: p.variants.map((v) => {
            const l = lines.find((x) => x.variantId === v.id);
            return l ? { ...v, stock_qty: v.stock_qty - l.qty } : v;
          }),
        })),
      );
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-tremor-content py-16 text-center">กำลังโหลด…</div>;

  if (!shift) {
    return (
      <OpenShiftGate
        onOpen={async (float) => {
          const s = await openShift(float);
          setShift(s);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* shift bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-tremor-content">
          กะเปิดอยู่ · เงินต้นกะ <span className="font-semibold text-tremor-content-strong">{baht(shift.opening_float)}</span>
        </div>
        <CloseShiftButton shift={shift} setShift={setShift} />
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4 flex-1 min-h-0">
        {/* ── left: search + grid ─────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          <div className="relative mb-3">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tremor-content-subtle" />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="สแกนบาร์โค้ด หรือค้นหาสินค้า…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-tremor-border bg-white text-tremor-content-strong focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            <Chip active={cat === null} onClick={() => setCat(null)}>
              ทั้งหมด
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1 content-start">
            {shown.map((p) => {
              const price = p.variants[0]?.price ?? 0;
              const stock = p.variants.reduce((s, v) => s + v.stock_qty, 0);
              return (
                <button
                  key={p.id}
                  onClick={() => pick(p)}
                  disabled={stock <= 0}
                  className="text-left rounded-xl border border-tremor-border bg-white overflow-hidden hover:border-emerald-400 hover:shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <div className="aspect-square bg-tremor-background-muted">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-medium text-tremor-content-strong line-clamp-2 leading-snug">
                      {p.name}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-700">
                        {p.variants.length > 1 ? `${baht(price)}+` : baht(price)}
                      </span>
                      <span className="text-xs text-tremor-content-subtle">คงเหลือ {stock}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {shown.length === 0 && (
              <div className="col-span-full text-center text-tremor-content py-12">ไม่พบสินค้า</div>
            )}
          </div>
        </div>

        {/* ── right: cart + checkout ──────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 rounded-2xl border border-tremor-border bg-white">
          <div className="px-4 py-3 border-b border-tremor-border flex items-center justify-between">
            <span className="font-semibold text-tremor-content-strong">บิลปัจจุบัน</span>
            {lines.length > 0 && (
              <button onClick={resetSale} className="text-xs text-tremor-content hover:text-red-600">
                ล้างบิล
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <div className="text-center text-tremor-content-subtle py-16 text-sm">
                เลือกสินค้าเพื่อเริ่มบิล
              </div>
            ) : (
              lines.map((l) => (
                <div key={l.variantId} className="flex items-center gap-2 px-4 py-2 border-b border-tremor-border/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-tremor-content-strong truncate">{l.name}</div>
                    <div className="text-xs text-tremor-content-subtle">
                      {l.size ? `${l.size} · ` : ''}
                      {baht(l.unitPrice)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <StepBtn onClick={() => setQty(l.variantId, l.qty - 1)}>
                      <RiSubtractLine className="w-4 h-4" />
                    </StepBtn>
                    <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                    <StepBtn onClick={() => setQty(l.variantId, l.qty + 1)}>
                      <RiAddLine className="w-4 h-4" />
                    </StepBtn>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold text-tremor-content-strong">
                    {baht(l.unitPrice * l.qty)}
                  </div>
                  <button
                    onClick={() => setQty(l.variantId, 0)}
                    className="text-tremor-content-subtle hover:text-red-600">
                    <RiDeleteBin6Line className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* totals + pay */}
          <div className="border-t border-tremor-border p-4 space-y-3">
            <Row label="ยอดรวม" value={baht(subtotal)} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-tremor-content">ส่วนลดทั้งบิล</span>
              <div className="flex items-center gap-1">
                <span className="text-tremor-content-subtle">฿</span>
                <input
                  type="number"
                  min={0}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 text-right rounded-md border border-tremor-border px-2 py-1"
                />
              </div>
            </div>
            {shop?.vat_registered && (
              <Row label={`ราคาก่อน VAT`} value={baht(net)} subtle />
            )}
            {shop?.vat_registered && <Row label={`VAT ${shop.vat_rate}%`} value={baht(vat)} subtle />}
            <div className="flex items-center justify-between pt-1 border-t border-tremor-border">
              <span className="font-semibold text-tremor-content-strong">ยอดสุทธิ</span>
              <span className="text-xl font-bold text-emerald-700">{baht(total)}</span>
            </div>

            {/* payment method */}
            <div className="grid grid-cols-2 gap-2">
              <PayTab active={method === 'cash'} onClick={() => setMethod('cash')} Icon={RiMoneyDollarCircleLine}>
                เงินสด
              </PayTab>
              <PayTab active={method === 'promptpay'} onClick={() => setMethod('promptpay')} Icon={RiQrCodeLine}>
                พร้อมเพย์
              </PayTab>
            </div>

            {method === 'cash' && (
              <CashPay
                total={total}
                tendered={tendered}
                setTendered={setTendered}
                change={change}
              />
            )}
            {method === 'promptpay' && (
              <PromptPayPanel target={shop?.promptpay_id ?? null} amount={total} name={shop?.promptpay_name} />
            )}

            {shop?.vat_registered && (
              <label className="flex items-center gap-2 text-sm text-tremor-content">
                <input
                  type="checkbox"
                  checked={taxInvoice}
                  onChange={(e) => setTaxInvoice(e.target.checked)}
                  className="rounded"
                />
                ออกใบกำกับภาษีเต็มรูป
              </label>
            )}
            {taxInvoice && (
              <div className="space-y-2">
                <input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="ชื่อลูกค้า"
                  className="w-full rounded-md border border-tremor-border px-3 py-1.5 text-sm"
                />
                <input
                  value={custTaxId}
                  onChange={(e) => setCustTaxId(e.target.value)}
                  placeholder="เลขประจำตัวผู้เสียภาษี"
                  className="w-full rounded-md border border-tremor-border px-3 py-1.5 text-sm"
                />
              </div>
            )}

            <button
              onClick={checkout}
              disabled={!lines.length || busy}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-40 transition">
              {busy ? 'กำลังบันทึก…' : `ชำระเงิน ${baht(total)}`}
            </button>
          </div>
        </div>
      </div>

      {picker && (
        <VariantPicker
          product={picker}
          onPick={(v) => {
            addVariant(picker, v);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {receipt && shop && (
        <ReceiptModal data={receipt} shop={shop} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}

/* ── sub-components ────────────────────────────────────────────────────────── */

function Row({ label, value, subtle }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${subtle ? 'text-tremor-content-subtle' : 'text-tremor-content'}`}>
      <span>{label}</span>
      <span className={subtle ? '' : 'font-medium text-tremor-content-strong'}>{value}</span>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${
        active
          ? 'bg-emerald-600 text-white border-emerald-600'
          : 'bg-white text-tremor-content border-tremor-border hover:border-emerald-400'
      }`}>
      {children}
    </button>
  );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-md border border-tremor-border text-tremor-content hover:bg-tremor-background-muted">
      {children}
    </button>
  );
}

function PayTab({
  active,
  onClick,
  Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof RiQrCodeLine;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition ${
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-500'
          : 'bg-white text-tremor-content border-tremor-border hover:border-emerald-300'
      }`}>
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function CashPay({
  total,
  tendered,
  setTendered,
  change,
}: {
  total: number;
  tendered: number | '';
  setTendered: (n: number | '') => void;
  change: number;
}) {
  const quick = [total, 100, 500, 1000].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-tremor-content">รับเงิน</span>
        <div className="flex items-center gap-1">
          <span className="text-tremor-content-subtle">฿</span>
          <input
            type="number"
            value={tendered}
            onChange={(e) => setTendered(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
            className="w-24 text-right rounded-md border border-tremor-border px-2 py-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((v, i) => (
          <button
            key={i}
            onClick={() => setTendered(v)}
            className="py-1.5 rounded-md border border-tremor-border text-sm hover:bg-tremor-background-muted">
            {v === total ? 'พอดี' : baht(v)}
          </button>
        ))}
      </div>
      {typeof tendered === 'number' && tendered >= total && (
        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-tremor-content">เงินทอน</span>
          <span className="font-semibold text-emerald-700">{baht(change)}</span>
        </div>
      )}
    </div>
  );
}

function PromptPayPanel({
  target,
  amount,
  name,
}: {
  target: string | null;
  amount: number;
  name?: string | null;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!target || amount <= 0) {
      setUri(null);
      return;
    }
    QRCode.toDataURL(promptpayPayload(target, amount), { margin: 1, width: 220 })
      .then(setUri)
      .catch(() => setUri(null));
  }, [target, amount]);

  if (!target)
    return (
      <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
        ยังไม่ได้ตั้งค่าพร้อมเพย์ของร้าน (ตั้งใน settings)
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {uri ? <img src={uri} alt="PromptPay QR" className="w-44 h-44" /> : <div className="w-44 h-44" />}
      <div className="text-sm font-semibold text-tremor-content-strong">{baht(amount)}</div>
      {name && <div className="text-xs text-tremor-content-subtle">{name}</div>}
      <div className="text-xs text-tremor-content-subtle">ให้ลูกค้าสแกนแล้วกด “ชำระเงิน” เมื่อได้รับเงิน</div>
    </div>
  );
}

function VariantPicker({
  product,
  onPick,
  onClose,
}: {
  product: PosProduct;
  onPick: (v: PosVariant) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-tremor-content-strong mb-3">{product.name} · เลือกขนาด</div>
        <div className="space-y-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              disabled={v.stock_qty <= 0}
              onClick={() => onPick(v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-tremor-border hover:border-emerald-400 disabled:opacity-40">
              <span className="text-sm text-tremor-content-strong">{v.size ?? 'ปกติ'}</span>
              <span className="text-sm">
                <span className="font-semibold text-emerald-700">{baht(v.price)}</span>
                <span className="text-xs text-tremor-content-subtle ml-2">คงเหลือ {v.stock_qty}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OpenShiftGate({ onOpen }: { onOpen: (float: number) => Promise<void> }) {
  const [float, setFloat] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-full max-w-sm rounded-2xl border border-tremor-border bg-white p-6 text-center">
        <div className="text-lg font-semibold text-tremor-content-strong mb-1">เปิดกะขาย</div>
        <p className="text-sm text-tremor-content mb-4">ใส่จำนวนเงินสดตั้งต้นในลิ้นชักเพื่อเริ่มขาย</p>
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
        <div className="flex items-center gap-2 justify-center mb-4">
          <span className="text-tremor-content-subtle">฿</span>
          <input
            type="number"
            min={0}
            autoFocus
            value={float}
            onChange={(e) => setFloat(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
            placeholder="0"
            className="w-32 text-right rounded-lg border border-tremor-border px-3 py-2"
          />
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onOpen(typeof float === 'number' ? float : 0);
            } catch (e) {
              setErr(apiError(e));
            } finally {
              setBusy(false);
            }
          }}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">
          {busy ? 'กำลังเปิด…' : 'เปิดกะ'}
        </button>
      </div>
    </div>
  );
}

function CloseShiftButton({
  shift,
  setShift,
}: {
  shift: Shift;
  onClosed?: (s: Shift) => void;
  setShift: (s: Shift | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Shift | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-lg border border-tremor-border text-tremor-content hover:bg-tremor-background-muted">
        ปิดกะ
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {result ? (
              <div className="text-center">
                <div className="text-lg font-semibold text-tremor-content-strong mb-3">ปิดกะแล้ว</div>
                <div className="space-y-1 text-sm text-left">
                  <Row label="เงินตั้งต้น" value={baht(result.opening_float)} />
                  <Row label="ควรมี (ต้น + ขายสด)" value={baht(result.expected_cash ?? 0)} />
                  <Row label="นับได้" value={baht(result.counted_cash ?? 0)} />
                  <div className="flex items-center justify-between pt-2 border-t border-tremor-border">
                    <span className="font-semibold">ส่วนต่าง</span>
                    <span
                      className={`font-bold ${
                        (result.over_short ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}>
                      {(result.over_short ?? 0) >= 0 ? '+' : ''}
                      {baht(result.over_short ?? 0)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShift(null);
                  }}
                  className="mt-5 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold">
                  เสร็จสิ้น
                </button>
              </div>
            ) : (
              <>
                <div className="text-lg font-semibold text-tremor-content-strong mb-1">ปิดกะ</div>
                <p className="text-sm text-tremor-content mb-4">นับเงินสดในลิ้นชักแล้วกรอกยอด</p>
                {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-tremor-content-subtle">฿</span>
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={counted}
                    onChange={(e) => setCounted(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className="flex-1 text-right rounded-lg border border-tremor-border px-3 py-2"
                  />
                </div>
                <button
                  disabled={busy || counted === ''}
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    try {
                      const s = await closeShift(shift.id, typeof counted === 'number' ? counted : 0);
                      setResult(s);
                    } catch (e) {
                      setErr(apiError(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? 'กำลังปิด…' : 'ปิดกะ'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReceiptModal({ data, shop, onClose }: { data: ReceiptData; shop: ShopInfo; onClose: () => void }) {
  const { sale, lines, method, at } = data;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
      <div className="bg-white rounded-2xl w-full max-w-xs print:max-w-none print:rounded-none">
        <div id="pos-receipt" className="p-5 font-mono text-[13px] text-black leading-relaxed">
          <div className="text-center mb-2">
            <div className="text-base font-bold">{shop.receipt_header || shop.name}</div>
            {shop.vat_registered && shop.tax_id && (
              <div className="text-[11px]">เลขผู้เสียภาษี {shop.tax_id} ({shop.branch_code})</div>
            )}
            <div className="text-[11px]">
              {sale.tax_invoice_no ? 'ใบกำกับภาษี' : 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ'}
            </div>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>เลขที่ {sale.sale_number}</span>
            <span>{at}</span>
          </div>
          {sale.tax_invoice_no && <div className="text-[11px]">เลขใบกำกับ {sale.tax_invoice_no}</div>}
          <div className="border-t border-dashed border-black my-2" />
          {lines.map((l) => (
            <div key={l.variantId} className="mb-1">
              <div>{l.name}{l.size ? ` (${l.size})` : ''}</div>
              <div className="flex justify-between">
                <span>
                  {l.qty} x {l.unitPrice}
                </span>
                <span>{l.unitPrice * l.qty}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-dashed border-black my-2" />
          <Line2 label="ยอดรวม" value={sale.subtotal} />
          {sale.discount > 0 && <Line2 label="ส่วนลด" value={-sale.discount} />}
          {shop.vat_registered && (
            <>
              <Line2 label="มูลค่าก่อน VAT" value={sale.net_amount} />
              <Line2 label={`VAT ${shop.vat_rate}%`} value={sale.vat_amount} />
            </>
          )}
          <div className="flex justify-between font-bold text-sm mt-1">
            <span>สุทธิ</span>
            <span>{sale.total}</span>
          </div>
          <div className="border-t border-dashed border-black my-2" />
          <Line2 label={method === 'cash' ? 'เงินสด' : 'พร้อมเพย์'} value={method === 'cash' ? sale.total + sale.change : sale.total} />
          {method === 'cash' && <Line2 label="เงินทอน" value={sale.change} />}
          <div className="text-center text-[11px] mt-3">{shop.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>
        </div>
        <div className="flex gap-2 p-4 border-t border-tremor-border print:hidden">
          <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl border border-tremor-border font-medium hover:bg-tremor-background-muted">
            พิมพ์
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold">
            ขายต่อ
          </button>
        </div>
      </div>
    </div>
  );
}

function Line2({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value.toLocaleString('th-TH')}</span>
    </div>
  );
}
