import { RiAddLine, RiPauseLine, RiPencilLine, RiPlayLine } from '@remixicon/react';
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth';
import {
  apiError,
  listPromoCodes,
  setPromoActive,
  upsertPromoCode,
  type PromoCode,
  type PromoScope,
  type PromoType,
} from '../lib/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SCOPE_LABEL: Record<PromoScope, string> = { subtotal: 'ยอดซื้อ', delivery: 'ค่าส่ง' };

function valueText(p: PromoCode): string {
  const base = p.type === 'percent' ? `${p.value}%` : `฿${p.value}`;
  return p.type === 'percent' && p.max_discount ? `${base} (สูงสุด ฿${p.max_discount})` : base;
}

type Status = 'active' | 'inactive' | 'expired' | 'scheduled';
function statusOf(p: PromoCode): Status {
  if (!p.active) return 'inactive';
  const now = dayjs();
  if (p.active_to && now.isAfter(dayjs(p.active_to))) return 'expired';
  if (p.active_from && now.isBefore(dayjs(p.active_from))) return 'scheduled';
  return 'active';
}
const STATUS_TAG: Record<Status, { color: string; label: string }> = {
  active: { color: 'success', label: 'ใช้งานอยู่' },
  inactive: { color: 'default', label: 'ปิดใช้งาน' },
  expired: { color: 'default', label: 'หมดอายุ' },
  scheduled: { color: 'processing', label: 'ยังไม่เริ่ม' },
};

/** โปรโมชั่น — owner-only: discount codes move real money off every order they
 * touch, so writes are gated both here (UX) and in the RPC (is_owner_of, the
 * actual security boundary — this page-level gate is just a friendlier 403). */
