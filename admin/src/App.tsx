import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Products } from './pages/Products';

function Protected({ children }: { children: React.ReactNode }) {
  const { ready, session, isAdmin } = useAuth();
  if (!ready) return <div className="center-note">กำลังโหลด…</div>;
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
      <div className="page-head">
        <h1>{title}</h1>
      </div>
      <div className="card center-note">เร็วๆ นี้</div>
    </>
  );
}
