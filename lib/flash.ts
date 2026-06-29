/**
 * Flash Express Open API — parcel-state mapping (pure, no network).
 *
 * อู้ฟู่ ships `online` orders via Flash Express. Flash's tracking webhook and
 * `POST /open/v1/orders/{pno}/routes` return an integer `state` (1-9); this
 * module is the single place that maps it onto our app's `OrderStatus`, so the
 * tracking UI stays carrier-agnostic. See docs/adr/ADR-0003.
 *
 * IMPORTANT: the signed API calls themselves (every request is SHA256-signed
 * with `mchId` + `nonceStr` + secret API key) live SERVER-SIDE only (Supabase
 * Edge Function). The customer app must never call Flash directly — that would
 * leak the key. This file holds only the pure state mapping the UI needs.
 */

import type { OrderStatus } from '@/data/fulfillment';

/** Flash Open API environments (base URLs). Used server-side. */
export const FLASH_BASE_URL = {
  production: 'https://open-api.flashexpress.com',
  training: 'https://open-api-tra.flashexpress.com',
} as const;

/** Flash Open API parcel state codes (the `state` field on a route/webhook). */
export const FLASH_STATE = {
  1: 'Picked Up',
  2: 'In Transit',
  3: 'On Delivery',
  4: 'Detained',
  5: 'Delivered',
  6: 'Problematic Processing',
  7: 'Returned',
  8: 'Closed',
  9: 'Cancelled',
} as const;

export type FlashStateCode = keyof typeof FLASH_STATE;

/**
 * Map a Flash parcel state code onto อู้ฟู่'s `OrderStatus`.
 * Unknown / pre-pickup codes fall back to `preparing`.
 */
export function orderStatusFromFlashCode(code: number): OrderStatus {
  switch (code) {
    case 1:
      return 'picked_up';
    case 2:
      return 'in_transit';
    case 3:
      return 'out_for_delivery';
    case 5:
      return 'delivered';
    case 4: // Detained
    case 6: // Problematic Processing
      return 'delivery_failed';
    case 7:
      return 'returned';
    case 8: // Closed
    case 9: // Cancelled
      return 'cancelled';
    default:
      return 'preparing';
  }
}
