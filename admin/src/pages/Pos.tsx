import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiErrorWarningLine,
  RiMoneyDollarCircleLine,
  RiPrinterLine,
  RiQrCodeLine,
  RiQrScanLine,
  RiSearchLine,
  RiShoppingBasket2Line,
  RiSubtractLine,
} from '@remixicon/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import {
  apiError,
  createPosSale,
  getShopInfo,
  listPosCatalog,
  type PosProduct,
  type PosVariant,
  type SaleResult,
  type ShopInfo,
} from '../lib/api';
import {
  cacheCatalog,
  cacheShop,
  enqueueSale,
  flushQueue,
  isNetworkError,
  queueCount,
  readCachedCatalog,
  readCachedShop,
} from '../lib/offline';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Statistic,
  Tag,
  type InputRef,
} from 'antd';

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

// ── numeric-only money inputs ───────────────────────────────────────────────
// Block any key that isn't a digit (paste is still cleaned by moneyParser).
function digitsOnlyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const nav = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End', 'Enter'];
  if (nav.includes(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}
// ฿ + thousands separators via formatter/parser — avoids InputNumber's `prefix`
// element, which renders a weird inner border on focus.
const moneyFormatter = (v?: string | number) =>
  v === undefined || v === '' ? '' : `฿ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const moneyParser = (v?: string) => (v ? v.replace(/[^\d]/g, '') : '');

// Short error tone so the cashier notices a failed scan without looking at the screen.
let audioCtx: AudioContext | null = null;
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  } catch {
    /* audio unavailable — visual flash is enough */
  }
}

export function Pos() {
  const [shop, setShop] = useState<ShopInfo | null>(null);
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
  const searchRef = useRef<InputRef>(null);

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
        const [s, c] = await Promise.all([getShopInfo(), listPosCatalog()]);
        setShop(s);
        cacheShop(s);
        setCatalog(c);
        cacheCatalog(c);
      } catch (e) {
        if (isNetworkError(e)) {
          // offline: fall back to the last cached catalog / shop
          const cc = readCachedCatalog();
          const cs = readCachedShop();
          if (cc) setCatalog(cc);
          if (cs) setShop(cs);
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
    const map = new Map<string, { name: string; count: number }>();
    for (const p of catalog) {
      if (!p.category_id) continue;
      const cur = map.get(p.category_id);
      if (cur) cur.count++;
      else map.set(p.category_id, { name: p.category_name ?? '—', count: 1 });
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
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

  /* ── barcode / QR scanner ──────────────────────────────────────────────── */
  // Scanner guns act as a keyboard wedge: they "type" the code fast then Enter.
  type ScanTone = 'ok' | 'warn' | 'error';
  const [scanMsg, setScanMsg] = useState<{ text: string; tone: ScanTone } | null>(null);
  const scanMsgTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flashScan(text: string, tone: ScanTone) {
    setScanMsg({ text, tone });
    clearTimeout(scanMsgTimer.current);
    scanMsgTimer.current = setTimeout(() => setScanMsg(null), tone === 'ok' ? 1500 : 2800);
    if (tone === 'error') beep();
  }
  function findByCode(raw: string): { p: PosProduct; v: PosVariant } | null {
    const code = raw.trim();
    if (!code) return null;
    for (const p of catalog) {
      const v = p.variants.find((x) => x.barcode === code || x.sku === code);
      if (v) return { p, v };
    }
    return null;
  }
  /** Look up a scanned/typed code and add it to the cart. Returns true if matched. */
  function scan(raw: string, fromScanner: boolean): boolean {
    const hit = findByCode(raw);
    if (hit) {
      addVariant(hit.p, hit.v);
      const oos = hit.v.stock_qty <= 0;
      const label = `${hit.p.name}${hit.v.size ? ' · ' + hit.v.size : ''}`;
      flashScan(oos ? `${label} — สต็อกหมด` : label, oos ? 'warn' : 'ok');
      return true;
    }
    if (fromScanner) flashScan(`ไม่พบสินค้ารหัส ${raw.trim()}`, 'error');
    return false;
  }
  // Keep a live ref so the global listener always calls the latest closure.
  const scanRef = useRef(scan);
  scanRef.current = scan;

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    // In the search box a match is a scan; a miss stays as a text filter.
    if (scan(query, false)) setQuery('');
  }

  // Global keyboard-wedge capture: works even when the search box isn't focused,
  // and never hijacks real typing in other inputs.
  useEffect(() => {
    const buf = { chars: '', last: 0 };
    function editable(el: EventTarget | null) {
      const n = el as HTMLElement | null;
      if (!n?.tagName) return false;
      return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (editable(e.target)) return; // let the focused field (incl. search box) handle it
      const now = e.timeStamp;
      if (now - buf.last > 120) buf.chars = ''; // slow gap → not a scan burst
      buf.last = now;
      if (e.key === 'Enter') {
        const code = buf.chars;
        buf.chars = '';
        if (code.length >= 3) {
          e.preventDefault();
          scanRef.current(code, true);
        }
        return;
      }
      if (e.key.length === 1) buf.chars += e.key; // printable char
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    setMethod('cash');
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

  return (
    <div className="-m-4 lg:-m-7 p-4 lg:p-6 bg-[#FBF2EC] min-h-[calc(100vh-4rem)]">
      <div className="lg:grid lg:grid-cols-[1fr_23rem] lg:gap-5 lg:h-[calc(100vh-6.5rem)]">
        {/* ── left: search + categories + grid ────────────────────────────── */}
        <div className="relative flex flex-col min-h-0">
          {/* status bar — only when offline or has queued sales */}
          {(!online || pending > 0) && (
            <div className="flex items-center gap-2 mb-3">
              {!online && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  ออฟไลน์ — ขายต่อได้ ระบบจะซิงค์ให้เมื่อกลับมาออนไลน์
                </span>
              )}
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
            </div>
          )}

          <Input
            ref={searchRef}
            autoFocus
            size="large"
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="ยิงบาร์โค้ด/QR หรือค้นหาสินค้า…"
            prefix={<RiSearchLine className="w-5 h-5 text-tremor-content-subtle mr-1" />}
            suffix={
              <Tag
                bordered={false}
                icon={<RiQrScanLine className="w-3.5 h-3.5" />}
                className="!m-0 !inline-flex !items-center !gap-1 !text-[11px] !bg-[#F5EFEB] !text-tremor-content">
                พร้อมยิง
              </Tag>
            }
            className="mb-4"
            style={{ borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />

          <div className="flex flex-wrap gap-2 mb-4 shrink-0">
            <Pill active={cat === null} onClick={() => setCat(null)} count={catalog.length}>
              ทั้งหมด
            </Pill>
            {categories.map((c) => (
              <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} count={c.count}>
                {c.name}
              </Pill>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:overflow-y-auto lg:flex-1 pr-1 pb-28 lg:pb-2 content-start">
            {shown.map((p) => {
              const price = p.variants[0]?.price ?? 0;
              const stock = p.variants.reduce((s, v) => s + v.stock_qty, 0);
              const single = p.variants.length === 1 ? p.variants[0] : null;
              const inCart = single
                ? qtyByVariant.get(single.id) ?? 0
                : p.variants.reduce((s, v) => s + (qtyByVariant.get(v.id) ?? 0), 0);
              const oos = stock <= 0;
              return (
                <Card
                  key={p.id}
                  hoverable={!oos}
                  onClick={() => !oos && pick(p)}
                  styles={{ body: { padding: 12 } }}
                  style={{
                    overflow: 'hidden',
                    cursor: oos ? 'not-allowed' : 'pointer',
                    opacity: oos ? 0.55 : 1,
                    borderColor: inCart > 0 ? '#f15929' : '#EFE6E0',
                    boxShadow: inCart > 0 ? '0 6px 16px -8px rgba(241,89,41,0.45)' : undefined,
                  }}
                  cover={
                    <div className="relative aspect-square bg-[#F6ECE5] grid place-items-center overflow-hidden">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <RiShoppingBasket2Line className="w-8 h-8 text-tremor-brand-subtle" />
                      )}
                      {inCart > 0 && (
                        <Badge
                          count={inCart}
                          color="#f15929"
                          style={{ position: 'absolute', top: 8, insetInlineEnd: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                        />
                      )}
                      {oos && (
                        <Tag color="default" className="!absolute !top-2 !left-2 !m-0 !bg-black/65 !text-white !border-0">
                          สต็อกหมด
                        </Tag>
                      )}
                    </div>
                  }>
                  <div className="text-[14px] font-semibold text-tremor-content-strong leading-snug line-clamp-1">
                    {p.name}
                  </div>
                  <div className="text-xs text-tremor-content mt-0.5 line-clamp-1 min-h-[1rem]">
                    {p.subtitle ?? p.category_name ?? ''}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[16px] font-bold text-tremor-content-strong">
                      {p.variants.length > 1 ? `${baht(price)}+` : baht(price)}
                    </span>
                    <Button
                      type="primary"
                      shape="circle"
                      size="middle"
                      disabled={oos}
                      icon={<RiAddLine className="w-[18px] h-[18px]" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!oos) pick(p);
                      }}
                    />
                  </div>
                </Card>
              );
            })}
            {shown.length === 0 && (
              <div className="col-span-full py-12">
                <Empty description="ไม่พบสินค้า" />
              </div>
            )}
          </div>

          {/* scan feedback — floats above the grid, never covers search/categories */}
          {scanMsg && (
            <div
              className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 text-sm font-medium shadow-lg ${
                scanMsg.tone === 'ok'
                  ? 'bg-emerald-600 text-white'
                  : scanMsg.tone === 'warn'
                    ? 'bg-amber-500 text-white'
                    : 'bg-red-600 text-white'
              }`}>
              {scanMsg.tone === 'ok' ? (
                <RiCheckLine className="w-[18px] h-[18px] shrink-0" />
              ) : (
                <RiErrorWarningLine className="w-[18px] h-[18px] shrink-0" />
              )}
              <span className="max-w-[60vw] lg:max-w-md truncate">{scanMsg.text}</span>
            </div>
          )}
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
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-tremor-content-strong">บิลปัจจุบัน</span>
              {lines.length > 0 && (
                <span className="min-w-[22px] h-[22px] px-1.5 grid place-items-center rounded-full bg-tremor-brand-faint text-tremor-brand-emphasis text-xs font-bold">
                  {lines.reduce((s, l) => s + l.qty, 0)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {lines.length > 0 && (
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<RiDeleteBin6Line className="w-3.5 h-3.5" />}
                  onClick={resetSale}>
                  ล้างบิล
                </Button>
              )}
              <Button
                type="text"
                shape="circle"
                className="lg:hidden"
                icon={<RiCloseLine className="w-5 h-5" />}
                onClick={() => setCartOpen(false)}
              />
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          <div className="flex-1 overflow-y-auto px-2">
            {lines.length === 0 ? (
              <div className="h-full grid place-items-center">
                <Empty
                  image={<RiShoppingBasket2Line className="w-12 h-12 text-[#E7D8CE] mx-auto" />}
                  imageStyle={{ height: 48 }}
                  description={<span className="text-tremor-content-subtle">เลือกสินค้าเพื่อเริ่มบิล</span>}
                />
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
          <div className="border-t border-tremor-border p-4 space-y-3">
            <div className="rounded-xl bg-[#FBF7F4] border border-[#F0E7E1] p-3.5">
              <Row label="ยอดรวม" value={baht(subtotal)} />
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-tremor-content">ส่วนลดทั้งบิล</span>
                <InputNumber
                  min={0}
                  precision={0}
                  size="small"
                  controls={false}
                  inputMode="numeric"
                  formatter={moneyFormatter}
                  parser={moneyParser}
                  onKeyDown={digitsOnlyKeyDown}
                  placeholder="฿ 0"
                  value={discount || null}
                  onChange={(v) => setDiscount(Math.max(0, Number(v) || 0))}
                  style={{ width: 120 }}
                />
              </div>
              {shop?.vat_registered && <div className="mt-2"><Row label="ราคาก่อน VAT" value={baht(net)} subtle /></div>}
              {shop?.vat_registered && <div className="mt-1"><Row label={`VAT ${shop.vat_rate}%`} value={baht(vat)} subtle /></div>}
              <Divider style={{ margin: '12px 0' }} />
              <div className="flex items-center justify-between">
                <span className="font-semibold text-tremor-content-strong">ยอดสุทธิ</span>
                <Statistic
                  value={total}
                  prefix="฿"
                  valueStyle={{ color: '#c5410f', fontWeight: 700, fontSize: 26, lineHeight: 1 }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
              <Checkbox checked={taxInvoice} onChange={(e) => setTaxInvoice(e.target.checked)}>
                ออกใบกำกับภาษีเต็มรูป
              </Checkbox>
            )}
            {taxInvoice && (
              <div className="space-y-2">
                <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="ชื่อลูกค้า" />
                <Input
                  value={custTaxId}
                  onChange={(e) => setCustTaxId(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  maxLength={13}
                  placeholder="เลขประจำตัวผู้เสียภาษี"
                />
              </div>
            )}

            <Button
              type="primary"
              block
              size="large"
              loading={busy}
              icon={busy ? undefined : <RiCheckLine className="w-5 h-5" />}
              onClick={checkout}
              disabled={!lines.length}
              style={{
                height: 52,
                fontWeight: 600,
                borderRadius: 16,
                boxShadow: '0 10px 22px -8px rgba(241,89,41,0.6)',
              }}>
              {busy ? 'กำลังบันทึก…' : `ชำระเงิน ${baht(total)}`}
            </Button>
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

function Pill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Button shape="round" onClick={onClick} type={active ? 'primary' : 'default'} style={{ fontWeight: 500 }}>
      {children}
      {count != null && (
        <Badge
          count={count}
          showZero
          overflowCount={999}
          color={active ? 'rgba(255,255,255,0.28)' : '#EDE4DE'}
          style={{ color: active ? '#fff' : '#8a807a', marginInlineStart: 6, fontWeight: 600, boxShadow: 'none' }}
        />
      )}
    </Button>
  );
}

function StepBtn({ onClick, children, brand }: { onClick: () => void; children: React.ReactNode; brand?: boolean }) {
  return <Button size="small" shape="circle" type={brand ? 'primary' : 'default'} onClick={onClick} icon={children} />;
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
    <Button
      onClick={onClick}
      type={active ? 'primary' : 'default'}
      icon={<Icon className="w-4 h-4" />}
      block
      style={{ height: 44, justifyContent: 'center', fontWeight: 500 }}>
      {children}
    </Button>
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
        <InputNumber
          controls={false}
          min={0}
          precision={0}
          inputMode="numeric"
          formatter={moneyFormatter}
          parser={moneyParser}
          onKeyDown={digitsOnlyKeyDown}
          placeholder="฿ 0"
          value={tendered === '' ? null : tendered}
          onChange={(v) => setTendered(v == null ? '' : Math.max(0, Number(v)))}
          style={{ width: 140 }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((v, i) => (
          <Button key={i} onClick={() => setTendered(v)} style={{ padding: '0 4px' }}>
            {v === total ? 'พอดี' : baht(v)}
          </Button>
        ))}
      </div>
      {typeof tendered === 'number' && tendered >= total && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
          <span className="text-emerald-700">เงินทอน</span>
          <span className="font-bold text-emerald-700">{baht(change)}</span>
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
            <img
              src="/logo-oofoo.png"
              alt=""
              className="h-14 mx-auto mb-1 object-contain"
              style={{ filter: 'grayscale(1) contrast(1.15)' }}
            />
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
