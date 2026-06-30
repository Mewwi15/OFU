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
      // session/profile flow in via the auth listener; if the account isn't an
      // admin, the protected routes bounce back here.
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="brand">
          อู้ฟู่ <span>· แอดมิน</span>
        </div>
        <label>อีเมล</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@oofoo.local"
          autoComplete="username"
        />
        <label>รหัสผ่าน</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button className="btn" style={{ width: '100%', marginTop: 18 }} disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
        {ready && session && !isAdmin ? (
          <div className="err">บัญชีนี้ไม่ใช่แอดมิน</div>
        ) : null}
        {error ? <div className="err">{error}</div> : null}
      </form>
    </div>
  );
}
