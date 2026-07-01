import { RiRefund2Line } from '@remixicon/react';
import { App, Button, Drawer, Popconfirm, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';

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

const PAY_LABEL: Record<string, string> = { cash: 'เงินสด', promptpay: 'พร้อมเพย์', store_credit: 'เครดิตร้าน' };
const STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'สำเร็จ', color: 'success' },
  refunded: { label: 'คืนเงินแล้ว', color: 'error' },
  voided: { label: 'ยกเลิก', color: 'default' },
};

export function PosSales() {
  const { message } = App.useApp();
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PosSale | null>(null);
  const [items, setItems] = useState<PosSaleItem[]>([]);
  const [refunding, setRefunding] = useState(false);

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

  const columns: ColumnsType<PosSale> = [
    { title: 'เลขที่บิล', dataIndex: 'sale_number', key: 'no', render: (v: string) => <span className="font-medium text-[#2B2320]">{v}</span> },
    { title: 'เวลา', key: 'time', render: (_, s) => <Text type="secondary">{new Date(s.created_at).toLocaleString('th-TH')}</Text> },
    { title: 'วิธีชำระ', key: 'pay', render: (_, s) => PAY_LABEL[s.payment_method] ?? s.payment_method },
    { title: 'ยอด', dataIndex: 'total', key: 'total', align: 'right', render: (v: number) => <span className="font-medium">{baht(v)}</span> },
    {
      title: 'สถานะ',
      key: 'status',
      align: 'center',
      width: 130,
      render: (_, s) => <Tag color={STATUS[s.status]?.color} bordered={false}>{STATUS[s.status]?.label ?? s.status}</Tag>,
    },
    { title: '', key: 'view', align: 'right', width: 80, render: (_, s) => <Button size="small" onClick={() => void openDetail(s)}>ดู</Button> },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>บิลขายหน้าร้าน</Title>
          <Text type="secondary">ประวัติการขาย POS · คืนเงินได้</Text>
        </div>
        <Button onClick={() => void load()}>รีเฟรช</Button>
      </div>

      <Table<PosSale>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={sales}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        scroll={{ x: 640 }}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        width={420}
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
            <Tag color="error" bordered={false}>คืนเงินแล้ว</Tag>
          ) : null
        }>
        {detail && (
          <>
            <Text type="secondary">{new Date(detail.created_at).toLocaleString('th-TH')}</Text>
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
                <div className="flex justify-between"><span className="text-gray-500">ส่วนลด</span><span>−{baht(detail.discount)}</span></div>
              )}
              {detail.vat_amount > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">VAT</span><span>{baht(detail.vat_amount)}</span></div>
              )}
              <div className="flex justify-between text-base font-semibold pt-1 border-t" style={{ borderColor: '#F0EAE6' }}>
                <span>ยอดสุทธิ</span>
                <span className="text-tremor-brand-emphasis">{baht(detail.total)}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">ชำระโดย</span><span>{PAY_LABEL[detail.payment_method]}</span></div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
