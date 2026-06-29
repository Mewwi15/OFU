# 07 — API / Realtime / Storage Contract (อู้ฟู่ v1) — FINAL

> Supabase (Singapore). Authoritative source: `06-data-model.md` (39 tables, enums, RLS, Realtime, Storage) + `05-architecture.md` + ADR-0002 (payment) + `03b` grooming + NFR-SEC/REL/OBS/I18N.
> **Money = THB integer.** All state writes go through `SECURITY DEFINER` RPCs (`SET search_path=''`, `REVOKE EXECUTE FROM public/anon`, then role-granted). Direct `UPDATE` on `orders/payments/product_variants/catalog` is REVOKED; RLS governs `SELECT` + cross-tenant isolation. A small set of personal tables (`carts/cart_items/wishlist_items/addresses/notification_preferences`) is owner-RLS-writable but fronted by thin RPCs where invariants need enforcing (§1.10). No screen imports supabase-js — every call is one method on a swappable repository (ADR-0001).
> **This FINAL revision resolves all HIGH/MEDIUM verifier findings** (see §9 Changelog).

## 0. Global conventions

**Auth context.** Every authenticated request carries a Supabase JWT with custom claims injected by `auth.custom_access_token_hook`: `app_role ∈ {customer,admin,rider}`, `admin_tier ∈ {owner,staff,null}`, `account_state ∈ {pending,active,deactivated}`, `shop_id`. RLS reads only `auth.uid()` + `auth.jwt()->>'…'` (never sub-selects the guarded table). Every mutating RPC re-derives authority **live** via `app.current_user()` (BYPASSRLS helper) and rejects `account_state='deactivated'`, `is_anonymized=true`, or insufficient `admin_tier` — so revocation/demotion takes effect on the **next request** even before the JWT refreshes.

**Caller role tokens:** `anon` (pre-auth/guest), `customer`, `rider`, `admin:staff`, `admin:owner`, `system` (pg_cron / service-role). `admin:*` = staff+owner.

**Idempotency.**
- `place_order` deduped by `idempotency_key uuid` → `uniq(shop_id, idempotency_key)`. Replay returns the **original** order (HTTP 200, `details.idempotent_replay=true`), never a duplicate.
- `complete_delivery` / `fail_delivery` / `record_refund_sent` / `mark_refund_failed` / `merge_guest_cart` / COD cash + `record_cash_adjustment` deduped by `client_op_id uuid` (at-most-once). Replay returns the prior result.
- COD collection additionally guarded by `shift_cash_entries` partial `uniq(order_id) where kind='collection'`.

**Optimistic concurrency.** `orders.row_version` / `products.row_version` are passed as `p_expected_row_version`; a stale value → `STALE_WRITE` (409, retryable-after-refresh). Rider/assignment races use **first-writer-wins** on `deliveries`.

**Pagination/filter (all PostgREST reads).** Keyset (seek) preferred: `?order=created_at.desc,id.desc&limit=20&created_at=lt.<cursor>` (avoid OFFSET on hot lists — NFR-PERF-01). Offset fallback via `Range`. PostgREST operators (`eq,in,gte,lte,is,like,ilike`); embedding for related rows (`select=*,order_items(*)`); `Prefer: count=exact` only on admin tables. **Server caps `limit ≤ 50`.**

**Step-up.** `audit_log.step_up_verified=true` + reauth ≤ step-up window required for: `approve_slip`, `reject_slip`, `record_refund_sent`, `mark_refund_failed`, `change_admin_tier`, `bulk_adjust_variants`, `request_data_erasure`, `withdraw_consent('data_processing')`, and the owner-invite Edge fns. Missing/stale → `STEP_UP_REQUIRED`.

Every RPC writes an `audit_log` row (actor id+role+tier, action, target, PII-free `summary`, `changed_fields`, `step_up_verified`).

---

## 1. RPC contracts

### 1.0 Master index

| Domain | RPCs |
|---|---|
| Checkout/order | `place_order`, `attach_payment_slip`, `reissue_promptpay_qr`, `advance_order`, `cancel_order`, `rate_order` |
| Slip/payment | `claim_slip`, `release_slip_lock`, `approve_slip`, `reject_slip` |
| Rider assign | `assign_rider`, `rider_respond`, `accept_available_job`, `redispatch_delivery`, `reschedule_delivery` |
| Delivery run | `start_run`, `complete_delivery`, `fail_delivery`, **`get_assigned_delivery`**, **`request_contact_proxy`** |
| Rider availability | **`set_rider_availability`** |
| Cash/shift | `open_shift`, `settle_shift`, **`record_cash_adjustment`** |
| Refunds | `record_refund_sent`, `confirm_refund`, `report_refund_not_received`, **`mark_refund_failed`** |
| Promo | `validate_promo`, `upsert_promo_code` |
| Cart | **`add_cart_item`**, **`set_cart_item_qty`**, **`remove_cart_item`**, **`clear_cart`**, **`set_cart_mode`**, **`apply_cart_promo`**, **`remove_cart_promo`**, `merge_guest_cart`, `merge_guest_wishlist`, **`toggle_wishlist_item`** |
| Account/profile | **`upsert_address`**, **`delete_address`**, **`set_default_address`**, **`update_notification_preferences`** |
| Catalog/stock | **`upsert_category`**, **`upsert_product`**, **`upsert_variant`**, **`set_publish_state`**, **`archive_product`**, **`adjust_stock`**, **`bulk_adjust_variants`** |
| PDPA/consent | `get_consent_status`, `grant_consent`, `withdraw_consent`, `request_data_export`, `request_data_erasure`, `anonymize_user` |
| Media | `request_slip_upload_url`, `request_pod_upload_url`, `request_refund_proof_upload_url`, **`request_avatar_upload_url`**, **`request_product_image_upload_url`**, **`request_banner_image_upload_url`**, `get_media_signed_url` |
| Accounts/admin | `invite_rider`*, `invite_staff`*, **`activate_invited_account`**, `edit_rider`, `deactivate_rider`, `reactivate_rider`, `change_admin_tier`, `update_shop_settings` |
| Notifications | `mark_notifications_read`, `register_push_token` |
| Merchandising | `upsert_banner`, `upsert_featured_section` |
| Crons | `expire_unpaid_orders`, `expire_assignments`, `purge_expired_media`, `defer_quiet_hours_notifications`, `process_data_requests` |

*`invite_rider`/`invite_staff` are exposed as Edge Functions (§5) that internally run the provisioning transaction. **Bold = added/changed in this FINAL revision** to close verifier findings.

### 1.1 State-machine invariants (enforced inside RPCs, not the client)
- `online ⇒ payment_method='promptpay_slip'` (`place_order` rejects COD-on-online → `ONLINE_REQUIRES_PREPAY`). [RECON-FLASH] online = Flash parcel (ADR-0003); prepay-only ใน v1 (Flash COD เปิดภายหลัง).
- `cod ⇒ shop_mode='delivery' AND shop_settings.cod_enabled AND subtotal ≤ cod_cap` (else `COD_NOT_ALLOWED`).
- **COD**: `placed → confirmed` directly (skip awaiting_payment); `payment_status='awaiting_payment'` means "cash owed, collect at delivered"; **commit stock at `confirmed`** (GROOM-STOCK-03).
- **Prepay slip lifecycle (canonical — finding-fixed):** `attach_payment_slip` lands `order_status='slip_uploaded'`, `payment_status='slip_uploaded'` (the **queue state**). `claim_slip` transitions `slip_uploaded → verifying` (`order_status='payment_verifying'`, `payment_status='verifying'`, sets `payments.locked_by`). `approve_slip`/`reject_slip` require `verifying`. `confirmed` is reachable **only** via `approve_slip` (payments→paid mirrors to order). `advance_order`→`confirmed` on an unpaid prepay order → `PAYMENT_NOT_PAID` ("รอตรวจสลิปก่อน").
- Refund `owed` auto-created only when money was actually received (`payments.funds_received=true`/`paid`). COD never-collected → no refund. At-most-one open refund per order (`partial uniq(order_id) where status<>'failed'`); `failed` frees a fresh refund.

