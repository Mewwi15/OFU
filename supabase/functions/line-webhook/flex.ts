// การ์ด Flex สำหรับบอทเจ้าของร้าน — "ตอนนี้ร้านเป็นยังไง" ตอบได้ตอนอยู่ข้างนอก
//
// กราฟิกวาดด้วยกล่องของ Flex เอง (box ซ้อนกันแล้วให้ค่า flex ตามสัดส่วน) ไม่ใช่
// รูปภาพ — ไม่ต้องมีที่เก็บไฟล์ ไม่ต้องรอโหลด และคมทุกความละเอียดหน้าจอ
//
// สีล้อธีมแอดมิน (src/theme.ts): แดงเตือน #E5484D · เขียวเสจ #5B8C6E

const C = {
  buy: '#E5484D',
  ok: '#8FB3A0',
  idle: '#E9E4DF',
  text: '#2B2320',
  muted: '#8C837D',
  line: '#EDEAE7',
  brand: '#5B8C6E',
} as const;

type Box = Record<string, unknown>;

const th = (n: number) => n.toLocaleString('th-TH');
const baht = (n: number) => `฿${th(Math.round(n))}`;

/** แถบสัดส่วนแนวนอน — กล่องสีเรียงกัน กว้างตามตัวเลขจริง */
function bar(parts: { value: number; color: string }[]): Box {
  const shown = parts.filter((p) => p.value > 0);
  return {
    type: 'box',
    layout: 'horizontal',
    height: '10px',
    cornerRadius: '5px',
    backgroundColor: C.idle,
    contents: shown.map((p) => ({
      type: 'box',
      layout: 'vertical',
      contents: [],
      flex: Math.max(1, p.value),
      backgroundColor: p.color,
    })),
  };
}

function legendDot(color: string, label: string, value: number): Box {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'xs',
    contents: [
      { type: 'box', layout: 'vertical', contents: [], width: '8px', height: '8px', cornerRadius: '4px', backgroundColor: color, margin: 'xs' },
      { type: 'text', text: label, size: 'xxs', color: C.muted, flex: 0, margin: 'xs' },
      { type: 'text', text: th(value), size: 'xxs', color: C.text, weight: 'bold', flex: 0, margin: 'xs' },
    ],
  };
}

/** แถวข้อมูล ซ้าย-ขวา */
function row(left: string, right: string, opts: { strong?: boolean; color?: string } = {}): Box {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: left, size: 'sm', color: C.text, flex: 5, wrap: false },
      {
        type: 'text', text: right, size: 'sm', flex: 2, align: 'end',
        weight: opts.strong ? 'bold' : 'regular',
        color: opts.color ?? C.muted,
      },
    ],
  };
}

const sep = { type: 'separator', margin: 'md', color: C.line };

function header(title: string, when: string): Box {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: C.brand,
    paddingAll: '14px',
    contents: [
      { type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'lg' },
      { type: 'text', text: when, color: '#DCE7DF', size: 'xxs', margin: 'xs' },
    ],
  };
}

/** คืน `{}` เมื่อไม่มี URL — bubble ที่มี footer เป็นกล่องเปล่า LINE ปฏิเสธทั้งใบ
 *  (ADMIN_URL ยังไม่ได้ตั้งคือเคสปกติ ไม่ควรทำให้การ์ดพังทั้งใบ) */
function footerWith(label: string, uri?: string): { footer?: Box } {
  if (!uri) return {};
  return {
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label, uri } }],
    },
  };
}

const now = () =>
  new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

/* ── สต๊อก ─────────────────────────────────────────────────────────────── */

export type StockSummary = {
  total: number; buy: number; out: number; idle: number; ok: number; pieces: number;
  by_category: { category: string; count: number; buy: number }[];
  items: { name: string; category: string; stock: number; unit: string; qty: number }[];
};

export function stockFlex(s: StockSummary, adminUrl?: string) {
  const cats = s.by_category.filter((c) => c.buy > 0).slice(0, 5);
  const items = s.items.slice(0, 8);

  return {
    type: 'flex',
    altText: `สต๊อก — ต้องซื้อ ${s.buy} รายการ`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: header('สต๊อกร้านอู้ฟู่', now()),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          // ตัวเลขที่ต้องลงมือทำ อยู่บนสุด ตัวใหญ่สุด
          {
            type: 'box', layout: 'baseline', contents: [
              { type: 'text', text: 'ต้องซื้อ', size: 'sm', color: C.muted, flex: 0 },
              { type: 'text', text: ` ${th(s.buy)} `, size: '3xl', weight: 'bold', color: C.buy, flex: 0 },
              { type: 'text', text: 'รายการ', size: 'sm', color: C.muted, flex: 0 },
            ],
          },
          bar([
            { value: s.buy, color: C.buy },
            { value: s.idle, color: C.idle },
            { value: s.ok, color: C.ok },
          ]),
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
              legendDot(C.buy, 'ต้องซื้อ', s.buy),
              legendDot(C.idle, 'ไม่ขยับ', s.idle),
              legendDot(C.ok, 'พอ', s.ok),
            ],
          },
          {
            type: 'text',
            text: `ของในร้าน ${th(s.pieces)} ชิ้น · ${th(s.total)} รายการ · หมดแล้ว ${th(s.out)}`,
            size: 'xxs', color: C.muted, wrap: true,
          },

          ...(cats.length ? [sep, { type: 'text', text: 'ต้องซื้อแยกหมวด', size: 'xs', color: C.muted, weight: 'bold' }] : []),
          ...cats.map((c) => row(c.category, `${th(c.buy)} / ${th(c.count)}`, { strong: true, color: C.buy })),

          ...(items.length ? [sep, { type: 'text', text: `รายการที่ต้องซื้อ (${items.length} จาก ${th(s.buy)})`, size: 'xs', color: C.muted, weight: 'bold' }] : []),
          ...items.map((i) => ({
            type: 'box', layout: 'vertical', margin: 'sm', contents: [
              { type: 'text', text: i.name, size: 'sm', color: C.text, wrap: true },
              {
                type: 'box', layout: 'horizontal', contents: [
                  { type: 'text', text: `เหลือ ${th(i.stock)}`, size: 'xxs', color: i.stock === 0 ? C.buy : C.muted, flex: 1 },
                  { type: 'text', text: `ซื้อ ${th(i.qty)} ${i.unit}`, size: 'xs', color: C.text, weight: 'bold', align: 'end', flex: 1 },
                ],
              },
            ],
          })),
        ],
      },
      ...footerWith('เปิดรายการเต็มบนเว็บ', adminUrl ? `${adminUrl}/stock` : undefined),
    },
  };
}

