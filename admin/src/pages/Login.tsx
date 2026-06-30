import { Button, Card, TextInput } from '@tremor/react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth';

export function Login() {
  const { session, isAdmin, ready, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && session && isAdmin) return <Navigate to="/products" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <Card className="max-w-sm w-full">
        <div className="text-center mb-6 text-2xl font-semibold">
          อู้ฟู่ <span className="text-tremor-brand">· แอดมิน</span>
        </div>
        <form onSubmit={onSubmit} className="space-y-1">
          <label className="text-tremor-label text-tremor-content">อีเมล</label>
          <TextInput
            type="email"
            value={email}
            onValueChange={setEmail}
            placeholder="admin@oofoo.local"
            autoComplete="username"
          />
          <label className="text-tremor-label text-tremor-content pt-2 block">รหัสผ่าน</label>
          <TextInput
            type="password"
            value={password}
            onValueChange={setPassword}
            autoComplete="current-password"
          />
          <Button type="submit" loading={busy} className="w-full !mt-6">
            เข้าสู่ระบบ
          </Button>
          {ready && session && !isAdmin ? (
            <p className="text-red-600 text-tremor-default pt-2">บัญชีนี้ไม่ใช่แอดมิน</p>
          ) : null}
          {error ? <p className="text-red-600 text-tremor-default pt-2">{error}</p> : null}
        </form>
      </Card>
    </div>
  );
}
