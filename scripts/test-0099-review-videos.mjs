#!/usr/bin/env node
/**
 * พิสูจน์ไมเกรชัน 0099 — แถบรีวิวสินค้า (วิดีโอ)
 *
 * สองเรื่องที่ต้องพิสูจน์:
 *   1. ลูกค้าเห็นเฉพาะคลิปที่เผยแพร่แล้ว — คลิปร่างต้องไม่หลุดออกแอป
 *   2. ลูกค้าเขียนอะไรไม่ได้เลย ทั้งทางตารางตรงและทาง RPC ของแอดมิน
 *      (ร้านเปิดขายอยู่จริง ถ้าใครก็ยัดคลิปขึ้นหน้าแรกได้คือหน้าร้านโดนยึด)
 *
 * รัน (เครื่องตัวเองเท่านั้น):
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> node scripts/test-0099-review-videos.mjs
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
const cust = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

/* ── เตรียมข้อมูล: คลิปหนึ่งเผยแพร่ หนึ่งร่าง ─────────────────────────────── */
const { data: shop, error: shopErr } = await db.from('shops').select('id').limit(1).single();
if (shopErr) { console.error('FATAL: อ่านร้านไม่ได้', shopErr.message); process.exit(1); }

const stamp = Date.now();
const rows = [
  { shop_id: shop.id, video_path: `pub-${stamp}.mp4`, caption: 'เผยแพร่', publish_state: 'published', display_order: 1 },
  { shop_id: shop.id, video_path: `draft-${stamp}.mp4`, caption: 'ร่าง', publish_state: 'draft', display_order: 2 },
];
const { data: seeded, error: seedErr } = await db.from('review_videos').insert(rows).select('id, video_path');
if (seedErr) { console.error('FATAL: ใส่ข้อมูลทดสอบไม่ได้', seedErr.message); process.exit(1); }
const published = seeded.find((r) => r.video_path.startsWith('pub-'));
const draft = seeded.find((r) => r.video_path.startsWith('draft-'));

console.log('\n0099 — แถบรีวิวสินค้า (วิดีโอ)\n');

/* ── A. ลูกค้าอ่านได้เฉพาะที่เผยแพร่ ──────────────────────────────────────── */
{
  const { data, error } = await cust.from('review_videos').select('id, video_path, publish_state');
  if (error) {
    fail('A1', 'ลูกค้าอ่านตารางรีวิวได้', error.message);
  } else {
    const ids = (data ?? []).map((r) => r.id);
    check('A1', ids.includes(published.id), 'คลิปที่เผยแพร่แล้ว ลูกค้าเห็น');
    check('A2', !ids.includes(draft.id), 'คลิปร่าง ลูกค้าไม่เห็น',
      ids.includes(draft.id) ? 'คลิปร่างหลุดออกแอป' : undefined);
    check('A3', (data ?? []).every((r) => r.publish_state === 'published'),
      'ทุกแถวที่ลูกค้าเห็นเป็นสถานะเผยแพร่ทั้งหมด');
  }
}

/* ── B. ลูกค้าเขียนตารางตรงไม่ได้ ────────────────────────────────────────── */
{
  const { error } = await cust
    .from('review_videos')
    .insert({ shop_id: shop.id, video_path: `hack-${stamp}.mp4`, publish_state: 'published' });
  check('B1', !!error, 'ลูกค้ายัดคลิปเข้าตารางตรง ๆ ไม่ได้',
    error ? undefined : 'insert ผ่าน — หน้าแรกโดนยึดได้');
}
{
  const { data, error } = await cust
    .from('review_videos')
    .update({ caption: 'โดนแก้' })
    .eq('id', published.id)
    .select('id');
  // RLS ที่ไม่มีนโยบาย update จะไม่ error แต่ต้องไม่มีแถวไหนถูกแตะ
  check('B2', !!error || (data ?? []).length === 0, 'ลูกค้าแก้คลิปที่เผยแพร่แล้วไม่ได้',
    error ? undefined : `แก้ได้ ${(data ?? []).length} แถว`);
  const { data: after } = await db.from('review_videos').select('caption').eq('id', published.id).single();
  check('B3', after?.caption === 'เผยแพร่', 'ข้อความใต้คลิปยังเป็นของเดิมจริง ๆ', `ได้ ${after?.caption}`);
}
{
  const { data, error } = await cust.from('review_videos').delete().eq('id', published.id).select('id');
  check('B4', !!error || (data ?? []).length === 0, 'ลูกค้าลบคลิปไม่ได้',
    error ? undefined : `ลบได้ ${(data ?? []).length} แถว`);
}

