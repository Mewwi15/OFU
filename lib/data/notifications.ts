/**
 * Notifications repository — the customer's in-app feed from
 * notification_recipients ⋈ notifications (RLS → own rows), plus mark-read and a
 * Realtime subscription so new notifications land live.
 */

import type { AppNotification, NotificationKind } from '@/data/fulfillment';
import { supabase } from '@/lib/supabase/client';

type Row = {
  id: string;
  read_at: string | null;
  created_at: string;
  notifications: { title: string; body: string | null; category: string } | null;
};

const SELECT = 'id, read_at, created_at, notifications(title, body, category)';

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.`;
  return `${Math.floor(h / 24)} วัน`;
}

function kindFor(category: string): NotificationKind {
  return category === 'promo' ? 'promo' : 'order';
}

function iconFor(category: string): AppNotification['icon'] {
  switch (category) {
    case 'delivery':
      return 'bicycle';
    case 'payment':
    case 'refund':
      return 'card';
    case 'promo':
      return 'pricetag';
    case 'order':
      return 'receipt';
    default:
      return 'notifications';
  }
}

function toNotification(r: Row): AppNotification {
  const cat = r.notifications?.category ?? 'system';
  return {
    id: r.id,
    kind: kindFor(cat),
    icon: iconFor(cat),
    title: r.notifications?.title ?? '',
    body: r.notifications?.body ?? '',
    time: relTime(r.created_at),
    unread: r.read_at === null,
  };
}

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notification_recipients')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toNotification);
}

export async function markNotificationRead(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

/** Whether the user opted in to marketing/promo push (default on). */
export async function getPushEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('push_enabled')
    .maybeSingle();
  if (error) throw error;
  return data?.push_enabled ?? true;
}

/** Set the marketing/promo push preference (transactional alerts are unaffected). */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('UNAUTHENTICATED');
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: u.user.id, push_enabled: enabled });
  if (error) throw error;
}

/** Register an Expo push token for the signed-in user. */
export async function registerPushToken(token: string, platform?: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: platform ?? undefined,
  });
  if (error) throw error;
}

/** Live feed: fire onChange whenever the customer's recipient rows change. */
export function subscribeNotifications(onChange: () => void): () => void {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notification_recipients' },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
