/**
 * จอเปิดรอบ — ใช้ร่วมกันทั้งหน้าเปิด-ปิดรอบ และด่านเปิดรอบในหน้าขายหน้าร้าน
 *
 * เจ้าของสรุปหลักการให้เอง 30 ส.ค. 2026: "ระบบ POS ที่ดีที่สุดคือการบอกให้ผู้ใช้
 * ชัดเจน ไม่ใช่แบบตัวหนังสือเล็ก ๆ ไม่ชัดเจน เยอะเกินไป และเรียงโฟลไม่ชัดเจน"
 *
 * ของเดิมผิดสามข้อพร้อมกัน: ป้าย "รหัสพนักงาน" 13px จาง ๆ · มีของให้อ่านเต็มการ์ด
 * ทั้งที่ต้องทำแค่สองอย่าง · และไม่มีอะไรบอกว่าต้องทำอะไรก่อนหลัง ปุ่ม "นับเงิน"
 * กับปุ่ม "เปิดรอบ" ยืนอยู่ด้วยกันเฉย ๆ คนใหม่มายืนหน้าเครื่องเดาไม่ออกว่ากดอันไหนก่อน
 *
 * ทำใหม่เป็นขั้นที่นับได้ 1-2-3 เรียงลงมา ขั้นที่ยังไม่ถึงจะจางและกดไม่ได้ ขั้นที่
 * ทำเสร็จติดเครื่องหมายถูก เหลือขั้นเดียวที่สว่างอยู่เสมอ — คนหน้าเครื่องไม่ต้อง
 * อ่านอะไรเลย แค่ทำอันที่สว่าง
 *
 * ตัวหนังสือใหญ่ทั้งจอ (ป้าย 18 · ช่องกรอก 30 · ปุ่ม 22) เพราะจอ POS อยู่ห่างระดับ
 * แขนเหยียดและคนกดคือคนที่กำลังรีบ ไม่ใช่คนนั่งอ่านจอคอม
 */

import { RiCalculatorLine, RiCheckLine } from '@remixicon/react';
import { Button, Input, message } from 'antd';
import { useEffect, useState } from 'react';

import { apiError, listShifts, openShift } from '../lib/api';
import { getShopName } from '../lib/orders';
import { printShiftOpenSlip } from '../lib/printDrawer';
import { CashCountModal } from './CashCountModal';
import { LiveClock } from './LiveClock';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const C = { brand: '#5B8C6E', ok: '#1E9E5C', err: '#E5484D' };
const INK = { strong: '#2B2320', body: '#5C534E', mute: '#B4ADA8', hair: '#E8E8E8' } as const;
const num = { fontVariantNumeric: 'tabular-nums' } as const;

/** หัวขั้น — เลขขั้นตัวใหญ่ + ชื่อขั้น สถานะบอกด้วยความเข้มของสี ไม่ใช่ด้วยคำอธิบาย */
function StepHead({ n, label, state }: { n: number; label: string; state: 'todo' | 'now' | 'done' }) {
  const on = state !== 'todo';
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid place-items-center"
        style={{
          width: 34, height: 34, flex: '0 0 34px',
          background: state === 'done' ? C.ok : on ? C.brand : '#F0EEEC',
          color: on ? '#fff' : INK.mute,
          fontSize: 18, fontWeight: 700, ...num,
        }}
      >
        {state === 'done' ? <RiCheckLine className="w-5 h-5" /> : n}
      </span>
      <span style={{ fontSize: 18, fontWeight: 600, color: on ? INK.strong : INK.mute }}>{label}</span>
    </div>
  );
}

