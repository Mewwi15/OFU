/**
 * สต๊อก — the shop's single stock list (owner trimmed it to just this view
 * 2026-07-16: removed the ต้นทุน / เติมของหลายรายการ / ประวัติ tabs).
 *
 * One readable table of every sellable variant: photo, barcode/SKU, price,
 * on-hand / reserved / sellable, status. Row actions: "เติมของ" is a direct
 * one-click button (the everyday task, additive — receive_stock). The ⋯ menu
 * holds "ปรับยอดสต๊อก" (always asks "นับได้จริงกี่ชิ้น", pre-filled with the
 * current count, with a plain-language live preview เพิ่มขึ้น/ลดลง N ชิ้น) and
 * "ตั้งเตือนใกล้หมด". Summary cards + search + status/category filters on top.
 * Export = Excel-compatible CSV (BOM). Import = CSV in two modes: นับสต๊อก
 * (absolute, set_stock_qty) / รับของเข้า (additive, receive_stock), matched by
 * variant_id → barcode → SKU → ชื่อเต็ม, with a preview first.
 *
 * Cost/profit editing lives in the product editor (Products.tsx). Admin-action
 * history is on the ประวัติแก้ไข page. LINE low-stock alerts fire from the DB
 * trigger (0055) — nothing to do here.
 */

import {
  RiAddLine,
  RiAlarmWarningLine,
  RiDownload2Line,
  RiImage2Line,
  RiMore2Line,
  RiPrinterLine,
  RiScales3Line,
  RiUpload2Line,
} from '@remixicon/react';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ACTION_COLOR } from '../lib/actionColors';
import {
  apiError,
  listProducts,
  listSalesPerDay,
  receiveStock,
  setStockQty,
  type Product,
} from '../lib/api';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RcTooltip } from 'recharts';

import { productThumb } from '../lib/image';
import { getShopName } from '../lib/orders';
import { printBuyList } from '../lib/printBuyList';

const { Text } = Typography;

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/** Window the sales rate is averaged over — long enough to smooth a slow week,
 *  short enough to follow a product going in or out of season. */
const SALES_WINDOW_DAYS = 30;

/** How long the shelf has to last after a restock run. */
const COVER_DAYS = 7;

/** One sellable item (variant) flattened with its product facts. */
type Item = {
  variantId: string;
  productId: string;
  productName: string;
  size: string | null;
  category: string;
  image: string | undefined;
  barcode: string | null;
  sku: string | null;
  unit: string | null;
  price: number;
  cost: number | null;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
  /** Units sold per day over the sales window (0 = nothing sold). */
  perDay: number;
};

function flatten(products: Product[], perDay: Record<string, number>): Item[] {
  return products.flatMap((p) => {
    const image = productThumb(
      p.product_images.find((i) => i.is_primary)?.storage_path ?? p.product_images[0]?.storage_path ?? null,
      88,
    );
    return p.product_variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      size: v.size,
      category: p.categories?.name ?? 'ไม่ระบุหมวด',
      image,
      barcode: v.barcode ?? null,
      sku: v.sku ?? null,
      unit: v.unit ?? null,
      price: v.price,
      cost: v.cost_price ?? null,
      stock: v.stock_qty,
      reserved: v.reserved_qty,
      available: v.available_qty,
      threshold: v.low_stock_threshold,
      perDay: perDay[v.id] ?? 0,
    }));
  });
}

const itemLabel = (i: { productName: string; size: string | null }) =>
  i.productName + (i.size ? ` (${i.size})` : '');

/* ── กฎเดียว: เหลือน้อยกว่า 3 ชิ้น = ต้องซื้อ ─────────────────────────────────
 * Started out ranking by days-of-cover (stock ÷ sales rate). The maths was
 * sound but the owner had to hold two ideas at once to read the screen, and the
 * counts it produced disagreed with the plain "shelf is empty" count sitting
 * next to them. Owner's call: one threshold in pieces, nothing to interpret.
 *
 * The sales rate stays on the page, but only to answer HOW MANY to buy — it no
 * longer decides WHETHER an item is on the list.
 */
const LOW_STOCK_PIECES = 3;

type Urgency = 'buy' | 'ok' | 'idle';

/** Straight off the admin theme (src/theme.ts) rather than raw tailwind reds
 *  and greys — the page sits inside a sage-green tool, and #dc2626/#15803d read
 *  as a foreign widget dropped into it. */
const URGENCY_COLOR: Record<Urgency, string> = {
  buy: '#E5484D',   // colorError
  ok: '#5B8C6E',    // colorPrimary (sage)
  idle: '#D6D0CB',  // warm neutral, same family as the borders
};

/** Softer fills for the chart so seven stacked rows don't vibrate; the solid
 *  colours above stay for text and the single-figure callouts. */
const URGENCY_FILL: Record<Urgency, string> = {
  buy: '#E5484D',
  ok: '#8FB3A0',
  idle: '#E9E4DF',
};

