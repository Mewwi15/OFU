// Offline-first POS support: cache the catalog/shop locally and queue sales
// made while offline. Sync is idempotent server-side (create_pos_sale dedups on
// client_op_id), so flushing the queue can safely retry.

import type { PosProduct, PosSaleInput, Shift, ShopInfo } from './api';

const CATALOG_KEY = 'pos.catalog.v1';
const SHOP_KEY = 'pos.shop.v1';
const SHIFT_KEY = 'pos.shift.v1';
const QUEUE_KEY = 'pos.queue.v1';

/* ── catalog / shop cache ──────────────────────────────────────────────────── */
export function cacheCatalog(data: PosProduct[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode — ignore */
  }
}
export function readCachedCatalog(): PosProduct[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as PosProduct[]) : null;
  } catch {
    return null;
  }
}
export function cacheShop(data: ShopInfo) {
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
export function readCachedShop(): ShopInfo | null {
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    return raw ? (JSON.parse(raw) as ShopInfo) : null;
  } catch {
    return null;
  }
}
export function cacheShift(s: Shift | null) {
  try {
    if (s) localStorage.setItem(SHIFT_KEY, JSON.stringify(s));
    else localStorage.removeItem(SHIFT_KEY);
  } catch {
    /* ignore */
  }
}
export function readCachedShift(): Shift | null {
  try {
    const raw = localStorage.getItem(SHIFT_KEY);
    return raw ? (JSON.parse(raw) as Shift) : null;
  } catch {
    return null;
  }
}

/* ── queued sales ──────────────────────────────────────────────────────────── */
export type QueuedSale = {
  input: PosSaleInput; // carries client_op_id for idempotent replay
  total: number;
  at: number; // epoch ms captured at sale time (passed in — Date is fine in the browser)
};

export function readQueue(): QueuedSale[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSale[]) : [];
  } catch {
    return [];
  }
}
function writeQueue(q: QueuedSale[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}
export function enqueueSale(entry: QueuedSale) {
  const q = readQueue();
  q.push(entry);
  writeQueue(q);
}
export function queueCount(): number {
  return readQueue().length;
}

/** True for connectivity failures (offline / fetch failed), not business errors. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (e as { message?: string })?.message ?? '';
  return /fetch|network|Failed to fetch|load failed|timeout/i.test(msg);
}

/**
 * Flush queued sales through `send` (create_pos_sale). Idempotent replay makes
 * this safe on retry. Stops at the first network failure (stays queued);
 * business failures (e.g. a stale OUT_OF_STOCK) are dropped so they don't wedge
 * the queue forever. Returns how many synced.
 */
export async function flushQueue(
  send: (input: PosSaleInput) => Promise<unknown>,
): Promise<{ synced: number; remaining: number }> {
  let q = readQueue();
  let synced = 0;
  for (const entry of [...q]) {
    try {
      await send(entry.input);
      q = q.filter((x) => x.input.client_op_id !== entry.input.client_op_id);
      writeQueue(q);
      synced++;
    } catch (e) {
      if (isNetworkError(e)) break; // still offline — keep the rest queued
      // business error on replay: drop this one, keep going
      q = q.filter((x) => x.input.client_op_id !== entry.input.client_op_id);
      writeQueue(q);
    }
  }
  return { synced, remaining: q.length };
}
