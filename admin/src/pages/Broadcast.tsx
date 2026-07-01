import { RiMegaphoneLine } from '@remixicon/react';
import { App, Alert, Button, Card, Form, Input, Select, Typography } from 'antd';
import { useState } from 'react';

import { apiError, broadcastNotification, type BroadcastResult } from '../lib/api';

const { Title, Text } = Typography;

const CATEGORIES = [
  { value: 'promo', label: 'โปรโมชัน' },
  { value: 'shop', label: 'ประกาศร้าน' },
  { value: 'system', label: 'ระบบ' },
];

export function Broadcast() {
  const { modal, message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const onFinish = (v: { title: string; body?: string; category: string }) => {
    modal.confirm({
      title: 'ส่งแจ้งเตือนนี้หาลูกค้าทุกคน?',
      content: v.title,
      okText: 'ส่ง',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setBusy(true);
        setResult(null);
        try {
          const r = await broadcastNotification({
            title: v.title.trim(),
            body: v.body?.trim() || undefined,
            category: v.category,
          });
          setResult(r);
          form.resetFields();
        } catch (e) {
          message.error(apiError(e));
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>ส่งแจ้งเตือน</Title>
        <Text type="secondary">ส่งโปรโมชันหรือประกาศ — เข้าฟีดในแอป + เด้งบนมือถือลูกค้าทุกคน</Text>
      </div>

      <Card style={{ maxWidth: 640 }}>
        {result ? (
          <Alert
            type="success"
            showIcon
            className="mb-5"
            message="ส่งแล้ว"
            description={`เข้าฟีด ${result.recipients} คน · ส่ง push ${result.push} เครื่อง`}
          />
        ) : null}

        <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} initialValues={{ category: 'promo' }}>
          <Form.Item name="title" label="หัวข้อ" rules={[{ required: true, message: 'กรุณากรอกหัวข้อ' }]}>
            <Input placeholder="เช่น ลด 10% วันนี้เท่านั้น!" />
          </Form.Item>
          <Form.Item name="body" label="ข้อความ">
            <Input.TextArea rows={3} placeholder="รายละเอียดโปรโมชัน…" />
          </Form.Item>
          <Form.Item name="category" label="ประเภท">
            <Select options={CATEGORIES} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} icon={<RiMegaphoneLine className="w-4 h-4" />}>
            ส่งหาลูกค้าทุกคน
          </Button>
        </Form>
      </Card>
    </>
  );
}
