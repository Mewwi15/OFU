import { RiRefreshLine, RiSearchLine } from '@remixicon/react';
import {
  App,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';

import {
  advanceOrder,
  apiError,
  approveSlip,
  cancelOrder,
  getOrderItems,
  getSlipUrl,
  listOrders,
  nextStatus,
  rejectSlip,
  type CancelReason,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
  type ShopMode,
  type SlipRejectReason,
} from '../lib/orders';
import { ORDERS_CHANGED_EVT } from '../components/OrderAlerts';

const { Title, Text } = Typography;

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const SHOP_MODE_LABEL: Record<ShopMode, string> = { delivery: 'จัดส่ง', online: 'ออนไลน์' };

const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  placed: { label: 'สั่งซื้อแล้ว', color: 'default' },
  awaiting_payment: { label: 'รอชำระเงิน', color: 'gold' },
  slip_uploaded: { label: 'แนบสลิปแล้ว', color: 'blue' },
  payment_verifying: { label: 'กำลังตรวจสอบ', color: 'processing' },
  confirmed: { label: 'ยืนยันแล้ว', color: 'cyan' },
  preparing: { label: 'กำลังจัดเตรียม', color: 'geekblue' },
  assigned_to_rider: { label: 'มอบหมายไรเดอร์', color: 'purple' },
  picked_up: { label: 'รับพัสดุแล้ว', color: 'purple' },
  in_transit: { label: 'กำลังจัดส่ง', color: 'geekblue' },
  out_for_delivery: { label: 'กำลังนำส่ง', color: 'geekblue' },
  delivered: { label: 'จัดส่งสำเร็จ', color: 'success' },
  returned: { label: 'ตีกลับ', color: 'volcano' },
  cancelled: { label: 'ยกเลิก', color: 'error' },
  payment_rejected: { label: 'ปฏิเสธการชำระ', color: 'error' },
  delivery_failed: { label: 'จัดส่งไม่สำเร็จ', color: 'error' },
};

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; color: string }> = {
  awaiting_payment: { label: 'รอชำระเงิน', color: 'gold' },
  slip_uploaded: { label: 'แนบสลิปแล้ว', color: 'blue' },
  verifying: { label: 'กำลังตรวจสอบ', color: 'processing' },
  paid: { label: 'ชำระแล้ว', color: 'success' },
  rejected: { label: 'ปฏิเสธ', color: 'error' },
};

const orderStatusTag = (s: OrderStatus) => {
  const m = ORDER_STATUS[s] ?? { label: s, color: 'default' };
  return (
    <Tag color={m.color} variant="filled">
      {m.label}
    </Tag>
  );
};
const paymentStatusTag = (s: PaymentStatus) => {
  const m = PAYMENT_STATUS[s] ?? { label: s, color: 'default' };
  return (
    <Tag color={m.color} variant="filled">
      {m.label}
    </Tag>
  );
};

// Coarse status buckets for the filter + summary — the raw list has ~15 statuses.
const BUCKET: Record<OrderStatus, 'action' | 'shipping' | 'done' | 'cancelled'> = {
  placed: 'action',
  awaiting_payment: 'action',
  slip_uploaded: 'action',
  payment_verifying: 'action',
  confirmed: 'action',
  preparing: 'action',
  assigned_to_rider: 'shipping',
  picked_up: 'shipping',
  in_transit: 'shipping',
  out_for_delivery: 'shipping',
  delivered: 'done',
  returned: 'cancelled',
  cancelled: 'cancelled',
  payment_rejected: 'cancelled',
  delivery_failed: 'cancelled',
};
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const SLIP_REJECT_OPTIONS: { value: SlipRejectReason; label: string }[] = [
  { value: 'amount_mismatch', label: 'ยอดเงินไม่ตรง' },
  { value: 'unclear', label: 'สลิปไม่ชัดเจน' },
  { value: 'not_found', label: 'ไม่พบรายการโอน' },
  { value: 'duplicate', label: 'สลิปซ้ำ' },
  { value: 'other', label: 'อื่น ๆ' },
];
const CANCEL_OPTIONS: { value: CancelReason; label: string }[] = [
  { value: 'customer_request', label: 'ลูกค้าขอยกเลิก' },
  { value: 'out_of_stock', label: 'สินค้าหมด' },
  { value: 'payment_timeout', label: 'ไม่ชำระเงินตามเวลา' },
  { value: 'undeliverable', label: 'จัดส่งไม่ได้' },
  { value: 'shop_cancel', label: 'ร้านยกเลิก' },
  { value: 'other', label: 'อื่น ๆ' },
];

