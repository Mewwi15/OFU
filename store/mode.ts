/**
 * Shopping-mode store (zustand).
 *
 * The shop runs two separate fulfilment flows:
 *  - `delivery` — a local อู้ฟู่ rider brings the order to a pinned address
 *    (delivery fee, cash-on-delivery or transfer; same-area only).
 *  - `online`   — paid up-front (PromptPay / transfer + slip) and shipped
 *    nationwide as a parcel via Flash Express, so it needs a full structured
 *    postal address (province + postcode), not just a map pin.
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
  /** Ionicons glyph name. */
  icon: string;
  /** Not selectable yet — rendered dimmed with an "เร็วๆ นี้" badge. */
  comingSoon?: boolean;
};

export const MODE_META: Record<ShopMode, ModeMeta> = {
  delivery: {
    key: 'delivery',
    label: 'เดลิเวอรี่',
    tagline: DELIVERY_COMING_SOON ? 'กำลังจะเปิดให้ใช้งานเร็วๆ นี้' : 'สั่งเลย ส่งถึงบ้าน',
    icon: 'bicycle',
    comingSoon: DELIVERY_COMING_SOON,
  },
  online: {
    key: 'online',
    label: 'ออนไลน์',
    tagline: 'ส่งทั่วไทย ผ่าน Flash',
    icon: 'cube',
  },
};

/** Delivery (rider) fee in Baht; waived above the free-shipping threshold. */
export const DELIVERY_FEE = 40;
/** Order subtotal at/above which rider delivery is free. */
export const FREE_DELIVERY_MIN = 200;
/** Minimum subtotal required to place a delivery order. */
export const MIN_ORDER = 100;

/** Flat Flash Express parcel-shipping fee (online), waived above the threshold. */
export const FLASH_FEE = 40;
/** Order subtotal at/above which Flash shipping is free. */
export const FLASH_FREE_MIN = 500;

/**
 * Fulfilment fee for a subtotal + mode — rider delivery fee (`delivery`) or
 * Flash parcel-shipping fee (`online`), each waived above its free threshold.
 */
export function deliveryFeeFor(mode: ShopMode, subtotal: number): number {
  if (mode === 'delivery') {
    return subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  }
  // online → Flash Express parcel shipping
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
