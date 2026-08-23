/**
 * รับของเข้า — ใบรับเข้าสินค้าแบบเดียวกับที่เจ้าของคุ้นจาก ETS POS (ทาง ก,
 * 23 ส.ค.): ผู้ขาย + เลขเอกสาร + หลายรายการต่อใบ + เลขใบวิ่งอัตโนมัติ
 * (IN260823-001) — เพื่อให้ OFU เป็นระบบเดียวที่แตะสต๊อก ETS เหลือไว้ดูย้อนหลัง
 *
 * ครึ่งบน: ฟอร์มใบใหม่ — ยิงบาร์โค้ด/พิมพ์ค้นหาแล้ว Enter = ลงบรรทัด (นิสัย
 * เดียวกับหน้าขาย), กรอกจำนวน+ทุนต่อหน่วย (ทุนใหม่ทับทุนเดิมของตัวนั้น —
 * ธรรมเนียม ETS: รับของคือตอนที่รู้ทุนล่าสุด)
 * ครึ่งล่าง: ประวัติใบรับเข้า กดขยายดูรายบรรทัด
 */

import { RiAddLine, RiDeleteBin6Line } from '@remixicon/react';
import {
  AutoComplete,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InputRef } from 'antd';

import {
  apiError,
  createGoodsReceipt,
  getGoodsReceiptLines,
  listProducts,
  type GoodsReceipt,
  type GoodsReceiptLine,
} from '../lib/api';
import { productThumb } from '../lib/image';

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

type PickItem = {
  variantId: string;
  label: string;
  productName: string;
  size: string | null;
  barcode: string | null;
  sku: string | null;
  cost: number | null;
  image: string | null;
};

type DraftLine = PickItem & { qty: number; unitCost: number | null };

