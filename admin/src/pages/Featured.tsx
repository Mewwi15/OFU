import { RiAddLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { App, Button, Checkbox, Empty, Form, Input, Modal, Popconfirm, Space, Switch, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { DndTable, DragHandle } from '../components/DndTable';
import {
  apiError,
  deleteFeaturedSection,
  getFeaturedItems,
  listFeaturedSections,
  listProducts,
  reorderFeaturedSections,
  setFeaturedItems,
  setFeaturedPublish,
  upsertFeaturedSection,
  type FeaturedSection,
  type Product,
} from '../lib/api';

const { Title, Text } = Typography;

const primaryImage = (p: Product) =>
  p.product_images.find((i) => i.is_primary)?.storage_path ?? p.product_images[0]?.storage_path ?? null;

export function Featured() {
  const { message } = App.useApp();
  const [sections, setSections] = useState<FeaturedSection[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FeaturedSection | 'new' | null>(null);
  const [picking, setPicking] = useState<FeaturedSection | null>(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await listFeaturedSections();
      setSections(rows);
      const entries = await Promise.all(
        rows.map(async (s) => [s.id, (await getFeaturedItems(s.id).catch(() => [])).length] as const),
      );
      setCounts(Object.fromEntries(entries));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onReorder(next: FeaturedSection[]) {
    setSections(next);
    try {
      await reorderFeaturedSections(next.map((s) => s.id));
    } catch (e) {
      message.error(apiError(e));
      void load();
    }
  }
  async function togglePublish(s: FeaturedSection, published: boolean) {
    setSections((cur) => cur.map((x) => (x.id === s.id ? { ...x, publish_state: published ? 'published' : 'draft' } : x)));
    try {
      await setFeaturedPublish(s.id, published);
    } catch (e) {
      message.error(apiError(e));
      void load();
    }
  }
  async function onDelete(s: FeaturedSection) {
    try {
      await deleteFeaturedSection(s.id);
      message.success('ลบแถวแล้ว');
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            จัดหน้าแอป
          </Title>
          <Text type="secondary">แถวสินค้าเด่นที่โชว์บนหน้าแรกของแอป · ลากจัดลำดับ · เปิด/ปิด · เลือกสินค้าในแต่ละแถว</Text>
        </div>
        <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          สร้างแถว
        </Button>
      </div>

      {!loading && sections.length === 0 ? (
        <Empty description="ยังไม่มีแถวสินค้าเด่น — กด “สร้างแถว” เพื่อเริ่ม" style={{ padding: 40, background: '#fff', borderRadius: 12 }} />
      ) : (
        <DndTable<FeaturedSection>
          items={sections}
          onReorder={onReorder}
          loading={loading}
          scroll={{ x: 560 }}
          style={{ background: '#fff', borderRadius: 12 }}
          columns={[
            { title: '', key: 'drag', width: 48, render: () => <DragHandle /> },
            { title: 'ชื่อแถว', key: 'title', render: (_, s) => <span className="font-medium text-[#2B2320]">{s.title}</span> },
            {
              title: 'สินค้าในแถว',
              key: 'items',
              width: 160,
              render: (_, s) => (
                <Button size="small" onClick={() => setPicking(s)}>
                  เลือกสินค้า ({counts[s.id] ?? 0})
                </Button>
              ),
            },
            {
              title: 'แสดงในแอป',
              key: 'publish',
              width: 110,
              align: 'center',
              render: (_, s) => (
                <Switch
                  checked={s.publish_state === 'published'}
                  onChange={(v) => void togglePublish(s, v)}
                  checkedChildren="แสดง"
                  unCheckedChildren="ซ่อน"
                />
              ),
            },
            {
              title: 'จัดการ',
              key: 'actions',
              width: 100,
              align: 'right',
              render: (_, s) => (
                <Space size={4}>
                  <Tooltip title="เปลี่ยนชื่อ">
                    <Button size="small" type="text" icon={<RiPencilLine className="w-[17px] h-[17px]" />} onClick={() => setEditing(s)} />
                  </Tooltip>
                  <Popconfirm title="ลบแถวนี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onDelete(s)}>
                    <Button size="small" type="text" danger icon={<RiDeleteBinLine className="w-[17px] h-[17px]" />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}

      {editing ? (
        <SectionModal
          section={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
      {picking ? (
        <ProductPicker
          section={picking}
          onClose={() => setPicking(null)}
          onSaved={() => {
            setPicking(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function SectionModal({ section, onClose, onSaved }: { section: FeaturedSection | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await upsertFeaturedSection({ id: section?.id, title: v.title.trim(), publish_state: section?.publish_state });
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };
  return (
    <Modal open title={section ? 'เปลี่ยนชื่อแถว' : 'สร้างแถวสินค้าเด่น'} onCancel={onClose} onOk={() => void submit()} okText="บันทึก" cancelText="ยกเลิก" confirmLoading={busy} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} className="mt-2" initialValues={{ title: section?.title ?? '' }}>
        <Form.Item name="title" label="ชื่อแถว" rules={[{ required: true, message: 'กรอกชื่อแถว' }]}>
          <Input placeholder="เช่น ของแนะนำประจำร้าน" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ProductPicker({ section, onClose, onSaved }: { section: FeaturedSection; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [all, current] = await Promise.all([listProducts(), getFeaturedItems(section.id)]);
        setProducts(all.filter((p) => p.publish_state === 'published'));
        setSelected(current);
      } catch (e) {
        message.error(apiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [section.id, message]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    setBusy(true);
    try {
      await setFeaturedItems(section.id, selected);
      message.success('บันทึกสินค้าในแถวแล้ว');
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`เลือกสินค้า — ${section.title}`}
      onCancel={onClose}
      onOk={() => void save()}
      okText={`บันทึก (${selected.length})`}
      cancelText="ยกเลิก"
      confirmLoading={busy}
      destroyOnHidden
      width={560}>
      <Input.Search allowClear placeholder="ค้นหาสินค้า…" onChange={(e) => setQuery(e.target.value)} className="mb-3" />
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center text-gray-400 py-8">กำลังโหลด…</div>
        ) : shown.length === 0 ? (
          <Empty description="ไม่พบสินค้า" />
        ) : (
          shown.map((p) => {
            const checked = selected.includes(p.id);
            const img = primaryImage(p);
            return (
              <div
                key={p.id}
                role="button"
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer ${checked ? 'bg-[#FBF1EC]' : 'hover:bg-gray-50'}`}>
                <Checkbox checked={checked} style={{ pointerEvents: 'none' }} />
                <div className="w-10 h-10 rounded-md overflow-hidden bg-[#F3EDE9] grid place-items-center shrink-0">
                  {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <span className="flex-1 min-w-0 truncate text-sm text-[#2B2320]">{p.name}</span>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
