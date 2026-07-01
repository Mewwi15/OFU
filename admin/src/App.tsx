import { Card, Empty, Typography } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Broadcast } from './pages/Broadcast';
import { Categories } from './pages/Categories';
import { Featured } from './pages/Featured';
import { Login } from './pages/Login';
import { Orders } from './pages/Orders';
import { Pos } from './pages/Pos';
import { PosSales } from './pages/PosSales';
import { Products } from './pages/Products';
import { Reports } from './pages/Reports';

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
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/pos-sales" element={<PosSales />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/featured" element={<Featured />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/banners" element={<Placeholder title="แบนเนอร์" />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/payments" element={<Placeholder title="ตรวจสลิป" />} />
      </Route>
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>
        {title}
      </Typography.Title>
      <Card>
        <Empty description="เร็วๆ นี้" />
      </Card>
    </>
  );
}
