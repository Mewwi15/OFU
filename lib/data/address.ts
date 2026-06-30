/**
 * Address repository — mirror the locally-selected delivery address into the
 * `addresses` table (owner-RLS write) so `place_order` can reference a real
 * `address_id`. Dedupes on (user, phone, line) to avoid piling up duplicates.
 */

import { supabase } from '@/lib/supabase/client';
import type { Address } from '@/store/address';

/** Ensure `addr` exists in the DB for the signed-in user; return its row id. */
export async function ensureRemoteAddress(addr: Address): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('UNAUTHENTICATED');
  const userId = auth.user.id;

  const { data: existing } = await supabase
    .from('addresses')
    .select('id')
    .eq('user_id', userId)
    .eq('recipient_phone', addr.phone)
    .eq('address_line', addr.line)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      label: addr.label,
      recipient_name: addr.recipient,
      recipient_phone: addr.phone,
      address_line: addr.line,
      subdistrict: addr.subDistrict ?? null,
      district: addr.district ?? null,
      province: addr.province ?? null,
      postal_code: addr.postalCode ?? null,
      lat: addr.lat,
      lng: addr.lng,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