export function Promotions() {
  const { profile } = useAuth();
  const { message } = App.useApp();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromoCode | 'new' | null>(null);
  const isOwner = profile?.tier === 'owner';

  async function load() {
    setLoading(true);
    try {
      setPromos(await listPromoCodes());
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isOwner) void load();
    else setLoading(false);
    // mount-only fetch; load isn't memoized so listing it would refetch every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  if (!isOwner) {
    return (
      <Result
        status="403"
        title="เฉพาะเจ้าของร้าน"
        subTitle="โค้ดส่วนลดกระทบราคาที่ลูกค้าจ่ายโดยตรง จึงให้เจ้าของร้านเป็นคนตั้งค่าเท่านั้น"
      />
    );
  }

  async function onToggle(p: PromoCode) {
    try {
      await setPromoActive(p.id, !p.active);
      message.success(p.active ? 'ปิดใช้งานโค้ดแล้ว' : 'เปิดใช้งานโค้ดแล้ว');
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }

  const columns: ColumnsType<PromoCode> = [
    {
      title: 'โค้ด',
      dataIndex: 'code',
      render: (v: string) => <span className="font-mono font-semibold text-[#2B2320]">{v}</span>,
    },
    { title: 'ส่วนลด', key: 'value', render: (_, p) => valueText(p) },
    { title: 'ใช้กับ', key: 'scope', render: (_, p) => SCOPE_LABEL[p.scope] },
    {
      title: 'ยอดซื้อขั้นต่ำ',
      dataIndex: 'min_spend',
      render: (v: number) => (v > 0 ? `฿${v}` : '—'),
    },
    {
      title: 'โควตา',
      key: 'quota',
      render: (_, p) => (
        <span className="text-xs text-gray-500">
          {`ใช้แล้ว ${p.total_redeemed}${p.total_limit ? `/${p.total_limit}` : ''}${
            p.per_user_limit ? ` · คนละ ${p.per_user_limit} ครั้ง` : ''
          }`}
        </span>
      ),
    },
    {
      title: 'ช่วงเวลา',
      key: 'period',
      render: (_, p) =>
        p.active_from || p.active_to ? (
          <span className="text-xs text-gray-500">
            {p.active_from ? dayjs(p.active_from).format('D MMM') : '—'} –{' '}
            {p.active_to ? dayjs(p.active_to).format('D MMM') : '—'}
          </span>
        ) : (
          <Text type="secondary" className="text-xs">
            ไม่จำกัดเวลา
          </Text>
        ),
    },
    {
      title: 'สถานะ',
      key: 'status',
      render: (_, p) => {
        const s = STATUS_TAG[statusOf(p)];
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'จัดการ',
      key: 'actions',
      align: 'right',
      render: (_, p) => (
        <Space size={6}>
          <Button size="small" icon={<RiPencilLine className="w-[15px] h-[15px]" />} onClick={() => setEditing(p)}>
            แก้ไข
          </Button>
          <Popconfirm
            title={p.active ? 'ปิดใช้งานโค้ดนี้?' : 'เปิดใช้งานโค้ดนี้?'}
            okText={p.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            cancelText="ยกเลิก"
            onConfirm={() => void onToggle(p)}>
            <Button
              size="small"
              danger={p.active}
              icon={
                p.active ? (
                  <RiPauseLine className="w-[15px] h-[15px]" />
                ) : (
                  <RiPlayLine className="w-[15px] h-[15px]" />
                )
              }
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            โปรโมชั่น
          </Title>
          <Text type="secondary">โค้ดส่วนลดที่ลูกค้าใช้ตอนสั่งซื้อออนไลน์ · ทั้งหมด {promos.length} โค้ด</Text>
        </div>
        <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          เพิ่มโค้ดส่วนลด
        </Button>
      </div>

      <Table<PromoCode>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={promos}
        pagination={false}
        scroll={{ x: 900 }}
        style={{ background: '#fff', borderRadius: 0 }}
        locale={{ emptyText: 'ยังไม่มีโค้ดส่วนลด — กด "เพิ่มโค้ดส่วนลด" เพื่อเริ่ม' }}
      />

      {editing ? (
        <PromoModal
          promo={editing === 'new' ? null : editing}
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

function PromoModal({
  promo,
  onClose,
  onSaved,
}: {
  promo: PromoCode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const type = Form.useWatch('type', form) as PromoType | undefined;

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const period = (v.period as [Dayjs | null, Dayjs | null] | undefined) ?? [null, null];
      const [from, to] = period;
      await upsertPromoCode({
        id: promo?.id,
        code: (v.code as string).trim().toUpperCase(),
        type: v.type,
        value: v.value,
        max_discount: v.type === 'percent' ? (v.max_discount ?? null) : null,
        min_spend: v.min_spend ?? 0,
        scope: v.scope,
        active_from: from ? from.startOf('day').toISOString() : null,
        active_to: to ? to.endOf('day').toISOString() : null,
        total_limit: v.total_limit ?? null,
        per_user_limit: v.per_user_limit ?? null,
        active: v.active,
      });
      message.success(promo ? 'บันทึกโค้ดส่วนลดแล้ว' : 'เพิ่มโค้ดส่วนลดแล้ว');
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      width={560}
      title={promo ? 'แก้ไขโค้ดส่วนลด' : 'เพิ่มโค้ดส่วนลด'}
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
        className="mt-2"
        initialValues={{
          code: promo?.code ?? '',
          type: promo?.type ?? 'percent',
          value: promo?.value ?? 10,
          max_discount: promo?.max_discount ?? undefined,
          min_spend: promo?.min_spend ?? 0,
          scope: promo?.scope ?? 'subtotal',
          period:
            promo?.active_from || promo?.active_to
              ? [
                  promo?.active_from ? dayjs(promo.active_from) : null,
                  promo?.active_to ? dayjs(promo.active_to) : null,
                ]
              : undefined,
          total_limit: promo?.total_limit ?? undefined,
          per_user_limit: promo?.per_user_limit ?? undefined,
          active: promo?.active ?? true,
        }}>
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item
            name="code"
            label="โค้ด"
            rules={[{ required: true, message: 'กรอกโค้ด' }]}
            className="col-span-2">
            <Input placeholder="เช่น NEWYEAR10" autoComplete="off" />
          </Form.Item>
          <Form.Item name="type" label="รูปแบบส่วนลด" rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { label: 'เปอร์เซ็นต์ (%)', value: 'percent' },
                { label: 'บาท (฿)', value: 'fixed_baht' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="value"
            label={type === 'fixed_baht' ? 'ลด (บาท)' : 'ลด (%)'}
            rules={[
              { required: true, message: 'กรอกจำนวนส่วนลด' },
              { type: 'number', min: 1, message: 'ต้องมากกว่า 0' },
              ...(type === 'percent'
                ? [{ type: 'number' as const, max: 100, message: 'เปอร์เซ็นต์ห้ามเกิน 100' }]
                : []),
            ]}>
            <InputNumber
              min={1}
              max={type === 'percent' ? 100 : undefined}
              style={{ width: '100%' }}
              addonAfter={type === 'percent' ? '%' : '฿'}
            />
          </Form.Item>
          {type === 'percent' && (
            <Form.Item name="max_discount" label="ลดสูงสุดไม่เกิน (บาท)" className="col-span-2">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="ไม่จำกัด" addonBefore="฿" />
            </Form.Item>
          )}
          <Form.Item name="scope" label="ใช้ลด" rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { label: 'ยอดซื้อ', value: 'subtotal' },
                { label: 'ค่าส่ง', value: 'delivery' },
              ]}
            />
          </Form.Item>
          <Form.Item name="min_spend" label="ยอดซื้อขั้นต่ำ (บาท)">
            <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" />
          </Form.Item>
          <Form.Item name="period" label="ช่วงเวลาใช้งาน (ไม่กรอก = ไม่จำกัด)" className="col-span-2">
            <RangePicker style={{ width: '100%' }} format="D MMM YYYY" allowEmpty={[true, true]} />
          </Form.Item>
          <Form.Item name="total_limit" label="จำกัดจำนวนครั้งใช้ทั้งหมด">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="ไม่จำกัด" />
          </Form.Item>
          <Form.Item name="per_user_limit" label="จำกัดต่อลูกค้า 1 คน">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="ไม่จำกัด" />
          </Form.Item>
          <Form.Item name="active" label="เปิดใช้งานทันที" valuePropName="checked" className="col-span-2">
            <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
