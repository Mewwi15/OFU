// Offline-first POS support: cache the catalog/shop locally and queue sales
// made while offline. Sync is idempotent server-side (create_pos_sale dedups on
// client_op_id), so flushing the queue can safely retry.

import type { PosProduct, PosSaleInput, Shift, ShopInfo } from './api';

const CATALOG_KEY = 'pos.catalog.v1';
const SHOP_KEY = 'pos.shop.v1';
const SHIFT_KEY = 'pos.shift.v1';
const QUEUE_KEY = 'pos.queue.v1';
const FAILED_KEY = 'pos.queue.failed.v1';

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

/* ── sales that failed to replay ──────────────────────────────────────────────
 * A queued offline sale represents cash already collected and goods already
 * handed to a real customer (the till printed a provisional "ออฟไลน์" receipt
 * before this ever synced). If it fails to replay for a BUSINESS reason (the
 * item sold out elsewhere in the meantime, a discount that's no longer valid,
 * ...) that sale must never just vanish — there is no pos_sales row, no
 * stock_movements row, and no audit trail on the server (the RPC's whole
 * transaction rolled back), so this local record is the only place the
 * shop can still see that a real transaction happened and needs manual
 * reconciliation. */
export type FailedSale = QueuedSale & { failedAt: number; reason: string };

export function readFailedQueue(): FailedSale[] {
  try {
    const raw = localStorage.getItem(FAILED_KEY);
    return raw ? (JSON.parse(raw) as FailedSale[]) : [];
  } catch {
    return [];
  }
}
function writeFailedQueue(q: FailedSale[]) {
  try {
    localStorage.setItem(FAILED_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}
export function failedQueueCount(): number {
  return readFailedQueue().length;
}
/** Acknowledge and permanently clear a failed sale (after manual reconciliation). */
export function dismissFailedSale(clientOpId: string) {
  writeFailedQueue(readFailedQueue().filter((x) => x.input.client_op_id !== clientOpId));
}
/** Retry one failed sale on demand (e.g. after restocking the item it failed on). */
export async function retryFailedSale(
  clientOpId: string,
  send: (input: PosSaleInput) => Promise<unknown>,
): Promise<{ ok: boolean; reason?: string }> {
  const q = readFailedQueue();
  const entry = q.find((x) => x.input.client_op_id === clientOpId);
  if (!entry) return { ok: false, reason: 'ไม่พบรายการ' };
  try {
    await send(entry.input);
    writeFailedQueue(q.filter((x) => x.input.client_op_id !== clientOpId));
    return { ok: true };
  } catch (e) {
    if (isNetworkError(e)) {
      // offline again — move back to the live queue so the normal
      // reconnect-flush picks it up automatically instead of it sitting stuck
      // in the failed list for a reason that no longer applies.
      writeFailedQueue(q.filter((x) => x.input.client_op_id !== clientOpId));
      enqueueSale(entry);
      return { ok: false, reason: 'ออฟไลน์ — ย้ายกลับไปคิวรอซิงค์อัตโนมัติ' };
    }
    const reason = (e as { message?: string })?.message ?? 'ไม่ทราบสาเหตุ';
    writeFailedQueue(
      q.map((x) => (x.input.client_op_id === clientOpId ? { ...x, failedAt: Date.now(), reason } : x)),
    );
    return { ok: false, reason };
  }
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
 * business failures (e.g. a stale OUT_OF_STOCK) move to the FAILED list
 * (readFailedQueue) instead of being dropped — see that section's doc comment
 * for why silently discarding them is unacceptable (real cash/goods already
 * changed hands). Returns how many synced vs moved to the failed list.
 */
export async function flushQueue(
  send: (input: PosSaleInput) => Promise<unknown>,
): Promise<{ synced: number; remaining: number; failed: number }> {
  let q = readQueue();
  let failedQ = readFailedQueue();
  let synced = 0;
  let failed = 0;
  for (const entry of [...q]) {
    try {
      await send(entry.input);
      q = q.filter((x) => x.input.client_op_id !== entry.input.client_op_id);
      writeQueue(q);
      synced++;
    } catch (e) {
      if (isNetworkError(e)) break; // still offline — keep the rest queued
      // business error on replay: move to the failed list, keep going
      q = q.filter((x) => x.input.client_op_id !== entry.input.client_op_id);
      writeQueue(q);
      const reason = (e as { message?: string })?.message ?? 'ไม่ทราบสาเหตุ';
      failedQ = [...failedQ, { ...entry, failedAt: Date.now(), reason }];
      writeFailedQueue(failedQ);
      failed++;
    }
  }
  return { synced, remaining: q.length, failed };
}
