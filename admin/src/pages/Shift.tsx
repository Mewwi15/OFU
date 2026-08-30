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

import { Alert, Button, Card, Col, Descriptions, InputNumber, Modal, Row, Steps, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import {
  apiError,
  closeShift,
  getOpenShift,
  listShifts,
  openShift,
  posDashboard,
  type Dashboard,
  type Shift as ShiftRow,
} from '../lib/api';
import { getShopName } from '../lib/orders';
import { printShiftReport } from '../lib/printShift';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const C = { brand: '#5B8C6E', err: '#E5484D', warn: '#E08C00', ok: '#1E9E5C', muted: '#6E625C' };

/** ช่องตัวเลขในแถบสรุป
 *
 * ตัวเลขเงินคือสิ่งที่คนเปิดหน้านี้มาอ่าน จึงให้มันใหญ่จริง (28px) และป้ายกำกับ
 * ใช้สีเข้มพออ่านออก ไม่ใช่เทาจาง ๆ ของ antd secondary — เจ้าของทักสองหน้าแล้ว
 * ว่า "ตัวเลขไม่ชัด" ทั้งที่หน้าจอมีที่เหลือเฟือ
 */
function Tile({
  label, value, hint, accent,
}: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: '#FAFAF9', border: '1px solid #EDEAE7' }}>
      <div style={{ fontSize: 13, color: '#5C534E', lineHeight: 1.4 }}>{label}</div>
      <div
        style={{
          fontSize: 28, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap',
          color: accent ?? '#2B2320', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: '#8C837D', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

/** ตัวเลขพระเอกของหน้า — ได้การ์ดของตัวเอง ไม่ต้องแย่งพื้นที่กับช่องอื่น
 *  4 ช่องที่เหลือเป็นข้อมูลประกอบ ตัวเลขนี้คือคำตอบว่าลิ้นชักควรมีเท่าไหร่ */
function HeroTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="flex h-full flex-col justify-center rounded-lg px-5 py-4"
      style={{ background: '#F2F6F3', border: `1px solid ${C.brand}33` }}
    >
      <div style={{ fontSize: 14, color: '#4A5F52' }}>{label}</div>
      <div
        style={{
          fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: C.brand,
          whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: '#6E7E73' }}>{hint}</div>}
    </div>
  );
}

/** แถวเงิน ป้ายซ้าย ตัวเลขขวา — ตัวเลขเรียงตรงกันด้วย tabular-nums จะได้กวาดตา
 *  ลงมาเทียบกันได้โดยไม่ต้องเพ่ง */
