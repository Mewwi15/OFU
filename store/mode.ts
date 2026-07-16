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

import { zustandStorage } from '@/lib/storage';

export type ShopMode = 'delivery' | 'online';

/**
 * Rider delivery hasn't launched yet (owner decision 2026-07-11) — the mode
 * shows as "เร็วๆ นี้" and can't be selected. Flip to false on launch day; the
 * switch UI, fees and checkout branches below are all still wired up.
 */
export const DELIVERY_COMING_SOON = true;

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
    tagline: DELIVERY_COMING_SOON ? 'กำลังจะเปิดให้ใช้งานเร็วๆ นี้' : 'สั่งเลย ส่งถึงบ้าน',
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

/** Delivery (rider) fee in Baht; waived above the free-shipping threshold. */
export const DELIVERY_FEE = 40;
/** Order subtotal at/above which rider delivery is free. */
export const FREE_DELIVERY_MIN = 200;
/** Minimum subtotal required to place a delivery order. */
export const MIN_ORDER = 100;

/** Flat parcel-shipping fee (online), waived above the threshold.
    ESTIMATE ONLY — the owner edits the real one in shop_settings.online_fee
    (0048) and place_order charges from there, so this copy goes stale the day
    they change it and no rebuild can be assumed. See `deliveryFeeFor`. */
export const FLASH_FEE = 150;
/** No free-shipping tier for parcels (owner decision) — every online order
    pays the fee. Mirrors shop_settings.online_free_threshold = NULL (0049).
    ESTIMATE ONLY, same caveat as FLASH_FEE. */
export const FLASH_FREE_MIN = Number.POSITIVE_INFINITY;

/**
 * Fulfilment fee for a subtotal + mode — rider delivery fee (`delivery`) or
 * parcel-shipping fee (`online`), each waived above its free threshold.
 *
 * AN ESTIMATE, NOT A PRICE. The owner can change the online fee/threshold in
 * shop_settings whenever they like, and `place_order` charges from there — this
 * is a client-side copy that cannot know it has gone stale (M1). Use it for
 * pre-order "ประมาณการ" UI only. Anything the customer actually pays — above
 * all a PromptPay QR — must come from `PlacedOrder.total`.
 */
export function deliveryFeeFor(mode: ShopMode, subtotal: number): number {
  if (mode === 'delivery') {
    return subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  }
  // online → nationwide parcel shipping
  return subtotal >= FLASH_FREE_MIN ? 0 : FLASH_FEE;
}

/** Whether a subtotal clears the minimum-order floor (online has no floor). */
export function meetsMinOrder(mode: ShopMode, subtotal: number): boolean {
  if (mode !== 'delivery') return true;
  return subtotal >= MIN_ORDER;
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
