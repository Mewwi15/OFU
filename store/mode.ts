/**
 * Shopping-mode store (zustand).
 *
 * The shop runs two separate flows that differ mainly in **payment**:
 *  - `delivery` — order is shipped to the customer's address (delivery fee,
 *    cash-on-delivery or transfer).
 *  - `online`   — online order paid up-front (PromptPay / transfer + slip),
 *    picked up at the store. No delivery fee.
 *
 * Screens read `mode` to branch their UI (home mode switch, cart summary,
 * checkout payment options). `MODE_META` holds the shared Thai copy + icon so
 * every screen renders the same labels.
 */

import { create } from 'zustand';

export type ShopMode = 'delivery' | 'online';

export type ModeMeta = {
  key: ShopMode;
  /** Short label, e.g. "เดลิเวอรี่". */
  label: string;
  /** One-line tagline under the label. */
  tagline: string;
  /** Ionicons glyph name. */
  icon: string;
};

export const MODE_META: Record<ShopMode, ModeMeta> = {
  delivery: {
    key: 'delivery',
    label: 'เดลิเวอรี่',
    tagline: 'สั่งเลย ส่งถึงบ้าน',
    icon: 'bicycle',
  },
  online: {
    key: 'online',
    label: 'ออนไลน์',
    tagline: 'ช้อปออนไลน์ รับที่ร้าน',
    icon: 'storefront',
  },
};

/** Delivery fee in Baht; waived above the free-shipping threshold. */
export const DELIVERY_FEE = 40;
/** Order subtotal at/above which delivery is free. */
export const FREE_DELIVERY_MIN = 200;

/** Delivery fee for a given subtotal + mode (0 for online or free-shipping). */
export function deliveryFeeFor(mode: ShopMode, subtotal: number): number {
  if (mode !== 'delivery') return 0;
  return subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
}

export type ModeState = {
  mode: ShopMode;
  setMode: (mode: ShopMode) => void;
};

export const useMode = create<ModeState>((set) => ({
  mode: 'delivery',
  setMode: (mode) => set({ mode }),
}));
