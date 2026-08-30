/**
 * เปิด-ปิดรอบขาย — ตรวจว่าเงินในลิ้นชักตรงกับยอดขายไหม
 *
 * เจ้าของสรุป flow ให้เองเมื่อ 30 ส.ค.: "เปิดรอบ → นับเงิน → ใช้งานระบบ →
 * ปิดรอบ → มีเอกสารให้ปริ้น" — สามขั้น จบ. รอบก่อนหน้าผมทำเป็นแดชบอร์ด
 * (ช่องตัวเลขห้าช่อง ยอดขายแยกวิธีจ่าย ขายดีห้าอันดับ) แล้วโดนตีกลับว่า
 * "flow มีแค่นั้น ทำไมมันถึงเยอะจัง" — หน้านี้จึงโชว์ทีละขั้น ขั้นละหนึ่งตัวเลข
 * หนึ่งปุ่ม ของที่เหลือย้ายไปหน้ารายงานซึ่งเป็นบ้านของมันอยู่แล้ว
 *
 * คำที่ใช้เป็นภาษาคนหน้าร้าน ไม่ใช่ศัพท์บัญชี — "เงินในลิ้นชักตอนเปิดร้าน"
 * ไม่ใช่ "เงินตั้งต้น", "เงินในลิ้นชักตอนนี้" ไม่ใช่ "ลิ้นชักควรมี"
 *
 * ตัวนับเงินเป็นแบบเดียวกับหน้า "นำเงินเข้า" ของ ETS ที่เจ้าของใช้จนชิน
 * (ขอเป็นภาพตัวอย่างมาเลย): ตารางชนิดเงิน + แป้นตัวเลขบนจอ
 *
 * หมายเหตุ: ขายหน้าร้านได้ตามปกติแม้ไม่เปิดรอบ (create_pos_sale ไม่บังคับ
 * ตั้งแต่ 0021) — รอบมีไว้เพื่อการนับเงินอย่างเดียว
 */

