import {
  RiAddLine,
  RiDeleteBinLine,
  RiImageLine,
  RiPencilLine,
  RiPriceTag3Line,
  RiShoppingBasket2Line,
} from '@remixicon/react';
import { App, Button, Card, Checkbox, Empty, Form, Input, Modal, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DndTable, DragHandle } from '../components/DndTable';
import {
  apiError,
  deleteFeaturedSection,
  getFeaturedItems,
  listBanners,
  listCategories,
  listFeaturedSections,
  listProducts,
  reorderFeaturedSections,
  setFeaturedItems,
  setFeaturedPublish,
  upsertFeaturedSection,
  type Banner,
  type Category,
  type FeaturedSection,
  type Product,
} from '../lib/api';

const { Title, Text } = Typography;

const primaryImage = (p: Product) =>
  p.product_images.find((i) => i.is_primary)?.storage_path ?? p.product_images[0]?.storage_path ?? null;

export function Featured() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const [sections, setSections] = useState<FeaturedSection[]>([]);
  const [items, setItems] = useState<Record<string, string[]>>({});
  const [banners, setBanners] = useState<Banner[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FeaturedSection | 'new' | null>(null);

  const counts = useMemo(
    () => Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.length])),
    [items],
  );
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [picking, setPicking] = useState<FeaturedSection | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rows, b, c, p] = await Promise.all([
        listFeaturedSections(),
        listBanners(),
        listCategories(),
        listProducts(),
      ]);
      setSections(rows);
      setBanners(b);
      setCats(c);
      setProducts(p);
      const entries = await Promise.all(
        rows.map(async (s) => [s.id, await getFeaturedItems(s.id).catch(() => [])] as const),
      );
      setItems(Object.fromEntries(entries));
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

  const pubBanners = banners.filter((b) => b.publish_state === 'published');
  const pubSections = sections.filter((s) => s.publish_state === 'published');

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          จัดหน้าแอป
        </Title>
        <Text type="secondary">ควบคุมทุกส่วนของหน้าแรกในแอปลูกค้า — เรียงตามลำดับที่ลูกค้าเห็นจริง</Text>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-5 lg:items-start">
        {/* ── management column ─────────────────────────────────────────────── */}
        <div>
          {/* 1 · banners */}
          <SectionCard
            index={1}
            title="แบนเนอร์"
            desc="ภาพสไลด์บนสุดของหน้าแรก"
            action={
              <Button size="small" onClick={() => nav('/banners')}>
                จัดการแบนเนอร์
              </Button>
            }>
            {pubBanners.length ? (
              <div className="flex items-center gap-2">
                <Tag color="processing" variant="filled">
                  {pubBanners.length} แบนเนอร์ที่แสดง
                </Tag>
                <div className="flex gap-1.5">
                  {pubBanners.slice(0, 4).map((b) =>
                    b.image_path ? (
                      <img key={b.id} src={b.image_path} alt="" className="w-14 h-7 rounded object-cover border border-[#F0EAE6]" />
                    ) : null,
                  )}
                </div>
              </div>
            ) : (
              <Text type="secondary" className="text-sm">
                ยังไม่มีแบนเนอร์ที่แสดง — ใช้ภาพสำรองในแอป
              </Text>
            )}
          </SectionCard>

          {/* 2 · categories */}
          <SectionCard
            index={2}
            title="หมวดหมู่ทางลัด"
            desc="ปุ่มหมวดหมู่ใต้แบนเนอร์"
            action={
              <Button size="small" onClick={() => nav('/categories')}>
                จัดการหมวดหมู่
              </Button>
            }>
            {cats.length ? (
              <div className="flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <Tag key={c.id} variant="filled">
                    {c.name}
                  </Tag>
                ))}
              </div>
            ) : (
              <Text type="secondary" className="text-sm">
                ยังไม่มีหมวดหมู่
              </Text>
            )}
          </SectionCard>

          {/* 3 · featured rows */}
          <SectionCard
            index={3}
            title="แถวสินค้าเด่น"
            desc="แถวสินค้าที่คัดมาโชว์ · ลากจัดลำดับ · เปิด/ปิด"
            action={
              <Button type="primary" size="small" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
                สร้างแถว
              </Button>
            }>
            {!loading && sections.length === 0 ? (
              <Empty description="ยังไม่มีแถวสินค้าเด่น — กด “สร้างแถว” เพื่อเริ่ม" style={{ padding: '24px 0' }} />
            ) : (
              <DndTable<FeaturedSection>
                items={sections}
                onReorder={onReorder}
                loading={loading}
                scroll={{ x: 560 }}
                columns={[
                  { title: '', key: 'drag', width: 40, render: () => <DragHandle /> },
                  { title: 'ชื่อแถว', key: 'title', render: (_, s) => <span className="font-semibold text-[#2B2320]">{s.title}</span> },
                  {
                    title: 'สินค้า',
                    key: 'items',
                    width: 150,
                    render: (_, s) => (
                      <Button size="small" onClick={() => setPicking(s)}>
                        เลือกสินค้า ({counts[s.id] ?? 0})
                      </Button>
                    ),
                  },
                  {
                    title: 'แสดง',
                    key: 'publish',
                    width: 96,
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
                    width: 130,
                    align: 'right',
                    render: (_, s) => (
                      <Space size={6}>
                        <Button size="small" icon={<RiPencilLine className="w-[15px] h-[15px]" />} onClick={() => setEditing(s)}>
                          แก้ชื่อ
                        </Button>
                        <Popconfirm title="ลบแถวนี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onDelete(s)}>
                          <Tooltip title="ลบ">
                            <Button size="small" danger icon={<RiDeleteBinLine className="w-[15px] h-[15px]" />} />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </SectionCard>
        </div>

        {/* ── phone preview ─────────────────────────────────────────────────── */}
        <HomePreview
          banner={pubBanners.find((b) => b.image_path)?.image_path ?? null}
          categories={cats.map((c) => c.name)}
          sections={pubSections.map((s) => ({
            title: s.title,
            products: (items[s.id] ?? []).map((id) => productById.get(id)).filter((p): p is Product => !!p),
          }))}
        />
      </div>

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

/** One home-section block in the management column. */
function SectionCard({
  index,
  title,
  desc,
  action,
  children,
}: {
  index: number;
  title: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card size="small" styles={{ body: { padding: 16 } }} className="mb-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-6 h-6 grid place-items-center rounded-full bg-tremor-brand-faint text-tremor-brand-emphasis text-xs font-bold shrink-0">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#2B2320] leading-tight">{title}</div>
          <div className="text-xs text-gray-400">{desc}</div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const previewImg = (p: Product) => primaryImage(p);

/** Phone-frame preview of the customer-app home, in the real section order. */
function HomePreview({
  banner,
  categories,
  sections,
}: {
  banner: string | null;
  categories: string[];
  sections: { title: string; products: Product[] }[];
}) {
  return (
    <div className="hidden lg:block sticky top-0">
      <Card size="small" styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
        <div className="px-4 py-2.5 border-b border-[#F0EAE6] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#2B2320]">ตัวอย่างหน้าแรก</span>
          <span className="text-xs text-gray-400">มุมมองในแอป</span>
        </div>
        <div className="bg-[#FBF2EC] max-h-[560px] overflow-y-auto pb-4">
          {/* banner */}
          {banner ? (
            <img src={banner} alt="" className="w-full object-cover" style={{ aspectRatio: '2 / 1' }} />
          ) : (
            <div className="w-full grid place-items-center bg-[#F3EDE9] text-gray-400" style={{ aspectRatio: '2 / 1' }}>
              <RiImageLine className="w-7 h-7" />
            </div>
          )}

          {/* categories */}
          {categories.length > 0 && (
            <div className="px-3 pt-3 flex gap-3 overflow-x-auto">
              {categories.slice(0, 6).map((c) => (
                <div key={c} className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-[#F0EAE6] grid place-items-center">
                    <RiPriceTag3Line className="w-5 h-5 text-tremor-brand" />
                  </div>
                  <span className="text-[10px] text-[#2B2320] max-w-[52px] truncate">{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* featured rows */}
          {sections.map((s) => (
            <div key={s.title} className="mt-4">
              <div className="px-3 mb-2 text-[13px] font-semibold text-[#2B2320]">{s.title}</div>
              <div className="px-3 flex gap-2 overflow-x-auto">
                {s.products.length === 0 ? (
                  <span className="text-[11px] text-gray-400">ยังไม่ได้เลือกสินค้า</span>
                ) : (
                  s.products.slice(0, 5).map((p) => (
                    <div key={p.id} className="w-20 shrink-0">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-[#F0EAE6] grid place-items-center">
                        {previewImg(p) ? (
                          <img src={previewImg(p)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <RiShoppingBasket2Line className="w-6 h-6 text-tremor-brand-subtle" />
                        )}
                      </div>
                      <div className="text-[10px] text-[#2B2320] mt-1 line-clamp-1">{p.name}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="px-3 mt-6 text-center text-[11px] text-gray-400">
              เปิดแถวสินค้าเด่นเพื่อให้แสดงตรงนี้
            </div>
          )}
        </div>
      </Card>
    </div>
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
