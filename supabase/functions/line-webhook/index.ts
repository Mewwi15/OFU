// line-webhook — receives LINE platform events for the OA (deployed with
// --no-verify-jwt; authenticity comes from the x-line-signature HMAC check).
//
//  • follow                    : welcome message.
//  • message = OWNER_BIND_SECRET: binds the sender as the shop owner
//    (shops.line_owner_user_id) — the account every order/slip/stock alert
//    is delivered to.
//
// This used to be the guessable phrase "เจ้าของร้าน", first-come-wins, no
// takeover — so whoever typed a perfectly ordinary Thai word first owned the
// notification stream (customer names, phones, addresses) and could never be
// evicted. Now:
//   - the trigger is a random secret from env; env unset = binding disabled
//   - a correct secret ALWAYS rebinds, even over an existing holder — knowing
//    the secret is the proof of ownership, so recovery from a squatter is
//    just typing it once; no SQL surgery needed
//   - anything else gets silence, exactly like before
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LINE_CHANNEL_ID,
// LINE_CHANNEL_SECRET, OWNER_BIND_SECRET.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  OWNER_QUICK_REPLY,
  ordersFlex,
  stockFlex,
  type OrdersSummary,
  type StockSummary,
} from './flex.ts';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v3/token';
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

async function lineToken(): Promise<string> {
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: Deno.env.get('LINE_CHANNEL_ID')!,
      client_secret: Deno.env.get('LINE_CHANNEL_SECRET')!,
    }),
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** `msg` = plain text, or a ready-made message object (Flex). `quickReply`
 *  rides on the last message so the owner always has the two buttons to hand. */
