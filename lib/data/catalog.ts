/**
 * Catalog repository — published products/variants/images read from Supabase
 * (PostgREST, public-read behind RLS). Maps the DB shape onto the app's
 * `Product` view model so screens/components stay unchanged. The catalog is
 * managed by the admin web (0006 RPCs); the app only reads it.
 */

import type { Category, Product, ProductCategory, ProductVariant } from '@/data/products';
import { supabase } from '@/lib/supabase/client';

type Row = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  rating: number | null;
  created_at: string | null;
  categories: { name: string } | null;
  product_variants:
    | { id: string; size: string | null; price: number; available_qty: number; archived_at: string | null }[]
    | null;
  product_images: { storage_path: string; is_primary: boolean; display_order: number }[] | null;
};

const SELECT =
  'id, name, subtitle, description, rating, created_at, categories(name), ' +
  'product_variants(id, size, price, available_qty, archived_at), ' +
  'product_images(storage_path, is_primary, display_order)';

function mapProduct(r: Row): Product {
  const variants: ProductVariant[] = (r.product_variants ?? [])
    .filter((v) => !v.archived_at) // retired size rows stay for history but never surface
    .map((v) => ({ id: v.id, size: v.size, price: v.price, available: v.available_qty }))
    .sort((a, b) => a.price - b.price);

  const images = (r.product_images ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order)
    .map((i) => i.storage_path);

  return {
    id: r.id,
    name: r.name,
    subtitle: r.subtitle ?? '',
    description: r.description ?? '',
    price: variants.length ? variants[0].price : 0,
    rating: r.rating ?? 0,
    images,
    colors: [],
    sizes: variants.map((v) => v.size).filter((s): s is string => !!s),
    variants,
    category: (r.categories?.name ?? 'ของแห้ง') as ProductCategory,
    createdAt: r.created_at ?? undefined,
  };
}

/** Top-selling published product ids (real POS + online sales), best first. */
export async function loadBestsellerIds(limit = 12): Promise<string[]> {
  const { data, error } = await supabase.rpc('home_bestseller_ids', { p_limit: limit });
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

/** Load all published, non-archived products (with variants + images). */
export async function loadCatalog(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT)
    .eq('publish_state', 'published')
    .is('archived_at', null)
    .order('created_at');
  if (error) throw error;
  // Only surface products that have at least one purchasable variant.
  return ((data ?? []) as unknown as Row[]).map(mapProduct).filter((p) => p.variants.length > 0);
}

/** A published home-hero banner (managed by the admin web's Banners page). */
export type HomeBanner = { id: string; image: string; title: string | null };

/** Load published banners for the app home, in admin display order. */
export async function loadBanners(): Promise<HomeBanner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('id, image_path, headline, display_order')
    .eq('publish_state', 'published')
    .order('display_order');
  if (error) throw error;
  return ((data ?? []) as { id: string; image_path: string | null; headline: string | null }[])
    .filter((b) => !!b.image_path)
    .map((b) => ({ id: b.id, image: b.image_path as string, title: b.headline }));
}

/** Category names in the admin's display order (drives the app's filter chips). */
export async function loadCategoryNames(): Promise<string[]> {
  const { data, error } = await supabase.from('categories').select('name, display_order').order('display_order');
  if (error) throw error;
  return ((data ?? []) as { name: string }[]).map((c) => c.name).filter(Boolean);
}

/** A published featured row (title + its products' ids) for the app home. */
export type FeaturedRow = { id: string; title: string; productIds: string[] };
export async function loadFeatured(): Promise<FeaturedRow[]> {
  const { data, error } = await supabase
    .from('featured_sections')
    .select('id, title, display_order, featured_section_items(product_id, display_order)')
    .eq('publish_state', 'published')
    .order('display_order');
  if (error) throw error;
  type Row = { id: string; title: string; featured_section_items: { product_id: string; display_order: number }[] | null };
  return ((data ?? []) as unknown as Row[]).map((s) => ({
    id: s.id,
    title: s.title,
    productIds: (s.featured_section_items ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((i) => i.product_id),
  }));
}

/** The category filter list (static UI labels; 'ทั้งหมด' = All). */
export const CATEGORY_FILTERS: readonly Category[] = [
  'ทั้งหมด',
  'ของสด',
  'เครื่องดื่ม',
  'ของแห้ง',
  'ของใช้ในบ้าน',
  'ขนม',
  'ยา',
];
