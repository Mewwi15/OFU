/**
 * Catalog store (zustand) — the app's source of products, loaded from Supabase
 * once on entry and cached for the session. Screens read `products` from here
 * instead of a static mock array; `load()` is idempotent (call it freely).
 */

import { create } from 'zustand';

import type { Product } from '@/data/products';
import {
  loadBanners,
  loadBestsellerIds,
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
  /** Top-selling product ids (real sales), best first — for the "ขายดี" rail. */
  bestsellerIds: string[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** `Date.now()` of the last successful load — lets callers decide "stale enough to refetch". */
  loadedAt: number | null;
  /** Fetch the catalog. No-op while loading or already loaded unless `force`. */
  load: (force?: boolean) => Promise<void>;
};

export const useCatalog = create<CatalogState>((set, get) => ({
  products: [],
  banners: [],
  categories: [],
  featured: [],
  bestsellerIds: [],
  loading: false,
  loaded: false,
  error: null,
  loadedAt: null,

  load: async (force = false) => {
    const s = get();
    if (s.loading) return;
    if (s.loaded && !force) return;
    set({ loading: true, error: null });
    try {
      // Banners/categories/featured/bestsellers are optional chrome — never block the catalog.
      const [products, banners, categories, featured, bestsellerIds] = await Promise.all([
        loadCatalog(),
        loadBanners().catch(() => [] as HomeBanner[]),
        loadCategoryNames().catch(() => [] as string[]),
        loadFeatured().catch(() => [] as FeaturedRow[]),
        loadBestsellerIds().catch(() => [] as string[]),
      ]);
      set({
        products, banners, categories, featured, bestsellerIds,
        loaded: true, loading: false, loadedAt: Date.now(),
      });
    } catch {
      set({ error: 'โหลดสินค้าไม่สำเร็จ', loading: false });
    }
  },
}));

/**
 * Re-fetch on tab focus only if the catalog is missing or stale — a bare
 * `load(true)` on every focus re-ran all 5 catalog queries on every single
 * tab switch (Home<->Search<->Home while browsing easily racked up 20-40
 * redundant requests in one session). `staleMs` still lets admin-side changes
 * (new products, prices, banners) show up without restarting the app, just
 * not on every single glance.
 */
export const STALE_MS = 60_000;
export function loadIfStale(): void {
  const s = useCatalog.getState();
  const stale = !s.loadedAt || Date.now() - s.loadedAt > STALE_MS;
  void s.load(stale);
}

/** Find a product by id within a loaded list. */
export function findProduct(products: Product[], id?: string): Product | undefined {
  return id ? products.find((p) => p.id === id) : undefined;
}
