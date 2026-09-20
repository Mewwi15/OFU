import type { Dayjs } from 'dayjs';
import { RiFileList3Line, RiPrinterLine, RiRefund2Line, RiSearchLine } from '@remixicon/react';
import { App, Button, Card, Checkbox, DatePicker, Drawer, Input, InputNumber, Modal, Segmented, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Receipt } from '../components/Receipt';
import {
  apiError,
  getPosSaleItems,
  getShopInfo,
  listPosSales,
  refundPosSale,
  type PosSale,
  type PosSaleItem,
  type ShopInfo,
  getOpenShift,
  listShifts,
  type Shift,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { d } from '../lib/time';
import { ZONE } from '../theme';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/* ป้ายวิธีชำระ ใช้จานสีเดียวกับโซนในเมนูข้าง — ของเดิมเป็น gold/blue/purple ของ antd
 * ซึ่งสดกว่าธีมแอดมินทั้งระบบอยู่คนละระดับ ตารางเลยดูเป็นป้ายไฟ */
const PAY: Record<string, { label: string; color: string }> = {
  cash: { label: 'เงินสด', color: ZONE.front },
  promptpay: { label: 'พร้อมเพย์', color: ZONE.online },
  store_credit: { label: 'เครดิตร้าน', color: ZONE.back },
};
const STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'สำเร็จ', color: 'success' },
  refunded: { label: 'คืนเงินแล้ว', color: 'error' },
  voided: { label: 'ยกเลิก', color: 'default' },
};

/* ตรึงเวลาไทยเหมือนที่แก้ไปทั้งระบบแล้ว — ของเดิมใช้ new Date() เปล่า ๆ ซึ่งแปลตาม
 * timezone ของเครื่องที่เปิดเว็บ เปิดจากมือถือที่โซนเพี้ยนแล้ว "ยอดขายวันนี้" จะนับ
 * คนละวันเงียบ ๆ */
const todayWindow = () => ({
  fromIso: d().startOf('day').toISOString(),
  toIso: d().endOf('day').toISOString(),
});
const timeParts = (iso: string) => ({ date: d(iso).format('DD/MM'), time: d(iso).format('HH:mm') });

