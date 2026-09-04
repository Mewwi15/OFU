import { RiAddLine, RiDeleteBinLine, RiImageAddLine, RiImageEditLine, RiPencilLine } from '@remixicon/react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tag, Tooltip, Typography, Upload } from 'antd';
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

const { Text } = Typography;

/**
 * ทุกช่องแบนเนอร์ในแอป จัดกลุ่มตาม "หน้าจอ" ที่ลูกค้าเห็น
 *
 * เดิมเรียงเป็นการ์ด 6 ใบหน้าตาเหมือนกันหมด แต่ละใบมีตารางลากจัดลำดับ ทั้งที่ 5 ใน 6 ช่อง
 * ใส่ได้รูปเดียว — เจ้าของบอกว่าเข้าใจยาก (4 ก.ย. 2026 "ทำระบบแบนเนอร์บน POS ใหม่
 * เอาให้เข้าใจง่าย") จัดใหม่เป็นกลุ่มตามหน้าจอ + บอกตำแหน่งเป็นภาษาคน + โชว์รูปที่ใช้อยู่
 * จริงให้เห็นเลยว่าช่องไหนมีแล้วช่องไหนยังว่าง
 */
type PlacementMeta = {
  value: BannerPlacement;
  /** หน้าจอในแอปที่ช่องนี้อยู่ — ใช้จัดกลุ่ม */
  screen: string;
  /** ชื่อช่องสั้น ๆ */
  label: string;
  /** อยู่ตรงไหนของหน้า พูดแบบที่เจ้าของนึกภาพออก */
  where: string;
  multi: boolean;
};

const PLACEMENTS: PlacementMeta[] = [
  { value: 'home', screen: 'หน้าแรก', label: 'สไลด์บนสุด', where: 'ภาพใหญ่บนสุดที่เลื่อนสไลด์ได้ เห็นทันทีที่เปิดแอป', multi: true },
  { value: 'delivery_promo', screen: 'หน้าเดลิเวอรี่', label: 'แถบใต้หมวดหมู่', where: 'ใต้แถววงกลมหมวดหมู่สินค้า เหนือแถวสินค้าขายดี — ใส่หลายรูปได้ เลื่อนสไลด์เอง', multi: true },
  { value: 'online_promo', screen: 'หน้าออนไลน์ (ส่งพัสดุ)', label: 'แถบใต้หมวดหมู่', where: 'ใต้แถววงกลมหมวดหมู่สินค้า เหนือแถวสินค้าขายดี — ใส่หลายรูปได้ เลื่อนสไลด์เอง', multi: true },
  /* หน้าสินค้าไม่ได้อยู่ในแถบล่างแล้วตั้งแต่ 4 ก.ย. 2026 (เปลี่ยนเป็นแท็บคูปอง) แต่หน้า
     ยังอยู่และยังเข้าได้ — บอกทางเข้าไว้ด้วย ไม่งั้นเจ้าของจะหาไม่เจอว่ารูปไปโผล่ตรงไหน */
  { value: 'search_hero', screen: 'หน้าสินค้า (กดหมวดหมู่จากหน้าแรก)', label: 'แบนเนอร์บนสุด', where: 'ภาพใหญ่บนสุดของหน้า เหนือช่องค้นหา', multi: false },
  { value: 'search_trending', screen: 'หน้าสินค้า (กดหมวดหมู่จากหน้าแรก)', label: 'แถบเหนือแถว “สินค้าติดกระแส”', where: 'แถบยาวคั่นก่อนแถวสินค้าแถวแรก ตั้งหัวข้อเองได้', multi: false },
  { value: 'search_promo', screen: 'หน้าสินค้า (กดหมวดหมู่จากหน้าแรก)', label: 'แถบเหนือแถว “โปรโมชั่น”', where: 'แถบยาวคั่นก่อนแถวสินค้าแถวที่สอง ตั้งหัวข้อเองได้', multi: false },
  { value: 'search_hot', screen: 'หน้าสินค้า (กดหมวดหมู่จากหน้าแรก)', label: 'แถบเหนือแถว “มาแรงประจำสัปดาห์”', where: 'แถบยาวคั่นก่อนแถวสินค้าแถวที่สาม ตั้งหัวข้อเองได้', multi: false },
];

