/**
 * Address repository — the customer's address book in the `addresses` table
 * (owner-RLS direct read/write). Maps the DB row onto the app's `Address`.
 */

import { supabase } from '@/lib/supabase/client';
import type { Address, AddressDraft } from '@/store/address';

type Row = {
  id: string;
  label: string | null;
  recipient_name: string;
  recipient_phone: string;
  address_line: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  is_default: boolean;
};

const SELECT =
  'id, label, recipient_name, recipient_phone, address_line, note, lat, lng, subdistrict, district, province, postal_code, is_default';

function toAddress(r: Row): Address {
  return {
    id: r.id,
    label: r.label ?? 'ที่อยู่',
    recipient: r.recipient_name,
    phone: r.recipient_phone,
    line: r.address_line,
    detail: r.note ?? undefined,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    subDistrict: r.subdistrict ?? undefined,
    district: r.district ?? undefined,
    province: r.province ?? undefined,
    postalCode: r.postal_code ?? undefined,
  };
}

function toRow(d: AddressDraft, userId: string) {
  return {
    user_id: userId,
    label: d.label,
    recipient_name: d.recipient,
    recipient_phone: d.phone,
    address_line: d.line,
    note: d.detail ?? null,
    lat: d.lat,
    lng: d.lng,
    subdistrict: d.subDistrict ?? null,
    district: d.district ?? null,
    province: d.province ?? null,
    postal_code: d.postalCode ?? null,
  };
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('UNAUTHENTICATED');
  return data.user.id;
}

export async function listAddresses(): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select(SELECT)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toAddress);
}

/** Insert (no id) or update (with id) and return the saved address. */
export async function upsertAddress(draft: AddressDraft): Promise<Address> {
  const userId = await uid();
  const row = toRow(draft, userId);
  if (draft.id) {
    const { data, error } = await supabase
      .from('addresses')
      .update(row)
      .eq('id', draft.id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return toAddress(data as Row);
  }
  const { data, error } = await supabase.from('addresses').insert(row).select(SELECT).single();
  if (error) throw error;
  return toAddress(data as Row);
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) throw error;
}
