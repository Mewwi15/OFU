/**
 * Address book store (zustand) — backed by the `addresses` table via the address
 * repository. The list is loaded from the backend; only the current selection id
 * is persisted locally. The cart reads `selectedAddress` in delivery mode; the
 * map picker calls `upsert`.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteAddress, listAddresses, upsertAddress } from '@/lib/data/address';
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

  /* Structured postal parts — required to ship a parcel nationwide. */
  subDistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
};

/** A draft passed to `upsert` — `id` present means edit, absent means create. */
export type AddressDraft = Omit<Address, 'id'> & { id?: string };

export type AddressState = {
  addresses: Address[];
  selectedId: string | null;
  loading: boolean;
  loaded: boolean;
  /** Load the address book from the backend. */
  load: (force?: boolean) => Promise<void>;
  /** Create (no id) or update (with id) on the backend. Returns the address id. */
  upsert: (draft: AddressDraft) => Promise<string>;
  remove: (id: string) => Promise<void>;
  select: (id: string) => void;
};

export const useAddress = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: [],
      selectedId: null,
      loading: false,
      loaded: false,

      load: async (force = false) => {
        if (get().loading) return;
        if (get().loaded && !force) return;
        set({ loading: true });
        try {
          const addresses = await listAddresses();
          set((state) => ({
            addresses,
            loaded: true,
            loading: false,
            // keep a valid selection (or default to the first address)
            selectedId:
              state.selectedId && addresses.some((a) => a.id === state.selectedId)
                ? state.selectedId
                : (addresses[0]?.id ?? null),
          }));
        } catch {
          set({ loading: false });
        }
      },

      upsert: async (draft) => {
        const saved = await upsertAddress(draft);
        const isNew = !draft.id;
        set((state) => ({
          addresses: state.addresses.some((a) => a.id === saved.id)
            ? state.addresses.map((a) => (a.id === saved.id ? saved : a))
            : [...state.addresses, saved],
          selectedId: isNew ? saved.id : state.selectedId,
        }));
        return saved.id;
      },

      remove: async (id) => {
        await deleteAddress(id);
        set((state) => {
          const addresses = state.addresses.filter((a) => a.id !== id);
          return {
            addresses,
            selectedId: state.selectedId === id ? (addresses[0]?.id ?? null) : state.selectedId,
          };
        });
      },

      select: (id) => set({ selectedId: id }),
    }),
    {
      name: 'oofoo-address',
      storage: zustandStorage,
      // Only the selection is persisted; the list always comes from the backend.
      partialize: (state) => ({ selectedId: state.selectedId }),
    },
  ),
);

/** The currently selected address (or undefined if none / empty book). */
export function selectedAddress(state: AddressState): Address | undefined {
  return state.addresses.find((a) => a.id === state.selectedId);
}

/**
 * Whether an address carries enough structured detail to ship a nationwide
 * parcel (online mode): recipient, phone, province and a 5-digit postcode.
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
