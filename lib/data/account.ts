/**
 * Account lifecycle — the request-based deletion flow (0047).
 *
 * Deletion is NOT self-service (owner decision, 0040): the customer files a
 * request in-app (App Store 5.1.1(v) requires in-app initiation), the shop
 * deletes the auth user manually within the promised window. The request also
 * lands in the customer's chat thread so the owner sees it where they already
 * look.
 */

import { supabase } from '@/lib/supabase/client';

/** Whether the signed-in customer has an open deletion request. */
export async function hasPendingDeletionRequest(): Promise<boolean> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('id')
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/** File (or re-confirm) the deletion request. Idempotent. */
export async function requestAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('request_account_deletion');
  if (error) throw error;
}

/** Withdraw the open deletion request. */
export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_account_deletion_request');
  if (error) throw error;
}
