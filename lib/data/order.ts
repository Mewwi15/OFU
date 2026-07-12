/**
 * Order repository — turns the local cart + selected address into a real order
 * via the 0005 commerce RPCs. The local cart is synced into the authoritative
 * server cart (clear → add → set mode) and then `place_order` creates the order
 * atomically (reserves/commits stock, applies promo, idempotent).
 */

import { MOCK_RIDER, type OrderStatus, type TrackedOrder } from '@/data/fulfillment';
import type { CartItem } from '@/store/cart';
import { supabase } from '@/lib/supabase/client';
import { uuidv4 } from '@/lib/uuid';

export type ShopMode = 'delivery' | 'online';
export type RpcPaymentMethod = 'cod' | 'promptpay_slip';

export type PlacedOrder = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
};

type PlaceOrderRow = {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
};

export type PlaceOrderInput = {
  items: CartItem[];
  mode: ShopMode;
  paymentMethod: RpcPaymentMethod;
  addressId: string;
  promoCode?: string | null;
};

/** Sync the cart to the server then place the order. Returns the created order. */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  // 1) make the server cart match the selected local lines
  {
    const { error } = await supabase.rpc('clear_cart');
    if (error) throw error;
  }
  for (const item of input.items) {
    const { error } = await supabase.rpc('add_cart_item', {
      p_variant_id: item.variantId,
      p_qty: item.qty,
    });
    if (error) throw error;
  }
  {
    const { error } = await supabase.rpc('set_cart_mode', { p_shop_mode: input.mode });
    if (error) throw error;
  }

  // 2) place the order (idempotency key per attempt)
  const { data, error } = await supabase.rpc('place_order', {
    p_idempotency_key: uuidv4(),
    p_shop_mode: input.mode,
    p_payment_method: input.paymentMethod,
    p_address_id: input.addressId,
    p_promo_code: input.promoCode ?? undefined,
  });
  if (error) throw error;

  const o = data as PlaceOrderRow;
  return {
    id: o.id,
    orderNumber: o.order_number,
    orderStatus: o.order_status,
    paymentStatus: o.payment_status,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    discountAmount: o.discount_amount,
    total: o.total,
  };
}

export type PromoCheck = {
  valid: boolean;
  discount: number;
  scope: string;
  reasonCode: string | null;
  messageTh: string;
};

/** Non-throwing promo preview (validate_promo RPC). */
export async function validatePromo(
  code: string,
  subtotal: number,
  mode: ShopMode,
): Promise<PromoCheck> {
  const { data, error } = await supabase.rpc('validate_promo', {
    p_code: code,
    p_subtotal: subtotal,
    p_shop_mode: mode,
  });
  if (error) throw error;
  const d = (data ?? {}) as {
    valid?: boolean;
    discount?: number;
    scope?: string;
    reason_code?: string | null;
    message_th?: string;
  };
  return {
    valid: !!d.valid,
    discount: d.discount ?? 0,
    scope: d.scope ?? 'subtotal',
    reasonCode: d.reason_code ?? null,
    messageTh: d.message_th ?? '',
  };
}

/** Attach a payment slip to a prepay order (slip_uploaded). */
export async function attachSlip(
  orderId: string,
  storagePath: string,
  observedAmount?: number,
): Promise<void> {
  const { error } = await supabase.rpc('attach_payment_slip', {
    p_order_id: orderId,
    p_storage_path: storagePath,
    p_observed_amount: observedAmount ?? undefined,
  });
  if (error) throw error;
}