---

### 1.2 Checkout / order

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `place_order` | `p_idempotency_key uuid, p_shop_mode shop_mode_t, p_payment_method payment_method_t, p_address_id uuid?(**req for both delivery และ online** — [RECON-FLASH] parcel ต้องมีที่อยู่ปลายทาง), p_promo_code citext?`. **Lines derived server-side from the caller's `carts`/`cart_items`** (prices snapshotted server-side; client cannot set price). | `orders` row `{id, order_number, order_status, payment_status, subtotal, delivery_fee, discount_amount, total, payment_method, shop_mode, placed_at, row_version}`; prepay also `order_ref` | customer (active, consent) | `EMPTY_CART`422, `OUT_OF_STOCK`409(+lines), `PROMO_INVALID/PROMO_MIN_SPEND/PROMO_USAGE_EXCEEDED`, `COD_NOT_ALLOWED`422, `ONLINE_REQUIRES_PREPAY`422, `ADDRESS_REQUIRED`422, `CONSENT_REQUIRED`403, `ACCOUNT_INACTIVE`403. Replay→original order,200. Atomic: lock variant rows + `promo_codes` row, floor reserve, gen per-shop `order_number`; COD auto `placed→confirmed`+commit stock. **Snapshots `ship_recipient/ship_phone/ship_address_text/ship_lat/ship_lng` for both modes** (delivery + online) — [RECON-FLASH] online ใช้ที่อยู่จริงเสมอ (เลิก null-for-pickup). online order ที่ paid → `create_flash_shipment` (admin) สร้าง pno. |
| `attach_payment_slip` | `p_order_id uuid, p_storage_path text (from request_slip_upload_url), p_observed_amount int?` | `{order_status:'slip_uploaded', payment_status:'slip_uploaded', slip_id}` | customer (own) | `NOT_FOUND`404, `NOT_AWAITING`409, `ORDER_TERMINAL`409, `REORDER_REQUIRED`409(payment_rejected). **Lands in the queue state `slip_uploaded`** (matches §2.4 filter + index + `shop:{sid}:slips`). |
| `reissue_promptpay_qr` | `p_order_id uuid` | `{emv_payload, amount, order_ref}` (delegates to `generate-promptpay-qr`) | customer (own) | `NOT_AWAITING`409, `REORDER_REQUIRED`409. Does not extend auto-cancel deadline unless configured (GROOM-PAY-11). |
| `advance_order` | `p_order_id uuid, p_to_status order_status_t, p_expected_row_version int` | updated `orders` + `order_status_events` | admin:* | `ILLEGAL_TRANSITION`409, `PAYMENT_NOT_PAID`409 (confirming unpaid prepay), `STALE_WRITE`409, `NOT_FOUND`404. Validates canonical state machine; commit-once stock invariant. [RECON-FLASH] online courier states (`picked_up/in_transit/returned`) มาจาก `apply_flash_webhook` ตาม shop_mode ไม่ใช่ manual advance. |
| `cancel_order` | `p_order_id uuid, p_reason cancel_reason_t, p_note text?, p_expected_row_version int, p_client_op_id uuid?` | `{order_status:'cancelled'}` + restock/release + refund(owed) if money received | customer (own, pre-fulfilment) ; admin:* | `ILLEGAL_CANCEL`409, `ALREADY_TERMINAL`409, `STALE_WRITE`409, `FORBIDDEN`403. Pre-commit→release reservation; post-commit→restock; COD-never-collected→no refund. **If a previously collected COD order is cancelled, writes `shift_cash_entries(kind='reversal', client_op_id)` against the open shift (or routes to `record_cash_adjustment` if shift already settled) and creates refund(owed)** (GROOM-PAY-05 edge). |
| `rate_order` | `p_order_id uuid, p_rating smallint(1..5), p_comment text?` | `order_ratings` row | customer (own, delivered/picked_up) | `NOT_DELIVERED`409, `ALREADY_RATED`409, `VALIDATION`422 |

### 1.3 Slip / payment

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `claim_slip` | `p_order_id uuid` | `{order_status:'payment_verifying', payment_status:'verifying', locked_by, locked_at}` | admin:* | `SLIP_LOCKED`423 (held by other), `NOT_FOUND`404, **`NOT_IN_SLIP_UPLOADED`409** (must be `payment_status='slip_uploaded'`). Soft lock; authoritative lock = `payments.locked_by`; presence `slip:{orderId}:lock` is hint only. **This is the only transition into `verifying`.** |
| `release_slip_lock` | `p_order_id uuid` | `{locked_by:null}` (returns to `slip_uploaded`) | admin:* (lock holder) | `FORBIDDEN`403, `NOT_FOUND`404 |
| `approve_slip` | `p_order_id uuid, p_observed_amount int?, p_bank_ref text?, p_expected_row_version int` | `{payment_status:'paid', order_status:'confirmed', paid_at}` + stock committed | admin:* (step-up) | `STEP_UP_REQUIRED`403, `SLIP_LOCKED`423, `NOT_IN_VERIFYING`409, `STALE_WRITE`409, `NOT_FOUND`404. 1 tx: payments authoritative→mirror to order; `reserved_qty-=qty & stock_qty-=qty` (floor 0, `commit_understocked` flag if short). |
| `reject_slip` | `p_order_id uuid, p_reject_reason slip_reject_t, p_reject_note text?, p_funds_received bool=false, p_expected_row_version int` | `{payment_status:'rejected', order_status:'payment_rejected'}` + reservation released; if `funds_received=true` → refund(owed) | admin:* (step-up) | `STEP_UP_REQUIRED`403, `NOT_IN_VERIFYING`409, `SLIP_LOCKED`423, `STALE_WRITE`409. `funds_received` disambiguates real-transfer rejection (→refund) from a plain bad slip. |

### 1.4 Rider assignment

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `assign_rider` | `p_order_id uuid, p_rider_user_id uuid, p_expected_row_version int` | `deliveries` `{assignment_state:'pending_acceptance', assignment_source:'admin_push', assigned_at, acceptance_deadline}` | admin:* | `RIDER_UNAVAILABLE`409, `NOT_ASSIGNABLE`409, `JOB_TAKEN`409 (first-writer-wins), `MAX_ACTIVE_JOBS`409, `STALE_WRITE`409. Reassign supersedes prior (→expired) + notifies old rider. Clears `is_available`. |
| `rider_respond` | `p_order_id uuid, p_response 'accept'|'decline', p_decline_reason rider_decline_t?, p_decline_note text?` | accept→`{assignment_state:'accepted', accepted_at}`; decline→order back to `preparing` + admin notified | rider (assigned) | `NOT_PENDING_ACCEPTANCE`409, `NOT_YOUR_JOB`403, `ASSIGNMENT_CHANGED`409, `VALIDATION`422 (reason for 'other'). First-writer-wins vs expiry. |
| `accept_available_job` | `p_order_id uuid` | `deliveries` `{assignment_state:'accepted', assignment_source:'self_accept', accepted_at}` | rider (online, active) | `JOB_TAKEN`409, `RIDER_UNAVAILABLE`409, `MAX_ACTIVE_JOBS`409, `NOT_AVAILABLE`409. First-writer-wins on `deliveries`. |
| `redispatch_delivery` | `p_order_id uuid, p_rider_user_id uuid?(null=release to pool), p_expected_row_version int` | `delivery_failed→assigned_to_rider(pending_acceptance)` or `→preparing`; `attempt_count++` | admin:* | `NOT_FAILED`409, `MAX_ATTEMPTS`409, `STALE_WRITE`409 (GROOM-FULFILL-04). |
| `reschedule_delivery` | `p_order_id uuid, p_next_attempt_at timestamptz` | stays `delivery_failed` with `next_attempt_at` set | admin:* | `NOT_FAILED`409, `MAX_ATTEMPTS`409 (v1-optional). |

