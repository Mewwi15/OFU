/**
 * Shop store (zustand) — the merchant profile + hours loaded from the backend,
 * cached for the session. Falls back to DEFAULT_SHOP until the load resolves.
 */

import { create } from 'zustand';

import { DEFAULT_SHOP, type ShopInfo } from '@/data/shop';
import { loadShopInfo } from '@/lib/data/shop';

export type ShopState = {
  info: ShopInfo;
  loaded: boolean;
  loading: boolean;
  load: (force?: boolean) => Promise<void>;
};

export const useShop = create<ShopState>((set, get) => ({
  info: DEFAULT_SHOP,
  loaded: false,
  loading: false,
  load: async (force = false) => {
    const s = get();
    if (s.loading || (s.loaded && !force)) return;
    set({ loading: true });
    try {
      set({ info: await loadShopInfo(), loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
