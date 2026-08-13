/**
 * Live rider location for the order-tracking map.
 *
 * Transport is Realtime **Broadcast**, not a table: the rider emits a fix every
 * few seconds for the length of one delivery, and nobody ever reads that trail
 * back. Persisting it would be ~360 rows per order of pure debt. The only
 * geolocation that is stored is the proof-of-delivery fix on `deliveries`.
 * (Decided in docs/06-data-model.md → Realtime plan.)
 *
 * The channel is private: `realtime.messages` RLS (migration 0070) lets the
 * order's own customer subscribe, and only while the order is actually
 * `out_for_delivery`. When the rider marks it delivered the status changes and
 * the channel closes itself — a customer cannot keep a subscription open and
 * watch the shop owner's phone move around town afterwards.
 */

import { supabase } from '@/lib/supabase/client';

export type RiderFix = {
  lat: number;
  lng: number;
  /** Degrees clockwise from north, when the device reports it. */
  heading?: number | null;
  /** Device clock at the fix (ISO). Display only — never trusted for ordering. */
  at: string;
};

export const riderLocationTopic = (orderId: string) => `delivery:${orderId}:location`;

/**
 * Subscribe to the rider's live position for one order.
 *
 * `onFix` fires per broadcast. Returns an unsubscribe fn. A subscription that
 * RLS rejects (wrong customer, or the order is no longer out for delivery)
 * simply never delivers a fix — the caller keeps showing its "no signal yet"
 * state, which is also what a rider with the app closed looks like. The two are
 * deliberately indistinguishable to the customer.
 */
export function subscribeRiderLocation(
  orderId: string,
  onFix: (fix: RiderFix) => void,
): () => void {
  const channel = supabase
    .channel(riderLocationTopic(orderId), { config: { private: true } })
    .on('broadcast', { event: 'fix' }, (msg) => {
      const p = msg.payload as Partial<RiderFix> | undefined;
      if (typeof p?.lat !== 'number' || typeof p?.lng !== 'number') return;
      onFix({ lat: p.lat, lng: p.lng, heading: p.heading ?? null, at: p.at ?? '' });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
