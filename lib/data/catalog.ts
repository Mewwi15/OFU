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
  categories: { name: string } | null;
  product_variants: { id: string; size: string | null; price: number; available_qty: number }[] | null;
  product_images: { storage_path: string; is_primary: boolean; display_order: number }[] | null;
};

const SELECT =
  'id, name, subtitle, description, rating, categories(name), ' +
  'product_variants(id, size, price, available_qty), ' +
  'product_images(storage_path, is_primary, display_order)';

function mapProduct(r: Row): Product {
  const variants: ProductVariant[] = (r.product_variants ?? [])
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
  };
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
