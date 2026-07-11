/**
 * Shop-chat store (zustand) — real backend conversation with the shop admin.
 *
 * `open()` gets-or-creates the thread, loads history, subscribes to Realtime
 * and zeroes the unread counter; `close()` tears the subscription down. Sends
 * append optimistically from the insert's returned row; the Realtime echo of
 * our own insert is deduped by id. `unread` feeds the account-menu badge and
 * is refreshed on demand (account focus) + live while the app runs.
 */

import { create } from 'zustand';

import {
  ensureThread,
  fetchChatUnread,
  fetchMessages,
  markChatRead,
  sendChatImage,
  sendChatText,
  subscribeChat,
  type ChatMessage,
} from '@/lib/data/chat';

export type { ChatMessage };

type ChatState = {
  threadId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  unread: number;
  /** Enter the chat screen: ensure thread + history + live updates + mark read. */
  open: () => Promise<void>;
  /** Leave the chat screen: stop the live subscription. */
  close: () => void;
  send: (text: string) => Promise<void>;
  sendImage: (base64: string) => Promise<void>;
  refreshUnread: () => Promise<void>;
};

let unsubscribe: (() => void) | null = null;

function appendUnique(list: ChatMessage[], m: ChatMessage): ChatMessage[] {
  return list.some((x) => x.id === m.id) ? list : [...list, m];
}

export const useChat = create<ChatState>((set, get) => ({
  threadId: null,
  messages: [],
  loading: false,
  sending: false,
  unread: 0,

  open: async () => {
    set({ loading: true });
    try {
      const threadId = get().threadId ?? (await ensureThread());
      const messages = await fetchMessages(threadId);
      unsubscribe?.();
      unsubscribe = subscribeChat(threadId, (m) => {
        set((s) => ({ messages: appendUnique(s.messages, m) }));
        // Screen is open — anything arriving is read immediately.
        void markChatRead(threadId);
      });
      set({ threadId, messages, unread: 0 });
      void markChatRead(threadId);
    } finally {
      set({ loading: false });
    }
  },

  close: () => {
    unsubscribe?.();
    unsubscribe = null;
  },

  send: async (text) => {
    const threadId = get().threadId;
    if (!threadId) return;
    set({ sending: true });
    try {
      const m = await sendChatText(threadId, text);
      set((s) => ({ messages: appendUnique(s.messages, m) }));
    } finally {
      set({ sending: false });
    }
  },

  sendImage: async (base64) => {
    const threadId = get().threadId;
    if (!threadId) return;
    set({ sending: true });
    try {
      const m = await sendChatImage(threadId, base64);
      set((s) => ({ messages: appendUnique(s.messages, m) }));
    } finally {
      set({ sending: false });
    }
  },

  refreshUnread: async () => {
    try {
      set({ unread: await fetchChatUnread() });
    } catch {
      // badge is best-effort
    }
  },
}));
