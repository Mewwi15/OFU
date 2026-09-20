/* ═══ ตัวนับเงินสไตล์ ETS "นำเงินเข้า" ═══════════════════════════════════════
 * ตารางชนิดเงิน (แถวที่เลือกไฮไลต์) + แป้นตัวเลขบนจอสำหรับจอสัมผัส
 *   ตัวเลข   = พิมพ์จำนวนใบ/เหรียญของแถวที่เลือก
 *   Enter    = แถวถัดไป · C = ล้างช่องนี้ · Cls = ล้างทั้งตาราง
 * คีย์บอร์ดจริงใช้ได้เหมือนกัน (0-9, Backspace, Enter, ลูกศรขึ้นลง)
 *
 * อยู่ตรงนี้เพราะมีสองหน้าที่ต้องนับเงิน — หน้าเปิด-ปิดรอบ กับด่านเปิดรอบใน
 * หน้าขายหน้าร้าน เจ้าของสั่งว่ายอดเงินต้องมาจากการนับมือเท่านั้น ถ้าปล่อยให้
 * แต่ละหน้ามีตัวนับของตัวเอง เดี๋ยวมันก็แตกกันจนสองหน้านับได้ไม่เท่ากัน
 */

import { Button, Modal, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DRAFT_KEYS, clearDraft, draftSavedAt, readDraft, writeDraft } from '../lib/draft';

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

export type CountLine = { denom: number; count: number };

const DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25] as const;
const denomLabel = (v: number) =>
  v >= 20 ? `ธนบัตร ${v.toLocaleString('th-TH')}` : v >= 1 ? `เหรียญ ${v}` : `เหรียญ ${v * 100} สต.`;