export function Receive() {
  const [items, setItems] = useState<PickItem[]>([]);
  const [supplier, setSupplier] = useState('');
  const [docNo, setDocNo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState<GoodsReceipt[] | null>(null);
  const [lineCache, setLineCache] = useState<Record<string, GoodsReceiptLine[]>>({});
  const [query, setQuery] = useState('');
  const searchRef = useRef<InputRef>(null);

  const loadReceipts = useCallback(() => {
    listGoodsReceiptsSafe().then(setReceipts);
  }, []);

  useEffect(() => {
    void listProducts().then((ps) => {
      setItems(
        ps.flatMap((p) => {
          const image =
            productThumb(
              p.product_images.find((i) => i.is_primary)?.storage_path ??
                p.product_images[0]?.storage_path ??
                null,
              64,
            ) ?? null;
          return p.product_variants.map((v) => ({
            variantId: v.id,
            label: `${p.name}${v.size ? ` (${v.size})` : ''}`,
            productName: p.name,
            size: v.size ?? null,
            barcode: v.barcode ?? null,
            sku: v.sku ?? null,
            cost: v.cost_price ?? null,
            image,
          }));
        }),
      );
    });
    loadReceipts();
  }, [loadReceipts]);

  /* ชื่อผู้ขายที่เคยใช้ — ให้ AutoComplete จำแทนคน */
  const supplierOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of receipts ?? []) if (r.supplier) seen.add(r.supplier);
    return [...seen].map((v) => ({ value: v }));
  }, [receipts]);

  /* ยิงบาร์โค้ดตรง = เข้าบรรทัดทันที · พิมพ์ = โชว์ตัวเลือกให้จิ้ม */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (i) =>
          i.barcode === query.trim() ||
          i.sku?.toLowerCase() === q ||
          i.label.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [items, query]);

  const addLine = useCallback((item: PickItem) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.variantId === item.variantId);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [...prev, { ...item, qty: 1, unitCost: item.cost }];
    });
    setQuery('');
    searchRef.current?.focus();
  }, []);

  const onSearchEnter = () => {
    // บาร์โค้ดเป๊ะมาก่อน (เครื่องยิงจบด้วย Enter เสมอ) — ไม่งั้นถ้าเหลือตัวเดียวก็เอาตัวนั้น
    const exact = items.find((i) => i.barcode === query.trim());
    if (exact) return addLine(exact);
    if (matches.length === 1) return addLine(matches[0]);
    if (matches.length === 0 && query.trim()) message.warning('ไม่พบสินค้า — เช็คบาร์โค้ดหรือสะกดอีกครั้ง');
  };

  const total = lines.reduce((s, l) => s + (l.unitCost ?? 0) * l.qty, 0);

  const save = async () => {
    if (lines.length === 0) return;
    setSaving(true);
    try {
      const res = await createGoodsReceipt({
        supplier: supplier.trim() || undefined,
        doc_number: docNo.trim() || undefined,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          ...(l.unitCost != null ? { unit_cost: l.unitCost } : {}),
        })),
      });
      message.success(`บันทึกใบ ${res.receipt_number} — รับเข้า ${res.line_count} รายการ`);
      setLines([]);
      setSupplier('');
      setDocNo('');
      loadReceipts();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const draftCols: ColumnsType<DraftLine> = [
    {
      title: 'สินค้า',
      render: (_, l) => (
        <span className="flex items-center gap-2">
          {l.image ? <img src={l.image} className="w-8 h-8 rounded object-cover" alt="" /> : null}
          <span>
            {l.productName}
            {l.size ? <Typography.Text type="secondary"> ({l.size})</Typography.Text> : null}
          </span>
        </span>
      ),
    },
    {
      title: 'จำนวน',
      width: 110,
      render: (_, l, i) => (
        <InputNumber
          min={1}
          max={100000}
          value={l.qty}
          onChange={(v) =>
            setLines((prev) => prev.map((x, j) => (j === i ? { ...x, qty: v ?? 1 } : x)))
          }
        />
      ),
    },
    {
      title: 'ทุน/หน่วย',
      width: 130,
      render: (_, l, i) => (
        <InputNumber
          min={0}
          placeholder="ไม่บังคับ"
          value={l.unitCost ?? undefined}
          onChange={(v) =>
            setLines((prev) => prev.map((x, j) => (j === i ? { ...x, unitCost: v ?? null } : x)))
          }
        />
      ),
    },
    {
      title: 'รวม',
      width: 110,
      align: 'right',
      render: (_, l) => (l.unitCost != null ? baht(l.unitCost * l.qty) : '—'),
    },
    {
      title: '',
      width: 46,
      render: (_, _l, i) => (
        <Button
          type="text"
          danger
          icon={<RiDeleteBin6Line className="w-4 h-4" />}
          onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
        />
      ),
    },
  ];

  const historyCols: ColumnsType<GoodsReceipt> = [
    { title: 'เลขที่ใบ', dataIndex: 'receipt_number', width: 140, render: (v) => <span className="font-mono">{v}</span> },
    { title: 'วันที่', dataIndex: 'created_at', width: 150, render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    { title: 'ผู้ขาย', dataIndex: 'supplier', render: (v) => v ?? <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'เลขเอกสาร', dataIndex: 'doc_number', width: 140, render: (v) => v ?? '—' },
    { title: 'รายการ', dataIndex: 'line_count', width: 90, align: 'right' },
    { title: 'ทุนรวม', dataIndex: 'total_cost', width: 120, align: 'right', render: (v) => (v > 0 ? baht(v) : '—') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card title="สร้างใบรับเข้าสินค้า" size="small">
        <div className="flex flex-wrap gap-2 mb-3">
          <AutoComplete
            options={supplierOptions}
            value={supplier}
            onChange={setSupplier}
            placeholder="ผู้ขาย เช่น แม็คโคร"
            style={{ width: 220 }}
            filterOption={(input, opt) =>
              (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Input
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
            placeholder="เลขที่เอกสาร (ถ้ามี)"
            style={{ width: 200 }}
          />
        </div>

        <Input
          ref={searchRef}
          data-flight-log="true"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={onSearchEnter}
          placeholder="ยิงบาร์โค้ด หรือพิมพ์ชื่อ/SKU แล้วกด Enter…"
          allowClear
          autoFocus
        />
        {matches.length > 1 ? (
          <div className="border rounded mt-1 divide-y" style={{ borderColor: 'var(--ant-color-border)' }}>
            {matches.map((m) => (
              <button
                key={m.variantId}
                type="button"
                onClick={() => addLine(m)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-black/5">
                <RiAddLine className="w-4 h-4 flex-none" />
                <span className="flex-1">{m.label}</span>
                {m.barcode ? <span className="font-mono text-xs opacity-60">{m.barcode}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {lines.length === 0 ? (
          <Empty className="my-6" description="ยิงบาร์โค้ดเพื่อเริ่มใบรับเข้า" />
        ) : (
          <>
            <Table
              className="mt-3"
              rowKey="variantId"
              columns={draftCols}
              dataSource={lines}
              pagination={false}
              size="small"
            />
            <div className="flex items-center justify-between mt-3">
              <Typography.Text type="secondary">
                {lines.length} รายการ · {lines.reduce((s, l) => s + l.qty, 0)} ชิ้น
                {total > 0 ? ` · ทุนรวม ${baht(total)}` : ''}
              </Typography.Text>
              <Button type="primary" size="large" loading={saving} onClick={() => void save()}>
                บันทึกรับเข้า
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card title="ประวัติใบรับเข้า" size="small" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={historyCols}
          dataSource={receipts ?? []}
          loading={receipts === null}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          expandable={{
            onExpand: (open, r) => {
              if (open && !lineCache[r.id])
                void getGoodsReceiptLines(r.id).then((ls) =>
                  setLineCache((prev) => ({ ...prev, [r.id]: ls })),
                );
            },
            expandedRowRender: (r) => {
              const ls = lineCache[r.id];
              if (!ls) return <Typography.Text type="secondary">กำลังโหลด…</Typography.Text>;
              return (
                <Table
                  rowKey={(l) => `${r.id}-${l.product_name}-${l.size ?? ''}-${l.barcode ?? ''}`}
                  size="small"
                  pagination={false}
                  dataSource={ls}
                  columns={[
                    { title: 'สินค้า', render: (_, l) => `${l.product_name}${l.size ? ` (${l.size})` : ''}` },
                    { title: 'บาร์โค้ด', dataIndex: 'barcode', width: 150, render: (v) => v ?? '—' },
                    { title: 'จำนวน', dataIndex: 'qty', width: 90, align: 'right' },
                    { title: 'ทุน/หน่วย', dataIndex: 'unit_cost', width: 110, align: 'right',
                      render: (v) => (v != null ? baht(v) : '—') },
                  ]}
                />
              );
            },
          }}
          locale={{ emptyText: <Empty description="ยังไม่มีใบรับเข้า" /> }}
        />
      </Card>

      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        รับของที่นี่ = สต๊อกบวกทันที ลงสมุดสต๊อกทุกบรรทัด · ทุนที่กรอกจะกลายเป็นทุนล่าสุดของสินค้าตัวนั้น
        · ปุ่ม <Tag className="mx-1">เติม</Tag> ในหน้าสต๊อกยังใช้ได้เหมือนเดิมสำหรับของชิ้นเดียวไม่มีเอกสาร
      </Typography.Text>
    </div>
  );
}

/* แยกไว้ให้ล้มเงียบ ๆ ตอน migration ยังไม่ถูกรัน — หน้าโชว์ว่างเปล่าแทนที่จะพัง */
async function listGoodsReceiptsSafe(): Promise<GoodsReceipt[]> {
  try {
    const { listGoodsReceipts } = await import('../lib/api');
    return await listGoodsReceipts();
  } catch {
    return [];
  }
}
