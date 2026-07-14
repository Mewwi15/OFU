import { productThumb } from './image';
import { supabase } from './supabase';

/** VALIDATION is shared by many RPCs for different reasons — the RAISE's
 * `detail=` (surfaced by PostgREST as `.details`) says which one. Map the
 * ones a cashier/owner can actually hit to a specific message instead of the
 * generic fallback, which reads as "it broke" with no clue what to fix. */
const VALIDATION_DETAIL_TH: Record<string, string> = {
  'discount exceeds subtotal': 'ส่วนลดเกินยอดซื้อ กรุณาลดจำนวนส่วนลด',
  'split allows cash/promptpay only': 'แบ่งจ่ายได้เฉพาะเงินสด/พร้อมเพย์เท่านั้น',
  'payments must sum to total': 'ยอดที่แบ่งจ่ายรวมกันไม่เท่ากับยอดสุทธิ',
  code_required: 'กรอกโค้ดส่วนลด',
  value_must_be_positive: 'จำนวนส่วนลดต้องมากกว่า 0',
  percent_over_100: 'ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100%',
  min_spend_negative: 'ยอดซื้อขั้นต่ำต้องไม่ติดลบ',
  date_range: 'วันเริ่มต้นต้องมาก่อนวันสิ้นสุด',
  name_required: 'กรอกชื่อร้าน',
  negative_amount: 'ตัวเลขต้องไม่ติดลบ',
  vat_rate_range: 'อัตรา VAT ต้องอยู่ระหว่าง 0-100',
  promptpay_id_format: 'เลขพร้อมเพย์ต้องเป็นตัวเลข 10 หลัก (มือถือ) 13 หลัก (บัตร ปชช.) หรือ 15 หลัก (e-Wallet)',
};

/** Surface a Postgres RAISE code (or PostgREST message) for the UI. */
export function apiError(e: unknown): string {
  const err = e as { message?: string; details?: string | null };
  const msg = err?.message ?? 'เกิดข้อผิดพลาด';
  if (msg === 'VALIDATION' && err?.details && VALIDATION_DETAIL_TH[err.details]) {
    return VALIDATION_DETAIL_TH[err.details];
  }
  const th: Record<string, string> = {
    FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้',
    DUPLICATE_CATEGORY: 'มีหมวดหมู่ชื่อนี้แล้ว',
    DUPLICATE_VARIANT: 'มีขนาดนี้แล้วในสินค้านี้',
    DUPLICATE_SKU: 'รหัส SKU นี้ถูกใช้แล้ว',
    DUPLICATE_BARCODE: 'บาร์โค้ดนี้ถูกใช้แล้ว',
    VARIANT_IN_USE: 'ลบขนาดนี้ไม่ได้ มีประวัติการขายแล้ว',
    BROKEN_PUBLISH: 'ต้องมีอย่างน้อย 1 ขนาด และ 1 รูป ก่อนเผยแพร่',
    INSUFFICIENT_STOCK: 'ปรับสต็อกแล้วติดลบไม่ได้',
    STALE_WRITE: 'ข้อมูลถูกแก้ไปแล้ว กรุณารีเฟรช',
    NOT_FOUND: 'ไม่พบรายการ',
    VALIDATION: 'ข้อมูลไม่ถูกต้อง',
    NOT_IN_SLIP_UPLOADED: 'ออเดอร์ยังไม่ได้แนบสลิป',
    NOT_IN_VERIFYING: 'ออเดอร์ไม่ได้อยู่ระหว่างตรวจสอบ',
    ILLEGAL_TRANSITION: 'เปลี่ยนสถานะนี้ไม่ได้',
    ALREADY_TERMINAL: 'ออเดอร์จบแล้ว',
    NO_OPEN_SHIFT: 'ยังไม่ได้เปิดกะ กรุณาเปิดกะก่อนขาย',
    SHIFT_ALREADY_OPEN: 'มีกะที่เปิดอยู่แล้ว',
    SHIFT_CLOSED: 'กะนี้ปิดแล้ว',
    OUT_OF_STOCK: 'สินค้าบางรายการมีไม่พอ',
    INSUFFICIENT_CASH: 'เงินที่รับมาไม่พอ',
    INSUFFICIENT_CREDIT: 'เครดิตร้านไม่พอ',
    EMPTY_SALE: 'ยังไม่มีสินค้าในบิล',
    CUSTOMER_REQUIRED: 'ต้องเลือกลูกค้าสำหรับเครดิตร้าน',
    DUPLICATE_PROMO_CODE: 'มีโค้ดส่วนลดนี้อยู่แล้ว',
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
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  unit: string;
  archived_at?: string | null;
};

export type Product = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  brand: string | null;
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

/** Cached across navigations (Products/Stock/Categories/Featured all list the
 * same catalog) — a bare mount-time call reuses a fetch from the last 30s
 * instead of re-querying the full nested product/variant/image tree on every
 * page visit. Pass `force: true` right after a mutation so the caller sees
 * its own write immediately, not a stale cache. */
let productsCache: { data: Product[]; at: number } | null = null;
const PRODUCTS_STALE_MS = 30_000;

export function invalidateProductsCache() {
  productsCache = null;
}

export async function listProducts(force = false): Promise<Product[]> {
  if (!force && productsCache && Date.now() - productsCache.at < PRODUCTS_STALE_MS) {
    return productsCache.data;
  }
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, subtitle, description, brand, rating, publish_state, archived_at, category_id, row_version, orderable_delivery, orderable_online, categories(name), product_variants(id, size, price, stock_qty, reserved_qty, available_qty, low_stock_threshold, sku, barcode, cost_price, unit, archived_at), product_images(id, storage_path, is_primary)',
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Hide archived (retired size) variants — 1 product = 1 live stock row.
  const products = (data as unknown as Product[]).map((p) => ({
    ...p,
    product_variants: p.product_variants.filter((v) => !v.archived_at),
  }));
  productsCache = { data: products, at: Date.now() };
  return products;
}

/** Just enough to count products per category — Categories.tsx only needs a
 * tally, not the full nested variant/image tree listProducts() fetches. */
export async function listProductCategoryIds(): Promise<{ category_id: string | null }[]> {
  const { data, error } = await supabase.from('products').select('category_id').is('archived_at', null);
  if (error) throw error;
  return data as { category_id: string | null }[];
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
  brand?: string | null;
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
    p_brand: p.brand ?? undefined,
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
  sku?: string | null;
  barcode?: string | null;
  cost_price?: number | null;
  unit?: string | null;
}) =>
  rpc<{ id: string }>('upsert_variant', {
    p_id: p.id ?? undefined,
    p_product_id: p.product_id,
    p_size: p.size ?? undefined,
    p_price: p.price,
    p_stock_qty: p.stock_qty ?? undefined,
    p_low_stock_threshold: p.low_stock_threshold ?? undefined,
    p_sku: p.sku ?? undefined,
    p_barcode: p.barcode ?? undefined,
    p_cost_price: p.cost_price ?? undefined,
    p_unit: p.unit ?? undefined,
  });