/* ── C. RPC ของแอดมิน ไม่ยอมให้คนที่ไม่ใช่แอดมินเรียก ──────────────────────── */
{
  const { error } = await cust.rpc('upsert_review_video', {
    p_video_path: `rpc-hack-${stamp}.mp4`,
    p_publish_state: 'published',
  });
  check('C1', !!error, 'ลูกค้าเรียก upsert_review_video ไม่ผ่าน',
    error ? undefined : 'RPC ยอมให้คนนอกเขียน');
}
{
  const { error } = await cust.rpc('delete_review_video', { p_id: published.id });
  check('C2', !!error, 'ลูกค้าเรียก delete_review_video ไม่ผ่าน',
    error ? undefined : 'RPC ยอมให้คนนอกลบ');
  const { data: still } = await db.from('review_videos').select('id').eq('id', published.id).maybeSingle();
  check('C3', !!still, 'คลิปยังอยู่ครบหลังลูกค้าพยายามลบ');
}

/* ── D. บักเก็ตวิดีโอตั้งค่าถูก ───────────────────────────────────────────── */
{
  const { data, error } = await db.storage.getBucket('review-videos');
  if (error) {
    fail('D1', 'มีบักเก็ต review-videos', error.message);
  } else {
    check('D1', data.public === true, 'บักเก็ตเปิดอ่านสาธารณะ (แอปโหลดคลิปได้)');
    check('D2', data.file_size_limit === 52428800, 'เพดานไฟล์ 50 MB ผูกไว้ที่ฐานข้อมูล',
      `ได้ ${data.file_size_limit}`);
    check('D3', (data.allowed_mime_types ?? []).includes('video/mp4'),
      'รับเฉพาะชนิดไฟล์วิดีโอที่กำหนด', JSON.stringify(data.allowed_mime_types));
    check('D4', !(data.allowed_mime_types ?? []).includes('image/png'),
      'ไม่รับไฟล์นอกรายการ (กันเอาบักเก็ตไปใช้ผิดประเภท)');
  }
}

/* ── E. ลบสินค้าแล้วคลิปไม่หายตาม แค่ไม่มีปลายทางให้กด ────────────────────── */
{
  const { data: prod } = await db.from('products').select('id').limit(1).maybeSingle();
  if (!prod) {
    console.log('  SKIP  [E1] ไม่มีสินค้าในฐานข้อมูลทดสอบ');
  } else {
    const { data: linked, error: linkErr } = await db
      .from('review_videos')
      .insert({ shop_id: shop.id, video_path: `linked-${stamp}.mp4`, product_id: prod.id, publish_state: 'published' })
      .select('id')
      .single();
    if (linkErr) {
      fail('E1', 'ผูกคลิปกับสินค้าได้', linkErr.message);
    } else {
      pass('E1', 'ผูกคลิปกับสินค้าได้');
      const { error: delErr } = await db.from('products').delete().eq('id', prod.id);
      if (delErr) {
        console.log('  SKIP  [E2] ลบสินค้าไม่ได้ (มีข้อมูลอื่นอ้างอยู่) — ข้ามการทดสอบ set null');
      } else {
        const { data: after } = await db
          .from('review_videos')
          .select('id, product_id')
          .eq('id', linked.id)
          .maybeSingle();
        check('E2', !!after, 'ลบสินค้าแล้วคลิปยังอยู่ ไม่หายตามไปด้วย');
        check('E3', after?.product_id === null, 'ปลายทางที่กดถูกล้างเป็นว่าง ไม่ค้างเป็น id ผี',
          `ได้ ${after?.product_id}`);
      }
    }
  }
}

/* ── F. ต้องมีไฟล์วิดีโอเสมอ ─────────────────────────────────────────────── */
{
  const { error } = await db.from('review_videos').insert({ shop_id: shop.id, video_path: null });
  check('F1', !!error, 'คลิปที่ไม่มีไฟล์วิดีโอ บันทึกไม่ได้',
    error ? undefined : 'บันทึกแถวที่ไม่มีไฟล์ได้');
}

/* ── ล้างของทดสอบ ────────────────────────────────────────────────────────── */
await db.from('review_videos').delete().like('video_path', `%-${stamp}.mp4`);

console.log(`\n${failures === 0 ? 'ผ่านทั้งหมด' : `ตก ${failures} ข้อ`}\n`);
process.exit(failures === 0 ? 0 : 1);
