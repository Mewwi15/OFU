import { RiAddLine, RiDeleteBinLine, RiImageAddLine, RiImageEditLine, RiPencilLine } from '@remixicon/react';
import { App, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tag, Tooltip, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ImgCrop from 'antd-img-crop';
import { useEffect, useState, type ReactNode } from 'react';

import { DndTable, DragHandle } from '../components/DndTable';
import {
  apiError,
  deleteBanner,
  listBanners,
  reorderBanners,
  upsertBanner,
  uploadBannerImage,
  type Banner,
  type BannerPlacement,
} from '../lib/api';

const { Title, Text } = Typography;

type PlacementMeta = { value: BannerPlacement; label: string; hint: string; multi: boolean };
const PLACEMENTS: PlacementMeta[] = [
  { value: 'home', label: 'หน้าแรก · สไลด์บนสุด', hint: 'สไลด์บนสุดของหน้าแรก — ใส่ได้หลายรูป ลากจัดลำดับได้', multi: true },
  { value: 'search_hero', label: 'หน้าค้นหา · แบนเนอร์บนสุด', hint: 'แบนเนอร์ใหญ่บนสุดของหน้าค้นหา (รูปเสือ OFU) — ใช้รูปเดียว', multi: false },
  { value: 'search_trending', label: 'หน้าค้นหา · แถบ “กำลังมาแรง”', hint: 'แถบเหนือแถว “สินค้าติดกระแส” — ตั้งรูป + หัวข้อได้ (ใช้รูปเดียว)', multi: false },
  { value: 'search_promo', label: 'หน้าค้นหา · แถบ “ลดสูงสุด 40%”', hint: 'แถบเหนือแถว “โปรโมชั่น” — ตั้งรูป + หัวข้อได้ (ใช้รูปเดียว)', multi: false },
  { value: 'search_hot', label: 'หน้าค้นหา · แถบ “เรตติ้งสูงสุด”', hint: 'แถบเหนือแถว “มาแรงประจำสัปดาห์” — ตั้งรูป + หัวข้อได้ (ใช้รูปเดียว)', multi: false },
];

/**
 * Crop aspect (width ÷ height) per placement — MUST match the app's render
 * ratios (my-rn-app/lib/data/catalog.ts → BANNER_ASPECT) so the crop preview
 * equals what shows in the app. Keep the two maps in sync.
 */
const BANNER_ASPECT: Record<BannerPlacement, number> = {
  home: 2,
  search_hero: 2.35,
  search_trending: 2.8,
  search_promo: 2.8,
  search_hot: 2.8,
};
/** Human label for a ratio, e.g. 2 → "2 : 1", 2.35 → "2.35 : 1". */
const ratioLabel = (a: number) => `${Number.isInteger(a) ? a : a.toFixed(2)} : 1`;

export function Banners() {
  const { message } = App.useApp();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [adding, setAdding] = useState<BannerPlacement | null>(null);

  async function load() {
    setLoading(true);
    try {
      setBanners(await listBanners());
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onReorder(placement: BannerPlacement, next: Banner[]) {
    setBanners((cur) => [...cur.filter((b) => b.placement !== placement), ...next]);
    try {
      await reorderBanners(next.map((b) => b.id));
    } catch (e) {
      message.error(apiError(e));
      void load();
    }
  }
  async function togglePublish(b: Banner, published: boolean) {
    try {
      await upsertBanner({ id: b.id, publish_state: published ? 'published' : 'draft' });
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }
  async function onDelete(b: Banner) {
    try {
      await deleteBanner(b.id);
      message.success('ลบแบนเนอร์แล้ว');
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }

  const columns: ColumnsType<Banner> = [
    { title: '', key: 'drag', width: 44, render: () => <DragHandle /> },
    {
      title: 'รูป',
      key: 'img',
      width: 120,
      render: (_, b) =>
        b.image_path ? (
          <img src={b.image_path} alt="" className="w-24 h-12 object-cover rounded-md border border-[#F0EAE6]" />
        ) : (
          <div className="w-24 h-12 rounded-md bg-[#F6ECE5] grid place-items-center text-gray-300">
            <RiImageAddLine className="w-5 h-5" />
          </div>
        ),
    },
    { title: 'หัวข้อ', key: 'headline', render: (_, b) => b.headline || <Text type="secondary">— ไม่มีหัวข้อ —</Text> },
    {
      title: 'แสดงในแอป',
      key: 'publish',
      width: 110,
      align: 'center',
      render: (_, b) => (
        <Switch
          checked={b.publish_state === 'published'}
          onChange={(v) => void togglePublish(b, v)}
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
      render: (_, b) => (
        <Space size={6}>
          <Button size="small" icon={<RiPencilLine className="w-[15px] h-[15px]" />} onClick={() => setEditing(b)}>
            แก้ไข
          </Button>
          <Popconfirm title="ลบแบนเนอร์นี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onDelete(b)}>
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
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          แบนเนอร์
        </Title>
        <Text type="secondary">จัดการแบนเนอร์ทุกจุดในแอปจากที่เดียว — แยกตามตำแหน่งที่แสดง</Text>
      </div>

      {PLACEMENTS.map((pm) => {
        const rows = banners.filter((b) => b.placement === pm.value);
        const pubCount = rows.filter((b) => b.publish_state === 'published').length;
        return (
          <Card key={pm.value} size="small" styles={{ body: { padding: 16 } }} className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#2B2320]">{pm.label}</span>
                  {rows.length > 0 && (
                    <Tag color="processing" variant="filled">
                      {rows.length} รูป
                    </Tag>
                  )}
                </div>
                <div className="text-xs text-gray-400">{pm.hint}</div>
              </div>
              <Button size="small" type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setAdding(pm.value)}>
                เพิ่มแบนเนอร์
              </Button>
            </div>

            {!pm.multi && pubCount > 1 && (
              <div className="mb-2 rounded-lg bg-amber-50 text-amber-700 text-xs px-3 py-2">
                ตำแหน่งนี้ใช้รูปเดียว — แอปจะแสดงรูปที่เปิดไว้เป็นอันแรก
              </div>
            )}

            {rows.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-gray-400 text-sm">ยังไม่มีแบนเนอร์ในจุดนี้</span>}
                style={{ margin: '12px 0' }}
              />
            ) : (
              <DndTable<Banner>
                items={rows}
                onReorder={(next) => void onReorder(pm.value, next)}
                loading={loading}
                scroll={{ x: 520 }}
                columns={columns}
              />
            )}
          </Card>
        );
      })}

      {editing || adding ? (
        <BannerModal
          banner={editing}
          defaultPlacement={adding ?? editing?.placement ?? 'home'}
          defaultOrder={banners.filter((b) => b.placement === (adding ?? editing?.placement)).length}
          onClose={() => {
            setEditing(null);
            setAdding(null);
          }}
          onSaved={() => {
            setEditing(null);
            setAdding(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function BannerModal({
  banner,
  defaultPlacement,
  defaultOrder,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  defaultPlacement: BannerPlacement;
  defaultOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(banner?.image_path ?? null);
  // Crop aspect follows the selected placement so the crop matches the app.
  const placement = (Form.useWatch('placement', form) as BannerPlacement | undefined) ?? banner?.placement ?? defaultPlacement;
  const aspect = BANNER_ASPECT[placement] ?? 2;

  const submit = async () => {
    const v = await form.validateFields();
    if (!image) {
      message.error('กรุณาอัปโหลดรูปแบนเนอร์ก่อนบันทึก');
      return;
    }
    setBusy(true);
    try {
      await upsertBanner({
        id: banner?.id,
        image_path: image,
        headline: v.headline?.trim() || null,
        cta_label: v.cta_label?.trim() || null,
        cta_url: v.cta_url?.trim() || null,
        placement: v.placement,
        display_order: banner?.display_order ?? defaultOrder,
        // New banners show immediately (owner expects an added banner to appear).
        publish_state: banner?.publish_state ?? 'published',
      });
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal open title={banner ? 'แก้ไขแบนเนอร์' : 'เพิ่มแบนเนอร์'} onCancel={onClose} onOk={() => void submit()} okText="บันทึก" cancelText="ยกเลิก" confirmLoading={busy} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="mt-2"
        initialValues={{
          headline: banner?.headline ?? '',
          cta_label: banner?.cta_label ?? '',
          cta_url: banner?.cta_url ?? '',
          placement: banner?.placement ?? defaultPlacement,
        }}>
        <Form.Item name="placement" label="ตำแหน่งที่แสดง">
          <Select options={PLACEMENTS.map((p) => ({ value: p.value, label: p.label }))} />
        </Form.Item>
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-[#4b443f]">รูปแบนเนอร์</span>
            <span className="text-xs text-gray-400">ครอบตัดสัดส่วน {ratioLabel(aspect)} (ตรงกับที่แสดงในแอป) · วางเนื้อหาสำคัญไว้กลาง</span>
          </div>
          {/* One uploader (crop → upload → replace state) reused for the empty
              slot and the "เปลี่ยนรูป" action over an existing image. */}
          {(() => {
            const uploader = (trigger: ReactNode) => (
              <ImgCrop
                aspect={aspect}
                showGrid
                rotationSlider
                modalTitle={`ครอบตัดรูปแบนเนอร์ (${ratioLabel(aspect)})`}
                modalOk="ใช้รูปนี้"
                modalCancel="ยกเลิก">
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  customRequest={async ({ file, onSuccess, onError }) => {
                    try {
                      setImage(await uploadBannerImage(file as File));
                      message.success('เปลี่ยนรูปแล้ว');
                      onSuccess?.({});
                    } catch (e) {
                      message.error(apiError(e));
                      onError?.(e as Error);
                    }
                  }}>
                  {trigger}
                </Upload>
              </ImgCrop>
            );
            return image ? (
              <div className="relative w-full">
                <img src={image} alt="" className="w-full object-cover rounded-lg border border-[#F0EAE6]" style={{ aspectRatio: String(aspect) }} />
                <div className="absolute top-2 right-2 flex gap-2">
                  {uploader(
                    <Button size="small" icon={<RiImageEditLine className="w-[15px] h-[15px]" />}>
                      เปลี่ยนรูป
                    </Button>,
                  )}
                  <Button size="small" danger icon={<RiDeleteBinLine className="w-[15px] h-[15px]" />} onClick={() => setImage(null)}>
                    ลบรูป
                  </Button>
                </div>
              </div>
            ) : (
              uploader(
                <button type="button" className="w-full h-28 rounded-lg border border-dashed border-[#D9CFC8] grid place-items-center text-gray-400 hover:border-tremor-brand hover:text-tremor-brand transition">
                  <div className="text-center">
                    <RiImageAddLine className="w-7 h-7 mx-auto" />
                    <div className="text-xs mt-1">เลือกรูป แล้วครอบตัด {ratioLabel(aspect)}</div>
                  </div>
                </button>,
              )
            );
          })()}
        </div>
        <Form.Item name="headline" label="หัวข้อ (ถ้ามี)">
          <Input placeholder="เช่น ลดราคาต้อนรับเปิดร้าน" />
        </Form.Item>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="cta_label" label="ปุ่ม (ข้อความ)">
            <Input placeholder="เช่น ช้อปเลย" />
          </Form.Item>
          <Form.Item name="cta_url" label="ลิงก์ปลายทาง">
            <Input placeholder="https://…" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