export function CashCountModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /* ส่งรายละเอียดทีละชนิดออกไปด้วย ไม่ใช่แค่ยอดรวม — ใบนับเงินที่ปริ้นต้องแจกแจง
     ได้ว่าแบงก์พันกี่ใบ เหรียญบาทกี่เหรียญ ไม่งั้นตรวจย้อนหลังไม่ได้ว่านับพลาดตรงไหน */
  onDone: (total: number, lines: CountLine[]) => void;
}) {
  /* ── ร่างการนับเงิน ──
     ★ นับเงินทีละใบแล้วหายกลางคันคือต้องรื้อลิ้นชักนับใหม่ทั้งหมด ★ (เจ้าของสั่ง 6 ก.ย. 2026
     ให้กันทุกหน้าที่มีข้อมูลค้าง) — คนนับมักนับไปพลางทำอย่างอื่นไปพลาง สลับหน้าไปดูยอด
     หรือเผลอรีเฟรชแล้วต้องเริ่มนับใหม่ตั้งแต่ใบแรก
     เก็บเฉพาะจำนวนใบที่นับไปแล้ว ไม่เก็บยอดรวม — ยอดรวมคำนวณจากจำนวนใบเสมอ
     ถ้าเก็บทั้งสองอย่างแล้ววันหนึ่งไม่ตรงกัน จะไม่มีทางรู้ว่าอันไหนถูก */
  const [counts, setCounts] = useState<number[]>(
    () => readDraft<number[]>(DRAFT_KEYS.shiftCount) ?? DENOMS.map(() => 0),
  );
  /* ★ รอบแรกหลัง mount ห้ามเขียนร่างทับ ★ counts รอบแรกคือค่าที่เพิ่งอ่านมาจากร่างเอง
     เขียนกลับลงไปเท่ากับปั๊ม savedAt ใหม่ทุกครั้งที่เปิดหน้า — นาฬิกาของร่างจะถูกรีเซ็ต
     เป็นศูนย์เรื่อย ๆ จนอายุ 24 ชม. ไม่มีวันหมด และเวลา "ค้างไว้เมื่อ …" ที่โชว์ให้คนนับดู
     จะกลายเป็นเวลาที่เปิดหน้า ไม่ใช่เวลาที่นับจริง */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    /* ยังไม่ได้นับอะไรเลยก็ไม่ต้องเก็บ — ไม่งั้นเปิดตัวนับแล้วปิดทิ้งจะทิ้งร่างเปล่าไว้ */
    if (counts.some((c) => c > 0)) writeDraft(DRAFT_KEYS.shiftCount, counts);
    else clearDraft(DRAFT_KEYS.shiftCount);
  }, [counts]);
  const [active, setActive] = useState(0);
  /* เวลาที่ร่างถูกเก็บไว้ล่าสุด (null = ไม่ได้นับต่อของเก่า) — ต้องบอกให้เห็นว่ายอดที่ขึ้นมา
     ไม่ใช่ของที่เพิ่งนับ ไม่งั้นคนนับจะนับทับของเดิมโดยไม่ทันสังเกต */
  const [resumedAt, setResumedAt] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      /* ★ เปิดตัวนับต้องได้ร่างที่ค้างไว้คืน ไม่ใช่ล้างทิ้งทุกครั้ง ★
         เดิมบรรทัดนี้สั่ง setCounts(ศูนย์ทั้งแถว) ทำให้ effect [counts] ข้างบนเห็นว่าไม่มีอะไร
         ถูกนับเลย แล้วสั่ง clearDraft ตามมาทันที — ร่างที่อุตส่าห์เก็บไว้จึงถูกลบก่อนได้ใช้
         แม้แต่ครั้งเดียว อาการจริงคือ นับไปครึ่งลิ้นชักแล้วโดนรีโหลด (F5 / แถบเวอร์ชันใหม่ /
         แท็บถูกคืนหน่วยความจำ) กลับมาต้องรื้อนับใหม่ตั้งแต่แบงก์พันใบแรก
         คืนร่างให้เลยแล้วขึ้นแถบบอกว่าเป็นของค้าง พร้อมปุ่มเริ่มใหม่ — ไม่เด้งกล่องถามก่อนนับ
         เพราะคนนับยืนอยู่หน้าลิ้นชักถือเงินอยู่ ด่านถามคือสิ่งที่ขวางงานจริง */
      const draft = readDraft<number[]>(DRAFT_KEYS.shiftCount);
      const usable = draft?.length === DENOMS.length && draft.some((c) => c > 0) ? draft : null;
      setCounts(usable ?? DENOMS.map(() => 0));
      setResumedAt(usable ? draftSavedAt(DRAFT_KEYS.shiftCount) : null);
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
            <Button size="large" type="primary" onClick={() => {
              /* นับเสร็จส่งยอดออกไปแล้ว ร่างหมดหน้าที่ — ถ้าค้างไว้ รอบถัดไปจะเปิดตัวนับ
                 มาเจอตัวเลขของรอบก่อนแล้วนับต่อจากนั้นโดยไม่ทันสังเกต */
              clearDraft(DRAFT_KEYS.shiftCount);
              onDone(Math.round(total), DENOMS.map((d, i) => ({ denom: d, count: counts[i] || 0 })).filter((l) => l.count > 0));
            }}>
              ใช้ยอดนี้
            </Button>
          </div>
        </div>
      }>
      {resumedAt !== null && (
        <div
          className="mb-3 flex items-center justify-between gap-3 px-3 py-2"
          style={{
            background: 'var(--ant-color-warning-bg)',
            border: '1px solid var(--ant-color-warning-border)',
          }}>
          <span style={{ fontSize: 13 }}>
            ยอดข้างล่างเป็นของที่นับค้างไว้เมื่อ{' '}
            {new Date(resumedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. — นับต่อได้เลย
          </span>
          <Button
            size="small"
            onClick={() => {
              setCounts(DENOMS.map(() => 0));
              setActive(0);
              setResumedAt(null);
            }}>
            เริ่มนับใหม่
          </Button>
        </div>
      )}
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
