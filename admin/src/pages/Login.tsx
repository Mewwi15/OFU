import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth';

const { Title, Text } = Typography;

export function Login() {
  const { session, isAdmin, ready, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && session && isAdmin) return <Navigate to="/pos" replace />;

  const onFinish = async (v: { email: string; password: string }) => {
    setBusy(true);
    setError(null);
    try {
      await signIn(v.email.trim(), v.password);
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: '#FBF2EC' }}>
      <Card style={{ maxWidth: 380, width: '100%' }} styles={{ body: { padding: 28 } }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#F15929] text-white grid place-items-center text-xl font-semibold">
            อ
          </div>
          <Title level={4} style={{ margin: 0 }}>อู้ฟู่ แอดมิน</Title>
          <Text type="secondary">เข้าสู่ระบบเพื่อจัดการร้าน</Text>
        </div>
        <Form layout="vertical" requiredMark={false} onFinish={onFinish} initialValues={{ email: '', password: '' }}>
          <Form.Item name="email" label="อีเมล" rules={[{ required: true, message: 'กรอกอีเมล' }]}>
            <Input type="email" size="large" placeholder="admin@oofoo.local" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true, message: 'กรอกรหัสผ่าน' }]}>
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          {error ? <Alert type="error" showIcon title={error} className="mb-3" /> : null}
          {ready && session && !isAdmin ? <Alert type="warning" showIcon title="บัญชีนี้ไม่ใช่แอดมิน" className="mb-3" /> : null}
          <Button type="primary" htmlType="submit" size="large" block loading={busy}>
            เข้าสู่ระบบ
          </Button>
        </Form>
      </Card>
    </div>
  );
}
