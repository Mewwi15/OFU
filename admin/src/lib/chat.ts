/**
 * Customer chat — admin side.
 *
 * Threads are one-per-customer (see migration 0044). RLS lets an admin read
 * every thread/message of their shop; sends insert with sender='admin', which
 * the DB trigger turns into a queued push for the customer (pgmq → chat-push).
 * Images live in the private chat-images bucket keyed by the CUSTOMER's uid —
 * admin uploads go into that same folder so the customer can read them back.
 */

import { supabase } from './supabase';

export type ChatThread = {
  id: string;
  user_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  admin_unread: number;
  // avatar_path holds a full public/provider URL (or null) — usable as an <img> src.
  customer: { display_name: string | null; avatar_path: string | null } | null;
};

export type ChatMessage = {
  id: string;
  sender: 'customer' | 'admin';
  body: string | null;
  image_path: string | null;
  imageUrl: string | null;
  created_at: string;
};

const SIGNED_URL_TTL = 60 * 60;

export async function listThreads(): Promise<ChatThread[]> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select(
      'id, user_id, last_message_at, last_message_preview, admin_unread, customer:app_users(display_name, avatar_path)',
    )
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ChatThread[];
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, body, image_path, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as Omit<ChatMessage, 'imageUrl'>[];
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage
      .from('chat-images')
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({ ...r, imageUrl: r.image_path ? signed.get(r.image_path) ?? null : null }));
}

export async function signImage(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('chat-images').createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export async function sendText(threadId: string, body: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('UNAUTHENTICATED');
  const { error } = await supabase
    .from('chat_messages')
    .insert({ thread_id: threadId, sender: 'admin', sender_id: u.user.id, body });
  if (error) throw error;
}

/** Upload into the CUSTOMER's folder (storage RLS keys off the first segment). */
export async function sendImage(threadId: string, customerUserId: string, file: File): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('UNAUTHENTICATED');
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${customerUserId}/admin-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('chat-images')
    .upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (upErr) throw upErr;
  const { error } = await supabase
    .from('chat_messages')
    .insert({ thread_id: threadId, sender: 'admin', sender_id: u.user.id, image_path: path });
  if (error) throw error;
}

export async function markRead(threadId: string): Promise<void> {
  await supabase.rpc('chat_mark_read', { p_thread: threadId });
}

// Channel topics must be unique per subscriber — supabase-js reuses a channel
// with the same topic, and adding callbacks after subscribe() throws (the
// sidebar badge and the chat page both listen).
let chanSeq = 0;

/** Live chat activity across the shop: new messages + thread-row updates. */
export function subscribeChatActivity(onChange: () => void): () => void {
  const channel = supabase
    .channel(`admin-chat-${++chanSeq}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_threads' },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function totalUnread(): Promise<number> {
  const { data } = await supabase.from('chat_threads').select('admin_unread');
  return ((data ?? []) as { admin_unread: number }[]).reduce((s, t) => s + t.admin_unread, 0);
}