async function reply(
  replyToken: string,
  msg: string | Record<string, unknown>,
  quickReply?: Record<string, unknown>,
): Promise<void> {
  const message = typeof msg === 'string' ? { type: 'text', text: msg } : { ...msg };
  if (quickReply) (message as Record<string, unknown>).quickReply = quickReply;
  const res = await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await lineToken()}`,
    },
    body: JSON.stringify({ replyToken, messages: [message] }),
  });
  // A malformed Flex payload is rejected with a 400 that explains exactly which
  // property is wrong — worth surfacing, otherwise the bot just goes quiet.
  if (!res.ok) console.error('LINE reply failed', res.status, await res.text());
}

async function validSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('LINE_CHANNEL_SECRET')!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
};

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('x-line-signature')))) {
    return new Response('bad signature', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { events = [] } = JSON.parse(raw) as { events?: LineEvent[] };
  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId) continue;

    if (ev.type === 'follow' && ev.replyToken) {
      await reply(
        ev.replyToken,
        'ยินดีต้อนรับสู่ร้านอู้ฟู่\nเชื่อมบัญชีในหน้า "บัญชี" บนเว็บ ofu-shop.vercel.app เพื่อรับแจ้งเตือนสถานะคำสั่งซื้อที่นี่',
      );
      continue;
    }

    if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
      const text = (ev.message.text ?? '').trim();

      // ── แดชบอร์ดร้านสำหรับเจ้าของ ────────────────────────────────────────
      // เฉพาะบัญชีที่ผูกไว้เท่านั้น: การ์ดพวกนี้มีจำนวนคงเหลือทั้งร้านและยอด
      // ขายรายวัน คนอื่นทักมาต้องเงียบเหมือนเดิม ไม่ใช่ตอบว่า "คุณไม่มีสิทธิ์"
      // ซึ่งเท่ากับยืนยันว่ามีอะไรให้เข้าถึง
      const word = text.toLowerCase();
      const wantStock = ['สต๊อก', 'สตอก', 'สต็อก', 'stock'].includes(word);
      const wantOrders = ['ออเดอร์', 'ออร์เดอร์', 'order', 'orders'].includes(word);

      if (wantStock || wantOrders) {
        const { data: shop } = await supabase
          .from('shops')
          .select('id, line_owner_user_id')
          .limit(1)
          .maybeSingle();
        /* ★ เปิดให้เครื่องพนักงานที่ผูกไว้ใช้คำสั่งได้ด้วย ★ (0109) — เขาเป็นแอดมินที่เข้า
           หลังร้านได้อยู่แล้ว การให้ถามสต๊อก/ออเดอร์ผ่านแชทจึงไม่ได้เปิดอะไรใหม่ แต่ทำให้
           คนที่อยู่หน้าร้านตอบลูกค้าได้ทันทีโดยไม่ต้องเปิดคอม
           คนนอกยังเงียบเหมือนเดิม ไม่ตอบว่า "ไม่มีสิทธิ์" ซึ่งเท่ากับยืนยันว่ามีอะไรให้เข้าถึง */
        if (!shop) continue;
        let allowed = shop.line_owner_user_id === userId;
        if (!allowed) {
          const { data: r } = await supabase
            .from('shop_line_recipients')
            .select('id')
            .eq('shop_id', shop.id)
            .eq('line_user_id', userId)
            .maybeSingle();
          allowed = !!r;
        }
        if (!allowed) continue;

        const adminUrl = Deno.env.get('ADMIN_URL') ?? undefined;
        try {
          if (wantStock) {
            const { data, error } = await supabase.rpc('stock_buy_list', { p_limit: 8 });
            if (error) throw error;
            await reply(ev.replyToken, stockFlex(data as StockSummary, adminUrl), OWNER_QUICK_REPLY);
          } else {
            const { data, error } = await supabase.rpc('orders_summary', { p_limit: 8 });
            if (error) throw error;
            await reply(ev.replyToken, ordersFlex(data as OrdersSummary, adminUrl), OWNER_QUICK_REPLY);
          }
        } catch (e) {
          console.error('dashboard reply failed', e);
          await reply(ev.replyToken, 'ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งครับ', OWNER_QUICK_REPLY);
        }
        continue;
      }

      const secret = Deno.env.get('OWNER_BIND_SECRET');
      // No secret configured = binding switched off entirely. Never treat an
      // empty env as "match everything".
      /* ── ผูกเครื่องเข้ากับร้าน ──
         ★ รหัสเดียวกัน แต่ผลต่างกันตามสถานะ ★ (เจ้าของสั่ง 6 ก.ย. 2026 "อยากให้อีก 2
         เครื่องที่เป็นแอดมินได้ไลน์ OA ของเราด้วย")
           · ยังไม่มีเจ้าของ → คนแรกที่พิมพ์เป็นเจ้าของ
           · มีเจ้าของแล้ว คนอื่นพิมพ์ → เพิ่มเป็นเครื่องรับแจ้งเตือน (ไม่แย่งความเป็นเจ้าของ)
           · พิมพ์ "<รหัส> เจ้าของ" → ยึดความเป็นเจ้าของ (ทางกู้คืนถ้าผูกผิดคน ซึ่งเป็น
             เหตุผลที่โค้ดเดิมให้รหัสถูกต้องทับได้เสมอ — เก็บทางนั้นไว้แต่ต้องตั้งใจพิมพ์)
         คนที่ผูกแล้วพิมพ์ซ้ำก็แค่บอกว่าผูกอยู่แล้ว ไม่สร้างซ้ำ (unique กันอีกชั้น) */
      const wantOwner = !!secret && text === `${secret} เจ้าของ`;
      if (secret && (text === secret || wantOwner)) {
        const { data: shop } = await supabase
          .from('shops')
          .select('id, line_owner_user_id')
          .limit(1)
          .maybeSingle();
        if (!shop) continue;

        const isOwner = shop.line_owner_user_id === userId;
        const takeOwner = wantOwner || !shop.line_owner_user_id;

        if (isOwner && !wantOwner) {
          await reply(ev.replyToken, 'บัญชีนี้ผูกเป็นเจ้าของร้านอยู่แล้ว', OWNER_QUICK_REPLY);
        } else if (takeOwner) {
          await supabase.from('shops').update({ line_owner_user_id: userId }).eq('id', shop.id);
          await reply(
            ev.replyToken,
            'ผูกบัญชีเจ้าของร้านเรียบร้อย\nออเดอร์ใหม่และสลิปที่ลูกค้าแนบจะแจ้งเตือนที่แชทนี้\n\nพิมพ์ "สต๊อก" หรือ "ออเดอร์" เพื่อดูสถานะร้านได้ตลอดเวลา',
            OWNER_QUICK_REPLY,
          );
        } else {
          const { error } = await supabase
            .from('shop_line_recipients')
            .upsert(
              { shop_id: shop.id, line_user_id: userId },
              { onConflict: 'shop_id,line_user_id' },
            );
          await reply(
            ev.replyToken,
            error
              ? 'ผูกไม่สำเร็จ ลองใหม่อีกครั้งครับ'
              : 'ผูกเครื่องนี้กับร้านเรียบร้อย\nออเดอร์ใหม่และสลิปที่ลูกค้าแนบจะแจ้งเตือนที่แชทนี้ด้วย\n\nพิมพ์ "สต๊อก" หรือ "ออเดอร์" เพื่อดูสถานะร้านได้ตลอดเวลา\nไม่อยากรับแจ้งเตือนแล้วพิมพ์ "เลิกแจ้งเตือน"',
            OWNER_QUICK_REPLY,
          );
        }
        continue;
      }

      /* เลิกรับแจ้งเตือน — คนที่เปลี่ยนงานหรือเปลี่ยนเครื่องต้องถอนตัวเองได้ ไม่ต้องรอ
         เจ้าของไปลบให้ (เจ้าของถอนตัวเองไม่ได้ทางนี้ ต้องผูกเครื่องใหม่แทน) */
      if (['เลิกแจ้งเตือน', 'ยกเลิกแจ้งเตือน'].includes(text)) {
        const { data: shop } = await supabase.from('shops').select('id').limit(1).maybeSingle();
        if (!shop) continue;
        const { data: gone } = await supabase
          .from('shop_line_recipients')
          .delete()
          .eq('shop_id', shop.id)
          .eq('line_user_id', userId)
          .select('id');
        if (gone?.length) await reply(ev.replyToken, 'หยุดแจ้งเตือนที่เครื่องนี้แล้ว');
        continue; // ไม่ได้ผูกไว้ → เงียบ
      }
      // wrong guesses (including the old public phrase): stay silent
    }
  }

  return new Response('ok');
});
