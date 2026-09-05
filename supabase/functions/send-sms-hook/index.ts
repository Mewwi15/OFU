// send-sms-hook — Supabase "Send SMS Hook". GoTrue calls this to deliver phone
// OTPs; we forward them to a Thai SMS aggregator's HTTP API.
//
// Wiring (config.toml): [auth.hook.send_sms] enabled=true, uri points here,
// secret = env(SEND_SMS_HOOK_SECRET). The hook overrides the built-in provider,
// so disable [auth.sms.twilio] in production. [auth.sms.test_otp] still short-
// circuits the local test number before this hook is ever called.
//
// ★ ตั้งค่าผู้ให้บริการจาก env ล้วน ไม่ต้องแก้โค้ด ★ ผู้ให้บริการ SMS ไทยแต่ละเจ้าใช้ชื่อ
// พารามิเตอร์และวิธียืนยันตัวตนไม่เหมือนกัน (บางเจ้า JSON + Bearer, บางเจ้าเป็นฟอร์ม +
// Basic auth, บางเจ้าเอาเบอร์แบบ 08…) — เดิมต้องมาแก้ไฟล์นี้ทุกครั้งที่เปลี่ยนเจ้า ซึ่ง
// แปลว่าเจ้าของร้านเปิดใช้เองไม่ได้ ต้องรอคนแก้โค้ด deploy ให้
// ตอนนี้รูปร่างคำขอมาจาก env ทั้งหมด เจ้าของอ่านคู่มือของผู้ให้บริการแล้วกรอกได้เอง
//
// Env:
//   SEND_SMS_HOOK_SECRET  - the hook signing secret ("v1,whsec_…", from Supabase)
//   SMS_API_URL           - the aggregator's send endpoint
//   SMS_SENDER            - the sender name (ชื่อกลางของผู้ให้บริการ หรือชื่อที่จดเอง)
//   SMS_AUTH              - วิธียืนยันตัวตน (ดู buildAuthHeaders ข้างล่าง):
//                             bearer:<token>
//                             basic:<user>:<pass>
//                             header:<Header-Name>:<value>
//                             none
//   SMS_BODY              - แม่แบบเนื้อคำขอ ใส่ตัวแปรได้: {phone} {phone_local}
//                           {message} {sender} {otp}
//                           เช่น JSON: {"sender":"{sender}","msisdn":"{phone}","message":"{message}"}
//                           เช่น ฟอร์ม: sender={sender}&msisdn={phone}&message={message}
//   SMS_CONTENT_TYPE      - json (ค่าตั้งต้น) หรือ form
//   SMS_API_KEY           - ยังรองรับของเดิม: ถ้าไม่ตั้ง SMS_AUTH จะใช้ค่านี้เป็น Bearer

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
const SMS_API_URL = Deno.env.get('SMS_API_URL') ?? '';
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') ?? '';
const SMS_SENDER = Deno.env.get('SMS_SENDER') ?? 'OOFOO';
const SMS_AUTH = Deno.env.get('SMS_AUTH') ?? (SMS_API_KEY ? `bearer:${SMS_API_KEY}` : 'none');
const SMS_CONTENT_TYPE = (Deno.env.get('SMS_CONTENT_TYPE') ?? 'json').toLowerCase();
/* ค่าตั้งต้นคือรูปแบบเดิมของไฟล์นี้ — โครงการที่ตั้งค่าไว้แล้วอัปเดตฟังก์ชันแล้วต้องยังส่งได้ */
const SMS_BODY =
  Deno.env.get('SMS_BODY') ?? '{"sender":"{sender}","msisdn":"{phone}","message":"{message}"}';