/* ── Reading orders back (for the orders tab + tracking screen) ────────────── */

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
function thaiStamp(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${hh}:${mm} น.`;
}

/** DB order_status (rich) → the app's tracking OrderStatus (coarse). */
export function mapOrderStatus(db: string): OrderStatus {
  switch (db) {
    case 'placed':
    case 'awaiting_payment':
    case 'slip_uploaded':
    case 'payment_verifying':
    case 'confirmed':
    case 'preparing':
      return 'preparing';
    case 'assigned_to_rider':
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'picked_up':
      return 'picked_up';
    case 'in_transit':
      return 'in_transit';
    case 'delivered':
      return 'delivered';
    case 'returned':
      return 'returned';
    case 'delivery_failed':
      return 'delivery_failed';
    case 'cancelled':
    case 'payment_rejected':
      return 'cancelled';
    default:
      return 'preparing';
  }
}

export const TERMINAL: OrderStatus[] = ['delivered', 'cancelled', 'returned', 'delivery_failed'];

type OrderItemRow = {
  qty: number;
  name_snapshot: string;
  // Product may be unpublished/archived later → null; images sorted client-side.
  products: { product_images: { storage_path: string; is_primary: boolean }[] | null } | null;
};

type OrderRow = {
  order_number: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  shop_mode: string;
  total: number;
  placed_at: string;
  delivered_at: string | null;
  ship_recipient: string | null;
  ship_address_text: string | null;
  order_items: OrderItemRow[] | null;
  // PostgREST returns a reverse-embedded (FK→orders) relation as an array.
  parcel_shipments: { tracking_no: string | null; courier: string | null }[] | null;
};

const ORDER_SELECT =
  'order_number, order_status, payment_status, payment_method, shop_mode, total, placed_at, ' +
  'delivered_at, ship_recipient, ship_address_text, ' +
  'order_items(qty, name_snapshot, products(product_images(storage_path, is_primary))), ' +
  'parcel_shipments(tracking_no, courier)';

function toTracked(r: OrderRow): TrackedOrder {
  const fulfilment = r.shop_mode === 'online' ? 'parcel' : 'delivery';
  const items = r.order_items ?? [];
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const status = mapOrderStatus(r.order_status);
  // One thumbnail per item (its primary image), capped for the stacked strip.
  const itemImages = items
    .map((i) => {
      const imgs = i.products?.product_images ?? [];
      return (imgs.find((x) => x.is_primary) ?? imgs[0])?.storage_path ?? null;
    })
    .filter((p): p is string => !!p)
    .slice(0, 4);
  return {
    id: r.order_number,
    shopName: 'ร้าน อู้ฟู่',
    status,
    etaText: fulfilment === 'parcel' ? 'ถึงภายใน 2-3 วัน' : '30-45 นาที',
    etaShort: fulfilment === 'parcel' ? '2-3 วัน' : '25 นาที',
    total: r.total,
    itemCount,
    lineCount: items.length,
    addressLabel: 'บ้าน',
    addressLine: r.ship_address_text ?? '',
    placedAtLabel: thaiStamp(r.placed_at),
    deliveredAt: thaiStamp(r.delivered_at),
    rider: MOCK_RIDER,
    fulfilment,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method,
    firstItemName: items[0]?.name_snapshot,
    itemImages,
    ...(fulfilment === 'parcel'
      ? {
          // Carrier brand withheld until the courier API integration lands.
          courier: r.parcel_shipments?.[0]?.courier ?? 'ร้านอู้ฟู่',
          trackingNo: r.parcel_shipments?.[0]?.tracking_no ?? undefined,
        }
      : {}),
  };
}

/** All of the signed-in customer's orders, newest first (RLS → own only). */
export async function listOrders(): Promise<TrackedOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('placed_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(toTracked);
}

/**
 * Subscribe to live updates for one order (Realtime postgres_changes on orders;
 * RLS limits the stream to the caller's own orders). Calls `onChange` when the
 * tracked order changes. Returns an unsubscribe fn.
 */
export function subscribeOrder(orderNumber: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`order:${orderNumber}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        const row = payload.new as { order_number?: string };
        if (row.order_number === orderNumber) onChange();
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** A single order by its order_number (for the tracking screen). */
export async function getOrderByNumber(orderNumber: string): Promise<TrackedOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (error) throw error;
  return data ? toTracked(data as unknown as OrderRow) : null;
}

/** Customer confirms receipt: out_for_delivery → delivered (confirm_delivered RPC). */
export async function confirmDelivered(orderNumber: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_delivered', {
    p_order_number: orderNumber,
  });
  if (error) throw error;
}

/** Submit a 1–5 rating for a delivered order (submit_rating RPC). */
export async function submitRating(
  orderNumber: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_rating', {
    p_order_number: orderNumber,
    p_rating: rating,
    p_comment: comment ?? undefined,
  });
  if (error) throw error;
}

/** The variant lines of a past order, for "reorder". */
export async function getReorderItems(
  orderNumber: string,
): Promise<{ variantId: string; qty: number }[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('order_items(variant_id, qty)')
    .eq('order_number', orderNumber)
    .single();
  if (error) throw error;
  const rows = (data as { order_items: { variant_id: string; qty: number }[] | null }).order_items ?? [];
  return rows.map((r) => ({ variantId: r.variant_id, qty: r.qty }));
}

/** Cancel an order the customer still owns (before it ships). */
export async function cancelOrder(orderNumber: string, note?: string): Promise<void> {
  const { data: row, error: e1 } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .single();
  if (e1) throw e1;
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: (row as { id: string }).id,
    p_reason: 'customer_request',
    p_note: note ?? undefined,
  });
  if (error) throw error;
}

/** Map a place_order / cancel error (RAISE message = the code) to friendly Thai. */
export function orderErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  const table: Record<string, string> = {
    OUT_OF_STOCK: 'สินค้าบางรายการมีไม่พอ กรุณาปรับจำนวนแล้วลองใหม่',
    EMPTY_CART: 'ไม่มีสินค้าที่เลือก',
    CONSENT_REQUIRED: 'กรุณายอมรับเงื่อนไขการใช้งานก่อนสั่งซื้อ',
    ACCOUNT_INACTIVE: 'บัญชียังไม่พร้อมใช้งาน',
    COD_NOT_ALLOWED: 'ออเดอร์นี้ใช้เก็บเงินปลายทางไม่ได้',
    ONLINE_REQUIRES_PREPAY: 'การส่งพัสดุต้องชำระเงินก่อน',
    ADDRESS_REQUIRED: 'กรุณาเลือกที่อยู่จัดส่ง',
    PROMO_INVALID: 'โค้ดส่วนลดใช้ไม่ได้',
    PROMO_MIN_SPEND: 'ยอดสั่งซื้อยังไม่ถึงขั้นต่ำของโค้ดส่วนลด',
    ALREADY_TERMINAL: 'ออเดอร์นี้จบแล้ว ยกเลิกไม่ได้',
    FORBIDDEN: 'ออเดอร์เริ่มจัดส่งแล้ว ยกเลิกไม่ได้',
  };
  return table[msg] ?? 'สั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}