const isSlipPending = (o: Order) =>
  o.payment_status === 'slip_uploaded' || o.payment_status === 'verifying';
const isTerminal = (o: Order) =>
  ['delivered', 'returned', 'cancelled', 'payment_rejected', 'delivery_failed'].includes(
    o.order_status,
  );

export function Orders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<string>('all');
  const [mode, setMode] = useState<string>('all');

  async function load() {
    setLoading(true);
    try {
      const data = await listOrders();
      setOrders(data);
      setSelected((cur) => (cur ? data.find((o) => o.id === cur.id) ?? null : null));
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

  const summary = useMemo(() => {
    let slip = 0,
      action = 0,
      shipping = 0,
      todayRevenue = 0;
    for (const o of orders) {
      if (isSlipPending(o)) slip++;
      const b = BUCKET[o.order_status];
      if (b === 'action') action++;
      else if (b === 'shipping') shipping++;
      if (b !== 'cancelled' && isToday(o.placed_at)) todayRevenue += o.total;
    }
    return { slip, action, shipping, todayRevenue };
  }, [orders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (bucket !== 'all' && BUCKET[o.order_status] !== bucket) return false;
      if (mode !== 'all' && o.shop_mode !== mode) return false;
      if (q && !o.order_number.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, query, bucket, mode]);

  const columns: ColumnsType<Order> = [
    {
      title: 'เลขที่',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (v: string) => <span className="font-semibold text-[#2B2320]">{v}</span>,
    },
    {
      title: 'ช่องทาง',
      key: 'shop_mode',
      width: 110,
      render: (_, o) => (
        <Tag color={o.shop_mode === 'delivery' ? 'geekblue' : 'cyan'} variant="filled">
          {SHOP_MODE_LABEL[o.shop_mode]}
        </Tag>
      ),
    },
    {
      title: 'ยอดรวม',
      key: 'total',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.total - b.total,
      render: (_, o) => <span className="font-semibold text-[#2B2320]">{baht(o.total)}</span>,
    },
    {
      title: 'สถานะ',
      key: 'order_status',
      width: 150,
      render: (_, o) => orderStatusTag(o.order_status),
    },
    {
      title: 'การชำระ',
      key: 'payment_status',
      width: 130,
      render: (_, o) => paymentStatusTag(o.payment_status),
    },
    {
      title: 'เวลา',
      key: 'placed_at',
      width: 130,
      render: (_, o) => {
        const d = new Date(o.placed_at);
        return (
          <div className="leading-tight">
            <div className="text-[#2B2320]">{d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-xs text-gray-400">{d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</div>
          </div>
        );
      },
    },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 96,
      align: 'center',
      fixed: 'right',
      render: (_, o) => (
        <Button
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(o);
          }}>
          ดู
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            ออเดอร์
          </Title>
          <Text type="secondary">ออเดอร์ออนไลน์จากลูกค้า · แตะที่ออเดอร์เพื่อจัดการ</Text>
        </div>
        <Button icon={<RiRefreshLine className="w-4 h-4" />} onClick={() => void load()}>
          รีเฟรช
        </Button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic
            title="ต้องตรวจสลิป"
            value={summary.slip}
            suffix="รายการ"
            styles={{ content: { color: summary.slip ? '#c5410f' : undefined, fontWeight: 700 } }}
          />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="รอดำเนินการ" value={summary.action} suffix="รายการ" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="กำลังจัดส่ง" value={summary.shipping} suffix="รายการ" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="ยอดขายวันนี้" value={summary.todayRevenue} prefix="฿" styles={{ content: { fontWeight: 700 } }} />
        </Card>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขออเดอร์"
          prefix={<RiSearchLine className="w-4 h-4 text-gray-400" />}
          style={{ width: 200 }}
        />
        <Select
          value={mode}
          onChange={setMode}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: 'ทุกช่องทาง' },
            { value: 'delivery', label: 'จัดส่ง' },
            { value: 'online', label: 'ออนไลน์' },
          ]}
        />
        <Segmented
          value={bucket}
          onChange={(v) => setBucket(v as string)}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'action', label: 'รอจัดการ' },
            { value: 'shipping', label: 'กำลังส่ง' },
            { value: 'done', label: 'สำเร็จ' },
            { value: 'cancelled', label: 'ยกเลิก' },
          ]}
        />
      </div>

      <Table<Order>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={shown}
        onRow={(o) => ({ onClick: () => setSelected(o), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 15, hideOnSinglePage: true, showTotal: (t) => `${t} รายการ` }}
        scroll={{ x: 820 }}
        style={{ background: '#fff', borderRadius: 16 }}
      />

      <OrderDrawer order={selected} onClose={() => setSelected(null)} onChanged={load} />
    </>
  );
}

function OrderDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: Order | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (!order) {
      setItems([]);
      setSlipUrl(null);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const its = await getOrderItems(order.id);
        if (alive) setItems(its);
        if (isSlipPending(order)) {
          const url = await getSlipUrl(order.id).catch(() => null);
          if (alive) setSlipUrl(url);
        } else if (alive) {
          setSlipUrl(null);
        }
      } catch (e) {
        message.error(apiError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [order, message]);

  if (!order) return null;

  const runAction = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      message.success(okMsg);
      await onChanged();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const next = nextStatus(order.shop_mode, order.order_status);

  return (
    <Drawer
      open
      width={480}
      onClose={onClose}
      title={`ออเดอร์ ${order.order_number}`}
      extra={<Space>{orderStatusTag(order.order_status)}</Space>}>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="ช่องทาง">{SHOP_MODE_LABEL[order.shop_mode]}</Descriptions.Item>
        <Descriptions.Item label="ผู้รับ">{order.ship_recipient ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="โทร">{order.ship_phone ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="ที่อยู่">{order.ship_address_text ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="การชำระ">{paymentStatusTag(order.payment_status)}</Descriptions.Item>
        <Descriptions.Item label="เวลา">{fmtTime(order.placed_at)}</Descriptions.Item>
      </Descriptions>

      <Divider titlePlacement="left" style={{ margin: '20px 0 12px' }}>
        รายการสินค้า
      </Divider>
      <Table<OrderItem>
        size="small"
        rowKey="id"
        loading={loading}
        pagination={false}
        dataSource={items}
        locale={{ emptyText: 'ไม่มีรายการ' }}
        columns={[
          {
            title: 'สินค้า',
            key: 'name',
            render: (_, it) => (
              <div>
                <div className="text-[#2B2320]">{it.name_snapshot}</div>
                {it.size_snapshot ? (
                  <Text type="secondary" className="text-xs">
                    {it.size_snapshot}
                  </Text>
                ) : null}
              </div>
            ),
          },
          { title: 'จำนวน', dataIndex: 'qty', key: 'qty', width: 60, align: 'center' },
          {
            title: 'รวม',
            key: 'line_total',
            width: 90,
            align: 'right',
            render: (_, it) => baht(it.line_total),
          },
        ]}
      />

      <div className="mt-4 rounded-xl p-3" style={{ background: '#FAF7F5' }}>
        <Row label="ยอดสินค้า" value={baht(order.subtotal)} />
        {order.delivery_fee ? <Row label="ค่าจัดส่ง" value={baht(order.delivery_fee)} /> : null}
        {order.discount_amount ? (
          <Row label="ส่วนลด" value={`-${baht(order.discount_amount)}`} />
        ) : null}
        <Divider style={{ margin: '8px 0' }} />
        <Row label="ยอดรวมทั้งสิ้น" value={baht(order.total)} strong />
      </div>

      {isSlipPending(order) ? (
        <>
          <Divider titlePlacement="left" style={{ margin: '20px 0 12px' }}>
            สลิปการชำระเงิน
          </Divider>
          {slipUrl ? (
            <Image src={slipUrl} alt="สลิป" style={{ borderRadius: 12, maxHeight: 360 }} />
          ) : (
            <Text type="secondary">ไม่พบรูปสลิป (อาจยังไม่แนบ หรือเปิดดูไม่ได้)</Text>
          )}
          <Space className="mt-3" style={{ width: '100%' }}>
            <Button
              type="primary"
              loading={busy}
              onClick={() =>
                void runAction(() => approveSlip(order.id, order.row_version), 'อนุมัติสลิปแล้ว')
              }>
              อนุมัติสลิป
            </Button>
            <Button danger loading={busy} onClick={() => setRejectOpen(true)}>
              ปฏิเสธสลิป
            </Button>
          </Space>
        </>
      ) : null}

      <Divider style={{ margin: '20px 0 12px' }} />
      <Space direction="vertical" style={{ width: '100%' }}>
        {next ? (
          <Popconfirm
            title="เลื่อนสถานะถัดไป?"
            description={`ไปเป็น “${ORDER_STATUS[next].label}”`}
            okText="ยืนยัน"
            cancelText="ยกเลิก"
            onConfirm={() =>
              void runAction(
                () => advanceOrder(order.id, next, order.row_version),
                'เลื่อนสถานะแล้ว',
              )
            }>
            <Button type="primary" block loading={busy}>
              เลื่อนสถานะถัดไป → {ORDER_STATUS[next].label}
            </Button>
          </Popconfirm>
        ) : null}
        {!isTerminal(order) ? (
          <Button danger block loading={busy} onClick={() => setCancelOpen(true)}>
            ยกเลิกออเดอร์
          </Button>
        ) : null}
      </Space>

      <ReasonModal
        open={rejectOpen}
        title="ปฏิเสธสลิป"
        okText="ปฏิเสธสลิป"
        danger
        options={SLIP_REJECT_OPTIONS}
        onClose={() => setRejectOpen(false)}
        onSubmit={async (reason, note) => {
          setRejectOpen(false);
          await runAction(
            () => rejectSlip(order.id, reason as SlipRejectReason, note, order.row_version),
            'ปฏิเสธสลิปแล้ว',
          );
        }}
      />
      <ReasonModal
        open={cancelOpen}
        title="ยกเลิกออเดอร์"
        okText="ยกเลิกออเดอร์"
        danger
        options={CANCEL_OPTIONS}
        onClose={() => setCancelOpen(false)}
        onSubmit={async (reason, note) => {
          setCancelOpen(false);
          await runAction(
            () => cancelOrder(order.id, reason as CancelReason, note, order.row_version),
            'ยกเลิกออเดอร์แล้ว',
          );
        }}
      />
    </Drawer>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <Text type={strong ? undefined : 'secondary'} strong={strong}>
        {label}
      </Text>
      <span className={strong ? 'font-semibold text-[#2B2320]' : 'text-[#2B2320]'}>{value}</span>
    </div>
  );
}

function ReasonModal({
  open,
  title,
  okText,
  danger,
  options,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  okText: string;
  danger?: boolean;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (reason: string, note?: string) => Promise<void>;
}) {
  const [form] = Form.useForm();

  const submit = async () => {
    const v = await form.validateFields();
    await onSubmit(v.reason, v.note?.trim() || undefined);
    form.resetFields();
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => void submit()}
      okText={okText}
      cancelText="ยกเลิก"
      okButtonProps={{ danger }}
      destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} className="mt-2">
        <Form.Item name="reason" label="เหตุผล" rules={[{ required: true, message: 'เลือกเหตุผล' }]}>
          <Select placeholder="เลือกเหตุผล" options={options} />
        </Form.Item>
        <Form.Item name="note" label="หมายเหตุ (ถ้ามี)">
          <Input.TextArea rows={2} placeholder="รายละเอียดเพิ่มเติม" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