/* ── ออเดอร์ ───────────────────────────────────────────────────────────── */

const ORDER_STATUS_TH: Record<string, string> = {
  placed: 'รอชำระ',
  awaiting_payment: 'รอชำระ',
  slip_uploaded: 'รอตรวจสลิป',
  payment_verifying: 'รอตรวจสลิป',
  confirmed: 'รอจัดของ',
  preparing: 'กำลังจัดของ',
  assigned_to_rider: 'มอบให้ไรเดอร์',
  picked_up: 'ไรเดอร์รับแล้ว',
  in_transit: 'กำลังส่ง',
  out_for_delivery: 'กำลังไปส่ง',
};

export type OrdersSummary = {
  today_count: number; today_baht: number; open: number;
  need_slip: number; to_prepare: number; shipping: number; unpaid: number;
  delivered_today: number;
  items: { no: string; status: string; total: number; mode: string; placed_at: string }[];
};

export function ordersFlex(o: OrdersSummary, adminUrl?: string) {
  const items = o.items.slice(0, 8);
  const urgent = o.need_slip + o.to_prepare;

  return {
    type: 'flex',
    altText: `ออเดอร์ — ค้างอยู่ ${o.open} รายการ`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: header('ออเดอร์ร้านอู้ฟู่', now()),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'baseline', contents: [
              { type: 'text', text: 'รอเราจัดการ', size: 'sm', color: C.muted, flex: 0 },
              { type: 'text', text: ` ${th(urgent)} `, size: '3xl', weight: 'bold', color: urgent > 0 ? C.buy : C.brand, flex: 0 },
              { type: 'text', text: 'รายการ', size: 'sm', color: C.muted, flex: 0 },
            ],
          },
          bar([
            { value: o.need_slip, color: C.buy },
            { value: o.to_prepare, color: '#E08C00' },
            { value: o.shipping, color: C.ok },
            { value: o.unpaid, color: C.idle },
          ]),
          {
            type: 'box', layout: 'vertical', spacing: 'xs', contents: [
              row('รอตรวจสลิป', th(o.need_slip), { strong: o.need_slip > 0, color: o.need_slip > 0 ? C.buy : C.muted }),
              row('รอจัดของ', th(o.to_prepare), { strong: o.to_prepare > 0, color: o.to_prepare > 0 ? '#E08C00' : C.muted }),
              row('กำลังส่ง', th(o.shipping)),
              row('ยังไม่จ่าย', th(o.unpaid)),
            ],
          },
          sep,
          row('วันนี้รับมา', `${th(o.today_count)} ออเดอร์ · ${baht(o.today_baht)}`, { strong: true, color: C.text }),
          row('ส่งสำเร็จวันนี้', th(o.delivered_today)),

          ...(items.length ? [sep, { type: 'text', text: 'ที่ต้องดูก่อน', size: 'xs', color: C.muted, weight: 'bold' }] : []),
          ...items.map((i) => ({
            type: 'box', layout: 'horizontal', margin: 'sm', contents: [
              {
                type: 'box', layout: 'vertical', flex: 3, contents: [
                  { type: 'text', text: i.no, size: 'sm', color: C.text, weight: 'bold' },
                  { type: 'text', text: ORDER_STATUS_TH[i.status] ?? i.status, size: 'xxs', color: C.muted },
                ],
              },
              { type: 'text', text: baht(i.total), size: 'sm', color: C.text, align: 'end', flex: 2, gravity: 'center' },
            ],
          })),
          ...(o.open === 0 ? [{ type: 'text', text: 'ไม่มีออเดอร์ค้าง', size: 'sm', color: C.muted, align: 'center', margin: 'lg' }] : []),
        ],
      },
      ...footerWith('เปิดหน้าออเดอร์บนเว็บ', adminUrl ? `${adminUrl}/orders` : undefined),
    },
  };
}

/** ปุ่มลัดใต้ช่องพิมพ์ — กดแทนพิมพ์ได้ ไม่ต้องตั้ง Rich Menu ให้ยุ่ง */
export const OWNER_QUICK_REPLY = {
  items: [
    { type: 'action', action: { type: 'message', label: '📦 สต๊อก', text: 'สต๊อก' } },
    { type: 'action', action: { type: 'message', label: '🧾 ออเดอร์', text: 'ออเดอร์' } },
  ],
};
