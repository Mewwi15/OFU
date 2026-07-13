/**
 * สต๊อก — the stock workspace (owner request 2026-07-13).
 *
 *  • รับของเข้า : goods-in. Search by name or scan a barcode (scanner types +
 *    Enter into the same box), build the receiving list, save once — each line
 *    lands in the ledger with the dedicated 'receive' reason.
 *  • ประวัติ    : the stock_movements ledger (who/what/when, in/out, order no).
 *  • ใกล้หมด    : variants at/below their low-stock threshold, one tap to put
 *    them on the receiving list. LINE alerts fire from the DB trigger (0055).
 */

import {
  RiAddLine,
  RiAlarmWarningLine,
  RiDeleteBinLine,
  RiHistoryLine,
  RiInboxArchiveLine,
} from '@remixicon/react';
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  apiError,
  listProducts,
  listStockMovements,
  receiveStock,
  type Product,
  type StockMovement,
} from '../lib/api';

const { Title, Text } = Typography;

/** Ledger reason → Thai label + tag colour. */
const REASONS: Record<string, { label: string; color: string }> = {
  receive: { label: 'รับของเข้า', color: 'green' },
  admin_adjust: { label: 'ปรับสต๊อก', color: 'blue' },
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

/** One row on the receiving list. */
type ReceiveLine = {
  variantId: string;
  productName: string;
  size: string | null;
  currentStock: number;
  qty: number;
};

type VariantOption = {
  variantId: string;
  productName: string;
  size: string | null;
  barcode: string | null;
  stock: number;
  threshold: number;
};

function flattenVariants(products: Product[]): VariantOption[] {
  return products.flatMap((p) =>
    p.product_variants.map((v) => ({
      variantId: v.id,
      productName: p.name,
      size: v.size,
      barcode: v.barcode ?? null,
      stock: v.stock_qty,
      threshold: v.low_stock_threshold,
    })),
  );
}

const variantLabel = (v: { productName: string; size: string | null }) =>
  v.productName + (v.size ? ` (${v.size})` : '');

export function Stock() {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState('receive');

  const reload = useCallback(async () => {
    try {
      setProducts(await listProducts());
    } catch (e) {
      message.error(apiError(e));
    }
  }, [message]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const variants = useMemo(() => flattenVariants(products), [products]);

  /* ── รับของเข้า ─────────────────────────────────────────────────────────── */
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const addVariant = useCallback(
    (v: VariantOption, qty = 1) => {
      setLines((prev) => {
        const at = prev.findIndex((l) => l.variantId === v.variantId);
        if (at >= 0) {
          const next = [...prev];
          next[at] = { ...next[at], qty: next[at].qty + qty };
          return next;
        }
        return [
          ...prev,
          {
            variantId: v.variantId,
            productName: v.productName,
            size: v.size,
            currentStock: v.stock,
            qty,
          },
        ];
      });
    },
    [],
  );

  /** Scanner path: exact barcode match auto-adds a unit. */
  const onSearchEnter = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    const hit = variants.find((v) => v.barcode && v.barcode === q);
    if (hit) {
      addVariant(hit);
      setSearch(null);
      return;
    }
    message.warning('ไม่พบบาร์โค้ดนี้ — เลือกจากรายการค้นหาแทน');
  };

  const saveReceive = async () => {
    if (!lines.length) return;
    setSaving(true);
    try {
      for (const l of lines) {
        await receiveStock(l.variantId, l.qty, note.trim() || undefined);
      }
      message.success(`รับของเข้า ${lines.length} รายการเรียบร้อย`);
      setLines([]);
      setNote('');
      void reload();
      void reloadMoves();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const receiveColumns: ColumnsType<ReceiveLine> = [
    {
      title: 'สินค้า',
      render: (_, l) => (
        <Space direction="vertical" size={0}>
          <Text strong>{variantLabel(l)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            คงเหลือปัจจุบัน {l.currentStock}
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
              prev.map((x) => (x.variantId === l.variantId ? { ...x, qty: v ?? 1 } : x)),
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
          onClick={() => setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))}
        />
      ),
    },
  ];

  /* ── ประวัติ ───────────────────────────────────────────────────────────── */
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [moreLeft, setMoreLeft] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);

  const reloadMoves = useCallback(async () => {
    setMovesLoading(true);
    try {
      const rows = await listStockMovements(200);
      setMoves(rows);
      setMoreLeft(rows.length === 200);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setMovesLoading(false);
    }
  }, [message]);
  useEffect(() => {
    void reloadMoves();
  }, [reloadMoves]);

  const loadMore = async () => {
    const last = moves[moves.length - 1];
    if (!last) return;
    setMovesLoading(true);
    try {
      const rows = await listStockMovements(200, last.created_at);
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
      render: (_, m) => (
        <Text strong>{m.product_name + (m.size ? ` (${m.size})` : '')}</Text>
      ),
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
      width: 90,
      align: 'right',
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
      render: (v: string | null) => v ?? <Text type="secondary">ระบบ</Text>,
    },
  ];

  /* ── ใกล้หมด ───────────────────────────────────────────────────────────── */
  const lowStock = useMemo(
    () => variants.filter((v) => v.stock <= v.threshold).sort((a, b) => a.stock - b.stock),
    [variants],
  );

  const lowColumns: ColumnsType<VariantOption> = [
    {
      title: 'สินค้า',
      render: (_, v) => <Text strong>{variantLabel(v)}</Text>,
    },
    {
      title: 'คงเหลือ',
      dataIndex: 'stock',
      width: 110,
      align: 'right',
      render: (s: number) =>
        s === 0 ? <Tag color="red">หมด</Tag> : <Tag color="orange">{s}</Tag>,
    },
    { title: 'เกณฑ์เตือน', dataIndex: 'threshold', width: 110, align: 'right' },
    {
      title: '',
      width: 130,
      render: (_, v) => (
        <Button
          size="small"
          icon={<RiAddLine className="w-4 h-4" />}
          onClick={() => {
            addVariant(v);
            setTab('receive');
          }}>
          รับของเข้า
        </Button>
      ),
    },
  ];

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <Title level={4} style={{ margin: 0 }}>
        สต๊อก
      </Title>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'receive',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <RiInboxArchiveLine className="w-4 h-4" /> รับของเข้า
                {lines.length ? <Tag color="orange">{lines.length}</Tag> : null}
              </span>
            ),
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Select
                    ref={searchRef as never}
                    showSearch
                    value={search}
                    placeholder="ค้นหาชื่อสินค้า หรือยิงบาร์โค้ดที่ช่องนี้"
                    style={{ width: '100%', maxWidth: 520 }}
                    options={variants.map((v) => ({
                      value: v.variantId,
                      label: `${variantLabel(v)} · คงเหลือ ${v.stock}`,
                      name: variantLabel(v),
                      barcode: v.barcode ?? '',
                    }))}
                    filterOption={(input, opt) => {
                      const q = input.trim().toLowerCase();
                      const name = String(opt?.name ?? '').toLowerCase();
                      const barcode = String(opt?.barcode ?? '');
                      return name.includes(q) || (!!barcode && barcode === input.trim());
                    }}
                    onSelect={(id: string) => {
                      const v = variants.find((x) => x.variantId === id);
                      if (v) addVariant(v);
                      setSearch(null);
                    }}
                    onInputKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const el = e.target as HTMLInputElement;
                        onSearchEnter(el.value);
                      }
                    }}
                  />

                  {lines.length ? (
                    <>
                      <Table
                        rowKey="variantId"
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
                        บันทึกรับของ ({lines.reduce((s, l) => s + l.qty, 0)} ชิ้น)
                      </Button>
                    </>
                  ) : (
                    <Empty description="ค้นหาสินค้าหรือยิงบาร์โค้ดเพื่อเริ่มรับของ" />
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
                  <Select
                    allowClear
                    value={reasonFilter}
                    onChange={(v) => setReasonFilter(v ?? null)}
                    placeholder="กรองตามประเภทรายการ"
                    style={{ width: 260 }}
                    options={Object.entries(REASONS).map(([value, m]) => ({
                      value,
                      label: m.label,
                    }))}
                  />
                  <Table
                    rowKey="id"
                    columns={moveColumns}
                    dataSource={shownMoves}
                    loading={movesLoading}
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    size="middle"
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
          {
            key: 'low',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <RiAlarmWarningLine className="w-4 h-4" /> ใกล้หมด
                {lowStock.length ? <Tag color="red">{lowStock.length}</Tag> : null}
              </span>
            ),
            children: (
              <Card>
                {lowStock.length ? (
                  <Table
                    rowKey="variantId"
                    columns={lowColumns}
                    dataSource={lowStock}
                    pagination={false}
                    size="middle"
                  />
                ) : (
                  <Empty description="ไม่มีสินค้าใกล้หมด" />
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