function MoneyRow({
  label, value, strong, muted,
}: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5" style={{ borderBottom: '1px solid #F0EDEA' }}>
      <span style={{ fontSize: 14, color: '#5C534E' }}>{label}</span>
      <span
        style={{
          fontSize: strong ? 20 : 16,
          fontWeight: strong ? 700 : 500,
          color: muted ? '#8C837D' : '#2B2320',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** แถบบอกว่าตอนนี้อยู่ขั้นไหนของวัน
 *
 * หน้านี้เปลี่ยนหน้าตาไปเลยตามว่ามีรอบเปิดอยู่หรือไม่ ซึ่งถ้าไม่บอกอะไรเลยคนเปิด
 * มาจะไม่รู้ว่ากำลังดูอะไรอยู่ ("ไม่เข้าใจ flow หน้านี้เลย" — เจ้าของ 30 ส.ค.)
 * และที่สำคัญกว่านั้น: **ขายได้ตามปกติแม้ไม่เปิดรอบ** (create_pos_sale ไม่บังคับ
 * ตั้งแต่ 0021) ถ้าไม่พูดตรง ๆ คนจะเดาว่าต้องเปิดรอบก่อนถึงจะขายได้ แล้วกลัวจะ
 * ทำผิดขั้นตอน — จึงเขียนบอกไว้ในแถบนี้เลย
 */
function FlowSteps({ current }: { current: 0 | 1 }) {
  return (
    <Card styles={{ body: { padding: '16px 20px' } }}>
      <Steps
        size="small"
        current={current}
        items={[
          { title: 'เปิดร้าน', description: 'นับเงินทอนในลิ้นชัก แล้วกดเปิดรอบ' },
          { title: 'ขายทั้งวัน', description: 'ระบบรวมเงินสดที่รับเข้ามาให้เอง' },
          { title: 'ปิดร้าน', description: 'นับเงินจริง เทียบกับที่ควรมี' },
        ]}
      />
      <div style={{ fontSize: 13, color: '#5C534E', marginTop: 12 }}>
        หน้านี้มีไว้<b>ตรวจว่าเงินในลิ้นชักตรงกับยอดขายไหม</b> — ไม่ได้เกี่ยวกับการขาย
        <br />
        <span style={{ color: '#8C837D' }}>
          ขายหน้าร้านได้ตามปกติแม้ไม่เปิดรอบ · เปิดรอบไว้เพื่อให้ตอนเย็นรู้ว่าเงินขาดหรือเกินเท่าไหร่
        </span>
      </div>
    </Card>
  );
}

/** ขาด/เกิน ใช้ภาษาเดียวกันทุกที่บนหน้านี้ */
function overShortText(n: number) {
  if (n === 0) return { text: 'พอดีเป๊ะ', color: C.ok };
  if (n < 0) return { text: `ขาด ${baht(-n)}`, color: C.err };
  return { text: `เกิน ${baht(n)}`, color: C.warn };
}

function ShiftHistory({ rows }: { rows: ShiftRow[] }) {
  const closed = rows.filter((r) => r.closed_at);
  const offCount = closed.filter((r) => (r.over_short ?? 0) !== 0).length;
  return (
    <Card
      title="ประวัติรอบที่ผ่านมา"
      extra={
        closed.length > 0 ? (
          <Typography.Text style={{ fontSize: 12, color: C.muted }}>
            {closed.length} รอบล่าสุด · เงินไม่ตรง {offCount} รอบ
          </Typography.Text>
        ) : null
      }
    >
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={closed.slice(0, 12)}
        scroll={{ y: 300 }}
        locale={{ emptyText: 'ยังไม่มีรอบที่ปิดแล้ว' }}
        columns={([
          {
            title: 'รอบ',
            render: (_: unknown, r: ShiftRow) => (
              <div>
                <div style={{ fontSize: 14, color: '#2B2320' }}>{dayjs(r.opened_at).format('DD/MM/YYYY')}</div>
                <Typography.Text style={{ fontSize: 12, color: '#8C837D' }}>
                  {dayjs(r.opened_at).format('HH:mm')} – {r.closed_at ? dayjs(r.closed_at).format('HH:mm') : '—'}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: 'ควรมี', align: 'right' as const, width: 96,
            render: (_: unknown, r: ShiftRow) => (
              <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{baht(r.expected_cash ?? 0)}</span>
            ),
          },
          {
            title: 'นับได้', align: 'right' as const, width: 96,
            render: (_: unknown, r: ShiftRow) => (
              <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{baht(r.counted_cash ?? 0)}</span>
            ),
          },
          {
            title: 'ผลต่าง', align: 'right' as const, width: 110,
            render: (_: unknown, r: ShiftRow) => {
              const v = overShortText(r.over_short ?? 0);
              return (
                <span style={{ fontSize: 15, fontWeight: 700, color: v.color, fontVariantNumeric: 'tabular-nums' }}>
                  {v.text}
                </span>
              );
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
  const [float, setFloat] = useState<number | ''>('');
  const [counted, setCounted] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [justClosed, setJustClosed] = useState<{ row: ShiftRow; dash: Dashboard | null } | null>(null);
  const [counterFor, setCounterFor] = useState<'float' | 'counted' | null>(null);

  const refresh = useCallback(async () => {
    const s = await getOpenShift().catch(() => null);
    setShift(s);
    if (s) setDash(await posDashboard(s.opened_at, new Date().toISOString()).catch(() => null));
    listShifts().then(setHistory).catch(() => {});
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
          setJustClosed({ row: r, dash });
          setShift(null);
          setDash(null);
          setCounted('');
          message.success('ปิดรอบเรียบร้อย');
          listShifts().then(setHistory).catch(() => {});
        } catch (e) {
          message.error(apiError(e));
        }
      },
    });
  };

  const printReport = async (row: ShiftRow, d: Dashboard | null) => {
    const o = d?.onsite;
    printShiftReport(
      {
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        openingFloat: row.opening_float,
        cash: o?.cash ?? 0,
        promptpay: o?.promptpay ?? 0,
        storeCredit: o?.store_credit ?? 0,
        refunds: o?.refunds ?? 0,
        discount: o?.discount ?? 0,
        bills: o?.count ?? 0,
        gross: o?.gross ?? 0,
        expected: row.expected_cash ?? 0,
        counted: row.counted_cash ?? 0,
        overShort: row.over_short ?? 0,
        top: d?.top ?? [],
      },
      await getShopName().catch(() => 'ร้านอู้ฟู่'),
    );
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

  /* ── ยังไม่เปิดรอบ ─────────────────────────────────────────────────────── */
  if (!shift) {
    return (
      <div className="flex flex-col gap-4">
        {justClosed && <ClosedSummary row={justClosed.row} onPrint={() => void printReport(justClosed.row, justClosed.dash)} />}
        <FlowSteps current={0} />
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Card title="เปิดรอบขาย" style={{ height: '100%' }}>
              <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                นับเงินทอนตั้งต้นในลิ้นชัก แล้วเปิดรอบก่อนเริ่มขายของวัน — บิลทุกใบหลังจากนี้
                จะถูกนับเข้ารอบ เพื่อให้ตอนเย็นรู้ว่าลิ้นชักควรมีเงินเท่าไหร่
              </Typography.Paragraph>
              <div className="flex flex-col gap-3">
                <InputNumber
                  min={0}
                  size="large"
                  placeholder="เงินตั้งต้น เช่น 1000"
                  style={{ width: '100%' }}
                  prefix="฿"
                  value={float === '' ? undefined : float}
                  onChange={(v) => setFloat(v ?? '')}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="large" style={{ flex: 1 }} onClick={() => setCounterFor('float')}>
                    นับเงินทีละใบ
                  </Button>
                  <Button type="primary" size="large" style={{ flex: 1 }} loading={busy} onClick={() => void doOpen()}>
                    เปิดรอบ
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <ShiftHistory rows={history} />
          </Col>
        </Row>
        {counterModal}
      </div>
    );
  }

  /* ── รอบเปิดอยู่ ───────────────────────────────────────────────────────── */
  const openedFor = dayjs().diff(dayjs(shift.opened_at), 'minute');
  const hours = Math.floor(openedFor / 60);
  // เปิดค้างข้ามวันมักแปลว่าลืมปิด ไม่ใช่ขายยาว — บอกไว้ก่อนตัวเลขจะเพี้ยนสะสม
  const stale = openedFor > 20 * 60;
  const o = dash?.onsite;

  return (
    <div className="flex flex-col gap-4">
      {stale && (
        <Alert
          type="warning"
          showIcon
          message="รอบนี้เปิดค้างมานานกว่า 20 ชั่วโมง"
          description="ถ้าเมื่อวานลืมปิด ให้ปิดรอบนี้แล้วเปิดรอบใหม่ ไม่งั้นยอดของสองวันจะรวมกัน"
        />
      )}

      <FlowSteps current={1} />

      <Card
        title={`รอบปัจจุบัน — เปิดเมื่อ ${dayjs(shift.opened_at).format('DD/MM HH:mm')}`}
        extra={
          <Typography.Text style={{ fontSize: 12, color: C.muted }}>
            เปิดมาแล้ว {hours > 0 ? `${hours} ชม. ` : ''}{openedFor % 60} นาที · ตัวเลขเดินเองทุก 30 วินาที
          </Typography.Text>
        }
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={9}>
            <HeroTile
              label="ลิ้นชักควรมีตอนนี้"
              value={baht(expectedNow)}
              hint={`เงินตั้งต้น ${baht(shift.opening_float)} + เงินสดขาย ${baht(cashInShift)}`}
            />
          </Col>
          <Col xs={24} lg={15}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Tile label="เงินตั้งต้น" value={baht(shift.opening_float)} />
              <Tile label="เงินสดขายในรอบ" value={baht(cashInShift)} hint="รวมเก็บเงินปลายทาง" />
              <Tile label="โอน PromptPay" value={baht(o?.promptpay ?? 0)} hint="ไม่อยู่ในลิ้นชัก" />
              <Tile
                label="จำนวนบิล"
                value={`${o?.count ?? 0}`}
                hint={o?.count ? `เฉลี่ย ${baht(Math.round((o.gross ?? 0) / o.count))} / บิล` : 'ยังไม่มีบิล'}
              />
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card title="ปิดรอบ — นับเงินในลิ้นชัก" style={{ height: '100%' }}>
            <div className="flex flex-col gap-3">
              <InputNumber
                min={0}
                size="large"
                placeholder="นับได้จริง เช่น 4520"
                style={{ width: '100%' }}
                prefix="฿"
                value={counted === '' ? undefined : counted}
                onChange={(v) => setCounted(v ?? '')}
              />
              <div className="flex gap-2">
                <Button size="large" style={{ flex: 1 }} onClick={() => setCounterFor('counted')}>
                  นับเงินทีละใบ
                </Button>
                <Button danger type="primary" size="large" style={{ flex: 1 }} disabled={counted === ''} onClick={doClose}>
                  ปิดรอบ
                </Button>
              </div>

              {/* ผลต่างโผล่ทันทีที่กรอก ไม่ต้องกดปิดก่อนถึงจะรู้ว่าขาดหรือเกิน */}
              {diff != null && (
                <div
                  className="rounded-lg px-4 py-3"
                  style={{ background: '#FAFAF9', border: `1px solid ${overShortText(diff).color}33` }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 14, color: '#5C534E' }}>ผลต่างจากที่ควรมี</span>
                    <span style={{ fontSize: 32, fontWeight: 800, color: overShortText(diff).color, fontVariantNumeric: 'tabular-nums' }}>
                      {overShortText(diff).text}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8C837D' }}>
                    ควรมี {baht(expectedNow)} · นับได้ {baht(Number(counted))} — ตัวตัดสินจริงมาจากเซิร์ฟเวอร์ตอนกดปิด
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={11}>
          <Card title="ยอดขายในรอบนี้" style={{ height: '100%' }}>
            {/* แถวของเราเอง ไม่ใช้ Descriptions ของ antd — ตัวหนังสือมันเล็กและ
                จางเกินกว่าจะกวาดตาอ่านตัวเลขเงินได้ */}
            <div className="mb-3 flex flex-col">
              <MoneyRow label="ยอดขายรวม" value={baht(o?.gross ?? 0)} strong />
              <MoneyRow label="เงินสด" value={baht(o?.cash ?? 0)} />
              <MoneyRow label="โอน PromptPay" value={baht(o?.promptpay ?? 0)} />
              <MoneyRow label="เครดิตร้าน" value={baht(o?.store_credit ?? 0)} />
              <MoneyRow label="ส่วนลด" value={`− ${baht(o?.discount ?? 0)}`} muted />
              <MoneyRow label="คืนเงิน" value={`− ${baht(o?.refunds ?? 0)}`} muted />
            </div>
            {(dash?.top?.length ?? 0) > 0 && (
              <>
                <Typography.Text style={{ fontSize: 12, color: C.muted }}>ขายดีในรอบนี้</Typography.Text>
                <div className="mt-1 flex flex-col gap-1">
                  {dash!.top.slice(0, 5).map((t) => (
                    <div key={t.name} className="flex items-center justify-between">
                      <span className="truncate" style={{ fontSize: 13 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                        {t.qty} ชิ้น · {baht(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <ShiftHistory rows={history} />
      {counterModal}
    </div>
  );
}

function ClosedSummary({ row, onPrint }: { row: ShiftRow; onPrint: () => void }) {
  const v = overShortText(row.over_short ?? 0);
  return (
    <Alert
      type={(row.over_short ?? 0) === 0 ? 'success' : (row.over_short ?? 0) < 0 ? 'error' : 'warning'}
      showIcon
      message={`ปิดรอบแล้ว — ${v.text}`}
      action={
        <Button size="small" onClick={onPrint}>
          พิมพ์ใบสรุป
        </Button>
      }
      description={
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 3 }}
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
