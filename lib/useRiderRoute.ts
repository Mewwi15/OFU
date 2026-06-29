/**
 * useRiderRoute — animates a rider's position along a delivery route.
 *
 * Walks `DELIVERY_ROUTE` point-to-point on a timer (linear-interpolated between
 * nodes) so the tracking map can show the rider physically moving toward the
 * customer. Returns the live position, 0..1 progress, and a coarse minutes-left
 * estimate. Frontend-first demo stand-in until realtime rider GPS lands.
 *
 * Hermes-safe: drives off a tick counter (no Date.now / timestamps).
 */

import { useEffect, useState } from 'react';

import { DELIVERY_ROUTE, type LatLng } from '@/data/fulfillment';

/** Interpolation steps between each pair of route nodes. */
const SUBSTEPS = 14;
/** Timer cadence. */
const TICK_MS = 650;
/** Demo baseline ETA (minutes) at 0% progress. */
const BASE_MINUTES = 12;
/** Start the rider partway along the route (matches RIDER_POSITION ≈ node 2). */
const START_NODE = 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function useRiderRoute(route: LatLng[] = DELIVERY_ROUTE) {
  const total = (route.length - 1) * SUBSTEPS;
  const [step, setStep] = useState(Math.min(START_NODE * SUBSTEPS, total));

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s >= total ? total : s + 1));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [total]);

  const seg = Math.min(Math.floor(step / SUBSTEPS), route.length - 2);
  const t = (step - seg * SUBSTEPS) / SUBSTEPS;
  const a = route[seg];
  const b = route[seg + 1];

  const position: LatLng = {
    latitude: lerp(a.latitude, b.latitude, t),
    longitude: lerp(a.longitude, b.longitude, t),
  };

  const progress = total === 0 ? 1 : step / total;
  const minutesLeft = Math.max(1, Math.round((1 - progress) * BASE_MINUTES));
  const arrived = step >= total;

  return { position, progress, minutesLeft, arrived };
}