export const deleteVariant = (id: string) => rpc('delete_variant', { p_id: id });
export const deleteCategory = (id: string) => rpc('delete_category', { p_id: id });
export const reorderCategories = (ids: string[]) => rpc('reorder_categories', { p_ids: ids });

/* ── app layout: featured sections (customer-app home) ──────────────────────── */
export type FeaturedSection = {
  id: string;
  title: string;
  display_order: number;
  publish_state: 'draft' | 'published';
  see_all_target_type: string | null;
  see_all_target_id: string | null;
};
export async function listFeaturedSections(): Promise<FeaturedSection[]> {
  const { data, error } = await supabase
    .from('featured_sections')
    .select('id, title, display_order, publish_state, see_all_target_type, see_all_target_id')
    .order('display_order');
  if (error) throw error;
  return data as FeaturedSection[];
}
export const reorderFeaturedSections = (ids: string[]) => rpc('reorder_featured_sections', { p_ids: ids });
export const setFeaturedPublish = (id: string, published: boolean) =>
  rpc('set_featured_publish', { p_id: id, p_published: published });
export const upsertFeaturedSection = (p: { id?: string; title: string; publish_state?: 'draft' | 'published' }) =>
  rpc<{ id: string }>('upsert_featured_section', {
    p_id: p.id ?? undefined,
    p_title: p.title,
    p_publish_state: p.publish_state ?? 'draft',
  });
export const setFeaturedItems = (sectionId: string, productIds: string[]) =>
  rpc('set_featured_items', { p_section_id: sectionId, p_product_ids: productIds });
export const deleteFeaturedSection = (id: string) => rpc('delete_featured_section', { p_id: id });
export async function getFeaturedItems(sectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('featured_section_items')
    .select('product_id, display_order')
    .eq('section_id', sectionId)
    .order('display_order');
  if (error) throw error;
  return (data as { product_id: string }[]).map((r) => r.product_id);
}

