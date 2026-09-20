/**
 * ส่งบิลไปพิมพ์ผ่าน "ตัวกลางพิมพ์บิล" ที่รันอยู่ในเครื่องขาย (tools/pos-print-agent)
 *
 * เจ้าของเสนอทางนี้เอง 15 ก.ย. 2026 หลังเจอว่าโหมดพิมพ์เงียบของ Chrome ลากใบ A4 ลง
 * ม้วนกระดาษบิลไปด้วย — ตัวกลางระบุชื่อเครื่องพิมพ์ตรง ๆ จึงไม่ต้องยุ่งกับเครื่องพิมพ์หลัก
 * ของ Windows เลย เอกสาร A4 พิมพ์ปกติเหมือนเดิม
 * พิสูจน์กับเครื่องจริงแล้ววันเดียวกัน: ส่งข้อมูลดิบเข้าคิว 'POS58 Printer' แล้วกระดาษออก
 *
 * ★ ส่งเป็นรูป ไม่ใช่ตัวหนังสือ ★ เครื่องพิมพ์บิลราคาถูกเก็บฟอนต์ไทยไม่ครบและใช้รหัส
 * อักขระคนละมาตรฐาน ส่งไทยตรง ๆ เสี่ยงได้กระดาษเต็มไปด้วยตัวขยะ — ถ่ายรูปใบเสร็จที่
 * วาดบนจออยู่แล้วส่งไป ได้หน้าตาตรงกับที่เห็นทุกตัวอักษร รวมโลโก้และบาร์โค้ด
 * และมีที่ให้แก้หน้าตาบิลอยู่ที่เดียวคือ Receipt.tsx ไม่ต้องเขียนเลย์เอาต์ซ้ำในฝั่ง Python
 */

import { notification } from 'antd';

import { contentMm, getReceiptConfig } from './receiptConfig';

/** หัวพิมพ์ความร้อน 203 dpi = 8 จุดต่อมิลลิเมตร — เท่ากันทุกรุ่นที่ร้านใช้ */
const DOTS_PER_MM = 8;

/**
 * ความกว้างหัวพิมพ์จริงของเครื่องที่ตัวกลางคุยด้วย — เครื่อง 58 มม. พิมพ์ได้ 48 มม.
 *
 * ★ ทางตัวกลางเป็นเครื่อง 58 มม. อย่างเดียว ★ ตัวกลาง (tools/pos-print-agent) ยิง ESC/POS
 * ดิบ ๆ ที่ความกว้างนี้ตายตัวอยู่แล้ว ช่อง "ขนาดกระดาษ" ในหน้าตั้งค่าจึงคุมเฉพาะทาง
 * พิมพ์ผ่านเบราว์เซอร์กับตัวอย่างบนจอ ไม่เกี่ยวกับทางนี้
 */
const HEAD_DOTS = 384;

/** เว้นขาวข้างละ 1 มม. — กันหัวพิมพ์บางรุ่นที่แคบกว่ามาตรฐานนิดหน่อยกินขอบขวา */
const SAFE_MARGIN_DOTS = 8;

/**
 * ความกว้างของ "เนื้อบิล" ที่จะวาด — เกือบเต็มหัวพิมพ์
 *
 * ★ ทำไมต้องกว้างเกือบเต็ม ★ (เจ้าของแจ้ง 20 ก.ย. 2569 "บิลมันกินมาทางซ้าย ไม่กลาง
 * ลองเพิ่มความใหญ่ของตัวอักษรดู") ของเดิมคิดจากค่าขนาดกระดาษในหน้าตั้งค่า ซึ่งตั้งไว้
 * 48 มม. → เนื้อบิล 40 มม. = 320 จุด แล้วไปพิมพ์บนหัว 48 มม. เหลือขาวข้างละ 4 มม.
 * ตัวหนังสือจึงทั้งเล็กและไม่เต็มหน้า · วาดที่ 46 มม. แทน ตัวหนังสือโตขึ้นราว 15%
 * โดยไม่ต้องไปแตะขนาดฟอนต์ (สัดส่วนทุกบรรทัดคงเดิมเป๊ะ แค่วาดละเอียดขึ้น)
 *
 * ★ ตั้งเองไว้ก็เคารพค่านั้น ★ เครื่องไหนขอบขวาโดนตัด ลดค่านี้ในหน้าตั้งค่าได้เหมือนเดิม
 */
function configuredDots(): number {
  const cfg = getReceiptConfig();
  if (cfg.contentWidthMm != null) {
    return Math.round(contentMm(cfg.paperWidth, cfg.contentWidthMm) * DOTS_PER_MM);
  }
  return HEAD_DOTS - SAFE_MARGIN_DOTS * 2;
}

