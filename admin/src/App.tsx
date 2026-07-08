import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { installFlightRecorder, recordNav } from './lib/flightRecorder';
import { Banners } from './pages/Banners';
import { Broadcast } from './pages/Broadcast';
import { Categories } from './pages/Categories';
import { Featured } from './pages/Featured';
import { Login } from './pages/Login';
import { Orders } from './pages/Orders';
import { Payments } from './pages/Payments';
import { Pos } from './pages/Pos';
import { PosSales } from './pages/PosSales';
import { Products } from './pages/Products';
import { Reports } from './pages/Reports';
import { ScanLab } from './pages/ScanLab';
import { Settings } from './pages/Settings';
import { StoreCredit } from './pages/StoreCredit';

function Protected({ children }: { children: React.ReactNode }) {
  const { ready, session, isAdmin } = useAuth();
  if (!ready)
    return <div className="min-h-screen flex items-center justify-center text-tremor-content">กำลังโหลด…</div>;
  if (!session || !isAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  // Black box for the scanner haunting: log every keydown + route change;
  // read the tape at /scan-lab.
  const location = useLocation();
  useEffect(() => {
    installFlightRecorder();
  }, []);
  useEffect(() => {
    recordNav(location.pathname);
  }, [location.pathname]);

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
        <Route path="/store-credit" element={<StoreCredit />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/banners" element={<Banners />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/scan-lab" element={<ScanLab />} />
      </Route>
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