/* ── banners (app: every slot that shows a banner) ──────────────────────────── */
export type BannerPlacement = 'home' | 'search_hero' | 'search_trending' | 'search_promo' | 'search_hot';
export type Banner = {
  id: string;
  image_path: string | null;
  headline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  display_order: number;
  publish_state: 'draft' | 'published';
  placement: BannerPlacement;
};
export async function listBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('id, image_path, headline, cta_label, cta_url, display_order, publish_state, placement')
    .order('display_order');
  if (error) throw error;
  return data as Banner[];
}
export const upsertBanner = (p: {
  id?: string;
  image_path?: string | null;
  headline?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  display_order?: number;
  publish_state?: 'draft' | 'published';
  placement?: BannerPlacement;
}) =>
  rpc<{ id: string }>('upsert_banner', {
    p_id: p.id ?? undefined,
    p_image_path: p.image_path ?? undefined,
    p_headline: p.headline ?? undefined,
    p_cta_label: p.cta_label ?? undefined,
    p_cta_url: p.cta_url ?? undefined,
    p_display_order: p.display_order ?? 0,
    p_publish_state: p.publish_state ?? 'draft',
    p_placement: p.placement ?? 'home',
  });
export const deleteBanner = (id: string) => rpc('delete_banner', { p_id: id });
export const reorderBanners = (ids: string[]) => rpc('reorder_banners', { p_ids: ids });

