import { supabase } from './supabase';

/** Surface a Postgres RAISE code (or PostgREST message) for the UI. */
export function apiError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? 'เกิดข้อผิดพลาด';
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

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, subtitle, description, brand, rating, publish_state, archived_at, category_id, row_version, orderable_delivery, orderable_online, categories(name), product_variants(id, size, price, stock_qty, reserved_qty, available_qty, low_stock_threshold, sku, barcode, cost_price, unit, archived_at), product_images(id, storage_path, is_primary)',
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Hide archived (retired size) variants — 1 product = 1 live stock row.
  return (data as unknown as Product[]).map((p) => ({
    ...p,
    product_variants: p.product_variants.filter((v) => !v.archived_at),
  }));
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
  image: string | null;
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
    image:
      (p.product_images?.find((i) => i.is_primary) ?? p.product_images?.[0])?.storage_path ?? null,
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
  created_at: string;
};
export async function listPosSales(): Promise<PosSale[]> {
  const { data, error } = await supabase
    .from('pos_sales')
    .select('id, sale_number, tax_invoice_no, total, vat_amount, net_amount, discount, payment_method, status, customer_name, created_at')
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
export async function listStockMovements(limit = 200, before?: string): Promise<StockMovement[]> {
  let q = supabase
    .from('stock_movements_view')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
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
