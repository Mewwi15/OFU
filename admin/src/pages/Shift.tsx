/**
 * เปิด-ปิดรอบขาย — พิธีเช้า/เย็นของลิ้นชักเงิน (ต่อหน้าจอให้ open/close_shift
 * ที่หลังบ้านมีมาตั้งแต่ 0019 แต่ไม่เคยถูกเรียก · เจ้าของขอ 23 ส.ค.)
 *
 * ตัวนับเงินเป็นแบบเดียวกับหน้า "นำเงินเข้า" ของ ETS ที่เจ้าของใช้จนชิน
 * (ขอเป็นภาพตัวอย่างมาเลย): ตารางชนิดเงิน + แป้นตัวเลขบนจอ — จิ้มแถว กดเลข
 * Enter เลื่อนแถวถัดไป C ล้างช่อง Cls ล้างทั้งตาราง · คีย์บอร์ดจริงก็ใช้ได้
 *
 * เช้า:  นับเงินตั้งต้น → เปิดรอบ
 * ระหว่างวัน: เห็นสด ๆ ว่าลิ้นชักควรมีเท่าไหร่ (ตั้งต้น + เงินสด POS + COD
 *            — ตัวเลขจาก pos_dashboard ช่วงเวลาของรอบ ตรรกะเดียวกับหน้ารายงาน)
 * เย็น:  นับเงินจริง → เห็น พอดี/ขาด/เกิน → ปิดรอบ (ตัวตัดสินจริงมาจากเซิร์ฟเวอร์)
 */