### 1.5 Delivery run + rider PII (finding-fixed)

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `start_run` | `p_order_id uuid` | `{order_status:'out_for_delivery', out_for_delivery_at}` | rider (assigned, accepted) | `NOT_ACCEPTED`409, `NOT_YOUR_JOB`403, `ILLEGAL_TRANSITION`409. Only `assignment_state='accepted'` may advance. |
| `complete_delivery` | `p_order_id uuid, p_client_op_id uuid, p_pod_photo_path text?, p_pod_no_photo_reason text?, p_pod_lat double?, p_pod_lng double?, p_cash_collected int?(COD)` | `{order_status:'delivered', payment_status:'paid', delivered_at}`; COD adds `shift_cash_entries(kind='collection')` | rider (own, out_for_delivery) | `NOT_OUT_FOR_DELIVERY`409, `CASH_MISMATCH`422, `NO_OPEN_SHIFT`409(COD), `POD_REQUIRED`422. Idempotent on `client_op_id`; COD collection deduped by partial `uniq(order_id) where kind='collection'`. |
| `fail_delivery` | `p_order_id uuid, p_client_op_id uuid, p_failure_reason delivery_fail_t, p_failure_note text?, p_pod_photo_path text?` | `{order_status:'delivery_failed', attempt_count++}`; restock (post-commit); never-collected COD → no cash/refund | rider (own, out_for_delivery) | `NOT_OUT_FOR_DELIVERY`409, `MAX_ATTEMPTS`409. Idempotent on `client_op_id`. PaymentStatus stays `awaiting_payment` for COD. |
| **`get_assigned_delivery`** | `p_order_id uuid` | `{order_number, shop_mode, total, payment_method, order_items[{name_snapshot,size_snapshot,qty}], ship_recipient, ship_phone, ship_address_text, ship_lat, ship_lng}` — **`ship_*` returned ONLY when `assignment_state='accepted' AND now() < terminal_at + rider_pii_window_hours`, else null** | rider (assigned) | `NOT_YOUR_JOB`403, `NOT_FOUND`404. **`SECURITY DEFINER` cell/time-gated read** — RLS cannot null columns by sub-state/time, so rider recipient PII is served ONLY here, never via row reads or Realtime. *(Resolves HIGH #2.)* |
| **`request_contact_proxy`** | `p_order_id uuid, p_direction 'rider_to_customer'|'customer_to_rider'` | `{proxy_number text?, dial_token text?, expires_at}` | rider (assigned+accepted, order out_for_delivery) ; customer (own order, out_for_delivery) | `NOT_FOUND`404, `FORBIDDEN`403, `NOT_OUT_FOR_DELIVERY`409, `PROXY_UNAVAILABLE`503 (provider down). Authorizes caller, returns a **relay number or one-time dial token** (provider-gated; v1 fallback = masked-number-reveal-on-dial), writes a contact `audit_log` entry. Raw phone numbers are never returned. (RID-DLV-02 MUST, GROOM-FULFILL-07.) *(Resolves MEDIUM phone-proxy.)* |

### 1.6 Rider availability (finding-fixed)

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| **`set_rider_availability`** | `p_availability rider_availability_t` | `rider_profiles` `{availability, availability_updated_at}` | rider (self, active) | `CONSENT_REQUIRED`403 (no current `rider_location` consent), `ACCOUNT_INACTIVE`403. Single trigger that maintains `deliveries.is_available` eligibility (pool) + `shop:{sid}:riders` Presence membership. Offline beyond `offline_threshold_sec` is reconciled by `expire_assignments` (GROOM-FULFILL-03). *(Resolves MEDIUM availability.)* |

### 1.7 Cash / shift

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `open_shift` | `p_rider_user_id uuid, p_opening_float int(>=0)` | `rider_shifts` `{status:'open', opening_float, opened_at}` | rider (self) or admin:owner | `SHIFT_ALREADY_OPEN`409 (partial uniq one open/rider), `VALIDATION`422. |
| `settle_shift` | `p_shift_id uuid, p_actual_cash int, p_variance_note text?, p_variance_accept bool=false` | `{status:'settled', expected_cash, actual_cash, variance, settled_at}` | admin:owner (variance accept owner-only); rider may submit count | `NOT_OPEN`409, `VARIANCE_REQUIRES_OWNER`403 (`|variance|>0` needs owner accept+note), `ALREADY_SETTLED`409. `expected_cash` derived from `shift_cash_entries`; settled shift immutable (corrections = new adjustment entry). |
| **`record_cash_adjustment`** | `p_shift_id uuid, p_amount int, p_kind shift_entry_kind_t('reversal'|'adjustment'), p_reason text, p_order_id uuid?, p_client_op_id uuid` | `shift_cash_entries` row | admin:owner | `NOT_FOUND`404, `VALIDATION`422, `FORBIDDEN`403(staff). Records post-collection reversals/adjustments (e.g. a settled-shift COD later cancelled). Idempotent on `client_op_id`. *(Resolves LOW collected-COD reversal; post-settlement target = adjustment entry against the rider's next open shift — see §8 residual.)* |

### 1.8 Refunds

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `record_refund_sent` | `p_refund_id uuid, p_promptpay_ref text, p_proof_path text?, p_client_op_id uuid` | `{status:'sent', sent_at}`; customer notified | admin:owner (step-up) | `NOT_OWED`409, `AMOUNT_MISMATCH`422, `FORBIDDEN`403(staff), `STEP_UP_REQUIRED`403. Idempotent on `client_op_id`; re-send after 'not received' allowed + audited. |
| `confirm_refund` | `p_refund_id uuid` | `{status:'confirmed', confirmed_at, confirmed_by_customer:true}` | customer (own) or admin:owner | `NOT_SENT`409, `NOT_YOUR_REFUND`403, `NOT_FOUND`404 |
| `report_refund_not_received` | `p_refund_id uuid` | `{not_received_reported_at}`; refund stays `sent`, admin flagged | customer (own) | `NOT_SENT`409, `NOT_YOUR_REFUND`403 |
| **`mark_refund_failed`** | `p_refund_id uuid, p_reason text` | `{status:'failed'}`; permits a fresh `owed` refund per `partial uniq(order_id) where status<>'failed'` | admin:owner (step-up) | `NOT_SENT`409, `FORBIDDEN`403(staff), `STEP_UP_REQUIRED`403, `NOT_FOUND`404 (GROOM-FULFILL-05). *(Resolves LOW refund-failed.)* |

### 1.9 Promo

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `validate_promo` | `p_code citext, p_subtotal int, p_shop_mode shop_mode_t` | `{valid, discount, scope, reason_code?, message_th}` (non-throwing) | customer ; anon (preview; per-user cap re-checked in place_order) | reason_code ∈ `NOT_FOUND/INACTIVE/NOT_STARTED/EXPIRED/MIN_SPEND/USAGE_EXCEEDED/PER_USER_EXCEEDED`. Shared rounding (`shop_settings.promo_rounding`) with place_order. |
| `upsert_promo_code` | `p_id uuid?, p_code citext, p_type promo_type_t, p_value int, p_max_discount int?, p_min_spend int, p_scope promo_scope_t, p_active_from/p_active_to timestamptz?, p_total_limit int?, p_per_user_limit int?, p_active bool` | `promo_codes` row | admin:owner | `FORBIDDEN`403(staff), `DUPLICATE_CODE`409, `VALIDATION`422 (percent>100, value<=0, end<start). |

### 1.10 Cart, wishlist & profile writes (finding-fixed)

> The data model REVOKEs direct UPDATE only on `orders/payments/product_variants/catalog`, so `carts/cart_items/wishlist_items/addresses/notification_preferences` are **owner-RLS-writable** (INSERT/UPDATE/DELETE policies: `owner_user_id = auth.uid()` / `user_id = auth.uid()`). They are *also* fronted by these thin RPCs where a server-side invariant must hold (stock clamp, single-default, dedup). `place_order` reads the **server cart** these maintain — making the authed cart authoritative. *(Resolves HIGH #3 + MEDIUM everyday-writes.)*

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| **`add_cart_item`** | `p_variant_id uuid, p_qty int(>0)` | `cart_items` row + cart summary | customer | `OUT_OF_STOCK`409 (clamped to `available_qty`), `VARIANT_UNAVAILABLE`409, `VALIDATION`422. Upsert keyed by `(cart_id, variant_id)`, sums qty; auto-creates the owner's `carts` row if absent. |
| **`set_cart_item_qty`** | `p_variant_id uuid, p_qty int(>=0)` | cart summary | customer | `OUT_OF_STOCK`409 (clamp). `qty=0` removes the line. |
| **`remove_cart_item`** | `p_variant_id uuid` | cart summary | customer | `NOT_FOUND`404 |
| **`clear_cart`** | (none) | empty cart | customer | — |
| **`set_cart_mode`** | `p_shop_mode shop_mode_t` | `{shop_mode}` | customer | persists `carts.shop_mode` + mirrors `app_users.preferred_shop_mode` (CUS-MODE-02). |
| **`apply_cart_promo`** | `p_code citext` | `{applied_promo_code_id, discount, message_th}` | customer | re-validates via `validate_promo`; `PROMO_INVALID/PROMO_MIN_SPEND/...` surfaced; sets `carts.applied_promo_code_id`. |
| **`remove_cart_promo`** | (none) | `{applied_promo_code_id:null}` | customer | — |
| `merge_guest_cart` | `p_items jsonb[{variant_id,qty}], p_shop_mode shop_mode_t, p_promo_code citext?, p_client_op_id uuid` | merged `{items[], shop_mode, applied_promo_code_id}` | customer (checkout auth gate) | Non-throwing/clamping: unknown variant skipped, dup `(cart_id,variant_id)` summed, clamped to `available_qty`, promo re-validated (dropped+notice if disqualified). Idempotent on `client_op_id`. |
| `merge_guest_wishlist` | `p_product_ids uuid[]` | `wishlist_items` union-deduped by `product_id`, `added_at desc` | customer | unknown/discontinued ids skipped; idempotent. |
| **`toggle_wishlist_item`** | `p_product_id uuid` | `{wishlisted bool}` | customer | `NOT_FOUND`404 (unknown product). Enforces `uniq(user_id, product_id)` (CUS-WISHLIST-01). |
| **`upsert_address`** | `p_id uuid?, p_label, p_recipient_name, p_recipient_phone, p_address_line, p_subdistrict, p_district, p_province, p_postal_code char(5), p_note?, p_lat?, p_lng?, p_is_default bool` | `addresses` row | customer | `VALIDATION`422 (postal `^[0-9]{5}$`). |
| **`set_default_address`** | `p_address_id uuid` | `{is_default:true}` | customer | `NOT_FOUND`404. Enforces `partial uniq(user_id) where is_default` (atomically unsets the prior default). |
| **`delete_address`** | `p_address_id uuid` | `{deleted:true}` | customer | `NOT_FOUND`404. Orders keep their `ship_*` snapshot (`orders.address_id ON DELETE SET NULL`). |
| **`update_notification_preferences`** | `p_patch jsonb (push_enabled, sms_enabled, line_enabled, quiet_hours_start, quiet_hours_end, timezone)` | `notification_preferences` row | authenticated | `VALIDATION`422 (ENG-NOTIF-07). Channel routing only — marketing **consent** stays in `pdpa_consents`. |

### 1.11 Catalog & stock (finding-fixed — entire admin surface)

> Per data model line 12/373, all catalog/stock mutation is REVOKE-direct-UPDATE + audited RPC. Each RPC writes `audit_log`; stock-affecting ones write `stock_movements(reason='admin_adjust')` and reset low-stock episode columns (`low_stock_alerted_at`/`out_of_stock_alerted_at`) so GROOM-STOCK-05 alerts re-arm. *(Resolves HIGH #1.)*

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| **`upsert_category`** | `p_id uuid?, p_name, p_slug, p_display_order int` | `categories` row | admin:staff | `DUPLICATE_CATEGORY`409 `uniq(shop_id,name)`, `VALIDATION`422 (ADM-CAT). |
| **`upsert_product`** | `p_id uuid?, p_category_id uuid, p_name, p_subtitle?, p_description?, p_orderable_delivery bool, p_orderable_online bool, p_expected_row_version int?` | `products` row | admin:staff | `STALE_WRITE`409, `VALIDATION`422 (ADM-CAT-01/02). Bumps `row_version`. |
| **`upsert_variant`** | `p_id uuid?, p_product_id uuid, p_size text?, p_price int(>0), p_stock_qty int?, p_low_stock_threshold int?` | `product_variants` row | admin:staff (price/stock single-item) | `VALIDATION`422 (price>0, stock>=0), `DUPLICATE_VARIANT`409 `uniq(product_id,size_key)`. A `stock_qty` change here writes `stock_movements(admin_adjust)` (GROOM-STOCK-01). |
| **`set_publish_state`** | `p_product_id uuid, p_state publish_state_t, p_expected_row_version int` | `{publish_state}` | admin:staff | `STALE_WRITE`409, `BROKEN_PUBLISH`422 (publishing a product with no published variant/image). (ADM-CAT-04/09). Drives the `products_with_from_price` view + grid visibility. |
| **`archive_product`** | `p_product_id uuid, p_expected_row_version int` | `{archived_at}` | admin:staff | `STALE_WRITE`409, `HAS_OPEN_ORDERS`409 (optional guard). Soft-archive (sets `archived_at`); world-read filters `archived_at is null`. |
| **`adjust_stock`** | `p_variant_id uuid, p_delta_stock int, p_reason stock_reason_t='admin_adjust', p_note text?` | `product_variants` updated `available_qty` + `stock_movements` row | admin:staff | `VALIDATION`422 (would drive `stock_qty<0`), `NOT_FOUND`404. Single-variant manual adjust (GROOM-STOCK-01/04); emits `shop:{sid}:stock`. |
| **`bulk_adjust_variants`** | `p_changes jsonb[{variant_id, price?, stock_delta?, low_stock_threshold?}]` | `{updated_count}` + `stock_movements` per line | **admin:owner (step-up)** | `STEP_UP_REQUIRED`403, `FORBIDDEN`403(staff), `VALIDATION`422. Bulk price/stock = owner-only + step-up per ACC-ROLE-01 step-up list. Each line audited. |

### 1.12 Merchandising

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `upsert_banner` | `{id?, image_path, alt_text(req), headline, cta_label, cta_target_type cta_target_t, cta_target_id?, display_order, publish_state, active_from?, active_to?}` | `banners` row | admin:owner (staff may save draft, ENG-MERCH-05) | `FORBIDDEN`403, `BROKEN_CTA_TARGET`422, `MISSING_ALT`422, `VALIDATION`422. `image_path` from `request_banner_image_upload_url`. |
| `upsert_featured_section` | `{id?, title, see_all_target?, items[{product_id,order}], publish_state, display_order}` | `featured_sections` (+items) row | admin:owner (staff draft) | `FORBIDDEN`403, `VALIDATION`422 |

### 1.13 PDPA / consent (erasure step-up — finding-fixed)

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `get_consent_status` | (none) | rows `{purpose, current_version, granted, stale}` | authenticated | — (boot guard forces consent/re-consent). |
| `grant_consent` | `p_purpose consent_purpose_t, p_version text, p_source text` | `pdpa_consents` `{granted:true, granted_at}` | authenticated | `POLICY_VERSION_INVALID`422 (FK to `policy_versions`), `VALIDATION`422. `data_processing`+`marketing` never bundled. |
| `withdraw_consent` | `p_purpose consent_purpose_t` | `pdpa_consents` `{granted:false, withdrawn_at}` | authenticated | `VALIDATION`422; **`STEP_UP_REQUIRED`403 when `purpose='data_processing'`** (routes to account-deactivation path). `marketing` withdrawal immediate (stops marketing all channels, transactional untouched); `rider_location` withdrawal blocks rider work. |
| `request_data_export` | (none) | `data_requests` `{type:'export', status:'pending'}` | customer (self) | `DUPLICATE_REQUEST`409 (`partial uniq(user_id,type) where status in (pending,processing)`). Triggers `process-data-export` Edge fn. |
| `request_data_erasure` | (none) | `data_requests` `{type:'erasure', status:'pending'}` | customer (self) | **`STEP_UP_REQUIRED`403** (verifyOtp `type:'reauthentication'` required), **`HAS_OPEN_ORDERS`409 surfaced at request time**, `DUPLICATE_REQUEST`409. Records `step_up_verified` in audit. Processed by cron → `anonymize_user`. *(Resolves MEDIUM erasure re-auth, CUS-PROFILE-07.)* |
| `anonymize_user` | `p_user_id uuid` | `{is_anonymized:true, anonymized_at}`; PII nulled/hashed, order finance retained | system (erasure cron) ; admin:owner | `HAS_OPEN_ORDERS`409, `ALREADY_ANONYMIZED`409. Pushes `force_signout` on `user:{id}`. Retains stock/payment/refund finance (SEC-2). |

### 1.14 Media upload/read (finding-fixed — public + private)

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `request_slip_upload_url` | `p_order_id uuid` | `{upload_url, object_key}` key `{sid}/{order_id}/slips/{uuid}.jpg` | customer (own, awaiting_payment) | `NOT_FOUND`404, `NOT_AWAITING`409, `REORDER_REQUIRED`409 |
| `request_pod_upload_url` | `p_order_id uuid` | `{upload_url, object_key}` key `{sid}/{order_id}/pod/{uuid}.jpg` | rider (assigned, accepted) | `NOT_YOUR_JOB`403, `NOT_OUT_FOR_DELIVERY`409 |
| `request_refund_proof_upload_url` | `p_refund_id uuid` | `{upload_url, object_key}` key `{sid}/{order_id}/refund/{uuid}.jpg` | admin:owner | `NOT_FOUND`404, `FORBIDDEN`403 |
| **`request_avatar_upload_url`** | (none) | `{upload_url, object_key}` key `{sid}/avatars/{user_id}.webp` | authenticated (owner of row) | `VALIDATION`422. Then client sets `app_users.avatar_path`/`rider_profiles.photo_path` via `edit_rider` / profile update (RID-AUTH-06). |
| **`request_product_image_upload_url`** | `p_product_id uuid` | `{upload_url, object_key}` key `{sid}/products/{product_id}/{uuid}.webp` | admin:staff | `NOT_FOUND`404, `FORBIDDEN`403. Returned key feeds `product_images.storage_path` (ENG-MERCH-01). |
| **`request_banner_image_upload_url`** | (none) | `{upload_url, object_key}` key `{sid}/banners/{uuid}.webp` | admin:owner (staff draft) | `FORBIDDEN`403. Key feeds `upsert_banner.image_path` (ENG-MERCH-02). |
| `get_media_signed_url` | `p_kind media_kind_t, p_object_id uuid` | `{signed_url, expires_at}` | customer (own), admin:* (shop), rider (own POD within `rider_pii_window`) | `NOT_FOUND`404, `FORBIDDEN`403, `RETENTION_EXPIRED`410. TTL short (export uses `export_url_ttl_min`). |

> **Public-bucket write pattern.** `product-images`/`banners` (admin) and `avatars` (owner) use the signed-upload RPCs above; `storage.objects` has scoped **INSERT** policies validating the `{shop_id}/…` key prefix + caller role/ownership (admin for product-images/banners, owner for avatars). Reads are public/CDN for these three buckets (no signed URL needed). *(Resolves LOW avatar/public-upload.)*

### 1.15 Accounts / admin

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| **`activate_invited_account`** | (none) — invoked on first confirmed OTP login | `{account_state:'active'}` | rider/admin (self, currently `pending`, phone confirmed) | `NOT_PENDING`409, `PHONE_NOT_CONFIRMED`403. Flips invited `pending→active` and audits. Backed by an `app.handle_first_login()` trigger on `auth.users` phone-confirm; the RPC is the idempotent client-callable equivalent. *(Resolves LOW invite activation.)* |
| `edit_rider` | `p_rider_user_id uuid, p_display_name?, p_vehicle_type?, p_license_plate?, p_photo_path?` | updated `rider_profiles`/`app_users` (non-phone) | admin:owner | `FORBIDDEN`403, `NOT_FOUND`404, `VALIDATION`422. Phone change is separate (OTP re-verify; old valid until verified). |
| `deactivate_rider` | `p_rider_user_id uuid` | `{account_state:'deactivated', availability:'offline'}`; `force_signout` pushed | admin:owner | `ACTIVE_DELIVERY_BLOCK`409, `FORBIDDEN`403, `NOT_FOUND`404 |
| `reactivate_rider` | `p_rider_user_id uuid` | `{account_state:'active', availability:'offline'}` | admin:owner | `FORBIDDEN`403, `NOT_DEACTIVATED`409 |
| `change_admin_tier` | `p_admin_user_id uuid, p_tier admin_tier_t` | updated `app_users.admin_tier` (next request) | admin:owner (step-up) | `LAST_OWNER`422, `STEP_UP_REQUIRED`403, `FORBIDDEN`403, `NOT_FOUND`404. First/only admin forced owner. |
| `update_shop_settings` | `p_patch jsonb (delivery_fee, free_delivery_threshold, cod_enabled, cod_cap, payment_window_min, reservation_ttl_min, acceptance_window_sec, offline_threshold_sec, max_delivery_attempts, max_active_jobs_per_rider, quiet_hours_*, *_retention_days, rider_pii_window_hours, export_url_ttl_min, promo_rounding)` | updated `shop_settings` | admin:owner | `FORBIDDEN`403, `VALIDATION`422 (CHECK>=0). |

### 1.16 Notifications

| RPC | Params | Returns | CallableBy | Errors / notes |
|---|---|---|---|---|
| `mark_notifications_read` | `p_notification_ids uuid[]?(null=all)` | `{updated_count}` | authenticated (own recipients) | idempotent (sets `read_at`). |
| `register_push_token` | `p_token text, p_platform text` | `push_tokens` row | authenticated | `VALIDATION`422. Revoke on logout sets `revoked_at`. No PII. |

### 1.17 Crons (system / pg_cron — all idempotent)

| RPC | Returns | Notes |
|---|---|---|
| `expire_unpaid_orders` | `{cancelled_count}` | Cancels prepay past `payment_window` with no pending slip (reason=`payment_timeout`) + release reservation + notify; never touches `slip_uploaded`/`verifying` (paused) or COD or `payment_rejected`. |
| `expire_assignments` | `{expired_count}` | `pending_acceptance` past `acceptance_deadline` → `expired`, order back to `preparing`, admin notified (first-writer-wins vs same-instant accept). Also reconciles riders offline beyond `offline_threshold_sec`. |
| `purge_expired_media` | `{purged_count by bucket}` | Deletes `payment-slips/pod-photos/refund-slips/data-exports` past `retention_until` + audit (no PII). |
| `defer_quiet_hours_notifications` | `{released_count}` | Promotes `notification_deliveries` `scheduled_at<=now` (deferred)→send; collapses superseded states; urgent transactional bypasses quiet hours at creation. |
| `process_data_requests` | `{exports_done, erasures_done}` | Drives `request_data_export→process-data-export` and `request_data_erasure→anonymize_user`; `processing→completed`. |

---

## 2. PostgREST read patterns per surface (behind RLS)

### 2.1 Catalog (anon + all roles — public-ish read)
`categories, products, product_images, product_variants, banners, featured_sections, featured_section_items` are world-readable for **published, non-archived** rows.
- Grid: `GET /products?shop_id=eq.{sid}&publish_state=eq.published&archived_at=is.null&select=*,product_variants(price,available_qty,size,low_stock_threshold),product_images(storage_path,is_primary)&order=created_at.desc&limit=20` then keyset `&created_at=lt.<cursor>`.
- Category: `&category_id=eq.{cid}`. Price sort uses from-price → `products_with_from_price` view (`order=from_price.asc`). Search `&name=ilike.*{q}*` (or a ranking RPC).
- Banners: `GET /banners?publish_state=eq.published&active_from=lte.now&active_to=gte.now&order=display_order.asc`. **Out-of-stock derived from `available_qty`**, never raw `stock_qty`.

### 2.2 Customer surface (RLS scopes every row to `auth.uid()`)
- Orders: `GET /orders?customer_user_id=eq.{uid}&order=placed_at.desc&select=*,order_items(*),order_status_events(*),payments(status,amount,method),deliveries(rider_user_id,assignment_state,pod_captured_at),refunds(status,amount,promptpay_ref)`. Detail `&id=eq.{oid}`; status filter `&order_status=in.(...)`.
- Cart/wishlist/addresses: `carts?owner_user_id=eq.{uid}`, `cart_items?cart_id=eq.{cartId}`, `wishlist_items?user_id=eq.{uid}&order=added_at.desc`, `addresses?user_id=eq.{uid}` (writes via §1.10 RPCs).
- Notifications: **via membership only** — `GET /notification_recipients?user_id=eq.{uid}&order=created_at.desc&select=read_at,created_at,notifications(category,title,body,target_type,target_id)`. Unread `?read_at=is.null&select=id` + `Prefer: count=exact`.
- PDPA/prefs: `pdpa_consents?user_id=eq.{uid}`, `notification_preferences?user_id=eq.{uid}`, `data_requests?user_id=eq.{uid}`, `push_tokens?user_id=eq.{uid}`.
- Slip/POD/refund images **never** in row reads — only `get_media_signed_url`.
- `app_users` self: `?id=eq.{uid}`. Shop config subset (delivery_fee, free_delivery_threshold, payment_window_min, quiet_hours) via public `shop_public_settings` view.

### 2.3 Rider surface (PII via RPC, not RLS — finding-fixed)
- Assigned jobs (**PII-free**): `GET /deliveries?rider_user_id=eq.{uid}&assignment_state=in.(pending_acceptance,accepted)&order=assigned_at.desc&select=order_id,shop_mode:orders(shop_mode),assignment_state,acceptance_deadline,zone,batch_id,attempt_count`. **`deliveries` has no `ship_*` columns** (recipient PII lives on `orders`), so this read is inherently PII-free.
- **Order detail + recipient PII**: via **`get_assigned_delivery(p_order_id)`** RPC ONLY (§1.5) — returns items + `ship_*` gated to `assignment_state='accepted' AND now() < terminal_at + rider_pii_window_hours`. No direct `orders` SELECT policy grants riders `ship_*`.
- Available pool: sanitized REST view `available_jobs_v` (RLS `app_role='rider'` AND rider online) exposing `order_id, zone, item_count, item_summary, total_bucket, distance_hint` — **no recipient PII**. (Realtime signalling is on base `deliveries`, §3.)
- Shift/cash: `rider_shifts?rider_user_id=eq.{uid}&status=eq.open`, `shift_cash_entries?shift_id=eq.{shiftId}&order=created_at.asc`.
- Rider notifications: `notification_recipients?user_id=eq.{uid}`. `rider_profiles?user_id=eq.{uid}` (availability written via `set_rider_availability`).
- Customer phone via `request_contact_proxy` only.

### 2.4 Admin web (staff + owner, shop-scoped)
- Order queue: `GET /orders?shop_id=eq.{sid}&order_status=in.(placed,awaiting_payment,slip_uploaded,payment_verifying,confirmed,preparing,assigned_to_rider,out_for_delivery,picked_up,in_transit)&order=placed_at.desc` ([RECON-FLASH] picked_up/in_transit = online in-flight). Detail embeds `order_items, payments, payment_slips(metadata), deliveries, parcel_shipments, delivery_assignments, order_status_events`.
- **Slip queue**: `GET /orders?shop_id=eq.{sid}&payment_status=eq.slip_uploaded` (matches partial index + `shop:{sid}:slips`; now non-empty because `attach_payment_slip` lands at `slip_uploaded`) + `payment_slips?is_active=eq.true`.
- Catalog mgmt (incl. draft): `products?shop_id=eq.{sid}` (no publish filter), `product_variants`, `stock_movements?variant_id=eq.{vid}&order=created_at.desc`. Low-stock: variants where `available_qty<=low_stock_threshold`. Writes via §1.11 RPCs.
- Riders roster: `app_users?role=eq.rider&shop_id=eq.{sid}` + `rider_profiles`; shifts `rider_shifts?shop_id=eq.{sid}`.
- Refunds: `refunds?shop_id=eq.{sid}&status=in.(owed,sent)`. Promo: `promo_codes?shop_id=eq.{sid}`.
- Notifications inbox: `notification_recipients?user_id=eq.{adminUid}`.
- **Owner-only** (RLS by `admin_tier` claim): `audit_log?shop_id=eq.{sid}&order=created_at.desc`; dashboard via `admin_dashboard_v`/RPC; `shop_settings`. **No blanket customer-PII read** — customer identity only via `orders` `ship_*` snapshot (populated for delivery **and online**, see `place_order`), never by joining `app_users`/`addresses`.

---

## 3. Realtime channel contracts

Postgres Changes for durable state; Broadcast for GPS/control; Presence for online/lock. Every private/broadcast/presence topic is authorized by RLS on `realtime.messages` (`realtime.topic()` vs `auth.uid()`/claims). Naming `entity:{id}[:facet]`.

| Topic | Transport | Payload | Authorization |
|---|---|---|---|
| `user:{uid}:notifications` | PG Changes (INSERT `notification_recipients`) | `{notification_id,category,title,target_type,target_id,created_at}` | `uid=auth.uid()` |
| customer order timeline (sub to `orders`,`payments`,`refunds`,`order_status_events`, RLS-filtered to own order) | PG Changes | changed row (RLS-pruned columns) | RLS: own order |
| `shop:{sid}:orders` | PG Changes (INSERT/UPDATE `orders`) | order row (admin columns) | `app_role=admin AND shop_id=sid` |
| `shop:{sid}:slips` | PG Changes (`orders.payment_status=slip_uploaded`, `payment_slips`) | slip metadata | admin of shop. **Filter `slip_uploaded` now matches `attach_payment_slip`'s landing state.** |
| `shop:{sid}:stock` | PG Changes (`product_variants`,`stock_movements`) | variant `available_qty` delta | admin of shop |
| `rider:{uid}:jobs` | PG Changes (`deliveries` where `rider_user_id=uid`) | **PII-free** delivery row (no `ship_*` — those aren't on `deliveries`) | `uid=auth.uid() AND app_role=rider`. Rider fetches PII via `get_assigned_delivery` after accept. |
| `shop:{sid}:available-jobs` | PG Changes on **base table `deliveries` where `is_available=true`** (NOT the view) | `{order_id, zone, is_available}` — PII-free; rider re-reads `available_jobs_v` over REST for `item_summary/total_bucket` | rider, online, of shop. *(Resolves MEDIUM view-CDC.)* |
| `delivery:{orderId}:location` | **Broadcast** (ephemeral) | `{lat,lng,heading,at}` ~5s | rider on that order (publish) + that order's customer (only while `out_for_delivery`) + shop admins (subscribe) |
| `shop:{sid}:riders` | **Presence** | `{rider_user_id, availability, at}` (driven by `set_rider_availability`) | shop admins read; rider self-tracks |
| `slip:{orderId}:lock` | **Presence** (hint only) | `{admin_user_id, at}` | shop admins; authoritative lock = `payments.locked_by` |
| `user:{uid}` (control) | **Broadcast** | `{type:'force_signout', reason}` / `{type:'consent_stale'}` | `uid=auth.uid()` |

POD geolocation is persisted (`deliveries.pod_lat/lng`); live GPS Broadcast is never written.

---

## 4. Storage contracts

`storage.objects` RLS = **deny-all baseline**; object-key prefix validated on INSERT; private reads only via `get_media_signed_url`.

| Bucket | Access | Object key | Write | Read |
|---|---|---|---|---|
| `product-images` | public read / admin write | `{sid}/products/{product_id}/{uuid}.webp` | admin via `request_product_image_upload_url` (+ INSERT policy on prefix) | public (CDN) |
| `banners` | public read / admin write | `{sid}/banners/{uuid}.webp` | admin via `request_banner_image_upload_url` | public |
| `avatars` | owner write / public-ish read | `{sid}/avatars/{user_id}.webp` | owner via `request_avatar_upload_url` | public (rider avatar at delivery) |
| `payment-slips` | **PRIVATE** | `{sid}/{order_id}/slips/{uuid}.jpg` | customer (own) via signed upload | `get_media_signed_url(payment_slip, slip_id)` → admin + owning customer; short TTL; purge `slip_retention_days` |
| `pod-photos` | **PRIVATE** | `{sid}/{order_id}/pod/{uuid}.jpg` | rider (accepted) via signed upload | own customer + admin; purge `pod_retention_days` |
| `refund-slips` | **PRIVATE** | `{sid}/{order_id}/refund/{uuid}.jpg` | admin:owner via signed upload | owning customer + admin |
| `data-exports` | **PRIVATE** | `{sid}/{user_id}/export/{request_id}.zip` | system | owner of request via signed URL, TTL `export_url_ttl_min` |

**Private upload flow.** (1) `request_*_upload_url` (RPC) verifies ownership+state → `{upload_url, object_key}`. (2) client PUTs bytes. (3) the registering RPC (`attach_payment_slip` / `complete_delivery(...,pod_photo_path)` / `record_refund_sent(...,proof_path)`) records the row, sets state, writes `retention_until`. **Read flow:** always `get_media_signed_url(kind, id)` — never expose object keys. **Public upload flow.** Same signed-upload RPC for the write step; the returned `object_key` is stored on `product_images.storage_path` / `banners.image_path` / `app_users.avatar_path` / `rider_profiles.photo_path`; reads are CDN.

---

## 5. Edge Function HTTP endpoints

HTTPS POST, JSON, TLS1.2+. PII never logged; correlation id returned. Auth-hook functions are HMAC-verified (not public).

| Function | Auth | Request | Response / notes |
|---|---|---|---|
| `send-sms-hook` | HMAC (Supabase Send-SMS hook) | `{user, sms:{otp, phone}}` | `200 {}` — forwards `otp` to Thai aggregator; logs only `{phone_hash, provider_msg_id}`, never OTP; per-IP throttle. Serves login OTP **and** step-up reauth SMS. |
| `auth-line-exchange` | PKCE; anon-callable | `{code, code_verifier, nonce, redirect_uri}` | `200 {access_token, refresh_token, expires_in, user_id}` — verifies LINE `id_token` (JWKS `access.line.me`, iss, aud=channel_id, nonce), Admin-API links/creates `auth.users`. Err `401 LINE_TOKEN_INVALID`. |
| `invite-rider` | JWT admin:owner + step-up | `{phone, display_name?, vehicle_type?, license_plate?}` | `201 {rider_user_id, account_state:'pending'}` — Admin-API creates `auth.users`(phone,unconfirmed)+`app_users(role=rider,pending)` `uniq(shop_id,phone)`. Err `DUPLICATE_RIDER/ROLE_CONFLICT`409. |
| `invite-staff` | JWT admin:owner + step-up | `{phone, admin_tier}` | `201 {admin_user_id, account_state:'pending'}` — enforces ≥1-owner + first-admin-forced-owner. |
| `expo-push-fanout` | service-role (DB webhook on `notification_deliveries` pending / cron) | `{delivery_ids:[uuid]}` or webhook payload | `200 {sent, failed, deferred}` — resolves `push_tokens`, respects `notification_preferences` + quiet hours + marketing consent (transactional bypasses), sends Expo Push (FCM/APNs), writes `notification_deliveries.status`+`attempts`. **Also the fallback dispatcher**: when a critical transactional push fails, resolves a `notif_channel_t` `sms`/`line` fallback (SMS via Thai aggregator, LINE via Messaging API) per `notification_preferences.sms_enabled/line_enabled`, writing `notification_deliveries(channel,status,attempts)`. SMS/LINE *delivery* is provider-flag-gated (SHOULD); the **fallback decision is wired in v1** (ENG-NOTIF-02 AC6). |
| `process-data-export` | service-role (from `request_data_export`/cron) | `{request_id}` | `200 {export_path, expires_at}` — assembles PDPA zip → `data-exports`, sets `data_requests.export_path/export_expires_at`, notifies user. |
| `generate-promptpay-qr` | JWT customer (own order) | `{order_id}` | `200 {emv_payload, amount, order_ref}` — EMVCo PromptPay from `shops.promptpay_id`+exact `orders.total`; blocked unless `awaiting_payment` (GROOM-PAY-11). |
| `request-step-up` | JWT (any privileged role) | `{}` | `200 {challenge_sent:true}` — triggers `reauthenticate()` (OTP via `send-sms-hook`); client completes `verifyOtp({type:'reauthentication',token})`. Sensitive RPC then sees fresh reauth and sets `audit_log.step_up_verified`. |

---

## 6. Uniform error model & idempotency

**Envelope.** RPCs `RAISE EXCEPTION` with a stable `ERRCODE` + JSON `DETAIL`; PostgREST surfaces it; the repository normalizes to:
```jsonc
{ "error": {
    "code": "OUT_OF_STOCK",          // stable machine code (never localize on it)
    "http_status": 409,
    "message_th": "สินค้าบางรายการไม่พอ",  // Thai-first display
    "retryable": false,
    "details": { "lines": [ { "variant_id": "…", "available": 2, "name_th": "ข้าวหอมมะลิ (5 กก.)" } ] },
    "correlation_id": "req_…"
} }
```
`message_th` is resolved from a central catalog keyed by `code` (+ interpolated `details`) so screens never hardcode Thai (NFR-I18N-01) and analytics use the `code` verbatim (NFR-OBS-01). Raw 5xx/stack → `SERVER_ERROR` ("เกิดข้อผิดพลาด กรุณาลองใหม่"), never shown raw (NFR-REL-01). **No PII** (phone/OTP/slip/address) ever appears in error payloads, logs, or correlation ids.

**Core code → HTTP → Thai:** `VALIDATION`422 · `UNAUTHENTICATED`401 · `FORBIDDEN`403 · `ACCOUNT_INACTIVE`403 · `CONSENT_REQUIRED`403 · `STEP_UP_REQUIRED`403 · `NOT_FOUND`404 · `STALE_WRITE`/`CONFLICT`409 · `OUT_OF_STOCK`409(+lines) · `EMPTY_CART`422 · `PROMO_INVALID`422 · `PROMO_MIN_SPEND`422 · `PROMO_USAGE_EXCEEDED`409 · `COD_NOT_ALLOWED`422 · `ONLINE_REQUIRES_PREPAY`422 · `PAYMENT_NOT_PAID`409 · `NOT_IN_SLIP_UPLOADED`409 · `NOT_IN_VERIFYING`409 · `SLIP_LOCKED`423 · `NOT_ACCEPTED`409 · `JOB_TAKEN`409 · `RIDER_UNAVAILABLE`409 · `MAX_ACTIVE_JOBS`409 · `NOT_AVAILABLE`409 · `POD_REQUIRED`422 · `CASH_MISMATCH`422 · `NO_OPEN_SHIFT`409 · `VARIANCE_REQUIRES_OWNER`403 · `ACTIVE_DELIVERY_BLOCK`409 · `LAST_OWNER`422 · `DUPLICATE_RIDER`409 · `ROLE_CONFLICT`409 · `DUPLICATE_CATEGORY`409 · `DUPLICATE_VARIANT`409 · `BROKEN_PUBLISH`422 · `BROKEN_CTA_TARGET`422 · `MISSING_ALT`422 · `HAS_OPEN_ORDERS`409 · `PROXY_UNAVAILABLE`503 · `REORDER_REQUIRED`409 · `RETENTION_EXPIRED`410 · `RATE_LIMITED`429 · `SERVER_ERROR`500.

**Idempotency.** `idempotency_key` (place_order) and `client_op_id` (delivery/cash/refund/merge/adjustment) make retries safe; a replayed key returns the **original committed result with HTTP 200** and `details.idempotent_replay=true`, never a second write or an error. Offline rider mutations queue locally and re-sync idempotently (NFR-REL-01). Crons are idempotent (each eligible row acted on at most once). OTP/step-up rate-limits live in Supabase Auth + `send-sms-hook` per-IP throttle; `429 RATE_LIMITED` carries backoff hints. Optimistic concurrency via `orders/products.row_version` → `STALE_WRITE`409; rider/assignment races resolve first-writer-wins on `deliveries`.

---

## 7. Mapping back to the data model
Authoritative payment state stays in `payments`; `orders.payment_status` is a trigger mirror (read-only to clients). Stock lifecycle (reserve@placed → commit@confirmed → release/restock@terminal) is entirely inside `place_order`/`approve_slip`/`advance_order`/`cancel_order`/`fail_delivery` + `adjust_stock`/`bulk_adjust_variants`, all writing the `stock_movements` ledger. Promo redemption serializes on a `promo_codes` row lock inside `validate_promo`/`place_order`. Refund lifecycle `owed→sent→confirmed→failed` lives in `record_refund_sent`/`confirm_refund`/`report_refund_not_received`/`mark_refund_failed`. COD cash lifecycle = `open_shift`/`complete_delivery`(collection)/`record_cash_adjustment`(reversal/adjustment)/`settle_shift`. PDPA erasure = `request_data_erasure`(step-up)→`process_data_requests`→`anonymize_user`. All retention purges are crons. Every name above matches `06-data-model.md` exactly (tables, columns, enums, realtime topics, buckets).

---

## 8. Versioning

- **Wire surface = RPC names + the error `code` set + Realtime topic grammar + bucket keys.** These are the contract; table columns can evolve behind RPCs without breaking clients.
- **Additive-first.** New params are added with defaults (clients keep working); new RPCs are added; new error `code`s extend the catalog (clients fall back to `SERVER_ERROR` copy for unknown codes but log the code).
- **Breaking changes** ship a parallel RPC (`fn_v2`) and migrate clients via EAS Update before retiring `fn`. Error `code`s are **never** repurposed (analytics depend on stable codes — NFR-OBS-01).
- **Scale-to NestJS (ADR-0001)** preserves this contract: the same RPC names become service endpoints and the same `code`/`message_th` catalog is reused, so the client Repository swap is the only change.
- **Enum changes** are owned by `06-data-model.md`; this contract references enum values verbatim and must be regenerated when the data model bumps an enum.

---

## 9. Changelog — verifier-finding resolutions

**HIGH (resolved):**
- **#1 Catalog/stock admin RPCs** — added `upsert_category`, `upsert_product`, `upsert_variant`, `set_publish_state`, `archive_product`, `adjust_stock` (admin:staff) + `bulk_adjust_variants` (admin:owner + step-up), each writing `stock_movements(admin_adjust)` + `audit_log` and resetting low-stock episode columns (§1.11). Public-image upload RPCs added (§1.14). Unblocks ADM-CAT, GROOM-STOCK admin side, `shop:{sid}:stock`, low-stock alerts, from-price view.
- **#2 Rider recipient-PII gating** — moved off RLS (which can't do cell/time gating) to `get_assigned_delivery` `SECURITY DEFINER` RPC returning `ship_*` only when `accepted AND now()<terminal_at+rider_pii_window_hours` (§1.5, §2.3). `rider:{uid}:jobs` payload is PII-free (`deliveries` carries no `ship_*`).
- **#3 Authenticated-cart write path** — added `add_cart_item`/`set_cart_item_qty`/`remove_cart_item`/`clear_cart`/`set_cart_mode`/`apply_cart_promo`/`remove_cart_promo` (§1.10), making the server cart authoritative for `place_order`; reconciled with `store/cart.ts` (guest-local → server read-through after merge).

**MEDIUM (resolved):**
- **Slip-state contradiction** — chose model (a): `attach_payment_slip` lands `payment_status='slip_uploaded'` (queue state); `claim_slip` transitions `slip_uploaded→verifying` (`NOT_IN_SLIP_UPLOADED` guard) and is the only path to `verifying`; `approve_slip`/`reject_slip` keep `NOT_IN_VERIFYING`. Slip queue filter, partial index, and `shop:{sid}:slips` now reference a real state (§1.1, §1.2, §1.3, §2.4, §3).
- **Phone-proxy** — added `request_contact_proxy` (RID-DLV-02 MUST, §1.5) with caller authorization, relay/dial-token return, and contact audit.
- **Rider availability** — added `set_rider_availability` gated by `rider_location` consent; maintains `is_available` + Presence (§1.6).
- **Erasure re-auth** — `request_data_erasure` now requires step-up + surfaces `HAS_OPEN_ORDERS` at request time; `withdraw_consent('data_processing')` also requires step-up (§1.13).
- **Everyday RLS-writable tables** — documented owner-RLS writes + added `upsert_address`/`set_default_address`/`delete_address`/`toggle_wishlist_item`/`update_notification_preferences` (§1.10).
- **SMS/LINE fallback sender** — `expo-push-fanout` extended to the fallback dispatcher (decision wired in v1; SMS/LINE delivery provider-flag-gated) (§5, §10.2 of `05`).
- **Realtime CDC on a view** — `shop:{sid}:available-jobs` now Postgres Changes on base `deliveries where is_available=true`; `available_jobs_v` kept for REST reads only (§3, §2.3).

**LOW (resolved):**
- Collected-COD reversal → `cancel_order` writes `shift_cash_entries(kind='reversal')`; post-settlement via `record_cash_adjustment` (§1.2, §1.7).
- Refund `sent→failed` → `mark_refund_failed` (§1.8).
- Invite `pending→active` → `activate_invited_account` + `handle_first_login` trigger (§1.15).
- Avatar/public-bucket upload → `request_avatar_upload_url`/`request_product_image_upload_url`/`request_banner_image_upload_url` + INSERT prefix policies (§1.14).
- [RECON-FLASH] Online (Flash) shipment → after paid, admin runs `create_flash_shipment` (stores `pno` in `parcel_shipments`); Flash status webhook → `apply_flash_webhook` (verifies via re-call `routes`) drives `order_status` (picked_up/in_transit/out_for_delivery/delivered/returned). Address required for online (parcel) — `ship_*` fully populated for delivery and online (§1.2, §2.4, ADR-0003).

**Residual open items (carried, business/legal-gated):** post-settlement cash-reversal accounting target (next-shift adjustment is specified; final target pending DPO); COD physical-decrement milestone (`confirmed` vs `delivered` — v1 = confirmed); retention numbers + erase-vs-anonymize for finance; data residency DPA; minors/age consent; SMS/LINE provider sign-off; column-level encryption for `phone`/`bank_ref`.