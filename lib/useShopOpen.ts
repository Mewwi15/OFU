/**
 * Live shop open/closed status.
 *
 * Recomputes against the loaded operating hours every 30s so a screen left open
 * flips to "ปิดอยู่" when the shop closes (and back) without a manual refresh.
 */

import { useEffect, useState } from 'react';

import { isShopOpen } from '@/data/shop';
import { useShop } from '@/store/shop';

export function useShopOpen(): boolean {
  const hours = useShop((s) => s.info.hours);
  const [open, setOpen] = useState(() => isShopOpen(hours));

  useEffect(() => {
    const tick = () => setOpen(isShopOpen(hours));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [hours]);

  return open;
}
