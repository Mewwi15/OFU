/**
 * Cart store (zustand).
 *
 * A cart line is keyed by `productId + size` so the same product in two
 * different sizes occupies two lines. `add` merges quantity into an existing
 * matching line. `subtotal`/`count` are derived via the exported helpers
 * (`cartSubtotal` / `cartCount`) so consumers can compute them from the
 * current `items` array without storing redundant state.
 *
 * ★ ตะกร้าแยกใบตามโหมด ★ (เจ้าของสั่ง 4 ก.ย. 2026 "อยากให้มีหน้าตะกร้า 2 หน้าแยก
 * ระหว่าง Delivery กับ ONLINE") — เดลิเวอรี่ส่งด้วยไรเดอร์ในพื้นที่ ออนไลน์ส่งพัสดุทั่วไทย
 * คนละค่าส่ง คนละวิธีจ่าย ตะกร้าใบเดียวทำให้ของที่ใส่ไว้ตอนอยู่โหมดหนึ่งไหลไปโผล่ในอีก
 * โหมดโดยที่ค่าส่งเปลี่ยนไปหมดแล้ว
 *
 * `items` / `selectedIds` ยังเป็น "ใบที่กำลังใช้อยู่" เหมือนเดิมทุกประการ — ที่เรียกใช้
 * ทั้งแอป (ตะกร้า จ่ายเงิน ป้ายนับบนไอคอน การ์ดสินค้า) จึงไม่ต้องแก้อะไรเลย ตัวสโตร์
 * สลับใบให้เองเมื่อโหมดเปลี่ยน โดยฟังจาก useMode ที่ท้ายไฟล์
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import type { Product } from '@/data/products';
import { useMode, type ShopMode } from '@/store/mode';

export type CartItem = {
  /** Stable line id = `${product.id}-${size ?? 'default'}`. */
  id: string;
  product: Product;
  qty: number;
  size?: string;
  color?: string;
  /** product_variants.id — what the cart/place_order RPCs key on (Stage 2). */
  variantId: string;
  /** Snapshot of the chosen variant's price (the line's true unit price). */
  unitPrice: number;
};

export type AddOptions = {
  size?: string;
  color?: string;
  qty?: number;
};

/** ตะกร้าหนึ่งใบ */
export type Basket = { items: CartItem[]; selectedIds: string[] };

const EMPTY: Basket = { items: [], selectedIds: [] };

export type CartState = {
  /** โหมดของใบที่กำลังใช้อยู่ — ตามหลัง useMode */
  mode: ShopMode;
  /** ทุกใบ เก็บแยกตามโหมด */
  carts: Record<ShopMode, Basket>;
  /**
   * ของเก่าจากยุคตะกร้าใบเดียว ที่ยังไม่รู้ว่าเป็นของโหมดไหน
   *
   * ตอนย้ายรูปแบบข้อมูล เราไม่รู้ว่าลูกค้าใส่ของไว้ตอนอยู่โหมดอะไร (ข้อมูลเดิมไม่ได้เก็บไว้)
   * และจะไปอ่านจาก useMode ตอนนั้นก็ไม่ได้ เพราะสองสโตร์กู้ข้อมูลจากเครื่องแบบไม่พร้อมกัน
   * จึงพักไว้ตรงนี้ก่อน แล้วเทลงใบของโหมดจริงทันทีที่รู้ — ★ ห้ามทิ้ง ★ ของหายจากตะกร้า
   * ต่อหน้าลูกค้าเป็นเรื่องใหญ่กว่าการย้ายรูปแบบข้อมูลผิดใบ
   */
  legacy: CartItem[];
  items: CartItem[];
  /** Line ids currently ticked for checkout (Shopee-style selection). */
  selectedIds: string[];
  /** สลับใบตามโหมด (เรียกจากตัวฟัง useMode ท้ายไฟล์ ไม่ต้องเรียกเอง) */
  switchMode: (mode: ShopMode) => void;
  /** Add a product (merges qty into a matching size line if one exists). */
  add: (product: Product, opts?: AddOptions) => void;
  /** Remove a line by its line id. */
  remove: (id: string) => void;
  /** Set the quantity of a line. A qty <= 0 removes the line. */
  setQty: (id: string, qty: number) => void;
  /** Toggle whether a line is ticked for checkout. */
  toggleSelect: (id: string) => void;
  /** Select every line (true) or none (false). */
  selectAll: (select: boolean) => void;
  /** Remove every ticked line (used after checkout / "ลบที่เลือก"). */
  removeSelected: () => void;
  /** Empty the cart. */
  clear: () => void;
  /** Wipe the signed-out customer's cart (see store/session.ts). */
  reset: () => void;
};

/** Build the stable line id for a product + chosen size. */
export function cartItemId(productId: string, size?: string): string {
  return `${productId}-${size ?? 'default'}`;
}