import { RiCalculatorLine, RiInboxUnarchiveLine, RiPrinterLine } from '@remixicon/react';
import { Alert, Button, Card, InputNumber, Modal, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import {
  apiError,
  closeShift,
  getOpenShift,
  listDrawerOpens,
  listShifts,
  logDrawerOpen,
  openShift,
  posDashboard,
  type Dashboard,
  type DrawerOpen,
  type Shift as ShiftRow,
} from '../lib/api';
import { getShopName } from '../lib/orders';
import { printNoSaleSlip, printShiftOpenSlip } from '../lib/printDrawer';
import { printShiftReport } from '../lib/printShift';
import { getReceiptConfig } from '../lib/receiptConfig';
import { d, since } from '../lib/time';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/* สเกลเดียวทั้งหน้า — เดิมผมสุ่มขนาด 13/14/15/22/28/40/52 ปน ๆ กัน หน้าจึงดู
 * "ทำรวก ๆ" ตามที่เจ้าของทัก ทุกตัวเลขข้างล่างนี้มาจากสเกลเดียว และผิวการ์ด
 * เป็นเหลี่ยมไม่มีเงา ให้ตรงกับธีมแอดมิน (borderRadius: 0 ทั้งระบบ) ที่ผมเผลอ
 * ใส่มุมโค้งกับเงานุ่มสวนไว้ */
const C = { brand: '#5B8C6E', err: '#E5484D', warn: '#E08C00', ok: '#1E9E5C' };
const T = { lbl: 13, body: 14, val: 15, lead: 20, hero: 56 } as const;
const INK = { strong: '#2B2320', body: '#5C534E', mute: '#8C837D', hair: '#E8E8E8', wash: '#FAFAFA' } as const;

/** ขาด/เกิน ใช้ภาษาเดียวกันทุกที่บนหน้านี้ */
function overShort(n: number) {
  if (n === 0) return { text: 'พอดีเป๊ะ', color: C.ok };
  if (n < 0) return { text: `ขาด ${baht(-n)}`, color: C.err };
  return { text: `เกิน ${baht(n)}`, color: C.warn };
}

const num = { fontVariantNumeric: 'tabular-nums' } as const;

/* เหตุผลที่เกิดจริงหน้าร้าน เรียงตามความถี่ — กดปุ่มเดียวจบ ไม่ต้องพิมพ์
 * "อื่น ๆ" ไม่มีในลิสต์ตั้งใจ: ถ้าเลือกได้มันจะกลายเป็นปุ่มที่ทุกคนกด แล้ว log
 * ก็ไร้ความหมายเหมือนไม่ได้บันทึก */
const NO_SALE_REASONS = ['แลกแบงก์ให้ลูกค้า', 'เติมเงินทอน', 'เก็บเงินออกจากลิ้นชัก', 'ตรวจนับเงินระหว่างรอบ'] as const;

function ShiftHistory({ rows }: { rows: ShiftRow[] }) {
  const closed = rows.filter((r) => r.closed_at);
  if (closed.length === 0) return null;
  const off = closed.filter((r) => (r.over_short ?? 0) !== 0).length;
  return (
    <Card
      title="ประวัติรอบที่ผ่านมา"
      extra={
        <Typography.Text style={{ fontSize: 12, color: '#8C837D' }}>
          {closed.length} รอบล่าสุด · เงินไม่ตรง {off} รอบ
        </Typography.Text>
      }
    >
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={closed.slice(0, 10)}
        scroll={{ y: 260 }}
        columns={([
          {
            title: 'วันที่',
            render: (_: unknown, r: ShiftRow) => (
              <span style={{ fontSize: T.body, color: INK.strong }}>
                {d(r.opened_at).format('DD/MM/YYYY')}{' '}
                <span style={{ color: INK.mute, fontSize: 12 }}>
                  {d(r.opened_at).format('HH:mm')}–{r.closed_at ? d(r.closed_at).format('HH:mm') : ''}
                </span>
              </span>
            ),
          },
          {
            title: 'ควรมี', align: 'right' as const, width: 110,
            render: (_: unknown, r: ShiftRow) => <span style={{ fontSize: T.val, color: INK.body, ...num }}>{baht(r.expected_cash ?? 0)}</span>,
          },
          {
            title: 'นับได้', align: 'right' as const, width: 110,
            render: (_: unknown, r: ShiftRow) => <span style={{ fontSize: T.val, color: INK.strong, ...num }}>{baht(r.counted_cash ?? 0)}</span>,
          },
          {
            title: 'ผลต่าง', align: 'right' as const, width: 120,
            render: (_: unknown, r: ShiftRow) => {
              const v = overShort(r.over_short ?? 0);
              return <span style={{ fontSize: T.val, fontWeight: 600, color: v.color, ...num }}>{v.text}</span>;
            },
          },
        ] as ColumnsType<ShiftRow>)}
      />
    </Card>
  );
}

export function Shift() {
  const [shift, setShift] = useState<ShiftRow | null | undefined>(undefined); // undefined = loading
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<ShiftRow[]>([]);
  const [amount, setAmount] = useState<number | ''>('');   // ใช้ทั้งตอนเปิดและตอนปิด
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);           // เปิดหน้าต่างนับเงินปิดรอบ
  const [counter, setCounter] = useState(false);           // เปิดตัวนับเงินทีละใบ
  const [done, setDone] = useState<{ row: ShiftRow; dash: Dashboard | null } | null>(null);
  const [noSale, setNoSale] = useState(false);             // หน้าต่างถามเหตุผลเปิดลิ้นชักเปล่า
  const [drawerLog, setDrawerLog] = useState(false);       // หน้าต่างดูประวัติเปิดเปล่าของรอบ
  const [drawerOpens, setDrawerOpens] = useState<DrawerOpen[]>([]);

  const lastClosed = history.find((r) => r.closed_at);

  const refresh = useCallback(async () => {
    const s = await getOpenShift().catch(() => null);
    setShift(s);
    if (s) {
      setDash(await posDashboard(s.opened_at, new Date().toISOString()).catch(() => null));
      setDrawerOpens(await listDrawerOpens(s.id).catch(() => []));
    } else {
      setDrawerOpens([]);
    }
    listShifts().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  // เงินที่นับได้ตอนปิดรอบที่แล้ว คือเงินที่ยังอยู่ในลิ้นชักเช้านี้ — เติมให้เลย
  // ไม่ต้องนับซ้ำ (เจ้าของสั่ง 30 ส.ค.) แก้ทับได้ถ้าหยิบเงินออกไปตอนกลางคืน
  useEffect(() => {
    if (!shift && amount === '' && lastClosed?.counted_cash != null) {
      setAmount(lastClosed.counted_cash);
    }
  }, [shift, amount, lastClosed]);

  const cashIn = dash?.onsite.cash ?? 0;                   // เงินสดที่รับเข้ามาในรอบ (รวม COD)
  const inDrawer = (shift?.opening_float ?? 0) + cashIn;   // ควรมีเท่านี้ในลิ้นชักตอนนี้
  const diff = amount === '' ? null : Number(amount) - inDrawer;

  const doOpen = async () => {
    setBusy(true);
    const float = Number(amount) || 0;
    try {
      await openShift(float);
      setAmount('');
      setDone(null);
      await refresh();
      message.success('เปิดรอบแล้ว — ขายได้เลย');
      // พิมพ์ใบเปิดรอบทันที เพราะงานพิมพ์คือสิ่งที่ทำให้ลิ้นชักเด้ง (ดู printDrawer.ts)
      // ตอนนี้แหละที่ต้องเอาเงินทอนใส่ ถ้าพลาดตรงนี้ต้องไปง้างลิ้นชักเอง
      // ล้มก็ปล่อยผ่าน — รอบเปิดสำเร็จไปแล้ว ห้ามให้เครื่องพิมพ์มาคว่ำการเปิดรอบ
      try {
        printShiftOpenSlip({
          shopName: await getShopName().catch(() => 'ร้านอู้ฟู่'),
          openedAt: new Date().toISOString(),
          openingFloat: float,
          cashier: getReceiptConfig().cashierName,
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

  const doClose = async () => {
    if (!shift || amount === '') return;
    setBusy(true);
    try {
      const row = await closeShift(shift.id, Number(amount));
      setDone({ row, dash });
      setShift(null);
      setDash(null);
      setAmount('');
      setClosing(false);
      listShifts().then(setHistory).catch(() => {});
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const doPrint = async (row: ShiftRow, d: Dashboard | null) => {
    const o = d?.onsite;
    printShiftReport(
      {
        openedAt: row.opened_at, closedAt: row.closed_at, openingFloat: row.opening_float,
        cash: o?.cash ?? 0, promptpay: o?.promptpay ?? 0, storeCredit: o?.store_credit ?? 0,
        refunds: o?.refunds ?? 0, discount: o?.discount ?? 0, bills: o?.count ?? 0, gross: o?.gross ?? 0,
        expected: row.expected_cash ?? 0, counted: row.counted_cash ?? 0, overShort: row.over_short ?? 0,
        top: d?.top ?? [],
      },
      await getShopName().catch(() => 'ร้านอู้ฟู่'),
    );
  };

  if (shift === undefined) return <Card loading title="เปิด-ปิดรอบ" />;

  // ช่องกรอกเงินคือโมเมนต์เดียวที่คนต้องลงมือบนหน้านี้ จึงให้มันใหญ่จริง
  // ตัวเลขชิดขวาแบบเครื่องคิดเลข และปุ่มนับทีละใบสูงเท่ากันพอดี ไม่เหลื่อม
  const cashInput = (placeholder: string) => (
    <div className="flex" style={{ border: `1px solid ${INK.hair}` }}>
      <InputNumber
        min={0}
        variant="borderless"
        controls={false}
        prefix={<span style={{ fontSize: T.lead, color: INK.mute }}>฿</span>}
        placeholder={placeholder}
        style={{ flex: 1, height: 56 }}
        styles={{ input: { fontSize: 26, fontWeight: 700, textAlign: 'right', ...num } }}
        value={amount === '' ? undefined : amount}
        onChange={(v) => setAmount(v ?? '')}
        autoFocus
      />
      <Button
        type="text"
        onClick={() => setCounter(true)}
        style={{ height: 56, borderLeft: `1px solid ${INK.hair}`, paddingInline: 18, color: C.brand }}
      >
        <RiCalculatorLine className="w-4 h-4" /> นับทีละใบ
      </Button>
    </div>
  );

  const counterModal = (
    <CashCountModal
      open={counter}
      onClose={() => setCounter(false)}
      onDone={(total) => { setAmount(total); setCounter(false); }}
    />
  );

  /* ── เปิดลิ้นชักเปล่า ────────────────────────────────────────────────────────
   * ถามเหตุผลก่อนเสมอ ไม่ใช่เพื่อกันคนขโมย (คนจะโกงก็พิมพ์อะไรก็ได้) แต่เพื่อให้
   * แถวใน log อ่านแล้วมีความหมายตอนย้อนดูทีหลัง "เปิดเปล่า 6 ครั้ง" บอกอะไรไม่ได้
   * แต่ "แลกแบงก์ 5 · ตรวจเงิน 1" บอกได้ทันทีว่าปกติหรือผิดปกติ
   * ปุ่มสำเร็จรูปมาก่อนช่องพิมพ์ เพราะแคชเชียร์มีลูกค้ายืนรออยู่ตรงหน้า */
  const doNoSale = async (reason: string) => {
    setBusy(true);
    try {
      const res = await logDrawerOpen(reason);
      setNoSale(false);
      printNoSaleSlip({
        shopName: await getShopName().catch(() => 'ร้านอู้ฟู่'),
        at: new Date().toISOString(),
        cashier: getReceiptConfig().cashierName,
        reason,
        seq: res.count,
      });
      if (shift) listDrawerOpens(shift.id).then(setDrawerOpens).catch(() => {});
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const noSaleModal = (
    <Modal
      open={noSale}
      title="เปิดลิ้นชัก — ไม่มีการขาย"
      onCancel={() => setNoSale(false)}
      footer={<Button onClick={() => setNoSale(false)}>ยกเลิก</Button>}
      destroyOnHidden
      width={420}
    >
      <div style={{ fontSize: T.body, color: INK.body, marginBottom: 14 }}>
        เลือกเหตุผล — ระบบจะบันทึกว่าใครกด ตอนไหน แล้วพิมพ์สลิปให้ลิ้นชักเด้ง
      </div>
      <div className="flex flex-col gap-2">
        {NO_SALE_REASONS.map((r) => (
          <Button key={r} size="large" block loading={busy} onClick={() => void doNoSale(r)}
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}>
            {r}
          </Button>
        ))}
      </div>
    </Modal>
  );

  /* ── ปิดรอบไปแล้ว: ผลลัพธ์ + เอกสาร ─────────────────────────────────────── */
  const doneCard = done && (
    <Card styles={{ body: { padding: 0 } }}>
      <div className="flex flex-col items-center px-6 py-7" style={{ background: INK.wash }}>
        <span style={{ fontSize: T.lbl, color: INK.body, letterSpacing: '.02em' }}>ปิดรอบเรียบร้อย</span>
        <span
          style={{
            fontSize: 40, fontWeight: 700, lineHeight: 1.2, marginTop: 4,
            color: overShort(done.row.over_short ?? 0).color, ...num,
          }}
        >
          {overShort(done.row.over_short ?? 0).text}
        </span>
        <span style={{ fontSize: T.lbl, color: INK.mute, marginTop: 2, ...num }}>
          ควรมี {baht(done.row.expected_cash ?? 0)} · นับได้ {baht(done.row.counted_cash ?? 0)}
        </span>
      </div>
      <div className="px-6 py-4" style={{ borderTop: `1px solid ${INK.hair}` }}>
        <Button block size="large" icon={<RiPrinterLine className="w-4 h-4" />} onClick={() => void doPrint(done.row, done.dash)}>
          พิมพ์เอกสารปิดรอบ
        </Button>
      </div>
    </Card>
  );

  /* ── ยังไม่เปิดรอบ ─────────────────────────────────────────────────────── */
  if (!shift) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {doneCard}
        <Card styles={{ body: { padding: 0 } }}>
          <div className="px-6 py-5">
            <div style={{ fontSize: T.lead, fontWeight: 600, color: INK.strong }}>เปิดรอบ</div>
            <div style={{ fontSize: T.body, color: INK.body, marginTop: 2 }}>
              นับเงินในลิ้นชักตอนนี้ แล้วกดเปิดรอบ
            </div>
            {lastClosed?.counted_cash != null && (
              <div style={{ fontSize: T.lbl, color: INK.mute, marginTop: 6 }}>
                เติมยอดจากรอบที่แล้วให้แล้ว ({baht(lastClosed.counted_cash)}) — แก้ได้ถ้าไม่ตรง
              </div>
            )}
            <div className="mt-4">{cashInput('เงินในลิ้นชัก')}</div>
          </div>
          <div className="px-6 py-4" style={{ borderTop: `1px solid ${INK.hair}` }}>
            <Button
              type="primary" size="large" block
              loading={busy} disabled={amount === ''} onClick={() => void doOpen()}
            >
              เปิดรอบ
            </Button>
          </div>
        </Card>
        <ShiftHistory rows={history} />
        {counterModal}
      </div>
    );
  }

  /* ── รอบเปิดอยู่ ───────────────────────────────────────────────────────── */
  const openMins = d().diff(d(shift.opened_at), 'minute');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {openMins > 20 * 60 && (
        <Alert
          type="warning" showIcon
          message="รอบนี้เปิดค้างมานานกว่า 20 ชั่วโมง"
          description="ถ้าเมื่อวานลืมปิด ให้ปิดรอบนี้แล้วเปิดใหม่ ไม่งั้นยอดสองวันจะรวมกัน"
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        {/* แถบสถานะบาง ๆ ด้านบน จุดเขียวบอกว่ารอบกำลังเดินอยู่ */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ borderBottom: `1px solid ${INK.hair}` }}
        >
          <span className="inline-flex items-center gap-2" style={{ fontSize: T.lbl, color: INK.body }}>
            <i style={{ width: 7, height: 7, borderRadius: 999, background: C.brand, display: 'inline-block' }} />
            รอบเปิดอยู่
          </span>
          {/* "เปิดมาแล้วเท่าไหร่" มาก่อนเวลานาฬิกา เพราะคำถามแรกตอนมาเห็นรอบค้างคือ
              "นี่ของเมื่อไหร่" ไม่ใช่ "กี่โมง" — เลขนี้ขยับเองทุก 30 วิ ตาม refresh */}
          <span className="inline-flex items-baseline gap-2" style={{ fontSize: T.lbl }}>
            <span style={{ color: INK.body }}>เปิดมาแล้ว {since(shift.opened_at)}</span>
            <span style={{ color: INK.hair }}>·</span>
            <span style={{ color: INK.mute, ...num }}>
              {d(shift.opened_at).format('DD/MM HH:mm')} น.
            </span>
          </span>
        </div>

        <div className="flex flex-col items-center px-6 py-9">
          <span style={{ fontSize: T.lbl, color: INK.body, letterSpacing: '.02em' }}>เงินในลิ้นชักตอนนี้</span>
          <span
            style={{ fontSize: T.hero, fontWeight: 700, lineHeight: 1.1, color: INK.strong, marginTop: 6, ...num }}
          >
            {baht(inDrawer)}
          </span>
          {/* ที่มาของตัวเลข วางเป็นสมการสั้น ๆ ให้เห็นว่าบวกมาจากอะไร */}
          <span className="mt-3 inline-flex items-center gap-2" style={{ fontSize: T.lbl, color: INK.mute, ...num }}>
            <span>เปิดร้าน {baht(shift.opening_float)}</span>
            <span style={{ color: INK.hair }}>+</span>
            <span>ขายได้ {baht(cashIn)}</span>
          </span>
        </div>

        {/* เปิดเปล่าไปกี่ครั้งแล้วในรอบนี้ — โผล่เฉพาะตอนมีจริง ไม่งั้นเป็นบรรทัด
            เปล่าที่ไม่ได้บอกอะไร กดดูรายละเอียดว่าใครกด เพราะอะไร ได้ */}
        {drawerOpens.length > 0 && (
          <button
            type="button"
            onClick={() => setDrawerLog(true)}
            className="flex w-full items-center justify-between px-6 py-3 text-left"
            style={{ borderTop: `1px solid ${INK.hair}`, background: INK.wash, cursor: 'pointer' }}
          >
            <span style={{ fontSize: T.lbl, color: INK.body }}>
              เปิดลิ้นชักเปล่าในรอบนี้ <b style={{ color: INK.strong, ...num }}>{drawerOpens.length}</b> ครั้ง
            </span>
            <span style={{ fontSize: T.lbl, color: C.brand }}>ดูรายละเอียด</span>
          </button>
        )}

        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: `1px solid ${INK.hair}` }}
        >
          <Button size="large" icon={<RiInboxUnarchiveLine className="w-4 h-4" />} onClick={() => setNoSale(true)}>
            เปิดลิ้นชัก
          </Button>
          <Button
            danger type="primary" size="large" className="flex-1"
            onClick={() => { setAmount(''); setClosing(true); }}
          >
            ปิดรอบ
          </Button>
        </div>
      </Card>

      {noSaleModal}
      <Modal
        open={drawerLog}
        title="เปิดลิ้นชักเปล่าในรอบนี้"
        onCancel={() => setDrawerLog(false)}
        footer={<Button onClick={() => setDrawerLog(false)}>ปิด</Button>}
        destroyOnHidden
      >
        <Table
          rowKey="at"
          size="small"
          pagination={false}
          dataSource={drawerOpens}
          scroll={{ y: 300 }}
          columns={[
            {
              title: 'เวลา', width: 84,
              render: (_: unknown, r: DrawerOpen) => (
                <span style={{ fontSize: T.body, color: INK.strong, ...num }}>{d(r.at).format('HH:mm')}</span>
              ),
            },
            {
              title: 'ใครกด', width: 130,
              render: (_: unknown, r: DrawerOpen) => (
                <span style={{ fontSize: T.body, color: INK.strong }}>{r.who}</span>
              ),
            },
            {
              title: 'เหตุผล',
              render: (_: unknown, r: DrawerOpen) => (
                <span style={{ fontSize: T.body, color: INK.body }}>
                  {(r.note ?? '').replace(/^เปิดลิ้นชักเปล่า(\s—\s)?/, '') || '—'}
                </span>
              ),
            },
          ]}
        />
      </Modal>

      <ShiftHistory rows={history} />

      <Modal
        open={closing}
        title="ปิดรอบ — นับเงินในลิ้นชัก"
        onCancel={() => { setClosing(false); setAmount(''); }}
        okText="ปิดรอบ"
        cancelText="ยังก่อน"
        okButtonProps={{ danger: true, disabled: amount === '', loading: busy }}
        onOk={() => void doClose()}
        destroyOnHidden
      >
        <div style={{ fontSize: T.body, color: INK.body, marginBottom: 14 }}>
          นับเงินจริงในลิ้นชัก แล้วกรอกยอด — ระบบจะเทียบกับ{' '}
          <b style={{ color: INK.strong, ...num }}>{baht(inDrawer)}</b> ที่ควรมี
        </div>
        {cashInput('นับได้จริง')}
        {diff != null && (
          <div
            className="mt-4 flex items-center justify-between px-4 py-3"
            style={{ background: INK.wash, borderLeft: `3px solid ${overShort(diff).color}` }}
          >
            <span style={{ fontSize: T.body, color: INK.body }}>ผลต่าง</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: overShort(diff).color, ...num }}>
              {overShort(diff).text}
            </span>
          </div>
        )}
      </Modal>
      {counterModal}
    </div>
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
