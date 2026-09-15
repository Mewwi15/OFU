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

/** จำนวนจุดตามความกว้างหัวพิมพ์ — เครื่อง 58 มม. พิมพ์ได้จริง 48 มม. = 384 จุด */
const DOTS_58MM = 384;

export type AgentStatus =
  | { ok: true; printer: string }
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
    const body = (await res.json()) as { ok?: boolean; printer?: string };
    if (!body?.ok || !body.printer) return { ok: false, reason: 'ตัวกลางมีปัญหา' };
    return { ok: true, printer: body.printer };
  } catch {
    /* ปิดอยู่ / Chrome บล็อก / พอร์ตผิด — ปลายทางเดียวกันคือ "ใช้ไม่ได้ตอนนี้" */
    return { ok: false, reason: 'ไม่พบตัวกลาง' };
  } finally {
    clearTimeout(timer);
  }
}

/** แปลงใบเสร็จบนจอเป็นรูปขาวดำกว้างเท่าหัวพิมพ์ */
async function receiptToPng(el: HTMLElement, dots: number): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  /* ★ ขยายตอนถ่าย ไม่ใช่ตอนส่ง ★ ใบเสร็จบนจอกว้างราว 150 จุด ถ้าถ่ายเท่าที่เห็นแล้วไป
     ขยายทีหลัง ตัวหนังสือจะเบลอจนอ่านไม่ออกบนกระดาษ — บอก html2canvas ให้วาดใหม่ที่
     ความละเอียดปลายทางเลย ตัวอักษรจึงคมเท่าที่เครื่องพิมพ์ทำได้ */
  const scale = dots / (el.offsetWidth || 1);
  const canvas = await html2canvas(el, {
    scale,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
  });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('แปลงใบเสร็จเป็นรูปไม่สำเร็จ');
  return blob;
}

/**
 * พิมพ์ใบเสร็จผ่านตัวกลาง — คืน true เมื่อกระดาษถูกส่งเข้าเครื่องพิมพ์แล้ว
 *
 * ไม่โยน error ออกไป: ผู้เรียกต้องถอยไปใช้การพิมพ์ผ่านเบราว์เซอร์ได้เสมอ การพิมพ์บิล
 * ห้ามล้มทั้งกระบวนการเพราะตัวกลางปิดอยู่
 */
export async function printViaAgent(
  el: HTMLElement,
  port: number,
  dots = DOTS_58MM,
): Promise<boolean> {
  try {
    const png = await receiptToPng(el, dots);
    const res = await fetch(url(port, '/print'), {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: png,
    });
    return res.ok;
  } catch {
    return false;
  }
}
