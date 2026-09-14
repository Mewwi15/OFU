import { notification } from 'antd';
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { installFlightRecorder, recordNav } from './lib/flightRecorder';
import { watchForNewVersion } from './lib/newVersion';
import { installScannerGuard } from './lib/scannerGuard';
import { Login } from './pages/Login';
import { Pos } from './pages/Pos';

/* ★ โหลดหน้าที่กดเข้าไปเท่านั้น ★ (แก้อาการ "แอปอืด" ที่เจ้าของแจ้ง 14 ก.ย. 2026)
   เดิมทุกหน้า (23 หน้า รวมรายงาน/ผังสินค้า/ห้องแชต) ถูกยัดรวมเป็นก้อนเดียว 1.5 MB
   แล้วโหลดทั้งหมดตั้งแต่เปิดเว็บ ทั้งที่คนเปิดมาขายของใช้หน้าเดียว
   หน้าขายกับหน้าล็อกอินยังอยู่ในก้อนแรก เพราะเป็นสองหน้าที่เปิดขึ้นมาต้องเจอทันที
   ถ้าให้โหลดทีหลังจะเห็นจอว่างแวบหนึ่งทุกครั้งที่เปิดเครื่องขาย */
const AuditLog = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Deploys = lazy(() => import('./pages/Deploys').then((m) => ({ default: m.Deploys })));
const Banners = lazy(() => import('./pages/Banners').then((m) => ({ default: m.Banners })));
const Broadcast = lazy(() => import('./pages/Broadcast').then((m) => ({ default: m.Broadcast })));
const Categories = lazy(() => import('./pages/Categories').then((m) => ({ default: m.Categories })));
const Chat = lazy(() => import('./pages/Chat').then((m) => ({ default: m.Chat })));
const DeleteAccountInfo = lazy(() => import('./pages/DeleteAccountInfo').then((m) => ({ default: m.DeleteAccountInfo })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const Orders = lazy(() => import('./pages/Orders').then((m) => ({ default: m.Orders })));
const PosSales = lazy(() => import('./pages/PosSales').then((m) => ({ default: m.PosSales })));
const Products = lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })));
const Receive = lazy(() => import('./pages/Receive').then((m) => ({ default: m.Receive })));
const Shift = lazy(() => import('./pages/Shift').then((m) => ({ default: m.Shift })));
const MemberRewards = lazy(() => import('./pages/MemberRewards').then((m) => ({ default: m.MemberRewards })));
const Promotions = lazy(() => import('./pages/Promotions').then((m) => ({ default: m.Promotions })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Stock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.Stock })));
const ScanLab = lazy(() => import('./pages/ScanLab').then((m) => ({ default: m.ScanLab })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Staff = lazy(() => import('./pages/Staff').then((m) => ({ default: m.Staff })));
const StoreCredit = lazy(() => import('./pages/StoreCredit').then((m) => ({ default: m.StoreCredit })));

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
    installScannerGuard();
  }, []);

  /* ── มีเวอร์ชันใหม่ขึ้นแล้ว ── (เจ้าของแจ้ง 14 ก.ย. 2026 ว่าเครื่องอื่นค้างรุ่นเก่า)
     ★ บอกอย่างเดียว ไม่รีเฟรชให้เอง ★ เครื่องนี้อาจกำลังคีย์บิลหรือนับเงินอยู่ —
     รีเฟรชให้เองกลางคันแย่กว่าการใช้รุ่นเก่าต่ออีกชั่วโมง
     ค้างไว้จนกว่าจะกด (duration 0) เพราะถ้าหายไปเองคนที่เดินมาทีหลังจะไม่เคยรู้ */
  useEffect(() => {
    return watchForNewVersion(() => {
      notification.info({
        key: 'new-version',
        message: 'มีเวอร์ชันใหม่แล้ว',
        description: 'กดรีเฟรชเพื่อใช้รุ่นล่าสุด — บิลที่คีย์ค้างไว้จะยังอยู่',
        placement: 'bottomRight',
        duration: 0,
        btn: (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-tremor-brand px-4 py-1.5 text-white">
            รีเฟรชตอนนี้
          </button>
        ),
      });
    });
  }, []);
  useEffect(() => {
    recordNav(location.pathname);
  }, [location.pathname]);

  return (
    <ErrorBoundary>
      {/* ข้อความสั้น ๆ ระหว่างดึงหน้าที่เพิ่งกด — ขึ้นแค่ครั้งแรกของแต่ละหน้า หลังจากนั้น
          เบราว์เซอร์เก็บไว้ในแคชยาว (ตั้ง immutable ไว้ใน vercel.json) */}
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-tremor-content">
            กำลังโหลด…
          </div>
        }>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Public — store compliance pages (Play Data Safety / App Store links). */}
        <Route path="/delete-account" element={<DeleteAccountInfo />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/pos-sales" element={<PosSales />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/member-rewards" element={<MemberRewards />} />
          <Route path="/store-credit" element={<StoreCredit />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/banners" element={<Banners />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/deploys" element={<Deploys />} />
          <Route path="/scan-lab" element={<ScanLab />} />
        </Route>
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
