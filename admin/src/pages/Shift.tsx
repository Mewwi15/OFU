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
import { Alert, Button, Card, Input, InputNumber, Modal, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import {
  apiError,
  closeShift,
  getOpenShift,
  listDrawerOpens,
  listShifts,
  listStaff,
  logDrawerOpen,
  recordCashMovement,
  shiftCashSummary,
  shiftSalesReport,
  posDashboard,
  type CashSummary,
  type Dashboard,
  type CashLine,
  type DrawerOpen,
  type Staff,
  type Shift as ShiftRow,
} from '../lib/api';
import { getShopName } from '../lib/orders';
import { printNoSaleSlip } from '../lib/printDrawer';
import { printShiftReport } from '../lib/printShift';
import { getReceiptConfig } from '../lib/receiptConfig';
import { d, since } from '../lib/time';
import { CashCountModal } from '../components/CashCountModal';
import { LiveClock } from '../components/LiveClock';
import { OpenShiftPanel } from '../components/OpenShiftPanel';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/* สเกลเดียวทั้งหน้า — เดิมผมสุ่มขนาด 13/14/15/22/28/40/52 ปน ๆ กัน หน้าจึงดู
 * "ทำรวก ๆ" ตามที่เจ้าของทัก ทุกตัวเลขข้างล่างนี้มาจากสเกลเดียว และผิวการ์ด
 * เป็นเหลี่ยมไม่มีเงา ให้ตรงกับธีมแอดมิน (borderRadius: 0 ทั้งระบบ) ที่ผมเผลอ
 * ใส่มุมโค้งกับเงานุ่มสวนไว้ */
const C = { brand: '#5B8C6E', err: '#E5484D', warn: '#E08C00', ok: '#1E9E5C' };
const T = { lbl: 13, body: 14, val: 15, lead: 20, title: 38, hero: 56 } as const;
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
 * ก็ไร้ความหมายเหมือนไม่ได้บันทึก
 *
 * dir บอกว่าเหตุผลนั้นทำให้เงินในลิ้นชักเปลี่ยนไหม (0089) — เดิมบันทึกแค่ว่ามีคน
 * เปิดลิ้นชัก ไม่ได้ถามจำนวนเงิน ยอดตอนปิดรอบจึงไม่มีทางตรงถ้าวันนั้นมีคนหยิบเงิน
 * ออกไปฝากธนาคาร  แลกแบงก์กับตรวจนับไม่เปลี่ยนยอดรวม จึงไม่ต้องถามจำนวน */
const NO_SALE_REASONS = [
  { label: 'แลกแบงก์ให้ลูกค้า', dir: null },
  { label: 'เติมเงินทอน', dir: 'in' },
  { label: 'เก็บเงินออกจากลิ้นชัก', dir: 'out' },
  { label: 'ตรวจนับเงินระหว่างรอบ', dir: null },
] as const satisfies readonly { label: string; dir: 'in' | 'out' | null }[];

function ShiftHistory({ rows, nameOf }: { rows: ShiftRow[]; nameOf: (c: string | null) => string | null }) {
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
            /* วัน/เวลาเรียงสองบรรทัด ไม่ใช่บรรทัดเดียว — ตารางนี้ย้ายมาอยู่คอลัมน์ข้าง
               กว้าง 400px แล้ว บรรทัดเดียวจะดันจนตารางเลื่อนแนวนอน */
            title: 'รอบ',
            render: (_: unknown, r: ShiftRow) => (
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ fontSize: T.body, color: INK.strong, ...num }}>{d(r.opened_at).format('DD/MM/YY')}</div>
                <div style={{ fontSize: 12, color: INK.mute, ...num }}>
                  {d(r.opened_at).format('HH:mm')}–{r.closed_at ? d(r.closed_at).format('HH:mm') : ''}
                  {r.cashier_code ? ` · ${nameOf(r.cashier_code) ?? r.cashier_code}` : ''}
                </div>
              </div>
            ),
          },
          {
            /* "ควรมี/นับได้" ซ้อนกันในช่องเดียว เพราะมันคือคู่ที่อ่านเทียบกันอยู่แล้ว
               และประหยัดที่ไปหนึ่งคอลัมน์เต็ม ๆ */
            title: 'ควรมี / นับได้', align: 'right' as const, width: 104,
            render: (_: unknown, r: ShiftRow) => (
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ fontSize: 12, color: INK.mute, ...num }}>{baht(r.expected_cash ?? 0)}</div>
                <div style={{ fontSize: T.body, color: INK.strong, ...num }}>{baht(r.counted_cash ?? 0)}</div>
              </div>
            ),
          },
          {
            title: 'ผลต่าง', align: 'right' as const, width: 96,
            render: (_: unknown, r: ShiftRow) => {
              const v = overShort(r.over_short ?? 0);
              return <span style={{ fontSize: T.body, fontWeight: 600, color: v.color, ...num }}>{v.text}</span>;
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
  const [cash, setCash] = useState<CashSummary | null>(null);   // สูตรกลางจาก 0089
  const [history, setHistory] = useState<ShiftRow[]>([]);
  const [amount, setAmount] = useState<number | ''>('');   // ใช้ทั้งตอนเปิดและตอนปิด
  const [countLines, setCountLines] = useState<CashLine[]>([]);   // แจกแจงทีละชนิดตอนปิดรอบ
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);           // เปิดหน้าต่างนับเงินปิดรอบ
  const [counter, setCounter] = useState(false);           // เปิดตัวนับเงินทีละใบ
  const [done, setDone] = useState<{ row: ShiftRow; dash: Dashboard | null } | null>(null);
  const [noSale, setNoSale] = useState(false);             // หน้าต่างถามเหตุผลเปิดลิ้นชักเปล่า
  const [drawerLog, setDrawerLog] = useState(false);       // หน้าต่างดูประวัติเปิดเปล่าของรอบ
  const [drawerOpens, setDrawerOpens] = useState<DrawerOpen[]>([]);
  const [picked, setPicked] = useState<(typeof NO_SALE_REASONS)[number] | null>(null);
  const [moveAmount, setMoveAmount] = useState<number | ''>('');
  const [code, setCode] = useState('');
  /* รหัส→ชื่อ ใช้ทั้งแถบสถานะ ตารางประวัติ และใบที่ปริ้น — เก็บชื่อไว้บนรอบไม่ได้
   * เพราะรอบเก่าที่บันทึกก่อนมีระบบพนักงานจะไม่มีชื่อ แปลตอนแสดงผลจึงครอบคลุมกว่า */
  const [staff, setStaff] = useState<Staff[]>([]);
  useEffect(() => { listStaff().then(setStaff).catch(() => {}); }, []);
  const nameOf = (c: string | null) => staff.find((p) => p.code === c)?.name ?? null;
  const withName = (c: string | null) => (c ? (nameOf(c) ? `${nameOf(c)} (${c})` : c) : null);
  const closeCodeOk = code !== '' && (staff.length === 0 || staff.some((p) => p.code === code && p.active));                    // รหัสพนักงานที่กำลังเปิด/ปิดรอบ


  const refresh = useCallback(async () => {
    const s = await getOpenShift().catch(() => null);
    setShift(s);
    if (s) {
      setDash(await posDashboard(s.opened_at, new Date().toISOString()).catch(() => null));
      setDrawerOpens(await listDrawerOpens(s.id).catch(() => []));
      setCash(await shiftCashSummary(s.id).catch(() => null));
    } else {
      setDrawerOpens([]);
      setCash(null);
    }
    listShifts().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);


  /* ตัวเลขนี้ต้องมาจาก shift_cash_summary ตัวเดียวกับที่ close_shift ใช้ (0089)
   * ก่อนหน้านี้จอบวกเอง (เปิดร้าน + ขายได้) ส่วนตอนปิดคำนวณอีกสูตร ตัวเลขที่
   * เจ้าของจ้องทั้งวันจึงไม่ใช่ตัวเลขที่ใช้ตัดสินตอนปิดรอบ */
  const inDrawer = cash?.expected ?? (shift?.opening_float ?? 0);


  const doClose = async () => {
    if (!shift || amount === '') return;
    setBusy(true);
    try {
      const row = await closeShift(shift.id, Number(amount), code, countLines);
      setDone({ row, dash });
      setCode('');
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
        openedBy: withName(row.cashier_code), closedBy: withName(row.closed_by_code),
        recon: await shiftCashSummary(row.id).catch(() => null),
        sales: await shiftSalesReport(row.id).catch(() => null),
        openingBreakdown: row.opening_breakdown, closingBreakdown: row.closing_breakdown,
        top: d?.top ?? [],
      },
      await getShopName().catch(() => 'ร้านอู้ฟู่'),
    );
  };

  if (shift === undefined) return <Card loading title="เปิด-ปิดรอบ" />;

  /* เจ้าของสั่ง 30 ส.ค.: "ห้ามกรอกตัวเลขเต็มแบบนี้ ต้องนับมือเท่านั้น เข้าออกต้องตรง"
   * ช่องพิมพ์ยอดถูกถอดออกทั้งหน้า เหลือทางเดียวคือกดนับทีละใบ เพราะเลขที่พิมพ์เอง
   * มันคือเลขที่คนคิดว่าน่าจะใช่ ไม่ใช่เลขที่อยู่ในลิ้นชักจริง แล้วยอดขาด/เกินก็
   * กลายเป็นของปลอมตามไปด้วย — ทั้งใบปิดรอบและการไล่เงินหายพังหมด
   *
   * expected = เลขที่ควรจะเป็น (ตอนเปิด = ยอดปิดรอบที่แล้ว · ตอนปิด = ตั้งต้น + ขายสด)
   * ถ้าไม่ตรงต้องเห็นทันทีตรงนั้น ไม่ใช่ไปรู้ตอนสิ้นเดือน */
  const countedBlock = (expected: number | null) =>
    amount === '' ? (
      <Button
        type="primary" size="large" block
        icon={<RiCalculatorLine className="w-4 h-4" />}
        style={{ height: 56, fontSize: T.lead }}
        onClick={() => setCounter(true)}
      >
        นับเงินในลิ้นชัก
      </Button>
    ) : (
      <div>
        <div
          className="flex items-baseline justify-between px-5 py-4"
          style={{ border: `1px solid ${INK.hair}`, background: INK.wash }}
        >
          <span style={{ fontSize: T.lbl, color: INK.body }}>นับได้</span>
          <span style={{ fontSize: 34, fontWeight: 700, color: INK.strong, lineHeight: 1.1, ...num }}>
            {baht(Number(amount))}
          </span>
        </div>
        {expected != null && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              borderLeft: `3px solid ${overShort(Number(amount) - expected).color}`,
              background: INK.wash, marginTop: 8,
            }}
          >
            <span style={{ fontSize: T.lbl, color: INK.body, ...num }}>ควรมี {baht(expected)}</span>
            <span
              style={{ fontSize: T.lead, fontWeight: 700, color: overShort(Number(amount) - expected).color, ...num }}
            >
              {overShort(Number(amount) - expected).text}
            </span>
          </div>
        )}
        <Button
          type="text" size="small"
          style={{ marginTop: 6, paddingInline: 0, color: C.brand }}
          onClick={() => { setAmount(''); setCounter(true); }}
        >
          นับใหม่
        </Button>
      </div>
    );

  const counterModal = (
    <CashCountModal
      open={counter}
      onClose={() => setCounter(false)}
      onDone={(total, lines) => { setAmount(total); setCountLines(lines); setCounter(false); }}
    />
  );

  /* ── เปิดลิ้นชักเปล่า ────────────────────────────────────────────────────────
   * ถามเหตุผลก่อนเสมอ ไม่ใช่เพื่อกันคนขโมย (คนจะโกงก็พิมพ์อะไรก็ได้) แต่เพื่อให้
   * แถวใน log อ่านแล้วมีความหมายตอนย้อนดูทีหลัง "เปิดเปล่า 6 ครั้ง" บอกอะไรไม่ได้
   * แต่ "แลกแบงก์ 5 · ตรวจเงิน 1" บอกได้ทันทีว่าปกติหรือผิดปกติ
   * ปุ่มสำเร็จรูปมาก่อนช่องพิมพ์ เพราะแคชเชียร์มีลูกค้ายืนรออยู่ตรงหน้า */
  const doNoSale = async (reason: string, dir: 'in' | 'out' | null, amount: number) => {
    setBusy(true);
    try {
      const res = await logDrawerOpen(reason);
      // เหตุผลที่ทำให้เงินเปลี่ยนต้องบันทึกจำนวนด้วย ไม่งั้นยอดตอนปิดรอบไม่มีทางตรง
      if (dir) await recordCashMovement(dir, amount, reason, shift?.cashier_code ?? undefined);
      setNoSale(false);
      setMoveAmount('');
      setPicked(null);
      printNoSaleSlip({
        shopName: await getShopName().catch(() => 'ร้านอู้ฟู่'),
        at: new Date().toISOString(),
        cashier: withName(shift?.cashier_code ?? null) ?? getReceiptConfig().cashierName,
        reason,
        seq: res.count,
      });
      if (shift) { void refresh(); listDrawerOpens(shift.id).then(setDrawerOpens).catch(() => {}); }
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  /* รหัสพนักงาน — บัญชีที่ล็อกอินบนเครื่อง POS เป็นบัญชีร่วมของร้าน ชี้ตัวคนไม่ได้
   * รหัสนี้คือสิ่งที่บอกว่าใครยืนอยู่หน้าเครื่องตอนนั้น และคนเปิดกับคนปิดเป็นคนละคนได้
   * inputMode numeric เพื่อให้จอสัมผัสเด้งแป้นตัวเลขขึ้นมา ไม่ใช่แป้นพิมพ์เต็ม */
  const codeField = (
    <div>
      <div style={{ fontSize: T.lbl, color: INK.body, marginBottom: 6 }}>รหัสพนักงาน</div>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\s/g, '').slice(0, 20))}
        placeholder="เช่น 07"
        inputMode="numeric"
        autoComplete="off"
        style={{ height: 52, fontSize: 22, fontWeight: 700, textAlign: 'center', ...num }}
      />
      <div style={{ minHeight: 22, marginTop: 4, textAlign: 'center' }}>
        {nameOf(code) && (
          <span style={{ fontSize: T.val, fontWeight: 600, color: C.brand }}>{nameOf(code)}</span>
        )}
        {code !== '' && !nameOf(code) && staff.length > 0 && (
          <span style={{ fontSize: T.lbl, color: C.err }}>ไม่มีรหัสนี้ในระบบ</span>
        )}
      </div>
    </div>
  );

  const noSaleModal = (
    <Modal
      open={noSale}
      title="เปิดลิ้นชัก — ไม่มีการขาย"
      onCancel={() => { setNoSale(false); setPicked(null); setMoveAmount(''); }}
      footer={null}
      destroyOnHidden
      width={420}
    >
      <div style={{ fontSize: T.body, color: INK.body, marginBottom: 14 }}>
        เลือกเหตุผล — ระบบจะบันทึกว่าใครกด ตอนไหน แล้วพิมพ์สลิปให้ลิ้นชักเด้ง
      </div>
      {picked === null ? (
        <div className="flex flex-col gap-2">
          {NO_SALE_REASONS.map((r) => (
            <Button
              key={r.label} size="large" block loading={busy}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => (r.dir ? setPicked(r) : void doNoSale(r.label, null, 0))}
            >
              {r.label}
              {r.dir && <span style={{ color: INK.mute, fontSize: T.lbl }}>&nbsp;— ต้องใส่จำนวนเงิน</span>}
            </Button>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: T.val, fontWeight: 600, color: INK.strong, marginBottom: 8 }}>
            {picked.label}
          </div>
          <div style={{ fontSize: T.lbl, color: INK.body, marginBottom: 8 }}>
            {picked.dir === 'in' ? 'ใส่เงินเข้าลิ้นชักกี่บาท' : 'หยิบเงินออกจากลิ้นชักกี่บาท'}
          </div>
          <InputNumber
            min={1}
            autoFocus
            value={moveAmount === '' ? undefined : moveAmount}
            onChange={(v) => setMoveAmount(v ?? '')}
            prefix={<span style={{ color: INK.mute }}>฿</span>}
            style={{ width: '100%', height: 56 }}
            styles={{ input: { fontSize: 24, fontWeight: 700, textAlign: 'right', ...num } }}
          />
          <div className="mt-4 flex gap-2">
            <Button size="large" onClick={() => { setPicked(null); setMoveAmount(''); }}>ย้อนกลับ</Button>
            <Button
              type="primary" size="large" className="flex-1" loading={busy}
              disabled={moveAmount === '' || Number(moveAmount) <= 0}
              onClick={() => void doNoSale(picked.label, picked.dir, Number(moveAmount))}
            >
              บันทึกแล้วเปิดลิ้นชัก
            </Button>
          </div>
        </div>
      )}
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
      <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-4">
        {doneCard}
        <OpenShiftPanel onOpened={() => { setDone(null); void refresh(); }} />
        </div>
        <ShiftHistory rows={history} nameOf={nameOf} />
        {counterModal}
      </div>
    );
  }

  /* ── รอบเปิดอยู่ ───────────────────────────────────────────────────────── */
  const openMins = d().diff(d(shift.opened_at), 'minute');

  return (
    <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
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
            {shift.cashier_code && (
              <>
                <span style={{ color: INK.body }}>พนักงาน {withName(shift.cashier_code)}</span>
                <span style={{ color: INK.hair }}>·</span>
              </>
            )}
            <span style={{ color: INK.body }}>เปิดมาแล้ว {since(shift.opened_at)}</span>
            <span style={{ color: INK.hair }}>·</span>
            <LiveClock size={T.lbl} showDate={false} />
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
          {/* โชว์เฉพาะบรรทัดที่ไม่เป็นศูนย์ — ร้านส่วนใหญ่มีแค่ "เปิดร้าน + ขายได้"
              ส่วนคืนเงิน/เงินเข้าออกจะโผล่เฉพาะวันที่เกิดจริง */}
          <span
            className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-6"
            style={{ fontSize: T.lbl, color: INK.mute, ...num }}
          >
            {([
              ['เปิดร้าน', cash?.opening ?? shift.opening_float, '+'],
              ['ขายได้', cash?.sales ?? 0, '+'],
              ['COD', cash?.cod ?? 0, '+'],
              ['คืนเงิน', cash?.refunds ?? 0, '−'],
              ['นำเงินเข้า', cash?.paid_in ?? 0, '+'],
              ['นำเงินออก', cash?.paid_out ?? 0, '−'],
            ] as const)
              .filter(([label, v]) => v !== 0 || label === 'เปิดร้าน' || label === 'ขายได้')
              .map(([label, v, sign], i) => (
                <span key={label} className="inline-flex items-center gap-2">
                  {i > 0 && <span style={{ color: INK.hair }}>{sign}</span>}
                  <span>{label} {baht(v)}</span>
                </span>
              ))}
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
            onClick={() => { setAmount(''); setCode(''); setClosing(true); }}
          >
            ปิดรอบ
          </Button>
        </div>
      </Card>

      </div>
      <ShiftHistory rows={history} nameOf={nameOf} />

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

      <Modal
        open={closing}
        title="ปิดรอบ — นับเงินในลิ้นชัก"
        onCancel={() => { setClosing(false); setAmount(''); setCode(''); }}
        okText="ปิดรอบ"
        cancelText="ยังก่อน"
        okButtonProps={{ danger: true, disabled: amount === '' || !closeCodeOk, loading: busy }}
        onOk={() => void doClose()}
        destroyOnHidden
      >
        <div style={{ fontSize: T.body, color: INK.body, marginBottom: 14 }}>
          นับเงินในลิ้นชักทีละใบ — ระบบจะเทียบกับ{' '}
          <b style={{ color: INK.strong, ...num }}>{baht(inDrawer)}</b> ที่ควรมี
        </div>
        {countedBlock(inDrawer)}
        <div className="mt-4">{codeField}</div>
      </Modal>
      {counterModal}
    </div>
  );
}
