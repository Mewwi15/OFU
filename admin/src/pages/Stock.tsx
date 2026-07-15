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
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ACTION_COLOR } from '../lib/actionColors';
import {
  apiError,
  listProducts,
  receiveStock,
  setStockQty,
  type Product,
} from '../lib/api';
import { productThumb } from '../lib/image';

const { Text } = Typography;

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

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
  const outCount = useMemo(() => items.filter((i) => statusOf(i) === 'out').length, [items]);

  /* ── filters ─────────────────────────────────────────────────────────── */
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Scroll target for the clickable "ใกล้หมด/หมด" summary card.
  const listRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort(),
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((i) => {
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
    // Triage order: หมด → ใกล้หมด → ปกติ, then lowest stock first — so with
    // 400+ products the handful that need restocking sit at the top on load.
    // Only re-derives when items change (reload), never live, so a just-
    // restocked row doesn't jump away mid-action; column click-sorters still
    // override (no column sets defaultSortOrder).
    const rank = { out: 0, low: 1, ok: 2 } as const;
    return filtered.sort(
      (a, b) => rank[statusOf(a)] - rank[statusOf(b)] || a.stock - b.stock,
    );
  }, [items, query, statusFilter, categoryFilter]);

  const totals = useMemo(() => {
    const costValue = items.reduce((s, i) => s + (i.cost ?? 0) * i.stock, 0);
    const saleValue = items.reduce((s, i) => s + i.price * i.stock, 0);
    return { costValue, saleValue };
  }, [items]);

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
      sorter: (a, b) => a.price - b.price,
      render: (_, i) => <Text style={{ fontSize: 14 }}>{baht(i.price)}</Text>,
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'stock',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.stock - b.stock,
      render: (s: number, i) => {
        const st = statusOf(i);
        return (
          <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
            <Text strong style={{ fontSize: 18, color: STATUS_COLOR[st] }}>
              {s}
              <Text type="secondary" style={{ fontSize: 12 }}> {i.unit ?? 'ชิ้น'}</Text>
            </Text>
            {/* Status is already carried by the number colour + the row tint —
                no separate caption line (owner: "เยอะไป"). Only reserved gets a
                sub-line, and only when there actually are reservations. */}
            {i.reserved > 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                จองไว้ {i.reserved} · ขายได้อีก {i.available}
              </Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, i) => (
        <Space size={6}>
          {/* Restocking is the everyday action — one click, no menu to scan first.
              variant="filled" (light blue) instead of solid so 400 rows read as
              quiet texture, not a saturated wall; still blue, still labelled. */}
          <Button color="blue" variant="filled" icon={<RiAddLine className="w-4 h-4" />} onClick={() => openAction('receive', i)}>
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
        </Space>
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

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title="รายการสินค้า" value={items.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          {/* The fast path into what matters: tap to filter down to low/out
              and jump to the list. Splits the count so หมด vs ใกล้หมด read apart. */}
          <Card
            size="small"
            hoverable
            styles={{ body: { padding: '12px 16px' } }}
            onClick={() => {
              setStatusFilter('low');
              listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}>
            <Statistic
              title="ใกล้หมด / หมด"
              value={lowCount}
              formatter={() =>
                lowCount === 0 ? (
                  <span style={{ fontSize: 20, color: '#15803d' }}>ครบทุกอย่าง</span>
                ) : (
                  <span style={{ fontSize: 20, fontWeight: 700 }}>
                    <span style={{ color: '#dc2626' }}>หมด {outCount}</span>
                    <span style={{ color: '#BFBFBF', fontWeight: 400 }}> · </span>
                    <span style={{ color: '#c2410c' }}>ใกล้หมด {lowCount - outCount}</span>
                  </span>
                )
              }
            />
            <div style={{ fontSize: 12, color: '#8C8C8C', marginTop: 2 }}>
              {lowCount === 0 ? 'สต๊อกเพียงพอ' : 'แตะเพื่อดูรายการ'}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title="เงินจมในสต๊อก (ตามทุน)" value={totals.costValue} prefix="฿" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title="ขายหมดได้เงิน (ตามราคาขาย)" value={totals.saleValue} prefix="฿" />
          </Card>
        </Col>
      </Row>

      <div ref={listRef}>
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
                  { label: `ทั้งหมด (${items.length})`, value: 'all' },
                  { label: `ใกล้หมด (${lowCount})`, value: 'low' },
                  { label: `หมด (${outCount})`, value: 'out' },
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
              {lowCount > 0
                ? `แสดง ${shown.length} รายการ · เรียงของที่ต้องเติม (ใกล้หมด ${lowCount} · หมด ${outCount}) ขึ้นบนสุดให้แล้ว`
                : `แสดง ${shown.length} รายการ · สต๊อกเพียงพอทุกรายการ`}
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
      </div>

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
