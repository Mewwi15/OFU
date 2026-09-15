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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import {
  apiError,
  createPosSale,
  findCustomerByPhone,
  getOpenShift,
  getShopInfo,
  listPosCatalog,
  type Customer,
  type PosProduct,
  type PosVariant,
  type SaleResult,
  type ShopInfo,
} from '../lib/api';
import {
  cacheCatalog,
  cacheShop,
  dismissFailedSale,
  enqueueSale,
  type FailedSale,
  flushQueue,
  isNetworkError,
  queueCount,
  readCachedCatalog,
  readCachedShop,
  readFailedQueue,
  retryFailedSale,
} from '../lib/offline';
import {
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Space,
  type InputRef,
} from 'antd';

import { OpenShiftPanel } from '../components/OpenShiftPanel';
import { DRAFT_KEYS, clearDraft, readDraft, writeDraft } from '../lib/draft';
import { Receipt } from '../components/Receipt';
import { ReceiptBoundary } from '../components/ReceiptBoundary';
import { agentStatus, printViaAgent } from '../lib/printAgent';
import { promptpayPayload } from '../lib/promptpay';
import { useReceiptConfig } from '../lib/receiptConfig';

type Line = {
  variantId: string;
  name: string;
  size: string | null;
  unitPrice: number;
  qty: number;
  /** ส่วนลดของรายการนี้ (บาท ทั้งบรรทัด) — หลังบ้านรองรับมาแต่แรก (line_discount) */
  lineDiscount: number;
  image: string | undefined;
};
type PayMethod = 'cash' | 'promptpay';
/** บิลที่คีย์ค้างไว้ — เก็บเฉพาะสิ่งที่คีย์เอง ไม่เก็บของที่โหลดใหม่ได้ (สินค้า/ราคา/สต๊อก) */
type PosDraft = {
  lines: Line[];
  discount: number;
  member: Customer | null;
  taxInvoice: boolean;
  custName: string;
  custTaxId: string;
};
type ReceiptData = {
  sale: SaleResult;
  lines: Line[];
  method: PayMethod;
  at: string;
  offline?: boolean;
  customerName?: string;
  customerTaxId?: string;
};

/* ★ เว้นวรรคบาง ๆ หลัง ฿ เสมอ ★ ฿ กับตัวเลขถูกวาดด้วยฟอนต์คนละตัว (ฟอนต์ไทยไม่มีเลข
   อารบิกครบทุกน้ำหนัก เบราว์เซอร์จึงหยิบฟอนต์สำรองมาแทนเฉพาะตัวเลข) ระยะห่างระหว่าง
   สองฟอนต์เลยคำนวณผิดจนตัวอักษรเบียดกัน — เห็นชัดสุดตอนตัวใหญ่ แต่ตัวเล็กก็เบียด
   ใช้ช่องไฟแคบ (U+2009) แทนเว้นวรรคเต็ม ๆ เพื่อไม่ให้ดูหลวมเกินไป */
