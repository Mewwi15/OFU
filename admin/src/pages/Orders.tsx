import { RiPrinterLine, RiRefreshLine, RiSearchLine } from '@remixicon/react';
import {
  Alert,
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
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  advanceOrder,
  apiError,
  approveSlip,
  cancelOrder,
  getOrderItems,
  getParcelTracking,
  getShopName,
  getSlipUrl,
  listOrders,
  listOwedRefunds,
  markOrderPrinted,
  markRefundSent,
  nextStatus,
  rejectSlip,
  orderRiders,
  setOrderTrackingNo,
  type CancelReason,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OwedRefund,
  type PaymentStatus,
  type ShopMode,
  type SlipRejectReason,
} from '../lib/orders';
import { printAddressLabel, printPickList } from '../lib/printOrder';
import { getShopInfo, type ShopInfo } from '../lib/api';
import { Receipt } from '../components/Receipt';
import { ReceiptBoundary } from '../components/ReceiptBoundary';
import { ORDERS_CHANGED_EVT } from '../components/OrderAlerts';
import { RiderPanel } from '../components/RiderPanel';

const { Text } = Typography;

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const SHOP_MODE_LABEL: Record<ShopMode, string> = { delivery: 'จัดส่ง', online: 'ออนไลน์' };

/**
 * ช่องเลขพัสดุในตาราง — กรอกได้ตรงแถวเลย ไม่ต้องเปิดออเดอร์
 *
 * เจ้าของสั่งเพิ่มคอลัมน์นี้ 30 ส.ค. 2026 เพราะเวลาลูกค้าทักมาถามว่าของถึงไหน
 * ต้องหาเลขพัสดุให้ไว ถ้าต้องคลิกเข้าไปทีละใบก็ไม่ต่างจากจดไว้นอกระบบ
 *
 * ใช้ set_order_tracking_no ของเดิม (0046) ไม่ได้ทำที่เก็บใหม่ — parcel_shipments
 * มีอยู่แล้วพร้อม courier/สถานะ Flash และการยิง push แจ้งลูกค้าตอนของออกจากร้าน
 */