export function OpenShiftPanel({ onOpened }: { onOpened: () => void }) {
  const [code, setCode] = useState('');
  const [counted, setCounted] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState(false);
  /* ยอดที่นับได้ตอนปิดรอบที่แล้ว = เงินที่ควรจะยังอยู่ในลิ้นชักเช้านี้
   * ไม่เอามาเติมให้ (นั่นคือการข้ามการนับ) แต่เอาไว้เทียบหลังนับเสร็จ —
   * ถ้ากลางคืนเงินหายไป เมื่อก่อนไม่มีใครรู้เลยเพราะยอดตั้งต้นถูกยกมาทั้งก้อน */
  const [expected, setExpected] = useState<number | null>(null);
  useEffect(() => {
    listShifts()
      .then((rows) => setExpected(rows.find((r) => r.closed_at)?.counted_cash ?? null))
      .catch(() => {});
  }, []);

  const step1Done = code !== '';
  const step2Done = counted != null;

  const submit = async () => {
    setBusy(true);
    try {
      await openShift(counted ?? 0, code);
      onOpened();
      /* งานพิมพ์คือสิ่งที่ทำให้ลิ้นชักเด้ง (ดู printDrawer.ts) และตอนนี้คือจังหวะที่
       * ต้องเอาเงินทอนใส่ ล้มก็ปล่อยผ่าน — รอบเปิดสำเร็จไปแล้ว ห้ามให้เครื่องพิมพ์
       * มาคว่ำการเปิดรอบ */
      try {
        printShiftOpenSlip({
          shopName: await getShopName().catch(() => 'ร้านอู้ฟู่'),
          openedAt: new Date().toISOString(),
          openingFloat: counted ?? 0,
          cashier: code,
        });
      } catch {
        message.warning('เปิดรอบแล้ว แต่พิมพ์ใบเปิดรอบไม่ได้ — ลิ้นชักอาจไม่เด้ง');
      }
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const row = 'px-6 py-5';

  return (
    <div style={{ background: '#fff', border: `1px solid ${INK.hair}`, width: 520, maxWidth: '94vw' }}>
      <div className="px-6 pt-7 pb-5 text-center">
        <div style={{ fontSize: 38, fontWeight: 700, color: INK.strong, lineHeight: 1.15 }}>เปิดรอบ</div>
        <div className="mt-1">
          <LiveClock size={16} />
        </div>
      </div>

      {/* ── 1. รหัสพนักงาน ─────────────────────────────────────────────── */}
      <div className={row} style={{ borderTop: `1px solid ${INK.hair}` }}>
        <StepHead n={1} label="ใส่รหัสพนักงาน" state={step1Done ? 'done' : 'now'} />
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, '').slice(0, 20))}
          placeholder="รหัสของคุณ"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          className="mt-3"
          style={{ height: 64, fontSize: 30, fontWeight: 700, textAlign: 'center', ...num }}
        />
      </div>

      {/* ── 2. นับเงิน — ล็อกไว้จนกว่าจะมีรหัส ────────────────────────────── */}
      <div className={row} style={{ borderTop: `1px solid ${INK.hair}`, opacity: step1Done ? 1 : 0.45 }}>
        <StepHead n={2} label="นับเงินในลิ้นชัก" state={!step1Done ? 'todo' : step2Done ? 'done' : 'now'} />
        {step2Done ? (
          <div className="mt-3 flex items-center justify-between">
            <span style={{ fontSize: 40, fontWeight: 700, color: INK.strong, lineHeight: 1.1, ...num }}>
              {baht(counted)}
            </span>
            <Button size="large" style={{ height: 48, fontSize: 16 }} onClick={() => setCounting(true)}>
              นับใหม่
            </Button>
          </div>
        ) : (
          <Button
            type="primary" size="large" block
            disabled={!step1Done}
            icon={<RiCalculatorLine className="w-5 h-5" />}
            className="mt-3"
            style={{ height: 64, fontSize: 22 }}
            onClick={() => setCounting(true)}
          >
            นับเงิน
          </Button>
        )}
        {/* เงียบไว้ถ้าตรง — ขึ้นเฉพาะตอนไม่ตรงกับยอดที่ปิดรอบเมื่อวาน ซึ่งแปลว่า
            เงินหายหรือเกินระหว่างที่ปิดร้าน ต้องรู้ก่อนเริ่มขาย ไม่ใช่ไปรู้สิ้นเดือน */}
        {step2Done && expected != null && counted !== expected && (
          <div
            className="mt-3 flex items-center justify-between px-4 py-3"
            style={{ background: '#FFF6F6', borderLeft: `4px solid ${C.err}` }}
          >
            <span style={{ fontSize: 15, color: INK.body, ...num }}>รอบที่แล้วปิดด้วย {baht(expected)}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.err, ...num }}>
              {counted > expected ? `เกิน ${baht(counted - expected)}` : `ขาด ${baht(expected - counted)}`}
            </span>
          </div>
        )}
      </div>

      {/* ── 3. เปิดรอบ ─────────────────────────────────────────────────── */}
      <div className={row} style={{ borderTop: `1px solid ${INK.hair}`, opacity: step2Done ? 1 : 0.45 }}>
        <StepHead n={3} label="เริ่มขาย" state={step2Done ? 'now' : 'todo'} />
        <Button
          type="primary" size="large" block
          loading={busy}
          disabled={!step1Done || !step2Done}
          className="mt-3"
          style={{ height: 64, fontSize: 22, fontWeight: 700 }}
          onClick={() => void submit()}
        >
          เปิดรอบ
        </Button>
      </div>

      <CashCountModal
        open={counting}
        onClose={() => setCounting(false)}
        onDone={(total) => { setCounted(total); setCounting(false); }}
      />
    </div>
  );
}
