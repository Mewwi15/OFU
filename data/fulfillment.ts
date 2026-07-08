/**
 * Fulfillment mock data — order tracking, rider, delivery timeline, and the
 * notification feed. Frontend-first: these are demo values the tracking / chat /
 * notification screens render until the realtime backend (orders + rider GPS +
 * push) lands. Thai copy, zero emoji.
 */

import { type Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

/* ----------------------------------------------------------------------- */
/* Rider                                                                   */
/* ----------------------------------------------------------------------- */

export type Rider = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  /** Vehicle / plate shown under the name. */
  vehicle: string;
  rating: number;
};

export const MOCK_RIDER: Rider = {
  id: 'rider-1',
  name: 'พีรพล จันทร์ดี',
  avatar: 'https://i.pravatar.cc/200?img=12',
  phone: '089-555-0123',
  vehicle: 'มอเตอร์ไซค์ · กข 1234',
  rating: 4.9,
};

/* ----------------------------------------------------------------------- */
/* Order status + delivery timeline                                        */
/* ----------------------------------------------------------------------- */

/**
 * Order tracking states. Shared by the local-rider (`delivery`) flow and the
 * Flash Express parcel (`online`) flow; each surface renders the subset it
 * needs. The parcel-specific codes mirror Flash Open API parcel states (mapped
 * in `lib/flash.ts`, see docs/adr/ADR-0003):
 *   picked_up = 1, in_transit = 2, out_for_delivery = 3, delivered = 5,
 *   delivery_failed = 4|6, returned = 7, cancelled = 8|9.
 * The rider flow only ever uses preparing / out_for_delivery / delivered.
 */
export type OrderStatus =
  | 'preparing'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'returned'
  | 'cancelled';

/** Problem states — off the happy path (parcel could not complete normally). */
export type ExceptionStatus = 'delivery_failed' | 'returned' | 'cancelled';

/** True when the order is in a problem state (failed / returned / cancelled). */
export function isExceptionStatus(status: OrderStatus): status is ExceptionStatus {
  return status === 'delivery_failed' || status === 'returned' || status === 'cancelled';
}

/** Customer-facing copy for each exception state. */
export type ExceptionMeta = {
  label: string;
  message: string;
  icon: IconName;
  /** Flash may re-attempt (true) vs terminal (false). */
  canRetry: boolean;
};

export const EXCEPTION_META: Record<ExceptionStatus, ExceptionMeta> = {
  delivery_failed: {
    label: 'นำจ่ายไม่สำเร็จ',
    message: 'Flash จะติดต่อและพยายามนำส่งให้อีกครั้ง หากต้องการความช่วยเหลือ ติดต่อร้านอู้ฟู่ได้เลย',
    icon: 'alert-circle',
    canRetry: true,
  },
  returned: {
    label: 'พัสดุถูกตีกลับ',
    message: 'พัสดุกำลังส่งกลับไปที่ร้าน ทีมงานอู้ฟู่จะติดต่อคุณเพื่อจัดส่งใหม่หรือคืนเงิน',
    icon: 'arrow-undo',
    canRetry: false,
  },
  cancelled: {
    label: 'การจัดส่งถูกยกเลิก',
    message: 'การจัดส่งนี้ถูกยกเลิก หากมีข้อสงสัยกรุณาติดต่อร้านอู้ฟู่',
    icon: 'close-circle',
    canRetry: false,
  },
};

/** One node on the horizontal delivery stepper. */
export type DeliveryStage = {
  key: string;
  label: string;
  icon: IconName;
};

export const DELIVERY_STAGES: DeliveryStage[] = [
  { key: 'preparing', label: 'เตรียมสินค้า', icon: 'basket-outline' },
  { key: 'packed', label: 'แพ็คเรียบร้อย', icon: 'cube-outline' },
  { key: 'on_the_way', label: 'กำลังจัดส่ง', icon: 'bicycle-outline' },
  { key: 'arrived', label: 'ถึงที่หมาย', icon: 'home-outline' },
];

/** Index of the currently-active stage for a given status (rider stepper). */
export function stageIndexFor(status: OrderStatus): number {
  switch (status) {
    case 'preparing':
      return 0;
    case 'picked_up':
      return 1;
    case 'in_transit':
      return 2;
    case 'out_for_delivery':
      return 2;
    case 'delivered':
      return 3;
    case 'delivery_failed':
    case 'returned':
    case 'cancelled':
      return 2;
  }
}

