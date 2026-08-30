/**
 * จอเปิดรอบ — ใช้ร่วมกันทั้งหน้าเปิด-ปิดรอบ และด่านเปิดรอบในหน้าขายหน้าร้าน
 *
 * เจ้าของสรุปหลักการให้เอง 30 ส.ค. 2026: "ระบบ POS ที่ดีที่สุดคือการบอกให้ผู้ใช้
 * ชัดเจน ไม่ใช่แบบตัวหนังสือเล็ก ๆ ไม่ชัดเจน เยอะเกินไป และเรียงโฟลไม่ชัดเจน"
 *
 * รอบก่อนผมวางสามขั้นเรียงลงมาพร้อมกัน แล้วหรี่ขั้นที่ยังไม่ถึงเป็น opacity .45
 * ผลคือสองในสามของการ์ดเป็นสีเทาตาย เจ้าของบอกสั้น ๆ ว่า "ไม่สวย" — และถูก
 * มันไม่ได้อ่านว่า "ทำข้อ 1 ก่อน" แต่อ่านว่าจอเสีย ของที่ยังทำไม่ได้ไม่ควรอยู่บนจอ
 * ตั้งแต่แรก
 *
 * ตอนนี้เป็นทีละขั้นจริง — บนจอมีของแค่ขั้นที่กำลังทำ ที่เหลือย่อเป็นจุดสามจุด
 * ข้างบน หัวการ์ดเป็นแถบเขียวของแบรนด์เพื่อให้มันดูเป็นเครื่องขายของ ไม่ใช่ฟอร์ม
 * กรอกเอกสารสีขาวล้วน และใช้ Card ของ antd เพื่อให้ได้เงานุ่มชุดเดียวกับการ์ด
 * อื่นทั้งระบบ (index.css เติมให้ .ant-card-bordered) — ของเดิมผมทำเป็น div เปล่า
 * มันเลยแบนอยู่ตัวเดียวในแอป
 */

import { RiArrowLeftLine, RiCalculatorLine, RiPrinterLine } from '@remixicon/react';
import { Button, Card, Input, message } from 'antd';
import { useEffect, useState } from 'react';

import { apiError, listShifts, listStaff, openShift, type Staff } from '../lib/api';
import { getShopName } from '../lib/orders';
import { printCashCountSheet, printCountKickSlip, printShiftOpenSlip } from '../lib/printDrawer';
import { CashCountModal, type CountLine } from './CashCountModal';
import { LiveClock } from './LiveClock';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const C = { brand: '#5B8C6E', brandDark: '#4A7259', err: '#E5484D' };
const INK = { strong: '#2B2320', body: '#5C534E', mute: '#8C837D', hair: '#E8E8E8' } as const;
const num = { fontVariantNumeric: 'tabular-nums' } as const;

const STEPS = ['รหัสพนักงาน', 'นับเงิน', 'ยืนยัน'] as const;

