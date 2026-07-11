/**
 * Chat repository — the customer's conversation with the shop.
 *
 * One thread per customer (ensure_chat_thread RPC gets-or-creates it). Messages
 * land live over Realtime; the thread row carries the customer's unread count,
 * zeroed via chat_mark_read whenever the screen is open. Images live in the
 * private chat-images bucket, so display URLs are short-lived signed URLs.
 *
 * Admin replies arrive as a push via the pgmq → chat-push → notifications
 * pipeline (migration 0044) — nothing to do on this side.
 */

import { supabase } from '@/lib/supabase/client';
import { uploadChatImage } from '@/lib/data/storage';

export type ChatMessage = {
  id: string;
  /** true = the signed-in customer; false = the shop. */
  mine: boolean;
  text: string | null;
  /** Signed display URL (private bucket) — refetch when it expires. */
  imageUrl: string | null;
  createdAt: string;
  /** HH:MM bubble label. */
  time: string;
};

type MessageRow = {
  id: string;
  sender: 'customer' | 'admin';
  body: string | null;
  image_path: string | null;
  created_at: string;
};

const SIGNED_URL_TTL = 60 * 60; // 1h — longer than any realistic screen visit

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await supabase.storage.from('chat-images').createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

async function toChatMessage(row: MessageRow, signed: Map<string, string>): Promise<ChatMessage> {
  let imageUrl: string | null = null;
  if (row.image_path) {
    imageUrl =
      signed.get(row.image_path) ??
      (await supabase.storage.from('chat-images').createSignedUrl(row.image_path, SIGNED_URL_TTL))
        .data?.signedUrl ??
      null;
  }
  return {
    id: row.id,
    mine: row.sender === 'customer',
    text: row.body,
    imageUrl,
    createdAt: row.created_at,
    time: timeLabel(row.created_at),
  };
}

/** Get-or-create the caller's thread with the shop. */
export async function ensureThread(): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_chat_thread');
  if (error) throw error;
  return data as string;
}

/** Latest messages, oldest → newest, image URLs pre-signed. */
export async function fetchMessages(threadId: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, body, image_path, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = ((data ?? []) as MessageRow[]).reverse();
  const signed = await signPaths(rows.map((r) => r.image_path).filter((p): p is string => !!p));
  return Promise.all(rows.map((r) => toChatMessage(r, signed)));
}

export async function sendChatText(threadId: string, body: string): Promise<ChatMessage> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('UNAUTHENTICATED');
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ thread_id: threadId, sender: 'customer', sender_id: u.user.id, body })
    .select('id, sender, body, image_path, created_at')
    .single();
  if (error) throw error;
  return toChatMessage(data as MessageRow, new Map());
}

/** Upload the picked photo, then record it as a message. */
export async function sendChatImage(threadId: string, base64: string): Promise<ChatMessage> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('UNAUTHENTICATED');
  const path = await uploadChatImage(base64);
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ thread_id: threadId, sender: 'customer', sender_id: u.user.id, image_path: path })
    .select('id, sender, body, image_path, created_at')
    .single();
  if (error) throw error;
  return toChatMessage(data as MessageRow, await signPaths([path]));
}

// Channel topics must be unique per subscriber — a screen remount can land
// before the old channel tears down, and supabase-js reuses same-topic
// channels (adding callbacks after subscribe() throws).
let chanSeq = 0;

/** Live inserts on this thread (both sides — dedupe by id when appending). */
export function subscribeChat(
  threadId: string,
  onMessage: (m: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(`chat:${threadId}:${++chanSeq}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
      (payload) => {
        void toChatMessage(payload.new as MessageRow, new Map()).then(onMessage);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Zero the customer's unread counter. */
export async function markChatRead(threadId: string): Promise<void> {
  await supabase.rpc('chat_mark_read', { p_thread: threadId });
}

/** Unread count for the badge (0 when no thread exists yet). */
export async function fetchChatUnread(): Promise<number> {
  const { data } = await supabase
    .from('chat_threads')
    .select('customer_unread')
    .maybeSingle();
  return data?.customer_unread ?? 0;
}
