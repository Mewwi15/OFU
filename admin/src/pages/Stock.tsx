/**
 * สต๊อก — full stock workspace (owner request 2026-07-13 "มีให้หมดทุกฟังก์ชั่น").
 *
 *  • ภาพรวม   : every variant in one readable table — photo, barcode/SKU,
 *    price/cost, on-hand / reserved / sellable, threshold, stock value, status.
 *    Row actions: "เติมของ" is a direct one-click button (the everyday task);
 *    the ⋯ menu holds the rest — "ปรับยอดสต๊อก" opens one modal with a
 *    นับของจริง (absolute set) / แก้ +− (signed delta) mode switch instead of
 *    two separate menu entries, plus เกณฑ์เตือน and ประวัติ (jumps to the
 *    filtered ledger). Summary cards + search + filters.
 *    Export = Excel-compatible CSV (BOM). Import = CSV in two modes:
 *    นับสต๊อก (absolute, set_stock_qty) / รับของเข้า (additive, receive_stock),
 *    matched by variant_id → barcode → SKU → ชื่อเต็ม, with a preview first.
 *  • รับของเข้า: scan/search → receiving list → one save ('receive' ledger).
 *  • ประวัติ   : stock_movements ledger, filter by type or a single product.
 *
 * LINE low-stock alerts fire from the DB trigger (0055) — nothing to do here.
 */

import {
  RiAddLine,
  RiCoinsLine,
  RiAlarmWarningLine,
  RiDeleteBinLine,
  RiDownload2Line,
  RiHistoryLine,
  RiInboxArchiveLine,
  RiMore2Line,
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
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  adjustStock,
  apiError,
  listProducts,
  listStockMovements,
  receiveStock,
  setStockQty,
  type Product,
  type StockMovement,
} from '../lib/api';
import { productThumb } from '../lib/image';

const { Title, Text } = Typography;

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/** Ledger reason → Thai label + tag colour. */
const REASONS: Record<string, { label: string; color: string }> = {
  receive: { label: 'รับของเข้า', color: 'green' },
  admin_adjust: { label: 'ปรับ/นับสต๊อก', color: 'blue' },
  pos_sale: { label: 'ขายหน้าร้าน', color: 'volcano' },
  pos_refund: { label: 'คืนสินค้า POS', color: 'purple' },
  reserve_placed: { label: 'จอง (ออเดอร์ใหม่)', color: 'gold' },
  commit_confirmed: { label: 'ตัดสต๊อก (ยืนยันออเดอร์)', color: 'volcano' },
  commit_understocked: { label: 'ตัดสต๊อก (ของขาด)', color: 'red' },
  release_cancel: { label: 'คืนจอง (ยกเลิก)', color: 'default' },
  release_payment_rejected: { label: 'คืนจอง (สลิปไม่ผ่าน)', color: 'default' },
  release_expiry: { label: 'คืนจอง (หมดเวลา)', color: 'default' },
  restock_cancel: { label: 'คืนสต๊อก (ยกเลิก)', color: 'cyan' },
  restock_delivery_failed: { label: 'คืนสต๊อก (ส่งไม่สำเร็จ)', color: 'cyan' },
};
const reasonMeta = (r: string) => REASONS[r] ?? { label: r, color: 'default' };

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
};

function flatten(products: Product[]): Item[] {
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
      category: p.categories?.name ?? '—',
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
    }));
  });
}

const itemLabel = (i: { productName: string; size: string | null }) =>
  i.productName + (i.size ? ` (${i.size})` : '');

const statusOf = (i: Item): 'out' | 'low' | 'ok' =>
  i.stock === 0 ? 'out' : i.stock <= i.threshold ? 'low' : 'ok';

