/**
 * Address book store (zustand).
 *
 * Holds the customer's saved delivery addresses and which one is currently
 * selected for checkout. Each address pairs a human-readable line (from the map
 * pin's reverse-geocode, editable) with the exact pin coordinates. The cart
 * reads `selectedAddress` in delivery mode; the map picker calls `upsert`.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type Address = {
  id: string;
  /** Short tag, e.g. "บ้าน" / "ที่ทำงาน". */
  label: string;
  recipient: string;
  phone: string;
  /** Human-readable address line (reverse-geocoded, then editable). */
  line: string;
  /** Optional extra detail — house no. / floor / landmark. */
  detail?: string;
  /** Pin coordinates. */
  lat: number;
  lng: number;

  /* Structured postal parts — required to ship a parcel via Flash Express
     (online mode). Auto-filled from the reverse-geocode, then editable.
     Optional because a delivery (rider) address only needs the pin + line. */
  /** ตำบล / แขวง */
  subDistrict?: string;
  /** อำเภอ / เขต */
  district?: string;
  /** จังหวัด */
  province?: string;
  /** รหัสไปรษณีย์ (5 หลัก) */
  postalCode?: string;
};

/** A draft passed to `upsert` — `id` present means edit, absent means create. */
export type AddressDraft = Omit<Address, 'id'> & { id?: string };

export type AddressState = {
  addresses: Address[];
  selectedId: string | null;
  /** Create (no id) or update (with id). Returns the resulting address id. */
  upsert: (draft: AddressDraft) => string;
  remove: (id: string) => void;
  select: (id: string) => void;
};

/** Default seed so the cart/home have a sensible delivery address out of the box. */
const SEED: Address = {
  id: 'a1',
  label: 'บ้าน',
  recipient: 'คุณลูกค้า',
  phone: '080-000-0000',
  line: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  detail: '',
  lat: 13.7236,
  lng: 100.5686,
  subDistrict: 'คลองเตย',
  district: 'คลองเตย',
  province: 'กรุงเทพมหานคร',
  postalCode: '10110',
};

/** Monotonic id generator (avoids Date.now/Math.random for deterministic tests). */
let seq = 1;
const nextId = () => `addr-${++seq}`;

export const useAddress = create<AddressState>()(
  persist(
    (set) => ({
      addresses: [SEED],
      selectedId: SEED.id,

      upsert: (draft) => {
    const id = draft.id ?? nextId();
    set((state) => {
      const exists = state.addresses.some((a) => a.id === id);
      const next: Address = { ...draft, id };
      return {
        addresses: exists
          ? state.addresses.map((a) => (a.id === id ? next : a))
          : [...state.addresses, next],
        // Auto-select a freshly added address.
        selectedId: exists ? state.selectedId : id,
      };
    });
    return id;
  },

  remove: (id) =>
    set((state) => {
      const addresses = state.addresses.filter((a) => a.id !== id);
      const selectedId =
        state.selectedId === id ? (addresses[0]?.id ?? null) : state.selectedId;
      return { addresses, selectedId };
    }),

      select: (id) => set({ selectedId: id }),
    }),
    {
      name: 'oofoo-address',
      storage: zustandStorage,
      partialize: (state) => ({
        addresses: state.addresses,
        selectedId: state.selectedId,
      }),
    },
  ),
);

/** The currently selected address (or undefined if none / empty book). */
export function selectedAddress(state: AddressState): Address | undefined {
  return state.addresses.find((a) => a.id === state.selectedId);
}

/**
 * Whether an address carries enough structured detail to print a Flash Express
 * parcel label (online mode). Requires a recipient, phone, province and a
 * 5-digit postcode — the rider (delivery) flow does NOT need these.
 */
export function hasParcelInfo(a?: Address): boolean {
  return !!(
    a &&
    a.recipient.trim() &&
    a.phone.trim() &&
    a.province?.trim() &&
    /^\d{5}$/.test(a.postalCode ?? '')
  );
}
