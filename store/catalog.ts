/**
 * Catalog store (zustand) — the app's source of products, loaded from Supabase
 * once on entry and cached for the session. Screens read `products` from here
 * instead of a static mock array; `load()` is idempotent (call it freely).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Product } from '@/data/products';
import { zustandStorage } from '@/lib/storage';
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

/**
 * ★ เก็บแคตตาล็อกลงเครื่อง แล้วแสดงของเก่าไปก่อนระหว่างดึงของใหม่ ★
 * (เจ้าของแจ้ง 14 ก.ย. 2026 ว่าแอปช้า "เปิดแอปครั้งแรก กว่าจะขึ้นหน้าแรก")
 *
 * ของจริงที่วัดได้: สินค้า 978 รายการ = 615 KB ทุกครั้งที่เปิดแอป — บนเน็ตมือถือคือหลาย
 * วินาทีที่ลูกค้าเห็นแต่โครงการ์ดเปล่า ทั้งที่ของชุดเดิมเพิ่งโหลดไปเมื่อไม่กี่นาทีก่อน
 *
 * เก็บไว้ในเครื่องแล้ววาดทันทีที่เปิด จากนั้นค่อยดึงของใหม่มาทับเงียบ ๆ — ราคา/สต๊อกที่
 * เห็นแวบแรกอาจเก่าไปไม่กี่นาที ซึ่งรับได้ เพราะยอดที่ลูกค้าจ่ายจริงคิดจากฝั่งเซิร์ฟเวอร์
 * ตอนกดสั่ง (place_order) ไม่ได้เชื่อราคาที่แอปถืออยู่
 */
export const useCatalog = create<CatalogState>()(persist((set, get) => ({
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
}), {
  name: 'oofoo-catalog',
  storage: zustandStorage,
  /* เก็บเฉพาะข้อมูล ไม่เก็บสถานะกำลังโหลด/ข้อผิดพลาด — ไม่งั้นเปิดแอปมาอาจค้างที่
     "กำลังโหลด" ของรอบก่อนที่ไม่มีวันจบ */
  partialize: (s) => ({
    products: s.products,
    banners: s.banners,
    categories: s.categories,
    featured: s.featured,
    bestsellerIds: s.bestsellerIds,
    loadedAt: s.loadedAt,
  }),
  version: 1,
  /* อ่านจากเครื่องเสร็จแล้วถือว่ามีของให้แสดงได้ (ถ้ามีสินค้าจริง) — หน้าจอเช็ค loaded
     เพื่อตัดสินใจว่าจะโชว์โครงการ์ดรอหรือของจริง */
  onRehydrateStorage: () => (state) => {
    if (state?.products?.length) state.loaded = true;
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
