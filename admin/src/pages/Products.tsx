import {
  RiAddLine,
  RiDeleteBinLine,
  RiImageAddLine,
  RiImageLine,
  RiPencilLine,
} from '@remixicon/react';
import {
  App,
  Avatar,
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ImgCrop from 'antd-img-crop';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  apiError,
  archiveProduct,
  deleteProductImage,
  listCategories,
  listProductImages,
  listProducts,
  setPrimaryImage,
  setPublishState,
  uploadProductImage,
  upsertProduct,
  upsertVariant,
  type Category,
  type Product,
  type ProductImage,
} from '../lib/api';
import { productThumb } from '../lib/image';

const { Text } = Typography;

const primaryImage = (p: Product) =>
  p.product_images.find((i) => i.is_primary)?.storage_path ?? p.product_images[0]?.storage_path ?? null;
const totalStock = (p: Product) => p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
const isLow = (p: Product) => p.product_variants.some((v) => v.stock_qty <= v.low_stock_threshold);
function priceText(p: Product): string {
  const prices = p.product_variants.map((v) => v.price);
  if (!prices.length) return '—';
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? `฿${lo}` : `฿${lo}–${hi}`;
}

export function Products() {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Barcode to prefill when opening the Add modal via a scan (goods intake).
  const [scanBarcode, setScanBarcode] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listProducts(force), listCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // mount-only fetch; load isn't memoized so listing it would refetch every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scan-to-intake: with no modal open, a barcode scan looks the code up in the
  // catalogue — found → open its Edit (restock); new → open Add prefilled with
  // the barcode. Latest products/editing read via refs so the listener is set
  // up once. Mirrors the POS keyboard-wedge (fast char burst ending in Enter).
  const productsRef = useRef(products);
  productsRef.current = products;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  useEffect(() => {
    const buf = { chars: '', last: 0 };
    // Keypad-emulation scanner support (Alt + ASCII on the numpad) — see the
    // modal wedge for the full story.
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
    const editable = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      return !!n?.tagName && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable);
    };
    function onKey(e: KeyboardEvent) {
      if (editingRef.current) return; // a modal is open → let its fields take the scan
      if (editable(e.target)) return;
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
      if (now - buf.last > 120) buf.chars = ''; // slow gap → real typing, not a scan
      buf.last = now;
      if (e.key === 'Enter') {
        finalizeAlt(now);
        const code = buf.chars.trim();
        buf.chars = '';
        if (code.length < 3) return;
        // Swallow the scan's Enter BEFORE it reaches whatever is focused —
        // e.g. the sidebar Menu treats Enter as "activate item" and would
        // navigate away (owner hit this: scanning bounced to the POS page).
        e.preventDefault();
        e.stopPropagation();
        const found = productsRef.current.find((p) =>
          p.product_variants.some((v) => v.barcode === code || v.sku === code),
        );
        if (found) {
          message.info(`พบสินค้า: ${found.name} — แก้ไข/เติมสต็อก`);
          setEditing(found);
        } else {
          message.success(`บาร์โค้ดใหม่ ${code} — เพิ่มสินค้า`);
          setScanBarcode(code);
          setEditing('new');
        }
        return;
      }
      if (e.key.length === 1) buf.chars += e.key;
    }
    // Capture phase: run before the focused element's own handlers (menus,
    // buttons) so a scan burst can't trigger them.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [message]);

  async function togglePublish(p: Product) {
    try {
      await setPublishState(p.id, p.publish_state === 'published' ? 'draft' : 'published', p.row_version);
      await load(true);
    } catch (e) {
      message.error(apiError(e));
    }
  }
  async function onArchive(p: Product) {
    try {
      await archiveProduct(p.id, p.row_version);
      message.success('ลบสินค้าแล้ว');
      await load(true);
    } catch (e) {
      message.error(apiError(e));
    }
  }

  const summary = useMemo(() => {
    let published = 0,
      low = 0,
      out = 0;
    for (const p of products) {
      if (p.publish_state === 'published') published++;
      const s = totalStock(p);
      if (s === 0) out++;
      else if (isLow(p)) low++;
    }
    return { total: products.length, published, low, out };
  }, [products]);

  const shown = useMemo(
    () =>
      products.filter((p) => {
        if (catFilter && p.category_id !== catFilter) return false;
        if (statusFilter === 'published' && p.publish_state !== 'published') return false;
        if (statusFilter === 'draft' && p.publish_state !== 'draft') return false;
        if (statusFilter === 'low') {
          const s = totalStock(p);
          if (!(s === 0 || isLow(p))) return false;
        }
        const q = query.trim().toLowerCase();
        if (q && !p.name.toLowerCase().includes(q) && !(p.subtitle ?? '').toLowerCase().includes(q))
          return false;
        return true;
      }),
    [products, catFilter, query, statusFilter],
  );

  const columns: ColumnsType<Product> = [
    {
      title: 'สินค้า',
      key: 'name',
      render: (_, p) => (
        <div className="flex items-center gap-3">
          <Avatar shape="square" size={44} src={productThumb(primaryImage(p), 88)} icon={<RiImageLine className="w-5 h-5" />} style={{ background: '#F5F5F5', color: '#BFBFBF', flex: 'none' }} />
          <div className="min-w-0">
            <div className="font-medium text-[#2B2320] truncate">{p.name}</div>
            {p.subtitle ? <Text type="secondary" className="text-xs">{p.subtitle}</Text> : null}
          </div>
        </div>
      ),
    },
    {
      title: 'หมวดหมู่',
      key: 'cat',
      width: 130,
      render: (_, p) => <Text type="secondary">{p.categories?.name ?? '—'}</Text>,
    },
    {
      title: 'ราคา',
      key: 'price',
      width: 110,
      align: 'right',
      render: (_, p) => <span className="font-medium text-[#2B2320]">{priceText(p)}</span>,
    },
    {
      title: 'สต็อก',
      key: 'stock',
      width: 150,
      align: 'right',
      sorter: (a, b) => totalStock(a) - totalStock(b),
      render: (_, p) => {
        const s = totalStock(p);
        const tone = s === 0 ? 'error' : isLow(p) ? 'warning' : null;
        return (
          <div className="leading-tight">
            <span
              className="font-semibold"
              style={{ color: s === 0 ? '#E5484D' : isLow(p) ? '#E08C00' : '#2B2320' }}>
              {s}
            </span>
            {tone && (
              <Tag color={tone} variant="filled" className="ml-1.5 !mr-0">
                {s === 0 ? 'หมด' : 'ใกล้หมด'}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'เผยแพร่',
      key: 'status',
      width: 96,
      align: 'center',
      render: (_, p) => (
        <Switch
          checked={p.publish_state === 'published'}
          onChange={() => void togglePublish(p)}
          checkedChildren="เปิด"
          unCheckedChildren="ปิด"
        />
      ),
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 210,
      align: 'right',
      render: (_, p) => (
        <Space size={6}>
          <Button size="small" color="orange" variant="solid" icon={<RiPencilLine className="w-[15px] h-[15px]" />} onClick={() => setEditing(p)}>
            แก้ไข
          </Button>
          <Popconfirm title="ลบสินค้านี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onArchive(p)}>
            <Tooltip title="ลบ">
              <Button size="small" danger icon={<RiDeleteBinLine className="w-[15px] h-[15px]" />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Text type="secondary">จัดการสินค้า ราคา สต็อก และการเผยแพร่ในแอป</Text>
        </div>
        <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          เพิ่มสินค้า
        </Button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="สินค้าทั้งหมด" value={summary.total} suffix="รายการ" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="เผยแพร่อยู่" value={summary.published} suffix="รายการ" styles={{ content: { color: '#1E9E5C', fontWeight: 700 } }} />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="ใกล้หมดสต็อก" value={summary.low} suffix="รายการ" styles={{ content: { color: summary.low ? '#E08C00' : undefined, fontWeight: 700 } }} />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="หมดสต็อก" value={summary.out} suffix="รายการ" styles={{ content: { color: summary.out ? '#E5484D' : undefined, fontWeight: 700 } }} />
        </Card>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input.Search allowClear placeholder="ค้นหาสินค้า…" autoComplete="off" onChange={(e) => setQuery(e.target.value)} style={{ width: 220 }} />
        <Select
          allowClear
          placeholder="ทุกหมวดหมู่"
          style={{ minWidth: 160 }}
          value={catFilter}
          onChange={setCatFilter}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as string)}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'published', label: 'เผยแพร่' },
            { value: 'draft', label: 'ร่าง' },
            { value: 'low', label: 'ใกล้หมด/หมด' },
          ]}
        />
      </div>

      <Table<Product>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={shown}
        pagination={{ pageSize: 12, hideOnSinglePage: true }}
        scroll={{ x: 760 }}
        style={{ background: '#fff', borderRadius: 0 }}
        locale={{
          emptyText:
            query || catFilter || statusFilter !== 'all' ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง' : 'ยังไม่มีสินค้าในระบบ',
        }}
      />

      {editing ? (
        <ProductModal
          product={editing === 'new' ? null : editing}
          initialBarcode={scanBarcode}
          categories={categories}
          onClose={() => {
            setEditing(null);
            setScanBarcode(null);
          }}
          onSaved={() => {
            setEditing(null);
            setScanBarcode(null);
            void load(true);
          }}
        />
      ) : null}
    </>
  );
}

function ProductModal({
  product,
  initialBarcode,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  /** Prefill the barcode when adding a product via a scan (goods intake). */
  initialBarcode?: string | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<ProductImage[]>(product?.product_images as ProductImage[] ?? []);
  // Images picked while creating a NEW product (no id yet) — uploaded on save.
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const isNewProduct = !product;
  const variantId = product?.product_variants?.[0]?.id;

  // Scanner wedge v3 — deterministic, no more timing guesswork ("หน้าสินค้าหลอน").
  //
  // Two hauntings this kills:
  //  1) "เด้งไปหน้าอื่น / บันทึกเอง": the scan's trailing Enter reached antd's
  //     Modal default button (บันทึก) or moved focus. → The modal now CONSUMES
  //     every Enter except inside a textarea; saving is click-only.
  //  2) "เลขขาด/เกิน/มั่ว": burst chars that slipped past the old 50ms heuristic
  //     landed in whatever field was focused (name, price, …). → Every let-through
  //     char is RECORDED with its target; when the burst ends as a scan we strip
  //     exactly those leaked chars back out of the field (antd input id = form
  //     field name) and write the full clean code into the barcode field.
  useEffect(() => {
    // Only chars a scanner can emit take part; Thai typing is never touched.
    const SCAN_CHAR = /^[0-9A-Za-z._-]$/;
    const buf = { chars: '', last: 0, fast: false };
    // Chars that reached a focused input during the current sequence (let-through).
    let leaked: { el: HTMLElement; key: string }[] = [];
    // Chars we swallowed (preventDefault) with the field they were headed for.
    let swallowed: { el: HTMLElement | null; key: string }[] = [];

    const fieldOf = (el: HTMLElement | null) => (el && el.id ? el.id : null);
    const isNumeric = (el: HTMLElement) => el.classList.contains('ant-input-number-input');

    /** Scan confirmed → pull the leaked chars back out of whatever field they hit. */
    const stripLeaks = () => {
      const byField = new Map<string, { el: HTMLElement; chars: string }>();
      for (const l of leaked) {
        const id = fieldOf(l.el);
        if (!id) continue;
        const cur = byField.get(id) ?? { el: l.el, chars: '' };
        cur.chars += l.key;
        byField.set(id, cur);
      }
      for (const [fieldId, { el, chars }] of byField) {
        const value = form.getFieldValue(fieldId);
        if (value === undefined || value === null) continue;
        const str = String(value);
        if (!str.endsWith(chars)) continue; // field changed some other way — leave it
        const cleaned = str.slice(0, str.length - chars.length);
        form.setFieldValue(fieldId, isNumeric(el) ? (cleaned === '' ? null : Number(cleaned)) : cleaned);
      }
    };

    /** NOT a scan after all → give the swallowed keystrokes back to their field
     *  (fast human typing must never silently vanish). */
    const flushSwallowed = () => {
      const byField = new Map<string, { el: HTMLElement; chars: string }>();
      for (const s of swallowed) {
        const id = fieldOf(s.el);
        if (!id || !s.el) continue;
        const cur = byField.get(id) ?? { el: s.el, chars: '' };
        cur.chars += s.key;
        byField.set(id, cur);
      }
      for (const [fieldId, { el, chars }] of byField) {
        const value = form.getFieldValue(fieldId);
        const str = value === undefined || value === null ? '' : String(value);
        const next = str + chars;
        form.setFieldValue(fieldId, isNumeric(el) ? (next === '' ? null : Number(next)) : next);
      }
      swallowed = [];
    };

    // The shop's scanner runs in Windows keypad-emulation: each char arrives as
    // Alt + its ASCII code on the numpad (no printable keydowns at all — the
    // flight recorder finally exposed this). Decode those groups into buf so
    // scans in this mode get the full treatment (toast, barcode routing, and
    // stripping the natively-composed chars out of whatever field was focused).
    const alt = { digits: '', el: null as HTMLElement | null };
    const finalizeAlt = () => {
      if (!alt.digits) return;
      const n = parseInt(alt.digits, 10);
      alt.digits = '';
      const el = alt.el;
      alt.el = null;
      if (!Number.isFinite(n) || n <= 0 || n > 255) return;
      const ch = String.fromCharCode(n);
      buf.chars += ch;
      buf.fast = true; // alt-code bursts are machine input by definition
      // Windows composes the char into the focused field on Alt-release —
      // record it as a leak so stripLeaks() can pull it back out (endsWith
      // guard makes this a no-op if composition didn't land).
      if (el) leaked.push({ el, key: ch });
    };

    const reset = () => {
      buf.chars = '';
      buf.fast = false;
      leaked = [];
      swallowed = [];
      alt.digits = '';
      alt.el = null;
    };

    // A scanner finishes with Enter within milliseconds. If the sequence just
    // stops (human typed a fast pair then paused), flush what we swallowed so
    // no keystroke ever silently vanishes.
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdleFlush = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        flushSwallowed();
        reset();
      }, 250);
    };

    function onKey(e: KeyboardEvent) {
      armIdleFlush();
      const now = e.timeStamp;
      const gap = now - buf.last;
      buf.last = now;
      const target = e.target as HTMLElement | null;
      const editable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Keypad-emulation scanner: a new Alt press ends the previous group; the
      // numpad digits while Alt is held spell the char's ASCII code.
      if (e.key === 'Alt') {
        finalizeAlt();
        return;
      }
      const numpad = e.altKey ? /^Numpad(\d)$/.exec(e.code) : null;
      if (numpad) {
        alt.digits += numpad[1];
        if (editable && target) alt.el = target;
        return;
      }

      if (e.key === 'Enter') {
        clearTimeout(idleTimer);
        finalizeAlt();
        const code = buf.chars.trim();
        const isScan = code.length >= 6 || (buf.fast && code.length >= 3);
        const inTextarea = target?.tagName === 'TEXTAREA';
        // Enter never submits/clicks in this modal — a scan's trailing Enter used
        // to hit the Modal's default button (บันทึกเอง/เด้งหน้า). Saving is click-only.
        // Textareas keep their newline unless the Enter is the tail of a scan.
        if (isScan || !inTextarea) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (isScan) {
          stripLeaks();
          form.setFieldValue('barcode', code);
          message.success(`บาร์โค้ด ${code}`);
        } else {
          flushSwallowed(); // short/slow sequence = human typing — return it
        }
        reset();
        return;
      }

      if (e.key.length !== 1) return;

      if (!SCAN_CHAR.test(e.key)) {
        // Thai/space/symbol — a scanner never sends these. End any pending
        // sequence as human typing and let the key through untouched.
        flushSwallowed();
        reset();
        return;
      }

      if (gap > 250) {
        flushSwallowed(); // pause = the fast pair was human — give it back first
        reset();
      }
      buf.chars += e.key;
      if (gap < 100) {
        // Machine-fast: swallow so the burst can't garble the focused field.
        buf.fast = true;
        e.preventDefault();
        e.stopPropagation();
        swallowed.push({ el: editable ? target : null, key: e.key });
      } else if (editable && target) {
        // Let it through, but remember where it landed — if this turns out to be
        // a scan, stripLeaks() pulls exactly these back out.
        leaked.push({ el: target, key: e.key });
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [form, message]);

  const reloadImages = async () => {
    if (product) setImages(await listProductImages(product.id));
  };
  useEffect(() => {
    void reloadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const removePending = (i: number) =>
    setPending((cur) => {
      URL.revokeObjectURL(cur[i].url);
      return cur.filter((_, idx) => idx !== i);
    });

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const res = await upsertProduct({
        id: product?.id,
        category_id: v.category_id || null,
        name: v.name.trim(),
        subtitle: v.subtitle?.trim() || null,
        description: v.description?.trim() || null,
        brand: v.brand?.trim() || null,
        expected_row_version: product?.row_version,
      });
      const productId = product?.id ?? res.id;
      // One product = one price/stock: upsert the product's single stock record.
      await upsertVariant({
        id: product?.product_variants?.[0]?.id,
        product_id: productId,
        size: null,
        unit: v.unit?.trim() || 'ชิ้น',
        sku: v.sku?.trim() || null,
        barcode: v.barcode?.trim() || null,
        cost_price: v.cost_price ?? null,
        price: Number(v.price),
        ...(isNewProduct ? { stock_qty: v.stock_qty ?? 0 } : {}),
        low_stock_threshold: v.low_stock_threshold ?? undefined,
      });
      // Upload any images staged while creating (new products can't upload until they exist).
      for (const p of pending) await uploadProductImage(productId, p.file);
      pending.forEach((p) => URL.revokeObjectURL(p.url));
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      centered
      title={product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}
      onCancel={onClose}
      onOk={() => void submit()}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={busy}
      destroyOnHidden
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 14 } }}>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        // Chrome's autofill remembered previously scanned barcodes and popped a
        // suggestion list under the field; the scan's Enter then "picked" an OLD
        // number. These fields must never be remembered.
        autoComplete="off"
        initialValues={{
          name: product?.name ?? '',
          category_id: product?.category_id ?? undefined,
          brand: product?.brand ?? '',
          subtitle: product?.subtitle ?? '',
          description: product?.description ?? '',
          price: product?.product_variants?.[0]?.price ?? null,
          cost_price: product?.product_variants?.[0]?.cost_price ?? null,
          stock_qty: product?.product_variants?.[0]?.stock_qty ?? 0,
          low_stock_threshold: product?.product_variants?.[0]?.low_stock_threshold ?? 5,
          barcode: product?.product_variants?.[0]?.barcode ?? initialBarcode ?? '',
          sku: product?.product_variants?.[0]?.sku ?? '',
          unit: product?.product_variants?.[0]?.unit ?? 'ชิ้น',
        }}
        className="mt-2">
        <Form.Item name="name" label="ชื่อสินค้า" rules={[{ required: true, message: 'กรุณากรอกชื่อสินค้า' }]}>
          <Input placeholder="เช่น ข้าวหอมมะลิ" autoComplete="off" />
        </Form.Item>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="category_id" label="หมวดหมู่">
            <Select allowClear placeholder="— ไม่ระบุ —" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="brand" label="ยี่ห้อ">
            <Input placeholder="เช่น ตราฉัตร" />
          </Form.Item>
        </div>
        <Form.Item name="subtitle" label="คำโปรย">
          <Input placeholder="เช่น หอม นุ่ม คัดพิเศษ" />
        </Form.Item>
        <Form.Item name="description" label="รายละเอียด">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Divider titlePlacement="left" style={{ margin: '4px 0 14px', fontSize: 13, color: '#8a807a' }}>
          ราคา & สต็อก
        </Divider>
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item name="price" label="ราคาขาย" rules={[{ required: true, message: 'กรอกราคา' }]}>
            <InputNumber addonBefore="฿" min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item name="cost_price" label="ต้นทุน (ถ้ามี)">
            {/* ต้นทุนรับทศนิยม (สตางค์) — ราคาขายยังเป็นบาทเต็มตามคณิตเงินทั้งระบบ */}
            <InputNumber addonBefore="฿" min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Form.Item
            name="stock_qty"
            label="สต็อกคงเหลือ"
            extra={isNewProduct ? undefined : 'แก้ไขสต็อกที่หน้าสต็อกเพื่อบันทึกประวัติการเคลื่อนไหว'}>
            {isNewProduct ? (
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            ) : (
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber min={0} disabled style={{ width: '100%' }} placeholder="0" />
                <Button
                  onClick={() => {
                    if (variantId) navigate(`/stock?variant=${variantId}&action=set`);
                  }}>
                  ปรับสต็อก
                </Button>
              </Space.Compact>
            )}
          </Form.Item>
          <Form.Item name="low_stock_threshold" label="แจ้งเตือนเมื่อเหลือ ≤">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="5" />
          </Form.Item>
          <Form.Item name="barcode" label="บาร์โค้ด">
            <Input placeholder="ยิงหรือพิมพ์บาร์โค้ด" autoComplete="off" data-flight-log="true" />
          </Form.Item>
          <Form.Item name="sku" label="รหัสสินค้า (SKU)">
            <Input placeholder="เช่น RICE-5KG" autoComplete="off" />
          </Form.Item>
          <Form.Item name="unit" label="หน่วยนับ">
            <Input placeholder="ชิ้น" />
          </Form.Item>
        </div>

        <div className="mb-1 text-sm text-[#4b443f]">รูปภาพสินค้า</div>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
              <div key={img.id} className="w-24">
                <div className="relative w-24 h-24 rounded-none overflow-hidden border border-[#E8E8E8]">
                  <img src={productThumb(img.storage_path, 192)} alt="" className="w-full h-full object-cover" />
                  {img.is_primary && (
                    <span className="absolute top-1 left-1 rounded bg-tremor-brand text-white text-[10px] px-1.5 py-0.5">
                      รูปหลัก
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  {img.is_primary ? (
                    <span className="text-[11px] text-gray-400">รูปหลัก</span>
                  ) : (
                    <Button
                      size="small"
                      type="link"
                      className="!px-0 !text-[11px]"
                      onClick={async () => {
                        try {
                          await setPrimaryImage(img.id);
                          await reloadImages();
                        } catch (e) {
                          message.error(apiError(e));
                        }
                      }}>
                      ตั้งเป็นหลัก
                    </Button>
                  )}
                  <Popconfirm
                    title="ลบรูปนี้?"
                    okText="ลบ"
                    cancelText="ยกเลิก"
                    okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                      try {
                        await deleteProductImage(img.id);
                        await reloadImages();
                      } catch (e) {
                        message.error(apiError(e));
                      }
                    }}>
                    <Button size="small" type="text" danger icon={<RiDeleteBinLine className="w-3.5 h-3.5" />} />
                  </Popconfirm>
                </div>
              </div>
            ))}
            {pending.map((p, i) => (
              <div key={p.url} className="w-24">
                <div className="relative w-24 h-24 rounded-none overflow-hidden border border-[#E8E8E8]">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    title="ลบรูป"
                    className="absolute top-1 right-1 w-5 h-5 grid place-items-center rounded-none bg-black/55 text-white text-xs leading-none hover:bg-black/75">
                    ×
                  </button>
                </div>
                <div className="text-[11px] text-gray-400 mt-1 text-center">
                  {images.length === 0 && i === 0 ? 'รูปหลัก' : 'รอบันทึก'}
                </div>
              </div>
            ))}
            <ImgCrop aspect={1} showGrid rotationSlider modalTitle="ครอบตัดรูปสินค้า (1:1)" modalOk="ใช้รูปนี้" modalCancel="ยกเลิก">
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={async ({ file, onSuccess, onError }) => {
                  try {
                    if (product) {
                      await uploadProductImage(product.id, file as File);
                      await reloadImages();
                      message.success('อัปโหลดรูปแล้ว');
                    } else {
                      const f = file as File;
                      setPending((cur) => [...cur, { file: f, url: URL.createObjectURL(f) }]);
                    }
                    onSuccess?.({});
                  } catch (e) {
                    message.error(apiError(e));
                    onError?.(e as Error);
                  }
                }}>
                <button
                  type="button"
                  className="w-24 h-24 rounded-none border border-dashed border-[#D9D9D9] grid place-items-center text-gray-400 hover:border-tremor-brand hover:text-tremor-brand transition">
                  <div className="text-center">
                    <RiImageAddLine className="w-6 h-6 mx-auto" />
                    <div className="text-[11px] mt-1">เพิ่มรูป</div>
                  </div>
                </button>
              </Upload>
            </ImgCrop>
          </div>
      </Form>
    </Modal>
  );
}