/** สถานะเครื่องพิมพ์ตัวหนึ่งตามที่ Windows รายงาน */
export type PrinterState = {
  name: string;
  ready: boolean;
  problems: string[];
  /** งานค้างในคิว — ค้างเยอะแปลว่ารับงานแต่ไม่ได้พิมพ์ออกมา (เครื่องปิดอยู่) */
  jobs: number;
};

export type AgentStatus =
  | { ok: true; printer: string; state?: PrinterState }
  | { ok: false; reason: 'ไม่พบตัวกลาง' | 'ตัวกลางมีปัญหา' };

const url = (port: number, path: string) => `http://127.0.0.1:${port}${path}`;

/**
 * ตัวกลางรันอยู่ไหม และจะพิมพ์ออกเครื่องไหน
 *
 * ★ ต้องมีเวลาจำกัด ★ ถ้าไม่มีใครฟังอยู่ที่พอร์ตนั้น เบราว์เซอร์บางตัวจะค้างรอจนหมดเวลา
 * ของระบบ (เป็นสิบวินาที) — หน้าจบบิลรอขนาดนั้นไม่ได้ ลูกค้ายืนอยู่ตรงหน้า
 */
export async function agentStatus(port: number, timeoutMs = 1200): Promise<AgentStatus> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  try {
    const res = await fetch(url(port, '/ping'), { signal: stop.signal });
    if (!res.ok) return { ok: false, reason: 'ตัวกลางมีปัญหา' };
    const body = (await res.json()) as { ok?: boolean; printer?: string; state?: PrinterState };
    if (!body?.ok || !body.printer) return { ok: false, reason: 'ตัวกลางมีปัญหา' };
    return { ok: true, printer: body.printer, state: body.state };
  } catch {
    /* ปิดอยู่ / Chrome บล็อก / พอร์ตผิด — ปลายทางเดียวกันคือ "ใช้ไม่ได้ตอนนี้" */
    return { ok: false, reason: 'ไม่พบตัวกลาง' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * แปลงใบเสร็จบนจอเป็นรูปขาวดำกว้างเท่าหัวพิมพ์
 *
 * ★ ต้องยกใบเสร็จออกมาถ่ายข้างนอก ★ (เจ้าของยืนยันกับกระดาษจริง 15 ก.ย. 2026 ว่าบรรทัด
 * ท้ายสุดหายไปตั้งแต่ในรูป ไม่ใช่หายที่เครื่องพิมพ์) ของจริงบนจอนั่งอยู่ในหน้าต่างของ antd
 * ซึ่งมีทั้งกล่องที่ตัดขอบและการย่อ/ขยาย (transform) ซ้อนกันหลายชั้น ตัวถ่ายรูปคำนวณ
 * ขอบล่างพลาดไปราวหนึ่งบรรทัด — ผมไล่ปลดทีละชั้น (เริ่มจากถาดที่เลื่อนดูได้) แล้วยังขาด
 * เพราะไม่มีทางรู้ว่าวันหน้าจะมีกล่องอะไรมาครอบเพิ่มอีก
 * โคลนออกมาแปะไว้นอกจอแล้วถ่ายจากตรงนั้น = ไม่มีกล่องแม่ให้คำนวณพลาดตั้งแต่แรก
 * ปัญหาทั้งตระกูลนี้จบในทีเดียว และของบนจอไม่ถูกแตะเลย ผู้ใช้ไม่เห็นอะไรกระพริบ
 */
async function receiptToPng(el: HTMLElement, dots: number): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');

  const host = document.createElement('div');
  /* วางไว้นอกจอ แต่ต้องถูกจัดวางจริง (ห้าม display:none) ไม่งั้นความสูงเป็นศูนย์ */
  host.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;margin:0;padding:0;';
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    /* ★ ขยายตอนถ่าย ไม่ใช่ตอนส่ง ★ ใบเสร็จบนจอกว้างราว 150 จุด ถ้าถ่ายเท่าที่เห็นแล้วไป
       ขยายทีหลัง ตัวหนังสือจะเบลอจนอ่านไม่ออกบนกระดาษ — วาดใหม่ที่ความละเอียดปลายทาง
       เลย ตัวอักษรจึงคมเท่าที่เครื่องพิมพ์ทำได้ */
    const scale = dots / (clone.offsetWidth || 1);
    const full = clone.scrollHeight;
    const canvas = await html2canvas(clone, {
      scale,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      height: full,
      windowHeight: full,
    });

    /* ★ ตรวจว่าถ่ายมาครบใบ ★ บิลที่ขาดท้ายคือของเสียที่ลูกค้าถือกลับบ้าน และไม่มีอะไร
       ฟ้องเลยถ้าไม่ตรวจ — ขาดเกิน 2% (ราวหนึ่งบรรทัด) ถือว่าไม่ผ่าน แล้วให้ผู้เรียกถอยไป
       พิมพ์ผ่านเบราว์เซอร์ซึ่งพิมพ์เต็มใบเสมอ
       ★ เดิมตั้งไว้ 10% ซึ่งหลวมเกินไป ★ บิลหนึ่งใบสูงราว 1,000 จุด บรรทัดท้ายที่หายไป
       คิดเป็นแค่ 3% จึงรอดด่านนี้ไปได้ทุกครั้ง ทั้งที่เป็นอาการที่เจ้าของเจอจริง */
    const expected = full * scale;
    if (expected > 0 && canvas.height < expected * 0.98) {
      throw new Error(`ถ่ายใบเสร็จได้ไม่ครบ (${canvas.height}/${Math.round(expected)} จุด)`);
    }

    /* ★ จัดกึ่งกลางตั้งแต่ตรงนี้ ไม่ฝากตัวกลาง ★ (เจ้าของแจ้งซ้ำ 20 ก.ย. 2569 ว่า
       "บิลมันกินมาทางซ้าย ไม่กลาง") ตัวกลางรุ่นใหม่จัดกึ่งกลางให้อยู่แล้ว แต่เครื่องขาย
       ต้องรัน setup.ps1 ใหม่ถึงจะได้ตัวใหม่ ซึ่งเรารู้ไม่ได้เลยว่าเครื่องนั้นรันรุ่นไหนอยู่
       รุ่นเก่าพิมพ์จากจุดที่ 0 เสมอ รูปที่แคบกว่าหัวพิมพ์จึงไปกองซ้ายทุกใบ
       ส่งรูปที่กว้างเท่าหัวพิมพ์พอดีไปเลย ทั้งสองรุ่นให้ผลเหมือนกัน — เรื่องนี้จบถาวร
       ★ เติมเป็นสีขาว ★ กระดาษความร้อนไม่ได้พิมพ์สีขาว ขาวคือไม่ยิงหมึก ไม่เปลืองอะไร */
    const out = document.createElement('canvas');
    out.width = Math.max(canvas.width, HEAD_DOTS);
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('เตรียมรูปใบเสร็จไม่สำเร็จ');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, Math.round((out.width - canvas.width) / 2), 0);

    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
    if (!blob) throw new Error('แปลงใบเสร็จเป็นรูปไม่สำเร็จ');
    return blob;
  } finally {
    host.remove();
  }
}

