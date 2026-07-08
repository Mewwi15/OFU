import { apiError } from './api';
import { supabase } from './supabase';

export { apiError };

/* ── Enums (mirrors of the Postgres enum types) ──────────────────────────────── */
export type ShopMode = 'delivery' | 'online';
export type PaymentMethod = 'promptpay_slip' | 'cod';
export type OrderStatus =
  | 'placed'
  | 'awaiting_payment'
  | 'slip_uploaded'
  | 'payment_verifying'
  | 'confirmed'
  | 'preparing'
  | 'assigned_to_rider'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | 'payment_rejected'
  | 'delivery_failed';
export type PaymentStatus =
  | 'awaiting_payment'
  | 'slip_uploaded'
  | 'verifying'
  | 'paid'
  | 'rejected';
export type SlipRejectReason = 'amount_mismatch' | 'unclear' | 'not_found' | 'duplicate' | 'other';
export type CancelReason =
  | 'customer_request'
  | 'out_of_stock'
  | 'payment_timeout'
  | 'undeliverable'
  | 'shop_cancel'
  | 'other';

/* ── Row types (only the columns we select) ──────────────────────────────────── */
export type Order = {
  id: string;
  order_number: string;
  shop_mode: ShopMode;
  payment_method: PaymentMethod;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  ship_recipient: string | null;
  ship_phone: string | null;
  ship_address_text: string | null;
  placed_at: string;
  row_version: number;
};

export type OrderItem = {
  id: string;
  name_snapshot: string;
  size_snapshot: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
  /** Product thumbnail (public URL; primary image, else first, else null). */
  image: string | null;
};

const ORDER_COLS =
  'id, order_number, shop_mode, payment_method, order_status, payment_status, total, subtotal, delivery_fee, discount_amount, ship_recipient, ship_phone, ship_address_text, placed_at, row_version';

/* ── Reads (RLS: admin can read own shop) ────────────────────────────────────── */
export async function listOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLS)
    .order('placed_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as Order[];
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select(
      'id, name_snapshot, size_snapshot, unit_price, qty, line_total, ' +
        'products(product_images(storage_path, is_primary))',
    )
    .eq('order_id', orderId)
    .order('name_snapshot');
  if (error) throw error;
  type Row = OrderItem & {
    products: { product_images: { storage_path: string; is_primary: boolean }[] } | null;
  };
  return ((data ?? []) as unknown as Row[]).map(({ products, ...it }) => {
    const imgs = products?.product_images ?? [];
    const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
    // storage_path already holds the full public URL (see api.ts uploadProductImage).
    return { ...it, image: primary?.storage_path ?? null };
  });
}

/** Resolve a signed URL for the active payment slip image (bucket is private). */
export async function getSlipUrl(orderId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('payment_slips')
    .select('storage_path')
    .eq('order_id', orderId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  const path = (data as { storage_path: string } | null)?.storage_path;
  if (!path) return null;
  const { data: signed, error: signErr } = await supabase.storage
    .from('payment-slips')
    .createSignedUrl(path, 60 * 10);
  // Surface signing failures — swallowing them rendered a blank "no slip" box
  // with no way to see why (the shop needs the reason, e.g. an RLS/storage error).
  if (signErr) throw signErr;
  return signed?.signedUrl ?? null;
}

/* ── Mutations (thin wrappers over RPCs; exact param names per \df) ───────────── */
const rpc = async <T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/** The slip flow is two-phase in the backend: claim_slip locks the order
 *  (slip_uploaded → verifying, records which admin took it), then approve/
 *  reject finalises. One button must do both — approve_slip alone throws
 *  NOT_IN_VERIFYING. Ignore a failed claim (already claimed → just proceed),
 *  and skip the row-version check afterwards since the claim itself may bump
 *  it (the claim lock already serialises concurrent admins). */
const claimSlip = async (orderId: string) => {
  try {
    await rpc('claim_slip', { p_order_id: orderId });
  } catch {
    /* already verifying — proceed */
  }
};

export const approveSlip = async (orderId: string, _rowVersion?: number) => {
  await claimSlip(orderId);
  return rpc('approve_slip', { p_order_id: orderId });
};

export const rejectSlip = async (orderId: string, reason: SlipRejectReason, note?: string, _rowVersion?: number) => {
  await claimSlip(orderId);
  return rpc('reject_slip', {
    p_order_id: orderId,
    p_reason: reason,
    p_note: note ?? undefined,
  });
};

export const advanceOrder = (orderId: string, toStatus: OrderStatus, rowVersion?: number) =>
  rpc('advance_order', {
    p_order_id: orderId,
    p_to_status: toStatus,
    p_expected_row_version: rowVersion ?? undefined,
  });

export const cancelOrder = (orderId: string, reason: CancelReason, note?: string, rowVersion?: number) =>
  rpc('cancel_order', {
    p_order_id: orderId,
    p_reason: reason,
    p_note: note ?? undefined,
    p_expected_row_version: rowVersion ?? undefined,
  });

/* ── Forward-only state machine (matches advance_order in 0007_admin_orders) ──── */
const NEXT_DELIVERY: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: 'preparing',
  preparing: 'assigned_to_rider',
  assigned_to_rider: 'out_for_delivery',
  out_for_delivery: 'delivered',
};
const NEXT_ONLINE: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: 'preparing',
  preparing: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

/** The next status an admin may advance to, or null if none (per shop_mode). */
export function nextStatus(mode: ShopMode, current: OrderStatus): OrderStatus | null {
  return (mode === 'delivery' ? NEXT_DELIVERY : NEXT_ONLINE)[current] ?? null;
}
