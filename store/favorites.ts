/**
 * สินค้าโปรด (zustand) — ตาราง `favorites` (0101)
 *
 * เจ้าของสั่ง 5 ก.ย. 2026 ให้แถบล่างของโหมดออนไลน์มีเมนู "สินค้าโปรด"
 *
 * ★ กดแล้วเปลี่ยนทันที ไม่รอเซิร์ฟเวอร์ ★ ปุ่มหัวใจต้องตอบสนองในเฟรมเดียว — รอ
 * เซิร์ฟเวอร์ตอบก่อนค่อยเปลี่ยนสี ทำให้รู้สึกว่าแอปหน่วง และคนจะกดซ้ำเพราะนึกว่าไม่ติด
 * ถ้าเซิร์ฟเวอร์ปฏิเสธ ค่อยย้อนกลับ (ของโปรดไม่ใช่เงิน ผิดพลาดชั่วครู่ไม่เสียหาย)
 *
 * เก็บเป็นชุด id ไม่ใช่ชุดสินค้าเต็ม — การ์ดสินค้าทุกใบต้องถามว่า "ใบนี้โปรดไหม" ตลอดเวลา
 * เทียบ id เร็วและไม่ต้องกังวลว่าข้อมูลสินค้าที่แคชไว้จะเก่า ตัวสินค้าจริงอ่านจาก catalog
 */

import { create } from 'zustand';

import { addFavorite, listFavoriteIds, removeFavorite } from '@/lib/data/favorites';

export type FavoritesState = {
  ids: string[];
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  /** สลับสถานะของโปรด คืน true ถ้าผลลัพธ์คือ "เป็นของโปรด" */
  toggle: (productId: string) => Promise<boolean>;
  has: (productId: string) => boolean;
  /** ล้างตอนลูกค้าออกจากระบบ (ดู store/session.ts) */
  reset: () => void;
};

export const useFavorites = create<FavoritesState>((set, get) => ({
  ids: [],
  loaded: false,

  load: async (force = false) => {
    if (get().loaded && !force) return;
    try {
      set({ ids: await listFavoriteIds(), loaded: true });
    } catch {
      /* ยังไม่ล็อกอิน/เน็ตหลุด — ปล่อยว่างไว้ หน้าที่ใช้จะโชว์สถานะว่างของตัวเอง
         ไม่ตั้ง loaded เพื่อให้ลองใหม่ได้ตอนกลับเข้าหน้า */
    }
  },

  toggle: async (productId) => {
    const wasFav = get().ids.includes(productId);
    const next = wasFav ? get().ids.filter((id) => id !== productId) : [productId, ...get().ids];
    set({ ids: next });
    try {
      if (wasFav) await removeFavorite(productId);
      else await addFavorite(productId);
      return !wasFav;
    } catch {
      // ย้อนกลับให้ตรงกับความจริง ไม่ปล่อยให้หัวใจค้างผิดสถานะ
      set({ ids: get().ids.includes(productId) ? get().ids.filter((id) => id !== productId) : [productId, ...get().ids] });
      return wasFav;
    }
  },

  has: (productId) => get().ids.includes(productId),

  reset: () => set({ ids: [], loaded: false }),
}));