/**
 * เตือนเมื่อเครื่องพิมพ์รับงานไว้แต่กระดาษไม่น่าจะออก
 *
 * ★ "ส่งเข้าคิวสำเร็จ" ไม่ใช่ "ลูกค้าได้บิล" ★ Windows รับงานเข้าคิวเสมอแม้เครื่องพิมพ์
 * ปิดอยู่ ตัวกลางจึงตอบ 200 ทุกครั้ง — ของเดิมอ่านแค่รหัส HTTP แล้วทิ้ง body ทั้งก้อน
 * ทั้งที่ตัวกลางอุตส่าห์ไปถามสถานะจริงมาแนบให้ หน้าจบบิลเลยขึ้นว่าพิมพ์แล้วทั้งที่
 * กระดาษหมด/เครื่องปิด · ลูกค้ารับเงินทอนแล้วเดินกลับโดยไม่มีบิล แล้ววันหลังพอเปิด
 * เครื่องพิมพ์ บิลที่ค้างคิวจะพ่นออกมาพรวดเดียวทั้งกอง
 *
 * ★ ทำไมต้องถึงสามงาน ★ ตัวกลางถามสถานะทันทีหลังส่ง ขณะที่บิลใบนี้ยังไหลอยู่ในคิว
 * มันจึงนับตัวเองรวมไปด้วยหนึ่งงานเสมอ — เตือนที่ jobs > 0 คือเตือนหลอกทุกใบ แล้วคน
 * หน้าเครื่องจะเลิกอ่านแถบเตือนภายในวันเดียว · สามงาน = มีของเก่าค้างอยู่จริงสองใบ
 */
