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
  listCategories,
  listPosCatalog,
  type Category,
  type PosProduct,
  type PosVariant,
  type SaleResult,
  type ShopInfo,
} from '../lib/api';
import {
  cacheCatalog,
  cacheCategories,
  cacheShop,
  dismissFailedSale,
  enqueueSale,
  type FailedSale,
  flushQueue,
  isNetworkError,
  queueCount,
  readCachedCatalog,
  readCachedCategories,
  readCachedShop,
  readFailedQueue,
  retryFailedSale,
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
  Segmented,
  Statistic,
  Tag,
  type InputRef,
} from 'antd';

import { Receipt } from '../components/Receipt';
import { ReceiptBoundary } from '../components/ReceiptBoundary';
import { promptpayPayload } from '../lib/promptpay';

type Line = {
  variantId: string;
  name: string;
  size: string | null;
  unitPrice: number;
  qty: number;
  image: string | undefined;
};
type PayMethod = 'cash' | 'promptpay';
type ReceiptData = {
  sale: SaleResult;
  lines: Line[];
  method: PayMethod;
  at: string;
  offline?: boolean;
  customerName?: string;
  customerTaxId?: string;
};

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
  const [allCategories, setAllCategories] = useState<Category[]>([]);
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
  const [failedSales, setFailedSales] = useState<FailedSale[]>([]); // synced failed for a real reason — needs manual review
  const [failedOpen, setFailedOpen] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null); // client_op_id currently retrying
  const searchRef = useRef<InputRef>(null);
  // Remembers the client_op_id used for the CURRENT checkout attempt, keyed
  // to a snapshot of exactly what was sent — see checkout()'s use of it.
  const lastAttemptRef = useRef<{ opId: string; signature: string } | null>(null);

  const doFlush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const { synced, remaining, failed } = await flushQueue(createPosSale);
    setPending(remaining);
    if (failed > 0) setFailedSales(readFailedQueue());
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

  async function retryFailed(clientOpId: string) {
    setRetrying(clientOpId);
    try {
      const res = await retryFailedSale(clientOpId, createPosSale);
      setFailedSales(readFailedQueue());
      setPending(queueCount());
      if (res.ok) {
        try {
          const c = await listPosCatalog();
          setCatalog(c);
          cacheCatalog(c);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setRetrying(null);
    }
  }

  function dismissFailed(clientOpId: string) {
    dismissFailedSale(clientOpId);
    setFailedSales(readFailedQueue());
  }

  useEffect(() => {
    (async () => {
      try {
        const [s, c, cats] = await Promise.all([getShopInfo(), listPosCatalog(), listCategories()]);
        setShop(s);
        cacheShop(s);
        setCatalog(c);
        cacheCatalog(c);
        setAllCategories(cats);
        cacheCategories(cats);
      } catch (e) {
        if (isNetworkError(e)) {
          // offline: fall back to the last cached catalog / shop / categories
          const cc = readCachedCatalog();
          const cs = readCachedShop();
          const ccats = readCachedCategories();
          if (cc) setCatalog(cc);
          if (cs) setShop(cs);
          if (ccats) setAllCategories(ccats);
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
    setFailedSales(readFailedQueue());
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

  // Every category the shop has, not just the ones with products currently in
  // the catalog — a freshly-created category with nothing assigned to it yet
  // still shows up as a (0-count) filter pill instead of silently vanishing.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of catalog) {
      if (!p.category_id) continue;
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }
    return allCategories.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }));
  }, [catalog, allCategories]);

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
    // Keypad-emulation scanner support (Alt + ASCII on the numpad) — see the
    // Products modal wedge for the full story.
    const alt = { digits: '' };
    const finalizeAlt = (now: number) => {
      if (!alt.digits) return;
      const n = parseInt(alt.digits, 10);
      alt.digits = '';
      if (Number.isFinite(n) && n > 0 && n <= 255) {
        buf.chars += String.fromCharCode(n);
        buf.last = now;
      }
    };
    function editable(el: EventTarget | null) {
      const n = el as HTMLElement | null;
      if (!n?.tagName) return false;
      return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (editable(e.target)) return; // let the focused field (incl. search box) handle it
      const now = e.timeStamp;
      if (e.key === 'Alt') {
        finalizeAlt(now);
        return;
      }
      const numpad = e.altKey ? /^Numpad(\d)$/.exec(e.code) : null;
      if (numpad) {
        alt.digits += numpad[1];
        buf.last = now;
        return;
      }
      if (now - buf.last > 120) buf.chars = ''; // slow gap → not a scan burst
      buf.last = now;
      if (e.key === 'Enter') {
        finalizeAlt(now);
        const code = buf.chars;
        buf.chars = '';
        if (code.length >= 3) {
          // Swallow the scan's Enter before the focused element sees it — a
          // focused button/menu item would otherwise be "clicked" by the scan.
          e.preventDefault();
          e.stopPropagation();
          scanRef.current(code, true);
        }
        return;
      }
      if (e.key.length === 1) buf.chars += e.key; // printable char
    }
    // Capture phase: run before the focused element's own handlers.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  // Keep the scan target focused so a wired scanner types INTO the page, not the
  // browser address bar (which would turn a scan into a web search). Focus the
  // search box on mount and whenever the tab/window regains focus — but never
  // steal focus away from another field the cashier is actively typing in.
  useEffect(() => {
    function focusScan() {
      const a = document.activeElement as HTMLElement | null;
      const busyField =
        a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
      if (!busyField) searchRef.current?.focus();
    }
    const id = setTimeout(focusScan, 300);
    window.addEventListener('focus', focusScan);
    return () => {
      clearTimeout(id);
      window.removeEventListener('focus', focusScan);
    };
  }, []);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);
  // Removing a line after setting a discount can leave a stale discount above
  // the new (smaller) subtotal — clamp it down so the total shown is always
  // what actually gets charged, not a display that then fails at checkout.
  useEffect(() => {
    setDiscount((d) => Math.min(d, subtotal));
  }, [subtotal]);
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
    lastAttemptRef.current = null;
    searchRef.current?.focus();
  }

  async function checkout() {
    if (!lines.length || busy) return;
    // A ฿0 total (e.g. a full-discount giveaway) needs no cash tendered at
    // all — only enforce "enough cash" once there's actually something to pay.
    if (method === 'cash' && total > 0 && (typeof tendered !== 'number' || tendered < total)) {
      setError('เงินที่รับมาไม่พอ');
      return;
    }
    const baseInput = {
      items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
      payment_method: method,
      cash_tendered: method === 'cash' ? (typeof tendered === 'number' ? tendered : total) : undefined,
      discount,
      tax_invoice: taxInvoice,
      customer_name: taxInvoice ? custName || undefined : undefined,
      customer_tax_id: taxInvoice ? custTaxId || undefined : undefined,
    };
    // Reuse the SAME client_op_id for a retry of the exact same attempt. If
    // the previous try actually committed server-side but the client only
    // saw an ambiguous (non-network) error — a slow response, a proxy hiccup
    // — create_pos_sale's idempotent replay-by-client_op_id (0029/0041) then
    // returns the already-committed sale instead of ringing it up again. A
    // real change to the sale (items/discount/tender/...) gets a fresh id,
    // since replaying the OLD id against a MODIFIED input would silently
    // ignore what the cashier just changed and hand back the stale sale.
    const signature = JSON.stringify(baseInput);
    const opId =
      lastAttemptRef.current?.signature === signature
        ? lastAttemptRef.current.opId
        : crypto.randomUUID();
    lastAttemptRef.current = { opId, signature };
    const input = { client_op_id: opId, ...baseInput };
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
      setReceipt({
        sale,
        lines: soldLines,
        method,
        at,
        customerName: taxInvoice ? custName || undefined : undefined,
        customerTaxId: taxInvoice ? custTaxId || undefined : undefined,
      });
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
        setReceipt({
          sale: provisional,
          lines: soldLines,
          method,
          at,
          offline: true,
          customerName: taxInvoice ? custName || undefined : undefined,
          customerTaxId: taxInvoice ? custTaxId || undefined : undefined,
        });
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
    <div className="-m-4 lg:-m-7 p-4 lg:p-6 bg-white min-h-[calc(100vh-4rem)]">
      <div className="lg:grid lg:grid-cols-[1fr_23rem] lg:h-[calc(100vh-6.5rem)]">
        {/* ── left: search + categories + grid ────────────────────────────── */}
        <div className="relative flex flex-col min-h-0 lg:pr-5">
          {/* Sales that already happened (cash/goods changed hands, a
              provisional receipt printed) but failed to sync for a real
              reason — never auto-dismisses, always visible until someone
              reviews it, deliberately styled distinct from the routine amber
              "waiting to sync" pill below. */}
          {failedSales.length > 0 && (
            <button
              onClick={() => setFailedOpen(true)}
              className="mb-3 flex w-full items-center gap-2 rounded-none bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-3 py-2 text-left hover:bg-red-100">
              <RiErrorWarningLine className="w-5 h-5 shrink-0" />
              <span className="flex-1">
                {failedSales.length} รายการขายไม่ได้ซิงค์เข้าระบบ (สินค้า/เงินออกไปแล้วจริง) — ต้องตรวจสอบด้วยตนเอง
              </span>
              <span className="underline shrink-0">ดูรายการ</span>
            </button>
          )}
          {/* status bar — only when offline or has queued sales */}
          {(!online || pending > 0) && (
            <div className="flex items-center gap-2 mb-3">
              {!online && (
                <span className="inline-flex items-center gap-1.5 rounded-none bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-none bg-amber-500" />
                  ออฟไลน์ — ขายต่อได้ ระบบจะซิงค์ให้เมื่อกลับมาออนไลน์
                </span>
              )}
              {pending > 0 && (
                <button
                  onClick={() => void doFlush()}
                  disabled={!online}
                  title="ซิงค์บิลที่ค้าง"
                  className="inline-flex items-center gap-1.5 rounded-none bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 shadow-sm disabled:opacity-60">
                  <span className="w-1.5 h-1.5 rounded-none bg-amber-500" />
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
            // No browser autofill: Chrome remembered old scans and its suggestion
            // popup swallowed the scan's Enter (picking a stale code).
            autoComplete="off"
            data-flight-log="true"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="ยิงบาร์โค้ด/QR หรือค้นหาสินค้า…"
            prefix={<RiSearchLine className="w-5 h-5 text-tremor-content-subtle mr-1" />}
            suffix={
              <Tag
                variant="filled"
                icon={<RiQrScanLine className="w-3.5 h-3.5" />}
                className="!m-0 !inline-flex !items-center !gap-1 !text-[11px] !bg-[#F5F5F5] !text-tremor-content">
                พร้อมยิง
              </Tag>
            }
            className="mb-4"
            style={{ borderRadius: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          />

          <div className="flex flex-wrap gap-2 mb-4 pb-4 shrink-0 border-b-2 border-[#D9D9D9]">
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
                  styles={{ body: { padding: '12px 14px 14px' } }}
                  style={{
                    overflow: 'hidden',
                    cursor: oos ? 'not-allowed' : 'pointer',
                    opacity: oos ? 0.55 : 1,
                    borderColor: inCart > 0 ? '#5B8C6E' : '#E8E8E8',
                  }}
                  cover={
                    // Native aspect-ratio (not Tailwind's aspect-square, which
                    // wasn't producing height in prod — the box collapsed and
                    // object-cover cropped the photo to a thin strip).
                    <div className="relative bg-[#FAFAFA] overflow-hidden">
                      {p.image ? (
                        // The <img> is a square in normal flow: object-cover crops
                        // the photo and aspect-ratio keeps the box square without
                        // relying on the parent (Tailwind's aspect-square collapsed
                        // in prod, leaving only a thin strip of the product).
                        <img
                          src={p.image}
                          alt={p.name}
                          className="block w-full object-cover"
                          style={{ aspectRatio: '1 / 1' }}
                        />
                      ) : (
                        // No photo yet: a per-product initial in a soft brand
                        // circle reads as "designed" and gives each card its own
                        // identity — a repeated generic icon on every card made
                        // the whole grid look identical/unfinished.
                        <div className="grid place-items-center" style={{ aspectRatio: '1 / 1' }}>
                          <div className="w-16 h-16 rounded-full grid place-items-center" style={{ background: '#EDF3EF' }}>
                            <span className="text-2xl font-bold" style={{ color: '#3F6B52' }}>
                              {p.name.trim().charAt(0)}
                            </span>
                          </div>
                        </div>
                      )}
                      {inCart > 0 && (
                        <Badge
                          count={inCart}
                          color="#5B8C6E"
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
              className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-none pl-3 pr-4 py-2.5 text-sm font-medium shadow-lg ${
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
          className={`flex flex-col min-h-0 bg-white shadow-sm rounded-none lg:rounded-none lg:shadow-none lg:border-l-2 lg:border-[#D9D9D9] lg:pl-5 fixed inset-y-0 right-0 z-40 w-full max-w-sm transition-transform duration-300 lg:static lg:z-auto lg:w-auto lg:max-w-none ${
            cartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}>
          <div className="px-5 py-4 flex items-center justify-between border-b border-tremor-border">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-tremor-content-strong">บิลปัจจุบัน</span>
              {lines.length > 0 && (
                <span className="min-w-[22px] h-[22px] px-1.5 grid place-items-center rounded-none bg-tremor-brand-faint text-tremor-brand-emphasis text-xs font-bold">
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
            <div className="mx-4 mt-3 rounded-none bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          <div className="flex-1 overflow-y-auto px-2">
            {lines.length === 0 ? (
              <div className="h-full grid place-items-center">
                <Empty
                  image={<RiShoppingBasket2Line className="w-12 h-12 text-[#D9D9D9] mx-auto" />}
                  styles={{ image: { height: 48 } }}
                  description={<span className="text-tremor-content-subtle">เลือกสินค้าเพื่อเริ่มบิล</span>}
                />
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {lines.map((l) => (
                  <div key={l.variantId} className="flex items-center gap-3 px-2 py-3 hover:bg-[#FAFAFA]">
                    <div className="w-11 h-11 rounded-none overflow-hidden bg-[#F5F5F5] border border-[#E8E8E8] grid place-items-center shrink-0">
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
                    <QtyStepper qty={l.qty} onChange={(qty) => setQty(l.variantId, qty)} />
                    <div className="w-16 text-right text-sm font-bold text-tremor-content-strong">
                      {baht(l.unitPrice * l.qty)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* totals + pay */}
          <div className="border-t border-tremor-border p-4 space-y-3">
            <Card size="small" style={{ background: '#FAFAFA', borderColor: '#E8E8E8' }} styles={{ body: { padding: 14 } }}>
              <Row label="ยอดรวม" value={baht(subtotal)} />
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-tremor-content">ส่วนลดทั้งบิล</span>
                <InputNumber
                  min={0}
                  max={subtotal}
                  precision={0}
                  size="small"
                  controls={false}
                  inputMode="numeric"
                  formatter={moneyFormatter}
                  parser={moneyParser}
                  onKeyDown={digitsOnlyKeyDown}
                  placeholder="฿ 0"
                  value={discount || null}
                  onChange={(v) => setDiscount(Math.min(subtotal, Math.max(0, Number(v) || 0)))}
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
                  styles={{ content: { color: '#5B8C6E', fontWeight: 700, fontSize: 26, lineHeight: 1 } }}
                />
              </div>
            </Card>

            <Segmented
              block
              size="large"
              value={method}
              onChange={(v) => setMethod(v as PayMethod)}
              options={[
                {
                  value: 'cash',
                  label: (
                    <span className="inline-flex items-center gap-1.5 justify-center py-0.5">
                      <RiMoneyDollarCircleLine className="w-4 h-4" /> เงินสด
                    </span>
                  ),
                },
                {
                  value: 'promptpay',
                  label: (
                    <span className="inline-flex items-center gap-1.5 justify-center py-0.5">
                      <RiQrCodeLine className="w-4 h-4" /> พร้อมเพย์
                    </span>
                  ),
                },
              ]}
            />

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
                borderRadius: 0,
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
          className="lg:hidden fixed bottom-3 inset-x-3 z-30 rounded-none bg-tremor-brand text-white shadow-lg flex items-center justify-between px-5 py-3.5 hover:bg-tremor-brand-emphasis">
          <span className="flex items-center gap-2 font-medium">
            <span className="grid place-items-center min-w-[1.5rem] h-6 px-1.5 rounded-none bg-white/25 text-xs font-bold">
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
      {failedOpen && (
        <Modal
          open
          title={`รายการขายที่ยังไม่ได้ซิงค์ (${failedSales.length})`}
          onCancel={() => setFailedOpen(false)}
          footer={null}
          width={520}>
          <p className="text-sm text-tremor-content mb-4">
            รายการเหล่านี้ขายจริงแล้ว (ลูกค้าได้รับสินค้าและร้านได้รับเงินแล้ว) แต่บันทึกเข้าระบบไม่สำเร็จ —
            กด &quot;ลองใหม่&quot; ถ้าคิดว่าสาเหตุหมดไปแล้ว (เช่น เติมสต๊อกแล้ว) หรือ &quot;รับทราบ&quot;
            เพื่อปิดรายการหลังตรวจสอบ/บันทึกด้วยมือแล้ว
          </p>
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {failedSales.map((f) => {
              const itemLabel = f.input.items
                .map((it) => {
                  for (const p of catalog) {
                    const v = p.variants.find((x) => x.id === it.variant_id);
                    if (v) return `${p.name}${v.size ? ' · ' + v.size : ''} ×${it.qty}`;
                  }
                  return `สินค้า (ลบ/เปลี่ยนแล้ว) ×${it.qty}`;
                })
                .join(', ');
              return (
                <div key={f.input.client_op_id} className="rounded-none border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-[#2B2320] font-medium">{baht(f.total)}</div>
                    <div className="text-xs text-tremor-content">
                      {new Date(f.at).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <div className="text-xs text-tremor-content mt-1">{itemLabel}</div>
                  <div className="text-xs text-red-700 mt-1">เหตุผล: {apiError({ message: f.reason })}</div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="small"
                      loading={retrying === f.input.client_op_id}
                      onClick={() => void retryFailed(f.input.client_op_id)}>
                      ลองใหม่
                    </Button>
                    <Button size="small" danger onClick={() => dismissFailed(f.input.client_op_id)}>
                      รับทราบ (ปิดรายการ)
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
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
    <Button onClick={onClick} type={active ? 'primary' : 'default'} style={{ fontWeight: 500 }}>
      {children}
      {count != null && (
        <Badge
          count={count}
          showZero
          overflowCount={999}
          color={active ? 'rgba(255,255,255,0.28)' : '#F0F0F0'}
          style={{ color: active ? '#fff' : '#8C8C8C', marginInlineStart: 6, fontWeight: 600, boxShadow: 'none' }}
        />
      )}
    </Button>
  );
}

/** Quantity stepper for a cart line: one bordered group instead of two loose
 * circular buttons — reads as a single control, not two unrelated actions. */
function QtyStepper({ qty, onChange }: { qty: number; onChange: (qty: number) => void }) {
  return (
    <div className="inline-flex items-center border border-[#E8E8E8] shrink-0">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label="ลดจำนวน"
        className="w-7 h-7 grid place-items-center text-[#6E625C] hover:bg-[#F5F5F5] active:bg-[#EDEDED] transition">
        <RiSubtractLine className="w-3.5 h-3.5" />
      </button>
      <span className="w-7 text-center text-sm font-semibold text-tremor-content-strong border-x border-[#E8E8E8]">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        aria-label="เพิ่มจำนวน"
        className="w-7 h-7 grid place-items-center text-[#6E625C] hover:bg-[#F5F5F5] active:bg-[#EDEDED] transition">
        <RiAddLine className="w-3.5 h-3.5" />
      </button>
    </div>
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
        <div className="flex items-center justify-between rounded-none bg-emerald-50 px-3 py-2 text-sm">
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
      <div className="text-sm text-amber-700 bg-amber-50 rounded-none px-3 py-2">
        ยังไม่ได้ตั้งค่าพร้อมเพย์ของร้าน (ตั้งใน settings)
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-1 py-2 rounded-none bg-[#FAFAFA]">
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
            className="w-full flex items-center justify-between px-4 py-3 rounded-none border border-[#E8E8E8] hover:border-[#5B8C6E] disabled:opacity-40 transition">
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
  const { sale, lines, method, at, customerName, customerTaxId } = data;
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
      {/* Scoped boundary: a throw while rendering the receipt dismisses the
          receipt instead of white-screening the till (H5). */}
      <ReceiptBoundary onClose={onClose}>
        <Receipt
          shop={shop}
          saleNumber={sale.sale_number}
          at={at}
          taxInvoiceNo={sale.tax_invoice_no}
          customerName={customerName}
          customerTaxId={customerTaxId}
          items={lines.map((l) => ({ name: l.name, size: l.size, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.unitPrice * l.qty }))}
          subtotal={sale.subtotal}
          discount={sale.discount}
          vatAmount={sale.vat_amount}
          netAmount={sale.net_amount}
          total={sale.total}
          paymentMethod={method}
          cashPaid={method === 'cash' ? sale.total + sale.change : null}
          change={method === 'cash' ? sale.change : null}
          offline={data.offline}
        />
      </ReceiptBoundary>
    </Modal>
  );
}
