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
 * ปลดแล้วปลดยาว จะปิดเมื่อไหร่กดปุ่มล็อกบนแถบบนเอง (เจ้าของสั่ง: "จะเปิดก็ใส่
 * ปิดตอนไหนก็ได้") — ตอนแรกผมใส่ตัวจับเวลา 30 นาทีไว้ ถูกสั่งเอาออก
 * สถานะอยู่ใน lib/backOffice.ts เพราะปุ่มล็อกบนแถบบนต้องเห็นสถานะเดียวกัน
 */

import { RiLock2Line } from '@remixicon/react';
import { Button, Card, Input, message } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiError, backOfficePinSet, verifyBackOfficePin } from '../lib/api';
import {
  isBackOfficePath,
  isBackOfficeUnlocked,
  onBackOfficeChange,
  unlockBackOffice,
} from '../lib/backOffice';



const C = { brand: '#5B8C6E' };
const INK = { strong: '#2B2320', body: '#5C534E' } as const;

export function BackOfficeGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gated = isBackOfficePath(pathname);

  // null = ยังไม่รู้ว่าร้านนี้ตั้งรหัสไว้หรือยัง (อย่าเพิ่งตัดสินว่าต้องใส่)
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [ok, setOk] = useState(isBackOfficeUnlocked);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    backOfficePinSet().then(setPinExists).catch(() => setPinExists(false));
  }, []);

  // ตามสถานะกลาง — ปุ่มล็อกบนแถบบนกดเมื่อไหร่ ด่านต้องเด้งกลับมาทันที
  useEffect(() => onBackOfficeChange(() => setOk(isBackOfficeUnlocked())), []);

  const submit = async () => {
    setBusy(true);
    try {
      if (await verifyBackOfficePin(pin)) {
        unlockBackOffice();
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
        </div>
      </Card>
    </div>
  );
}
