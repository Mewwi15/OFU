// sms-reconcile — ตามไปอ่านผลการส่ง SMS ที่ผู้ให้บริการอัปเดตทีหลัง
//
// ★ ทำไมต้องมีตัวนี้ ★ ตอนยิง OTP ผู้ให้บริการตอบ 200 พร้อม block: 0, send: 1 เสมอ
// แม้เบอร์นั้นจะถูกบล็อกก็ตาม — วัดจริงเมื่อ 14 ก.ย. 2026: ส่ง 21:13 สถานะยังว่าง
// พอ 21:19 ถึงเปลี่ยนเป็น blocklist (ห่างกัน 6 นาที) ผลจริงจึงไม่มีทางรู้ได้ตอนส่ง
// ระบบเดิมที่สรุปผลตั้งแต่ตอนยิงเลยบันทึกว่า "สำเร็จ" ทุกครั้ง และหน้าหลังร้านว่างเปล่า
// ทั้งที่ลูกค้าเข้าไม่ได้จริง ๆ
//
// ★ ทำไมใช้วิธีตามไปอ่าน ไม่ใช่ให้เขายิงกลับ (webhook) ★ ผู้ให้บริการมีหน้าตั้ง Webhook
// แต่ยังไม่รู้รูปร่างข้อมูลที่เขาจะส่งมา และต้องให้เจ้าของไปกรอก URL ในระบบเขาเองอีก
// ส่วนรายการผลรายเบอร์เป็น API ที่พิสูจน์แล้วว่าอ่านได้ทันที ไม่ต้องตั้งค่าอะไรเพิ่ม
// — ถ้าวันหนึ่งอยากได้เร็วกว่านี้ค่อยเพิ่ม webhook ทับได้ โดยตารางไม่ต้องแก้
//
// เรียกจากหน้าตั้งค่าหลังร้านตอนเปิดหน้า (ไม่ต้องตั้ง cron) — เพราะเป็นที่เดียวที่มีคนดู
// ข้อมูลนี้ การตามผลตอนไม่มีใครดูไม่ได้ทำให้ใครรู้เรื่องเร็วขึ้น
//
// Env: SMS_STATUS_URL (ถ้าไม่ตั้ง จะเดาจาก SMS_API_URL) · SMS_AUTH/SMS_API_KEY (เหมือนฮุค)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SMS_API_URL = Deno.env.get('SMS_API_URL') ?? '';
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') ?? '';
const SMS_AUTH = Deno.env.get('SMS_AUTH') ?? (SMS_API_KEY ? `bearer:${SMS_API_KEY}` : 'none');
/* ผู้ให้บริการเดียวกันมักวางรายการผลไว้ข้าง ๆ ปลายทางที่ใช้ส่ง — เดาให้ก่อน ตั้งทับได้ */
const STATUS_URL =
  Deno.env.get('SMS_STATUS_URL') ?? SMS_API_URL.replace(/\/messages\b/, '/message-response');

/** ดูอีกรอบว่ารอผลอยู่กี่นาทีถึงจะเลิกรอ — ผู้ให้บริการใช้เวลาราว 6 นาที เผื่อไว้เท่าตัว */
const GIVE_UP_MINUTES = 30;

function authHeaders(): Record<string, string> {
  const [kind, ...rest] = SMS_AUTH.split(':');
  const value = rest.join(':');
  switch (kind) {
    case 'bearer':
      return { Authorization: `Bearer ${value}` };
    case 'basic':
      return { Authorization: `Basic ${btoa(value)}` };
    case 'header': {
      const [name, ...v] = value.split(':');
      return name ? { [name]: v.join(':') } : {};
    }
    default:
      return {};
  }
}

/**
 * แปลสถานะของผู้ให้บริการเป็นคำตอบว่า "ถึงมือลูกค้าหรือไม่"
 *
 * ค่าที่เจอจริง: success · blocklist · fail · expired · processing
 * ★ processing ยังไม่ใช่คำตอบ ★ ต้องปล่อยให้รอต่อ ไม่ใช่ตัดสินว่าล้มเหลว ไม่งั้นทุกเบอร์
 * ที่เพิ่งกดส่งไปเมื่อกี้จะโผล่ในรายการ "รับ SMS ไม่ได้" ทันทีทุกครั้ง
 */