/** Big-and-obvious status colours (matches the row tint in index.css). */
const STATUS_COLOR: Record<'ok' | 'low' | 'out', string> = {
  ok: '#15803d',
  low: '#c2410c',
  out: '#dc2626',
};
const STATUS_TAG = { fontSize: 14, lineHeight: '26px', paddingInline: 12 } as const;

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setProducts(await listProducts(force));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [message]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const items = useMemo(() => flatten(products), [products]);
  const lowCount = useMemo(() => items.filter((i) => statusOf(i) !== 'ok').length, [items]);

  /* ── ภาพรวม: filters ─────────────────────────────────────────────────── */
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort(),
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter === 'low' && statusOf(i) === 'ok') return false;
      if (statusFilter === 'out' && statusOf(i) !== 'out') return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.productName.toLowerCase().includes(q) ||
        (i.barcode ?? '').includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter, categoryFilter]);

  const totals = useMemo(() => {
    const costValue = items.reduce((s, i) => s + (i.cost ?? 0) * i.stock, 0);
    const saleValue = items.reduce((s, i) => s + i.price * i.stock, 0);
    const pieces = items.reduce((s, i) => s + i.stock, 0);
    return { costValue, saleValue, pieces };
  }, [items]);

  /* ── row-action modal (เติม / ปรับ / นับ / เกณฑ์เตือน) ─────────────────── */
  type Action = 'receive' | 'adjust' | 'set' | 'threshold' | 'cost';
  const [action, setAction] = useState<{ type: Action; item: Item } | null>(null);
  const [actionQty, setActionQty] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const openAction = (type: Action, item: Item) => {
    setAction({ type, item });
    setActionQty(
      type === 'threshold' ? item.threshold
      : type === 'set' ? item.stock
      : type === 'cost' ? item.cost
      : null,
    );
    setActionNote('');
  };

  const runAction = async () => {
    if (!action || actionQty == null) return;
    setActionBusy(true);
    try {
      const { type, item } = action;
      if (type === 'receive') {
        await receiveStock(item.variantId, actionQty, actionNote.trim() || undefined);
        message.success(`เติม ${itemLabel(item)} +${actionQty}`);
      } else if (type === 'adjust') {
        if (actionQty === 0) return;
        await adjustStock(item.variantId, actionQty, actionNote.trim() || undefined);
        message.success(`ปรับ ${itemLabel(item)} ${actionQty > 0 ? '+' : ''}${actionQty}`);
      } else if (type === 'set') {
        await setStockQty(item.variantId, actionQty, actionNote.trim() || undefined);
        message.success(`นับสต๊อก ${itemLabel(item)} = ${actionQty}`);
      } else {
        const { upsertVariant } = await import('../lib/api');
        await upsertVariant({
          id: item.variantId,
          product_id: item.productId,
          size: item.size,
          price: item.price,
          low_stock_threshold: type === 'threshold' ? actionQty : item.threshold,
          sku: item.sku,
          barcode: item.barcode,
          cost_price: type === 'cost' ? actionQty : item.cost,
          unit: item.unit,
        });
        message.success(
          type === 'cost'
            ? `ตั้งทุน ${itemLabel(item)} = ${baht(actionQty)}`
            : `ตั้งเกณฑ์เตือน ${itemLabel(item)} = ${actionQty}`,
        );
      }
      setAction(null);
      void reload(true);
      void reloadMoves();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const ACTION_META: Record<Action, { title: string; hint: string; min: number }> = {
    receive: { title: 'เติมของ', hint: 'ซื้อมากี่ชิ้น ใส่จำนวนนั้น', min: 1 },
    adjust: { title: 'แก้ยอด (+/-)', hint: 'ของเสีย/หาย ใส่เลขติดลบ เช่น -2', min: -100000 },
    set: { title: 'นับของจริง', hint: 'นับบนชั้นได้กี่ชิ้น ใส่เลขนั้นเลย ระบบคิดส่วนต่างให้', min: 0 },
    threshold: { title: 'ตั้งเตือนใกล้หมด', hint: 'เหลือถึงจำนวนนี้เมื่อไหร่ LINE จะเด้งเตือน', min: 0 },
    cost: { title: 'แก้ต้นทุนต่อชิ้น', hint: 'ซื้อมาชิ้นละกี่บาท (ไว้คำนวณกำไรและเงินจมในสต๊อก)', min: 0 },
  };

  /* ── overview columns ───────────────────────────────────────────────── */
  const overviewColumns: ColumnsType<Item> = [
    {
      title: 'สินค้า',
      fixed: 'left',
      width: 260,
      sorter: (a, b) => a.productName.localeCompare(b.productName, 'th'),
      render: (_, i) => (
        <Space>
          <Avatar shape="square" size={44} src={i.image ?? undefined}>
            {i.productName[0]}
          </Avatar>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 16 }}>{itemLabel(i)}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {[i.barcode, i.sku].filter(Boolean).join(' · ') || 'ไม่มีบาร์โค้ด'}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'ราคาขาย',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.price - b.price,
      render: (_, i) => <Text strong style={{ fontSize: 16 }}>{baht(i.price)}</Text>,
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'stock',
      width: 130,
      align: 'right',
      defaultSortOrder: undefined,
      sorter: (a, b) => a.stock - b.stock,
      render: (s: number, i) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
          <Text strong style={{ fontSize: 22, color: STATUS_COLOR[statusOf(i)] }}>
            {s}
            <Text type="secondary" style={{ fontSize: 13 }}> {i.unit ?? 'ชิ้น'}</Text>
          </Text>
          {i.reserved > 0 ? (
            <Text type="secondary" style={{ fontSize: 13 }}>
              ลูกค้าจองไว้ {i.reserved} · ขายได้อีก {i.available}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'สถานะ',
      width: 100,
      filters: [
        { text: 'ปกติ', value: 'ok' },
        { text: 'ใกล้หมด', value: 'low' },
        { text: 'หมด', value: 'out' },
      ],
      onFilter: (v, i) => statusOf(i) === v,
      render: (_, i) => {
        const s = statusOf(i);
        return s === 'out' ? (
          <Tag color="red" style={STATUS_TAG}>หมด</Tag>
        ) : s === 'low' ? (
          <Tag color="orange" style={STATUS_TAG}>ใกล้หมด</Tag>
        ) : (
          <Tag color="green" style={STATUS_TAG}>ปกติ</Tag>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 156,
      render: (_, i) => (
        <Space size={6}>
          {/* Restocking is the everyday action — one click, no menu to scan first. */}
          <Button icon={<RiAddLine className="w-4 h-4" />} onClick={() => openAction('receive', i)}>
            เติมของ
          </Button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'set',
                  icon: <RiScales3Line className="w-4 h-4" />,
                  label: 'ปรับยอดสต๊อก (นับใหม่ / แก้ +−)',
                },
                { key: 'threshold', icon: <RiAlarmWarningLine className="w-4 h-4" />, label: 'ตั้งเตือนใกล้หมด (LINE)' },
                { type: 'divider' },
                { key: 'history', icon: <RiHistoryLine className="w-4 h-4" />, label: 'ดูประวัติชิ้นนี้' },
              ],
              onClick: ({ key }) => {
                if (key === 'history') {
                  setVariantFilter({ id: i.variantId, label: itemLabel(i) });
                  setTab('history');
                  return;
                }
                openAction(key as Action, i);
              },
            }}>
            <Button icon={<RiMore2Line className="w-4 h-4" />} aria-label="อื่นๆ" />
          </Dropdown>
        </Space>
      ),
    },
  ];


  /* ── ต้นทุน tab ─────────────────────────────────────────────────────── */
  const costColumns: ColumnsType<Item> = [
    {
      title: 'สินค้า',
      fixed: 'left',
      width: 260,
      sorter: (a, b) => a.productName.localeCompare(b.productName, 'th'),
      render: (_, i) => (
        <Space>
          <Avatar shape="square" size={40} src={i.image ?? undefined}>
            {i.productName[0]}
          </Avatar>
          <Text strong style={{ fontSize: 15 }}>{itemLabel(i)}</Text>
        </Space>
      ),
    },
    {
      title: 'ทุน/ชิ้น',
      width: 110,
      align: 'right',
      sorter: (a, b) => (a.cost ?? -1) - (b.cost ?? -1),
      render: (_, i) =>
        i.cost != null ? (
          <Text strong style={{ fontSize: 15 }}>{baht(i.cost)}</Text>
        ) : (
          <Tag color="orange">ยังไม่ใส่</Tag>
        ),
    },
    {
      title: 'ขาย/ชิ้น',
      dataIndex: 'price',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.price - b.price,
      render: (v: number) => <Text style={{ fontSize: 15 }}>{baht(v)}</Text>,
    },
    {
      title: 'กำไร/ชิ้น',
      width: 110,
      align: 'right',
      sorter: (a, b) => (a.cost != null ? a.price - a.cost : -1) - (b.cost != null ? b.price - b.cost : -1),
      render: (_, i) =>
        i.cost != null ? (
          <Text strong style={{ fontSize: 15, color: i.price - i.cost >= 0 ? '#15803d' : '#dc2626' }}>
            {baht(i.price - i.cost)}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'stock',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.stock - b.stock,
      render: (v: number) => <Text style={{ fontSize: 15 }}>{v}</Text>,
    },
    {
      title: 'เงินจม (ทุน x คงเหลือ)',
      width: 150,
      align: 'right',
      sorter: (a, b) => (a.cost ?? 0) * a.stock - (b.cost ?? 0) * b.stock,
      render: (_, i) =>
        i.cost != null ? (
          <Text strong style={{ fontSize: 15 }}>{baht(i.cost * i.stock)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '',
      fixed: 'right',
      width: 110,
      render: (_, i) => (
        <Button onClick={() => openAction('cost', i)}>แก้ทุน</Button>
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
        const qty = Number(cells[head[qtyCol]]);
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
    void reloadMoves();
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

  /* ── รับของเข้า (receiving list) ─────────────────────────────────────── */
  const [lines, setLines] = useState<{ item: Item; qty: number }[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<string | null>(null);

  const addItem = useCallback((item: Item, qty = 1) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.item.variantId === item.variantId);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + qty };
        return next;
      }
      return [...prev, { item, qty }];
    });
  }, []);

  const saveReceive = async () => {
    if (!lines.length) return;
    setSaving(true);
    try {
      // Each line is a distinct variant (addItem dedups on variantId above),
      // so these are independent RPC calls — no need to serialize them.
      await Promise.all(lines.map((l) => receiveStock(l.item.variantId, l.qty, note.trim() || undefined)));
      message.success(`รับของเข้า ${lines.length} รายการเรียบร้อย`);
      setLines([]);
      setNote('');
      void reload(true);
      void reloadMoves();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const receiveColumns: ColumnsType<{ item: Item; qty: number }> = [
    {
      title: 'สินค้า',
      render: (_, l) => (
        <Space direction="vertical" size={0}>
          <Text strong>{itemLabel(l.item)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            คงเหลือปัจจุบัน {l.item.stock}
          </Text>
        </Space>
      ),
    },
    {
      title: 'จำนวนรับเข้า',
      width: 160,
      render: (_, l) => (
        <InputNumber
          min={1}
          max={100000}
          value={l.qty}
          onChange={(v) =>
            setLines((prev) =>
              prev.map((x) =>
                x.item.variantId === l.item.variantId ? { ...x, qty: v ?? 1 } : x,
              ),
            )
          }
        />
      ),
    },
    {
      title: '',
      width: 56,
      render: (_, l) => (
        <Button
          type="text"
          danger
          icon={<RiDeleteBinLine className="w-4 h-4" />}
          onClick={() =>
            setLines((prev) => prev.filter((x) => x.item.variantId !== l.item.variantId))
          }
        />
      ),
    },
  ];

  /* ── ประวัติ ────────────────────────────────────────────────────────── */
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [moreLeft, setMoreLeft] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [variantFilter, setVariantFilter] = useState<{ id: string; label: string } | null>(null);

  const reloadMoves = useCallback(async () => {
    setMovesLoading(true);
    try {
      const rows = await listStockMovements(200, undefined, variantFilter?.id);
      setMoves(rows);
      setMoreLeft(rows.length === 200);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setMovesLoading(false);
    }
  }, [message, variantFilter]);
  useEffect(() => {
    void reloadMoves();
  }, [reloadMoves]);

  const loadMore = async () => {
    const last = moves[moves.length - 1];
    if (!last) return;
    setMovesLoading(true);
    try {
      const rows = await listStockMovements(200, { created_at: last.created_at, id: last.id }, variantFilter?.id);
      setMoves((prev) => [...prev, ...rows]);
      setMoreLeft(rows.length === 200);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setMovesLoading(false);
    }
  };

  const shownMoves = useMemo(
    () => (reasonFilter ? moves.filter((m) => m.reason === reasonFilter) : moves),
    [moves, reasonFilter],
  );

  const moveColumns: ColumnsType<StockMovement> = [
    {
      title: 'เวลา',
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => dayjs(v).format('D MMM HH:mm'),
    },
    {
      title: 'สินค้า',
      render: (_, m) => <Text strong>{m.product_name + (m.size ? ` (${m.size})` : '')}</Text>,
    },
    {
      title: 'รายการ',
      dataIndex: 'reason',
      width: 200,
      render: (r: string) => {
        const meta = reasonMeta(r);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'สต๊อก',
      dataIndex: 'delta_stock',
      width: 90,
      align: 'right',
      render: (d: number) =>
        d === 0 ? (
          <Text type="secondary">—</Text>
        ) : (
          <Text strong type={d > 0 ? 'success' : 'danger'}>
            {d > 0 ? `+${d}` : d}
          </Text>
        ),
    },
    {
      title: 'จอง',
      dataIndex: 'delta_reserved',
      width: 80,
      align: 'right',
      responsive: ['md'],
      render: (d: number) =>
        d === 0 ? <Text type="secondary">—</Text> : <Text>{d > 0 ? `+${d}` : d}</Text>,
    },
    {
      title: 'ออเดอร์',
      dataIndex: 'order_number',
      width: 110,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'โดย',
      dataIndex: 'actor_name',
      width: 140,
      responsive: ['lg'],
      render: (v: string | null) => v ?? <Text type="secondary">ระบบ</Text>,
    },
  ];

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            สต๊อก
          </Title>
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

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title="รายการสินค้า" value={items.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic
              title="ใกล้หมด / หมด"
              value={lowCount}
              styles={{ content: { color: lowCount ? '#C5410F' : undefined, fontWeight: lowCount ? 700 : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic
              title="เงินจมในสต๊อก (ตามทุน)"
              value={totals.costValue}
              prefix="฿"
              styles={{ content: { color: '#C5410F', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title="ขายหมดได้เงิน (ตามราคาขาย)" value={totals.saleValue} prefix="฿" />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <RiScales3Line className="w-4 h-4" /> สต๊อกทั้งหมด
                {lowCount ? <Tag color="red">{lowCount}</Tag> : null}
              </span>
            ),
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Space wrap>
                    <Input.Search
                      allowClear
                      placeholder="ค้นหาชื่อ / บาร์โค้ด / SKU"
                      style={{ width: 280 }}
                      onSearch={setQuery}
                      onChange={(e) => !e.target.value && setQuery('')}
                    />
                    <Segmented
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                      options={[
                        { label: 'ทั้งหมด', value: 'all' },
                        { label: `ใกล้หมด (${lowCount})`, value: 'low' },
                        { label: 'หมด', value: 'out' },
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
                  <Table
                    rowKey="variantId"
                    columns={overviewColumns}
                    dataSource={shown}
                    loading={loading}
                    pagination={{ pageSize: 25, showSizeChanger: false }}
                    scroll={{ x: 760 }}
                    locale={{
                      emptyText:
                        query || statusFilter !== 'all' || categoryFilter
                          ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง'
                          : 'ยังไม่มีสินค้าในระบบ',
                    }}
                    rowClassName={(i) =>
                      statusOf(i) === 'out'
                        ? 'stock-row-out'
                        : statusOf(i) === 'low'
                          ? 'stock-row-low'
                          : ''
                    }
                  />
                </Space>
              </Card>
            ),
          },
          {
            key: 'cost',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <RiCoinsLine className="w-4 h-4" /> ต้นทุน
              </span>
            ),
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Text type="secondary">
                    ใส่ทุนต่อชิ้นไว้ ระบบจะคำนวณกำไรต่อชิ้นและเงินจมในสต๊อกให้อัตโนมัติ
                  </Text>
                  <Table
                    rowKey="variantId"
                    columns={costColumns}
                    dataSource={items}
                    loading={loading}
                    pagination={{ pageSize: 25, showSizeChanger: false }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: 'ยังไม่มีสินค้าในระบบ' }}
                  />
                </Space>
              </Card>
            ),
          },
          {
            key: 'receive',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <RiInboxArchiveLine className="w-4 h-4" /> เติมของหลายรายการ
                {lines.length ? <Tag color="orange">{lines.length}</Tag> : null}
              </span>
            ),
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Select
                    showSearch
                    value={search}
                    placeholder="ยิงบาร์โค้ด หรือพิมพ์ชื่อของที่ซื้อมา"
                    style={{ width: '100%', maxWidth: 520 }}
                    options={items.map((i) => ({
                      value: i.variantId,
                      label: `${itemLabel(i)} · คงเหลือ ${i.stock}`,
                      name: itemLabel(i),
                      barcode: i.barcode ?? '',
                    }))}
                    filterOption={(input, opt) => {
                      const q = input.trim().toLowerCase();
                      const name = String(opt?.name ?? '').toLowerCase();
                      const barcode = String(opt?.barcode ?? '');
                      return name.includes(q) || (!!barcode && barcode === input.trim());
                    }}
                    onSelect={(id: string) => {
                      const i = items.find((x) => x.variantId === id);
                      if (i) addItem(i);
                      setSearch(null);
                    }}
                    onInputKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const el = e.target as HTMLInputElement;
                        const hit = items.find((i) => i.barcode && i.barcode === el.value.trim());
                        if (hit) {
                          addItem(hit);
                          setSearch(null);
                        }
                      }
                    }}
                  />
                  {lines.length ? (
                    <>
                      <Table
                        rowKey={(l) => l.item.variantId}
                        columns={receiveColumns}
                        dataSource={lines}
                        pagination={false}
                        size="middle"
                      />
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="หมายเหตุ (เช่น ชื่อร้านค้าส่ง / เลขบิล) — ใส่หรือไม่ก็ได้"
                        maxLength={120}
                        style={{ maxWidth: 520 }}
                      />
                      <Button type="primary" loading={saving} onClick={() => void saveReceive()}>
                        บันทึกเติมของ ({lines.reduce((s, l) => s + l.qty, 0)} ชิ้น)
                      </Button>
                    </>
                  ) : (
                    <Empty description="ยิงบาร์โค้ดหรือพิมพ์ชื่อ เพื่อเพิ่มของที่ซื้อมาลงรายการ แล้วบันทึกทีเดียวทั้งบิล" />
                  )}
                </Space>
              </Card>
            ),
          },
          {
            key: 'history',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <RiHistoryLine className="w-4 h-4" /> ประวัติ
              </span>
            ),
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Space wrap>
                    <Select
                      allowClear
                      value={reasonFilter}
                      onChange={(v) => setReasonFilter(v ?? null)}
                      placeholder="กรองตามประเภทรายการ"
                      style={{ width: 240 }}
                      options={Object.entries(REASONS).map(([value, m]) => ({
                        value,
                        label: m.label,
                      }))}
                    />
                    {variantFilter ? (
                      <Tag closable onClose={() => setVariantFilter(null)} color="orange">
                        เฉพาะ: {variantFilter.label}
                      </Tag>
                    ) : null}
                  </Space>
                  <Table
                    rowKey="id"
                    columns={moveColumns}
                    dataSource={shownMoves}
                    loading={movesLoading}
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 900 }}
                    size="middle"
                    locale={{
                      emptyText: reasonFilter || variantFilter ? 'ไม่พบประวัติที่ตรงกับตัวกรอง' : 'ยังไม่มีประวัติการเคลื่อนไหวสต็อก',
                    }}
                  />
                  {moreLeft && !reasonFilter ? (
                    <Button onClick={() => void loadMore()} loading={movesLoading}>
                      โหลดเพิ่ม
                    </Button>
                  ) : null}
                </Space>
              </Card>
            ),
          },
        ]}
      />

      {/* row action modal */}
      <Modal
        open={!!action}
        title={
          action
            ? `${action.type === 'set' || action.type === 'adjust' ? 'ปรับยอดสต๊อก' : ACTION_META[action.type].title} — ${itemLabel(action.item)}`
            : ''
        }
        onCancel={() => setAction(null)}
        onOk={() => void runAction()}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={actionBusy}
        destroyOnHidden>
        {action ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {(action.type === 'set' || action.type === 'adjust') && (
              <Segmented
                block
                value={action.type}
                onChange={(v) => {
                  const type = v as 'set' | 'adjust';
                  setAction({ type, item: action.item });
                  setActionQty(type === 'set' ? action.item.stock : null);
                }}
                options={[
                  { value: 'set', label: 'นับของจริง' },
                  { value: 'adjust', label: 'แก้ +/− (ของเสีย/คลาดเคลื่อน)' },
                ]}
              />
            )}
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
