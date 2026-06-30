import { supabase } from './supabase';

/** Surface a Postgres RAISE code (or PostgREST message) for the UI. */
export function apiError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? 'เกิดข้อผิดพลาด';
  const th: Record<string, string> = {
    FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้',
    DUPLICATE_CATEGORY: 'มีหมวดหมู่ชื่อนี้แล้ว',
    DUPLICATE_VARIANT: 'มีขนาดนี้แล้วในสินค้านี้',
    BROKEN_PUBLISH: 'ต้องมีอย่างน้อย 1 ขนาด และ 1 รูป ก่อนเผยแพร่',
    INSUFFICIENT_STOCK: 'ปรับสต็อกแล้วติดลบไม่ได้',
    STALE_WRITE: 'ข้อมูลถูกแก้ไปแล้ว กรุณารีเฟรช',
    NOT_FOUND: 'ไม่พบรายการ',
    VALIDATION: 'ข้อมูลไม่ถูกต้อง',
    NOT_IN_SLIP_UPLOADED: 'ออเดอร์ยังไม่ได้แนบสลิป',
    NOT_IN_VERIFYING: 'ออเดอร์ไม่ได้อยู่ระหว่างตรวจสอบ',
    ILLEGAL_TRANSITION: 'เปลี่ยนสถานะนี้ไม่ได้',
    ALREADY_TERMINAL: 'ออเดอร์จบแล้ว',
  };
  return th[msg] ?? msg;
}

export type Category = { id: string; name: string; display_order: number };

export type Variant = {
  id: string;
  size: string | null;
  price: number;
  stock_qty: number;
  reserved_qty: number;
  available_qty: number;
  low_stock_threshold: number;
};

export type Product = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  rating: number;
  publish_state: 'draft' | 'published';
  archived_at: string | null;
  category_id: string | null;
  row_version: number;
  orderable_delivery: boolean;
  orderable_online: boolean;
  categories: { name: string } | null;
  product_variants: Variant[];
  product_images: { id: string; storage_path: string; is_primary: boolean }[];
};

const rpc = async <T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/* ── Catalog reads ─────────────────────────────────────────────────────────── */
export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, display_order')
    .order('display_order');
  if (error) throw error;
  return data as Category[];
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, subtitle, description, rating, publish_state, archived_at, category_id, row_version, orderable_delivery, orderable_online, categories(name), product_variants(id, size, price, stock_qty, reserved_qty, available_qty, low_stock_threshold), product_images(id, storage_path, is_primary)',
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Product[];
}

/* ── Catalog mutations (0006 RPCs) ─────────────────────────────────────────── */
export const upsertCategory = (p: { id?: string; name: string; slug?: string; display_order?: number }) =>
  rpc<{ id: string }>('upsert_category', {
    p_id: p.id ?? undefined,
    p_name: p.name,
    p_slug: p.slug ?? undefined,
    p_display_order: p.display_order ?? 0,
  });

export const upsertProduct = (p: {
  id?: string;
  category_id?: string | null;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  orderable_delivery?: boolean;
  orderable_online?: boolean;
  expected_row_version?: number;
}) =>
  rpc<{ id: string }>('upsert_product', {
    p_id: p.id ?? undefined,
    p_category_id: p.category_id ?? undefined,
    p_name: p.name,
    p_subtitle: p.subtitle ?? undefined,
    p_description: p.description ?? undefined,
    p_orderable_delivery: p.orderable_delivery ?? true,
    p_orderable_online: p.orderable_online ?? true,
    p_expected_row_version: p.expected_row_version ?? undefined,
  });

export const upsertVariant = (p: {
  id?: string;
  product_id: string;
  size?: string | null;
  price: number;
  stock_qty?: number;
  low_stock_threshold?: number;
}) =>
  rpc<{ id: string }>('upsert_variant', {
    p_id: p.id ?? undefined,
    p_product_id: p.product_id,
    p_size: p.size ?? undefined,
    p_price: p.price,
    p_stock_qty: p.stock_qty ?? undefined,
    p_low_stock_threshold: p.low_stock_threshold ?? undefined,
  });

export const adjustStock = (variantId: string, delta: number) =>
  rpc('adjust_stock', { p_variant_id: variantId, p_delta: delta });

export const setPublishState = (productId: string, state: 'draft' | 'published', rowVersion?: number) =>
  rpc('set_publish_state', { p_product_id: productId, p_state: state, p_expected_row_version: rowVersion ?? undefined });

export const archiveProduct = (id: string, rowVersion?: number) =>
  rpc('archive_product', { p_id: id, p_expected_row_version: rowVersion ?? undefined });

export type BroadcastResult = { notification_id: string; recipients: number; push: number };

export const broadcastNotification = (p: { title: string; body?: string; category?: string }) =>
  rpc<BroadcastResult>('broadcast_notification', {
    p_title: p.title,
    p_body: p.body ?? undefined,
    p_category: p.category ?? 'promo',
  });
