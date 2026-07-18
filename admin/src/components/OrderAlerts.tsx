/**
 * Live order alerts — mounted once inside the authed Layout so every admin page
 * (incl. the POS till) hears about online activity. Subscribes to Realtime
 * postgres_changes on `orders` (RLS scopes the stream to what the admin can
 * read) and, on a new order or a freshly uploaded slip, plays a chime and pops
 * an antd notification with a jump-to-page action. It also broadcasts a window
 * event so an already-open Orders page refreshes its list without a manual
 * "รีเฟรช". Both alerts jump to /orders — slip review lives there.
 */

import { App } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import {
  buildAnnouncement,
  createAnnounceQueue,
  createSpeaker,
  VOICE_STORAGE_KEY,
} from '../lib/voiceAnnounce';

/** Pages listen for this to reload their order lists. */
export const ORDERS_CHANGED_EVT = 'ofu-orders-changed';

/* Two-tone chime via WebAudio — no asset file, survives offline. Browsers gate
 * audio behind a user gesture; any click on the till unlocks it. */
let audioCtx: AudioContext | null = null;
function chime() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const notes: [number, number][] = [
      [880, 0],
      [1174.66, 0.18],
    ];
    for (const [freq, at] of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.55);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.6);
    }
  } catch {
    /* no audio available — the visual notification still shows */
  }
}

type OrderRow = {
  // The INSERT payload carries the row's id (needed to count its order_items —
  // the items are not in the payload). Realtime always sends it.
  id?: string;
  order_number?: string;
  payment_status?: string;
  payment_method?: string;
  shop_mode?: string;
  total?: number;
};

/* Voice announce (new orders only) — a single FIFO queue so a burst of orders
 * chimes and speaks one at a time without overlapping. speechSynthesis is
 * browser-only; a missing engine (or no Thai voice) degrades silently. The
 * header toggle (default OFF) is read fresh at speak time via localStorage, so
 * flipping it never needs a re-subscribe. See ../lib/voiceAnnounce. */
const speak = createSpeaker(typeof window !== 'undefined' ? window.speechSynthesis : undefined);
const announce = createAnnounceQueue({
  chime,
  speak,
  delay: (ms) => new Promise((r) => setTimeout(r, ms)),
  isEnabled: () => {
    try {
      return localStorage.getItem(VOICE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  },
  log: (m) => console.info(m),
});

export function OrderAlerts() {
  const { notification } = App.useApp();
  const nav = useNavigate();

  useEffect(() => {
    const channel = supabase
      .channel('admin-order-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const o = payload.new as OrderRow;
          // Notification + list refresh fire immediately (visual, unordered).
          notification.info({
            key: `order-${o.order_number}`,
            message: 'ออเดอร์ออนไลน์ใหม่',
            description: `${o.order_number ?? ''} · ยอด ฿${(o.total ?? 0).toLocaleString('th-TH')} · ${o.shop_mode === 'online' ? 'ส่งพัสดุ' : 'ส่งในพื้นที่'}`,
            placement: 'topRight',
            duration: 8,
            showProgress: true,
            onClick: () => nav('/orders'),
          });
          window.dispatchEvent(new Event(ORDERS_CHANGED_EVT));
          // The chime lives inside the queue now so it stays FIFO-ordered with
          // the speech; the count query runs lazily, only if this order is
          // actually going to be spoken. On any query failure we speak the base
          // line without the "N รายการ" tail rather than nothing.
          void announce(async () => {
            const num = o.order_number ?? '';
            if (!o.id) return buildAnnouncement(num, null);
            try {
              const { count, error } = await supabase
                .from('order_items')
                .select('id', { count: 'exact', head: true })
                .eq('order_id', o.id);
              return buildAnnouncement(num, error ? null : count);
            } catch {
              return buildAnnouncement(num, null);
            }
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const now = payload.new as OrderRow;
          const before = payload.old as OrderRow;
          // Alert only on the moment a slip lands (needs REPLICA IDENTITY FULL,
          // which 0009_realtime.sql sets, for `old` to carry the previous value).
          if (
            now.payment_status === 'slip_uploaded' &&
            before.payment_status !== 'slip_uploaded'
          ) {
            chime();
            notification.warning({
              key: `slip-${now.order_number}`,
              message: 'มีสลิปรอตรวจสอบ',
              description: `${now.order_number ?? ''} · ยอด ฿${(now.total ?? 0).toLocaleString('th-TH')} — ลูกค้ารอการยืนยัน`,
              placement: 'topRight',
              duration: 0, // sticky until dismissed — money is waiting
              onClick: () => nav('/orders'),
            });
          }
          window.dispatchEvent(new Event(ORDERS_CHANGED_EVT));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // notification/nav are stable from antd App + react-router
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