function TrackingCell({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(order.tracking_no ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next = value.trim();
    if (next === (order.tracking_no ?? '')) { setEditing(false); return; }
    setBusy(true);
    try {
      await setOrderTrackingNo(order.id, next);
      setEditing(false);
      onSaved();
      message.success('บันทึกเลขพัสดุแล้ว');
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(order.tracking_no ?? ''); setEditing(true); }}
        className="text-left w-full"
        style={{ cursor: 'pointer' }}
      >
        {order.tracking_no ? (
          <span className="font-mono text-[13px] text-[#2B2320]">{order.tracking_no}</span>
        ) : (
          <span className="text-[13px] text-[#5B8C6E]">+ ใส่เลขพัสดุ</span>
        )}
      </button>
    );
  }

  return (
    <Input
      size="small"
      autoFocus
      disabled={busy}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onPressEnter={() => void save()}
      onBlur={() => void save()}
      placeholder="เลขพัสดุ"
      style={{ fontFamily: 'monospace' }}
    />
  );
}

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
  { value: 'out_of_area', label: 'อยู่นอกพื้นที่จัดส่ง' },
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
  const [printFilter, setPrintFilter] = useState<string>('all');
  const [riders, setRiders] = useState<Map<string, { name: string; state: string }>>(new Map());
  const [refunds, setRefunds] = useState<OwedRefund[]>([]);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundBusy, setRefundBusy] = useState<string | null>(null);

  /** silent = รอบดึงเอง (poll/Realtime) — ห้ามหมุน spinner ทับมือคนที่กำลังทำงานอยู่
   *  และห้ามเด้ง error ซ้ำ ๆ ทุก 45 วินาทีตอนเน็ตร้านสะดุด */
  async function load(silent?: boolean) {
    if (!silent) setLoading(true);
    try {
      const data = await listOrders();
      setOrders(data);
      orderRiders().then(setRiders).catch(() => {});
      /* ★ กลืน error ของรายการรอคืนเงินเงียบ ๆ ★ หลังร้านขึ้นเว็บคนละรอบกับไมเกรชัน
         (0115) ถ้า RPC ยังไม่มีบนเซิร์ฟเวอร์ ห้ามให้หน้าออเดอร์ทั้งหน้าพัง — แถบเตือน
         แค่ไม่ขึ้นจนกว่าไมเกรชันจะรัน แต่ Modal ตอนกดยกเลิกยังเตือนเรื่องเงินอยู่ */
      listOwedRefunds().then(setRefunds).catch(() => {});
      setSelected((cur) => {
        if (!cur) return null;
        const found = data.find((o) => o.id === cur.id) ?? null;
        /* ★ ข้อมูลเท่าเดิมต้องคืนอ็อบเจ็กต์ตัวเดิม ★ ลิ้นชักโหลดรายการ/เซ็นลิงก์สลิปใหม่
           ทุกครั้งที่ prop `order` เปลี่ยนตัว ถ้าคืนตัวใหม่ทุกรอบ poll รูปสลิปที่แคชเชียร์
           กำลังจ้องอยู่จะกะพริบทุก 45 วินาที */
        return found && JSON.stringify(found) === JSON.stringify(cur) ? cur : found;
      });
    } catch (e) {
      if (!silent) message.error(apiError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // Live refresh when OrderAlerts sees an order INSERT/UPDATE via Realtime.
    const onChanged = () => void load(true);
    window.addEventListener(ORDERS_CHANGED_EVT, onChanged);
    /* ★ ตัวสำรองเวลา Realtime หลุด ★ ช่องสัญญาณ postgres_changes ไม่เล่นเหตุการณ์
       ช่วงที่ขาดย้อนหลังให้ ออเดอร์ที่เข้ามาตอนเน็ตกระตุก/ปิดฝาโน้ตบุ๊กจึงไม่โผล่ในตาราง
       จนกว่าจะมีคนกดรีเฟรชเอง · ดึงเองทุก 45 วิ แบบเดียวกับหน้ารอบขาย (Shift.tsx:186) */
    const t = setInterval(() => void load(true), 45_000);
    return () => {
      clearInterval(t);
      window.removeEventListener(ORDERS_CHANGED_EVT, onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const owedTotal = useMemo(() => refunds.reduce((s, r) => s + r.amount, 0), [refunds]);
  /* ปิดงานคืนเงินหนึ่งราย — เวลา/คนโอนถูกบันทึกฝั่งเซิร์ฟเวอร์ (mark_refund_sent, 0115)
     กดซ้ำไม่ทับของเดิม เพราะมันคือหลักฐานตอนเคลียร์กับลูกค้า */
  const markSent = async (r: OwedRefund) => {
    setRefundBusy(r.id);
    try {
      await markRefundSent(r.id);
      message.success(`บันทึกว่าโอนคืน ${baht(r.amount)} แล้ว`);
      await load(true);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setRefundBusy(null);
    }
  };

  const summary = useMemo(() => {
    let slip = 0,
      action = 0,
      shipping = 0,
      cancelled = 0,
      todayRevenue = 0;
    for (const o of orders) {
      if (isSlipPending(o)) slip++;
      const b = BUCKET[o.order_status];
      if (b === 'action') action++;
      else if (b === 'shipping') shipping++;
      else if (b === 'cancelled') cancelled++;
      // นับเฉพาะเงินที่เข้าแล้วจริง — ใบที่ยังรอสลิป/รอโอนไม่ใช่ยอดขาย (M3)
      // ให้ตรงกับ pos_dashboard ฝั่งเซิร์ฟเวอร์ที่กรอง paid อยู่แล้ว
      if (b !== 'cancelled' && o.payment_status === 'paid' && isToday(o.placed_at))
        todayRevenue += o.total;
    }
    return { slip, action, shipping, cancelled, todayRevenue };
  }, [orders]);
  const cancelledCount = summary.cancelled;
  // นับเฉพาะใบที่ยังต้องจัดจริง — ใบที่ยกเลิกหรือส่งจบแล้วไม่ต้องพิมพ์
  const unprintedCount = useMemo(
    () => orders.filter((o) => !o.printed_at && BUCKET[o.order_status] === 'action').length,
    [orders],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      // "ทั้งหมด" = ทุกออเดอร์ที่ยังมีชีวิต — ที่ยกเลิก/ถูกปฏิเสธไปแล้วไม่มีอะไรให้
      // ทำต่อ แต่เดิมมันค้างอยู่ในลิสต์จนกลบออเดอร์จริงที่ต้องรีบจัด
      // ยังดูได้ที่แท็บ "ยกเลิก" — ไม่ได้ลบทิ้ง เพราะเป็นหลักฐานทางบัญชี
      if (bucket === 'all' && BUCKET[o.order_status] === 'cancelled') return false;
      if (bucket !== 'all' && BUCKET[o.order_status] !== bucket) return false;
      if (mode !== 'all' && o.shop_mode !== mode) return false;
      if (printFilter === 'unprinted' && o.printed_at) return false;
      if (q && !o.order_number.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, query, bucket, mode, printFilter]);

  const columns: ColumnsType<Order> = [
    {
      title: 'เลขที่',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (v: string) => <span className="font-semibold text-[#2B2320]">{v}</span>,
    },
    {
      title: 'ชื่อลูกค้า',
      key: 'ship_recipient',
      width: 150,
      render: (_, o) =>
        o.ship_recipient ? (
          <span className="text-[#2B2320]">{o.ship_recipient}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      /* เลขพัสดุมาจาก parcel_shipments (0046) ซึ่งมีเฉพาะออเดอร์ส่งพัสดุ — ออเดอร์
         จัดส่งเองใช้ไรเดอร์ ไม่มีเลขพัสดุ จึงไม่ให้กรอก ไม่ใช่ปล่อยให้กรอกแล้วค่อย
         ให้ RPC เด้ง NOT_PARCEL_ORDER กลับมา */
      title: 'เลขพัสดุ / ผู้ส่ง',
      key: 'tracking_no',
      width: 190,
      render: (_, o) =>
        o.shop_mode !== 'online' ? (
          /* ออเดอร์จัดส่งเองไม่มีเลขพัสดุ
           *
           * เคยขึ้นว่า "ยังไม่จ่ายงาน" เมื่อไม่เจอไรเดอร์ ซึ่งผิด — เจ้าของเจอว่า
           * ออเดอร์ที่จัดส่งสำเร็จไปแล้วก็ยังขึ้นข้อความนี้ ไล่ดูแล้วพบว่าไม่มีทั้ง
           * ฟังก์ชันในฐานข้อมูลและโค้ดในแอปสักที่ที่เขียนลง deliveries เลย ตารางนั้น
           * ออกแบบไว้ตอนวางแผนระบบไรเดอร์หลายคนแต่ไม่เคยต่อใช้งาน เพราะเจ้าของ
           * ขี่ส่งเอง แล้วกดเปลี่ยนสถานะออเดอร์ตรง ๆ ไม่ผ่านขั้นตอนรับงาน
           *
           * ไม่มีไรเดอร์ = ร้านส่งเอง ไม่ใช่งานตกค้าง ความคืบหน้าอ่านได้จากคอลัมน์
           * สถานะที่อยู่ถัดไปอยู่แล้ว · ยังเผื่อชื่อไรเดอร์ไว้เผื่อวันหน้าเริ่มใช้จริง */
          riders.get(o.id) ? (
            <span className="text-[13px] text-[#2B2320]">ไรเดอร์ {riders.get(o.id)!.name}</span>
          ) : (
            <span className="text-[13px] text-gray-400">จัดส่งเอง</span>
          )
        ) : (
          <TrackingCell order={o} onSaved={load} />
        ),
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
      // ช่องนี้ตอบคำถามเดียวของคนจัดของ: "ใบนี้พิมพ์ไปหรือยัง" — เดิมต้องจำเอง
      // พอช่วยกันจัดสองคนเลยพิมพ์ซ้ำใบเดิมหรือข้ามใบที่ยังไม่ได้พิมพ์
      title: 'ใบจัดสินค้า',
      key: 'printed_at',
      width: 118,
      render: (_, o) =>
        o.printed_at ? (
          <Tag color="success" variant="filled">
            พิมพ์แล้ว
          </Tag>
        ) : (
          <Text type="secondary" className="text-xs">
            ยังไม่พิมพ์
          </Text>
        ),
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
          color="cyan"
          variant="solid"
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
          <Text type="secondary">
            ออเดอร์ออนไลน์จากลูกค้า · แตะที่ออเดอร์เพื่อจัดการ
            {orders.length === 100 && ' · แสดงล่าสุด 100 รายการ'}
          </Text>
        </div>
        <Button icon={<RiRefreshLine className="w-4 h-4" />} onClick={() => void load()}>
          รีเฟรช
        </Button>
      </div>

      {/* ★ เงินของลูกค้าที่ยังอยู่ในมือร้าน ★ ยกเลิกใบที่จ่ายเงินมาแล้ว ระบบจะตั้งหนี้คืนเงิน
          ไว้ในตาราง refunds ทุกครั้ง (cancel_order, 0067) แต่เดิมไม่มีหน้าจอไหนอ่านเลย
          หนี้ก้อนนั้นจึงเงียบสนิทจนกว่าลูกค้าจะทวง — แถบนี้คือที่เดียวที่มันโผล่ */}
      {refunds.length ? (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          title={`ต้องโอนเงินคืนลูกค้า ${refunds.length} ราย · รวม ${baht(owedTotal)}`}
          description="ออเดอร์ที่ยกเลิกหลังลูกค้าโอนเงินมาแล้ว — เงินยังอยู่ที่ร้านจนกว่าจะโอนคืนและกดยืนยัน"
          action={
            <Button size="small" danger onClick={() => setRefundOpen(true)}>
              ดูรายการ
            </Button>
          }
        />
      ) : null}

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic
            title="ยอดขายวันนี้"
            value={summary.todayRevenue}
            prefix="฿"
            styles={{ content: { color: '#5B8C6E', fontWeight: 700 } }}
          />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="รอดำเนินการ" value={summary.action} suffix="รายการ" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="กำลังจัดส่ง" value={summary.shipping} suffix="รายการ" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic
            title="ต้องตรวจสลิป"
            value={summary.slip}
            suffix="รายการ"
            styles={{ content: { color: summary.slip ? '#E5484D' : undefined } }}
          />
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
            { value: 'cancelled', label: `ยกเลิก/ปฏิเสธ${cancelledCount ? ` (${cancelledCount})` : ''}` },
          ]}
        />
        <Segmented
          value={printFilter}
          onChange={(v) => setPrintFilter(v as string)}
          options={[
            { value: 'all', label: 'ทุกใบ' },
            { value: 'unprinted', label: `ยังไม่พิมพ์${unprintedCount ? ` (${unprintedCount})` : ''}` },
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
        style={{ background: '#fff', borderRadius: 0 }}
        locale={{
          emptyText:
            query || bucket !== 'all' || mode !== 'all' ? 'ไม่พบออเดอร์ที่ตรงกับตัวกรอง' : 'ยังไม่มีออเดอร์เข้ามา',
        }}
      />

      <Modal
        open={refundOpen}
        title="รอโอนเงินคืนลูกค้า"
        width={640}
        onCancel={() => setRefundOpen(false)}
        footer={<Button onClick={() => setRefundOpen(false)}>ปิด</Button>}
        destroyOnHidden>
        <Table<OwedRefund>
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={refunds}
          locale={{ emptyText: 'ไม่มีรายการค้างคืนเงิน' }}
          columns={[
            {
              title: 'ออเดอร์',
              key: 'order_number',
              render: (_, r) => (
                <div className="leading-tight">
                  <div className="font-semibold text-[#2B2320]">{r.order_number}</div>
                  <Text type="secondary" className="text-xs">
                    ยกเลิก {fmtTime(r.created_at)}
                  </Text>
                </div>
              ),
            },
            {
              title: 'โอนคืนให้',
              key: 'recipient',
              render: (_, r) => (
                <div className="leading-tight">
                  <div className="text-[#2B2320]">{r.ship_recipient ?? '—'}</div>
                  {/* เบอร์คือทางเดียวที่ร้านติดต่อกลับไปขอเลขพร้อมเพย์ได้ ต้องอยู่ในตาราง
                      ไม่ใช่ให้ไปเปิดออเดอร์หาทีละใบ */}
                  <Text type="secondary" className="text-xs">
                    {r.ship_phone ?? 'ไม่มีเบอร์'}
                  </Text>
                </div>
              ),
            },
            {
              title: 'ยอดคืน',
              key: 'amount',
              width: 110,
              align: 'right',
              render: (_, r) => (
                <span className="font-semibold text-[#E5484D]">{baht(r.amount)}</span>
              ),
            },
            {
              title: '',
              key: 'action',
              width: 120,
              align: 'right',
              render: (_, r) => (
                <Popconfirm
                  title="โอนคืนแล้ว?"
                  description={`ยืนยันว่าโอน ${baht(r.amount)} คืน ${r.ship_recipient ?? 'ลูกค้า'} แล้วจริง`}
                  okText="ยืนยัน"
                  cancelText="ยังไม่โอน"
                  onConfirm={() => void markSent(r)}>
                  <Button size="small" type="primary" loading={refundBusy === r.id}>
                    โอนคืนแล้ว
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>

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
  const { message, modal } = App.useApp();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  /* เซ็นลิงก์สลิปไม่ผ่าน ≠ ลูกค้าไม่ได้แนบสลิป — สองเคสนี้ต้องแยกให้คนกดปุ่มเห็น
     ไม่งั้นจะอ่านว่า "ไม่มีสลิป" แล้วตัดสินใจเรื่องเงินจากข้อมูลผิด */
  const [slipErr, setSlipErr] = useState<string | null>(null);
  const [slipBusy, setSlipBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Parcel tracking number (online orders): shown in the details, typed in the
  // ship modal when advancing to picked_up (customer push carries it — 0046).
  const [trackingNo, setTrackingNo] = useState<string | null>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipNo, setShipNo] = useState('');
  /* ── บิลของออเดอร์ในแอป ──
     เจ้าของสั่ง 5 ก.ย. 2026 "หน้าออเดอร์ต้องออกบิลได้ด้วยเหมือนหน้าร้าน" — ใช้ใบเสร็จตัว
     เดียวกับ POS ทั้งดุ้น (โลโก้ หัวใบ ขนาดกระดาษ 48/58mm ตามที่ตั้งไว้ในเครื่องนั้น)
     ไม่ทำใบใหม่ ลูกค้าจะได้บิลหน้าตาเดียวกันไม่ว่าซื้อหน้าร้านหรือสั่งในแอป
     ข้อมูลร้านโหลดตอนกดพิมพ์ครั้งแรก ไม่ใช่ตอนเปิดลิ้นชัก — คนเปิดดูออเดอร์เฉย ๆ
     ไม่ต้องเสียรอบเรียกเซิร์ฟเวอร์ */
  const [bill, setBill] = useState<ShopInfo | null>(null);
  const [billBusy, setBillBusy] = useState(false);

  useEffect(() => {
    if (!order) {
      setItems([]);
      setSlipUrl(null);
      setSlipErr(null);
      setTrackingNo(null);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const its = await getOrderItems(order.id);
        if (alive) setItems(its);
        if (order.shop_mode === 'online') {
          const track = await getParcelTracking(order.id).catch(() => null);
          if (alive) setTrackingNo(track);
        }
        // Fetch the slip for every order that has one, not just the ones still
        // waiting on a decision — approving used to make the shop's only proof
        // of payment vanish from the screen. getSlipUrl returns null when there
        // is no slip (e.g. cash on delivery), so the section just won't render.
        /* ★ อย่ากลืน error ของการเซ็นลิงก์ ★ เดิม .catch(() => null) ทำให้ "เซ็นลิงก์ไม่ผ่าน"
           หน้าตาเหมือน "ลูกค้ายังไม่แนบสลิป" เป๊ะ ๆ แล้วปุ่มอนุมัติสีหลักก็ยังกดได้ตามปกติ */
        try {
          const url = await getSlipUrl(order.id);
          if (alive) {
            setSlipUrl(url);
            setSlipErr(null);
          }
        } catch (e) {
          if (alive) {
            setSlipUrl(null);
            setSlipErr(apiError(e));
          }
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

  /* ลองเซ็นลิงก์สลิปใหม่ — ลิงก์มีอายุ 10 นาที (orders.ts:155) เปิดลิ้นชักค้างไว้นาน ๆ
     แล้วค่อยกลับมาดู รูปก็หมดอายุไปแล้ว ต้องมีทางขอใหม่โดยไม่ต้องปิดเปิดลิ้นชัก */
  const retrySlip = async () => {
    setSlipBusy(true);
    try {
      setSlipUrl(await getSlipUrl(order.id));
      setSlipErr(null);
    } catch (e) {
      setSlipUrl(null);
      setSlipErr(apiError(e));
    } finally {
      setSlipBusy(false);
    }
  };

  /* ★ ของออกจากร้านไปแล้ว ★ cancel_order บวกสต๊อกคืนทุกบรรทัดแบบไม่มีเงื่อนไข (0067:657-678)
     ซึ่งถูกเฉพาะตอนของยังอยู่ในร้าน · พอกล่องไปอยู่กับขนส่งแล้วกดยกเลิก สต๊อกจะเด้งกลับ
     ทั้งที่ของไม่ได้อยู่ที่ร้าน แล้วถ้าของตีกลับมาจริงแล้วรับเข้าอีกรอบ ยอดจะบวกซ้ำสองเท่า
     ยังไม่มีปุ่ม "ตีกลับ/ส่งไม่สำเร็จ" ให้กด (advance_order ไม่รับสองสถานะนั้น) จึงเตือนไว้
     ตรงหน้าปุ่มก่อน ไม่ใช่ปล่อยให้รู้ทีหลังตอนนับสต๊อกไม่ตรง */
  const shippedOut = ['assigned_to_rider', 'picked_up', 'in_transit', 'out_for_delivery'].includes(
    order.order_status,
  );
  const totalQty = items.reduce((s, it) => s + it.qty, 0);

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
        {order.shop_mode === 'online' ? (
          <Descriptions.Item label="เลขพัสดุ">{trackingNo ?? '—'}</Descriptions.Item>
        ) : null}
        <Descriptions.Item label="เวลา">{fmtTime(order.placed_at)}</Descriptions.Item>
      </Descriptions>

      {/* โหมดไรเดอร์ — เจ้าของร้านส่งเอง POS บนมือถือจึงทำหน้าที่แอปไรเดอร์
          (เฉพาะออเดอร์เดลิเวอรี่ · พัสดุทั่วไทยมีเลขติดตามแทน) */}
      {order.shop_mode === 'delivery' ? <RiderPanel order={order} onChanged={onChanged} /> : null}

      {/* Print sheets: packing checklist + shop address label (the official
          Flash waybill still prints from Flash's own system/printer app). */}
      <Space style={{ marginTop: 12 }} wrap>
        <Button
          icon={<RiPrinterLine className="w-4 h-4" />}
          onClick={async () => {
            printPickList(order, items, await getShopName());
            // ทำเครื่องหมายหลังเปิดหน้าต่างพิมพ์แล้ว และไม่ให้พังงานพิมพ์ถ้าเน็ตล่ม —
            // การพิมพ์สำคัญกว่าการจดว่าพิมพ์
            try {
              await markOrderPrinted(order.id);
              await onChanged();
            } catch {
              message.warning('พิมพ์แล้ว แต่บันทึกสถานะไม่สำเร็จ');
            }
          }}>
          พิมพ์ใบจัดสินค้า
        </Button>
        <Button
          icon={<RiPrinterLine className="w-4 h-4" />}
          onClick={async () => printAddressLabel(order, await getShopName(), trackingNo)}>
          พิมพ์ใบจ่าหน้า
        </Button>
        <Button
          icon={<RiPrinterLine className="w-4 h-4" />}
          loading={billBusy}
          onClick={async () => {
            setBillBusy(true);
            try {
              setBill(await getShopInfo());
            } catch {
              message.error('โหลดข้อมูลร้านไม่สำเร็จ — ลองใหม่อีกครั้ง');
            } finally {
              setBillBusy(false);
            }
          }}>
          พิมพ์บิล
        </Button>
      </Space>

      {bill ? (
        <Modal
          open
          onCancel={() => setBill(null)}
          width={340}
          destroyOnHidden
          footer={[
            <Button
              key="print"
              icon={<RiPrinterLine className="w-4 h-4" />}
              onClick={() => window.print()}>
              พิมพ์บิล
            </Button>,
            <Button key="close" type="primary" onClick={() => setBill(null)}>
              ปิด
            </Button>,
          ]}>
          {/* ตั้งค่าหน้าพิมพ์ผิด = บิลย่อจนอ่านยาก บอกไว้ตรงที่กำลังจะกดพิมพ์ ไม่ใช่ให้ไป
              เจอเองในหน้าตั้งค่า · no-print เพื่อไม่ให้ติดไปบนกระดาษ */}
          <div className="no-print mb-2 text-[12px] text-[#8a807a]">
            ในหน้าพิมพ์: ระยะขอบ = ไม่มี · ปรับขนาด = กำหนดเอง 100%
          </div>
          {/* ใบเสร็จพังไม่ควรลาก modal ทั้งอันไปด้วย — กติกาเดียวกับ POS */}
          <ReceiptBoundary onClose={() => setBill(null)}>
            <Receipt
              shop={bill}
              saleNumber={order.order_number}
              at={fmtTime(order.placed_at)}
              items={items.map((it) => ({
                name: it.name_snapshot,
                size: it.size_snapshot,
                qty: it.qty,
                unitPrice: it.unit_price,
                lineTotal: it.line_total,
              }))}
              subtotal={order.subtotal}
              discount={order.discount_amount}
              deliveryFee={order.delivery_fee}
              /* ร้านยังไม่จด VAT — ถ้าวันหนึ่งจด ใบเสร็จจะโชว์สองบรรทัดนี้เอง จึงถอดกลับ
                 จากยอดสุทธิแบบราคารวมภาษี (วิธีเดียวกับที่ POS คิด) ไม่ปล่อยให้เป็น 0 */
              netAmount={
                bill.vat_registered
                  ? Math.round((order.total * 100) / (100 + bill.vat_rate))
                  : order.total
              }
              vatAmount={
                bill.vat_registered
                  ? order.total - Math.round((order.total * 100) / (100 + bill.vat_rate))
                  : 0
              }
              total={order.total}
              paymentMethod={order.payment_method}
            />
          </ReceiptBoundary>
        </Modal>
      ) : null}

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
              <div className="flex items-center gap-2.5">
                {it.image ? (
                  <Image
                    src={it.image}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-none object-cover shrink-0"
                    preview={false}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-none bg-[#F5F5F5] shrink-0" />
                )}
                <div>
                  <div className="text-[#2B2320]">{it.name_snapshot}</div>
                  {it.size_snapshot ? (
                    <Text type="secondary" className="text-xs">
                      {it.size_snapshot}
                    </Text>
                  ) : null}
                </div>
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

      <div className="mt-4 rounded-none p-3" style={{ background: '#FAFAFA' }}>
        <Row label="ยอดสินค้า" value={baht(order.subtotal)} />
        {order.delivery_fee ? <Row label="ค่าจัดส่ง" value={baht(order.delivery_fee)} /> : null}
        {order.discount_amount ? (
          <Row label="ส่วนลด" value={`-${baht(order.discount_amount)}`} />
        ) : null}
        <Divider style={{ margin: '8px 0' }} />
        <Row label="ยอดรวมทั้งสิ้น" value={baht(order.total)} strong />
      </div>

      {slipUrl || isSlipPending(order) ? (
        <>
          <Divider titlePlacement="left" style={{ margin: '20px 0 12px' }}>
            สลิปการชำระเงิน
          </Divider>
          {slipUrl ? (
            <Image
              src={slipUrl}
              alt="สลิป"
              style={{ borderRadius: 0, maxHeight: 360 }}
              /* รูปโหลดไม่ขึ้นทีหลัง (ลิงก์หมดอายุ/เน็ตหลุดกลางทาง) ต้องกลับไปสถานะ
                 "ยังไม่ได้เห็นสลิป" ด้วย ไม่ใช่ปล่อยกรอบว่างแล้วปุ่มอนุมัติยังกดได้ */
              onError={() => {
                setSlipUrl(null);
                setSlipErr('โหลดรูปสลิปไม่สำเร็จ (ลิงก์อาจหมดอายุ)');
              }}
            />
          ) : slipErr ? (
            <Alert type="warning" showIcon title="เปิดดูสลิปไม่ได้" description={slipErr} />
          ) : (
            <Text type="secondary">ยังไม่มีสลิปแนบมาในออเดอร์นี้</Text>
          )}
          {isSlipPending(order) ? (
            <Space className="mt-3" style={{ width: '100%' }} wrap>
              {/* ★ ไม่เห็นสลิป = อนุมัติไม่ได้ ★ เดิมปุ่มนี้ผูกกับสถานะอย่างเดียว ไม่ได้ผูกกับ
                  รูป เวลาเซ็นลิงก์ไม่ผ่านจอจะขึ้นว่าไม่พบสลิปแล้ววางปุ่มสีหลักไว้ใต้ข้อความ
                  นั้นพอดี กดแล้วออเดอร์เป็น paid + confirmed โดยไม่มีใครเห็นหลักฐานการโอน
                  และไม่มี RPC ถอนการอนุมัติ ทางกลับมีทางเดียวคือยกเลิกแล้วโอนเงินคืน */}
              <Popconfirm
                title={`ยืนยันว่าได้รับเงิน ${baht(order.total)} จริง`}
                description="อนุมัติแล้วถอนกลับไม่ได้ — ต้องยกเลิกออเดอร์แล้วโอนเงินคืนเท่านั้น"
                okText="ได้รับเงินแล้ว"
                cancelText="ยังไม่ใช่"
                disabled={!slipUrl}
                onConfirm={() =>
                  void runAction(() => approveSlip(order.id, order.row_version), 'อนุมัติสลิปแล้ว')
                }>
                <Button type="primary" loading={busy} disabled={!slipUrl}>
                  อนุมัติสลิป
                </Button>
              </Popconfirm>
              <Button danger loading={busy} onClick={() => setRejectOpen(true)}>
                ปฏิเสธสลิป
              </Button>
              {!slipUrl ? (
                <Button loading={slipBusy} onClick={() => void retrySlip()}>
                  ลองโหลดรูปใหม่
                </Button>
              ) : null}
            </Space>
          ) : (
            // Decided already — keep the slip on screen as the record of what was
            // approved, and say so, so the empty space isn't read as "buttons gone,
            // did my click work?"
            <div className="mt-3">
              <Tag color={PAYMENT_STATUS[order.payment_status]?.color ?? 'default'}>
                {PAYMENT_STATUS[order.payment_status]?.label ?? order.payment_status}
              </Tag>
              <Text type="secondary" className="ml-1">
                ตรวจสอบแล้ว — เก็บสลิปไว้เป็นหลักฐาน
              </Text>
            </div>
          )}
        </>
      ) : null}

      <Divider style={{ margin: '20px 0 12px' }} />
      <Space direction="vertical" style={{ width: '100%' }}>
        {next ? (
          next === 'picked_up' ? (
            /* Shipping an online order — collect the tracking number first so
               the customer's picked_up push carries it (0046). */
            <Button
              type="primary"
              block
              loading={busy}
              onClick={() => {
                setShipNo(trackingNo ?? '');
                setShipOpen(true);
              }}>
              เลื่อนสถานะถัดไป → {ORDER_STATUS[next].label}
            </Button>
          ) : (
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
          )
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
      <Modal
        open={shipOpen}
        title="ส่งพัสดุเข้าขนส่ง"
        onCancel={() => setShipOpen(false)}
        footer={[
          <Button
            key="skip"
            loading={busy}
            onClick={async () => {
              setShipOpen(false);
              await runAction(
                () => advanceOrder(order.id, 'picked_up', order.row_version),
                'เลื่อนสถานะแล้ว (ยังไม่ใส่เลขพัสดุ)',
              );
            }}>
            เลื่อนโดยยังไม่ใส่เลข
          </Button>,
          <Button
            key="ship"
            type="primary"
            disabled={!shipNo.trim()}
            loading={busy}
            onClick={async () => {
              const no = shipNo.trim();
              setShipOpen(false);
              await runAction(async () => {
                await setOrderTrackingNo(order.id, no);
                await advanceOrder(order.id, 'picked_up', order.row_version);
              }, 'บันทึกเลขพัสดุและเลื่อนสถานะแล้ว');
              setTrackingNo(no);
            }}>
            บันทึกและเลื่อนสถานะ
          </Button>,
        ]}>
        <Text type="secondary">
          กรอกเลขพัสดุจากใบเสร็จขนส่ง ลูกค้าจะได้รับแจ้งเตือนพร้อมเลขพัสดุนี้ทันที
        </Text>
        <Input
          className="mt-3"
          placeholder="เช่น TH0116ABC1234"
          value={shipNo}
          maxLength={40}
          autoFocus
          onChange={(e) => setShipNo(e.target.value)}
        />
      </Modal>
      <ReasonModal
        open={cancelOpen}
        title="ยกเลิกออเดอร์"
        okText="ยกเลิกออเดอร์"
        danger
        options={CANCEL_OPTIONS}
        warning={
          shippedOut ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={`ของออกจากร้านไปแล้ว (${ORDER_STATUS[order.order_status].label})`}
              description={`ยกเลิกแล้วระบบจะคืนสต๊อก${totalQty ? ` ${totalQty} ชิ้น` : 'ทุกบรรทัดในใบนี้'}เข้าระบบทันที ถ้าของยังไม่กลับมาถึงร้าน ตัวเลขสต๊อกจะเกินจริง · เมื่อพัสดุตีกลับมาแล้วอย่ารับเข้าซ้ำ ไม่งั้นยอดจะบวกสองเท่า`}
            />
          ) : null
        }
        onClose={() => setCancelOpen(false)}
        onSubmit={async (reason, note) => {
          setCancelOpen(false);
          await runAction(async () => {
            const res = (await cancelOrder(
              order.id,
              reason as CancelReason,
              note,
              order.row_version,
            )) as { refund_owed?: boolean } | null;
            /* ★ ยกเลิกใบที่ลูกค้าโอนเงินมาแล้ว = ร้านติดหนี้ทันที ★ cancel_order ตั้งแถว
               refunds ให้เงียบ ๆ แล้วคืน refund_owed มาเป็น true/false (ยอดเงินไม่ได้มาด้วย
               — เท่ากับยอดเต็มของใบนี้) เดิมหน้าจอทิ้งค่านี้ทั้งก้อนแล้วขึ้นแค่ "ยกเลิกออเดอร์
               แล้ว" คนกดจึงไม่มีทางรู้ว่ายังถือเงินลูกค้าอยู่ · ต้องค้างจอให้กดรับทราบ ไม่ใช่
               toast ที่หายไปเองใน 3 วินาที */
            if (res?.refund_owed) {
              modal.warning({
                title: 'ต้องโอนเงินคืนลูกค้า',
                width: 440,
                okText: 'รับทราบ',
                content: (
                  <div className="mt-2">
                    <div>
                      ออเดอร์ {order.order_number} รับเงินมาแล้ว — ต้องโอนคืน{' '}
                      <span className="font-semibold text-[#E5484D]">{baht(order.total)}</span>
                    </div>
                    <div className="mt-1">
                      {order.ship_recipient ?? 'ลูกค้า'} · {order.ship_phone ?? 'ไม่มีเบอร์ติดต่อ'}
                    </div>
                    <div className="mt-2 text-[13px] text-[#8a807a]">
                      รายการนี้ไปรออยู่ในแถบแดง “ต้องโอนเงินคืนลูกค้า” ด้านบนหน้าออเดอร์ ·
                      โอนคืนแล้วกลับมากดยืนยันด้วย
                    </div>
                  </div>
                ),
              });
            }
          }, 'ยกเลิกออเดอร์แล้ว');
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
  warning,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  okText: string;
  danger?: boolean;
  options: { value: string; label: string }[];
  /** คำเตือนที่ต้องอ่านก่อนกดยืนยัน (ถ้ามี) — วางไว้เหนือฟอร์ม ไม่ใช่ใต้ปุ่ม */
  warning?: ReactNode;
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
      {warning}
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
