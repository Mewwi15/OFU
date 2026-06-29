/**
 * Live shop open/closed status.
 *
 * Recomputes against the operating hours every 30s so a screen left open flips
 * to "ปิดอยู่" when the shop closes (and back) without a manual refresh.
 */

import { useEffect, useState } from 'react';

import { isShopOpen } from '@/data/shop';

export function useShopOpen(): boolean {
  const [open, setOpen] = useState(() => isShopOpen());

  useEffect(() => {
    const tick = () => setOpen(isShopOpen());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return open;
}
