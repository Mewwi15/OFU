/**
 * MemberRewards — ของรางวัลสมาชิก + ปิดงานแลกของ
 *
 * เจ้าของสั่ง 5 ก.ย. 2026 ให้ทำสามข้อที่ทำให้ระบบสมาชิกยังใช้จริงไม่ได้ หน้านี้ทำสองข้อ:
 *   1. สร้าง/แก้ของรางวัล — ก่อนหน้านี้ไม่มีทางเพิ่มเลย รายการในแอปจึงว่างตลอด
 *   2. แคชเชียร์กดยืนยันว่าจ่ายของแล้ว — ก่อนหน้านี้โค้ดค้างเป็น "รอรับ" ตลอดไป
 *
 * ★ ช่องกรอกโค้ดอยู่บนสุด ★ เป็นสิ่งที่ถูกใช้บ่อยที่สุดในหน้านี้ (ลูกค้ายืนรออยู่หน้า
 * เคาน์เตอร์) ส่วนการเพิ่มของรางวัลทำนาน ๆ ครั้ง จึงอยู่ล่างลงไป
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
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useState } from 'react';

import {
  collectRedemption,
  deleteMemberReward,
  findRedemption,
  listMemberRewards,
  storageUrl,
  upsertMemberReward,
  uploadRewardImage,
  type MemberReward,
  type RedemptionLookup,
} from '../lib/api';

const { Text, Title } = Typography;

/* ── ปิดงานแลกของ ─────────────────────────────────────────────────────────── */
function CollectPanel() {
  const { message } = App.useApp();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<RedemptionLookup | null>(null);
  const [busy, setBusy] = useState(false);

  const look = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    setBusy(true);
    try {
      setFound(await findRedemption(c));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await collectRedemption(code.trim());
      if (res.ok) {
        message.success(`จ่าย "${res.reward_name}" แล้ว`);
        setCode('');
        setFound(null);
      } else {
        message.error(res.message_th || 'ยืนยันไม่สำเร็จ');
        await look(code);
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pending = found?.ok && found.status === 'pending';

  return (
    <Card title="ลูกค้ามารับของรางวัล" style={{ marginBottom: 16 }}>
      <Text type="secondary">
        ให้ลูกค้าเปิดหน้า OFU MEMBER แล้วอ่านโค้ดให้ฟัง หรือพิมพ์โค้ดที่ลูกค้ายื่นมา
      </Text>
      <Space.Compact style={{ width: '100%', marginTop: 12 }}>
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setFound(null);
          }}
          onPressEnter={() => void look(code)}
          placeholder="เช่น RABCDEF"
          size="large"
          autoFocus
          allowClear
        />
        <Button size="large" onClick={() => void look(code)} loading={busy}>
          ค้นหา
        </Button>
      </Space.Compact>

      {found && !found.ok ? (
        <Text type="danger" style={{ display: 'block', marginTop: 12 }}>
          {found.message_th}
        </Text>
      ) : null}

      {found?.ok ? (
        <div style={{ marginTop: 16, padding: 16, background: '#f7f5f3', borderRadius: 12 }}>
          <Title level={4} style={{ margin: 0 }}>
            {found.reward_name}
          </Title>
          <Text type="secondary">
            {found.customer_name ?? 'ลูกค้า'} · ใช้ {found.points_cost} แต้ม
          </Text>
          <div style={{ marginTop: 12 }}>
            {found.status === 'pending' ? (
              <Tag color="blue">รอรับของ</Tag>
            ) : found.status === 'collected' ? (
              <Tag color="green">รับไปแล้ว</Tag>
            ) : (
              <Tag>ยกเลิกแล้ว</Tag>
            )}
          </div>
          {/* ★ ปุ่มยืนยันขึ้นเฉพาะใบที่ยังไม่ได้รับ ★ ใบที่ปิดไปแล้วต้องกดไม่ได้ ไม่ใช่กดแล้ว
              ค่อยขึ้น error — ลูกค้ายืนรออยู่ แคชเชียร์ต้องเห็นในแวบเดียวว่าจ่ายได้หรือไม่ */}
          <Button
            type="primary"
            size="large"
            block
            style={{ marginTop: 12 }}
            disabled={!pending}
            loading={busy}
            onClick={() => void confirm()}>
            {pending ? 'ยืนยันว่าจ่ายของแล้ว' : 'ปิดงานไปแล้ว'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/* ── ของรางวัล ────────────────────────────────────────────────────────────── */
export function MemberRewards() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<MemberReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MemberReward | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listMemberRewards());
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

  const remove = (row: MemberReward) =>
    modal.confirm({
      title: `ลบ "${row.name}"`,
      content: 'ลบได้เฉพาะของที่ยังไม่มีใครแลก — ถ้ามีคนแลกไปแล้วให้ปิดการแสดงแทน',
      okText: 'ลบ',
      okButtonProps: { danger: true },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          await deleteMemberReward(row.id);
          message.success('ลบแล้ว');
          await load();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });

  const togglePublish = async (row: MemberReward, on: boolean) => {
    try {
      await upsertMemberReward({
        id: row.id,
        name: row.name,
        description: row.description,
        image_path: row.image_path,
        points_cost: row.points_cost,
        stock: row.stock,
        display_order: row.display_order,
        publish_state: on ? 'published' : 'draft',
      });
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <>
      <CollectPanel />

      <Card
        title="ของรางวัลสมาชิก"
        extra={
          <Button
            type="primary"
            icon={<RiAddLine size={16} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}>
            เพิ่มของรางวัล
          </Button>
        }>
        <Text type="secondary">
          ลูกค้าสะสมแต้มจากการซื้อ (100 บาท = 1 แต้ม) แล้วเอามาแลกของที่นี่ ·
          ของที่ยังไม่กด “แสดงในแอป” ลูกค้าจะไม่เห็น
        </Text>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          style={{ marginTop: 16 }}
          pagination={false}
          columns={[
            {
              title: 'ของรางวัล',
              dataIndex: 'name',
              render: (_: unknown, r: MemberReward) => {
                const img = storageUrl('product-images', r.image_path);
                return (
                  <Space>
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: '#f0efed',
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.name}</div>
                      {r.description ? <Text type="secondary">{r.description}</Text> : null}
                    </div>
                  </Space>
                );
              },
            },
            {
              title: 'แต้มที่ใช้',
              dataIndex: 'points_cost',
              width: 110,
              render: (v: number) => `${v.toLocaleString('th-TH')} แต้ม`,
            },
            {
              title: 'จำนวนคงเหลือ',
              dataIndex: 'stock',
              width: 130,
              render: (v: number | null) =>
                v == null ? <Text type="secondary">ไม่จำกัด</Text> : v,
            },
            { title: 'ลำดับ', dataIndex: 'display_order', width: 80 },
            {
              title: 'แสดงในแอป',
              dataIndex: 'publish_state',
              width: 120,
              render: (v: string, r: MemberReward) => (
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
              render: (_: unknown, r: MemberReward) => (
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
      </Card>

      {open && (
        <EditModal
          key={editing?.id ?? 'new'}
          reward={editing}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function EditModal({
  reward,
  onClose,
  onSaved,
}: {
  reward: MemberReward | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [imagePath, setImagePath] = useState(reward?.image_path ?? '');
  const [uploading, setUploading] = useState(false);

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      setImagePath(await uploadRewardImage(file));
      message.success('อัปรูปแล้ว');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setUploading(false);
    }
    return false; // จัดการอัปเอง ไม่ให้ antd ยิงต่อ
  };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await upsertMemberReward({
        id: reward?.id,
        name: v.name,
        description: v.description || null,
        image_path: imagePath || null,
        points_cost: v.points_cost,
        /* เว้นว่าง = ไม่จำกัดจำนวน ไม่ใช่ศูนย์ — ศูนย์แปลว่าหมดแล้ว คนละความหมาย */
        stock: v.stock ?? null,
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

  const imageUrl = storageUrl('product-images', imagePath || null);

  return (
    <Modal
      open
      title={reward ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัล'}
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
          name: reward?.name ?? '',
          description: reward?.description ?? '',
          points_cost: reward?.points_cost ?? 100,
          stock: reward?.stock ?? undefined,
          display_order: reward?.display_order ?? 0,
          publish_state: reward?.publish_state === 'published',
        }}>
        <Form.Item name="name" label="ชื่อของรางวัล" rules={[{ required: true, message: 'กรอกชื่อ' }]}>
          <Input placeholder="เช่น เสื้อยืดอู้ฟู่" maxLength={60} showCount />
        </Form.Item>

        <Form.Item name="description" label="คำอธิบาย (ไม่บังคับ)">
          <Input placeholder="เช่น ไซซ์ฟรี สีขาว" maxLength={80} showCount />
        </Form.Item>

        <Form.Item label="รูป (ไม่บังคับ)">
          <Upload beforeUpload={pickImage} maxCount={1} accept="image/*" showUploadList={false}>
            <Button loading={uploading}>{imagePath ? 'เปลี่ยนรูป' : 'เลือกรูป'}</Button>
          </Upload>
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              style={{ display: 'block', marginTop: 8, width: 96, borderRadius: 8 }}
            />
          )}
        </Form.Item>

        <Form.Item
          name="points_cost"
          label="ใช้กี่แต้ม"
          rules={[
            { required: true, message: 'กรอกจำนวนแต้ม' },
            { type: 'number', min: 1, message: 'ต้องมากกว่า 0' },
          ]}
          extra="100 บาท = 1 แต้ม · เช่น 50 แต้ม = ลูกค้าต้องซื้อครบ 5,000 บาท">
          <InputNumber min={1} style={{ width: '100%' }} addonAfter="แต้ม" />
        </Form.Item>

        <Form.Item name="stock" label="จำนวนที่มี" extra="เว้นว่าง = ไม่จำกัด">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="ไม่จำกัด" />
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
