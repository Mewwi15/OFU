/**
 * Store credit — read-only for the customer. Credit is granted/spent only at
 * the till (POS top-up, or as change/refund) — there is no way to spend it
 * on an online order yet (payment_method_t only has promptpay_slip/cod).
 * This just lets a customer see what they have.
 */

import { supabase } from '@/lib/supabase/client';

export type StoreCreditReason = 'topup' | 'pos_sale' | 'pos_refund';

export type StoreCreditEntry = {
  id: string;
  delta: number;
  reason: StoreCreditReason | string;
  createdAt: string;
};

export type MyStoreCredit = {
  balance: number;
  entries: StoreCreditEntry[];
};

type Row = { id: string; delta: number; reason: string; created_at: string };

export async function listMyStoreCredit(): Promise<MyStoreCredit> {
  const { data, error } = await supabase.rpc('list_my_store_credit');
  if (error) throw error;
  const d = data as { balance: number; entries: Row[] };
  return {
    balance: d.balance ?? 0,
    entries: (d.entries ?? []).map((e) => ({
      id: e.id,
      delta: e.delta,
      reason: e.reason,
      createdAt: e.created_at,
    })),
  };
}