function warnIfPrinterStuck(state: PrinterState) {
  const piled = state.jobs >= 3;
  if (state.ready && !piled) return;
  const bits = [...state.problems];
  if (piled) bits.push(`ค้างในคิว ${state.jobs} งาน`);
  notification.error({
    /* คีย์เดียวกันทุกครั้ง — ขายรัว ๆ แล้วมีปัญหาจริง ต้องไม่กลายเป็นกล่องเตือนซ้อนกันเป็นตั้ง */
    key: 'pos-printer-stuck',
    message: 'บิลอาจไม่ออกจากเครื่องพิมพ์',
    description: `${bits.join(' · ') || 'เครื่องพิมพ์ไม่พร้อม'} — เช็คเครื่องพิมพ์แล้วกดพิมพ์อีกครั้ง`,
    placement: 'topRight',
    duration: 0, // ค้างไว้จนกว่าจะกดปิด: เงินทอนออกไปแล้ว บิลยังไม่ออก
  });
}

/** เวลาจำกัดของการส่งบิล — ตัวกลางในเครื่องเดียวกันใช้เวลาไม่ถึงสองวินาทีแม้บิลยาว ๆ */
const PRINT_TIMEOUT_MS = 8000;

/* ★ กดซ้ำระหว่างที่ยังพิมพ์ไม่เสร็จ ต้องไม่ได้กระดาษใบที่สอง ★ ทางตัวกลางใช้เวลาหลาย
   ร้อยมิลลิวินาที (รอฟอนต์ + ถ่ายรูปใหม่ที่ความละเอียดปลายทาง + ฝั่ง Python วนบิตทีละจุด)
   ระหว่างนั้นปุ่มยังอ่านว่า "พิมพ์บิล" เฉย ๆ แคชเชียร์ที่ยังไม่เห็นกระดาษจะกดซ้ำตาม
   สัญชาตญาณ · คนที่มาทีหลังใช้ผลของงานที่กำลังวิ่งอยู่ ไม่เปิดงานใหม่ — และห้ามคืน false
   ในกรณีนี้ เพราะผู้เรียกจะถอยไป window.print() แล้วได้หน้าต่างพิมพ์เด้งใส่แทน */
let inFlight: Promise<boolean> | null = null;

/**
 * พิมพ์ใบเสร็จผ่านตัวกลาง — คืน true เมื่อกระดาษถูกส่งเข้าเครื่องพิมพ์แล้ว
 *
 * ไม่โยน error ออกไป: ผู้เรียกต้องถอยไปใช้การพิมพ์ผ่านเบราว์เซอร์ได้เสมอ การพิมพ์บิล
 * ห้ามล้มทั้งกระบวนการเพราะตัวกลางปิดอยู่
 */
export function printViaAgent(el: HTMLElement, port: number, dots?: number): Promise<boolean> {
  if (inFlight) return inFlight;
  const job = sendToAgent(el, port, dots).finally(() => {
    inFlight = null;
  });
  inFlight = job;
  return job;
}

