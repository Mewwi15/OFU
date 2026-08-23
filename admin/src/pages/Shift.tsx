/**
 * เปิด-ปิดรอบขาย — พิธีเช้า/เย็นของลิ้นชักเงิน (ต่อหน้าจอให้ open/close_shift
 * ที่หลังบ้านมีมาตั้งแต่ 0019 แต่ไม่เคยถูกเรียก · เจ้าของขอ 23 ส.ค.)
 *
 * เช้า:  กรอกเงินตั้งต้นในลิ้นชัก → เปิดรอบ
 * ระหว่างวัน: หน้านี้โชว์สด ๆ ว่า "ตอนนี้ลิ้นชักควรมีเท่าไหร่"
 *            (ตั้งต้น + เงินสด POS + เงินสด COD — ตัวเลขจาก pos_dashboard
 *            ช่วงเวลาของรอบ ให้ตรงตรรกะเดียวกับหน้ารายงาน)
 * เย็น:  นับเงินจริง → ปิดรอบ → เห็นทันทีว่า พอดี / ขาด / เกิน เท่าไหร่
 *        (ตัวเลขตัดสินมาจาก close_shift ฝั่งเซิร์ฟเวอร์ — หน้าจอเป็นแค่พรีวิว)
 */

import { Alert, Button, Card, Collapse, Descriptions, InputNumber, Modal, Statistic, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import {
  apiError,
  closeShift,
  getOpenShift,
  openShift,
  posDashboard,
  type Dashboard,
  type Shift as ShiftRow,
} from '../lib/api';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

export function Shift() {
  const [shift, setShift] = useState<ShiftRow | null | undefined>(undefined); // undefined = loading
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [float, setFloat] = useState<number | ''>('');
  const [counted, setCounted] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [justClosed, setJustClosed] = useState<ShiftRow | null>(null);

  const refresh = useCallback(async () => {
    const s = await getOpenShift().catch(() => null);
    setShift(s);
    if (s) setDash(await posDashboard(s.opened_at, new Date().toISOString()).catch(() => null));
  }, []);

  useEffect(() => {
    void refresh();
    // ระหว่างเปิดหน้าค้างไว้ ตัวเลขเดินเองทุกครึ่งนาที — ไว้ชำเลืองระหว่างวัน
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const doOpen = async () => {
    setBusy(true);
    try {
      await openShift(Number(float) || 0);
      message.success('เปิดรอบแล้ว — ขายได้เลย');
      setFloat('');
      setJustClosed(null);
      await refresh();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  // ตัวเลขพรีวิวระหว่างวัน (ของจริงตอนปิดมาจากเซิร์ฟเวอร์)
  const cashInShift = dash?.onsite.cash ?? 0; // รวม COD แล้ว (ตรรกะเดียวกับหน้ารายงาน)
  const expectedNow = (shift?.opening_float ?? 0) + cashInShift;
  const diff = counted === '' ? null : Number(counted) - expectedNow;

  const doClose = () => {
    if (!shift || counted === '') return;
    Modal.confirm({
      title: 'ยืนยันปิดรอบ?',
      content: `นับเงินจริงได้ ${baht(Number(counted))} — ปิดแล้วแก้ไม่ได้`,
      okText: 'ปิดรอบ',
      cancelText: 'ยังก่อน',
      onOk: async () => {
        try {
          const r = await closeShift(shift.id, Number(counted));
          setJustClosed(r);
          setShift(null);
          setDash(null);
          setCounted('');
          message.success('ปิดรอบเรียบร้อย');
        } catch (e) {
          message.error(apiError(e));
        }
      },
    });
  };

  if (shift === undefined) return <Card loading title="เปิด-ปิดรอบขาย" />;

  /* ── ยังไม่เปิดรอบ ── */
  if (!shift) {
    return (
      <div className="flex flex-col gap-4 max-w-xl">
        {justClosed ? <ClosedSummary row={justClosed} /> : null}
        <Card title="เปิดรอบขาย">
          <Typography.Paragraph type="secondary">
            นับเงินทอนตั้งต้นในลิ้นชัก แล้วเปิดรอบก่อนเริ่มขายของวัน — บิลทุกใบหลังจากนี้
            จะถูกนับเข้ารอบ เพื่อให้ตอนเย็นรู้ว่าลิ้นชักควรมีเงินเท่าไหร่
          </Typography.Paragraph>
          <div className="flex gap-2 items-center">
            <InputNumber
              min={0}
              size="large"
              placeholder="เงินตั้งต้น เช่น 1000"
              style={{ width: 220 }}
              value={float === '' ? undefined : float}
              onChange={(v) => setFloat(v ?? '')}
              autoFocus
            />
            <Button type="primary" size="large" loading={busy} onClick={() => void doOpen()}>
              เปิดรอบ
            </Button>
          </div>
          <Collapse
            ghost
            className="mt-2"
            items={[{
              key: 'count',
              label: 'นับตามชนิดแบงก์/เหรียญ',
              children: <CashCounter onTotal={setFloat} />,
            }]}
          />
        </Card>
      </div>
    );
  }

  /* ── รอบเปิดอยู่ ── */
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Card title={`รอบปัจจุบัน — เปิดเมื่อ ${dayjs(shift.opened_at).format('DD/MM HH:mm')}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Statistic title="เงินตั้งต้น" value={shift.opening_float} prefix="฿" />
          <Statistic title="เงินสดขายในรอบ (รวม COD)" value={cashInShift} prefix="฿" />
          <Statistic title="โอน PromptPay" value={dash?.onsite.promptpay ?? 0} prefix="฿" />
          <Statistic
            title="ลิ้นชักควรมีตอนนี้"
            value={expectedNow}
            prefix="฿"
            valueStyle={{ fontWeight: 700 }}
          />
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          ตัวเลขเดินเองทุก 30 วินาที · โอน/เครดิตไม่อยู่ในลิ้นชักจึงไม่ถูกนับรวม
        </Typography.Text>
      </Card>

      <Card title="ปิดรอบ — นับเงินในลิ้นชัก">
        <div className="flex gap-2 items-center flex-wrap">
          <InputNumber
            min={0}
            size="large"
            placeholder="นับได้จริง เช่น 4520"
            style={{ width: 220 }}
            value={counted === '' ? undefined : counted}
            onChange={(v) => setCounted(v ?? '')}
          />
          <Button danger type="primary" size="large" disabled={counted === ''} onClick={doClose}>
            ปิดรอบ
          </Button>
          {diff != null ? (
            <Typography.Text
              strong
              style={{ color: diff === 0 ? 'var(--ant-color-success)' : diff < 0 ? 'var(--ant-color-error)' : 'var(--ant-color-warning)' }}>
              {diff === 0 ? 'พอดีเป๊ะ' : diff < 0 ? `ขาด ${baht(-diff)}` : `เกิน ${baht(diff)}`}
            </Typography.Text>
          ) : null}
        </div>
        <Collapse
          ghost
          className="mt-2"
          items={[{
            key: 'count',
            label: 'นับตามชนิดแบงก์/เหรียญ',
            children: <CashCounter onTotal={setCounted} />,
          }]}
        />
      </Card>
    </div>
  );
}

function ClosedSummary({ row }: { row: ShiftRow }) {
  const os = row.over_short ?? 0;
  return (
    <Alert
      type={os === 0 ? 'success' : os < 0 ? 'error' : 'warning'}
      showIcon
      message={
        os === 0 ? 'ปิดรอบแล้ว — เงินพอดีเป๊ะ'
        : os < 0 ? `ปิดรอบแล้ว — เงินขาด ${baht(-os)}`
        : `ปิดรอบแล้ว — เงินเกิน ${baht(os)}`
      }
      description={
        <Descriptions
          size="small"
          column={1}
          items={[
            { key: 'e', label: 'ลิ้นชักควรมี', children: baht(row.expected_cash ?? 0) },
            { key: 'c', label: 'นับได้จริง', children: baht(row.counted_cash ?? 0) },
            { key: 't', label: 'ปิดเมื่อ', children: row.closed_at ? dayjs(row.closed_at).format('DD/MM/YYYY HH:mm') : '-' },
          ]}
        />
      }
    />
  );
}

/* ── ตารางนับแบงก์/เหรียญ (เจ้าของขอ 23 ส.ค.) ────────────────────────────────
 * ครบทุกชนิดเงินไทย: 1000/500/100/50/20 แบงก์ · 10/5/2/1 เหรียญ · 50/25 สตางค์
 * กรอกจำนวนใบ/เหรียญ ระบบคูณ-รวมให้ แล้วดันยอดขึ้นช่องหลักอัตโนมัติ
 * (ราคาขายของร้านเป็นบาทเต็ม สตางค์แทบไม่โผล่ — แต่มีช่องให้ครบตามขอ
 *  ถ้ายอดรวมมีเศษสตางค์ ระบบบันทึกแบบปัดเป็นบาทเต็ม)
 */
const DENOMS: { value: number; label: string; kind: 'แบงก์' | 'เหรียญ' | 'สตางค์' }[] = [
  { value: 1000, label: '1,000', kind: 'แบงก์' },
  { value: 500, label: '500', kind: 'แบงก์' },
  { value: 100, label: '100', kind: 'แบงก์' },
  { value: 50, label: '50', kind: 'แบงก์' },
  { value: 20, label: '20', kind: 'แบงก์' },
  { value: 10, label: '10', kind: 'เหรียญ' },
  { value: 5, label: '5', kind: 'เหรียญ' },
  { value: 2, label: '2', kind: 'เหรียญ' },
  { value: 1, label: '1', kind: 'เหรียญ' },
  { value: 0.5, label: '50 สต.', kind: 'สตางค์' },
  { value: 0.25, label: '25 สต.', kind: 'สตางค์' },
];

function CashCounter({ onTotal }: { onTotal: (total: number) => void }) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const total = DENOMS.reduce((s, d) => s + d.value * (counts[d.value] ?? 0), 0);

  const setCount = (denom: number, qty: number | null) => {
    const next = { ...counts, [denom]: qty ?? 0 };
    setCounts(next);
    onTotal(Math.round(DENOMS.reduce((s, d) => s + d.value * (next[d.value] ?? 0), 0)));
  };

  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'auto 110px 1fr' }}>
        {DENOMS.map((d) => (
          <div key={d.value} className="contents">
            <Typography.Text style={{ alignSelf: 'center', minWidth: 86 }}>
              {d.kind} {d.label}
            </Typography.Text>
            <InputNumber
              min={0}
              placeholder="0"
              value={counts[d.value] || undefined}
              onChange={(v) => setCount(d.value, v)}
            />
            <Typography.Text type="secondary" style={{ alignSelf: 'center' }}>
              {counts[d.value] ? `= ฿${(d.value * counts[d.value]).toLocaleString('th-TH')}` : ''}
            </Typography.Text>
          </div>
        ))}
      </div>
      <Typography.Title level={5} style={{ marginTop: 12 }}>
        รวม {`฿${total.toLocaleString('th-TH')}`}
      </Typography.Title>
    </div>
  );
}
