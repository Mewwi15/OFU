// send-line — LINE OA Messaging API sender. Two jobs:
//  1. Drain pending 'line' notification_deliveries (customer order updates) —
//     invoked by the pg_net dispatch trigger (migration 0051), mirrors send-push.
//  2. Owner alerts: a call with { owner_text, shop_id } pushes that text to the
//     shop's linked owner LINE (shops.line_owner_user_id).
//
// Auth to LINE uses short-lived stateless channel access tokens minted from
// LINE_CHANNEL_ID + LINE_CHANNEL_SECRET (no long-lived token to rotate).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (platform), LINE_CHANNEL_ID,
// LINE_CHANNEL_SECRET (supabase secrets).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v3/token';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function lineToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: Deno.env.get('LINE_CHANNEL_ID')!,
      client_secret: Deno.env.get('LINE_CHANNEL_SECRET')!,
    }),
  });
  if (!res.ok) throw new Error(`line token ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function pushText(to: string, text: string): Promise<boolean> {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await lineToken()}`,
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  return res.ok;
}

type Delivery = {
  id: string;
  user_id: string;
  notification: { title: string; body: string | null } | null;
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const payload = (await req.json().catch(() => ({}))) as {
    owner_text?: string;
    shop_id?: string;
  };

  // ── Owner alert mode ────────────────────────────────────────────────────
  if (payload.owner_text) {
    let q = supabase.from('shops').select('line_owner_user_id').limit(1);
    if (payload.shop_id) q = q.eq('id', payload.shop_id);
    const { data: shop } = await q.maybeSingle();
    const to = shop?.line_owner_user_id as string | null;
    if (!to) return json({ owner: 'not-linked' });
    const ok = await pushText(to, payload.owner_text);
    return json({ owner: ok ? 'sent' : 'failed' });
  }

  // ── Drain pending customer LINE deliveries ──────────────────────────────
  const { data: pending, error } = await supabase
    .from('notification_deliveries')
    .select('id, user_id, notification:notifications(title, body)')
    .eq('channel', 'line')
    .eq('status', 'pending')
    .limit(50);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0, failed: 0 });

  const deliveries = pending as unknown as Delivery[];
  const userIds = [...new Set(deliveries.map((d) => d.user_id))];
  const { data: users } = await supabase
    .from('app_users')
    .select('id, line_user_id')
    .in('id', userIds)
    .not('line_user_id', 'is', null);
  const lineByUser = new Map((users ?? []).map((u) => [u.id, u.line_user_id as string]));

  let sent = 0;
  let failed = 0;
  const now = new Date().toISOString();
  for (const d of deliveries) {
    const to = lineByUser.get(d.user_id);
    const text = `${d.notification?.title ?? 'อู้ฟู่'}\n${d.notification?.body ?? ''}`.trim();
    const ok = to ? await pushText(to, text) : false;
    if (ok) sent++;
    else failed++;
    await supabase
      .from('notification_deliveries')
      .update({ status: ok ? 'sent' : 'failed', attempts: 1, last_attempt_at: now })
      .eq('id', d.id);
  }

  return json({ sent, failed });
});
