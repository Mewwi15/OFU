/**
 * Notifications store (zustand) — the customer's in-app feed, backed by the
 * notifications repository. Loaded on app mount; refreshed live via Realtime.
 */

import { create } from 'zustand';

import type { AppNotification } from '@/data/fulfillment';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '@/lib/data/notifications';

export type NotificationState = {
  items: AppNotification[];
  loading: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

let unsubscribe: (() => void) | null = null;

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      set({ items: await listNotifications(), loading: false });
    } catch {
      set({ loading: false });
    }
    // wire the live feed once
    if (!unsubscribe) {
      unsubscribe = subscribeNotifications(() => void get().load());
    }
  },

  markRead: async (id) => {
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, unread: false } : n)) }));
    try {
      await markNotificationRead(id);
    } catch {
      /* keep optimistic state; next load reconciles */
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, unread: false })) }));
    try {
      await markAllNotificationsRead();
    } catch {
      /* keep optimistic state; next load reconciles */
    }
  },
}));

/** Unread badge count selector. */
export const unreadCount = (s: NotificationState): number =>
  s.items.reduce((n, x) => n + (x.unread ? 1 : 0), 0);
