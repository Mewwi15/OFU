/**
 * Shop repository — load the merchant profile (name + PromptPay) and today's
 * operating hours from the backend (public-read behind RLS).
 */

import { DEFAULT_SHOP, type ShopInfo } from '@/data/shop';
import { supabase } from '@/lib/supabase/client';

export async function loadShopInfo(): Promise<ShopInfo> {
  const { data: shop } = await supabase
    .from('shops')
    .select('name, promptpay_id, promptpay_name')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  const weekday = new Date().getDay(); // 0=Sun … 6=Sat
  const { data: hours } = await supabase
    .from('shop_hours')
    .select('open_time, close_time')
    .eq('weekday', weekday)
    .maybeSingle();

  return {
    name: shop?.name ?? DEFAULT_SHOP.name,
    promptPay: {
      target: shop?.promptpay_id ?? DEFAULT_SHOP.promptPay.target,
      displayName: shop?.promptpay_name ?? DEFAULT_SHOP.promptPay.displayName,
      bankName: DEFAULT_SHOP.promptPay.bankName,
    },
    hours: hours
      ? { open: String(hours.open_time).slice(0, 5), close: String(hours.close_time).slice(0, 5) }
      : DEFAULT_SHOP.hours,
  };
}
