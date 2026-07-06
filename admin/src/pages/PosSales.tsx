import { RiRefund2Line, RiSearchLine } from '@remixicon/react';
import { App, Button, Card, Drawer, Input, Popconfirm, Segmented, Select, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';

import {
  apiError,
  getPosSaleItems,
  listPosSales,
  refundPosSale,
  type PosSale,
  type PosSaleItem,
} from '../lib/api';

const { Title, Text } = Typography;
const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const PAY: Record<string, { label: string; color: string }> = {
  cash: { label: 'เงินสด', color: 'gold' },
  promptpay: { label: 'พร้อมเพย์', color: 'blue' },
  store_credit: { label: 'เครดิตร้าน', color: 'purple' },
};
const STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'สำเร็จ', color: 'success' },
  refunded: { label: 'คืนเงินแล้ว', color: 'error' },
  voided: { label: 'ยกเลิก', color: 'default' },
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const timeParts = (iso: string) => {
  const d = new Date(iso);
  return { date: d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }), time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) };
};

export function PosSales() {
  const { message } = App.useApp();
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PosSale | null>(null);
  const [items, setItems] = useState<PosSaleItem[]>([]);
  const [refunding, setRefunding] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [pay, setPay] = useState<string>('all');

  async function load() {
    setLoading(true);
    try {
      setSales(await listPosSales());
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function openDetail(s: PosSale) {
    setDetail(s);
    setItems([]);
    try {
      setItems(await getPosSaleItems(s.id));
    } catch (e) {
      message.error(apiError(e));
    }
  }

  async function refund(s: PosSale) {
    setRefunding(true);
    try {
      await refundPosSale(s.id);
      message.success(`คืนเงินบิล ${s.sale_number} แล้ว`);
      setDetail(null);
      await load();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setRefunding(false);
    }
  }

  // ── daily summary (from the loaded window) ────────────────────────────────
  const summary = useMemo(() => {
    const todays = sales.filter((s) => isToday(s.created_at) && s.status !== 'refunded');
    return {
      todayTotal: todays.reduce((a, s) => a + s.total, 0),
      todayCount: todays.length,
      shownCount: sales.length,
      refundedCount: sales.filter((s) => s.status === 'refunded').length,
    };
  }, [sales]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (pay !== 'all' && s.payment_method !== pay) return false;
      if (q && !s.sale_number.toLowerCase().includes(q) && !(s.customer_name ?? '').toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [sales, query, status, pay]);

  const columns: ColumnsType<PosSale> = [
    {
      title: 'เลขที่บิล',
      dataIndex: 'sale_number',
      key: 'no',
      render: (v: string, s) => (
        <div>
          <div className="font-semibold text-[#2B2320]">{v}</div>
          {s.customer_name && <div className="text-xs text-gray-400">{s.customer_name}</div>}
        </div>
      ),
    },
    {
      title: 'เวลา',
      key: 'time',
      render: (_, s) => {
        const t = timeParts(s.created_at);
        return (
          <div className="leading-tight">
            <div className="text-[#2B2320]">{t.time}</div>
            <div className="text-xs text-gray-400">{t.date}</div>
          </div>
        );
      },
    },
    {
      title: 'วิธีชำระ',
      key: 'pay',
      render: (_, s) => (
        <Tag color={PAY[s.payment_method]?.color} variant="filled">
          {PAY[s.payment_method]?.label ?? s.payment_method}
        </Tag>
      ),
    },
    {
      title: 'ยอด',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      sorter: (a, b) => a.total - b.total,
      render: (v: number, s) => (
        <span className={`font-semibold ${s.status === 'refunded' ? 'text-gray-400 line-through' : 'text-[#2B2320]'}`}>
          {baht(v)}
        </span>
      ),
    },
    {
      title: 'สถานะ',
      key: 'status',
      align: 'center',
      width: 130,
      render: (_, s) => (
        <Tag color={STATUS[s.status]?.color} variant="filled">
          {STATUS[s.status]?.label ?? s.status}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'view',
      align: 'right',
      width: 72,
      render: (_, s) => (
        <Button size="small" type="link" onClick={() => void openDetail(s)}>
          ดูบิล
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            บิลขายหน้าร้าน
          </Title>
          <Text type="secondary">ประวัติการขาย POS · แตะที่บิลเพื่อดูรายละเอียด / คืนเงิน</Text>
        </div>
        <Button onClick={() => void load()}>รีเฟรช</Button>
      </div>

      {/* daily summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic
            title="ยอดขายวันนี้"
            value={summary.todayTotal}
            prefix="฿"
            styles={{ content: { color: '#c5410f', fontWeight: 700 } }}
          />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="บิลวันนี้" value={summary.todayCount} suffix="บิล" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic title="บิลล่าสุด (แสดง)" value={summary.shownCount} suffix="บิล" />
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Statistic
            title="คืนเงิน"
            value={summary.refundedCount}
            suffix="บิล"
            styles={{ content: { color: summary.refundedCount ? '#E5484D' : undefined } }}
          />
        </Card>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขบิล / ชื่อลูกค้า"
          prefix={<RiSearchLine className="w-4 h-4 text-gray-400" />}
          style={{ width: 240 }}
        />
        <Select
          value={pay}
          onChange={setPay}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: 'ทุกวิธีชำระ' },
            { value: 'cash', label: 'เงินสด' },
            { value: 'promptpay', label: 'พร้อมเพย์' },
            { value: 'store_credit', label: 'เครดิตร้าน' },
          ]}
        />
        <Segmented
          value={status}
          onChange={(v) => setStatus(v as string)}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'completed', label: 'สำเร็จ' },
            { value: 'refunded', label: 'คืนเงิน' },
          ]}
        />
      </div>

      <Table<PosSale>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={shown}
        onRow={(s) => ({ onClick: () => void openDetail(s), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 15, hideOnSinglePage: true, showTotal: (t) => `${t} บิล` }}
        scroll={{ x: 640 }}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        size="default"
        title={detail ? `บิล ${detail.sale_number}` : ''}
        extra={
          detail?.status === 'completed' ? (
            <Popconfirm
              title="คืนเงินบิลนี้?"
              description="สินค้าจะถูกคืนเข้าสต็อก"
              okText="คืนเงิน"
              cancelText="ยกเลิก"
              okButtonProps={{ danger: true, loading: refunding }}
              onConfirm={() => void refund(detail)}>
              <Button danger icon={<RiRefund2Line className="w-4 h-4" />}>
                คืนเงิน
              </Button>
            </Popconfirm>
          ) : detail?.status === 'refunded' ? (
            <Tag color="error" variant="filled">
              คืนเงินแล้ว
            </Tag>
          ) : null
        }>
        {detail && (
          <>
            <div className="flex items-center justify-between">
              <Text type="secondary">{new Date(detail.created_at).toLocaleString('th-TH')}</Text>
              <Tag color={PAY[detail.payment_method]?.color} variant="filled">
                {PAY[detail.payment_method]?.label ?? detail.payment_method}
              </Tag>
            </div>
            <Table<PosSaleItem>
              className="mt-3"
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={items}
              columns={[
                { title: 'รายการ', key: 'name', render: (_, i) => (i.size ? `${i.product_name} (${i.size})` : i.product_name) },
                { title: 'จำนวน', dataIndex: 'qty', key: 'qty', align: 'center', width: 70 },
                { title: 'รวม', dataIndex: 'line_total', key: 'lt', align: 'right', width: 90, render: (v: number) => baht(v) },
              ]}
            />
            <div className="mt-4 space-y-1 text-sm">
              {detail.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ส่วนลด</span>
                  <span>−{baht(detail.discount)}</span>
                </div>
              )}
              {detail.vat_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">VAT</span>
                  <span>{baht(detail.vat_amount)}</span>
                </div>
              )}
              {detail.tax_invoice_no && (
                <div className="flex justify-between">
                  <span className="text-gray-500">เลขใบกำกับ</span>
                  <span>{detail.tax_invoice_no}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-1 border-t" style={{ borderColor: '#F0EAE6' }}>
                <span>ยอดสุทธิ</span>
                <span className="text-tremor-brand-emphasis">{baht(detail.total)}</span>
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