export function OpenShiftPanel({ onOpened }: { onOpened: () => void }) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [counted, setCounted] = useState<number | null>(null);
  const [countLines, setCountLines] = useState<CountLine[]>([]);   // แจกแจงทีละชนิดไว้ปริ้น
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ยอดที่นับได้ตอนปิดรอบที่แล้ว = เงินที่ควรจะยังอยู่ในลิ้นชักเช้านี้ ไม่เอามาเติมให้
   * (นั่นคือการข้ามการนับ) แต่เอาไว้เทียบหลังนับเสร็จ ถ้ากลางคืนเงินหายจะได้เห็น */
  const [expected, setExpected] = useState<number | null>(null);
  useEffect(() => {
    listShifts()
      .then((rows) => setExpected(rows.find((r) => r.closed_at)?.counted_cash ?? null))
      .catch(() => {});
  }, []);

  /* รายชื่อพนักงานไว้เฉลยชื่อทันทีที่พิมพ์รหัสถูก (0087) — คนหน้าเครื่องจะได้เห็นว่า
   * พิมพ์ถูกคนก่อนกดถัดไป ไม่ใช่ไปรู้ตอนกดเปิดรอบแล้วเด้ง error
   * ลิสต์ว่าง = ยังไม่ได้ตั้งพนักงาน ระบบยังปล่อยผ่านทุกรหัส (ฝั่ง RPC ก็เหมือนกัน) */
  const [staff, setStaff] = useState<Staff[] | null>(null);
  useEffect(() => { listStaff().then(setStaff).catch(() => setStaff([])); }, []);

  const noStaffYet = staff != null && staff.length === 0;
  const matched = staff?.find((p) => p.code === code && p.active) ?? null;
  const codeOk = code !== '' && (noStaffYet || matched != null);

  const submit = async () => {
    setBusy(true);
    try {
      await openShift(counted ?? 0, code);
      onOpened();
      /* งานพิมพ์คือสิ่งที่ทำให้ลิ้นชักเด้ง (ดู printDrawer.ts) และตอนนี้คือจังหวะที่ต้อง
       * เอาเงินทอนใส่ ล้มก็ปล่อยผ่าน — รอบเปิดสำเร็จแล้ว ห้ามให้เครื่องพิมพ์มาคว่ำ */
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

  /* กดปุ่มนับ = ลิ้นชักต้องเปิด ทุกครั้ง รวมทั้งตอน "นับใหม่" ด้วย เพราะคนที่กด
   * นับใหม่มักปิดลิ้นชักไปแล้ว งานพิมพ์คือสิ่งเดียวที่สั่งให้สลักเด้งได้ (printDrawer.ts)
   * ล้มก็ปล่อยผ่าน ตัวนับต้องเปิดให้ได้อยู่ดี ไม่งั้นเครื่องพิมพ์พังแล้วนับเงินไม่ได้เลย */
  const startCount = async () => {
    setCounting(true);
    try {
      printCountKickSlip(await getShopName().catch(() => 'ร้านอู้ฟู่'), matched?.name ?? code);
    } catch {
      message.warning('เปิดลิ้นชักไม่ได้ — พิมพ์สลิปไม่สำเร็จ');
    }
  };

  const printCount = async () => {
    try {
      printCashCountSheet({
        shopName: await getShopName().catch(() => 'ร้านอู้ฟู่'),
        at: new Date().toISOString(),
        cashier: matched?.name ?? code,
        lines: countLines,
        total: counted ?? 0,
      });
    } catch {
      message.warning('พิมพ์ใบนับเงินไม่ได้');
    }
  };

  const diff = counted != null && expected != null ? counted - expected : null;

  return (
    <>
      <Card
        style={{ width: 460, maxWidth: '94vw' }}
        styles={{ body: { padding: 0, overflow: 'hidden' } }}
      >
        {/* หัวการ์ดสีแบรนด์ — ให้จอมีสี ไม่ใช่ขาวล้วนเหมือนฟอร์มกรอกเอกสาร */}
        <div className="px-7 pt-6 pb-5 text-center" style={{ background: C.brand }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}>เปิดรอบ</div>
          <div style={{ marginTop: 2, opacity: 0.85 }}>
            <LiveClock size={15} color="#fff" />
          </div>
        </div>

        {/* จุดบอกขั้น — ย่อสามขั้นเหลือแถวเดียว แทนที่จะวางกองไว้ทั้งสามขั้น */}
        <div
          className="flex items-center justify-center gap-2 py-3"
          style={{ background: C.brandDark }}
        >
          {STEPS.map((label, i) => (
            <span
              key={label}
              className="px-3 py-1"
              style={{
                fontSize: 12,
                fontWeight: i === step ? 700 : 400,
                color: i === step ? C.brandDark : 'rgba(255,255,255,.72)',
                background: i === step ? '#fff' : 'transparent',
              }}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        <div className="px-7 py-7">
          {/* ── ขั้น 1: รหัสพนักงาน ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: INK.strong, textAlign: 'center' }}>
                ใส่รหัสพนักงาน
              </div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, '').slice(0, 20))}
                onPressEnter={() => codeOk && setStep(1)}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                className="mt-4"
                style={{
                  height: 72, fontSize: 34, fontWeight: 700, textAlign: 'center',
                  letterSpacing: '.18em', color: INK.strong, ...num,
                }}
              />
              <div className="mt-3 text-center" style={{ minHeight: 26 }}>
                {matched && (
                  <span style={{ fontSize: 20, fontWeight: 600, color: C.brandDark }}>{matched.name}</span>
                )}
                {code !== '' && !matched && !noStaffYet && (
                  <span style={{ fontSize: 15, color: C.err }}>ไม่มีรหัสนี้ในระบบ</span>
                )}
              </div>
              <Button
                type="primary" size="large" block
                disabled={!codeOk}
                className="mt-2"
                style={{ height: 60, fontSize: 20, fontWeight: 600 }}
                onClick={() => setStep(1)}
              >
                ถัดไป
              </Button>
            </>
          )}

          {/* ── ขั้น 2: นับเงิน ────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: INK.strong, textAlign: 'center' }}>
                นับเงินในลิ้นชัก
              </div>
              <div
                className="mt-4 py-6 text-center"
                style={{ background: counted == null ? '#FAFAFA' : '#F3F7F4' }}
              >
                <div style={{ fontSize: 13, color: INK.mute }}>นับได้</div>
                <div
                  style={{
                    fontSize: 46, fontWeight: 700, lineHeight: 1.15, marginTop: 2, ...num,
                    color: counted == null ? INK.hair : INK.strong,
                  }}
                >
                  {counted == null ? '฿0' : baht(counted)}
                </div>
              </div>
              <Button
                type={counted == null ? 'primary' : 'default'}
                size="large" block
                icon={<RiCalculatorLine className="w-5 h-5" />}
                className="mt-4"
                style={{ height: 60, fontSize: 20, fontWeight: 600 }}
                onClick={() => void startCount()}
              >
                {counted == null ? 'เริ่มนับ' : 'นับใหม่'}
              </Button>
              {counted != null && (
                <Button
                  type="primary" size="large" block
                  className="mt-3"
                  style={{ height: 60, fontSize: 20, fontWeight: 600 }}
                  onClick={() => setStep(2)}
                >
                  ถัดไป
                </Button>
              )}
            </>
          )}

          {/* ── ขั้น 3: ยืนยัน ─────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: INK.strong, textAlign: 'center' }}>
                ตรวจแล้วกดเปิดรอบ
              </div>

              <div className="mt-4" style={{ border: `1px solid ${INK.hair}` }}>
                <div className="flex items-center justify-between px-5 py-3">
                  <span style={{ fontSize: 15, color: INK.body }}>พนักงาน</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: INK.strong }}>
                    {matched ? `${matched.name} ` : ''}
                    <span style={{ ...num }}>({code})</span>
                  </span>
                </div>
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderTop: `1px solid ${INK.hair}` }}
                >
                  <span style={{ fontSize: 15, color: INK.body }}>เงินในลิ้นชัก</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: INK.strong, ...num }}>
                    {baht(counted ?? 0)}
                  </span>
                </div>
              </div>

              {/* เงียบสนิทถ้าตรงกับยอดปิดเมื่อวาน ขึ้นเฉพาะตอนไม่ตรง = เงินหาย/เกินข้ามคืน */}
              {diff != null && diff !== 0 && (
                <div
                  className="mt-3 flex items-center justify-between px-5 py-3"
                  style={{ background: '#FFF6F6', borderLeft: `4px solid ${C.err}` }}
                >
                  <span style={{ fontSize: 14, color: INK.body, ...num }}>
                    รอบที่แล้วปิดด้วย {baht(expected ?? 0)}
                  </span>
                  <span style={{ fontSize: 19, fontWeight: 700, color: C.err, ...num }}>
                    {diff > 0 ? `เกิน ${baht(diff)}` : `ขาด ${baht(-diff)}`}
                  </span>
                </div>
              )}

              {/* ปริ้นใบนับเงินก่อนกดเปิดรอบได้ — เจ้าของสั่งให้ขั้นนี้ปริ้นได้ว่าเงิน
                  ในลิ้นชักมีเท่าไหร่ ใบนี้แจกแจงทีละชนิด ต่างจากใบเปิดรอบที่บอกแต่ยอดรวม */}
              <Button
                size="large" block
                icon={<RiPrinterLine className="w-5 h-5" />}
                className="mt-4"
                style={{ height: 56, fontSize: 18 }}
                onClick={() => void printCount()}
              >
                พิมพ์ใบนับเงิน
              </Button>
              <Button
                type="primary" size="large" block
                loading={busy}
                className="mt-3"
                style={{ height: 60, fontSize: 20, fontWeight: 700 }}
                onClick={() => void submit()}
              >
                เปิดรอบ
              </Button>
            </>
          )}

          {step > 0 && !busy && (
            <Button
              type="text" block
              className="mt-2"
              style={{ height: 44, color: INK.mute }}
              icon={<RiArrowLeftLine className="w-4 h-4" />}
              onClick={() => setStep(step - 1)}
            >
              ย้อนกลับ
            </Button>
          )}
        </div>
      </Card>

      <CashCountModal
        open={counting}
        onClose={() => setCounting(false)}
        onDone={(total, lines) => { setCounted(total); setCountLines(lines); setCounting(false); }}
      />
    </>
  );
}
