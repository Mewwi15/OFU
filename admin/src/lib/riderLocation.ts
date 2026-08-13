/**
 * Rider location broadcaster — the POS running on the owner's phone IS the
 * rider app for now (one shop, one person delivering).
 *
 * Emits the device's GPS fix on the private Realtime channel
 * `delivery:{orderId}:location` while an order is out for delivery. Nothing is
 * written to the database: the trail is worthless once the parcel lands, and
 * `realtime.messages` RLS (0070) already limits who may publish and who may
 * listen (that order's customer, only while it is `out_for_delivery`).
 *
 * Browser reality this has to live with:
 *  - A backgrounded tab stops firing geolocation, so the phone screen has to
 *    stay on for the whole trip. We request a Screen Wake Lock so the operator
 *    doesn't have to fight the display timeout by hand, and re-acquire it when
 *    the tab comes back — Chrome drops the lock on every visibility change.
 *  - Permission is per-origin and remembered, so the prompt appears once.
 */

import { supabase } from './supabase';

export type BroadcastStatus =
  | 'idle'
  | 'starting'
  | 'live'
  | 'denied'
  | 'unsupported'
  | 'error';

export type RiderBroadcast = {
  stop: () => void;
};

/** Minimum gap between broadcasts. GPS fires far more often than this indoors. */
const MIN_INTERVAL_MS = 5000;

type Handlers = {
  onStatus: (s: BroadcastStatus, detail?: string) => void;
  /** Fires on every accepted fix — lets the UI show it is genuinely moving. */
  onFix?: (fix: { lat: number; lng: number; accuracy: number | null }) => void;
};

/**
 * Start broadcasting this device's position for `orderId`.
 *
 * Returns a handle whose `stop()` releases the GPS watch, the wake lock and the
 * channel. Always call it — a leaked watch keeps the GPS radio (and the screen)
 * alive for the rest of the session.
 */
export function startRiderBroadcast(orderId: string, h: Handlers): RiderBroadcast {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    h.onStatus('unsupported', 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
    return { stop: () => {} };
  }

  h.onStatus('starting');

  const channel = supabase.channel(`delivery:${orderId}:location`, {
    config: { private: true },
  });
  channel.subscribe();

  let lastSentAt = 0;
  let stopped = false;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (stopped) return;
      const now = Date.now();
      if (now - lastSentAt < MIN_INTERVAL_MS) return;
      lastSentAt = now;

      const { latitude, longitude, heading, accuracy } = pos.coords;
      h.onFix?.({ lat: latitude, lng: longitude, accuracy: accuracy ?? null });
      void channel.send({
        type: 'broadcast',
        event: 'fix',
        payload: {
          lat: latitude,
          lng: longitude,
          heading: Number.isFinite(heading) ? heading : null,
          at: new Date(pos.timestamp).toISOString(),
        },
      });
      h.onStatus('live');
    },
    (err) => {
      if (stopped) return;
      // 1 = PERMISSION_DENIED · 2 = POSITION_UNAVAILABLE · 3 = TIMEOUT
      if (err.code === 1) {
        h.onStatus('denied', 'ยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง — เปิดในตั้งค่าเบราว์เซอร์');
      } else {
        // Transient: a tunnel or a cold GPS. watchPosition keeps trying, so this
        // is a status line, not a reason to tear the broadcast down.
        h.onStatus('error', 'สัญญาณตำแหน่งขาดหาย กำลังลองใหม่');
      }
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
  );

  // ── keep the screen on ─────────────────────────────────────────────────────
  type WakeLockSentinelLike = { release: () => Promise<void> };
  let wakeLock: WakeLockSentinelLike | null = null;
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;

  const acquireWakeLock = () => {
    if (stopped || !wl) return;
    wl.request('screen')
      .then((s) => {
        wakeLock = s;
      })
      // Not fatal — the operator can keep the screen on by hand.
      .catch(() => {});
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') acquireWakeLock();
  };
  acquireWakeLock();
  document.addEventListener('visibilitychange', onVisibility);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', onVisibility);
      void wakeLock?.release().catch(() => {});
      void supabase.removeChannel(channel);
      h.onStatus('idle');
    },
  };
}

/** Google Maps navigation link for a pinned delivery address. */
export const navUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
