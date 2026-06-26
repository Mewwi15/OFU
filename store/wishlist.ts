/**
 * Wishlist store (zustand).
 *
 * Stores just the set of liked product ids. Seeded with three products so the
 * Wishlist screen has content on first run. Use `wishlistProducts(ids)` to
 * resolve the ids into full `Product` objects from the mock catalog.
 */

import { create } from 'zustand';

import { products, type Product } from '@/data/products';

export type WishlistState = {
  ids: string[];
  /** Add the id if absent, remove it if present. */
  toggle: (id: string) => void;
  /** Whether the given product id is wishlisted. */
  has: (id: string) => boolean;
};

/** Product ids wishlisted by default. */
const SEED_IDS = ['1', '3', '5'];

export const useWishlist = create<WishlistState>((set, get) => ({
  ids: [...SEED_IDS],

  toggle: (id) =>
    set((state) => ({
      ids: state.ids.includes(id)
        ? state.ids.filter((existing) => existing !== id)
        : [...state.ids, id],
    })),

  has: (id) => get().ids.includes(id),
}));

/**
 * Resolve a list of wishlisted ids into full `Product` objects (in catalog
 * order). Unknown ids are skipped. Pass `useWishlist((s) => s.ids)` to keep it
 * reactive in a screen.
 */
export function wishlistProducts(ids: string[]): Product[] {
  const set = new Set(ids);
  return products.filter((product) => set.has(product.id));
}
