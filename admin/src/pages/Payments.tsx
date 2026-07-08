import { RiCheckLine, RiCloseLine } from '@remixicon/react';
import { App, Button, Card, Empty, Form, Image, Input, Modal, Select, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { apiError } from '../lib/api';
import {
  approveSlip,
  getSlipUrl,
  listOrders,
  rejectSlip,
  type Order,
  type SlipRejectReason,
} from '../lib/orders';
import { ORDERS_CHANGED_EVT } from '../components/OrderAlerts';

const { Title, Text } = Typography;
const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  slip_uploaded: { label: 'แนบสลิปแล้ว', color: 'gold' },
  verifying: { label: 'กำลังตรวจ', color: 'processing' },
};
const REJECT_REASONS: { value: SlipRejectReason; label: string }[] = [
  { value: 'amount_mismatch', label: 'ยอดเงินไม่ตรง' },
  { value: 'unclear', label: 'รูปสลิปไม่ชัด' },
  { value: 'not_found', label: 'ไม่พบการโอนเข้า' },
  { value: 'duplicate', label: 'สลิปซ้ำ' },
  { value: 'other', label: 'อื่นๆ' },
];

export function Payments() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [slips, setSlips] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Order | null>(null);

  async function load() {
    setLoading(true);
    try {
      const all = await listOrders();
      const pending = all.filter(
        (o) => o.payment_status === 'slip_uploaded' || o.payment_status === 'verifying',
      );
      setOrders(pending);
      const entries = await Promise.all(
        pending.map(async (o) => [o.id, await getSlipUrl(o.id).catch(() => null)] as const),
      );
      setSlips(Object.fromEntries(entries));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // Live refresh when OrderAlerts sees an order INSERT/UPDATE via Realtime.
    const onChanged = () => void load();
    window.addEventListener(ORDERS_CHANGED_EVT, onChanged);
    return () => window.removeEventListener(ORDERS_CHANGED_EVT, onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(o: Order) {
    setBusyId(o.id);
    try {
      await approveSlip(o.id, o.row_version);
      message.success(`อนุมัติสลิป ${o.order_number} แล้ว`);
      await load();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          ตรวจสลิป
        </Title>
        <Text type="secondary">อนุมัติ/ปฏิเสธสลิปการโอนของออเดอร์ออนไลน์ · รอตรวจ {orders.length} รายการ</Text>
      </div>

      {loading ? (
        <Card loading />
      ) : orders.length === 0 ? (
        <Card>
          <Empty description="ไม่มีสลิปรอตรวจ" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((o) => (
            <Card key={o.id} styles={{ body: { padding: 14 } }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold text-[#2B2320]">{o.order_number}</div>
                  <Text type="secondary" className="text-xs">
                    {o.ship_recipient ?? '—'} · {o.ship_phone ?? '—'}
                  </Text>
                </div>
                <Tag color={PAY_STATUS[o.payment_status]?.color} variant="filled">
                  {PAY_STATUS[o.payment_status]?.label ?? o.payment_status}
                </Tag>
              </div>

              <div className="rounded-lg overflow-hidden bg-[#F6ECE5] mb-2 grid place-items-center" style={{ height: 200 }}>
                {slips[o.id] ? (
                  <Image src={slips[o.id] as string} alt="สลิป" height={200} style={{ objectFit: 'contain' }} />
                ) : (
                  <Text type="secondary">ไม่พบรูปสลิป</Text>
                )}
              </div>

              <div className="flex items-center justify-between mb-3">
                <Text type="secondary">ยอดที่ต้องชำระ</Text>
                <span className="text-lg font-bold text-tremor-brand-emphasis">{baht(o.total)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  danger
                  icon={<RiCloseLine className="w-4 h-4" />}
                  disabled={busyId === o.id}
                  onClick={() => setRejecting(o)}>
                  ปฏิเสธ
                </Button>
                <Button
                  type="primary"
                  icon={<RiCheckLine className="w-4 h-4" />}
                  loading={busyId === o.id}
                  onClick={() => void approve(o)}>
                  อนุมัติ
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {rejecting ? (
        <RejectModal
          order={rejecting}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            setRejecting(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function RejectModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => Promise<void> }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await rejectSlip(order.id, v.reason, v.note?.trim() || undefined, order.row_version);
      message.success(`ปฏิเสธสลิป ${order.order_number} แล้ว`);
      await onDone();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`ปฏิเสธสลิป — ${order.order_number}`}
      onCancel={onClose}
      onOk={() => void submit()}
      okText="ปฏิเสธสลิป"
      okButtonProps={{ danger: true }}
      cancelText="ยกเลิก"
      confirmLoading={busy}
      destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} className="mt-2" initialValues={{ reason: 'amount_mismatch', note: '' }}>
        <Form.Item name="reason" label="เหตุผล" rules={[{ required: true }]}>
          <Select options={REJECT_REASONS} />
        </Form.Item>
        <Form.Item name="note" label="หมายเหตุ (ถ้ามี)">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม…" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