function fail(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { message, http_code: status } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** ส่วนหัวยืนยันตัวตนตามที่ตั้งไว้ใน SMS_AUTH */
function buildAuthHeaders(): Record<string, string> {
  const [kind, ...rest] = SMS_AUTH.split(':');
  const value = rest.join(':');
  switch (kind) {
    case 'bearer':
      return { Authorization: `Bearer ${value}` };
    case 'basic':
      // basic:<user>:<pass> — ผู้ให้บริการที่ใช้ api key + secret คู่กันมักเป็นแบบนี้
      return { Authorization: `Basic ${btoa(value)}` };
    case 'header': {
      // header:<ชื่อหัวข้อ>:<ค่า> — เจ้าที่ใช้หัวข้อของตัวเอง เช่น api-key: xxxx
      const [name, ...v] = value.split(':');
      return name ? { [name]: v.join(':') } : {};
    }
    default:
      return {};
  }
}

/**
 * ★ แทนค่าตัวแปรแบบรู้ว่ากำลังเขียนอะไรอยู่ ★ ใน JSON ต้อง escape อัญประกาศ/บรรทัดใหม่
 * ส่วนในฟอร์มต้อง encode แบบ URL — ข้อความ OTP ภาษาไทยที่ไม่ได้ encode จะทำให้คำขอเสีย
 * รูปทั้งก้อน และผู้ให้บริการจะตอบกลับมาเป็น error ที่อ่านไม่รู้เรื่องว่าเกิดจากอะไร
 */
function fillTemplate(tpl: string, vars: Record<string, string>, form: boolean): string {
  return tpl.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    if (v === undefined) return whole;
    if (form) return encodeURIComponent(v);
    // JSON: ตัดอัญประกาศออกเพราะแม่แบบใส่ให้แล้ว ใช้ slice ตัดหัวท้าย
    return JSON.stringify(v).slice(1, -1);
  });
}

Deno.serve(async (req) => {
  const raw = await req.text();

  // 1) Verify the request really came from GoTrue (signed with the hook secret).
  let phone: string;
  let otp: string;
  try {
    const wh = new Webhook(HOOK_SECRET);
    const { user, sms } = wh.verify(raw, Object.fromEntries(req.headers)) as {
      user: { phone: string };
      sms: { otp: string };
    };
    phone = user.phone; // E.164 without '+', e.g. "66812345678"
    otp = sms.otp;
  } catch (_e) {
    return fail('invalid hook signature', 401);
  }

  if (!SMS_API_URL) return fail('SMS_API_URL not set', 500);

  /* ★ ต้องไม่เกิน 70 ตัวอักษร ★ SMS ภาษาไทยนับเป็น Unicode: เกิน 70 เมื่อไหร่ผู้ให้บริการ
     คิดเป็นสองข้อความทันที = ค่าส่งเบิ้ลทุกครั้งที่มีคนล็อกอิน ข้อความนี้ 57 ตัว เหลือที่ว่าง
     เผื่อผู้ให้บริการเติมคำนำหน้าของตัวเองอีกนิดหน่อย */
  const message = `รหัส OTP อู้ฟู่ คือ ${otp} (ใช้ได้ 5 นาที) ห้ามบอกผู้อื่น`;
  /* บางเจ้ารับเบอร์แบบในประเทศ (08…) ไม่ใช่ 66… — ให้เลือกใช้ {phone_local} ในแม่แบบ
     แทนการมาแก้โค้ด */
  const phoneLocal = phone.startsWith('66') ? `0${phone.slice(2)}` : phone;

  const form = SMS_CONTENT_TYPE === 'form';
  const body = fillTemplate(
    SMS_BODY,
    { phone, phone_local: phoneLocal, message, sender: SMS_SENDER, otp },
    form,
  );

  // 2) ส่งต่อให้ผู้ให้บริการ — รูปร่างคำขอมาจาก env ทั้งหมด
  try {
    const res = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
        ...buildAuthHeaders(),
      },
      body,
    });
    /* ★ เก็บคำตอบของผู้ให้บริการไว้ในบันทึกเสมอ ★ ตอนตั้งค่าครั้งแรกมันคือสิ่งเดียวที่บอก
       ได้ว่าพารามิเตอร์ผิดตรงไหน — ฝั่งลูกค้าเห็นแค่ "ส่ง SMS ไม่สำเร็จ" ซึ่งไล่ต่อไม่ได้ */
    const text = (await res.text()).slice(0, 500);
    if (!res.ok) return fail(`sms provider error ${res.status}: ${text}`);
    console.log('sms sent', { to: phone, status: res.status, reply: text });
  } catch (e) {
    return fail(`sms request failed: ${String(e)}`);
  }

  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
});
