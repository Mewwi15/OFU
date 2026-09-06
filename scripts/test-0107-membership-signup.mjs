#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0107 — สมัครสมาชิกด้วยเบอร์ รับ 100 แต้ม
 *
 * สี่เรื่องที่ต้องพิสูจน์:
 *   1. สมัครแล้วได้ 100 แต้ม และเบอร์ถูกผูกกับบัญชี
 *   2. กดซ้ำไม่ได้แต้มเพิ่ม (ไม่งั้นกดรัว ๆ ได้แต้มไม่จำกัด)
 *   3. เบอร์ที่คนอื่นถืออยู่ สมัครไม่ได้ และต้องบอกเหตุผลที่แปลเป็นภาษาคนได้
 *   4. เบอร์ผิดรูปแบบถูกปฏิเสธ · เบอร์ที่พิมพ์มาแบบ 66… ก็ต้องรับได้
 *
 * รัน (เครื่องตัวเองเท่านั้น):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0107-membership-signup.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('FATAL: ต้องมี SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
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

console.log('\n0107 — สมัครสมาชิกด้วยเบอร์ รับ 100 แต้ม\n');

const stamp = Date.now() % 1000000;
const LOCAL_A = `09${String(stamp).padStart(8, '0')}`.slice(0, 10);
const LOCAL_B = `08${String(stamp).padStart(8, '0')}`.slice(0, 10);
const made = [];

/** สร้างลูกค้าทดสอบ แล้วคืนไคลเอนต์ที่ล็อกอินเป็นคนนั้น (ต้องเป็นตัวตนจริง — RPC อ่าน auth.uid()) */
async function signedInClient(email) {
  const password = 'test-only-password';
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error('FATAL: สร้างบัญชีทดสอบไม่ได้', error.message); process.exit(1); }
  made.push(data.user.id);
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: sErr } = await c.auth.signInWithPassword({ email, password });
  if (sErr) { console.error('FATAL: ล็อกอินบัญชีทดสอบไม่ได้', sErr.message); process.exit(1); }
  return { client: c, id: data.user.id };
}

const a = await signedInClient(`m${stamp}a@oofoo.test`);

/* ── A. สมัครครั้งแรก ────────────────────────────────────────────────────── */
{
  const { data, error } = await a.client.rpc('join_membership', { p_phone: LOCAL_A });
  check('A1', !error, 'สมัครสำเร็จ', error?.message);
  check('A2', data?.points === 100, 'ได้ 100 แต้ม', `ได้ ${data?.points}`);
  check('A3', data?.awarded === true, 'ระบบบอกว่าเพิ่งได้แต้มต้อนรับรอบนี้', JSON.stringify(data));
  const { data: row } = await db.from('app_users').select('phone').eq('id', a.id).single();
  check('A4', row?.phone === `66${LOCAL_A.slice(1)}`, 'เบอร์ถูกผูกกับบัญชีในรูปแบบสากล', row?.phone);
}

/* ── B. กดซ้ำต้องไม่ได้แต้มเพิ่ม ─────────────────────────────────────────── */
{
  const { data, error } = await a.client.rpc('join_membership', { p_phone: LOCAL_A });
  check('B1', !error, 'กดซ้ำไม่ error (เบอร์เดิมของตัวเอง)', error?.message);
  check('B2', data?.points === 100 && data?.awarded === false,
    'แต้มไม่เพิ่ม และบอกว่าไม่ได้แจกรอบนี้', JSON.stringify(data));
}

/* ── C. เบอร์ที่คนอื่นถืออยู่ ─────────────────────────────────────────────── */
{
  const b = await signedInClient(`m${stamp}b@oofoo.test`);
  const { error } = await b.client.rpc('join_membership', { p_phone: LOCAL_A });
  check('C1', !!error && /PHONE_TAKEN/.test(error.message), 'เบอร์ซ้ำถูกปฏิเสธด้วยเหตุผลที่แปลได้',
    error?.message);

  /* เบอร์ของตัวเองพิมพ์มาแบบ 66… ก็ต้องรับได้ — คนคัดลอกเบอร์มาจากที่อื่นบ่อย */
  const { data, error: e2 } = await b.client.rpc('join_membership', { p_phone: `66${LOCAL_B.slice(1)}` });
  check('C2', !e2 && data?.points === 100, 'พิมพ์เบอร์แบบ 66… ก็สมัครได้', e2?.message ?? JSON.stringify(data));
}

/* ── D. เบอร์ผิดรูปแบบ ───────────────────────────────────────────────────── */
{
  const c = await signedInClient(`m${stamp}c@oofoo.test`);
  for (const [id, phone] of [['D1', '021234567'], ['D2', '08123'], ['D3', 'abcdefghij']]) {
    const { error } = await c.client.rpc('join_membership', { p_phone: phone });
    check(id, !!error && /BAD_PHONE/.test(error.message), `ปฏิเสธเบอร์ "${phone}"`, error?.message);
  }
  const { count } = await db
    .from('member_points_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', c.id);
  check('D4', (count ?? 0) === 0, 'สมัครไม่ผ่าน = ไม่มีแต้มเข้าบัญชีเลย', `มี ${count} รายการ`);
}

/* ── ล้างของทดสอบ ────────────────────────────────────────────────────────── */
for (const id of made) {
  await db.from('member_points_ledger').delete().eq('user_id', id);
  await db.auth.admin.deleteUser(id).catch(() => {});
}

console.log(`\n${failures === 0 ? 'ผ่านทั้งหมด' : `ตก ${failures} ข้อ`}\n`);
process.exit(failures === 0 ? 0 : 1);