/** The variant matching a chosen size (falls back to the first/cheapest). */
function resolveVariant(product: Product, size?: string) {
  const match = size ? product.variants.find((v) => v.size === size) : undefined;
  return match ?? product.variants[0];
}

/** Sum of unit price * qty across all cart lines. */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce(
    (total, item) => total + (item.unitPrice ?? item.product.price) * item.qty,
    0,
  );
}

/** Total number of units across all cart lines. */
export function cartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.qty, 0);
}

/** Only the lines whose id is in `selectedIds`. */
export function selectedItems(items: CartItem[], selectedIds: string[]): CartItem[] {
  const set = new Set(selectedIds);
  return items.filter((item) => set.has(item.id));
}

/**
 * เขียนลงใบที่กำลังใช้อยู่ แล้วอัปเดตกระจก (`items`/`selectedIds`) ในคราวเดียว
 *
 * ทุก action ต้องผ่านตัวนี้ — ที่เรียกใช้ทั้งแอปอ่านจาก `items` ถ้ามี action ไหนเขียนลง
 * `carts` ตรง ๆ โดยลืมอัปเดตกระจก หน้าจอจะไม่ขยับทั้งที่ข้อมูลเปลี่ยนแล้ว
 */
function apply(state: CartState, fn: (basket: Basket) => Basket): Partial<CartState> {
  const next = fn(state.carts[state.mode]);
  return {
    carts: { ...state.carts, [state.mode]: next },
    items: next.items,
    selectedIds: next.selectedIds,
  };
}

