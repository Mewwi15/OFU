/**
 * Shopping-mode store (zustand).
 *
 * The shop runs two separate fulfilment flows:
 *  - `delivery` — a local อู้ฟู่ rider brings the order to a pinned address
 *    (delivery fee, cash-on-delivery or transfer; same-area only).
 *  - `online`   — paid up-front (PromptPay / transfer + slip) and shipped
 *    nationwide as a parcel, so it needs a full structured postal address
 *    (province + postcode), not just a map pin. Carrier branding is withheld
 *    from customer copy until the courier API integration lands.
 *
 * Screens read `mode` to branch their UI (home mode switch, cart summary,
 * checkout payment options). `MODE_META` holds the shared Thai copy + icon so
 * every screen renders the same labels.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { loadFulfilmentFees, type FulfilmentFees } from '@/lib/data/shop';
import { zustandStorage } from '@/lib/storage';

export type ShopMode = 'delivery' | 'online';

/**
 * Rider delivery is live (owner decision 2026-08-13). The shop owner delivers
 * in person and works the orders from the POS on their phone — navigate, call,
 * share live position, collect cash — so there is no separate rider app.
 *
 * Free delivery, no minimum order and no service radius, all deliberate: an
 * order that turns out to be too far is cancelled with the `out_of_area` reason,
 * which the customer now actually sees.
 */
export const DELIVERY_COMING_SOON = false;

export type ModeMeta = {
  key: ShopMode;
  /** Short label, e.g. "เดลิเวอรี่". */
  label: string;
  /** One-line tagline under the label. */
  tagline: string;
  /** Owner's 3D clay art (same family as the parcel-tracking stages). */
  image: number;
  /** Not selectable yet — rendered dimmed with an "เร็วๆ นี้" badge. */
  comingSoon?: boolean;
};

export const MODE_META: Record<ShopMode, ModeMeta> = {
  delivery: {
    key: 'delivery',
    label: 'เดลิเวอรี่',
    tagline: DELIVERY_COMING_SOON ? 'กำลังจะเปิดให้ใช้งานเร็วๆ นี้' : 'สั่งเลย ส่งถึงบ้าน · ส่งฟรี',
    image: require('@/assets/images/parcel/parcel-4.png') as number,
    comingSoon: DELIVERY_COMING_SOON,
  },
  online: {
    key: 'online',
    label: 'ออนไลน์',
    tagline: 'อู้ฟู่ส่งพัสดุทั่วไทย',
    image: require('@/assets/images/parcel/parcel-1.png') as number,
  },
};

/**
 * Fee store — the live figures from `shop_settings` (RPC `get_fulfilment_fees`,
 * migration 0071).
 *
 * These used to be constants here. `place_order` has always charged from the
 * table, so a hardcoded copy could only ever be right until the owner edited a
 * fee — after that the app quoted one number and collected another (bug M1).
 * The defaults below are just the pre-load placeholder, not the source of truth.
 */
export type Fees = FulfilmentFees;

const DEFAULT_FEES: Fees = {
  deliveryFee: 40,
  freeDeliveryMin: 200,
  onlineFee: 150,
  onlineFreeMin: null,
  codEnabled: true,
  codCap: null,
  // เขตจัดส่ง: ก่อนโหลดค่าจริง ถือว่ายังไม่ตั้ง = ไม่บล็อกใคร
  shopLat: null,
  shopLng: null,
  deliveryRadiusKm: 15,
};

export type FeesState = {
  fees: Fees;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
};

export const useFees = create<FeesState>((set, get) => ({
  fees: DEFAULT_FEES,
  loaded: false,
  load: async (force = false) => {
    if (get().loaded && !force) return;
    try {
      set({ fees: await loadFulfilmentFees(), loaded: true });
    } catch {
      // Keep the placeholder and stay silent — a fee we cannot read is not a
      // reason to block the cart. The charged total still comes from the server.
    }
  },
}));

/**
 * Fulfilment fee for a subtotal + mode.
 *
 * STILL AN ESTIMATE, NOT A PRICE. It now tracks the shop's real settings, but
 * anything the customer actually pays — above all a PromptPay QR — must come
 * from `PlacedOrder.total`, which is computed server-side inside `place_order`.
 */
export function deliveryFeeFor(mode: ShopMode, subtotal: number, fees: Fees): number {
  if (mode === 'delivery') {
    return subtotal >= fees.freeDeliveryMin ? 0 : fees.deliveryFee;
  }
  return fees.onlineFreeMin != null && subtotal >= fees.onlineFreeMin ? 0 : fees.onlineFee;
}

/**
 * Minimum-order floor.
 *
 * Owner decision 2026-08-13: delivery is free with no minimum — a customer may
 * order a single ฿10 bottle. Kept as a function so reinstating a floor is one
 * edit rather than a hunt through the cart.
 */
export function meetsMinOrder(_mode: ShopMode, _subtotal: number): boolean {
  return true;
}

export type ModeState = {
  mode: ShopMode;
  setMode: (mode: ShopMode) => void;
};

export const useMode = create<ModeState>()(
  persist(
    (set) => ({
      mode: DELIVERY_COMING_SOON ? 'online' : 'delivery',
      setMode: (mode) => {
        if (MODE_META[mode].comingSoon) return; // not selectable yet
        set({ mode });
      },
    }),
    {
      name: 'oofoo-mode',
      storage: zustandStorage,
      partialize: (state) => ({ mode: state.mode }),
      // v2: delivery paused — devices that had persisted 'delivery' move to
      // 'online' instead of waking up stuck in an unselectable mode.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { mode?: ShopMode } | undefined;
        if (DELIVERY_COMING_SOON && state?.mode === 'delivery') {
          return { ...state, mode: 'online' as ShopMode };
        }
        return state;
      },
    },
  ),
);
