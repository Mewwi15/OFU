/**
 * Catalog store (zustand) — the app's source of products, loaded from Supabase
 * once on entry and cached for the session. Screens read `products` from here
 * instead of a static mock array; `load()` is idempotent (call it freely).
 */

import { create } from 'zustand';

import type { Product } from '@/data/products';
import { loadCatalog } from '@/lib/data/catalog';

export type CatalogState = {
  products: Product[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** Fetch the catalog. No-op while loading or already loaded unless `force`. */
  load: (force?: boolean) => Promise<void>;
};

export const useCatalog = create<CatalogState>((set, get) => ({
  products: [],
  loading: false,
  loaded: false,
  error: null,

  load: async (force = false) => {
    const s = get();
    if (s.loading) return;
    if (s.loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const products = await loadCatalog();
      set({ products, loaded: true, loading: false });
    } catch {
      set({ error: 'โหลดสินค้าไม่สำเร็จ', loading: false });
    }
  },
}));

/** Find a product by id within a loaded list. */
export function findProduct(products: Product[], id?: string): Product | undefined {
  return id ? products.find((p) => p.id === id) : undefined;
}
