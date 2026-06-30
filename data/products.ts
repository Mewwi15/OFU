/**
 * อู้ฟู่ catalog view-model types.
 *
 * The `Product`/`ProductVariant` shapes are what screens, stores, and product
 * components consume. The data itself is loaded from Supabase by
 * `lib/data/catalog.ts` into `store/catalog.ts` (the old mock array was removed
 * once the app was wired to the backend). `categories` is the static filter-chip
 * list shown in the UI.
 */

export type ProductCategory =
  | 'ของสด'
  | 'เครื่องดื่ม'
  | 'ของแห้ง'
  | 'ของใช้ในบ้าน'
  | 'ขนม'
  | 'ยา';

/** A purchasable size of a product (carries the variant id the cart/order need). */
export type ProductVariant = {
  /** product_variants.id (uuid) — the key cart/place_order operate on. */
  id: string;
  /** Size label, e.g. "1 กก." (null = the product's single default variant). */
  size: string | null;
  /** Price in Baht for this size. */
  price: number;
  /** Sellable quantity (stock − reserved). */
  available: number;
};

export type Product = {
  id: string;
  /** Display name, e.g. "ข้าวหอมมะลิ". */
  name: string;
  /** Short tagline, e.g. "หอม นุ่ม คัดพิเศษ". */
  subtitle: string;
  /** 1-2 sentence longer description (for the details page "Read More"). */
  description: string;
  /** "From" price (the cheapest variant), in Baht. */
  price: number;
  /** Rating from 0..5. */
  rating: number;
  /** Remote image URIs (first is the primary/grid image). */
  images: string[];
  /** Hex color swatches. */
  colors: string[];
  /** Available sizes (labels, derived from `variants`). */
  sizes: string[];
  /** Purchasable variants (≥1; carries ids + per-size price/stock). */
  variants: ProductVariant[];
  category: ProductCategory;
};

/** Category filter list for the chip rows. 'ทั้งหมด' is the All filter. */
export const categories = [
  'ทั้งหมด',
  'ของสด',
  'เครื่องดื่ม',
  'ของแห้ง',
  'ของใช้ในบ้าน',
  'ขนม',
  'ยา',
] as const;

export type Category = (typeof categories)[number];