const URGENCY_LABEL: Record<Urgency, string> = {
  buy: 'ต้องซื้อ',
  ok: 'พอ',
  idle: 'ไม่ขยับ',
};

/** One boxed figure in the overview. Every tile has the same frame, label size
 *  and value size, so the block scans as a set instead of loose text; `hint`
 *  carries what the number means, which is the part that was missing. */
function StatTile({
  label, value, hint, accent, span2,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  span2?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${span2 ? 'col-span-2' : ''}`}
      style={{ background: '#FAFAF9', border: '1px solid #EDEAE7' }}
    >
      <div style={{ fontSize: 12, color: '#6B625C', lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: accent ?? '#2B2320' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: '#8C837D', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

const urgencyOf = (i: Item): Urgency => {
  if (i.stock < LOW_STOCK_PIECES) return 'buy';
  // Not low, but nothing has sold in a month — stock sitting still, which is a
  // "should we keep carrying this?" question rather than a buying one.
  if (i.perDay === 0) return 'idle';
  return 'ok';
};

/** Pieces to buy. The sales rate sizes the order where we know it; where we
 *  don't, ask for enough to clear the threshold rather than print a zero on a
 *  sheet that only lists things needing a buy. */
const suggestQty = (i: Item, coverDays: number): number => {
  const byRate = Math.ceil(i.perDay * coverDays - i.stock);
  return Math.max(LOW_STOCK_PIECES - i.stock, byRate, 1);
};

/* ── CSV helpers (Excel-friendly: BOM + CRLF; quotes escaped) ─────────────── */

const CSV_HEAD = [
  'ชื่อสินค้า', 'ขนาด', 'บาร์โค้ด', 'SKU', 'หมวดหมู่', 'หน่วย',
  'ราคาขาย', 'ต้นทุน', 'คงเหลือ', 'จอง', 'พร้อมขาย', 'เกณฑ์เตือน',
  'มูลค่าทุน', 'variant_id',
];

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(items: Item[]) {
  const rows = items.map((i) => [
    i.productName, i.size ?? '', i.barcode ?? '', i.sku ?? '', i.category, i.unit ?? '',
    i.price, i.cost ?? '', i.stock, i.reserved, i.available, i.threshold,
    i.cost != null ? i.cost * i.stock : '', i.variantId,
  ]);
  const csv = [CSV_HEAD, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stock-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Tiny CSV parser (quoted fields, CRLF/CR/LF). Good enough for our template. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

type ImportRow = {
  key: number;
  label: string;
  qty: number;
  item: Item | null;
};

/** Match an import row to an item: variant_id → barcode → SKU → exact name. */
function matchItem(items: Item[], cells: Record<string, string>): Item | null {
  const vid = cells['variant_id']?.trim();
  if (vid) {
    const hit = items.find((i) => i.variantId === vid);
    if (hit) return hit;
  }
  const bc = cells['บาร์โค้ด']?.trim();
  if (bc) {
    const hit = items.find((i) => i.barcode === bc);
    if (hit) return hit;
  }
  const sku = cells['SKU']?.trim();
  if (sku) {
    const hit = items.find((i) => i.sku === sku);
    if (hit) return hit;
  }
  const name = cells['ชื่อสินค้า']?.trim();
  const size = cells['ขนาด']?.trim() || null;
  if (name) {
    const hit = items.find(
      (i) => i.productName === name && (i.size ?? null) === (size || null),
    );
    if (hit) return hit;
  }
  return null;
}

/* ═════════════════════════════════════════════════════════════════════════ */

export function Stock() {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  /** Sales rate per variant. Missing/failed → every row reads as `idle`, which
   *  degrades to the plain catalogue rather than to a wall of false alarms. */
  const [perDay, setPerDay] = useState<Record<string, number>>({});

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [rows, rate] = await Promise.all([
        listProducts(force),
        listSalesPerDay(SALES_WINDOW_DAYS).catch(() => ({} as Record<string, number>)),
      ]);
      setProducts(rows);
      setPerDay(rate);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [message]);
  useEffect(() => {
    void reload();
  }, [reload]);

  /** Days of stock a run has to leave behind. Was a slider at the top of the
   *  page; the owner opened the page and had to work out what to type into it
   *  before it showed anything, which is the wrong trade for a screen you
   *  glance at. Fixed at a week — the value that covered nearly every gap in
   *  this shop's own restock history. */
  const coverDays = COVER_DAYS;

  const items = useMemo(() => flatten(products, perDay), [products, perDay]);

  /** Ring slices — same three states as the filter chips, so what the ring
   *  shows and what a click does are never two different things. */
  const donut = useMemo(
    () =>
      (['buy', 'idle', 'ok'] as Urgency[])
        .map((key) => ({ key, name: URGENCY_LABEL[key], value: items.filter((i) => urgencyOf(i) === key).length }))
        .filter((d) => d.value > 0),
    [items],
  );

  const buckets = useMemo(() => {
    const b: Record<Urgency, number> = { buy: 0, ok: 0, idle: 0 };
    for (const i of items) b[urgencyOf(i)]++;
    return b;
  }, [items]);

  /* ── filters ─────────────────────────────────────────────────────────── */
  const [query, setQuery] = useState('');
  // Opens on the buy list, not the catalogue: 58 rows to act on beats 832 rows
  // to scroll. "ทั้งหมด" is one click away for lookups.
  const [statusFilter, setStatusFilter] = useState<'all' | Urgency>('buy');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort(),
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (statusFilter !== 'all' && urgencyOf(i) !== statusFilter) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.productName.toLowerCase().includes(q) ||
        (i.barcode ?? '').includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q)
      );
    });
    // Emptiest shelf first, so the top of the table IS the shopping list, and
    // sorted by the same number the rule reads — no second concept to follow.
    // Only re-derives on reload/filter change, never live, so a just-restocked
    // row doesn't jump away mid-action; column click-sorters still override.
    return filtered.sort((a, b) => a.stock - b.stock || b.perDay - a.perDay);
  }, [items, query, statusFilter, categoryFilter]);

  const totals = useMemo(() => {
    const pieces = items.reduce((s, i) => s + i.stock, 0);
    const outCount = items.filter((i) => i.stock === 0).length;
    return { pieces, outCount };
  }, [items]);

  /** Every category, split by state. Stacked rather than "items to buy only":
   *  the buy count alone says what to fetch but not how each part of the shop
   *  is doing — ของใช้ในบ้าน having 121 to buy reads very differently once you
   *  see it also has 132 sitting untouched. Counts, not money: value questions
   *  belong on รายงาน, which owns them with a date range. */
  const byCategory = useMemo(() => {
    type Row = { category: string; buy: number; idle: number; ok: number; count: number };
    const acc = new Map<string, Row>();
    for (const i of items) {
      const row = acc.get(i.category) ?? { category: i.category, buy: 0, idle: 0, ok: 0, count: 0 };
      row[urgencyOf(i)] += 1;
      row.count += 1;
      acc.set(i.category, row);
    }
    return [...acc.values()].sort((a, b) => b.buy - a.buy || b.count - a.count);
  }, [items]);

  /* ── ใบสั่งซื้อของ ──────────────────────────────────────────────────────── */
  const [buyListOpen, setBuyListOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  /** Everything due this run, soonest to run out first — the sheet's contents.
   *  Independent of the table's filters: the printed list must be the whole
   *  buy, not whatever category happens to be selected on screen. */
  const buyRows = useMemo(
    () =>
      items
        .filter((i) => urgencyOf(i) === 'buy')
        .sort((a, b) => a.stock - b.stock || b.perDay - a.perDay),
    [items],
  );

  const buyTotals = useMemo(() => {
    const pieces = buyRows.reduce((s, i) => s + suggestQty(i, coverDays), 0);
    const priced = buyRows.filter((i) => i.cost != null);
    const estimate = priced.reduce((s, i) => s + (i.cost ?? 0) * suggestQty(i, coverDays), 0);
    return { pieces, estimate, pricedCount: priced.length };
  }, [buyRows, coverDays]);

  const doPrintBuyList = async () => {
    setPrinting(true);
    try {
      const shopName = await getShopName();
      printBuyList(
        buyRows.map((i) => ({
          name: i.productName,
          size: i.size,
          barcode: i.barcode,
          category: i.category,
          unit: i.unit,
          image: i.image,
          stock: i.stock,
          buy: suggestQty(i, coverDays),
          cost: i.cost,
        })),
        shopName,
        coverDays,
      );
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setPrinting(false);
    }
  };

  /* ── row-action modal (เติม / นับ / เกณฑ์เตือน) ─────────────────────────── */
  type Action = 'receive' | 'set' | 'threshold';
  const [action, setAction] = useState<{ type: Action; item: Item } | null>(null);
  const [actionQty, setActionQty] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const openAction = (type: Action, item: Item) => {
    setAction({ type, item });
    setActionQty(
      type === 'threshold' ? item.threshold
      : type === 'set' ? item.stock
      : null,
    );
    setActionNote('');
  };

  useEffect(() => {
    const variantId = searchParams.get('variant');
    if (!variantId || loading || action) return;
    const item = items.find((i) => i.variantId === variantId);
    if (!item) return;
    openAction(searchParams.get('action') === 'receive' ? 'receive' : 'set', item);
    setSearchParams({}, { replace: true });
  }, [action, items, loading, searchParams, setSearchParams]);

  const runAction = async () => {
    if (!action || actionQty == null) return;
    setActionBusy(true);
    try {
      const { type, item } = action;
      if (type === 'receive') {
        await receiveStock(item.variantId, actionQty, actionNote.trim() || undefined);
        message.success(`เติม ${itemLabel(item)} +${actionQty}`);
      } else if (type === 'set') {
        if (actionQty === item.stock) return;
        await setStockQty(item.variantId, actionQty, actionNote.trim() || undefined);
        const delta = actionQty - item.stock;
        message.success(`ปรับสต๊อก ${itemLabel(item)} ${delta > 0 ? '+' : ''}${delta} (เป็น ${actionQty})`);
      } else {
        const { upsertVariant } = await import('../lib/api');
        await upsertVariant({
          id: item.variantId,
          product_id: item.productId,
          size: item.size,
          price: item.price,
          low_stock_threshold: actionQty,
          sku: item.sku,
          barcode: item.barcode,
          cost_price: item.cost,
          unit: item.unit,
        });
        message.success(`ตั้งเกณฑ์เตือน ${itemLabel(item)} = ${actionQty}`);
      }
      setAction(null);
      void reload(true);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const ACTION_META: Record<Action, { title: string; hint: string; min: number }> = {
    receive: { title: 'เติมของ', hint: 'ซื้อมากี่ชิ้น ใส่จำนวนนั้น', min: 1 },
    set: { title: 'ปรับยอดสต๊อก', hint: 'นับบนชั้นได้กี่ชิ้น ใส่เลขนั้นเลย (เช่น ของเสีย ของหาย นับผิดครั้งก่อน)', min: 0 },
    threshold: { title: 'ตั้งเตือนใกล้หมด', hint: 'เหลือถึงจำนวนนี้เมื่อไหร่ LINE จะเด้งเตือน', min: 0 },
  };

  /* ── columns ────────────────────────────────────────────────────────── */
  const overviewColumns: ColumnsType<Item> = [
    {
      title: 'สินค้า',
      // No fixed width — the product name absorbs the slack so price/คงเหลือ/
      // actions cluster tight on the right instead of floating with big gaps.
      sorter: (a, b) => a.productName.localeCompare(b.productName, 'th'),
      render: (_, i) => (
        <div className="flex items-center gap-3">
          <Avatar
            shape="square"
            size={36}
            src={i.image ?? undefined}
            style={{ background: '#F5F5F5', color: '#BFBFBF', flex: 'none' }}
            icon={<RiImage2Line style={{ fontSize: 17 }} />}
          />
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 15, fontWeight: 500, color: '#2B2320' }}>
              {itemLabel(i)}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[i.barcode, i.sku].filter(Boolean).join(' · ') || 'ไม่มีบาร์โค้ด'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'หมวดหมู่',
      dataIndex: 'category',
      width: 150,
      responsive: ['lg'],
      render: (c: string) => <Text type="secondary" style={{ fontSize: 13 }}>{c}</Text>,
    },
    {
      title: 'ราคาขาย',
      width: 110,
      align: 'right',
      // Doesn't feed the buy decision — kept for lookups, dropped on narrower
      // screens so the four numbers that DO decide it aren't fighting for room.
      responsive: ['xl'],
      sorter: (a, b) => a.price - b.price,
      render: (_, i) => <Text style={{ fontSize: 14 }}>{baht(i.price)}</Text>,
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'stock',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.stock - b.stock,
      render: (s: number, i) => (
        // Plain now — urgency moved to เหลืออีก, which is the number that
        // actually decides whether to buy. No reserved/sellable sub-line: this
        // shop deducts stock on order, there is no reservation hold.
        <Text strong style={{ fontSize: 17 }}>
          {s}
          <Text type="secondary" style={{ fontSize: 12 }}> {i.unit ?? 'ชิ้น'}</Text>
        </Text>
      ),
    },
    {
      title: 'ควรซื้อ',
      width: 105,
      align: 'right',
      render: (_, i) => {
        const q = suggestQty(i, coverDays);
        if (q === 0) return <Text type="secondary" style={{ fontSize: 13 }}>—</Text>;
        // The one number the page exists to produce — sized to be read at a
        // glance while walking the wholesaler's aisles.
        return (
          <Tooltip title={`ให้พอขาย ${coverDays} วันที่อัตรา ${i.perDay.toFixed(1)}/วัน`}>
            <Text strong style={{ fontSize: 22, color: '#2B2320' }}>
              {q}
              <Text type="secondary" style={{ fontSize: 12 }}> {i.unit ?? 'ชิ้น'}</Text>
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'จัดการ',
      key: 'actions',
      fixed: 'right',
      width: 130,
      align: 'right',
      render: (_, i) => (
        // เติม + ⋯ as one tight right-aligned group. Outlined blue restock reads
        // crisper than the washed-out light fill; the ⋯ sits right beside it.
        <div className="inline-flex items-center gap-1">
          <Button color="blue" variant="outlined" icon={<RiAddLine className="w-4 h-4" />} onClick={() => openAction('receive', i)}>
            เติม
          </Button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'set',
                  icon: <RiScales3Line className="w-4 h-4" style={{ color: ACTION_COLOR.adjust }} />,
                  label: 'ปรับยอดสต๊อก (นับใหม่)',
                },
                { key: 'threshold', icon: <RiAlarmWarningLine className="w-4 h-4" style={{ color: ACTION_COLOR.edit }} />, label: 'ตั้งเตือนใกล้หมด (LINE)' },
              ],
              onClick: ({ key }) => openAction(key as Action, i),
            }}>
            <Button type="text" icon={<RiMore2Line className="w-4 h-4" />} aria-label="อื่นๆ" />
          </Dropdown>
        </div>
      ),
    },
  ];

  /* ── import ─────────────────────────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'set' | 'receive'>('set');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importBusy, setImportBusy] = useState(false);

  const onImportFile = (file: File) => {
    void file.text().then((text) => {
      const rows = parseCsv(text);
      if (rows.length < 2) {
        message.error('ไฟล์ว่างหรือไม่มีหัวตาราง — ใช้ปุ่ม "ส่งออก Excel" เป็นแม่แบบได้');
        return;
      }
      const head = rows[0].map((h) => h.trim());
      const qtyCol = head.findIndex((h) => h === 'คงเหลือ' || h === 'จำนวน');
      if (qtyCol < 0) {
        message.error('ไม่พบคอลัมน์ "คงเหลือ" หรือ "จำนวน" ในไฟล์');
        return;
      }
      const parsed: ImportRow[] = rows.slice(1).map((r, idx) => {
        const cells: Record<string, string> = {};
        head.forEach((h, c) => (cells[h] = r[c] ?? ''));
        const item = matchItem(items, cells);
        // ช่องว่างต้องเป็น "ข้ามแถวนี้" ไม่ใช่ศูนย์ — Number('') คืน 0 ซึ่งใน
        // โหมดนับสต๊อก (set) จะล้างสต็อกของแถวนั้นทิ้งทั้งยวง (M4)
        const rawQty = (cells[head[qtyCol]] ?? '').trim();
        const qty = rawQty === '' ? NaN : Number(rawQty);
        return {
          key: idx,
          label:
            item ? itemLabel(item)
            : (cells['ชื่อสินค้า'] || cells['บาร์โค้ด'] || cells['SKU'] || `แถวที่ ${idx + 2}`),
          qty: Number.isFinite(qty) ? qty : NaN,
          item,
        };
      });
      setImportRows(parsed);
    });
    return false; // stop antd upload
  };

  const importReady = importRows.filter(
    (r) => r.item && Number.isFinite(r.qty) && r.qty >= 0 && (importMode === 'set' || r.qty > 0),
  );

  const runImport = async () => {
    setImportBusy(true);
    let ok = 0;
    let failed = 0;
    // Each row is an independent RPC call (server-side atomic update per
    // variant, safe under concurrency) — batch them instead of one at a time,
    // a large CSV otherwise took one network round-trip per row in sequence.
    const BATCH = 10;
    for (let i = 0; i < importReady.length; i += BATCH) {
      const batch = importReady.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((r) =>
          importMode === 'set'
            ? setStockQty(r.item!.variantId, r.qty, 'นำเข้าไฟล์ (นับสต๊อก)')
            : receiveStock(r.item!.variantId, r.qty, 'นำเข้าไฟล์ (รับของ)'),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') ok++;
        else failed++;
      }
    }
    setImportBusy(false);
    setImportOpen(false);
    setImportRows([]);
    message[failed ? 'warning' : 'success'](
      `นำเข้าสำเร็จ ${ok} รายการ${failed ? ` · ล้มเหลว ${failed}` : ''}`,
    );
    void reload(true);
  };

  const importColumns: ColumnsType<ImportRow> = [
    {
      title: 'สินค้า',
      dataIndex: 'label',
      render: (v: string, r) =>
        r.item ? <Text>{v}</Text> : <Text type="danger">{v} — จับคู่ไม่ได้</Text>,
    },
    {
      title: importMode === 'set' ? 'ตั้งคงเหลือเป็น' : 'รับเข้าเพิ่ม',
      dataIndex: 'qty',
      width: 130,
      align: 'right',
      render: (q: number) =>
        Number.isFinite(q) ? (
          <Text strong>{importMode === 'receive' ? `+${q}` : q}</Text>
        ) : (
          <Text type="danger">ไม่ใช่ตัวเลข</Text>
        ),
    },
    {
      title: 'คงเหลือเดิม',
      width: 110,
      align: 'right',
      render: (_, r) => (r.item ? r.item.stock : '—'),
    },
  ];

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Text type="secondary">เติมของ ปรับยอด และดูมูลค่าสต็อกทั้งหมด</Text>
        </div>
        <Space>
          <Upload accept=".csv" showUploadList={false} beforeUpload={(f) => {
            setImportOpen(true);
            return onImportFile(f);
          }}>
            <Button icon={<RiUpload2Line className="w-4 h-4" />}>นำเข้าไฟล์</Button>
          </Upload>
          <Button icon={<RiDownload2Line className="w-4 h-4" />} onClick={() => exportCsv(items)}>
            ส่งออก Excel
          </Button>
        </Space>
      </div>

      {/* Overview first — the page is called สต๊อก, so it opens by answering
          "how much do we have", and only then "what needs buying". Value, not
          piece counts: 3,569 pieces of household goods and 25 of fresh food are
          the same row until you price them. */}
      <Card size="small" styles={{ body: { padding: '16px 18px' } }}>
        <Row gutter={[24, 16]}>
          {/* Labels at full strength, not the muted grey they were — the owner
              could not read the summary at a glance. The buy count leads: it is
              the only figure here that asks for a decision today. */}
          <Col xs={24} lg={8}>
            {/* The whole box is the button — the number is what the owner
                reaches for, so make the target the number, not a link beside it. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => buckets.buy > 0 && setBuyListOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && buckets.buy > 0 && setBuyListOpen(true)}
              className="mb-3 rounded-lg px-4 py-3 transition-shadow hover:shadow-md"
              style={{
                background: '#FDF3F3',
                border: `1px solid ${URGENCY_COLOR.buy}33`,
                cursor: buckets.buy > 0 ? 'pointer' : 'default',
              }}
            >
              <div className="flex items-center justify-between">
                <Text style={{ fontSize: 13, color: '#8C4B4D' }}>ต้องซื้อรอบนี้</Text>
                {buckets.buy > 0 && (
                  <Text style={{ fontSize: 12, color: URGENCY_COLOR.buy }}>ดูใบสั่งซื้อ →</Text>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <Text strong style={{ fontSize: 34, lineHeight: 1.1, color: URGENCY_COLOR.buy }}>
                  {buckets.buy}
                </Text>
                <Text style={{ fontSize: 15, color: '#8C4B4D' }}>รายการ</Text>
              </div>
            </div>

            {/* Bordered tiles, not bare numbers floating on white — three
                values with no edges between them read as one blur, and the
                rows never lined up because only one had a sub-line. Each tile
                also says what its number MEANS: ฿176,668 next to ฿222,862 is
                inert until you show that the gap is the margin. */}
            {/* Counts only. Money moved out entirely (owner: "เรื่องเงินไม่ต้อง
                อยู่ในสต๊อกปะครับ") — รายงาน already carries stock value, cost of
                goods sold and margin with a date range, and repeating a slice of
                it here answered a question nobody opened this page to ask. */}
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="ของในร้าน"
                value={`${totals.pieces.toLocaleString('th-TH')} ชิ้น`}
                hint={`${items.length} รายการ`}
                span2
              />
              {/* One number, no breakdown: the owner's call — an empty shelf
                  gets restocked either way, so splitting it by whether the item
                  has sold recently just added arithmetic to read past. */}
              <StatTile
                label="หมดแล้ว"
                value={`${totals.outCount} รายการ`}
                hint="ไม่เหลือบนชั้นเลย"
                accent={totals.outCount > 0 ? URGENCY_COLOR.buy : undefined}
              />
              {/* Same source as the ไม่ขยับ filter below, so the tile and the
                  chip can never disagree. Now that empty shelves count as a
                  buy, what is left here is the dead stock proper: goods sitting
                  on the shelf that nobody has bought in a month. */}
              <StatTile
                label={`ไม่ขยับ ${SALES_WINDOW_DAYS} วัน`}
                value={`${buckets.idle} รายการ`}
                hint="มีของค้างแต่ไม่มียอดขาย"
              />
            </div>
          </Col>

          <Col xs={24} lg={16}>
            <div className="mb-1 flex items-baseline justify-between">
              <Text style={{ fontSize: 13, color: '#6B625C' }}>
                สภาพสต๊อกทั้งร้าน — คลิกเพื่อกรอง
              </Text>
              {(categoryFilter || statusFilter !== 'all') && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => { setCategoryFilter(null); setStatusFilter('all'); }}
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </div>

            {/* Donut, replacing the stacked bars: seven rows of three colours
                asked the reader to compare lengths across rows before anything
                meant anything. One ring answers "how is the shop doing" at a
                glance, and the list beside it keeps the per-category detail at
                one line each instead of one bar each. */}
            <Row gutter={16} align="middle">
              <Col xs={24} sm={10}>
                <div style={{ position: 'relative' }}>
                  <ResponsiveContainer width="100%" height={176}>
                    <PieChart>
                      <RcTooltip
                        formatter={(v: number, n: string) => [`${v} รายการ`, n]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Pie
                        data={donut}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                        cursor="pointer"
                        onClick={(d) =>
                          setStatusFilter(statusFilter === d.key ? 'all' : (d.key as Urgency))
                        }
                      >
                        {donut.map((d) => (
                          <Cell
                            key={d.key}
                            fill={URGENCY_FILL[d.key]}
                            opacity={statusFilter === 'all' || statusFilter === d.key ? 1 : 0.3}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Total sits in the hole: the ring shows the split, the
                      middle answers "out of how many". */}
                  <div
                    style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                    }}
                  >
                    <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: '#2B2320' }}>
                      {items.length}
                    </div>
                    <div style={{ fontSize: 11, color: '#8C837D' }}>รายการ</div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {donut.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === d.key ? 'all' : d.key)}
                      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                      className="inline-flex items-center gap-1.5"
                    >
                      <i style={{ width: 9, height: 9, borderRadius: 999, background: URGENCY_FILL[d.key] }} />
                      <span style={{ fontSize: 12, color: '#6E625C' }}>
                        {d.name} <b style={{ color: '#2B2320' }}>{d.value}</b>
                      </span>
                    </button>
                  ))}
                </div>
              </Col>

              <Col xs={24} sm={14}>
                <div style={{ maxHeight: 206, overflowY: 'auto' }}>
                  {byCategory.map((c) => {
                    const active = categoryFilter === c.category;
                    return (
                      <button
                        key={c.category}
                        type="button"
                        onClick={() => setCategoryFilter(active ? null : c.category)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
                        style={{
                          background: active ? '#F2F5F3' : 'transparent',
                          border: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <span className="flex-1 truncate" style={{ fontSize: 13, color: '#2B2320' }}>
                          {c.category}
                        </span>
                        <span style={{ fontSize: 12, color: '#A8A099' }}>{c.count}</span>
                        <span
                          style={{
                            minWidth: 52, textAlign: 'right', fontSize: 13, fontWeight: 700,
                            color: c.buy > 0 ? URGENCY_COLOR.buy : '#C9C3BE',
                          }}
                        >
                          {c.buy > 0 ? `ซื้อ ${c.buy}` : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
              <Input.Search
                allowClear
                placeholder="ค้นหาชื่อ / บาร์โค้ด / SKU"
                style={{ width: 320 }}
                onSearch={setQuery}
                onChange={(e) => !e.target.value && setQuery('')}
              />
              <Segmented
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { label: `${URGENCY_LABEL.buy} (${buckets.buy})`, value: 'buy' },
                  { label: `ทั้งหมด (${items.length})`, value: 'all' },
                  { label: `${URGENCY_LABEL.idle} (${buckets.idle})`, value: 'idle' },
                ]}
              />
              <Select
                allowClear
                placeholder="หมวดหมู่"
                style={{ width: 160 }}
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v ?? null)}
                options={categories.map((c) => ({ value: c, label: c }))}
              />
            </Space>
            {/* Trust line — after the auto-triage-sort, tell the owner nothing
                actionable is hidden below the fold. */}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {buckets.buy > 0
                ? `แสดง ${shown.length} รายการ · เรียงของที่เหลือน้อยที่สุดขึ้นบนสุด — ${buckets.buy} รายการที่เหลือต่ำกว่า ${LOW_STOCK_PIECES} ชิ้น คือของที่ต้องซื้อรอบนี้`
                : `แสดง ${shown.length} รายการ · ทุกรายการมีของเหลือตั้งแต่ ${LOW_STOCK_PIECES} ชิ้นขึ้นไป`}
            </Text>
            <Table
              rowKey="variantId"
              size="small"
              sticky
              columns={overviewColumns}
              dataSource={shown}
              loading={loading}
              pagination={{ pageSize: 50, showSizeChanger: false }}
              scroll={{ x: 720 }}
              locale={{
                emptyText:
                  query || statusFilter !== 'all' || categoryFilter
                    ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง'
                    : 'ยังไม่มีสินค้าในระบบ',
              }}
              // No row tint. Sorting already puts the urgent rows on top, so
              // tinting them painted the whole first screen pink and the colour
              // stopped meaning anything — the เหลืออีก figure carries it.
              rowClassName={() => ''}
            />
          </Space>
        </Card>

      {/* ใบสั่งซื้อของ — on screen for checking, printable for the trip.
          The browser print dialog's "Save as PDF" covers the PDF ask, so there
          is no extra library and no server round-trip to make one. */}
      <Modal
        open={buyListOpen}
        onCancel={() => setBuyListOpen(false)}
        title={`ใบสั่งซื้อของ — ${buyRows.length} รายการ`}
        width={860}
        footer={[
          <Button key="close" onClick={() => setBuyListOpen(false)}>ปิด</Button>,
          <Button
            key="print"
            type="primary"
            loading={printing}
            icon={<RiPrinterLine className="w-4 h-4" />}
            onClick={doPrintBuyList}
          >
            พิมพ์ / บันทึก PDF
          </Button>,
        ]}
      >
        <Row gutter={16} className="mb-3">
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>ต้องซื้อ</Text>
            <div><Text strong style={{ fontSize: 20 }}>{buyRows.length} รายการ</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>รวมจำนวน</Text>
            <div><Text strong style={{ fontSize: 20 }}>{buyTotals.pieces.toLocaleString('th-TH')} ชิ้น</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ประมาณการเงิน
              {buyTotals.pricedCount < buyRows.length && ` (รู้ทุน ${buyTotals.pricedCount}/${buyRows.length})`}
            </Text>
            <div><Text strong style={{ fontSize: 20 }}>{baht(Math.round(buyTotals.estimate))}</Text></div>
          </Col>
        </Row>

        <Table
          rowKey="variantId"
          size="small"
          dataSource={buyRows}
          pagination={false}
          scroll={{ y: 380 }}
          columns={[
            {
              title: 'สินค้า',
              render: (_, i: Item) => (
                <div className="flex items-center gap-2">
                  <Avatar
                    shape="square"
                    size={32}
                    src={i.image ?? undefined}
                    style={{ background: '#F5F5F5', color: '#BFBFBF', flex: 'none' }}
                    icon={<RiImage2Line style={{ fontSize: 15 }} />}
                  />
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{itemLabel(i)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {i.barcode ?? 'ไม่มีบาร์โค้ด'} · {i.category}
                    </Text>
                  </div>
                </div>
              ),
            },
            {
              title: 'เหลือ', width: 78, align: 'right',
              render: (_, i: Item) => <Text style={{ fontSize: 14 }}>{i.stock}</Text>,
            },
            {
              title: 'ต้องซื้อ', width: 96, align: 'right',
              render: (_, i: Item) => (
                <Text strong style={{ fontSize: 19 }}>
                  {suggestQty(i, coverDays)}
                  <Text type="secondary" style={{ fontSize: 11 }}> {i.unit ?? 'ชิ้น'}</Text>
                </Text>
              ),
            },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          คำนวณให้พอขายอีก {coverDays} วัน จากยอดขายเฉลี่ย {SALES_WINDOW_DAYS} วันล่าสุด
        </Text>
      </Modal>

      {/* row action modal */}
      <Modal
        open={!!action}
        title={action ? `${ACTION_META[action.type].title} — ${itemLabel(action.item)}` : ''}
        onCancel={() => setAction(null)}
        onOk={() => void runAction()}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={actionBusy}
        destroyOnHidden>
        {action ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">
              คงเหลือปัจจุบัน {action.item.stock}
              {action.item.unit ? ` ${action.item.unit}` : ''} · {ACTION_META[action.type].hint}
            </Text>
            <InputNumber
              autoFocus
              style={{ width: 200 }}
              min={ACTION_META[action.type].min}
              max={100000}
              value={actionQty}
              onChange={setActionQty}
            />
            {/* "ปรับยอดสต๊อก" always asks for the real count, never a +/- delta —
                show what that means as a plain-language preview instead of
                making the user do the subtraction themselves. */}
            {action.type === 'set' && actionQty != null && actionQty !== action.item.stock && (
              <Text style={{ color: actionQty > action.item.stock ? '#1E9E5C' : '#C9252B' }}>
                {actionQty > action.item.stock
                  ? `เพิ่มขึ้น ${actionQty - action.item.stock} ชิ้น`
                  : `ลดลง ${action.item.stock - actionQty} ชิ้น`}
              </Text>
            )}
            {action.type !== 'threshold' ? (
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="หมายเหตุ (ใส่หรือไม่ก็ได้)"
                maxLength={120}
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>

      {/* import modal */}
      <Modal
        open={importOpen}
        width={720}
        title="นำเข้าสต๊อกจากไฟล์"
        onCancel={() => {
          setImportOpen(false);
          setImportRows([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => { setImportOpen(false); setImportRows([]); }}>
            ยกเลิก
          </Button>,
          <Button
            key="ok"
            type="primary"
            disabled={!importReady.length}
            loading={importBusy}
            onClick={() => void runImport()}>
            นำเข้า {importReady.length} รายการ
          </Button>,
        ]}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Radio.Group
            value={importMode}
            onChange={(e) => setImportMode(e.target.value)}
            options={[
              { value: 'set', label: 'นับสต๊อก — ตั้งค่าคงเหลือตามไฟล์' },
              { value: 'receive', label: 'รับของเข้า — บวกเพิ่มตามไฟล์' },
            ]}
          />
          <Text type="secondary">
            ใช้ไฟล์จากปุ่ม "ส่งออก Excel" เป็นแม่แบบ แก้คอลัมน์ "คงเหลือ" (หรือเพิ่มคอลัมน์
            "จำนวน") แล้วบันทึกเป็น .csv — ระบบจับคู่สินค้าจากบาร์โค้ด / SKU / ชื่อ
          </Text>
          {importRows.length ? (
            <Table
              rowKey="key"
              columns={importColumns}
              dataSource={importRows}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              size="small"
            />
          ) : (
            <Empty description="ยังไม่ได้เลือกไฟล์ — กดปุ่ม นำเข้าไฟล์ อีกครั้งเพื่อเลือก .csv" />
          )}
        </Space>
      </Modal>
    </div>
  );
}
