import {
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiImageLine,
  RiPencilLine,
} from '@remixicon/react';
import {
  App,
  Avatar,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';

import {
  apiError,
  archiveProduct,
  deleteVariant,
  listCategories,
  listProducts,
  setPublishState,
  upsertProduct,
  upsertVariant,
  type Category,
  type Product,
  type Variant,
} from '../lib/api';

const { Title, Text } = Typography;

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
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | undefined>();

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listProducts(), listCategories()]);
      setProducts(p);
      setCategories(c);
      setVariantsFor((cur) => (cur ? p.find((x) => x.id === cur.id) ?? null : null));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function togglePublish(p: Product) {
    try {
      await setPublishState(p.id, p.publish_state === 'published' ? 'draft' : 'published', p.row_version);
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }
  async function onArchive(p: Product) {
    try {
      await archiveProduct(p.id, p.row_version);
      message.success('ลบสินค้าแล้ว');
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }

  const shown = useMemo(
    () =>
      products.filter((p) => {
        if (catFilter && p.category_id !== catFilter) return false;
        const q = query.trim().toLowerCase();
        if (q && !p.name.toLowerCase().includes(q) && !(p.subtitle ?? '').toLowerCase().includes(q))
          return false;
        return true;
      }),
    [products, catFilter, query],
  );

  const columns: ColumnsType<Product> = [
    {
      title: 'สินค้า',
      key: 'name',
      render: (_, p) => (
        <div className="flex items-center gap-3">
          <Avatar shape="square" size={44} src={primaryImage(p)} icon={<RiImageLine className="w-5 h-5" />} style={{ background: '#F3EDE9', color: '#B9A79C', flex: 'none' }} />
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
      width: 130,
      align: 'right',
      render: (_, p) => {
        const s = totalStock(p);
        const color = s === 0 ? 'error' : isLow(p) ? 'warning' : 'default';
        return (
          <Space size={4}>
            <Tag color={color} bordered={false} style={{ marginInlineEnd: 0 }}>
              {s}
            </Tag>
            <Text type="secondary" className="text-xs">
              {p.product_variants.length} ขนาด
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'สถานะ',
      key: 'status',
      width: 110,
      align: 'center',
      render: (_, p) =>
        p.publish_state === 'published' ? (
          <Tag color="success" bordered={false}>เผยแพร่</Tag>
        ) : (
          <Tag bordered={false}>ร่าง</Tag>
        ),
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 210,
      align: 'right',
      render: (_, p) => {
        const published = p.publish_state === 'published';
        return (
          <Space size={4}>
            <Button size="small" onClick={() => setVariantsFor(p)}>
              ขนาด / สต็อก
            </Button>
            <Tooltip title="แก้ไข">
              <Button size="small" type="text" icon={<RiPencilLine className="w-[17px] h-[17px]" />} onClick={() => setEditing(p)} />
            </Tooltip>
            <Tooltip title={published ? 'ซ่อน' : 'เผยแพร่'}>
              <Button
                size="small"
                type="text"
                icon={published ? <RiEyeOffLine className="w-[17px] h-[17px]" /> : <RiEyeLine className="w-[17px] h-[17px]" />}
                onClick={() => void togglePublish(p)}
              />
            </Tooltip>
            <Popconfirm title="ลบสินค้านี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onArchive(p)}>
              <Button size="small" type="text" danger icon={<RiDeleteBinLine className="w-[17px] h-[17px]" />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>สินค้า</Title>
          <Text type="secondary">ทั้งหมด {products.length} รายการ</Text>
        </div>
        <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          เพิ่มสินค้า
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input.Search allowClear placeholder="ค้นหาสินค้า…" onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <Select
          allowClear
          placeholder="ทุกหมวดหมู่"
          style={{ minWidth: 180 }}
          value={catFilter}
          onChange={setCatFilter}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      <Table<Product>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={shown}
        pagination={{ pageSize: 12, hideOnSinglePage: true }}
        scroll={{ x: 760 }}
        style={{ background: '#fff', borderRadius: 16 }}
      />

      {editing ? (
        <ProductModal
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}

      {variantsFor ? <VariantsModal product={variantsFor} onClose={() => setVariantsFor(null)} onChanged={load} /> : null}
    </>
  );
}

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await upsertProduct({
        id: product?.id,
        category_id: v.category_id || null,
        name: v.name.trim(),
        subtitle: v.subtitle?.trim() || null,
        description: v.description?.trim() || null,
        brand: v.brand?.trim() || null,
        expected_row_version: product?.row_version,
      });
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}
      onCancel={onClose}
      onOk={() => void submit()}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={busy}
      destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          name: product?.name ?? '',
          category_id: product?.category_id ?? undefined,
          brand: product?.brand ?? '',
          subtitle: product?.subtitle ?? '',
          description: product?.description ?? '',
        }}
        className="mt-2">
        <Form.Item name="name" label="ชื่อสินค้า" rules={[{ required: true, message: 'กรุณากรอกชื่อสินค้า' }]}>
          <Input placeholder="เช่น ข้าวหอมมะลิ" />
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
      </Form>
    </Modal>
  );
}

function VariantsModal({
  product,
  onClose,
  onChanged,
}: {
  product: Product;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Variant | 'new' | null>(null);

  const del = async (id: string) => {
    try {
      await deleteVariant(id);
      message.success('ลบขนาดแล้ว');
      await onChanged();
    } catch (e) {
      message.error(apiError(e));
    }
  };

  return (
    <Modal
      open
      title={`ขนาด / สต็อก — ${product.name}`}
      onCancel={onClose}
      destroyOnHidden
      width={820}
      footer={[
        <Button key="add" type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          เพิ่มขนาด
        </Button>,
        <Button key="close" onClick={onClose}>
          ปิด
        </Button>,
      ]}>
      <Table<Variant>
        size="small"
        rowKey="id"
        className="mt-2"
        pagination={false}
        scroll={{ x: 720 }}
        locale={{ emptyText: 'ยังไม่มีขนาด — กด “เพิ่มขนาด”' }}
        dataSource={product.product_variants}
        columns={[
          { title: 'ขนาด', key: 'size', render: (_, v) => v.size ?? 'ปกติ' },
          { title: 'หน่วย', dataIndex: 'unit', key: 'unit', width: 70 },
          { title: 'SKU', key: 'sku', render: (_, v) => v.sku ?? <Text type="secondary">—</Text> },
          { title: 'บาร์โค้ด', key: 'barcode', render: (_, v) => v.barcode ?? <Text type="secondary">—</Text> },
          {
            title: 'ต้นทุน',
            key: 'cost',
            align: 'right',
            width: 80,
            render: (_, v) => (v.cost_price != null ? `฿${v.cost_price}` : <Text type="secondary">—</Text>),
          },
          { title: 'ราคา', key: 'price', align: 'right', width: 80, render: (_, v) => `฿${v.price}` },
          {
            title: 'กำไร',
            key: 'margin',
            align: 'right',
            width: 70,
            render: (_, v) =>
              v.cost_price != null ? (
                <Text type="success">฿{v.price - v.cost_price}</Text>
              ) : (
                <Text type="secondary">—</Text>
              ),
          },
          {
            title: 'สต็อก',
            key: 'stock',
            align: 'right',
            width: 90,
            render: (_, v) => {
              const low = v.stock_qty <= v.low_stock_threshold;
              return (
                <span>
                  <span className={low ? 'text-amber-600 font-medium' : ''}>{v.stock_qty}</span>
                  {v.reserved_qty ? <Text type="secondary" className="text-xs"> (จอง {v.reserved_qty})</Text> : null}
                </span>
              );
            },
          },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 90,
            fixed: 'right',
            render: (_, v) => (
              <Space size={2}>
                <Tooltip title="แก้ไข">
                  <Button size="small" type="text" icon={<RiPencilLine className="w-4 h-4" />} onClick={() => setEditing(v)} />
                </Tooltip>
                <Popconfirm title="ลบขนาดนี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void del(v.id)}>
                  <Button size="small" type="text" danger icon={<RiDeleteBinLine className="w-4 h-4" />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {editing ? (
        <VariantFormModal
          productId={product.id}
          variant={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}
    </Modal>
  );
}

function VariantFormModal({
  productId,
  variant,
  onClose,
  onSaved,
}: {
  productId: string;
  variant: Variant | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await upsertVariant({
        id: variant?.id,
        product_id: productId,
        size: v.size?.trim() || null,
        unit: v.unit?.trim() || 'ชิ้น',
        sku: v.sku?.trim() || null,
        barcode: v.barcode?.trim() || null,
        cost_price: v.cost_price ?? null,
        price: Number(v.price),
        stock_qty: v.stock_qty ?? 0,
        low_stock_threshold: v.low_stock_threshold ?? undefined,
      });
      await onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={variant ? 'แก้ไขขนาด' : 'เพิ่มขนาด'}
      onCancel={onClose}
      onOk={() => void submit()}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={busy}
      destroyOnHidden
      width={520}>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="mt-2"
        initialValues={{
          size: variant?.size ?? '',
          unit: variant?.unit ?? 'ชิ้น',
          sku: variant?.sku ?? '',
          barcode: variant?.barcode ?? '',
          cost_price: variant?.cost_price ?? null,
          price: variant?.price ?? null,
          stock_qty: variant?.stock_qty ?? 0,
          low_stock_threshold: variant?.low_stock_threshold ?? 5,
        }}>
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item name="size" label="ขนาด (เว้นว่าง = ปกติ)">
            <Input placeholder="เช่น 1 กก." />
          </Form.Item>
          <Form.Item name="unit" label="หน่วยนับ">
            <Input placeholder="ชิ้น / กก. / ขวด" />
          </Form.Item>
          <Form.Item name="sku" label="รหัส SKU">
            <Input placeholder="เช่น RICE-01" />
          </Form.Item>
          <Form.Item name="barcode" label="บาร์โค้ด">
            <Input placeholder="เช่น 8850000000000" />
          </Form.Item>
          <Form.Item name="cost_price" label="ต้นทุน (฿)">
            <InputNumber min={0} prefix="฿" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="ราคาขาย (฿)" rules={[{ required: true, message: 'ใส่ราคาขาย' }]}>
            <InputNumber min={1} prefix="฿" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock_qty" label="สต็อก">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="low_stock_threshold" label="แจ้งเตือนเมื่อเหลือ">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