async function sendToAgent(el: HTMLElement, port: number, dots?: number): Promise<boolean> {
  try {
    const png = await receiptToPng(el, dots ?? configuredDots());
    /* ★ ต้องมีเวลาจำกัด ★ ถ้าตัวกลางค้าง (คิวพิมพ์ของ Windows ล็อกอยู่) คำขอนี้ไม่มีวัน
       จบเอง หน้าจบบิลจะนิ่งไปเฉย ๆ โดยไม่มีอะไรบอก — ล้มเร็วแล้วถอยไปทางเบราว์เซอร์
       ดีกว่าค้างตอนลูกค้ายืนรอ · หมายเหตุ: การยกเลิกฝั่งเราไม่ได้ยกเลิกงานที่ส่งไปแล้ว
       ถ้าตัวกลางฟื้นทีหลัง กระดาษยังออกได้ จึงต้องตั้งให้นานพอที่จะไม่ตัดงานปกติทิ้ง */
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), PRINT_TIMEOUT_MS);
    try {
      const res = await fetch(url(port, '/print'), {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: png,
        signal: stop.signal,
      });
      if (!res.ok) return false;
      /* สถานะจริงของเครื่องพิมพ์มากับ body ของงานที่เพิ่งส่ง — อ่านตรงนี้ที่เดียว
         หน้าอื่นไม่ต้องรู้เรื่อง แค่เรียกพิมพ์เหมือนเดิมก็ได้คำเตือนไปด้วย */
      const body = (await res.json().catch(() => null)) as { state?: PrinterState } | null;
      if (body?.state) warnIfPrinterStuck(body.state);
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/**
 * เปิดลิ้นชักโดยไม่พิมพ์อะไร — คืน true เมื่อตัวกลางสั่งเปิดให้แล้ว
 *
 * ★ สลิปที่มีหน้าที่ "ทำให้ลิ้นชักเด้ง" ต้องไม่ฝากชีวิตไว้กับไดรเวอร์ ★ ใบเปิดรอบ ใบนับเงิน
 * และสลิปเปิดลิ้นชักเปล่า พิมพ์ผ่านเบราว์เซอร์ = ไปที่เครื่องพิมพ์หลักของ Windows ซึ่งอาจ
 * เป็น Brother A4 ตามที่คู่มือตัวกลางบอกให้ตั้งได้ ลิ้นชักจึงไม่เด้งเลย ทั้งที่ระบบบันทึกไป
 * แล้วว่าเปิด — แล้วแคชเชียร์ต้องกดซ้ำ ซึ่งบันทึก "เติมเงินทอน/เก็บเงินออก" ซ้ำไปด้วย
 * ทางนี้ยิงคำสั่งเข้าเครื่องพิมพ์บิลตรง ๆ ไม่เกี่ยวกับเครื่องพิมพ์หลักเลย
 */
export async function openDrawerViaAgent(port: number, timeoutMs = 2500): Promise<boolean> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  try {
    const res = await fetch(url(port, '/drawer'), { method: 'POST', signal: stop.signal });
    return res.ok;
  } catch {
    /* ไม่มีตัวกลางในเครื่องนี้ — ยังมีสลิปที่พิมพ์ผ่านเบราว์เซอร์เป็นทางเดิมให้ลิ้นชักเด้ง */
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** ผลการตรวจบิลแบบไม่ใช้กระดาษ — จำนวนจุด และที่ว่างท้ายบิล */
export type DryRun = {
  ok: boolean;
  height?: number;
  white_tail?: number;
  error?: string;
};

/**
 * ตรวจบิลโดยไม่พิมพ์จริง
 *
 * เจ้าของขอเอง 15 ก.ย. 2026: "อยากเทสโดยที่ไม่ต้องปริ้นกระดาษได้ไหมครับ" — ระหว่างไล่
 * ปัญหาบรรทัดท้ายหาย เราพิมพ์ทิ้งไปหลายใบกว่าจะรู้ว่าแก้ตรงไหน
 * เดินทางเดียวกับการพิมพ์จริงทุกขั้น (ถ่ายรูป → แปลงเป็นคำสั่ง → วัดหมึก → เก็บภาพไว้ดู)
 * ต่างแค่ไม่ส่งเข้าเครื่องพิมพ์ ผลที่ได้จึงเชื่อได้ว่าตรงกับของที่จะออกมาจริง
 */
export async function dryRunViaAgent(
  el: HTMLElement,
  port: number,
  dots?: number,
): Promise<DryRun> {
  try {
    /* ต้องกว้างเท่าตอนพิมพ์จริงเป๊ะ ไม่งั้นตัวเลขที่ได้ตอบแทนกระดาษจริงไม่ได้ */
    const png = await receiptToPng(el, dots ?? configuredDots());
    const res = await fetch(url(port, '/print?dry=1'), {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: png,
    });
    const body = (await res.json()) as DryRun;
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? 'ตัวกลางตอบไม่สำเร็จ' };
    return body;
  } catch (e) {
    /* ★ บอกสาเหตุจริง ★ ต่างจากตอนพิมพ์ซึ่งถอยไปใช้เบราว์เซอร์เงียบ ๆ ได้ — ตรงนี้คนกด
       เพราะอยากรู้ว่ามีอะไรผิด การตอบว่า "ไม่สำเร็จ" เฉย ๆ ไม่ช่วยอะไรเลย */
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * สถานะของเครื่องพิมพ์ทุกตัวในเครื่องขาย
 *
 * เจ้าของถาม 15 ก.ย. 2026: "แล้ว connect Brother หรือยังครับ รู้มั้ยครับว่ามันออนอยู่
 * หรือไม่ออน" — ตอบได้เฉพาะเครื่องที่ Windows รายงานสถานะกลับมา ซึ่งเครื่องพิมพ์บิล
 * ต่อ USB ราคาถูกส่วนใหญ่ไม่รายงาน จึงขึ้นว่าพร้อมแม้ปิดอยู่ · เชื่อได้เต็มที่เฉพาะตอนที่
 * มันบอกว่ามีปัญหา
 */
export async function listPrinters(port: number, timeoutMs = 4000): Promise<PrinterState[]> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  try {
    const res = await fetch(url(port, '/printers'), { signal: stop.signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { printers?: PrinterState[] };
    return body.printers ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
