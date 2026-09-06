/**
 * ร่างอัตโนมัติ — งานที่ทำค้างไว้แต่ยังไม่ได้กดบันทึก เก็บไว้ในเครื่องกันหายตอนรีเฟรช
 *
 * เจ้าของสั่ง 6 ก.ย. 2026: "ช่วยกันทุกหน้าหน่อยครับที่มีการบันทึกข้อมูล เช่น ขายหน้าร้าน
 * ที่เคยใช้ข้อมูลอยู่ขณะนั้นแล้วมีการเปลี่ยนหน้าหรือรีเฟรช ให้เอาข้อมูลนั้นกลับมา"
 *
 * ★ ทำไมเก็บในเครื่อง ไม่ใช่ในฐานข้อมูล ★ ของที่ยังทำไม่เสร็จไม่ใช่เอกสารของร้าน ยังไม่ควร
 * มีตัวตนในระบบ ถ้าเก็บขึ้นเซิร์ฟเวอร์จะตามมาด้วยคำถามว่าใครเป็นเจ้าของร่าง ร่างของคนอื่น
 * ลบได้ไหม เครื่องสองเครื่องทำพร้อมกันเอาของใคร — ทั้งที่ปัญหาจริงมีข้อเดียวคือ
 * "อย่าให้หายตอนรีเฟรช"
 *
 * ★ แยกร่างตามเครื่อง ไม่ใช่ตามคน ★ แคชเชียร์คนละคนใช้เครื่องเดียวกันต่อกัน บิลที่ค้าง
 * อยู่หน้าเคาน์เตอร์เป็นของ "เครื่องนั้น" ไม่ใช่ของคนที่ล็อกอินค้างไว้
 */

/** ร่างเก่ากว่านี้ไม่ถามซ้ำ — ค้างข้ามวันแล้วคนทำคงลืมไปแล้วว่าเคยทำอะไรไว้ */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Wrapped<T> = { savedAt: number; data: T };

/** เวลาที่ร่างถูกเก็บครั้งล่าสุด — ใช้บอกคนว่า "ค้างไว้เมื่อไหร่" ตอนถามจะเอากลับมาไหม */
export function draftSavedAt(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<unknown>;
    return typeof w?.savedAt === 'number' ? w.savedAt : null;
  } catch {
    return null;
  }
}

export function readDraft<T>(key: string, maxAgeMs = MAX_AGE_MS): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<T>;
    if (!w || typeof w.savedAt !== 'number') return null;
    if (Date.now() - w.savedAt > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return w.data ?? null;
  } catch {
    /* ข้อมูลเสียรูป/อ่านไม่ได้ — ทิ้งไปเงียบ ๆ ดีกว่าทำให้ทั้งหน้าพัง */
    return null;
  }
}

export function writeDraft<T>(key: string, data: T | null) {
  try {
    if (data == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* โหมดส่วนตัว/พื้นที่เต็ม — เก็บร่างไม่ได้ไม่ใช่เหตุให้หยุดขายของ */
  }
}

export const clearDraft = (key: string) => writeDraft(key, null);

/** คีย์ของแต่ละหน้า — รวมไว้ที่เดียวกันหมด จะได้ไม่ตั้งชนกันโดยไม่รู้ตัว */
export const DRAFT_KEYS = {
  /** บิลขายหน้าร้านที่ยังไม่ได้กดรับเงิน */
  posSale: 'ofu-pos-sale-draft',
  /** ใบรับเข้าที่ยังไม่ได้บันทึก */
  receive: 'ofu-receive-draft',
  /** ตัวนับเงินตอนปิดรอบ (นับทีละใบ) */
  shiftCount: 'ofu-shift-count-draft',
} as const;
