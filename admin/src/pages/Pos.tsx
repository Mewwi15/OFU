import {
  RiAddLine,
  RiCloseLine,
  RiMoneyDollarCircleLine,
  RiPrinterLine,
  RiQrCodeLine,
  RiSearchLine,
  RiShoppingBasket2Line,
  RiSubtractLine,
} from '@remixicon/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  cacheCatalog,
  cacheShift,
  cacheShop,
  enqueueSale,
  flushQueue,
  isNetworkError,
  queueCount,
  readCachedCatalog,
  readCachedShift,
  readCachedShop,
} from '../lib/offline';
import { App, Button, Card, InputNumber, Modal, Statistic, Typography } from 'antd';

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
type ReceiptData = { sale: SaleResult; lines: Line[]; method: PayMethod; at: string; offline?: boolean };

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
  const [cartOpen, setCartOpen] = useState(false); // mobile order drawer
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0); // queued offline sales
  const searchRef = useRef<HTMLInputElement>(null);

  const doFlush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const { synced, remaining } = await flushQueue(createPosSale);
    setPending(remaining);
    if (synced > 0) {
      // pull fresh server stock after syncing queued sales
      try {
        const c = await listPosCatalog();
        setCatalog(c);
        cacheCatalog(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, sh, c] = await Promise.all([getShopInfo(), getOpenShift(), listPosCatalog()]);
        setShop(s);
        cacheShop(s);
        setShift(sh);
        cacheShift(sh);
        setCatalog(c);
        cacheCatalog(c);
      } catch (e) {
        if (isNetworkError(e)) {
          // offline: fall back to the last cached catalog / shop / shift
          const cc = readCachedCatalog();
          const cs = readCachedShop();
          const csh = readCachedShift();
          if (cc) setCatalog(cc);
          if (cs) setShop(cs);
          setShift(csh);
          setOnline(false);
          if (!cc) setError('ออฟไลน์ และยังไม่มีข้อมูลที่แคชไว้ — เชื่อมต่อครั้งแรกออนไลน์ก่อน');
        } else {
          setError(apiError(e));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // online/offline listeners + flush queued sales on reconnect
  useEffect(() => {
    setPending(queueCount());
    const goOnline = () => {
      setOnline(true);
      void doFlush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (typeof navigator !== 'undefined' && navigator.onLine) void doFlush();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [doFlush]);

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

  const qtyByVariant = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.variantId, l.qty);
    return m;
  }, [lines]);

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
    const input = {
      client_op_id: crypto.randomUUID(),
      items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
      payment_method: method,
      cash_tendered: method === 'cash' ? (tendered as number) : undefined,
      discount,
      tax_invoice: taxInvoice,
      customer_name: taxInvoice ? custName || undefined : undefined,
      customer_tax_id: taxInvoice ? custTaxId || undefined : undefined,
    };
    const at = new Date().toLocaleString('th-TH');
    const soldLines = lines;

    const reflectStock = () =>
      setCatalog((cur) =>
        cur.map((p) => ({
          ...p,
          variants: p.variants.map((v) => {
            const l = soldLines.find((x) => x.variantId === v.id);
            return l ? { ...v, stock_qty: v.stock_qty - l.qty } : v;
          }),
        })),
      );

    setBusy(true);
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline');
      const sale = await createPosSale(input);
      setReceipt({ sale, lines: soldLines, method, at });
      setCartOpen(false);
      resetSale();
      reflectStock();
      void doFlush();
    } catch (e) {
      if (isNetworkError(e)) {
        // offline: queue for idempotent sync, print a provisional receipt
        enqueueSale({ input, total, at: Date.now() });
        setPending(queueCount());
        setOnline(false);
        const provisional: SaleResult = {
          id: '',
          sale_number: 'ออฟไลน์',
          tax_invoice_no: null,
          subtotal,
          discount,
          total,
          vat_amount: vat,
          net_amount: net,
          change,
          replay: false,
        };
        setReceipt({ sale: provisional, lines: soldLines, method, at, offline: true });
        setCartOpen(false);
        resetSale();
        reflectStock();
      } else {
        setError(apiError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <div className="text-tremor-content py-16 text-center">กำลังโหลด…</div>;

  if (!shift) {
    return (
      <OpenShiftGate
        onOpen={async (float) => {
          const s = await openShift(float);
          setShift(s);
          cacheShift(s);
        }}
      />
    );
  }

  return (
    <div className="-m-4 lg:-m-7 p-4 lg:p-6 bg-[#FBF2EC] min-h-[calc(100vh-4rem)]">
      <div className="lg:grid lg:grid-cols-[1fr_23rem] lg:gap-5 lg:h-[calc(100vh-6.5rem)]">
        {/* ── left: search + categories + grid ────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          {/* shift bar */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 shadow-sm min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${online ? 'bg-green-500' : 'bg-amber-500'}`}
                title={online ? 'ออนไลน์' : 'ออฟไลน์'}
              />
              <span className="text-sm text-tremor-content-emphasis truncate">
                <span className="hidden sm:inline">กะเปิดอยู่ · </span>เงินต้นกะ{' '}
                <span className="font-semibold text-tremor-content-strong">{baht(shift.opening_float)}</span>
                {!online && <span className="text-amber-600"> · ออฟไลน์</span>}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pending > 0 && (
                <button
                  onClick={() => void doFlush()}
                  disabled={!online}
                  title="ซิงค์บิลที่ค้าง"
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 shadow-sm disabled:opacity-60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  รอซิงค์ {pending}
                </button>
              )}
              <CloseShiftButton shift={shift} setShift={setShift} />
            </div>
          </div>

          <div className="relative mb-4">
            <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tremor-content-subtle" />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="สแกนบาร์โค้ด หรือค้นหาสินค้า…"
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-transparent bg-white shadow-sm text-tremor-content-strong placeholder:text-tremor-content-subtle focus:outline-none focus:ring-2 focus:ring-tremor-brand-muted"
            />
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 shrink-0">
            <Pill active={cat === null} onClick={() => setCat(null)}>
              ทั้งหมด
            </Pill>
            {categories.map((c) => (
              <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </Pill>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 lg:overflow-y-auto lg:flex-1 pr-1 pb-28 lg:pb-2 content-start">
            {shown.map((p) => {
              const price = p.variants[0]?.price ?? 0;
              const stock = p.variants.reduce((s, v) => s + v.stock_qty, 0);
              const single = p.variants.length === 1 ? p.variants[0] : null;
              const inCart = single ? qtyByVariant.get(single.id) ?? 0 : 0;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl bg-white shadow-sm border border-transparent p-3 flex flex-col transition ${
                    stock <= 0 ? 'opacity-40' : 'hover:shadow-md'
                  }`}>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F6ECE5] mb-2.5 grid place-items-center">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <RiShoppingBasket2Line className="w-8 h-8 text-tremor-brand-subtle" />
                    )}
                  </div>
                  <div className="text-[15px] font-semibold text-tremor-content-strong leading-snug line-clamp-1">
                    {p.name}
                  </div>
                  <div className="text-xs text-tremor-content mt-0.5 line-clamp-1 min-h-[1rem]">
                    {p.subtitle ?? p.category_name ?? ''}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[17px] font-bold text-tremor-content-strong">
                      {p.variants.length > 1 ? `${baht(price)}+` : baht(price)}
                    </span>
                    {single && inCart > 0 ? (
                      <div className="flex items-center gap-2">
                        <StepBtn onClick={() => setQty(single.id, inCart - 1)}>
                          <RiSubtractLine className="w-4 h-4" />
                        </StepBtn>
                        <span className="w-5 text-center text-sm font-semibold">{inCart}</span>
                        <StepBtn brand onClick={() => addVariant(p, single)}>
                          <RiAddLine className="w-4 h-4" />
                        </StepBtn>
                      </div>
                    ) : (
                      <button
                        onClick={() => pick(p)}
                        disabled={stock <= 0}
                        className="inline-flex items-center gap-1 rounded-full bg-tremor-brand text-white text-sm font-medium pl-2.5 pr-3 py-1.5 hover:bg-tremor-brand-emphasis disabled:opacity-40 transition">
                        <RiAddLine className="w-4 h-4" />
                        เพิ่ม
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && (
              <div className="col-span-full text-center text-tremor-content py-12">ไม่พบสินค้า</div>
            )}
          </div>
        </div>

        {/* mobile backdrop */}
        {cartOpen && (
          <div className="lg:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setCartOpen(false)} />
        )}

        {/* ── right: order panel (drawer < lg, column ≥ lg) ────────────────── */}
        <div
          className={`flex flex-col min-h-0 bg-white shadow-sm rounded-none lg:rounded-2xl fixed inset-y-0 right-0 z-40 w-full max-w-sm transition-transform duration-300 lg:static lg:z-auto lg:w-auto lg:max-w-none ${
            cartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}>
          <div className="px-5 py-4 flex items-center justify-between border-b border-tremor-border">
            <div>
              <div className="text-[15px] font-semibold text-tremor-content-strong">บิลปัจจุบัน</div>
              <div className="text-xs text-tremor-content-subtle">
                {lines.reduce((s, l) => s + l.qty, 0)} ชิ้น
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lines.length > 0 && (
                <button onClick={resetSale} className="text-xs text-tremor-content hover:text-red-600">
                  ล้างบิล
                </button>
              )}
              <button
                onClick={() => setCartOpen(false)}
                className="lg:hidden w-8 h-8 grid place-items-center rounded-full text-tremor-content hover:bg-[#FBF5F1]">
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          <div className="flex-1 overflow-y-auto px-2">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-tremor-content-subtle text-sm gap-2 py-16">
                <RiShoppingBasket2Line className="w-10 h-10 text-[#E7D8CE]" />
                เลือกสินค้าเพื่อเริ่มบิล
              </div>
            ) : (
              lines.map((l) => (
                <div key={l.variantId} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#FBF5F1]">
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#F6ECE5] grid place-items-center shrink-0">
                    {l.image ? (
                      <img src={l.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <RiShoppingBasket2Line className="w-5 h-5 text-tremor-brand-subtle" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-tremor-content-strong truncate">{l.name}</div>
                    <div className="text-xs text-tremor-content-subtle">
                      {l.size ? `${l.size} · ` : ''}
                      {baht(l.unitPrice)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StepBtn onClick={() => setQty(l.variantId, l.qty - 1)}>
                      <RiSubtractLine className="w-4 h-4" />
                    </StepBtn>
                    <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                    <StepBtn brand onClick={() => setQty(l.variantId, l.qty + 1)}>
                      <RiAddLine className="w-4 h-4" />
                    </StepBtn>
                  </div>
                  <div className="w-16 text-right text-sm font-bold text-tremor-content-strong">
                    {baht(l.unitPrice * l.qty)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* totals + pay */}
          <div className="border-t border-tremor-border p-4 space-y-2.5">
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
                  className="w-20 text-right rounded-lg border border-tremor-border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-tremor-brand-muted"
                />
              </div>
            </div>
            {shop?.vat_registered && <Row label="ราคาก่อน VAT" value={baht(net)} subtle />}
            {shop?.vat_registered && <Row label={`VAT ${shop.vat_rate}%`} value={baht(vat)} subtle />}
            <div className="flex items-center justify-between pt-2 border-t border-tremor-border">
              <span className="font-semibold text-tremor-content-strong">ยอดสุทธิ</span>
              <span className="text-2xl font-bold text-tremor-brand-emphasis">{baht(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <PayTab active={method === 'cash'} onClick={() => setMethod('cash')} Icon={RiMoneyDollarCircleLine}>
                เงินสด
              </PayTab>
              <PayTab active={method === 'promptpay'} onClick={() => setMethod('promptpay')} Icon={RiQrCodeLine}>
                พร้อมเพย์
              </PayTab>
            </div>

            {method === 'cash' && (
              <CashPay total={total} tendered={tendered} setTendered={setTendered} change={change} />
            )}
            {method === 'promptpay' && (
              <PromptPayPanel target={shop?.promptpay_id ?? null} amount={total} name={shop?.promptpay_name} />
            )}

            {shop?.vat_registered && (
              <label className="flex items-center gap-2 text-sm text-tremor-content pt-0.5">
                <input
                  type="checkbox"
                  checked={taxInvoice}
                  onChange={(e) => setTaxInvoice(e.target.checked)}
                  className="rounded text-tremor-brand focus:ring-tremor-brand-muted"
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
                  className="w-full rounded-lg border border-tremor-border px-3 py-1.5 text-sm"
                />
                <input
                  value={custTaxId}
                  onChange={(e) => setCustTaxId(e.target.value)}
                  placeholder="เลขประจำตัวผู้เสียภาษี"
                  className="w-full rounded-lg border border-tremor-border px-3 py-1.5 text-sm"
                />
              </div>
            )}

            <button
              onClick={checkout}
              disabled={!lines.length || busy}
              className="w-full py-3.5 rounded-2xl bg-tremor-brand text-white font-semibold text-[15px] hover:bg-tremor-brand-emphasis disabled:opacity-40 transition shadow-sm">
              {busy ? 'กำลังบันทึก…' : `ชำระเงิน ${baht(total)}`}
            </button>
          </div>
        </div>
      </div>

      {/* mobile: open-cart bar */}
      {lines.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-3 inset-x-3 z-30 rounded-2xl bg-tremor-brand text-white shadow-lg flex items-center justify-between px-5 py-3.5 hover:bg-tremor-brand-emphasis">
          <span className="flex items-center gap-2 font-medium">
            <span className="grid place-items-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-white/25 text-xs font-bold">
              {lines.reduce((s, l) => s + l.qty, 0)}
            </span>
            ดูบิล
          </span>
          <span className="font-bold">{baht(total)}</span>
        </button>
      )}

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
      {receipt && shop && <ReceiptModal data={receipt} shop={shop} onClose={() => setReceipt(null)} />}
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

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition ${
        active
          ? 'bg-tremor-brand-faint text-tremor-brand-emphasis border-tremor-brand'
          : 'bg-white text-tremor-content-emphasis border-transparent shadow-sm hover:text-tremor-brand'
      }`}>
      {children}
    </button>
  );
}

function StepBtn({ onClick, children, brand }: { onClick: () => void; children: React.ReactNode; brand?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-full transition ${
        brand
          ? 'bg-tremor-brand text-white hover:bg-tremor-brand-emphasis'
          : 'border border-tremor-border text-tremor-content-emphasis hover:bg-[#FBF5F1]'
      }`}>
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
      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition ${
        active
          ? 'bg-tremor-brand-faint text-tremor-brand-emphasis border-tremor-brand'
          : 'bg-white text-tremor-content border-tremor-border hover:border-tremor-brand-subtle'
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
            className="w-24 text-right rounded-lg border border-tremor-border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-tremor-brand-muted"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((v, i) => (
          <button
            key={i}
            onClick={() => setTendered(v)}
            className="py-1.5 rounded-lg border border-tremor-border text-sm text-tremor-content-emphasis hover:border-tremor-brand-subtle hover:text-tremor-brand">
            {v === total ? 'พอดี' : baht(v)}
          </button>
        ))}
      </div>
      {typeof tendered === 'number' && tendered >= total && (
        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-tremor-content">เงินทอน</span>
          <span className="font-semibold text-green-700">{baht(change)}</span>
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
    <div className="flex flex-col items-center gap-1 py-2 rounded-xl bg-[#FBF5F1]">
      {uri ? <img src={uri} alt="PromptPay QR" className="w-40 h-40" /> : <div className="w-40 h-40" />}
      <div className="text-sm font-semibold text-tremor-content-strong">{baht(amount)}</div>
      {name && <div className="text-xs text-tremor-content-subtle">{name}</div>}
      <div className="text-xs text-tremor-content-subtle px-4 text-center">
        ให้ลูกค้าสแกน แล้วกด “ชำระเงิน” เมื่อได้รับเงิน
      </div>
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
    <Modal open title={`${product.name} · เลือกขนาด`} onCancel={onClose} footer={null} destroyOnHidden width={400}>
      <div className="space-y-2 mt-1">
        {product.variants.map((v) => (
          <button
            key={v.id}
            disabled={v.stock_qty <= 0}
            onClick={() => onPick(v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#EFE4DD] hover:border-[#F15929] disabled:opacity-40 transition">
            <span className="text-sm font-medium text-[#2B2320]">{v.size ?? 'ปกติ'}</span>
            <span className="text-sm">
              <span className="font-semibold text-[#2B2320]">{baht(v.price)}</span>
              <span className="text-xs text-gray-400 ml-2">คงเหลือ {v.stock_qty}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function OpenShiftGate({ onOpen }: { onOpen: (float: number) => Promise<void> }) {
  const { message } = App.useApp();
  const [float, setFloat] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 9rem)' }}>
      <Card style={{ maxWidth: 360, width: '100%', textAlign: 'center' }} styles={{ body: { padding: 28 } }}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl grid place-items-center" style={{ background: '#FDEEE7' }}>
          <RiMoneyDollarCircleLine className="w-7 h-7" style={{ color: '#F15929' }} />
        </div>
        <Typography.Title level={4} style={{ margin: 0 }}>เปิดกะขาย</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
          ใส่จำนวนเงินสดตั้งต้นในลิ้นชักเพื่อเริ่มขาย
        </Typography.Paragraph>
        <InputNumber
          size="large"
          min={0}
          prefix="฿"
          value={float}
          onChange={(v) => setFloat(typeof v === 'number' ? v : 0)}
          style={{ width: '100%', margin: '8px 0 20px' }}
          autoFocus
        />
        <Button
          type="primary"
          size="large"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onOpen(float ?? 0);
            } catch (e) {
              message.error(apiError(e));
            } finally {
              setBusy(false);
            }
          }}>
          เปิดกะ
        </Button>
      </Card>
    </div>
  );
}

function CloseShiftButton({ shift, setShift }: { shift: Shift; setShift: (s: Shift | null) => void }) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Shift | null>(null);

  const doClose = async () => {
    setBusy(true);
    try {
      setResult(await closeShift(shift.id, counted ?? 0));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const finish = () => {
    setOpen(false);
    setResult(null);
    setShift(null);
    cacheShift(null);
  };

  return (
    <>
      <Button shape="round" onClick={() => setOpen(true)}>
        ปิดกะ
      </Button>
      <Modal
        open={open}
        title={result ? 'ปิดกะแล้ว' : 'ปิดกะ'}
        destroyOnHidden
        onCancel={() => (result ? finish() : setOpen(false))}
        footer={
          result
            ? [<Button key="ok" type="primary" block onClick={finish}>เสร็จสิ้น</Button>]
            : [
                <Button key="c" onClick={() => setOpen(false)}>ยกเลิก</Button>,
                <Button key="ok" type="primary" loading={busy} disabled={counted == null} onClick={() => void doClose()}>
                  ปิดกะ
                </Button>,
              ]
        }>
        {result ? (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-3 gap-2">
              <Statistic title="เงินตั้งต้น" value={result.opening_float} prefix="฿" />
              <Statistic title="ควรมี" value={result.expected_cash ?? 0} prefix="฿" />
              <Statistic title="นับได้" value={result.counted_cash ?? 0} prefix="฿" />
            </div>
            <div
              className="rounded-xl p-3 flex items-center justify-between"
              style={{ background: (result.over_short ?? 0) < 0 ? '#FDECEC' : '#EAF6EF' }}>
              <span className="font-medium">ส่วนต่าง</span>
              <span className="font-bold" style={{ color: (result.over_short ?? 0) < 0 ? '#C9252B' : '#017A3A' }}>
                {(result.over_short ?? 0) >= 0 ? '+' : ''}
                {baht(result.over_short ?? 0)}
              </span>
            </div>
          </div>
        ) : (
          <div className="pt-1">
            <Typography.Paragraph type="secondary">นับเงินสดในลิ้นชักแล้วกรอกยอดที่นับได้</Typography.Paragraph>
            <InputNumber
              size="large"
              min={0}
              prefix="฿"
              value={counted}
              onChange={(v) => setCounted(typeof v === 'number' ? v : null)}
              style={{ width: '100%' }}
              autoFocus
            />
          </div>
        )}
      </Modal>
    </>
  );
}

function ReceiptModal({ data, shop, onClose }: { data: ReceiptData; shop: ShopInfo; onClose: () => void }) {
  const { sale, lines, method, at } = data;
  return (
    <Modal
      open
      onCancel={onClose}
      width={340}
      destroyOnHidden
      footer={[
        <Button key="print" icon={<RiPrinterLine className="w-4 h-4" />} onClick={() => window.print()}>
          พิมพ์บิล
        </Button>,
        <Button key="next" type="primary" onClick={onClose}>
          ขายต่อ
        </Button>,
      ]}>
      <div id="pos-receipt" className="font-mono text-[13px] text-black leading-relaxed pt-1">
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
          {data.offline && (
            <div className="mt-1 text-[11px] text-center border border-dashed border-black rounded py-0.5">
              บิลออฟไลน์ — จะออกเลขที่จริงเมื่อซิงค์
            </div>
          )}
          <div className="border-t border-dashed border-black my-2" />
          {lines.map((l) => (
            <div key={l.variantId} className="mb-1">
              <div>
                {l.name}
                {l.size ? ` (${l.size})` : ''}
              </div>
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
          <Line2
            label={method === 'cash' ? 'เงินสด' : 'พร้อมเพย์'}
            value={method === 'cash' ? sale.total + sale.change : sale.total}
          />
          {method === 'cash' && <Line2 label="เงินทอน" value={sale.change} />}
          <div className="text-center text-[11px] mt-3">{shop.receipt_footer || 'ขอบคุณที่ใช้บริการ'}</div>
        </div>
    </Modal>
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
