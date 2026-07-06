import { RiAddLine, RiDeleteBinLine, RiImageAddLine, RiPencilLine } from '@remixicon/react';
import { App, Button, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Switch, Tooltip, Typography, Upload } from 'antd';
import ImgCrop from 'antd-img-crop';
import { useEffect, useMemo, useState } from 'react';

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
  { value: 'home', label: 'หน้าแรก (สไลด์)', hint: 'สไลด์บนสุดของหน้าแรก — ใส่ได้หลายรูป ลากจัดลำดับได้', multi: true },
  { value: 'search_hero', label: 'ค้นหา · บนสุด', hint: 'แบนเนอร์ใหญ่บนสุดของหน้าค้นหา (ใช้รูปเดียว)', multi: false },
  { value: 'search_trending', label: 'ค้นหา · ติดกระแส', hint: 'หัวแถว “ติดกระแส” ในหน้าค้นหา (ใช้รูปเดียว)', multi: false },
  { value: 'search_promo', label: 'ค้นหา · โปรโมชั่น', hint: 'หัวแถว “โปรโมชั่น” ในหน้าค้นหา (ใช้รูปเดียว)', multi: false },
  { value: 'search_hot', label: 'ค้นหา · มาแรง', hint: 'หัวแถว “มาแรงประจำสัปดาห์” ในหน้าค้นหา (ใช้รูปเดียว)', multi: false },
];
const metaOf = (p: BannerPlacement) => PLACEMENTS.find((x) => x.value === p) ?? PLACEMENTS[0];

export function Banners() {
  const { message } = App.useApp();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [placement, setPlacement] = useState<BannerPlacement>('home');
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);

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

  const shown = useMemo(() => banners.filter((b) => b.placement === placement), [banners, placement]);
  const meta = metaOf(placement);
  const countByPlacement = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of banners) m[b.placement] = (m[b.placement] ?? 0) + 1;
    return m;
  }, [banners]);

  async function onReorder(next: Banner[]) {
    // reorder within the current placement
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            แบนเนอร์
          </Title>
          <Text type="secondary">จัดการแบนเนอร์ทุกจุดในแอป — เลือกตำแหน่ง แล้วเพิ่ม/แก้ไข/ลบ</Text>
        </div>
        <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          เพิ่มแบนเนอร์
        </Button>
      </div>

      <div className="mb-3">
        <Segmented
          value={placement}
          onChange={(v) => setPlacement(v as BannerPlacement)}
          options={PLACEMENTS.map((p) => ({
            value: p.value,
            label: countByPlacement[p.value] ? `${p.label} (${countByPlacement[p.value]})` : p.label,
          }))}
        />
        <div className="text-xs text-gray-400 mt-2">{meta.hint}</div>
      </div>

      {!meta.multi && shown.filter((b) => b.publish_state === 'published').length > 1 && (
        <div className="mb-3 rounded-lg bg-amber-50 text-amber-700 text-xs px-3 py-2">
          ตำแหน่งนี้ใช้แค่รูปเดียว — แอปจะแสดงรูปที่เปิดไว้เป็นอันแรก แนะนำให้เปิดแสดงแค่รูปเดียว
        </div>
      )}

      <DndTable<Banner>
        items={shown}
        onReorder={onReorder}
        loading={loading}
        scroll={{ x: 560 }}
        style={{ background: '#fff', borderRadius: 12 }}
        locale={{ emptyText: `ยังไม่มีแบนเนอร์ในตำแหน่ง “${meta.label}” — กด “เพิ่มแบนเนอร์”` }}
        columns={[
          { title: '', key: 'drag', width: 48, render: () => <DragHandle /> },
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
          {
            title: 'หัวข้อ',
            key: 'headline',
            render: (_, b) => b.headline || <Text type="secondary">— ไม่มีหัวข้อ —</Text>,
          },
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
        ]}
      />

      {editing ? (
        <BannerModal
          banner={editing === 'new' ? null : editing}
          defaultPlacement={placement}
          defaultOrder={shown.length}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
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
        publish_state: banner?.publish_state ?? 'draft',
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
            <span className="text-xs text-gray-400">ครอบตัดสัดส่วน 2:1 (เช่น 1600×800) · วางเนื้อหาสำคัญไว้กลาง</span>
          </div>
          {image ? (
            <div className="relative w-full">
              <img src={image} alt="" className="w-full object-cover rounded-lg border border-[#F0EAE6]" style={{ aspectRatio: '2 / 1' }} />
              <Button size="small" danger className="!absolute top-2 right-2" onClick={() => setImage(null)}>
                ลบรูป
              </Button>
            </div>
          ) : (
            <ImgCrop
              aspect={2}
              showGrid
              rotationSlider
              modalTitle="ครอบตัดรูปแบนเนอร์ (2:1)"
              modalOk="ใช้รูปนี้"
              modalCancel="ยกเลิก">
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={async ({ file, onSuccess, onError }) => {
                  try {
                    setImage(await uploadBannerImage(file as File));
                    message.success('อัปโหลดรูปแล้ว');
                    onSuccess?.({});
                  } catch (e) {
                    message.error(apiError(e));
                    onError?.(e as Error);
                  }
                }}>
                <button type="button" className="w-full h-28 rounded-lg border border-dashed border-[#D9CFC8] grid place-items-center text-gray-400 hover:border-tremor-brand hover:text-tremor-brand transition">
                  <div className="text-center">
                    <RiImageAddLine className="w-7 h-7 mx-auto" />
                    <div className="text-xs mt-1">เลือกรูป แล้วครอบตัด 2:1</div>
                  </div>
                </button>
              </Upload>
            </ImgCrop>
          )}
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
