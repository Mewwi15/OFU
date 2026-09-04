/**
 * ReviewVideos — จัดการแถบรีวิวสินค้า (วิดีโอ) ที่โผล่บนหน้าแรกของแอป
 *
 * เจ้าของสั่ง 4 ก.ย. 2026 ให้หน้าแรกมีแถบรีวิวเป็นวิดีโอใต้แบนเนอร์ และเลือกว่าจะ
 * "อัปไฟล์วิดีโอในหลังร้านเอง" หน้านี้คือที่อัป
 *
 * ★ ร่างเป็นค่าตั้งต้น ★ คลิปที่เพิ่งอัปยังไม่โผล่ในแอปจนกว่าจะกดเผยแพร่ — ร้านเปิดขาย
 * อยู่จริง คลิปที่อัปผิดไฟล์/ยังไม่ได้ตัดต่อต้องไม่หลุดไปถึงลูกค้าระหว่างทำงาน
 *
 * ภาพปกไม่บังคับแต่ควรใส่ — แถบมีหลายคลิปเรียงกันและเล่นทีละใบ ใบที่ยังไม่เล่นจะโชว์
 * ภาพปก ถ้าไม่มีจะเป็นกล่องเทาเปล่าเรียงกัน
 */

import { RiAddLine, RiDeleteBinLine, RiEditLine } from '@remixicon/react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useState } from 'react';

import {
  deleteReviewVideo,
  listProducts,
  listReviewVideos,
  storageUrl,
  upsertReviewVideo,
  uploadReviewPoster,
  uploadReviewVideo,
  type Product,
  type ReviewVideo,
} from '../lib/api';

const { Text } = Typography;

/** ต้องตรงกับเพดานที่ผูกไว้กับบักเก็ตใน 0099 — เช็คที่นี่เพื่อบอกก่อนเสียเวลาอัป */
const MAX_MB = 50;

