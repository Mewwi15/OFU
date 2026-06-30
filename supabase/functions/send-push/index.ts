// send-push — drains pending push notification_deliveries and sends them via the
// Expo Push API, marking each delivery sent/failed. Invoked by the pg_net
// dispatch trigger (migration 0012) on new pending deliveries, or on a schedule.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected by the platform).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

type Delivery = {
  id: string;
  user_id: string;
  notification: { title: string; body: string | null; target_id: string | null } | null;
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pending, error } = await supabase
    .from('notification_deliveries')
    .select('id, user_id, notification:notifications(title, body, target_id)')
    .eq('channel', 'push')
    .eq('status', 'pending')
    .limit(100);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0, failed: 0 });

  const deliveries = pending as unknown as Delivery[];
  const userIds = [...new Set(deliveries.map((d) => d.user_id))];

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds)
    .is('revoked_at', null);

  const byUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);
  }

  // Build one Expo message per (delivery, token); remember which delivery each
  // message belongs to so we can mark the delivery sent if any token is accepted.
  const messages: Record<string, unknown>[] = [];
  const owner: string[] = [];
  for (const d of deliveries) {
    for (const to of byUser.get(d.user_id) ?? []) {
      owner.push(d.id);
      messages.push({
        to,
        title: d.notification?.title ?? 'อู้ฟู่',
        body: d.notification?.body ?? '',
        data: { targetId: d.notification?.target_id ?? null },
        sound: 'default',
      });
    }
  }

  const acceptedByDelivery = new Map<string, boolean>();
  if (messages.length) {
    const res = await fetch(EXPO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { status?: string }[] };
    (body.data ?? []).forEach((ticket, i) => {
      const id = owner[i];
      acceptedByDelivery.set(id, (acceptedByDelivery.get(id) ?? false) || ticket?.status === 'ok');
    });
  }

  let sent = 0;
  let failed = 0;
  const now = new Date().toISOString();
  for (const d of deliveries) {
    const ok = acceptedByDelivery.get(d.id) ?? false;
    if (ok) sent++;
    else failed++;
    await supabase
      .from('notification_deliveries')
      .update({ status: ok ? 'sent' : 'failed', attempts: 1, last_attempt_at: now })
      .eq('id', d.id);
  }

  return json({ sent, failed });
});