const baht = (n: number) => `฿\u2009${n.toLocaleString('th-TH')}`;

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

  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState<PosProduct | null>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountEditing, setDiscountEditing] = useState<string | null>(null);
  /* แถวที่เพิ่งยิงเข้ามา — ไฮไลต์สั้น ๆ ให้ตาจับได้ว่าเมื่อกี้เข้าอันไหน (เจ้าของสั่ง
     15 ก.ย. 2026 ให้รายการล่าสุดขึ้นก่อน เพราะยิงรัวหลายชิ้นแล้วดูไม่ทันว่าเข้าหรือยัง) */
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const removeLine = (variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
    setDiscountEditing(null);
  };
  const setLineDiscount = (variantId: string, amount: number) =>
    setLines((prev) =>
      prev.map((l) =>
        l.variantId === variantId ? { ...l, lineDiscount: Math.min(amount, l.unitPrice * l.qty) } : l,
      ),
    );
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
  // ── ด่านเปิดรอบ (เจ้าของสั่ง 23 ส.ค.): ไม่มีรอบเปิดอยู่ = ห้ามขาย ──────────
  // null = กำลังเช็ค · true = มีรอบ · false = ต้องเปิดก่อน
  // เช็คไม่ได้ (ออฟไลน์) = ปล่อยขาย — offline-first สำคัญกว่าวินัยรอบ
  const [shiftOpen, setShiftOpen] = useState<boolean | null>(null);
  const recheckShift = useCallback(() => {
    getOpenShift()
      .then((sh) => setShiftOpen(!!sh))
      .catch(() => setShiftOpen(true));
  }, []);
  useEffect(() => {
    recheckShift();
    const onVis = () => { if (document.visibilityState === 'visible') recheckShift(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [recheckShift]);
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

  /* ── ค้นหาสินค้า: ขึ้นเฉพาะตอนพิมพ์ ไม่ใช่ตารางสินค้าที่กางค้างไว้ ──
     ★ เจ้าของสั่งเอาหน้าสินค้าออก 15 ก.ย. 2026 ("ไม่ได้ใช้งานเลย") ★ ของจริงคือยิง
     บาร์โค้ด ตารางสินค้าที่กางอยู่ตลอดเลยกินพื้นที่ครึ่งจอไปเปล่า ๆ แต่ยังต้องหาด้วยมือได้
     สำหรับของที่ไม่มีบาร์โค้ด/บาร์โค้ดขาด — จึงเหลือไว้เป็นผลค้นหาที่โผล่เมื่อพิมพ์เท่านั้น
     ค้นทั้งชื่อ รหัส และบาร์โค้ด (พิมพ์รหัสบางส่วนก็เจอ ไม่ต้องตรงเป๊ะเหมือนตอนยิง) */
  const SEARCH_LIMIT = 8;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.variants.some(
            (v) => v.sku?.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q),
          ),
      )
      .slice(0, SEARCH_LIMIT);
  }, [catalog, query]);

  /* ── cart ops ──────────────────────────────────────────────────────────── */
  function addVariant(p: PosProduct, v: PosVariant) {
    setLines((cur) => {
      const i = cur.findIndex((l) => l.variantId === v.id);
      /* ★ ยิงซ้ำ = ย้ายมาท้ายแถว ไม่ใช่บวกอยู่กับที่ ★ หน้าจอเรียงกลับด้าน (ท้ายสุด =
         บนสุด) ของที่เพิ่งยิงจึงเด้งขึ้นไปอยู่บนเสมอ แม้เป็นชิ้นที่ยิงไปแล้วเมื่อสิบรายการก่อน
         — ถ้าบวกอยู่กับที่ แคชเชียร์จะไม่เห็นว่ามันเข้า แล้วยิงซ้ำอีกจนจำนวนเกิน
         ลำดับในอาเรย์ยังเป็นลำดับเวลาอยู่ ใบเสร็จจึงพิมพ์เรียงตามที่ยิงจริงเหมือนเดิม */
      const line =
        i >= 0
          ? { ...cur[i], qty: cur[i].qty + 1 }
          : {
              variantId: v.id,
              name: p.name,
              size: v.size,
              unitPrice: v.price,
              qty: 1,
              lineDiscount: 0,
              image: p.image,
            };
      return [...cur.filter((l) => l.variantId !== v.id), line];
    });
    setFlashId(v.id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1200);
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

  /* ── สมาชิกที่ผูกกับบิลนี้ ──────────────────────────────────────────────
     เจ้าของสั่ง 5 ก.ย. 2026 ให้แต้มเดินจากการซื้อหน้าร้านด้วย — ทริกเกอร์ใน 0100 ให้แต้ม
     เมื่อบิลมี customer_user_id เท่านั้น ก่อนหน้านี้ POS ไม่เคยส่งค่านี้เลย แต้มจากหน้าร้าน
     จึงไม่เคยเดิน */
  const [member, setMember] = useState<Customer | null>(null);
  /* กันไม่ให้การเรนเดอร์รอบแรก (ที่ยังว่าง) เขียนทับร่างที่เก็บไว้ */
  const draftReady = useRef(false);
  const [memberBusy, setMemberBusy] = useState(false);

  /** ค้นสมาชิกจากเบอร์ (พิมพ์เองหรือสแกนคิวอาร์ก็ได้ ฝั่งฐานข้อมูลตัดรูปแบบให้แล้ว) */
  const attachMember = useCallback(async (phone: string): Promise<boolean> => {
    const p = phone.trim();
    if (!p) return false;
    setMemberBusy(true);
    try {
      const found = await findCustomerByPhone(p);
      if (found) {
        setMember(found);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setMemberBusy(false);
    }
  }, []);

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
    /* ★ ไม่ใช่สินค้า → ลองเป็นคิวอาร์สมาชิกก่อนค่อยบอกว่าไม่พบ ★ คิวอาร์บนหน้า OFU
       MEMBER เข้ารหัสเป็นเบอร์โทร ถ้าไม่ดักตรงนี้ แคชเชียร์สแกนบัตรสมาชิกแล้วจะได้เสียง
       error ทุกครั้ง — ดูจากรูปแบบก่อน (มีแต่ตัวเลข/เครื่องหมาย ยาว 9-13 หลัก) ไม่งั้น
       บาร์โค้ดสินค้าที่หาไม่เจอจะถูกเอาไปค้นลูกค้าทุกครั้งโดยเปล่าประโยชน์ */
    const digits = raw.replace(/\D/g, '');
    if (/^\+?[\d\s-]+$/.test(raw.trim()) && digits.length >= 9 && digits.length <= 13) {
      void attachMember(raw).then((ok) => {
        if (ok) flashScan('ผูกบัตรสมาชิกแล้ว', 'ok');
        else if (fromScanner) flashScan(`ไม่พบสมาชิกเบอร์ ${raw.trim()}`, 'error');
      });
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
    // In the search box a match is a scan; a miss falls through to the search hits.
    if (scan(query, false)) {
      setQuery('');
      return;
    }
    /* พิมพ์ชื่อแล้วกด Enter = เอาตัวแรกที่เจอ — ของที่ไม่มีบาร์โค้ดต้องขายได้เร็วพอ ๆ กับ
       ของที่ยิงได้ ไม่ใช่ต้องละมือจากแป้นไปคลิก */
    if (matches.length) {
      pick(matches[0]);
      setQuery('');
    }
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
  const lineDiscountTotal = useMemo(
    () => lines.reduce((s, l) => s + Math.min(l.lineDiscount, l.unitPrice * l.qty), 0),
    [lines],
  );
  // Removing a line after setting a discount can leave a stale discount above
  // the new (smaller) subtotal — clamp it down so the total shown is always
  // what actually gets charged, not a display that then fails at checkout.
  useEffect(() => {
    setDiscount((d) => Math.min(d, subtotal));
  }, [subtotal]);
  const total = Math.max(0, subtotal - lineDiscountTotal - discount);
  const vat =
    shop?.vat_registered && total > 0 ? Math.round((total * shop.vat_rate) / (100 + shop.vat_rate)) : 0;
  const net = total - vat;
  const change = method === 'cash' && typeof tendered === 'number' ? tendered - total : 0;

  /* ── ร่างบิลที่ยังไม่ได้รับเงิน ──
     ★ บิลที่คีย์ไปครึ่งหนึ่งแล้วหายคือความเสียหายจริงหน้าเคาน์เตอร์ ★ ยิงของไปยี่สิบชิ้น
     แล้วเผลอรีเฟรช/สลับไปหน้าสต็อกดูของ/แท็บถูกปิด = ต้องยิงใหม่ทั้งบิลต่อหน้าลูกค้า
     ที่ยืนรออยู่ · เก็บทุกครั้งที่บิลเปลี่ยน แล้วเอากลับมาเองตอนเปิดหน้าใหม่
     ★ เอากลับมาเลย ไม่ต้องถาม ★ ต่างจากใบรับเข้าที่ถามก่อน เพราะใบรับเข้าบวกสต๊อกจริง
     ผิดแล้วต้องไปตามลบ ส่วนบิลขายยังไม่ได้บันทึกอะไรทั้งนั้น ของยังอยู่ในตะกร้าเฉย ๆ
     กดล้างเองได้ตลอด และการเด้งถามทุกครั้งที่เปิดหน้าขายคือด่านที่ขวางงานจริง */
  useEffect(() => {
    const d = readDraft<PosDraft>(DRAFT_KEYS.posSale);
    if (!d?.lines?.length) return;
    setLines(d.lines);
    setDiscount(d.discount ?? 0);
    setMember(d.member ?? null);
    setTaxInvoice(!!d.taxInvoice);
    setCustName(d.custName ?? '');
    setCustTaxId(d.custTaxId ?? '');
    draftReady.current = true;
  }, []);

  /* เขียนร่างหลังโหลดของเก่าเสร็จแล้วเท่านั้น — ไม่งั้นสถานะว่าง ๆ ตอนเพิ่งเปิดหน้าจะไป
     ทับร่างที่ค้างอยู่ทิ้งก่อนที่เอฟเฟกต์ด้านบนจะได้ทำงาน */
  useEffect(() => {
    if (!draftReady.current) {
      draftReady.current = true;
      return;
    }
    if (!lines.length) {
      clearDraft(DRAFT_KEYS.posSale);
      return;
    }
    writeDraft<PosDraft>(DRAFT_KEYS.posSale, {
      lines,
      discount,
      member,
      taxInvoice,
      custName,
      custTaxId,
    });
  }, [lines, discount, member, taxInvoice, custName, custTaxId]);

  function resetSale() {
    clearDraft(DRAFT_KEYS.posSale);
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
    // รอบอาจถูกปิดจากแท็บ/เครื่องอื่นระหว่างเปิดหน้าค้างไว้ — เช็คซ้ำก่อนเงินเข้า
    // (เช็คไม่ได้เพราะเน็ต = ปล่อยผ่าน ให้คิวออฟไลน์ทำงานตามปกติ)
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const sh = await getOpenShift().catch(() => undefined);
      if (sh === null) {
        setShiftOpen(false);
        setError('รอบขายถูกปิดแล้ว — เปิดรอบใหม่ก่อนขาย');
        return;
      }
    }
    // A ฿0 total (e.g. a full-discount giveaway) needs no cash tendered at
    // all — only enforce "enough cash" once there's actually something to pay.
    if (method === 'cash' && total > 0 && (typeof tendered !== 'number' || tendered < total)) {
      setError('เงินที่รับมาไม่พอ');
      return;
    }
    const baseInput = {
      items: lines.map((l) => ({
        variant_id: l.variantId,
        qty: l.qty,
        ...(l.lineDiscount > 0 ? { line_discount: Math.min(l.lineDiscount, l.unitPrice * l.qty) } : {}),
      })),
      payment_method: method,
      cash_tendered: method === 'cash' ? (typeof tendered === 'number' ? tendered : total) : undefined,
      discount,
      tax_invoice: taxInvoice,
      customer_name: taxInvoice ? custName || undefined : undefined,
      customer_tax_id: taxInvoice ? custTaxId || undefined : undefined,
      /* ผูกบิลกับบัญชีลูกค้า — ทริกเกอร์ให้แต้มอ่านค่านี้ (0100) */
      customer_user_id: member?.user_id,
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
      /* ★ ล้างสมาชิกทุกครั้งที่ปิดบิล ★ ไม่งั้นลูกค้าคนถัดไปจะได้แต้มเข้าบัญชีคนก่อน
         ซึ่งเป็นความผิดพลาดที่ไม่มีใครสังเกตจนกว่าจะมีคนทัก */
      setMember(null);
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

  /* ── ด่านเปิดรอบ: ไม่มีรอบ = ขายไม่ได้ (เจ้าของสั่ง: "ต้องเปิดรอบก่อนเท่านั้น") ── */
  if (shiftOpen === false) {
    return (
      <div className="grid place-items-center min-h-[70vh]">
        <OpenShiftPanel onOpened={() => setShiftOpen(true)} />
      </div>
    );
  }

  return (
    <div className="-m-4 lg:-m-7 p-4 lg:p-6 bg-white min-h-[calc(100vh-4rem)]">
      <div className="lg:grid lg:grid-cols-[1fr_26rem] lg:h-[calc(100vh-6.5rem)]">
        {/* ── ซ้าย: ช่องยิงบาร์โค้ด + รายการที่ยิงแล้ว ───────────────────────
            เดิมครึ่งนี้เป็นตารางสินค้าให้กดเลือก เจ้าของสั่งเอาออกทั้งหมด 15 ก.ย. 2026
            ("หน้าสินค้าที่โชว์อยู่มันไม่ได้ใช้งานเลย") — พื้นที่ทั้งหมดยกให้สิ่งที่ใช้จริง
            คือช่องยิงกับรายการที่ยิงเข้ามา */}
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

          {/* ── ช่องยิงบาร์โค้ด ──
              ★ ใหญ่จนไม่ต้องหา ★ เจ้าของสั่ง "มีบาร์สแกนบาร์โค้ดใหญ่ๆ" — เป็นทางเข้าเดียว
              ของหน้านี้แล้ว (ตารางสินค้าถูกเอาออก) จึงต้องเห็นชัดว่าเคอร์เซอร์อยู่ตรงนี้
              และยิงได้ทันทีโดยไม่ต้องคลิกก่อน */}
          <div className="relative shrink-0">
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
              placeholder="ยิงบาร์โค้ดที่นี่ หรือพิมพ์ชื่อสินค้า"
              prefix={<RiQrScanLine className="w-7 h-7 text-tremor-brand mr-2" />}
              suffix={
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
                  {/* จุดกะพริบ = เครื่องยิงยิงเข้าช่องนี้ได้เลย ไม่ต้องคลิกก่อน */}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  พร้อมยิง
                </span>
              }
              style={{ borderRadius: 0, height: 72, borderWidth: 2 }}
              styles={{ input: { fontSize: 20, fontWeight: 500 } }}
            />

            {/* ผลค้นหา — ลอยทับรายการ ไม่ดันของข้างล่างให้ขยับตอนพิมพ์ */}
            {query.trim().length >= 2 && (
              <div className="absolute inset-x-0 top-[74px] z-30 bg-white border-2 border-[#D9D9D9] shadow-lg max-h-[52vh] overflow-y-auto">
                {matches.length === 0 ? (
                  <div className="px-4 py-6 text-center text-tremor-content">
                    ไม่พบสินค้าชื่อหรือรหัสนี้
                  </div>
                ) : (
                  matches.map((p) => {
                    const stock = p.variants.reduce((s, v) => s + v.stock_qty, 0);
                    const price = p.variants[0]?.price ?? 0;
                    const oos = stock <= 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={oos}
                        onClick={() => {
                          pick(p);
                          setQuery('');
                          searchRef.current?.focus();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-[#F0F0F0] last:border-0 text-left hover:bg-[#FFF8F3] disabled:opacity-45 disabled:hover:bg-white transition">
                        <RiSearchLine className="w-4 h-4 text-tremor-content-subtle shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[16px] font-semibold text-tremor-content-strong truncate">
                            {p.name}
                          </span>
                          <span className="block text-[13px] text-tremor-content">
                            {p.variants.length > 1 ? `${p.variants.length} ขนาด · ` : ''}
                            คงเหลือ {stock}
                          </span>
                        </span>
                        <span className="text-[17px] font-bold tabular-nums text-tremor-content-strong shrink-0">
                          {p.variants.length > 1 ? `${baht(price)}+` : baht(price)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── หัวรายการ ── */}
          <div className="flex items-center justify-between mt-5 mb-2 pb-2 shrink-0 border-b-2 border-[#D9D9D9]">
            <div className="flex items-baseline gap-2">
              <span className="text-[16px] font-semibold text-tremor-content-strong">รายการในบิล</span>
              {lines.length > 0 && (
                <span className="text-[14px] text-tremor-content tabular-nums">
                  {lines.reduce((s, l) => s + l.qty, 0)} ชิ้น
                </span>
              )}
            </div>
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
          </div>

          {/* ── รายการที่ยิงแล้ว — ล่าสุดอยู่บนสุด ──
              ★ เรียงกลับด้านตอนแสดง ★ เจ้าของสั่ง "ให้รายการที่ยิงล่าสุดขึ้นก่อน" เพราะยิง
              รัว ๆ หลายสิบชิ้นแล้วของใหม่ไปต่อท้ายใต้จอ ต้องเลื่อนลงไปดูทุกครั้งว่าเข้าไหม
              เก็บในอาเรย์ตามลำดับเวลาเหมือนเดิม (ใบเสร็จพิมพ์ตามที่ยิงจริง) พลิกแค่ตอนแสดง */}
          <div className="flex-1 overflow-y-auto pb-28 lg:pb-2 border border-[#F0F0F0] border-t-0">
            {lines.length === 0 ? (
              <div className="h-full grid place-items-center py-16">
                <Empty
                  image={<RiQrScanLine className="w-14 h-14 text-[#D9D9D9] mx-auto" />}
                  styles={{ image: { height: 56 } }}
                  description={
                    <span className="text-tremor-content-subtle text-[15px]">
                      ยิงบาร์โค้ดสินค้าเพื่อเริ่มบิล
                    </span>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {[...lines].reverse().map((l) => {
                  const fresh = flashId === l.variantId;
                  return (
                    <div
                      key={l.variantId}
                      className={`px-4 py-3.5 transition-colors duration-300 ${
                        fresh ? 'bg-emerald-50' : 'hover:bg-[#FAFAFA]'
                      }`}>
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 overflow-hidden bg-[#F5F5F5] border border-[#E8E8E8] grid place-items-center shrink-0">
                          {l.image ? (
                            <img src={l.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <RiShoppingBasket2Line className="w-6 h-6 text-tremor-brand-subtle" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="flex-1 text-[17px] font-semibold text-tremor-content-strong leading-snug">
                              {l.name}
                              {l.size ? ` (${l.size})` : ''}
                            </span>
                            {fresh && (
                              <span className="shrink-0 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5">
                                ล่าสุด
                              </span>
                            )}
                          </div>
                          <div className="text-[14px] text-tremor-content mt-0.5 tabular-nums">
                            {baht(l.unitPrice)} / หน่วย
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <BigBaht
                            value={Math.max(0, l.unitPrice * l.qty - l.lineDiscount)}
                            className="block text-[21px] font-bold text-tremor-content-strong leading-tight"
                          />
                          {l.lineDiscount > 0 ? (
                            <span className="block text-[13px] font-semibold text-red-600 tabular-nums">
                              ลด −{baht(l.lineDiscount)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pl-[68px]">
                        <QtyStepper big qty={l.qty} onChange={(qty) => setQty(l.variantId, qty)} />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDiscountEditing((cur) => (cur === l.variantId ? null : l.variantId))
                            }
                            className={`h-10 px-4 text-[14px] font-semibold border transition ${
                              l.lineDiscount > 0 || discountEditing === l.variantId
                                ? 'border-red-300 bg-red-50 text-red-600'
                                : 'border-[#E8E8E8] text-[#6E625C] hover:bg-[#FFF3EC] hover:text-tremor-brand-emphasis'
                            }`}>
                            ลด
                          </button>
                          <button
                            type="button"
                            title="ลบรายการนี้"
                            onClick={() => removeLine(l.variantId)}
                            className="h-10 w-11 grid place-items-center border border-[#E8E8E8] text-[#6E625C] hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition">
                            <RiDeleteBin6Line className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </div>

                      {discountEditing === l.variantId ? (
                        <div className="flex items-center justify-end gap-2 mt-2.5 pl-[68px]">
                          <span className="text-[14px] text-tremor-content">ส่วนลดรายการนี้</span>
                          <InputNumber
                            min={0}
                            max={l.unitPrice * l.qty}
                            precision={0}
                            controls={false}
                            inputMode="numeric"
                            autoFocus
                            formatter={moneyFormatter}
                            parser={moneyParser}
                            onKeyDown={digitsOnlyKeyDown}
                            placeholder="฿ 0"
                            value={l.lineDiscount || null}
                            onChange={(v) => setLineDiscount(l.variantId, Math.max(0, Number(v) || 0))}
                            onPressEnter={() => setDiscountEditing(null)}
                            style={{ width: 120 }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
          className={`flex flex-col min-h-0 bg-white shadow-sm rounded-none lg:rounded-none lg:shadow-none lg:border-l-2 lg:border-[#D9D9D9] lg:pl-5 fixed inset-y-0 right-0 z-40 w-full max-w-md transition-transform duration-300 lg:static lg:z-auto lg:w-auto lg:max-w-none ${
            cartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}>
          {/* หัวแผงชำระเงิน — ปุ่มปิดมีไว้สำหรับจอเล็กที่แผงนี้เป็นลิ้นชัก */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-tremor-border shrink-0">
            <span className="text-[16px] font-semibold text-tremor-content-strong">ชำระเงิน</span>
            <Button
              type="text"
              shape="circle"
              className="lg:hidden"
              icon={<RiCloseLine className="w-5 h-5" />}
              onClick={() => setCartOpen(false)}
            />
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-none bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          {/* ยอด + วิธีจ่าย — เลื่อนได้ ส่วนปุ่มชำระเงินตรึงไว้ข้างล่างเสมอ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* ── ยอดที่ต้องเก็บ ──
                ★ กรอบนี้มียอดอย่างเดียว ★ เจ้าของสั่ง 15 ก.ย. 2026 "ตรงยอดที่ต้องเก็บเอา
                แค่ยอดครับ ส่วนลดเอาลงมาตรงล่างรับเงินมา ตรงกรอบยอดที่ต้องเก็บเอาเลข
                ใหญ่ๆเลย" — ที่มาของยอด (ยอดรวม/ส่วนลด/VAT) ย้ายลงไปอยู่ใต้ช่องรับเงิน
                ตรงนี้เหลือตัวเลขเดียวที่ต้องบอกลูกค้าและอ่านไม่ผิด
                ใช้สีเข้มไม่ใช่สีแบรนด์ เพราะปุ่มชำระเงินเป็นสีแบรนด์อยู่แล้ว สองอันสีเดียวกัน
                จะแย่งสายตากันเอง */}
            <div className="bg-[#2B2320] px-4 py-3.5">
              <span className="block text-[14px] font-semibold text-white/70">ยอดที่ต้องเก็บ</span>
              <BigBaht
                value={total}
                className="block text-right text-[60px] font-bold text-white leading-none mt-0.5"
              />
            </div>

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

            {/* ── ส่วนลด + ที่มาของยอด ──
                ย้ายลงมาจากกรอบยอดตามที่เจ้าของสั่ง — ที่นี่คือที่ของมันจริง ๆ ด้วย เพราะ
                ส่วนลดคือสิ่งที่ "คีย์" เหมือนช่องรับเงิน ไม่ใช่ตัวเลขที่ "อ่าน" เหมือนยอดที่
                ต้องเก็บ · บรรทัดที่มาขึ้นเฉพาะตอนมีอะไรให้ดู ไม่มีส่วนลดก็ไม่ต้องรก */}
            <div className="border-2 border-[#E8E8E8] bg-[#FAFAFA] px-3.5 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[14.5px] font-semibold text-tremor-content-strong">
                  ส่วนลดทั้งบิล
                </span>
                <InputNumber
                  min={0}
                  max={subtotal}
                  precision={0}
                  size="large"
                  controls={false}
                  inputMode="numeric"
                  formatter={moneyFormatter}
                  parser={moneyParser}
                  onKeyDown={digitsOnlyKeyDown}
                  placeholder="฿ 0"
                  value={discount || null}
                  onChange={(v) => setDiscount(Math.min(subtotal, Math.max(0, Number(v) || 0)))}
                  style={{ width: 150, borderRadius: 0 }}
                  styles={{
                    input: {
                      textAlign: 'right',
                      fontSize: 18,
                      fontWeight: 600,
                      ...(discount > 0 ? { color: '#E5484D' } : {}),
                    },
                  }}
                />
              </div>
              {lineDiscountTotal > 0 || discount > 0 || shop?.vat_registered ? (
                <div className="pt-2 border-t border-[#E8E8E8] space-y-1">
                  <Row label="ยอดรวมก่อนลด" value={baht(subtotal)} subtle />
                  {lineDiscountTotal > 0 ? (
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="text-red-600">ส่วนลดรายสินค้า</span>
                      <span className="font-semibold text-red-600 tabular-nums">
                        −{baht(lineDiscountTotal)}
                      </span>
                    </div>
                  ) : null}
                  {shop?.vat_registered ? (
                    <>
                      <Row label="ราคาก่อน VAT" value={baht(net)} subtle />
                      <Row label={`VAT ${shop.vat_rate}%`} value={baht(vat)} subtle />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* ── บัตรสมาชิก ──
                สแกนคิวอาร์จากหน้า OFU MEMBER ได้เลย (ตัวจับสแกนทั่วทั้งหน้าดักให้แล้ว)
                หรือพิมพ์เบอร์เอง — ไม่ผูกก็ขายได้ตามปกติ แค่ลูกค้าไม่ได้แต้ม */}
            {member ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{member.display_name ?? 'สมาชิก'}</div>
                  <div className="text-xs text-gray-500">
                    {member.phone} · {(member.points ?? 0).toLocaleString('th-TH')} แต้ม
                  </div>
                </div>
                <Button size="small" onClick={() => setMember(null)}>
                  เอาออก
                </Button>
              </div>
            ) : (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="เบอร์สมาชิก หรือสแกนคิวอาร์"
                  inputMode="tel"
                  allowClear
                  onPressEnter={async (e) => {
                    const v = (e.target as HTMLInputElement).value;
                    const ok = await attachMember(v);
                    if (ok) (e.target as HTMLInputElement).value = '';
                    else flashScan('ไม่พบสมาชิกเบอร์นี้', 'error');
                  }}
                />
                <Button loading={memberBusy}>ค้นหา</Button>
              </Space.Compact>
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
          </div>

          {/* ★ ปุ่มจบบิลต้องอยู่ที่เดิมเสมอ ★ ตรึงไว้นอกส่วนที่เลื่อน — ไม่งั้นจอสั้น ๆ
              (โน้ตบุ๊กที่เคาน์เตอร์) ต้องเลื่อนลงไปหาปุ่มทุกบิล */}
          <div className="border-t border-tremor-border p-4 shrink-0">
            <Button
              type="primary"
              block
              size="large"
              loading={busy}
              icon={busy ? undefined : <RiCheckLine className="w-5 h-5" />}
              onClick={checkout}
              disabled={!lines.length}
              style={{
                height: 60,
                fontWeight: 700,
                fontSize: 22,
                borderRadius: 0,
              }}>
              {busy ? 'กำลังบันทึก…' : (
                <span className="inline-flex items-baseline gap-2">
                  ชำระเงิน
                  <span className="tabular-nums font-extrabold">{baht(total)}</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* จอเล็ก: แถบเปิดแผงชำระเงิน (รายการอยู่บนหน้าหลักแล้ว ไม่ต้องเปิดดู) */}
      {lines.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-3 inset-x-3 z-30 rounded-none bg-tremor-brand text-white shadow-lg flex items-center justify-between px-5 py-3.5 hover:bg-tremor-brand-emphasis">
          <span className="flex items-center gap-2 font-medium">
            <span className="grid place-items-center min-w-[1.5rem] h-6 px-1.5 rounded-none bg-white/25 text-xs font-bold">
              {lines.reduce((s, l) => s + l.qty, 0)}
            </span>
            ชำระเงิน
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

/**
 * ตัวเลขเงินก้อนใหญ่ — แยกสัญลักษณ์ ฿ ออกจากตัวเลขคนละกล่อง
 *
 * ★ ฿ ติดกับเลขจนอ่านผิดได้ ★ เจอตอนเรนเดอร์หน้าจบบิลจริง 15 ก.ย. 2026: "฿260" ขนาด
 * 68px สัญลักษณ์ ฿ เหลื่อมทับเลข 2 จนดูเป็นตัวอื่น — เกิดจาก ฿ กับตัวเลขถูกวาดด้วยฟอนต์
 * คนละตัว (ฟอนต์ไทยไม่มีเลขอารบิกครบทุกน้ำหนัก เบราว์เซอร์เลยไปหยิบฟอนต์สำรองมาแทน)
 * ระยะห่างระหว่างสองฟอนต์จึงคำนวณผิด
 * แยกเป็นคนละ span พร้อมเว้นวรรคของเราเอง = ไม่มีทางทับกันไม่ว่าจะได้ฟอนต์ไหนมา
 * และ ฿ ตัวเล็กลงหน่อยก็อ่านง่ายกว่าเดิมด้วย เพราะตัวเลขคือสิ่งที่ต้องอ่าน
 */
function BigBaht({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className}>
      <span className="text-[0.6em] font-semibold mr-[0.14em]">฿</span>
      <span className="tabular-nums">{value.toLocaleString('th-TH')}</span>
    </span>
  );
}


function Row({ label, value, subtle }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-[14.5px] ${subtle ? 'text-tremor-content-subtle' : 'text-tremor-content'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${subtle ? '' : 'font-semibold text-tremor-content-strong'}`}>{value}</span>
    </div>
  );
}

/** Quantity stepper for a cart line: one bordered group instead of two loose
 * circular buttons — reads as a single control, not two unrelated actions. */
function QtyStepper({
  qty,
  onChange,
  big,
}: {
  qty: number;
  onChange: (qty: number) => void;
  /** ขนาดใหญ่สำหรับรายการในบิล — กดด้วยนิ้วบนจอสัมผัสที่เคาน์เตอร์ได้ ไม่ต้องเล็งเมาส์ */
  big?: boolean;
}) {
  const box = big ? 'w-10 h-10' : 'w-7 h-7';
  const icon = big ? 'w-[18px] h-[18px]' : 'w-3.5 h-3.5';
  return (
    <div className="inline-flex items-center border border-[#E8E8E8] shrink-0">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label="ลดจำนวน"
        className={`${box} grid place-items-center text-[#6E625C] hover:bg-[#F5F5F5] active:bg-[#EDEDED] transition`}>
        <RiSubtractLine className={icon} />
      </button>
      <span
        className={`text-center font-semibold text-tremor-content-strong border-x border-[#E8E8E8] tabular-nums ${
          big ? 'w-12 text-[17px] leading-10' : 'w-7 text-sm'
        }`}>
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        aria-label="เพิ่มจำนวน"
        className={`${box} grid place-items-center text-[#6E625C] hover:bg-[#F5F5F5] active:bg-[#EDEDED] transition`}>
        <RiAddLine className={icon} />
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
  /* ★ ไม่มีปุ่มจำนวนสำเร็จรูป ★ เจ้าของสั่งเอาออก 15 ก.ย. 2026 ("ไม่ต้องมีรับพอดี 100 200
     หรอกครับ") — ลูกค้ายื่นเงินมาเท่าไหร่ก็พิมพ์เท่านั้น ปุ่มเดาจำนวนไม่ได้ช่วยอะไร
     มีแต่จะกดพลาดแล้วได้ยอดรับเงินที่ไม่ตรงกับเงินในลิ้นชักจริง */
  const short = typeof tendered === 'number' && tendered > 0 && tendered < total;
  return (
    <div className="space-y-2">
      <div className="text-[14.5px] font-semibold text-tremor-content-strong">รับเงินมา</div>
      {/* ★ ช่องใหญ่ ★ เป็นช่องเดียวที่แคชเชียร์ต้องพิมพ์ตอนรับเงิน — ตัวเลขต้องอ่านออก
          จากระยะยืน และชิดขวาเพื่อให้หลักตรงกับยอดที่ต้องเก็บด้านบน */}
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
        style={{ width: '100%', height: 64, borderRadius: 0, borderWidth: 2 }}
        styles={{
          input: {
            height: 60,
            fontSize: 30,
            fontWeight: 700,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          },
        }}
      />
      {/* เงินไม่พอ — บอกตรงนี้เลยว่าขาดเท่าไหร่ ดีกว่าให้ไปเจอตอนกดชำระเงินแล้วเด้ง error */}
      {short && (
        <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-200 px-3.5 py-2.5">
          <span className="text-[15px] font-semibold text-amber-800">ยังขาด</span>
          <BigBaht value={total - tendered} className="text-[22px] font-bold text-amber-700 leading-none" />
        </div>
      )}
      {/* สีเดียวกับหน้าต่างเงินทอนตอนจบบิล — ตัวเลขเดียวกันต้องหน้าตาเดียวกันทั้งสองที่
          ไม่งั้นแคชเชียร์ต้องเรียนรู้สองแบบสำหรับเรื่องเดียว */}
      {typeof tendered === 'number' && tendered >= total && (
        <div className="flex items-center justify-between bg-red-50 border-2 border-red-200 px-3.5 py-3">
          <span className="text-[15px] font-semibold text-red-800">เงินทอน</span>
          <BigBaht value={change} className="text-[30px] font-bold text-red-600 leading-none" />
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
  const [cfg] = useReceiptConfig();

  /* ── พิมพ์เองทันทีที่จบบิล ──
     เจ้าของสั่ง 15 ก.ย. 2026: "กดชำระแล้วปริ้นให้อัตโนมัติเลย ไม่ต้องเลือกเครื่องปริ้น
     ตอนนี้มันหลาย step"
     ★ ต้องรอให้วาดเสร็จก่อนสั่งพิมพ์ ★ โลโก้กับฟอนต์บิลโหลดไม่ทันเฟรมแรก ยิงพิมพ์เลย
     จะได้กระดาษที่หัวบิลหาย · รอ fonts.ready แล้วข้ามไปอีกเฟรมหนึ่งให้ภาพขึ้นจอจริง
     ★ ยิงครั้งเดียวต่อบิล ★ กัน effect ทำงานซ้ำ (React 18 โหมด strict เรียกสองรอบ)
     ไม่งั้นบิลเดียวออกกระดาษสองใบ */
  const printed = useRef(false);

  /**
   * พิมพ์บิลใบนี้ — ลองทางที่ดีที่สุดก่อน แล้วค่อยถอย
   *
   * 1) ตัวกลางในเครื่อง (tools/pos-print-agent) — เงียบสนิท ระบุเครื่องพิมพ์ตรง ๆ
   *    ไม่ยุ่งกับเครื่องพิมพ์หลัก ใบ A4 จึงปลอดภัย · พิสูจน์กับ POS58 ที่ร้านแล้ว
   * 2) พิมพ์ผ่านเบราว์เซอร์แบบเดิม — เครื่องที่ยังไม่ได้ลงตัวกลางต้องพิมพ์ได้เหมือนเดิม
   *
   * ★ รอให้วาดเสร็จก่อนเสมอ ★ ทั้งสองทางอ่านจากสิ่งที่อยู่บนจอ โลโก้กับฟอนต์โหลดไม่ทัน
   * เฟรมแรก ยิงเลยจะได้กระดาษที่หัวบิลหาย
   */
  const doPrint = useCallback(async () => {
    try {
      await document.fonts?.ready;
    } catch {
      /* เบราว์เซอร์ไม่รองรับก็พิมพ์ไปเลย */
    }
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)));

    const el = document.getElementById('pos-receipt');
    if (el && (await agentStatus(cfg.agentPort)).ok) {
      if (await printViaAgent(el, cfg.agentPort)) return;
      /* ตัวกลางรับงานไม่สำเร็จ (กระดาษหมด/เครื่องพิมพ์หลุด) — ยังมีทางเบราว์เซอร์ให้ถอย
         ดีกว่าเงียบไปเฉย ๆ แล้วลูกค้าไม่ได้บิล */
    }
    window.print();
  }, [cfg.agentPort]);

  /* ── พิมพ์เองทันทีที่จบบิล ──
     เจ้าของสั่ง 15 ก.ย. 2026: "กดชำระแล้วปริ้นให้อัตโนมัติเลย ไม่ต้องเลือกเครื่องปริ้น
     ตอนนี้มันหลาย step"
     ★ ยิงครั้งเดียวต่อบิล ★ กัน effect ทำงานซ้ำ (React 18 โหมด strict เรียกสองรอบ)
     ไม่งั้นบิลเดียวออกกระดาษสองใบ */
  useEffect(() => {
    if (!cfg.autoPrint || printed.current) return;
    printed.current = true;
    void doPrint();
  }, [cfg.autoPrint, doPrint]);

  return (
    <Modal
      open
      onCancel={onClose}
      /* ★ กว้างพอให้เงินทอนอ่านจากระยะยืน ★ เจ้าของสั่ง 15 ก.ย. 2026 "หน้า modal ต้องใหญ่
         กว่านี้ครับ" — ของเดิมกว้าง 340 เท่าใบเสร็จพอดี ทุกอย่างเลยถูกบีบตามความกว้าง
         กระดาษ ทั้งที่ใบเสร็จเป็นแค่ตัวอย่างไว้ดู ไม่ใช่ตัวเอกของหน้าต่างนี้
         แยกเป็นสองฝั่ง: ซ้าย = สิ่งที่ต้องทำต่อ (ทอนเท่าไหร่) · ขวา = กระดาษที่จะพิมพ์ */
      width={760}
      destroyOnHidden
      footer={[
        <Button
          key="print"
          size="large"
          icon={<RiPrinterLine className="w-[18px] h-[18px]" />}
          onClick={() => void doPrint()}>
          พิมพ์บิล
        </Button>,
        /* ปุ่มหลักคือ "ขายต่อ" ไม่ใช่พิมพ์ — เจ้าของเลิกพิมพ์อัตโนมัติไปตั้งแต่ ส.ค. 2026
           บิลส่วนใหญ่ลูกค้าไม่เอา การจบบิลแล้วรับคนถัดไปคือทางที่เดินบ่อยกว่ามาก */
        <Button key="next" type="primary" size="large" onClick={onClose}>
          ขายต่อ
        </Button>,
      ]}>
      <div className="receipt-stage grid gap-5 md:grid-cols-[1fr_340px]">
        {/* ── ฝั่งซ้าย: เงินทอน ──
            เจ้าของสั่ง 15 ก.ย. 2026: "พอกดชำระจะมีหน้าต่างเงินทอนครับ"
            ★ เงินทอนต้องอ่านได้จากระยะยืน ★ เดิมตัวเลขนี้ซ่อนอยู่ในใบเสร็จตัวจิ๋ว แคชเชียร์
            ต้องเพ่งหาในบรรทัดเล็ก ๆ ทั้งที่มันคือสิ่งเดียวที่ต้องทำต่อทันทีหลังกดจบบิล
            ★ no-print ★ ทั้งฝั่งนี้เป็นของบนจอเท่านั้น ห้ามติดไปบนกระดาษ
            สีแดงตามที่เจ้าของสั่ง ("เงินทอนเอาสีแดง") — เป็นเงินที่ต้องหยิบออกจากลิ้นชัก
            คืนลูกค้า ไม่ใช่ยอดที่ได้มา สีจึงเตือนให้ทำอะไรต่อ */}
        <div className="no-print">
          {method === 'cash' ? (
            <div className="border-2 border-red-200 bg-red-50 px-5 py-5">
              <span className="block text-[17px] font-semibold text-red-800">
                {sale.change > 0 ? 'เงินทอน' : 'รับพอดี ไม่ต้องทอน'}
              </span>
              <BigBaht
                value={sale.change}
                className="block mt-1 text-[68px] font-bold text-red-600 leading-none"
              />
              <div className="mt-4 pt-3 border-t-2 border-red-200 space-y-1.5 text-[15px] text-red-900/75 tabular-nums">
                <div className="flex items-center justify-between">
                  <span>รับมา</span>
                  <span className="font-semibold">{baht(sale.total + sale.change)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>ยอดบิล</span>
                  <span className="font-semibold">{baht(sale.total)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-[#E8E8E8] bg-[#FAFAFA] px-5 py-5">
              <span className="block text-[17px] font-semibold text-tremor-content-strong">
                รับเงินพร้อมเพย์แล้ว
              </span>
              <BigBaht
                value={sale.total}
                className="block mt-1 text-[52px] font-bold text-tremor-content-strong leading-none"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[13px] text-tremor-content">
            <span>เลขที่บิล {sale.sale_number}</span>
            <span>{at}</span>
          </div>
          {data.offline ? (
            <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-[13px] px-3 py-2">
              ออฟไลน์ — บิลนี้จะถูกส่งเข้าระบบเองเมื่อกลับมาออนไลน์
            </div>
          ) : null}
          <div className="mt-3 text-[12px] text-[#8a807a]">
            ในหน้าพิมพ์: ระยะขอบ = ไม่มี · ปรับขนาด = กำหนดเอง 100%
          </div>
        </div>

        {/* ── ฝั่งขวา: กระดาษที่จะพิมพ์ ──
            ★ ให้ดูเป็นใบเสร็จจริง ไม่ใช่ข้อความลอย ★ เจ้าของสั่ง 15 ก.ย. 2026 "ปรับตรงบิล
            นิดนึงครับให้เป็นช่องดีๆหน่อย" — วางกระดาษขาวมีเงาบนพื้นเทา แล้วเซาะขอบล่าง
            เป็นฟันปลาเหมือนกระดาษที่ฉีกออกจากเครื่อง คนดูจะรู้ทันทีว่านี่คือของที่จะออกมา
            จากเครื่องพิมพ์ ไม่ใช่กล่องข้อความอีกกล่องในหน้าเว็บ */}
        <div className="receipt-side flex flex-col min-w-0">
          <div className="no-print text-[13px] font-semibold text-tremor-content mb-2">
            ตัวอย่างใบเสร็จ
          </div>
          <div className="receipt-tray bg-[#EFEDEA] p-5 flex justify-center items-start max-h-[58vh] overflow-y-auto">
            {/* Scoped boundary: a throw while rendering the receipt dismisses the
                receipt instead of white-screening the till (H5). */}
            <div className="receipt-paper bg-white px-3 pt-3 shadow-[0_3px_12px_rgba(0,0,0,0.13)]">
              <ReceiptBoundary onClose={onClose}>
                <Receipt
                  shop={shop}
                  saleNumber={sale.sale_number}
                  at={at}
                  taxInvoiceNo={sale.tax_invoice_no}
                  customerName={customerName}
                  customerTaxId={customerTaxId}
                  items={lines.map((l) => ({ name: l.name, size: l.size, qty: l.qty, unitPrice: l.unitPrice, lineTotal: Math.max(0, l.unitPrice * l.qty - l.lineDiscount) }))}
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
              {/* ขอบฟันปลา — ฟันสีขาวพาดบนพื้นเทา ทำให้ปลายกระดาษดูเหมือนถูกฉีกออกมา
                  วางเป็นชิ้นแยกใต้ใบเสร็จ ไม่ใช่ mask ทับตัวใบเสร็จ เพราะถ้าพลาดขึ้นมา
                  จะกลายเป็นบิลหายไปทั้งใบ · no-print อยู่แล้ว ไม่มีทางติดไปบนกระดาษ */}
              <div className="receipt-tear no-print" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