export function ReviewVideos() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<ReviewVideo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReviewVideo | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [v, p] = await Promise.all([listReviewVideos(), listProducts()]);
      setRows(v);
      setProducts(p.filter((x) => !x.archived_at));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (row: ReviewVideo) =>
    modal.confirm({
      title: 'ลบคลิปนี้',
      content: 'ลบแล้วคลิปจะหายจากหน้าแรกทันที',
      okText: 'ลบ',
      okButtonProps: { danger: true },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        await deleteReviewVideo(row.id);
        message.success('ลบแล้ว');
        await load();
      },
    });

  /* สลับเผยแพร่จากในตารางได้เลย ไม่ต้องเปิดฟอร์ม — เป็นสิ่งที่กดบ่อยที่สุด */
  const togglePublish = async (row: ReviewVideo, on: boolean) => {
    try {
      await upsertReviewVideo({
        id: row.id,
        video_path: row.video_path,
        poster_path: row.poster_path,
        caption: row.caption,
        product_id: row.product_id,
        display_order: row.display_order,
        publish_state: on ? 'published' : 'draft',
      });
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Card
      title="แถบรีวิวสินค้า (วิดีโอ)"
      extra={
        <Button
          type="primary"
          icon={<RiAddLine size={16} />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}>
          เพิ่มคลิป
        </Button>
      }>
      <Text type="secondary">
        คลิปที่เผยแพร่จะโผล่ในแถบ “รีวิวจากลูกค้า” บนหน้าแรกของแอป เล่นเองทีละใบแบบปิดเสียง
        · ไฟล์ไม่เกิน {MAX_MB} MB ต่อคลิป · แนะนำคลิปแนวตั้งสั้น ๆ 15-30 วินาที
      </Text>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        style={{ marginTop: 16 }}
        pagination={false}
        columns={[
          {
            title: 'คลิป',
            dataIndex: 'video_path',
            render: (_: unknown, r: ReviewVideo) => {
              const poster = storageUrl('product-images', r.poster_path);
              return poster ? (
                <img
                  src={poster}
                  alt=""
                  style={{ width: 54, height: 96, objectFit: 'cover', borderRadius: 8 }}
                />
              ) : (
                <div
                  style={{
                    width: 54,
                    height: 96,
                    borderRadius: 8,
                    background: '#f0efed',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    color: '#9a938d',
                  }}>
                  ไม่มีปก
                </div>
              );
            },
          },
          {
            title: 'ข้อความใต้คลิป',
            dataIndex: 'caption',
            render: (v: string | null) => v || <Text type="secondary">—</Text>,
          },
          {
            title: 'สินค้าที่รีวิว',
            dataIndex: 'product_id',
            render: (v: string | null) =>
              v ? (
                (products.find((p) => p.id === v)?.name ?? <Tag>สินค้าถูกลบแล้ว</Tag>)
              ) : (
                <Text type="secondary">ไม่ได้ผูก</Text>
              ),
          },
          { title: 'ลำดับ', dataIndex: 'display_order', width: 80 },
          {
            title: 'แสดงในแอป',
            dataIndex: 'publish_state',
            width: 120,
            render: (v: string, r: ReviewVideo) => (
              <Switch
                checked={v === 'published'}
                checkedChildren="แสดง"
                unCheckedChildren="ร่าง"
                onChange={(on) => void togglePublish(r, on)}
              />
            ),
          },
          {
            title: '',
            width: 96,
            render: (_: unknown, r: ReviewVideo) => (
              <Space>
                <Button
                  size="small"
                  icon={<RiEditLine size={14} />}
                  onClick={() => {
                    setEditing(r);
                    setOpen(true);
                  }}
                />
                <Button
                  size="small"
                  danger
                  icon={<RiDeleteBinLine size={14} />}
                  onClick={() => remove(r)}
                />
              </Space>
            ),
          },
        ]}
      />

      {open && (
        <EditModal
          key={editing?.id ?? 'new'}
          video={editing}
          products={products}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}
    </Card>
  );
}

function EditModal({
  video,
  products,
  onClose,
  onSaved,
}: {
  video: ReviewVideo | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  /* เก็บ path ที่อัปได้ไว้ใน state ไม่ใช่ในฟอร์ม — ไฟล์ถูกอัปทันทีที่เลือก ผู้ใช้จะได้
     เห็นผลเลยว่าไฟล์ผ่านไหม ไม่ใช่ไปพังตอนกดบันทึกแล้วต้องเลือกไฟล์ใหม่ทั้งชุด */
  const [videoPath, setVideoPath] = useState(video?.video_path ?? '');
  const [posterPath, setPosterPath] = useState(video?.poster_path ?? '');
  const [uploading, setUploading] = useState(false);

  const pickVideo = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      message.error(`ไฟล์ใหญ่เกิน ${MAX_MB} MB — ลองบีบอัดหรือตัดให้สั้นลง`);
      return false;
    }
    setUploading(true);
    try {
      setVideoPath(await uploadReviewVideo(file));
      message.success('อัปคลิปแล้ว');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setUploading(false);
    }
    return false; // จัดการอัปเอง ไม่ให้ antd ยิงต่อ
  };

  const pickPoster = async (file: File) => {
    setUploading(true);
    try {
      setPosterPath(await uploadReviewPoster(file));
      message.success('อัปภาพปกแล้ว');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setUploading(false);
    }
    return false;
  };

  const save = async () => {
    const v = await form.validateFields();
    if (!videoPath) {
      message.error('ยังไม่ได้เลือกไฟล์คลิป');
      return;
    }
    setSaving(true);
    try {
      await upsertReviewVideo({
        id: video?.id,
        video_path: videoPath,
        poster_path: posterPath || null,
        caption: v.caption || null,
        product_id: v.product_id || null,
        display_order: v.display_order ?? 0,
        publish_state: v.publish_state ? 'published' : 'draft',
      });
      message.success('บันทึกแล้ว');
      await onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const videoUrl = storageUrl('review-videos', videoPath || null);
  const posterUrl = storageUrl('product-images', posterPath || null);

  return (
    <Modal
      open
      title={video ? 'แก้ไขคลิป' : 'เพิ่มคลิป'}
      onCancel={onClose}
      onOk={save}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={saving}
      okButtonProps={{ disabled: uploading }}
      destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          caption: video?.caption ?? '',
          product_id: video?.product_id ?? undefined,
          display_order: video?.display_order ?? 0,
          publish_state: video?.publish_state === 'published',
        }}>
        <Form.Item label={`ไฟล์คลิป (ไม่เกิน ${MAX_MB} MB)`} required>
          <Upload beforeUpload={pickVideo} maxCount={1} accept="video/mp4,video/quicktime,video/webm" showUploadList={false}>
            <Button loading={uploading}>{videoPath ? 'เปลี่ยนคลิป' : 'เลือกไฟล์คลิป'}</Button>
          </Upload>
          {videoUrl && (
            /* พรีวิวของจริงในหน้าแอดมิน — ไม่ต้องเดาว่าอัปถูกไฟล์ไหม */
            <video
              src={videoUrl}
              controls
              muted
              style={{ display: 'block', marginTop: 8, width: 160, borderRadius: 8 }}
            />
          )}
        </Form.Item>

        <Form.Item label="ภาพปก (ไม่บังคับ แต่ควรใส่)">
          <Upload beforeUpload={pickPoster} maxCount={1} accept="image/*" showUploadList={false}>
            <Button loading={uploading}>{posterPath ? 'เปลี่ยนภาพปก' : 'เลือกภาพปก'}</Button>
          </Upload>
          {posterUrl && (
            <img
              src={posterUrl}
              alt=""
              style={{ display: 'block', marginTop: 8, width: 90, borderRadius: 8 }}
            />
          )}
        </Form.Item>

        <Form.Item name="caption" label="ข้อความใต้คลิป">
          <Input placeholder="เช่น ลูกค้ารีวิวมาม่าโอเครไข่เค็ม" maxLength={80} showCount />
        </Form.Item>

        <Form.Item
          name="product_id"
          label="สินค้าที่รีวิว"
          extra="ผูกไว้แล้วลูกค้ากดที่คลิปจะไปหน้าสินค้าเลย · ไม่ผูกก็ได้ คลิปจะกดไม่ได้">
          <Select
            allowClear
            showSearch
            placeholder="เลือกสินค้า"
            optionFilterProp="label"
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Form.Item>

        <Form.Item name="display_order" label="ลำดับ (เลขน้อยขึ้นก่อน)">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="publish_state"
          label="แสดงในแอปลูกค้า"
          valuePropName="checked"
          extra="ปิดไว้ = เก็บเป็นร่าง ลูกค้ายังไม่เห็น">
          <Switch checkedChildren="แสดง" unCheckedChildren="ร่าง" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
