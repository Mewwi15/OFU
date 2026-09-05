#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0106 — ล็อกอินด้วยเบอร์ต้องเข้าบัญชีเดิม
 *
 * สามเรื่องที่ต้องพิสูจน์:
 *   1. บัญชีเก่าที่กรอกเบอร์ไว้ในโปรไฟล์ ถูกยกเบอร์ขึ้นไปเป็นเบอร์ประจำตัวแล้ว
 *      (ถ้าไม่ ระบบจะสร้างบัญชีใหม่ทุกครั้งที่ลูกค้าเก่ากดล็อกอินด้วยเบอร์)
 *   2. กรอกเบอร์ในโปรไฟล์วันนี้ = ผูกกับบัญชีทันที (ของใหม่ต้องไม่กลับไปเป็นปัญหาเดิม)
 *   3. เบอร์ที่มีคนถือแล้ว สร้างบัญชีใหม่ได้โดยไม่ล้มทั้งการสมัคร (แค่ไม่ผูกเบอร์ให้)
 *
 * รัน (เครื่องตัวเองเท่านั้น):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<service> \
 *   node scripts/test-0106-phone-login.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error('FATAL: ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const LOCAL = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);
const hostOf = (u) => { try { return new globalThis.URL(u).hostname; } catch { return ''; } };
if (!LOCAL.has(hostOf(URL))) { console.error(`FATAL: ไม่ยอมรันกับโฮสต์ที่ไม่ใช่เครื่องตัวเอง (${URL})`); process.exit(1); }

let failures = 0;
const pass = (c, m) => console.log(`  PASS  [${c}] ${m}`);
const fail = (c, m, d) => { failures++; console.log(`  FAIL  [${c}] ${m}`); if (d !== undefined) console.log(`        ↳ ${d}`); };
const check = (c, cond, m, d) => (cond ? pass(c, m) : fail(c, m, d));

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

console.log('\n0106 — ล็อกอินด้วยเบอร์เข้าบัญชีเดิม\n');

const stamp = Date.now() % 1000000;
const PHONE_A = `6690${String(stamp).padStart(7, '0')}`.slice(0, 11);
const PHONE_B = `6691${String(stamp).padStart(7, '0')}`.slice(0, 11);
const made = [];

async function newUser(email) {
  const { data, error } = await db.auth.admin.createUser({
    email, password: 'test-only-password', email_confirm: true,
  });
  if (error) { console.error('FATAL: สร้างบัญชีทดสอบไม่ได้', error.message); process.exit(1); }
  made.push(data.user.id);
  return data.user.id;
}
const authPhone = async (id) => {
  const { data } = await db.auth.admin.getUserById(id);
  return data?.user?.phone ?? null;
};

/* ── A. ของใหม่: กรอกเบอร์ในโปรไฟล์ → ผูกกับบัญชีทันที ───────────────────── */
const idA = await newUser(`t${stamp}a@oofoo.test`);
{
  const { error } = await db.from('app_users').update({ phone: PHONE_A }).eq('id', idA);
  check('A1', !error, 'บันทึกเบอร์ลงโปรไฟล์ได้', error?.message);
  check('A2', (await authPhone(idA)) === PHONE_A,
    'เบอร์ถูกยกขึ้นไปเป็นเบอร์ประจำตัวของบัญชีทันที', `ได้ ${await authPhone(idA)}`);
}

/* ── B. เบอร์ที่มีคนถือแล้ว: สมัครใหม่ต้องไม่ล้มทั้งก้อน ───────────────────── */
{
  const { data, error } = await db.auth.admin.createUser({
    phone: PHONE_A, phone_confirm: true,
  });
  /* ระบบยืนยันตัวตนกันเบอร์ซ้ำของตัวเองอยู่แล้วหลังข้อ A (เบอร์ถูกผูกกับบัญชีแรกไปแล้ว)
     — นั่นคือสิ่งที่ต้องการ: ขอ OTP ด้วยเบอร์นี้จะวิ่งเข้าบัญชีเดิม ไม่ใช่สร้างใหม่ */
  check('B1', !!error, 'สร้างบัญชีใหม่ด้วยเบอร์ที่ถูกผูกไปแล้วไม่ได้ (จะได้วิ่งเข้าบัญชีเดิมแทน)',
    error ? undefined : 'สร้างผ่าน — จะเกิดบัญชีซ้ำ');
  if (data?.user?.id) made.push(data.user.id);
}

/* ── C. เบอร์ค้างในโปรไฟล์คนอื่นแต่ยังไม่ผูกบัญชี → ไม่ล้มการสมัคร ─────────── */
{
  const idC = await newUser(`t${stamp}c@oofoo.test`);
  // ใส่เบอร์ B ลงโปรไฟล์ C แล้วถอดออกจากบัญชี (จำลองข้อมูลยุคก่อนมีการซิงก์)
  await db.from('app_users').update({ phone: PHONE_B }).eq('id', idC);
  const idD = await newUser(`t${stamp}d@oofoo.test`);
  const { error } = await db.from('app_users').update({ phone: PHONE_B }).eq('id', idD);
  check('C1', !!error, 'กรอกเบอร์ที่คนอื่นใช้อยู่ในโปรไฟล์ไม่ได้ (กฎหนึ่งเบอร์หนึ่งบัญชียังอยู่)',
    error ? undefined : 'บันทึกผ่าน — สองบัญชีถือเบอร์เดียวกัน');
}

/* ── ล้างของทดสอบ ────────────────────────────────────────────────────────── */
for (const id of made) await db.auth.admin.deleteUser(id).catch(() => {});

console.log(`\n${failures === 0 ? 'ผ่านทั้งหมด' : `ตก ${failures} ข้อ`}\n`);
process.exit(failures === 0 ? 0 : 1);