/* ----------------------------------------------------------------------- */
/* Parcel (online / Flash Express) timeline                                */
/* ----------------------------------------------------------------------- */

/** Vertical parcel-tracking steps for an online (Flash Express) shipment. */
export const PARCEL_STAGES: DeliveryStage[] = [
  { key: 'preparing', label: 'ร้านกำลังแพ็คสินค้า', icon: 'cube-outline' },
  { key: 'picked_up', label: 'Flash รับพัสดุแล้ว', icon: 'cube' },
  { key: 'in_transit', label: 'กำลังขนส่งระหว่างศูนย์', icon: 'car-outline' },
  { key: 'out_for_delivery', label: 'กำลังนำจ่าย', icon: 'bicycle-outline' },
  { key: 'delivered', label: 'จัดส่งสำเร็จ', icon: 'checkmark-done-outline' },
];

/**
 * Index of the active parcel stage for an order status (online flow). For an
 * exception state this returns the stage where the parcel stalled (so the
 * timeline can mark that node as failed).
 */
export function parcelStageIndexFor(status: OrderStatus): number {
  switch (status) {
    case 'preparing':
      return 0;
    case 'picked_up':
      return 1;
    case 'in_transit':
      return 2;
    case 'out_for_delivery':
      return 3;
    case 'delivered':
      return 4;
    case 'delivery_failed':
      return 3; // stalled while out for delivery
    case 'returned':
      return 2; // turned back in transit
    case 'cancelled':
      return 0;
  }
}

export type LatLng = { latitude: number; longitude: number };

/**
 * A demo route the rider follows toward the customer (สุขุมวิท, กรุงเทพฯ). The
 * last point is the delivery address; `RIDER_POSITION` sits partway along.
 */
export const DELIVERY_DESTINATION: LatLng = { latitude: 13.7236, longitude: 100.5686 };

export const DELIVERY_ROUTE: LatLng[] = [
  { latitude: 13.7301, longitude: 100.5601 },
  { latitude: 13.7288, longitude: 100.5625 },
  { latitude: 13.7269, longitude: 100.5638 },
  { latitude: 13.7258, longitude: 100.5662 },
  { latitude: 13.7246, longitude: 100.5675 },
  DELIVERY_DESTINATION,
];

export const RIDER_POSITION: LatLng = { latitude: 13.7269, longitude: 100.5638 };

export type TrackedOrder = {
  id: string;
  shopName: string;
  status: OrderStatus;
  /** Human ETA window, e.g. "30-45 นาที". */
  etaText: string;
  /** Short "expected in" used on the footer / arrival line. */
  etaShort: string;
  total: number;
  itemCount: number;
  addressLabel: string;
  addressLine: string;
  /** When the order was placed, display-formatted Thai (e.g. "27 มิ.ย. 14:30 น."). */
  placedAtLabel?: string;
  /** Delivery time once `delivered`. */
  deliveredAt?: string;
  rider: Rider;

  /* Fulfilment kind — `delivery` = local อู้ฟู่ rider (live map), `parcel` =
     shipped via Flash Express (tracking number + timeline, no rider map).
     Absent is treated as `delivery` for backward-compat with old orders. */
  fulfilment?: 'delivery' | 'parcel';
  /** Courier name, e.g. "Flash Express" (parcel only). */
  courier?: string;
  /** Courier tracking number (parcel only). */
  trackingNo?: string;
  /** DB payment_status (awaiting_payment|slip_uploaded|verifying|paid|rejected)
      — drives the "shop is checking your slip" tracking state. */
  paymentStatus?: string;
  /** DB payment_method (cod | promptpay_slip). */
  paymentMethod?: string;
};

/** Prepay order whose slip the shop hasn't approved yet (manual verification). */
export function isAwaitingSlipCheck(o: TrackedOrder): boolean {
  return (
    o.paymentMethod === 'promptpay_slip' &&
    ['awaiting_payment', 'slip_uploaded', 'verifying'].includes(o.paymentStatus ?? '')
  );
}

/* ----------------------------------------------------------------------- */
/* Notifications                                                           */
/* ----------------------------------------------------------------------- */

export type NotificationKind = 'order' | 'promo';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  icon: IconName;
  title: string;
  body: string;
  /** Relative time label, e.g. "5 นาที". */
  time: string;
  unread: boolean;
};

