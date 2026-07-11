// chat-push — drains the pgmq 'chat_push' queue (admin chat replies) into the
// notifications pipeline: one notification + recipient + pending push delivery
// per thread per minute (dedupe_key collapses bursts, so a rapid-fire admin
// doesn't spam the customer's phone). The existing dispatch trigger on
// notification_deliveries then invokes send-push, which talks to Expo.
//
// Invoked by the pg_net ping in the on_chat_message trigger (migration 0044),
// best-effort; the queue row is the durable record — anything unprocessed is
// picked up on the next invocation (visibility timeout re-surfaces failures).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected by the platform).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

type QueueRow = {
  msg_id: number;
  message: { message_id: string; thread_id: string; preview: string };
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

  const { data: rows, error } = await supabase.rpc('chat_queue_read', {
    p_batch: 50,
    p_vt: 60,
  });
  if (error) return json({ error: error.message }, 500);
  const queued = (rows ?? []) as QueueRow[];
  if (!queued.length) return json({ notified: 0, collapsed: 0 });

  // Newest preview per thread; every queue row of a thread rides one notification.
  const byThread = new Map<string, QueueRow[]>();
  for (const q of queued) {
    byThread.set(q.message.thread_id, [...(byThread.get(q.message.thread_id) ?? []), q]);
  }

  let notified = 0;
  let collapsed = 0;
  const minute = new Date().toISOString().slice(0, 16); // e.g. 2026-07-11T17:30

  for (const [threadId, items] of byThread) {
    const { data: thread, error: threadErr } = await supabase
      .from('chat_threads')
      .select('user_id, shop_id')
      .eq('id', threadId)
      .maybeSingle();
    if (threadErr) continue; // transient — leave the rows; vt re-surfaces them
    if (!thread) {
      // Thread genuinely gone (account deleted) — drop the queue rows.
      for (const q of items) await supabase.rpc('chat_queue_delete', { p_msg_id: q.msg_id });
      continue;
    }

    const preview = items[items.length - 1].message.preview;
    const { data: notif } = await supabase
      .from('notifications')
      .upsert(
        {
          shop_id: thread.shop_id,
          audience: 'customer',
          classification: 'transactional',
          category: 'chat',
          title: 'ข้อความใหม่จากร้านอู้ฟู่',
          body: preview,
          target_type: 'chat',
          target_id: threadId,
          dedupe_key: `chat:${threadId}:${minute}`,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();

    if (notif?.id) {
      await supabase
        .from('notification_recipients')
        .upsert(
          { notification_id: notif.id, user_id: thread.user_id },
          { onConflict: 'notification_id,user_id', ignoreDuplicates: true },
        );
      await supabase.from('notification_deliveries').insert({
        notification_id: notif.id,
        user_id: thread.user_id,
        channel: 'push',
        status: 'pending',
      });
      notified++;
    } else {
      collapsed++; // already pushed this thread within the minute window
    }

    for (const q of items) await supabase.rpc('chat_queue_delete', { p_msg_id: q.msg_id });
  }

  return json({ notified, collapsed });
});
