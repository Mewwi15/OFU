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

async function reply(replyToken: string, text: string): Promise<void> {
  await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await lineToken()}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
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
      const secret = Deno.env.get('OWNER_BIND_SECRET');
      // No secret configured = binding switched off entirely. Never treat an
      // empty env as "match everything".
      if (secret && text === secret) {
        const { data: shop } = await supabase
          .from('shops')
          .select('id, line_owner_user_id')
          .limit(1)
          .maybeSingle();
        if (!shop) continue;
        if (shop.line_owner_user_id === userId) {
          await reply(ev.replyToken, 'บัญชีนี้ผูกเป็นเจ้าของร้านอยู่แล้ว');
        } else {
          // Correct secret always rebinds — including over an existing holder.
          // Knowing the secret IS the ownership proof, so recovering from a
          // squatted binding is just typing it once.
          await supabase.from('shops').update({ line_owner_user_id: userId }).eq('id', shop.id);
          await reply(ev.replyToken, 'ผูกบัญชีเจ้าของร้านเรียบร้อย\nออเดอร์ใหม่และสลิปที่ลูกค้าแนบจะแจ้งเตือนที่แชทนี้');
        }
      }
      // wrong guesses (including the old public phrase): stay silent
    }
  }

  return new Response('ok');
});
