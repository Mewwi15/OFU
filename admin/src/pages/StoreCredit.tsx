import { RiSearchLine, RiWallet3Line } from '@remixicon/react';
import { App, Button, Card, Empty, Form, Input, InputNumber, Modal, Statistic, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import {
  apiError,
  findCustomerByPhone,
  listStoreCredit,
  topupStoreCredit,
  type CreditEntry,
  type Customer,
} from '../lib/api';

const { Title, Text } = Typography;
const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const REASON_LABEL: Record<string, string> = { topup: 'เติมเครดิต', pos_sale: 'ใช้ซื้อสินค้า', pos_refund: 'คืนเงิน' };

export function StoreCredit() {
  const { message } = App.useApp();
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [topupOpen, setTopupOpen] = useState(false);

  async function search() {
    const p = phone.trim();
    if (!p) return;
    setSearching(true);
    setNotFound(false);
    try {
      const c = await findCustomerByPhone(p);
      setCustomer(c);
      setNotFound(!c);
      if (c) setEntries(await listStoreCredit(c.user_id));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setSearching(false);
    }
  }

  async function refresh(userId: string) {
    const c = await findCustomerByPhone(phone.trim());
    setCustomer(c);
    setEntries(await listStoreCredit(userId));
  }

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>เครดิตร้าน</Title>
        <Text type="secondary">ค้นหาลูกค้าด้วยเบอร์โทร เติมเครดิต และดูประวัติ</Text>
      </div>

      <div className="flex gap-2 mb-4" style={{ maxWidth: 420 }}>
        <Input
          prefix={<RiSearchLine className="w-4 h-4 text-gray-400" />}
          placeholder="เบอร์โทรลูกค้า เช่น 0812345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onPressEnter={() => void search()}
          allowClear
        />
        <Button type="primary" loading={searching} onClick={() => void search()}>
          ค้นหา
        </Button>
      </div>

      {notFound && (
        <Card>
          <Empty description="ไม่พบลูกค้าที่ใช้เบอร์นี้" />
        </Card>
      )}

      {customer && (
        <>
          <Card
            size="small"
            className="mb-4"
            styles={{ body: { display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '12px 16px' } }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-none grid place-items-center" style={{ background: '#F5F5F5' }}>
                <RiWallet3Line className="w-6 h-6" style={{ color: '#5B8C6E' }} />
              </div>
              <div>
                <div className="font-semibold text-[#2B2320]">{customer.display_name || 'ลูกค้า'}</div>
                <Text type="secondary">{customer.phone}</Text>
              </div>
            </div>
            <Statistic title="เครดิตคงเหลือ" value={customer.balance} prefix="฿" valueStyle={{ color: '#5B8C6E', fontWeight: 700 }} />
            <Button type="primary" className="ml-auto" onClick={() => setTopupOpen(true)}>
              เติมเครดิต
            </Button>
          </Card>

          <Card title="ประวัติเครดิต">
            <Table<CreditEntry>
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              dataSource={entries}
              locale={{ emptyText: 'ยังไม่มีรายการ' }}
              columns={[
                { title: 'เวลา', key: 'time', render: (_, e) => new Date(e.created_at).toLocaleString('th-TH') },
                {
                  title: 'รายการ',
                  key: 'reason',
                  render: (_, e) => REASON_LABEL[e.reason] ?? e.reason,
                },
                {
                  title: 'จำนวน',
                  key: 'delta',
                  align: 'right',
                  render: (_, e) => (
                    <Tag color={e.delta >= 0 ? 'success' : 'error'} bordered={false}>
                      {e.delta >= 0 ? '+' : ''}
                      {baht(e.delta)}
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>

          {topupOpen && (
            <TopupModal
              customer={customer}
              onClose={() => setTopupOpen(false)}
              onDone={async () => {
                setTopupOpen(false);
                await refresh(customer.user_id);
                message.success('เติมเครดิตแล้ว');
              }}
            />
          )}
        </>
      )}
    </>
  );
}

function TopupModal({ customer, onClose, onDone }: { customer: Customer; onClose: () => void; onDone: () => Promise<void> }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await topupStoreCredit(customer.user_id, Number(v.amount), v.note?.trim() || undefined);
      await onDone();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };
  return (
    <Modal open title={`เติมเครดิต — ${customer.display_name || customer.phone}`} onCancel={onClose} onOk={() => void submit()} okText="เติมเครดิต" cancelText="ยกเลิก" confirmLoading={busy} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} className="mt-2" initialValues={{ amount: null, note: '' }}>
        <Form.Item name="amount" label="จำนวนเงิน (฿)" rules={[{ required: true, message: 'ใส่จำนวนเงิน' }]}>
          <InputNumber min={1} prefix="฿" style={{ width: '100%' }} autoFocus />
        </Form.Item>
        <Form.Item name="note" label="หมายเหตุ (ถ้ามี)">
          <Input placeholder="เช่น เติมเงินสด" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