/** เทของเก่าจากตะกร้าใบเดียวลงใบของโหมดที่รู้แล้ว (ทำครั้งเดียว) */
function drainLegacy(state: CartState, mode: ShopMode): Partial<CartState> {
  if (state.legacy.length === 0) return {};
  const basket = state.carts[mode];
  /* รวมกับของที่มีอยู่ในใบนั้น ไม่ใช่เขียนทับ — ถ้าลูกค้าใส่ของใหม่ไปแล้วก่อนเทของเก่าลง
     การเขียนทับจะทำให้ของใหม่หาย */
  const keep = new Set(basket.items.map((i) => i.id));
  const merged = [...basket.items, ...state.legacy.filter((i) => !keep.has(i.id))];
  return {
    legacy: [],
    carts: {
      ...state.carts,
      [mode]: { items: merged, selectedIds: merged.map((i) => i.id) },
    },
  };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      mode: 'delivery',
      carts: { delivery: EMPTY, online: EMPTY },
      legacy: [],
      items: [],
      selectedIds: [],

      switchMode: (mode) =>
        set((state) => {
          const patch = drainLegacy(state, mode);
          const carts = patch.carts ?? state.carts;
          const basket = carts[mode];
          return { ...patch, mode, items: basket.items, selectedIds: basket.selectedIds };
        }),

      add: (product, opts) =>
        set((state) =>
          apply(state, (basket) => {
            const qty = Math.max(1, opts?.qty ?? 1);
            const variant = resolveVariant(product, opts?.size);
            // Use the resolved variant's size as the line's size (so a sizeless
            // product with a single default variant lands on one stable line).
            const size = variant?.size ?? undefined;
            const color = opts?.color ?? product.colors[0];
            const id = cartItemId(product.id, size);

            // Newly added lines start ticked for checkout.
            const selectedIds = basket.selectedIds.includes(id)
              ? basket.selectedIds
              : [...basket.selectedIds, id];

            const existing = basket.items.find((item) => item.id === id);
            if (existing) {
              return {
                selectedIds,
                items: basket.items.map((item) =>
                  item.id === id ? { ...item, qty: item.qty + qty } : item,
                ),
              };
            }

            const line: CartItem = {
              id,
              product,
              qty,
              size,
              color,
              variantId: variant?.id ?? '',
              unitPrice: variant?.price ?? product.price,
            };
            return { selectedIds, items: [...basket.items, line] };
          }),
        ),

      remove: (id) =>
        set((state) =>
          apply(state, (b) => ({
            items: b.items.filter((item) => item.id !== id),
            selectedIds: b.selectedIds.filter((sid) => sid !== id),
          })),
        ),

      setQty: (id, qty) =>
        set((state) =>
          apply(state, (b) => {
            if (qty <= 0) {
              return {
                items: b.items.filter((item) => item.id !== id),
                selectedIds: b.selectedIds.filter((sid) => sid !== id),
              };
            }
            return {
              items: b.items.map((item) => (item.id === id ? { ...item, qty } : item)),
              selectedIds: b.selectedIds,
            };
          }),
        ),

      toggleSelect: (id) =>
        set((state) =>
          apply(state, (b) => ({
            items: b.items,
            selectedIds: b.selectedIds.includes(id)
              ? b.selectedIds.filter((sid) => sid !== id)
              : [...b.selectedIds, id],
          })),
        ),

      selectAll: (select) =>
        set((state) =>
          apply(state, (b) => ({
            items: b.items,
            selectedIds: select ? b.items.map((item) => item.id) : [],
          })),
        ),

      removeSelected: () =>
        set((state) =>
          apply(state, (b) => {
            const drop = new Set(b.selectedIds);
            return { items: b.items.filter((item) => !drop.has(item.id)), selectedIds: [] };
          }),
        ),

      clear: () => set((state) => apply(state, () => EMPTY)),

      /* ล้างทุกใบ ไม่ใช่แค่ใบที่ใช้อยู่ — ใช้ตอนลูกค้าออกจากระบบ ของในตะกร้าอีกใบ
         ต้องไม่ค้างไว้ให้คนถัดไปที่ล็อกอินบนเครื่องเดียวกันเห็น */
      reset: () =>
        set({
          carts: { delivery: EMPTY, online: EMPTY },
          legacy: [],
          items: [],
          selectedIds: [],
        }),
    }),
    {
      name: 'oofoo-cart',
      /* v3: แยกตะกร้าเป็นใบต่อโหมด — ของเดิมเป็นใบเดียว ย้ายมาพักที่ legacy ไว้ก่อน
         (v2: lines carry variantId/unitPrice and product ids are DB uuids) */
      version: 3,
      migrate: (persisted, version) => {
        const base = {
          mode: 'delivery' as ShopMode,
          carts: { delivery: EMPTY, online: EMPTY },
          legacy: [] as CartItem[],
        };
        // ก่อน v2 = ยุคก่อนต่อฐานข้อมูล ทิ้งได้ ไอดีสินค้าคนละชุดกันเลย
        if (version < 2) return base;
        const old = persisted as { items?: CartItem[] } | undefined;
        return { ...base, legacy: old?.items ?? [] };
      },
      storage: zustandStorage,
      partialize: (state) => ({
        mode: state.mode,
        carts: state.carts,
        legacy: state.legacy,
      }),
      /* กู้ข้อมูลเสร็จแล้วต้องตั้งกระจกให้ตรงกับใบที่กู้มา — persist เขียนแค่ carts/mode
         กลับเข้ามา ส่วน items/selectedIds ยังเป็นค่าเริ่มต้นว่าง ๆ อยู่ ถ้าไม่ตั้งตรงนี้
         ลูกค้าเปิดแอปมาจะเห็นตะกร้าว่างทั้งที่ของยังอยู่ */
      onRehydrateStorage: () => (state) => {
        /* ★ เอาโหมดจาก useMode ไม่ใช่จากที่ตัวเองกู้มา ★ สองสโตร์กู้ข้อมูลจากเครื่อง
           คนละจังหวะกัน ถ้า useMode กู้เสร็จไปก่อนที่ไฟล์นี้จะไปสมัครฟัง เราจะไม่ได้รับแจ้ง
           การเปลี่ยนแปลงนั้นเลย แล้วตะกร้าจะค้างอยู่ที่โหมดตั้งต้นทั้งที่แอปอยู่อีกโหมด
           (เจอมาแล้ว: อยู่โหมดออนไลน์แต่ของไปเข้าใบเดลิเวอรี่ ตะกร้าสองใบเลยดูเหมือน
           ใบเดียวกัน) */
        state?.switchMode(useMode.getState().mode);
      },
    },
  ),
);

/**
 * ตะกร้าตามหลังโหมด — ฟังจาก useMode ที่เดียว
 *
 * ไม่ให้แต่ละหน้าจอเรียก switchMode เอง เพราะโหมดถูกเปลี่ยนได้จากหลายที่ (การ์ดหน้าแรก
 * จอเตรียมพร้อมของสองโหมด แผ่นเลือกโหมดตอนกดสินค้าขายดี) ถ้าใครลืมเรียกสักที่เดียว
 * ลูกค้าจะเห็นตะกร้าของอีกโหมดโดยไม่รู้ตัว
 */
useMode.subscribe((s) => {
  if (s.mode !== useCart.getState().mode) useCart.getState().switchMode(s.mode);
});

/* จับให้ตรงตั้งแต่วินาทีแรกด้วย — คู่กับ onRehydrateStorage ข้างบน ครอบทั้งสองลำดับ
   ที่เป็นไปได้: โหมดกู้เสร็จก่อน (บรรทัดนี้จับได้) หรือตะกร้ากู้เสร็จก่อน (ตัวฟังจับได้) */
{
  const current = useMode.getState().mode;
  if (current !== useCart.getState().mode) useCart.getState().switchMode(current);
}