function verdict(status: string): { ok: boolean; reason: string } | null {
  const s = status.toLowerCase();
  if (s === 'success' || s === 'sent' || s === 'delivered') return { ok: true, reason: 'delivered' };
  if (s === 'blocklist' || s === 'block') return { ok: false, reason: 'blocked' };
  if (s === 'fail' || s === 'error') return { ok: false, reason: 'carrier_rejected' };
  if (s === 'expired') return { ok: false, reason: 'expired' };
  return null; // processing / ไม่รู้จัก = ยังไม่ตัดสิน
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'missing service credentials' }, 500);
  if (!STATUS_URL) return json({ error: 'SMS_STATUS_URL not set' }, 500);

  const db = createClient(url, key, { auth: { persistSession: false } });

  /* ★ ดูที่ "ยังไม่เคยเทียบผล" ไม่ใช่ "ยังไม่รู้ผล" ★ แถวที่บันทึกด้วยโค้ดชุดเก่าถูกจดว่า
     สำเร็จไปแล้วทั้งที่ไม่เคยมีใครตรวจ (เพราะตอนนั้นเชื่อคำตอบตอนยิง) — ถ้าเลือกเฉพาะ
     ok is null แถวพวกนั้นจะค้างเป็น "สำเร็จ" ตลอดไป ทั้งที่หลายอันถูกบล็อกจริง */
  const { data: pending, error } = await db
    .from('sms_otp_attempts')
    .select('id, phone, provider_ref, provider_id, created_at')
    .is('settled_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ checked: 0, settled: 0 });

  /* ขอรายการผลล่าสุดมาก้อนเดียวแล้วจับคู่เอง — ถูกกว่าการยิงถามทีละเบอร์ และรายการนี้
     เรียงใหม่ก่อนอยู่แล้ว ผลของทุกอันที่ยังค้างจึงอยู่ในก้อนแรก ๆ เสมอ */
  let rows: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(`${STATUS_URL}?page=1&limit=200&sort=create_at&order=-1`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return json({ error: `provider ${res.status}` }, 502);
    rows = ((await res.json()) as { data?: Array<Record<string, unknown>> }).data ?? [];
  } catch (e) {
    return json({ error: String(e) }, 502);
  }

  const byRef = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    for (const k of ['ref_no', 'message_id', '_id']) {
      const v = r[k];
      if (typeof v === 'string' && v) byRef.set(v, r);
    }
  }

  let settled = 0;
  for (const p of pending) {
    const hit =
      (p.provider_ref && byRef.get(p.provider_ref)) ||
      (p.provider_id && byRef.get(p.provider_id)) ||
      /* ★ ของเก่าที่ยังไม่มีเลขอ้างอิง ★ แถวที่บันทึกไว้ก่อนเพิ่มคอลัมน์จับคู่ด้วยเบอร์
         + เวลาใกล้กัน ดีกว่าปล่อยค้างเป็น "ไม่รู้ผล" ตลอดไป */
      rows.find(
        (r) =>
          r.phone === p.phone &&
          Math.abs(
            new Date(String(r.create_at)).getTime() - new Date(String(p.created_at)).getTime(),
          ) <
            5 * 60_000,
      );

    const v = hit ? verdict(String(hit.status ?? '')) : null;

    /* ★ จะสรุปว่า "ไม่มีผล" ได้ ต่อเมื่อรายการที่ขอมาย้อนไปถึงเวลานั้นจริง ★ เราขอมาแค่
       200 แถวล่าสุด ถ้าร้านส่งเยอะจนแถวเก่าหลุดหน้าต่างไป การไม่เจอไม่ได้แปลว่าไม่มี
       — สรุปทั้งที่ดูไม่ถึงจะกลายเป็นกล่าวหาว่าเบอร์ลูกค้ารับไม่ได้ทั้งที่เขาได้รับปกติ */
    const oldestSeen = rows.reduce(
      (min, r) => Math.min(min, new Date(String(r.create_at)).getTime()),
      Infinity,
    );
    const inWindow = new Date(String(p.created_at)).getTime() >= oldestSeen;
    const tooOld =
      inWindow && Date.now() - new Date(String(p.created_at)).getTime() > GIVE_UP_MINUTES * 60_000;

    if (v) {
      await db
        .from('sms_otp_attempts')
        .update({
          ok: v.ok,
          reason: v.reason,
          settled_at: new Date().toISOString(),
          detail: JSON.stringify(hit).slice(0, 500),
        })
        .eq('id', p.id);
      settled++;
    } else if (tooOld) {
      /* หาผลไม่เจอเลยจนเลยเวลา — ถือว่าไม่สำเร็จ ให้ขึ้นในรายการไว้ก่อน เจ้าของจะได้
         โทรกลับไปหาลูกค้า ดีกว่าเงียบหายแล้วไม่มีใครรู้ว่ามีคนเข้าไม่ได้ */
      await db
        .from('sms_otp_attempts')
        .update({ ok: false, reason: 'no_result', settled_at: new Date().toISOString() })
        .eq('id', p.id);
      settled++;
    }
  }

  return json({ checked: pending.length, settled });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
