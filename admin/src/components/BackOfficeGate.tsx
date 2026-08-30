/**
 * ด่านรหัสเข้าหลังร้าน — เจ้าของสั่ง 30 ส.ค. 2026
 *
 * เครื่อง POS ตั้งอยู่หน้าเคาน์เตอร์และล็อกอินค้างไว้ทั้งวัน ใครเดินมาก็กดเข้า
 * รายงาน ต้นทุน เครดิตลูกค้า หรือตั้งค่าได้หมด ด่านนี้ทำให้เส้นแบ่งหน้าร้าน/หลังร้าน
 * ที่เพิ่งทำในเมนูข้างมีผลจริง ไม่ใช่แค่หัวข้อคั่น
 *
 * ⚠️ นี่คือด่านกันคนเดินผ่าน ไม่ใช่ระบบสิทธิ์ — ใครเปิด devtools ก็ข้ามได้ ของจริง
 *    ที่กันข้อมูลอยู่คือ RLS กับ admin_tier ในฐานข้อมูลเหมือนเดิม รหัสนี้แค่แยก
 *    "เผลอกด" ออกจาก "ตั้งใจเข้า"
 *
 * ปลดล็อกแล้วจำไว้ใน sessionStorage — ผูกกับแท็บ ปิดแท็บก็ลืม และหมดอายุใน 30 นาที
 * ไม่ใช้ localStorage เพราะนั่นแปลว่าปลดครั้งเดียวจบตลอดกาลบนเครื่องนั้น
 * ซึ่งเท่ากับไม่มีด่าน
 */

import { RiLock2Line } from '@remixicon/react';
import { Button, Card, Input, message } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiError, backOfficePinSet, verifyBackOfficePin } from '../lib/api';

/** เส้นทางที่นับเป็นหลังร้าน — ต้องตรงกับกลุ่ม "หลังร้าน" ใน Sidebar.tsx */
const BACK_OFFICE_PATHS = [
  '/stock', '/receive', '/products', '/categories', '/promotions', '/banners',
  '/broadcast', '/reports', '/store-credit', '/audit-log', '/deploys', '/settings',
  '/scan-lab',
];

const isBackOffice = (pathname: string) =>
  BACK_OFFICE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const KEY = 'ofu.backOffice.unlockedUntil';
const WINDOW_MS = 30 * 60 * 1000;

function unlocked(): boolean {
  try {
    const until = Number(sessionStorage.getItem(KEY) ?? 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function markUnlocked() {
  try {
    sessionStorage.setItem(KEY, String(Date.now() + WINDOW_MS));
  } catch {
    /* โหมดส่วนตัว/ปิด storage — ก็แค่ต้องใส่รหัสใหม่ทุกครั้ง ไม่ถึงกับพัง */
  }
}

const C = { brand: '#5B8C6E' };
const INK = { strong: '#2B2320', body: '#5C534E' } as const;

export function BackOfficeGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gated = isBackOffice(pathname);

  // null = ยังไม่รู้ว่าร้านนี้ตั้งรหัสไว้หรือยัง (อย่าเพิ่งตัดสินว่าต้องใส่)
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [ok, setOk] = useState(unlocked);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    backOfficePinSet().then(setPinExists).catch(() => setPinExists(false));
  }, []);

  // เข้าหน้าหลังร้านใหม่ทุกครั้ง เช็กว่าหน้าต่างเวลายังไม่หมดอายุ
  useEffect(() => {
    if (gated) setOk(unlocked());
  }, [gated, pathname]);

  const submit = async () => {
    setBusy(true);
    try {
      if (await verifyBackOfficePin(pin)) {
        markUnlocked();
        setOk(true);
        setPin('');
      } else {
        message.error('รหัสไม่ถูกต้อง');
        setPin('');
        inputRef.current?.focus();
      }
    } catch (e) {
      message.error(apiError(e));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  if (!gated || ok || pinExists === false) return <>{children}</>;
  if (pinExists === null) return null;   // รอคำตอบ อย่าเพิ่งกะพริบด่านขึ้นมา

  return (
    <div className="grid place-items-center" style={{ minHeight: '70vh' }}>
      <Card style={{ width: 420, maxWidth: '94vw' }} styles={{ body: { padding: 0, overflow: 'hidden' } }}>
        <div className="px-7 pt-6 pb-5 text-center" style={{ background: C.brand }}>
          <RiLock2Line className="w-8 h-8 mx-auto" style={{ color: '#fff' }} />
          <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginTop: 6, lineHeight: 1.2 }}>
            หลังร้าน
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
            ใส่รหัสเพื่อเข้า
          </div>
        </div>

        <div className="px-7 py-7">
          <Input.Password
            ref={inputRef}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onPressEnter={() => pin && void submit()}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            style={{ height: 68, fontSize: 30, fontWeight: 700, letterSpacing: '.3em', textAlign: 'center' }}
          />
          <Button
            type="primary" size="large" block
            loading={busy}
            disabled={pin === ''}
            className="mt-4"
            style={{ height: 56, fontSize: 19, fontWeight: 600 }}
            onClick={() => void submit()}
          >
            เข้าหลังร้าน
          </Button>
          <Button
            type="text" block
            className="mt-2"
            style={{ height: 44, color: INK.body }}
            onClick={() => navigate('/pos')}
          >
            กลับไปหน้าขาย
          </Button>
          <div style={{ fontSize: 12, color: INK.strong, opacity: 0.45, textAlign: 'center', marginTop: 10 }}>
            ปลดล็อกแล้วใช้ได้ 30 นาที
          </div>
        </div>
      </Card>
    </div>
  );
}