/** Upload a banner image to the public bucket, return its public URL. */
export async function uploadBannerImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `banners/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

/* ── product images (upload to the public bucket, then register the row) ─────── */
export async function uploadProductImage(productId: string, file: File, isPrimary = false) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (upErr) throw upErr;
  const publicUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  return rpc<{ id: string }>('add_product_image', {
    p_product_id: productId,
    p_storage_path: publicUrl,
    p_is_primary: isPrimary,
  });
}
export const setPrimaryImage = (imageId: string) => rpc('set_primary_image', { p_image_id: imageId });
export const deleteProductImage = (imageId: string) => rpc('delete_product_image', { p_image_id: imageId });

export type ProductImage = { id: string; storage_path: string; is_primary: boolean; display_order: number };
export async function listProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, storage_path, is_primary, display_order')
    .eq('product_id', productId)
    .order('display_order');
  if (error) throw error;
  return data as ProductImage[];
}

export const adjustStock = (variantId: string, delta: number, note?: string) =>
  rpc<{ variant_id: string; stock_qty: number }>('adjust_stock', {
    p_variant_id: variantId,
    p_delta: delta,
    p_note: note ?? undefined,
  });

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

/* ── POS (on-site) ─────────────────────────────────────────────────────────── */

export type PosVariant = {
  id: string;
  size: string | null;
  price: number;
  stock_qty: number;
  barcode: string | null;
  sku: string | null;
};
export type PosProduct = {
  id: string;
  name: string;
  subtitle: string | null;
  category_id: string | null;
  category_name: string | null;
  image: string | undefined;
  variants: PosVariant[];
};

/** Published products + variants (with barcode + live stock) for the sell grid. */
export async function listPosCatalog(): Promise<PosProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, subtitle, category_id, categories(name), product_images(storage_path, is_primary), product_variants(id, size, price, stock_qty, barcode, sku, archived_at)',
    )
    .is('archived_at', null)
    .eq('publish_state', 'published')
    .order('name');
  if (error) throw error;
  type Row = {
    id: string;
    name: string;
    subtitle: string | null;
    category_id: string | null;
    categories: { name: string } | null;
    product_images: { storage_path: string; is_primary: boolean }[] | null;
    product_variants: (PosVariant & { archived_at?: string | null })[] | null;
  };
  return (data as unknown as Row[]).map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    category_id: p.category_id,
    category_name: p.categories?.name ?? null,
    image: productThumb(
      (p.product_images?.find((i) => i.is_primary) ?? p.product_images?.[0])?.storage_path,
      300,
    ),
    variants: (p.product_variants ?? []).filter((v) => !v.archived_at),
  }));
}

export type Shift = {
  id: string;
  opening_float: number;
  opened_at: string;
  closed_at: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  over_short: number | null;
};

export const openShift = (opening_float: number) =>
  rpc<Shift>('open_shift', { p_opening_float: opening_float });
export const closeShift = (id: string, counted: number) =>
  rpc<Shift>('close_shift', { p_shift_id: id, p_counted_cash: counted });

export async function getOpenShift(): Promise<Shift | null> {
  // Scope to the current cashier — create_pos_sale requires an open shift for
  // auth.uid(), so the UI must track this cashier's shift, not any shop shift.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('pos_shifts')
    .select('*')
    .eq('cashier_user_id', user.id)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Shift | null;
}

export type PosPayMethod = 'cash' | 'promptpay' | 'store_credit';
export type PosSaleInput = {
  client_op_id: string;
  items: { variant_id: string; qty: number; line_discount?: number }[];
  payment_method: PosPayMethod;
  cash_tendered?: number;
  discount?: number;
  customer_user_id?: string;
  customer_name?: string;
  customer_tax_id?: string;
  tax_invoice?: boolean;
  payments?: { method: 'cash' | 'promptpay'; amount: number }[]; // split tender
};
export type SaleResult = {
  id: string;
  sale_number: string;
  tax_invoice_no: string | null;
  subtotal: number;
  discount: number;
  total: number;
  vat_amount: number;
  net_amount: number;
  change: number;
  replay: boolean;
};

export type ShopInfo = {
  name: string;
  vat_registered: boolean;
  vat_rate: number;
  tax_id: string | null;
  branch_code: string;
  receipt_header: string | null;
  receipt_footer: string | null;
  promptpay_id: string | null;
  promptpay_name: string | null;
};

export async function getShopInfo(): Promise<ShopInfo> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select(
      'vat_registered, vat_rate, tax_id, branch_code, receipt_header, receipt_footer, shops(name, promptpay_id, promptpay_name)',
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const s = data as unknown as {
    vat_registered: boolean;
    vat_rate: number;
    tax_id: string | null;
    branch_code: string;
    receipt_header: string | null;
    receipt_footer: string | null;
    shops: { name: string; promptpay_id: string | null; promptpay_name: string | null } | null;
  } | null;
  return {
    name: s?.shops?.name ?? 'ร้านค้า',
    vat_registered: s?.vat_registered ?? false,
    vat_rate: Number(s?.vat_rate ?? 7),
    tax_id: s?.tax_id ?? null,
    branch_code: s?.branch_code ?? '00000',
    receipt_header: s?.receipt_header ?? null,
    receipt_footer: s?.receipt_footer ?? null,
    promptpay_id: s?.shops?.promptpay_id ?? null,
    promptpay_name: s?.shops?.promptpay_name ?? null,
  };
}

/* ── shop settings (owner-only write: delivery/online fee, VAT, PromptPay) ──── */
export type ShopSettingsFull = {
  name: string;
  promptpay_id: string | null;
  promptpay_name: string | null;
  delivery_fee: number;
  free_delivery_threshold: number;
  online_fee: number;
  online_free_threshold: number;
  cod_enabled: boolean;
  cod_cap: number | null;
  vat_registered: boolean;
  vat_rate: number;
  tax_id: string | null;
  branch_code: string;
  receipt_header: string | null;
  receipt_footer: string | null;
};

export async function getShopSettingsFull(): Promise<ShopSettingsFull> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select(
      'delivery_fee, free_delivery_threshold, online_fee, online_free_threshold, cod_enabled, cod_cap, vat_registered, vat_rate, tax_id, branch_code, receipt_header, receipt_footer, shops(name, promptpay_id, promptpay_name)',
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const s = data as unknown as {
    delivery_fee: number;
    free_delivery_threshold: number;
    online_fee: number;
    online_free_threshold: number;
    cod_enabled: boolean;
    cod_cap: number | null;
    vat_registered: boolean;
    vat_rate: number;
    tax_id: string | null;
    branch_code: string;
    receipt_header: string | null;
    receipt_footer: string | null;
    shops: { name: string; promptpay_id: string | null; promptpay_name: string | null } | null;
  } | null;
  return {
    name: s?.shops?.name ?? 'ร้านค้า',
    promptpay_id: s?.shops?.promptpay_id ?? null,
    promptpay_name: s?.shops?.promptpay_name ?? null,
    delivery_fee: s?.delivery_fee ?? 40,
    free_delivery_threshold: s?.free_delivery_threshold ?? 200,
    online_fee: s?.online_fee ?? 150,
    online_free_threshold: s?.online_free_threshold ?? 500,
    cod_enabled: s?.cod_enabled ?? true,
    cod_cap: s?.cod_cap ?? null,
    vat_registered: s?.vat_registered ?? false,
    vat_rate: Number(s?.vat_rate ?? 7),
    tax_id: s?.tax_id ?? null,
    branch_code: s?.branch_code ?? '00000',
    receipt_header: s?.receipt_header ?? null,
    receipt_footer: s?.receipt_footer ?? null,
  };
}

export const updateShopSettings = (p: ShopSettingsFull) =>
  rpc('update_shop_settings', {
    p_name: p.name,
    p_promptpay_id: p.promptpay_id,
    p_promptpay_name: p.promptpay_name,
    p_delivery_fee: p.delivery_fee,
    p_free_delivery_threshold: p.free_delivery_threshold,
    p_online_fee: p.online_fee,
    p_online_free_threshold: p.online_free_threshold,
    p_cod_enabled: p.cod_enabled,
    p_cod_cap: p.cod_cap,
    p_vat_registered: p.vat_registered,
    p_vat_rate: p.vat_rate,
    p_tax_id: p.tax_id,
    p_branch_code: p.branch_code,
    p_receipt_header: p.receipt_header,
    p_receipt_footer: p.receipt_footer,
  });

/* ── promo codes (owner-only write) ──────────────────────────────────────────── */
export type PromoType = 'percent' | 'fixed_baht';
export type PromoScope = 'subtotal' | 'delivery';
export type PromoCode = {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  max_discount: number | null;
  min_spend: number;
  scope: PromoScope;
  active_from: string | null;
  active_to: string | null;
  total_limit: number | null;
  per_user_limit: number | null;
  total_redeemed: number;
  active: boolean;
  created_at: string;
};

export async function listPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from('promo_codes')
    .select(
      'id, code, type, value, max_discount, min_spend, scope, active_from, active_to, total_limit, per_user_limit, total_redeemed, active, created_at',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PromoCode[];
}

export const upsertPromoCode = (p: {
  id?: string;
  code: string;
  type: PromoType;
  value: number;
  max_discount?: number | null;
  min_spend?: number;
  scope?: PromoScope;
  active_from?: string | null;
  active_to?: string | null;
  total_limit?: number | null;
  per_user_limit?: number | null;
  active?: boolean;
}) =>
  rpc<{ id: string }>('upsert_promo_code', {
    p_id: p.id ?? undefined,
    p_code: p.code,
    p_type: p.type,
    p_value: p.value,
    p_max_discount: p.max_discount ?? undefined,
    p_min_spend: p.min_spend ?? 0,
    p_scope: p.scope ?? 'subtotal',
    p_active_from: p.active_from ?? undefined,
    p_active_to: p.active_to ?? undefined,
    p_total_limit: p.total_limit ?? undefined,
    p_per_user_limit: p.per_user_limit ?? undefined,
    p_active: p.active ?? true,
  });

export const setPromoActive = (id: string, active: boolean) =>
  rpc('set_promo_active', { p_id: id, p_active: active });

export type Dashboard = {
  onsite: {
    count: number;
    gross: number;
    vat: number;
    net: number;
    discount: number;
    cash: number;
    promptpay: number;
    store_credit: number;
    refunds: number;
  };
  online: { count: number; gross: number };
  top: { name: string; qty: number; amount: number }[];
};

export const posDashboard = (fromIso: string, toIso: string) =>
  rpc<Dashboard>('pos_dashboard', { p_from: fromIso, p_to: toIso });

export type LowStockItem = { product_name: string; size: string | null; stock_qty: number; threshold: number };
export const listLowStock = () => rpc<LowStockItem[]>('low_stock_items', {});

export type PosSale = {
  id: string;
  sale_number: string;
  tax_invoice_no: string | null;
  total: number;
  vat_amount: number;
  net_amount: number;
  discount: number;
  payment_method: PosPayMethod;
  status: 'completed' | 'voided' | 'refunded';
  customer_name: string | null;
  customer_tax_id: string | null;
  cash_tendered: number | null;
  change: number | null;
  created_at: string;
};
export async function listPosSales(): Promise<PosSale[]> {
  const { data, error } = await supabase
    .from('pos_sales')
    .select(
      'id, sale_number, tax_invoice_no, total, vat_amount, net_amount, discount, payment_method, status, customer_name, customer_tax_id, cash_tendered, change, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as PosSale[];
}
export type PosSaleItem = { id: string; product_name: string; size: string | null; unit_price: number; qty: number; line_total: number };
export async function getPosSaleItems(saleId: string): Promise<PosSaleItem[]> {
  const { data, error } = await supabase
    .from('pos_sale_items')
    .select('id, product_name, size, unit_price, qty, line_total')
    .eq('sale_id', saleId);
  if (error) throw error;
  return data as PosSaleItem[];
}
export const refundPosSale = (saleId: string) => rpc<{ replay: boolean }>('refund_pos_sale', { p_sale_id: saleId });

/* ── store credit ────────────────────────────────────────────────────────────── */
export type Customer = { user_id: string; display_name: string | null; phone: string | null; balance: number };
export const findCustomerByPhone = (phone: string) =>
  rpc<Customer | null>('find_customer_by_phone', { p_phone: phone });
export const topupStoreCredit = (userId: string, amount: number, note?: string) =>
  rpc<{ balance: number }>('topup_store_credit', { p_user_id: userId, p_amount: amount, p_note: note ?? undefined });
export type CreditEntry = { id: string; delta: number; reason: string; created_at: string };
export const listStoreCredit = (userId: string) => rpc<CreditEntry[]>('list_store_credit', { p_user_id: userId });

export const createPosSale = (p: PosSaleInput) =>
  rpc<SaleResult>('create_pos_sale', {
    p_client_op_id: p.client_op_id,
    p_items: p.items,
    p_payment_method: p.payment_method,
    p_cash_tendered: p.cash_tendered ?? undefined,
    p_discount: p.discount ?? 0,
    p_customer_user_id: p.customer_user_id ?? undefined,
    p_customer_name: p.customer_name ?? undefined,
    p_customer_tax_id: p.customer_tax_id ?? undefined,
    p_tax_invoice: p.tax_invoice ?? false,
    p_payments: p.payments ?? undefined,
  });

/* ── Stock workspace (สต๊อก) ───────────────────────────────────────────────── */
export type StockMovement = {
  id: string;
  created_at: string;
  reason: string;
  delta_stock: number;
  delta_reserved: number;
  variant_id: string;
  size: string | null;
  product_name: string;
  order_number: string | null;
  actor_name: string | null;
};

/** Ledger page, newest first; pass `before` (created_at) to page further back. */
export async function listStockMovements(
  limit = 200,
  before?: { created_at: string; id: string },
  variantId?: string,
): Promise<StockMovement[]> {
  let q = supabase
    .from('stock_movements_view')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (before) {
    // Compound cursor, not just created_at: several stock_movements rows from
    // one POS sale (or a batch stock import) share the exact same created_at
    // (Postgres now() is transaction-start time, identical for every insert
    // in that transaction) — a plain `created_at < X` cursor silently drops
    // any row tied with the last row of the previous page.
    q = q.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  }
  if (variantId) q = q.eq('variant_id', variantId);
  const { data, error } = await q;
  if (error) throw error;
  return data as StockMovement[];
}

/** Goods-in: adds qty to a variant with its own 'receive' ledger reason. */
export const receiveStock = (variantId: string, qty: number, note?: string) =>
  rpc<{ variant_id: string; stock_qty: number }>('receive_stock', {
    p_variant_id: variantId,
    p_qty: qty,
    p_note: note ?? undefined,
  });


/** Absolute set (stock count / import) — ledgers the computed difference. */
export const setStockQty = (variantId: string, qty: number, note?: string) =>
  rpc<{ variant_id: string; stock_qty: number; delta: number }>('set_stock_qty', {
    p_variant_id: variantId,
    p_qty: qty,
    p_note: note ?? undefined,
  });

/* ── audit log (owner-only read — write_audit() has been recording since
   0006; this is the first viewer) ────────────────────────────────────────── */
export type AuditLogEntry = {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  actor_tier: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  summary: string | null;
  reason: string | null;
  created_at: string;
  app_users: { display_name: string | null } | null;
};

export async function listAuditLog(
  limit = 100,
  before?: { created_at: string; id: string },
): Promise<AuditLogEntry[]> {
  let q = supabase
    .from('audit_log')
    .select(
      'id, actor_user_id, actor_role, actor_tier, action, target_table, target_id, summary, reason, created_at, app_users(display_name)',
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (before) {
    // Compound cursor — see listStockMovements for why created_at alone isn't
    // enough (several rows can share the exact same now()).
    q = q.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as AuditLogEntry[];
}
