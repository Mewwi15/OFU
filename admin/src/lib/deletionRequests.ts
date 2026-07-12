/**
 * Account-deletion requests (0047) — the customer files a request in-app
 * (store-compliance path); the owner deletes the auth user in the Supabase
 * dashboard and marks the request done here.
 */

import { supabase } from './supabase';

export type DeletionRequest = {
  id: string;
  email_snapshot: string | null;
  status: 'pending' | 'done' | 'cancelled';
  requested_at: string;
  processed_at: string | null;
};

/** All requests, pending first then newest (RLS: admin sees all). */
export async function listDeletionRequests(): Promise<DeletionRequest[]> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('id, email_snapshot, status, requested_at, processed_at')
    .order('requested_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = data as unknown as DeletionRequest[];
  return [...rows.filter((r) => r.status === 'pending'), ...rows.filter((r) => r.status !== 'pending')];
}

/** Mark a pending request done (after deleting the auth user in the dashboard). */
export async function completeDeletionRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc('complete_deletion_request', { p_id: id });
  if (error) throw error;
}
