/**
 * Order store (zustand, persisted).
 *
 * Holds the order currently being tracked (`active`) plus the customer's past
 * orders (`history`). `createOrder` is called on a verified checkout (cart →
 * payment → success) and seeds a `preparing` order; the tracking screen advances
 * `status` through the delivery lifecycle and records the rating. When the order
 * wraps up, `archive` moves it into `history`. Frontend-first: status is driven
 * by the UI today and will be fed by realtime order events once the backend
 * lands. Persisted so a reload keeps the active order + history.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { MOCK_RIDER, type OrderStatus, type TrackedOrder } from '@/data/fulfillment';
import { zustandStorage } from '@/lib/storage';

export type CreateOrderInput = {
  total: number;
  itemCount: number;
  addressLabel: string;
  addressLine: string;
  /** Fulfilment kind — defaults to `delivery` (local rider). */
  fulfilment?: 'delivery' | 'parcel';
};

/** Flash-style tracking number derived from the order id (Hermes-safe, stable). */
function trackingNoFor(id: string): string {
  const digits = id.replace(/\D/g, '').padStart(11, '0').slice(-11);
  return `TH${digits}A`;
}

export type OrderRating = {
  orderId: string;
  stars: number;
  comment: string;
};

export type OrderState = {
  active: TrackedOrder | null;
  history: TrackedOrder[];
  rating: OrderRating | null;
  /** Create + start tracking a new order. Returns its id. */
  createOrder: (input: CreateOrderInput) => string;
  /** Advance / set the tracked order's status. */
  setStatus: (status: OrderStatus) => void;
  /** Record the customer's post-delivery rating. */
  submitRating: (stars: number, comment: string) => void;
  /** Move the finished active order into history (newest first). */
  archive: () => void;
  /** Drop the active order without archiving (rarely needed). */
  clear: () => void;
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** Display timestamp for "order placed", Hermes-safe (no toLocaleString). */
function stampNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${hh}:${mm} น.`;
}

/** Next id derived from existing orders so it survives a persisted rehydrate. */
function nextOrderId(orders: (TrackedOrder | null)[]): string {
  let max = 8451;
  for (const o of orders) {
    if (!o) continue;
    const n = Number(o.id.replace('ORD-', ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `ORD-${max + 1}`;
}

export const useOrder = create<OrderState>()(
  persist(
    (set, get) => ({
      active: null,
      history: [],
      rating: null,

      createOrder: (input) => {
        const { active, history } = get();
        const id = nextOrderId([active, ...history]);
        const isParcel = input.fulfilment === 'parcel';
        const order: TrackedOrder = {
          id,
          shopName: 'ร้าน อู้ฟู่',
          status: 'preparing',
          etaText: isParcel ? 'ถึงภายใน 2-3 วัน' : '30-45 นาที',
          etaShort: isParcel ? '2-3 วัน' : '25 นาที',
          total: input.total,
          itemCount: input.itemCount,
          addressLabel: input.addressLabel,
          addressLine: input.addressLine,
          placedAtLabel: stampNow(),
          rider: MOCK_RIDER,
          fulfilment: input.fulfilment ?? 'delivery',
          ...(isParcel
            ? { courier: 'Flash Express', trackingNo: trackingNoFor(id) }
            : {}),
        };
        set({ active: order, rating: null });
        return id;
      },

      setStatus: (status) =>
        set((state) => {
          if (!state.active) return state;
          const deliveredAt =
            status === 'delivered'
              ? (state.active.deliveredAt ?? 'เพิ่งส่งถึง')
              : state.active.deliveredAt;
          return { active: { ...state.active, status, deliveredAt } };
        }),

      submitRating: (stars, comment) => {
        const active = get().active;
        if (!active) return;
        set({ rating: { orderId: active.id, stars, comment } });
      },

      archive: () =>
        set((state) => {
          if (!state.active) return { active: null, rating: null };
          return {
            active: null,
            rating: null,
            history: [state.active, ...state.history],
          };
        }),

      clear: () => set({ active: null, rating: null }),
    }),
    {
      name: 'oofoo-order',
      storage: zustandStorage,
      partialize: (state) => ({
        active: state.active,
        history: state.history,
        rating: state.rating,
      }),
    },
  ),
);
