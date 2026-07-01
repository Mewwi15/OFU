/**
 * Catalog store (zustand) — the app's source of products, loaded from Supabase
 * once on entry and cached for the session. Screens read `products` from here
 * instead of a static mock array; `load()` is idempotent (call it freely).
 */

import { create } from 'zustand';

import type { Product } from '@/data/products';
import {
  loadBanners,
  loadCatalog,
  loadCategoryNames,
  loadFeatured,
  type FeaturedRow,
  type HomeBanner,
} from '@/lib/data/catalog';

export type CatalogState = {
  products: Product[];
  banners: HomeBanner[];
  categories: string[];
  featured: FeaturedRow[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** Fetch the catalog. No-op while loading or already loaded unless `force`. */
  load: (force?: boolean) => Promise<void>;
};

export const useCatalog = create<CatalogState>((set, get) => ({
  products: [],
  banners: [],
  categories: [],
  featured: [],
  loading: false,
  loaded: false,
  error: null,

  load: async (force = false) => {
    const s = get();
    if (s.loading) return;
    if (s.loaded && !force) return;
    set({ loading: true, error: null });
    try {
      // Banners/categories/featured are optional chrome — never block the catalog.
      const [products, banners, categories, featured] = await Promise.all([
        loadCatalog(),
        loadBanners().catch(() => [] as HomeBanner[]),
        loadCategoryNames().catch(() => [] as string[]),
        loadFeatured().catch(() => [] as FeaturedRow[]),
      ]);
      set({ products, banners, categories, featured, loaded: true, loading: false });
    } catch {
      set({ error: 'โหลดสินค้าไม่สำเร็จ', loading: false });
    }
  },
}));

/** Find a product by id within a loaded list. */
export function findProduct(products: Product[], id?: string): Product | undefined {
  return id ? products.find((p) => p.id === id) : undefined;
}