import { Alert, Button, Card, Descriptions, InputNumber, Modal, Statistic, Typography, message } from 'antd';
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
  const [counterFor, setCounterFor] = useState<'float' | 'counted' | null>(null);

  const refresh = useCallback(async () => {
    const s = await getOpenShift().catch(() => null);
    setShift(s);
    if (s) setDash(await posDashboard(s.opened_at, new Date().toISOString()).catch(() => null));
  }, []);

  useEffect(() => {
    void refresh();
    // เปิดหน้าค้างไว้ ตัวเลขเดินเองทุกครึ่งนาที — ไว้ชำเลืองระหว่างวัน
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

  const counterModal = (
    <CashCountModal
      open={counterFor !== null}
      onClose={() => setCounterFor(null)}
      onDone={(total) => {
        if (counterFor === 'float') setFloat(total);
        if (counterFor === 'counted') setCounted(total);
        setCounterFor(null);
      }}
    />
  );

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
          <div className="flex gap-2 items-center flex-wrap">
            <InputNumber
              min={0}
              size="large"
              placeholder="เงินตั้งต้น เช่น 1000"
              style={{ width: 200 }}
              value={float === '' ? undefined : float}
              onChange={(v) => setFloat(v ?? '')}
              autoFocus
            />
            <Button size="large" onClick={() => setCounterFor('float')}>
              นับเงิน
            </Button>
            <Button type="primary" size="large" loading={busy} onClick={() => void doOpen()}>
              เปิดรอบ
            </Button>
          </div>
        </Card>
        {counterModal}
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
            style={{ width: 200 }}
            value={counted === '' ? undefined : counted}
            onChange={(v) => setCounted(v ?? '')}
          />
          <Button size="large" onClick={() => setCounterFor('counted')}>
            นับเงิน
          </Button>
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
      </Card>
      {counterModal}
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

/* ═══ ตัวนับเงินสไตล์ ETS "นำเงินเข้า" ═══════════════════════════════════════
 * ตารางชนิดเงิน (แถวที่เลือกไฮไลต์) + แป้นตัวเลขบนจอสำหรับจอสัมผัส
 *   ตัวเลข   = พิมพ์จำนวนใบ/เหรียญของแถวที่เลือก
 *   Enter    = แถวถัดไป · C = ล้างช่องนี้ · Cls = ล้างทั้งตาราง
 * คีย์บอร์ดจริงใช้ได้เหมือนกัน (0-9, Backspace, Enter, ลูกศรขึ้นลง)
 */
const DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25] as const;
const denomLabel = (v: number) =>
  v >= 20 ? `ธนบัตร ${v.toLocaleString('th-TH')}` : v >= 1 ? `เหรียญ ${v}` : `เหรียญ ${v * 100} สต.`;

function CashCountModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (total: number) => void;
}) {
  const [counts, setCounts] = useState<number[]>(() => DENOMS.map(() => 0));
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setCounts(DENOMS.map(() => 0));
      setActive(0);
    }
  }, [open]);

  const total = counts.reduce((s, c, i) => s + c * DENOMS[i], 0);

  const press = useCallback(
    (key: string) => {
      setCounts((prev) => {
        const next = [...prev];
        if (key === 'C') next[active] = 0;
        else if (key === 'Cls') return DENOMS.map(() => 0);
        else if (key === 'back') next[active] = Math.floor(next[active] / 10);
        else if (/^\d$/.test(key)) next[active] = Math.min(next[active] * 10 + Number(key), 99999);
        return next;
      });
      if (key === 'Enter') setActive((a) => (a + 1) % DENOMS.length);
    },
    [active],
  );

  // คีย์บอร์ดจริง — เฉพาะตอนโมดัลเปิด
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') press('Enter');
      else if (e.key === 'ArrowDown') setActive((a) => (a + 1) % DENOMS.length);
      else if (e.key === 'ArrowUp') setActive((a) => (a - 1 + DENOMS.length) % DENOMS.length);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, press]);

  const pad: string[][] = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['0', 'C', 'Cls'],
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="นับเงิน — แบงก์/เหรียญ"
      width={640}
      footer={
        <div className="flex items-center justify-between">
          <Typography.Title level={4} style={{ margin: 0 }}>
            รวม {baht(Math.round(total))}
          </Typography.Title>
          <div className="flex gap-2">
            <Button size="large" onClick={onClose}>
              ปิด
            </Button>
            <Button size="large" type="primary" onClick={() => onDone(Math.round(total))}>
              ใช้ยอดนี้
            </Button>
          </div>
        </div>
      }>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 190px' }}>
        {/* ตารางชนิดเงิน */}
        <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--ant-color-border)' }}>
          <div
            className="grid text-xs font-semibold py-1.5 px-2"
            style={{ gridTemplateColumns: '1fr 72px 92px', background: 'var(--ant-color-fill-tertiary)' }}>
            <span>ธนบัตร / เหรียญ</span>
            <span className="text-right">จำนวน</span>
            <span className="text-right">รวม</span>
          </div>
          {DENOMS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setActive(i)}
              className="grid w-full text-left py-1.5 px-2 border-t"
              style={{
                gridTemplateColumns: '1fr 72px 92px',
                borderColor: 'var(--ant-color-border-secondary)',
                background: i === active ? 'var(--ant-color-primary-bg)' : undefined,
                outline: i === active ? '2px solid var(--ant-color-primary)' : undefined,
                outlineOffset: -2,
              }}>
              <span>{denomLabel(d)}</span>
              <span className="text-right font-mono">{counts[i] || 0}</span>
              <span className="text-right font-mono">
                {counts[i] ? (d * counts[i]).toLocaleString('th-TH') : '0'}
              </span>
            </button>
          ))}
        </div>

        {/* แป้นตัวเลข */}
        <div className="flex flex-col gap-2">
          {pad.map((row) => (
            <div key={row.join()} className="grid grid-cols-3 gap-2">
              {row.map((k) => (
                <Button
                  key={k}
                  size="large"
                  style={{ height: 52, fontWeight: 600 }}
                  danger={k === 'Cls'}
                  onClick={() => press(k)}>
                  {k}
                </Button>
              ))}
            </div>
          ))}
          <Button size="large" type="primary" style={{ height: 52 }} onClick={() => press('Enter')}>
            Enter — แถวถัดไป
          </Button>
        </div>
      </div>
    </Modal>
  );
}