/** ลำดับหน้าจอที่จะแสดง — เรียงตามที่ลูกค้าเจอจริงในแอป ไม่ใช่ตามชื่อตัวแปร */
const SCREENS = [...new Set(PLACEMENTS.map((p) => p.screen))];

/**
 * Crop aspect (width ÷ height) per placement — MUST match the app's render
 * ratios (my-rn-app/lib/data/catalog.ts → BANNER_ASPECT) so the crop preview
 * equals what shows in the app. Keep the two maps in sync.
 */
const BANNER_ASPECT: Record<BannerPlacement, number> = {
  home: 1.55,   // ต้องตรงกับ lib/data/catalog.ts เสมอ (แก้ 3 ก.ย. 2026)
  search_hero: 2.35,
  search_trending: 2.8,
  search_promo: 2.8,
  search_hot: 2.8,
  delivery_promo: 2,
  online_promo: 2,
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
    // mount-only fetch; load isn't memoized so listing it would refetch every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <img src={b.image_path} alt="" className="w-24 h-12 object-cover rounded-none border border-[#E8E8E8]" />
        ) : (
          <div className="w-24 h-12 rounded-none bg-[#F5F5F5] grid place-items-center text-gray-300">
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
          <Button size="small" color="orange" variant="solid" icon={<RiPencilLine className="w-[15px] h-[15px]" />} onClick={() => setEditing(b)}>
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

  /* ช่องที่ใส่ได้รูปเดียว = การ์ดเดียวจบ ไม่ต้องมีตารางลากจัดลำดับให้รก
     โชว์รูปที่ใช้อยู่จริงขนาดพอเห็น + สถานะ + ปุ่มเดียวที่ต้องกด */
  const SingleSlot = ({ pm }: { pm: PlacementMeta }) => {
    const rows = banners.filter((b) => b.placement === pm.value);
    // เรียงตามลำดับที่แอปหยิบไปใช้ (ตัวแรกที่เปิดแสดง) — จะได้โชว์ใบที่ลูกค้าเห็นจริง
    const live = rows.find((b) => b.publish_state === 'published') ?? rows[0] ?? null;
    const extra = rows.length - (live ? 1 : 0);
    const aspect = BANNER_ASPECT[pm.value];

    return (
      <Card size="small" styles={{ body: { padding: 14 } }} className="mb-3">
        <div className="flex gap-4 items-start">
          {/* กรอบรูปตามสัดส่วนจริงที่แอปแสดง — เห็นทรงถูกตั้งแต่ยังไม่อัป */}
          <div
            className="shrink-0 rounded-none border border-[#E8E8E8] overflow-hidden bg-[#FAFAFA] grid place-items-center"
            style={{ width: 132, height: Math.round(132 / aspect) }}>
            {live?.image_path ? (
              <img src={live.image_path} alt="" className="w-full h-full object-cover" />
            ) : (
              <RiImageAddLine className="w-6 h-6 text-gray-300" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#2B2320]">{pm.label}</span>
              {!live ? (
                <Tag color="default">ยังไม่มีรูป</Tag>
              ) : live.publish_state === 'published' ? (
                <Tag color="success" variant="filled">แสดงอยู่</Tag>
              ) : (
                <Tag color="warning" variant="filled">ซ่อนอยู่</Tag>
              )}
              <Tag color="processing">{ratioLabel(aspect)}</Tag>
            </div>
            <div className="text-xs text-gray-500 mt-1">{pm.where}</div>
            {live?.headline ? (
              <div className="text-xs text-gray-400 mt-1">หัวข้อ: {live.headline}</div>
            ) : null}
            {/* รูปส่วนเกินต้องเข้าถึงได้ ไม่ใช่แค่เตือนว่ามี — การ์ดโชว์ใบที่แอปใช้จริง
                ใบเดียว ถ้าไม่ลิสต์ส่วนเกินไว้ตรงนี้ มันจะกลายเป็นรูปที่ลบไม่ได้เลย
                (ของเดิมเป็นตารางจึงเห็นครบทุกใบอยู่แล้ว) */}
            {extra > 0 ? (
              <div className="mt-2">
                <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2">
                  ช่องนี้ใช้รูปเดียว — อีก {extra} รูปด้านล่างยังไม่ถูกใช้ ลบทิ้งได้เพื่อไม่ให้สับสน
                </div>
                {rows
                  .filter((b) => b.id !== live?.id)
                  .map((b) => (
                    <div key={b.id} className="flex items-center gap-2 mt-2">
                      {b.image_path ? (
                        <img src={b.image_path} alt="" className="w-16 h-8 object-cover border border-[#E8E8E8]" />
                      ) : (
                        <div className="w-16 h-8 bg-[#F5F5F5] grid place-items-center text-gray-300">
                          <RiImageAddLine className="w-4 h-4" />
                        </div>
                      )}
                      <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">
                        {b.headline || 'ไม่มีหัวข้อ'}
                      </span>
                      <Button size="small" onClick={() => setEditing(b)}>
                        แก้ไข
                      </Button>
                      <Popconfirm title="ลบแบนเนอร์นี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onDelete(b)}>
                        <Button size="small" danger icon={<RiDeleteBinLine className="w-[15px] h-[15px]" />} />
                      </Popconfirm>
                    </div>
                  ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {live ? (
                <>
                  <Switch
                    checked={live.publish_state === 'published'}
                    onChange={(v) => void togglePublish(live, v)}
                    checkedChildren="แสดง"
                    unCheckedChildren="ซ่อน"
                  />
                  <Button size="small" color="orange" variant="solid" icon={<RiPencilLine className="w-[15px] h-[15px]" />} onClick={() => setEditing(live)}>
                    เปลี่ยนรูป / แก้ไข
                  </Button>
                  <Popconfirm title="ลบแบนเนอร์นี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onDelete(live)}>
                    <Tooltip title="ลบ">
                      <Button size="small" danger icon={<RiDeleteBinLine className="w-[15px] h-[15px]" />} />
                    </Tooltip>
                  </Popconfirm>
                </>
              ) : (
                <Button size="small" type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setAdding(pm.value)}>
                  อัปโหลดรูป
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  /* ช่องเดียวที่ใส่ได้หลายรูป (สไลด์หน้าแรก) — ที่นี่เท่านั้นที่ต้องมีตารางลากจัดลำดับ */
  const MultiSlot = ({ pm }: { pm: PlacementMeta }) => {
    const rows = banners.filter((b) => b.placement === pm.value);
    const pub = rows.filter((b) => b.publish_state === 'published').length;
    return (
      <Card size="small" styles={{ body: { padding: 14 } }} className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#2B2320]">{pm.label}</span>
              <Tag color={pub > 0 ? 'success' : 'default'} variant={pub > 0 ? 'filled' : undefined}>
                {pub > 0 ? `แสดงอยู่ ${pub} รูป` : 'ยังไม่มีรูปที่แสดง'}
              </Tag>
              <Tag color="processing">{ratioLabel(BANNER_ASPECT[pm.value])}</Tag>
            </div>
            <div className="text-xs text-gray-500 mt-1">{pm.where} · ลากสลับลำดับได้</div>
          </div>
          <Button size="small" type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setAdding(pm.value)}>
            เพิ่มรูป
          </Button>
        </div>

        <DndTable<Banner>
          items={rows}
          onReorder={(next) => void onReorder(pm.value, next)}
          loading={loading}
          scroll={{ x: 520 }}
          columns={columns}
          locale={{ emptyText: 'ยังไม่มีรูปในช่องนี้' }}
        />
      </Card>
    );
  };

  return (
    <>
      <div className="mb-4">
        <Text type="secondary">
          ทุกช่องแบนเนอร์ในแอปอยู่ที่นี่ — เรียงตามหน้าจอที่ลูกค้าเห็น อัปรูปแล้วระบบครอปให้ตรงกับที่แอปแสดงจริง
        </Text>
      </div>

      {SCREENS.map((screen) => (
        <div key={screen} className="mb-6">
          <div className="text-sm font-semibold text-[#2B2320] mb-2">{screen}</div>
          {PLACEMENTS.filter((p) => p.screen === screen).map((pm) =>
            pm.multi ? <MultiSlot key={pm.value} pm={pm} /> : <SingleSlot key={pm.value} pm={pm} />,
          )}
        </div>
      ))}

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
                <img src={image} alt="" className="w-full object-cover rounded-none border border-[#E8E8E8]" style={{ aspectRatio: String(aspect) }} />
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
                <button type="button" className="w-full h-28 rounded-none border border-dashed border-[#D9D9D9] grid place-items-center text-gray-400 hover:border-tremor-brand hover:text-tremor-brand transition">
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
