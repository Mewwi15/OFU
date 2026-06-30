import { Card, Title } from '@tremor/react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Broadcast } from './pages/Broadcast';
import { Login } from './pages/Login';
import { Products } from './pages/Products';

function Protected({ children }: { children: React.ReactNode }) {
  const { ready, session, isAdmin } = useAuth();
  if (!ready)
    return <div className="min-h-screen flex items-center justify-center text-tremor-content">กำลังโหลด…</div>;
  if (!session || !isAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }>
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="/products" element={<Products />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/banners" element={<Placeholder title="แบนเนอร์" />} />
        <Route path="/orders" element={<Placeholder title="ออเดอร์" />} />
        <Route path="/payments" element={<Placeholder title="ตรวจสลิป" />} />
      </Route>
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <Title className="!text-2xl mb-6">{title}</Title>
      <Card>
        <p className="text-center text-tremor-content py-8">เร็วๆ นี้</p>
      </Card>
    </>
  );
}
