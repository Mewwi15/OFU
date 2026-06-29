-- 0001_extensions_enums.sql
-- อู้ฟู่ (Oofoo) — base extensions + all enum types.
-- Source of truth: docs/06-data-model.md (## ENUMS), reconciled to online=Flash (RECON-FLASH, ADR-0003).
-- One shared Postgres for all 3 surfaces (customer app / admin web / rider app);
-- surfaces are separated by role_t + RLS, not by database. See docs/11-backend-build-plan.md §1.
-- Forward-only migration (supabase db reset recreates from scratch).

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid(), digest()
create extension if not exists citext;      -- case-insensitive promo codes / names

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity / roles / account
-- ─────────────────────────────────────────────────────────────────────────────
create type role_t          as enum ('customer', 'admin', 'rider');
create type admin_tier_t    as enum ('owner', 'staff');
create type account_state_t as enum ('pending', 'active', 'deactivated');

-- ─────────────────────────────────────────────────────────────────────────────
-- Fulfilment mode + payment
-- ─────────────────────────────────────────────────────────────────────────────
-- [RECON-FLASH] online = ส่งพัสดุทั่วประเทศผ่าน Flash Express (ไม่ใช่รับที่ร้าน/pickup)
create type shop_mode_t      as enum ('delivery', 'online');
create type payment_method_t as enum ('promptpay_slip', 'cod');
create type payment_status_t as enum ('awaiting_payment', 'slip_uploaded', 'verifying', 'paid', 'rejected');

-- ─────────────────────────────────────────────────────────────────────────────
-- Order lifecycle (shared by delivery + online flows)
-- ─────────────────────────────────────────────────────────────────────────────
-- [RECON-FLASH] dropped ready_for_pickup; picked_up=Flash code1, in_transit=code2,
--   returned=code7 (online courier states); assigned_to_rider = delivery only.
--   Flash code 1-9 mapping lives in lib/flash.ts (orderStatusFromFlashCode).
create type order_status_t as enum (
  'placed',
  'awaiting_payment',
  'slip_uploaded',
  'payment_verifying',
  'confirmed',
  'preparing',
  'assigned_to_rider',   -- delivery only
  'picked_up',           -- online: Flash รับพัสดุ (code 1)
  'in_transit',          -- online: ขนส่งระหว่างศูนย์ (code 2)
  'out_for_delivery',    -- both: กำลังนำจ่าย (online code 3)
  'delivered',           -- both (online code 5)
  'returned',            -- online: ตีกลับ (code 7)
  'cancelled',
  'payment_rejected',
  'delivery_failed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Delivery / rider (delivery mode)
-- ─────────────────────────────────────────────────────────────────────────────
create type assignment_state_t   as enum ('pending_acceptance', 'accepted', 'declined', 'expired');
create type assignment_source_t  as enum ('admin_push', 'self_accept');
create type rider_availability_t as enum ('online', 'offline');
create type shift_status_t       as enum ('open', 'settled');
create type shift_entry_kind_t   as enum ('opening_float', 'collection', 'reversal', 'adjustment');
create type rider_decline_t      as enum ('busy', 'too_far', 'vehicle_issue', 'other');
create type delivery_fail_t      as enum ('no_answer', 'no_recipient', 'wrong_address', 'refused', 'other');

-- ─────────────────────────────────────────────────────────────────────────────
-- Refund
-- ─────────────────────────────────────────────────────────────────────────────
create type refund_status_t as enum ('owed', 'sent', 'confirmed', 'failed');
-- [RECON-FLASH] +returned (parcel ตีกลับ)
create type refund_reason_t as enum ('cancelled', 'payment_rejected', 'delivery_failed', 'returned');

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog / stock / promo
-- ─────────────────────────────────────────────────────────────────────────────
create type publish_state_t as enum ('draft', 'published');
create type promo_type_t     as enum ('percent', 'fixed_baht');
create type promo_scope_t    as enum ('subtotal', 'delivery');
-- [แก้ INT-4] commit_understocked; reserve@place / commit@confirm / release@cancel-timeout (D2)
create type stock_reason_t as enum (
  'reserve_placed',
  'commit_confirmed',
  'commit_understocked',
  'release_cancel',
  'release_payment_rejected',
  'release_expiry',
  'restock_cancel',
  'restock_delivery_failed',
  'admin_adjust'
);
create type cancel_reason_t as enum (
  'customer_request', 'out_of_stock', 'payment_timeout', 'undeliverable', 'shop_cancel', 'other'
);
create type slip_reject_t as enum ('amount_mismatch', 'unclear', 'not_found', 'duplicate', 'other');

-- ─────────────────────────────────────────────────────────────────────────────
-- PDPA / consent / data requests
-- ─────────────────────────────────────────────────────────────────────────────
create type consent_purpose_t as enum ('data_processing', 'marketing', 'rider_location');
create type data_request_t    as enum ('export', 'erasure');
create type data_req_status_t as enum ('pending', 'processing', 'completed', 'cancelled');

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────────────────────
create type notif_audience_t        as enum ('customer', 'admin', 'rider');
create type notif_class_t           as enum ('transactional', 'marketing');
create type notif_category_t        as enum ('order', 'payment', 'delivery', 'promo', 'shop', 'stock', 'refund', 'system');
create type notif_channel_t         as enum ('in_app', 'push', 'sms', 'line');
create type notif_delivery_status_t as enum ('pending', 'deferred', 'sent', 'failed');

-- ─────────────────────────────────────────────────────────────────────────────
-- Merchandising / media
-- ─────────────────────────────────────────────────────────────────────────────
create type cta_target_t as enum ('promo_collection', 'category', 'product', 'external');
create type media_kind_t as enum ('payment_slip', 'pod_photo', 'refund_proof', 'data_export');