export function PosSales() {
  const { message } = App.useApp();
  const [sales, setSales] = useState<PosSale[]>([]);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PosSale | null>(null);
  const [items, setItems] = useState<PosSaleItem[]>([]);
  const [refunding, setRefunding] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [pay, setPay] = useState<string>('all');
  // ③ ช่วงวันที่ + โหลดย้อนหลังเกิน 100 บิล
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);
  // ④ รอบ: map id → เวลาเปิดรอบ + ตัวกรองรอบปัจจุบัน
  const [shifts, setShifts] = useState<Map<string, Shift>>(new Map());
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [onlyCurrentShift, setOnlyCurrentShift] = useState(false);
  // ①② โมดัลคืนเงิน: เลือกรายการ + จำนวน + เหตุผลบังคับ
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundPicks, setRefundPicks] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState('');
  // ⑤ บิลของ "วันนี้" ชุดแยกสำหรับการ์ดสรุป — ไม่ผูกกับตัวกรอง/หน้าที่โหลดของตาราง
  const [todaySales, setTodaySales] = useState<PosSale[]>([]);
  /* ★ หนึ่งครั้งที่เปิดโมดัล = คำสั่งคืนเงินหนึ่งคำสั่ง ★ id ตัวนี้เกิดตอนเปิดโมดัล ไม่ใช่
     ตอนกดยืนยัน เพราะถ้าคำสั่งถึงฐานข้อมูลและ commit แล้วแต่คำตอบหายกลางทาง (เน็ตร้าน
     กระตุก) หน้าจอจะขึ้นข้อความแดงทั้งที่ของคืนเข้าสต๊อกและเงินถูกบันทึกไปแล้ว การกดซ้ำ
     ของแคชเชียร์คือคืนซ้ำจริง ๆ — ส่ง id เดิมไป 0114 จะตอบผลเดิมกลับมาแทนการทำงานใหม่
     ผูกกับ "การเปิดโมดัล" ไม่ใช่กับจำนวนที่เลือก เพราะการแก้จำนวนแล้วกดใหม่หลังคำตอบหาย
     ก็ยังเป็นการกดซ้ำของคำสั่งที่ commit ไปแล้ว ถ้าแจก id ใหม่ให้ = จ่ายเงินออกรอบสอง
     ส่วนการคืนครั้งถัดไปของจริงต้องเปิดโมดัลใหม่อยู่แล้ว (สำเร็จแล้วโมดัลปิดทุกครั้ง)
     จึงได้ id ใหม่เสมอ ไม่โดนกลืน */
  const refundOpId = useRef<string | null>(null);

  async function load(r: [Dayjs, Dayjs] | null = range) {
    setLoading(true);
    setNoMore(false);
    void loadToday();
    try {
      setSales(
        await listPosSales(
          r
            ? { fromIso: r[0].startOf('day').toISOString(), toIso: r[1].endOf('day').toISOString(), limit: 500 }
            : undefined,
        ),
      );
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  /* ★ การ์ดสรุปห้ามนับจากตารางที่แสดงอยู่ ★ ตารางคือ "บิลล่าสุด 100 ใบ" หรือ "บิลของช่วง
     วันที่ที่เลือก" — วันเสาร์ที่ขาย 140 บิล การ์ดจะนับแค่ 100 ใบท้าย แล้วพอกด "โหลดบิล
     เก่ากว่านี้" ตัวเลขขยับขึ้นเอง ซึ่งพิสูจน์ว่ามันไม่ใช่ตัวเลขของร้าน · และพอเจ้าของเลือก
     ช่วงวันที่เพื่อหาบิลเก่าให้ลูกค้า การ์ด "วันนี้" จะกลายเป็น ฿0 ทั้งที่ยังขายอยู่
     จึงดึงบิลของวันนี้มาอีกชุดต่างหาก
     (เพดาน 500 ใบต่อวันเผื่อไว้เกินสามเท่าของวันที่ขายดีที่สุด ถ้าวันไหนเกินจริงต้องย้าย
     ไปสรุปฝั่งฐานข้อมูล ไม่ใช่ขยายเลขนี้ไปเรื่อย ๆ) */
  async function loadToday() {
    try {
      setTodaySales(await listPosSales({ ...todayWindow(), limit: 500 }));
    } catch {
      // การ์ดสรุปพังไม่ควรขึ้นข้อความแดงทับของจริงที่หน้านี้มีไว้ทำ คือรายการบิล
    }
  }

  async function loadMore() {
    if (!sales.length) return;
    setLoadingMore(true);
    try {
      const oldest = sales[sales.length - 1].created_at;
      const more = await listPosSales({
        beforeIso: oldest,
        ...(range ? { fromIso: range[0].startOf('day').toISOString() } : {}),
      });
      if (more.length === 0) setNoMore(true);
      setSales((prev) => [...prev, ...more]);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoadingMore(false);
    }
  }
  useEffect(() => {
    void load();
    getShopInfo().then(setShop).catch(() => {});
    listShifts().then((rows) => setShifts(new Map(rows.map((r) => [r.id, r])))).catch(() => {});
    getOpenShift().then((sh) => setCurrentShiftId(sh?.id ?? null)).catch(() => {});
    // mount-only fetch; load isn't memoized so listing it would refetch every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(s: PosSale) {
    setDetail(s);
    setItems([]);
    try {
      setItems(await getPosSaleItems(s.id));
    } catch (e) {
      message.error(apiError(e));
    }
  }

  const REASONS = ['สินค้าชำรุด/เสีย', 'ยิงบิลผิด', 'ลูกค้าเปลี่ยนใจ', 'อื่นๆ'];

  function openRefund() {
    /* ★ ตั้งต้นที่ 0 ทุกแถว ไม่ใช่คืนเต็มทั้งบิล ★ ของเดิมตั้งต้นเป็น "ทุกแถวเต็มจำนวน"
       ซึ่งคือการกระทำที่จ่ายเงินออกมากที่สุดเท่าที่บิลนี้ทำได้ แล้วให้คนไล่กดลดเอง —
       บิล 18 รายการที่ลูกค้าคืนขนมถุงเดียวต้องไล่กด 0 ทีละ 17 แถว พลาดแถวไหนก็จ่ายเกิน
       ของแถวนั้น ลืมแก้ทั้งหมดคือคืนทั้งบิล
       ตั้งต้น 0 พลาดได้อย่างมากคือคืนน้อยไป ซึ่งกดเพิ่มทีหลังได้ ส่วนคืนเกินคือเงินที่ออก
       จากลิ้นชักไปแล้ว เอาคืนจากลูกค้าที่เดินออกไปแล้วไม่ได้
       คนที่จะคืนทั้งบิลกดปุ่ม "คืนทั้งบิล" ปุ่มเดียวจบ ไม่ได้ช้าลงกว่าเดิม */
    setRefundPicks({});
    setRefundReason(null);
    setRefundNote('');
    refundOpId.current = crypto.randomUUID();
    setRefundOpen(true);
  }

  /* ★ ยอดเงินที่จะจ่ายออก ต้องคิดด้วยสูตรเดียวกับฝั่งฐานข้อมูล ★ (0077:82-88 — เงินคืน
     ของบรรทัด = สัดส่วนของ line_total แล้วคูณกลับด้วย total/ยอดรวมทุกบรรทัด เพื่อเฉลี่ย
     ส่วนลดท้ายบิล) แคชเชียร์คิดเลขนี้เองไม่ได้ ถ้าไม่เอามาโชว์ก็เท่ากับกดยืนยันจ่ายเงินออก
     โดยไม่เคยเห็นว่ากี่บาท แล้วไปรู้ตัวตอนนับลิ้นชักปิดรอบ
     ทางคืนทั้งบิลคิดจาก "ยอดบิล − ที่เคยคืนไปแล้ว" ตรง ๆ เพราะนั่นคือสิ่งที่
     refund_pos_sale จ่ายจริง (0077:138/144) ไม่ใช่ยอดหน้าบิล */
  const refund = useMemo(() => {
    const picks = items
      .map((i) => ({ item_id: i.id, qty: refundPicks[i.id] ?? 0, max: i.qty - i.refunded_qty, line: i.line_total, sold: i.qty }))
      .filter((p) => p.qty > 0);
    const remaining = (detail?.total ?? 0) - (detail?.refunded_amount ?? 0);
    const isFull =
      picks.length > 0 &&
      picks.length === items.filter((i) => i.qty - i.refunded_qty > 0).length &&
      picks.every((p) => p.qty === p.max);
    const gross = items.reduce((a, i) => a + i.line_total, 0);
    const lineRefund = picks.reduce((a, p) => a + (p.line * p.qty) / p.sold, 0);
    // gross = 0 ได้จริงกับบิลที่ลดจนเหลือศูนย์ — ฝั่ง DB least(null, x) จะเหลือเพดาน x
    const scaled = gross > 0 ? Math.round((lineRefund * (detail?.total ?? 0)) / gross) : remaining;
    return {
      picks,
      isFull,
      amount: picks.length === 0 ? 0 : isFull ? remaining : Math.min(scaled, remaining),
    };
  }, [items, refundPicks, detail]);

  async function submitRefund() {
    if (!detail || !refundReason) return;
    const reason = refundReason === 'อื่นๆ' ? refundNote.trim() || 'อื่นๆ' : refundReason;
    const { picks, isFull, amount } = refund;
    if (picks.length === 0) {
      message.warning('เลือกรายการที่จะคืนอย่างน้อย 1 รายการ');
      return;
    }
    setRefunding(true);
    try {
      if (isFull) {
        // refund_pos_sale กันยิงซ้ำอยู่แล้ว (บิลที่ status=refunded ตอบ replay กลับมา)
        await refundPosSale(detail.id, reason);
        /* ต้องบอกจำนวนเงินเสมอ — บิล ฿980 ที่เคยคืนไปแล้ว ฿300 ทางนี้จ่ายจริงแค่ ฿680
           ข้อความเดิมพูดแค่ "คืนเงินเต็มบิล" ซึ่งชวนให้นับเงินออกจากลิ้นชัก ฿980 */
        message.success(`คืนเงินเต็มบิล ${detail.sale_number} · จ่ายคืน ${baht(amount)}`);
      } else {
        /* ยิง rpc ตรงเพราะตัวช่วยใน api.ts ยังไม่มีช่องส่ง p_client_op_id */
        const { data, error } = await supabase.rpc('refund_pos_sale_items', {
          p_sale_id: detail.id,
          p_items: picks.map(({ item_id, qty }) => ({ item_id, qty })),
          p_reason: reason,
          p_client_op_id: refundOpId.current,
        });
        if (error) throw error;
        const r = data as { refund_amount: number; replay?: boolean };
        message.success(
          r.replay
            ? `บิล ${detail.sale_number} คืน ${baht(r.refund_amount)} ไปแล้วก่อนหน้านี้ (ไม่ได้คืนซ้ำ)`
            : `คืน ${baht(r.refund_amount)} จากบิล ${detail.sale_number} แล้ว`,
        );
      }
      setRefundOpen(false);
      setDetail(null);
      await load();
    } catch (e) {
      message.error(apiError(e));
      /* ★ ข้อความแดงไม่ได้แปลว่าไม่มีอะไรเกิดขึ้น ★ คำสั่งอาจ commit แล้วแต่คำตอบหาย
         กลางทาง — ดึงรายการของบิลมาใหม่ทันที ให้ช่อง "คืนได้อีก" บอกความจริง ณ ตอนนี้
         แคชเชียร์จะได้เห็นเองว่ารอบที่แล้วเข้าไปแล้วหรือยัง ก่อนจะกดอะไรต่อ */
      try {
        setItems(await getPosSaleItems(detail.id));
      } catch {
        // อ่านไม่ได้ก็ปล่อยค่าเดิมไว้ ยังไงด่านกันซ้ำฝั่ง 0114 ก็ยังทำงานอยู่
      }
    } finally {
      setRefunding(false);
    }
  }

  // ── สรุปของ "วันนี้" — จากบิลของวันนี้ทั้งวัน ไม่ใช่จากตารางที่แสดงอยู่ ────────────
  const summary = useMemo(() => {
    // ยอดขาย = เงินที่ร้านได้เก็บไว้จริง จึงต้องหักที่คืนไปแล้วออกทุกใบ ทั้งคืนบางส่วน
    // (บิลยัง completed) และคืนเต็มใบ (total − refunded_amount = 0 พอดี)
    const real = todaySales.filter((s) => s.status !== 'voided');
    return {
      todayTotal: real.reduce((a, s) => a + s.total - s.refunded_amount, 0),
      todayCount: todaySales.filter((s) => s.status === 'completed').length,
      refundedCount: real.filter((s) => s.refunded_amount > 0).length,
      refundedTotal: real.reduce((a, s) => a + s.refunded_amount, 0),
    };
  }, [todaySales]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (pay !== 'all' && s.payment_method !== pay) return false;
      if (q && !s.sale_number.toLowerCase().includes(q) && !(s.customer_name ?? '').toLowerCase().includes(q))
        return false;
      if (onlyCurrentShift && s.shift_id !== currentShiftId) return false;
      return true;
    });
  }, [sales, query, status, pay, onlyCurrentShift, currentShiftId]);

  const columns: ColumnsType<PosSale> = [
    {
      title: 'เลขที่บิล',
      dataIndex: 'sale_number',
      key: 'no',
      render: (v: string, s) => (
        <div className="leading-tight">
          <div className="font-semibold text-[15px] text-[#2B2320] tabular-nums">{v}</div>
          {s.customer_name && <div className="text-[13px] text-[#8C837D]">{s.customer_name}</div>}
        </div>
      ),
    },
    {
      title: 'เวลา',
      key: 'time',
      render: (_, s) => {
        const t = timeParts(s.created_at);
        return (
          <div className="leading-tight tabular-nums">
            <div className="text-[15px] text-[#2B2320]">{t.time}</div>
            <div className="text-[13px] text-[#8C837D]">{t.date}</div>
          </div>
        );
      },
    },
    {
      title: 'วิธีชำระ',
      key: 'pay',
      render: (_, s) => (
        <Tag
          style={{
            color: PAY[s.payment_method]?.color,
            borderColor: PAY[s.payment_method]?.color,
            background: 'transparent',
            fontSize: 13,
          }}
        >
          {PAY[s.payment_method]?.label ?? s.payment_method}
        </Tag>
      ),
    },
    {
      title: 'ยอด',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      sorter: (a, b) => a.total - b.total,
      render: (v: number, s) => (
        <div className="leading-tight">
          <span className={`font-semibold text-[16px] tabular-nums ${s.status === 'refunded' ? 'text-[#B4ADA8] line-through' : 'text-[#2B2320]'}`}>
            {baht(v)}
          </span>
          {s.refunded_amount > 0 && s.status !== 'refunded' ? (
            <div className="text-[13px] tabular-nums" style={{ color: '#E5484D' }}>คืนแล้ว −{baht(s.refunded_amount)}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'รอบ',
      key: 'shift',
      width: 110,
      render: (_, s) => {
        if (!s.shift_id) return <span className="text-gray-300">—</span>;
        const sh = shifts.get(s.shift_id);
        return (
          <span
            className="text-[13px] tabular-nums"
            style={{ color: s.shift_id === currentShiftId ? ZONE.front : '#8C837D',
                     fontWeight: s.shift_id === currentShiftId ? 600 : 400 }}
          >
            {sh ? d(sh.opened_at).format('DD/MM HH:mm') : '…'}
            {s.shift_id === currentShiftId ? ' · รอบนี้' : ''}
          </span>
        );
      },
    },
    {
      title: 'สถานะ',
      key: 'status',
      align: 'center',
      width: 130,
      /* บิลปกติไม่ติดป้าย — เดิมทุกแถวมีป้าย "สำเร็จ" สีเขียวเรียงกันเป็นตับ ซึ่งไม่ได้
         บอกอะไรเลยเพราะบิลเกือบทั้งหมดสำเร็จ แล้วบิลที่มีปัญหาจริงก็จมหายไปในนั้น
         ตอนนี้เห็นป้ายเมื่อไหร่แปลว่าแถวนั้นต้องดู */
      render: (_, s) =>
        s.status === 'completed' && s.refunded_amount === 0 ? (
          <span className="text-[#D9D4D0]">—</span>
        ) : s.refunded_amount > 0 && s.status === 'completed' ? (
          <Tag color="warning" variant="filled">คืนบางส่วน</Tag>
        ) : (
          <Tag color={STATUS[s.status]?.color} variant="filled">
            {STATUS[s.status]?.label ?? s.status}
          </Tag>
        ),
    },
    {
      title: 'จัดการ',
      key: 'view',
      align: 'center',
      width: 96,
      render: (_, s) => (
        <Button
          size="small"
          color="cyan"
          variant="solid"
          icon={<RiFileList3Line className="w-4 h-4" />}
          onClick={(e) => {
            e.stopPropagation();
            void openDetail(s);
          }}>
          ดูบิล
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* บรรทัดอธิบายหน้าถูกเอาออก — "แตะที่บิลเพื่อดูรายละเอียด" คือสิ่งที่คนกด
          หนึ่งครั้งก็รู้เอง และเจ้าของเคยตีกลับเรื่องเอาคำอธิบายไปแปะบนหน้าเว็บ
          การ์ดสรุปเหลือสามใบ ตัด "บิลล่าสุด (แสดง)" ทิ้ง — มันคือจำนวนแถวที่โหลด
          มาแล้ว ไม่ใช่ตัวเลขของร้าน เปลี่ยนตามการกดโหลดเพิ่มด้วยซ้ำ */}
      <div className="flex items-center justify-end mb-3">
        <Button onClick={() => void load()}>รีเฟรช</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Card size="small" styles={{ body: { padding: '14px 18px' } }}>
          {/* บอกไว้บนหัวการ์ดว่าหักคืนแล้ว เพราะหน้ารายงานโชว์ยอดหน้าร้านแบบ "ก่อนหักคืน
              บางส่วน" (Reports.tsx:126 · ยอด gross ของ pos_dashboard) สองหน้าจะไม่เท่ากัน
              ในวันที่มีการคืนของ — ถ้าไม่เขียนไว้จะกลายเป็นตัวเลขขัดกันเองโดยไม่มีคำอธิบาย */}
          <div className="text-[13px] text-[#5C534E]">ยอดขายวันนี้ (หักคืนแล้ว)</div>
          <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: '#2B2320', lineHeight: 1.2 }}>
            {baht(summary.todayTotal)}
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '14px 18px' } }}>
          <div className="text-[13px] text-[#5C534E]">บิลวันนี้</div>
          <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: '#2B2320', lineHeight: 1.2 }}>
            {summary.todayCount} <span style={{ fontSize: 15, fontWeight: 400, color: '#8C837D' }}>บิล</span>
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '14px 18px' } }}>
          <div className="text-[13px] text-[#5C534E]">คืนเงินวันนี้</div>
          {/* เป็นบาท ไม่ใช่จำนวนบิล — ที่ต้องรู้ตอนนับลิ้นชักคือเงินที่จ่ายออกไป
              ส่วนจำนวนบิลบอกไว้ตัวเล็ก ๆ พอให้รู้ว่ามาจากกี่ใบ */}
          <div
            className="tabular-nums"
            style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: summary.refundedTotal ? '#E5484D' : '#2B2320' }}
          >
            {baht(summary.refundedTotal)}{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: '#8C837D' }}>{summary.refundedCount} บิล</span>
          </div>
        </Card>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b-2 border-[#D9D9D9]">
        <Input
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขบิล / ชื่อลูกค้า"
          prefix={<RiSearchLine className="w-4 h-4 text-gray-400" />}
          style={{ width: 240, borderRadius: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        />
        <Select
          value={pay}
          onChange={setPay}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: 'ทุกวิธีชำระ' },
            { value: 'cash', label: 'เงินสด' },
            { value: 'promptpay', label: 'พร้อมเพย์' },
            { value: 'store_credit', label: 'เครดิตร้าน' },
          ]}
        />
        <Segmented
          value={status}
          onChange={(v) => setStatus(v as string)}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'completed', label: 'สำเร็จ' },
            { value: 'refunded', label: 'คืนเงิน' },
          ]}
        />
        <DatePicker.RangePicker
          value={range}
          format="DD/MM/YYYY"
          placeholder={['จากวันที่', 'ถึงวันที่']}
          onChange={(r) => {
            const next = (r?.[0] && r?.[1] ? [r[0], r[1]] : null) as [Dayjs, Dayjs] | null;
            setRange(next);
            void load(next);
          }}
        />
        {currentShiftId ? (
          <Checkbox checked={onlyCurrentShift} onChange={(e) => setOnlyCurrentShift(e.target.checked)}>
            เฉพาะรอบปัจจุบัน
          </Checkbox>
        ) : null}
      </div>

      <Table<PosSale>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={shown}
        onRow={(s) => ({ onClick: () => void openDetail(s), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 15, hideOnSinglePage: true, showTotal: (t) => `${t} บิล` }}
        scroll={{ x: 640 }}
        style={{ background: '#fff', borderRadius: 0 }}
        locale={{
          emptyText: query || status !== 'all' || pay !== 'all' ? 'ไม่พบบิลที่ตรงกับตัวกรอง' : 'ยังไม่มีบิลขาย',
        }}
      />
      <div className="flex justify-center mt-3">
        <Button onClick={() => void loadMore()} loading={loadingMore} disabled={noMore || !sales.length}>
          {noMore ? 'ครบทุกบิลแล้ว' : 'โหลดบิลเก่ากว่านี้'}
        </Button>
      </div>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        size="default"
        title={detail ? `บิล ${detail.sale_number}` : ''}
        styles={{ body: { background: '#FAFAFA' } }}
        extra={
          detail?.status === 'completed' ? (
            <div className="flex items-center gap-2">
              {detail.refunded_amount > 0 ? (
                <Tag color="warning" variant="filled">คืนแล้ว {baht(detail.refunded_amount)}</Tag>
              ) : null}
              <Button danger icon={<RiRefund2Line className="w-4 h-4" />} disabled={!items.length} onClick={openRefund}>
                คืนเงิน
              </Button>
            </div>
          ) : detail?.status === 'refunded' ? (
            <Tag color="error" variant="filled">
              คืนเงินแล้ว
            </Tag>
          ) : null
        }
        footer={
          <Button
            type="primary"
            block
            size="large"
            icon={<RiPrinterLine className="w-4 h-4" />}
            disabled={!shop || !items.length}
            onClick={() => window.print()}>
            พิมพ์บิล
          </Button>
        }>
        {detail && shop && (
          <div className="mx-auto max-w-[300px] bg-white rounded-none shadow-sm px-4 py-4">
            {/* ★ การคืนต้องติดไปบนกระดาษด้วย ★ ป้าย "คืนแล้ว ฿X" ที่หัวลิ้นชักโดน print CSS
                ซ่อนทิ้ง (index.css:57 ซ่อน .ant-drawer-header) ใบที่พิมพ์ซ้ำจึงออกมาเป็นยอดเต็ม
                เหมือนไม่เคยคืน ลูกค้าถือกระดาษใบนั้นไปยืนยันว่าจ่ายเต็มได้ หรือแคชเชียร์อีกคน
                เห็นแล้วคืนเงินสดให้ด้วยมือนอกระบบ · ทุกใบที่ออกจากหน้านี้คือใบพิมพ์ซ้ำเสมอ
                จึงตีตรา "สำเนา" ไว้ด้วย ให้แยกออกจากใบจริงที่ออกตอนขาย */}
            <Receipt
              shop={shop}
              saleNumber={detail.sale_number}
              at={new Date(detail.created_at).toLocaleString('th-TH')}
              taxInvoiceNo={detail.tax_invoice_no}
              customerName={detail.customer_name}
              customerTaxId={detail.customer_tax_id}
              items={items.map((i) => ({
                name: i.product_name,
                size: i.size,
                qty: i.qty,
                unitPrice: i.unit_price,
                lineTotal: i.line_total,
                lineDiscount: i.line_discount,
                refundedQty: i.refunded_qty,
              }))}
              subtotal={detail.total + detail.discount}
              discount={detail.discount}
              vatAmount={detail.vat_amount}
              netAmount={detail.net_amount}
              total={detail.total}
              paymentMethod={detail.payment_method}
              cashPaid={detail.payment_method === 'cash' && detail.cash_tendered != null ? detail.cash_tendered : null}
              change={detail.payment_method === 'cash' ? detail.change : null}
              refundedAmount={detail.refunded_amount}
              reprint
            />
          </div>
        )}
      </Drawer>

      {/* โมดัลคืนเงิน — เลือกรายการ+จำนวน (ข้อ ①) + เหตุผลบังคับ (ข้อ ②) */}
      <Modal
        open={refundOpen}
        onCancel={() => setRefundOpen(false)}
        title={`คืนเงินบิล ${detail?.sale_number ?? ''}`}
        /* ยอดอยู่บนปุ่มด้วย เพราะตาคนอยู่ที่ปุ่มตอนกด ไม่ได้อยู่ที่กล่องด้านบน */
        okText={refund.amount > 0 ? `ยืนยันคืน ${baht(refund.amount)}` : 'ยืนยันคืนเงิน'}
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true, loading: refunding, disabled: !refundReason }}
        onOk={() => void submitRefund()}>
        <div className="space-y-3">
          <div>
            <div className="text-[13px] text-gray-500 mb-1">เหตุผลการคืน (บังคับ)</div>
            <Select
              value={refundReason}
              onChange={setRefundReason}
              placeholder="เลือกเหตุผล"
              style={{ width: '100%' }}
              options={REASONS.map((r) => ({ value: r, label: r }))}
            />
            {refundReason === 'อื่นๆ' ? (
              <Input
                className="mt-2"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="ระบุเหตุผล"
                maxLength={120}
              />
            ) : null}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[13px] text-gray-500">รายการที่คืน (ใส่จำนวนที่ลูกค้าเอามาคืน)</div>
              <div className="flex gap-1">
                <Button
                  size="small"
                  onClick={() =>
                    setRefundPicks(Object.fromEntries(items.map((i) => [i.id, i.qty - i.refunded_qty])))
                  }>
                  คืนทั้งบิล
                </Button>
                <Button size="small" onClick={() => setRefundPicks({})}>
                  ล้าง
                </Button>
              </div>
            </div>
            <div className="border divide-y" style={{ borderColor: '#E8E8E8' }}>
              {items.map((i) => {
                const max = i.qty - i.refunded_qty;
                if (max <= 0)
                  return (
                    <div key={i.id} className="flex justify-between px-3 py-2 text-gray-400 text-[13.5px]">
                      <span className="line-through">{i.product_name}{i.size ? ` (${i.size})` : ''}</span>
                      <span>คืนครบแล้ว</span>
                    </div>
                  );
                return (
                  <div key={i.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[#2B2320] truncate">
                        {i.product_name}{i.size ? ` (${i.size})` : ''}
                      </div>
                      <div className="text-[12px] text-gray-500">ซื้อ {i.qty} · คืนได้อีก {max}</div>
                    </div>
                    <InputNumber
                      min={0}
                      max={max}
                      value={refundPicks[i.id] ?? 0}
                      onChange={(v) => setRefundPicks((prev) => ({ ...prev, [i.id]: Math.max(0, Math.min(max, Number(v) || 0)) }))}
                      style={{ width: 80 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div
              className="flex items-baseline justify-between px-3 py-2"
              style={{ border: '1px solid #F0CFCC', background: refund.amount > 0 ? '#FFF6F5' : '#FAFAFA' }}>
              <span className="text-[13px] text-[#5C534E]">
                {detail?.payment_method === 'store_credit' ? 'คืนเข้าเครดิตร้าน' : 'จ่ายคืนลูกค้า'}
                {refund.isFull ? ' (ทั้งบิล)' : ''}
              </span>
              <span
                className="tabular-nums"
                style={{ fontSize: 26, fontWeight: 700, color: refund.amount > 0 ? '#E5484D' : '#B4ADA8' }}>
                {baht(refund.amount)}
              </span>
            </div>
            {detail && detail.refunded_amount > 0 ? (
              /* บิลที่เคยคืนไปแล้วเหลือจ่ายจริงน้อยกว่ายอดหน้าบิลมาก — ถ้าไม่บอกตรงนี้
                 คนหน้าร้านจะนับเงินออกตามยอดบิลเต็ม */
              <div className="text-[12px] text-[#8C837D] mt-1">
                บิลนี้ยอด {baht(detail.total)} · คืนไปแล้ว {baht(detail.refunded_amount)} · เหลือคืนได้อีกไม่เกิน{' '}
                {baht(detail.total - detail.refunded_amount)}
              </div>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
