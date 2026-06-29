/**
 * Cart store (zustand).
 *
 * A cart line is keyed by `productId + size` so the same product in two
 * different sizes occupies two lines. `add` merges quantity into an existing
 * matching line. `subtotal`/`count` are derived via the exported helpers
 * (`cartSubtotal` / `cartCount`) so consumers can compute them from the
 * current `items` array without storing redundant state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import type { Product } from '@/data/products';

export type CartItem = {
  /** Stable line id = `${product.id}-${size ?? 'default'}`. */
  id: string;
  product: Product;
  qty: number;
  size?: string;
  color?: string;
};

export type AddOptions = {
  size?: string;
  color?: string;
  qty?: number;
};

export type CartState = {
  items: CartItem[];
  /** Line ids currently ticked for checkout (Shopee-style selection). */
  selectedIds: string[];
  /** Add a product (merges qty into a matching size line if one exists). */
  add: (product: Product, opts?: AddOptions) => void;
  /** Remove a line by its line id. */
  remove: (id: string) => void;
  /** Set the quantity of a line. A qty <= 0 removes the line. */
  setQty: (id: string, qty: number) => void;
  /** Toggle whether a line is ticked for checkout. */
  toggleSelect: (id: string) => void;
  /** Select every line (true) or none (false). */
  selectAll: (select: boolean) => void;
  /** Remove every ticked line (used after checkout / "ลบที่เลือก"). */
  removeSelected: () => void;
  /** Empty the cart. */
  clear: () => void;
};

/** Build the stable line id for a product + chosen size. */
export function cartItemId(productId: string, size?: string): string {
  return `${productId}-${size ?? 'default'}`;
}

/** Sum of price * qty across all cart lines. */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.product.price * item.qty, 0);
}

/** Total number of units across all cart lines. */
export function cartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.qty, 0);
}

/** Only the lines whose id is in `selectedIds`. */
export function selectedItems(items: CartItem[], selectedIds: string[]): CartItem[] {
  const set = new Set(selectedIds);
  return items.filter((item) => set.has(item.id));
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      selectedIds: [],

      add: (product, opts) =>
    set((state) => {
      const qty = Math.max(1, opts?.qty ?? 1);
      const size = opts?.size;
      const color = opts?.color ?? product.colors[0];
      const id = cartItemId(product.id, size);

      // Newly added lines start ticked for checkout.
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds
        : [...state.selectedIds, id];

      const existing = state.items.find((item) => item.id === id);
      if (existing) {
        return {
          selectedIds,
          items: state.items.map((item) =>
            item.id === id ? { ...item, qty: item.qty + qty } : item,
          ),
        };
      }

      const line: CartItem = { id, product, qty, size, color };
      return { selectedIds, items: [...state.items, line] };
    }),

  remove: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),

  setQty: (id, qty) =>
    set((state) => {
      if (qty <= 0) {
        return {
          items: state.items.filter((item) => item.id !== id),
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
        };
      }
      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, qty } : item,
        ),
      };
    }),

  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),

  selectAll: (select) =>
    set((state) => ({
      selectedIds: select ? state.items.map((item) => item.id) : [],
    })),

  removeSelected: () =>
    set((state) => {
      const drop = new Set(state.selectedIds);
      return {
        items: state.items.filter((item) => !drop.has(item.id)),
        selectedIds: [],
      };
    }),

      clear: () => set({ items: [], selectedIds: [] }),
    }),
    {
      name: 'oofoo-cart',
      storage: zustandStorage,
      partialize: (state) => ({ items: state.items, selectedIds: state.selectedIds }),
    },
  ),
);
