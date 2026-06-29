# 06 — Data Model (Supabase / Postgres) — v1 FINAL

> Phase 2 (Design). ที่มา: designer → 3 reviewers (integrity / security-PDPA / coverage) → สังเคราะห์รวม findings
> Backend = Supabase managed Postgres (ADR-0001), Singapore region. 40 ตาราง + RPC + RLS + Realtime + Storage   <!-- [RECON-FLASH] +parcel_shipments -->
> **เวอร์ชันนี้รวมการแก้จากรีวิวแล้ว** — ดู §Changelog ท้ายเอกสารว่าแก้อะไรปิด finding ไหน

## Conventions
- ทุกตาราง PK `id uuid default gen_random_uuid()` (เว้นที่ระบุ); `created_at/updated_at timestamptz default now()`
- `auth.users` = identity anchor; `app_users.id = auth.users.id`
- ตาราง shop-scoped มี `shop_id` (v1 มี shop เดียว, FK พร้อมขยาย multi-shop)
- **เงิน = THB integer** (ไม่ใช้สตางค์); ทุกคอลัมน์เงินมี CHECK `>= 0`
- **State writes ผ่าน SECURITY DEFINER RPC เท่านั้น** (REVOKE direct UPDATE บนตาราง orders/payments/variants/catalog) — RLS ใช้คุม SELECT + ป้องกัน cross-tenant; mutation ที่ถูกต้อง/atomic อยู่ใน RPC
- ทุก SECURITY DEFINER function: `SET search_path = ''` (ชื่อ fully-qualified) + `REVOKE EXECUTE FROM public/anon` แล้ว grant ตาม role [แก้ SEC-DEFINER finding]

## ENUMS
```
role_t              = customer | admin | rider
admin_tier_t        = owner | staff
account_state_t     = pending | active | deactivated
shop_mode_t         = delivery | online   -- [RECON-FLASH] pickup→online: online = ส่งพัสดุทั่วประเทศผ่าน Flash (ADR-0003), ไม่ใช่รับที่ร้าน
payment_method_t    = promptpay_slip | cod
payment_status_t    = awaiting_payment | slip_uploaded | verifying | paid | rejected
order_status_t      = placed | awaiting_payment | slip_uploaded | payment_verifying | confirmed |
                      preparing | assigned_to_rider | out_for_delivery | delivered |
                      picked_up | in_transit | returned | cancelled | payment_rejected | delivery_failed
                      -- [RECON-FLASH] ลบ ready_for_pickup; picked_up=Flash รับพัสดุ(code1), in_transit=ขนส่งระหว่างศูนย์(code2),
                      --   returned=ตีกลับ(code7); assigned_to_rider=delivery เท่านั้น. map Flash code 1-9 ดู lib/flash.ts
assignment_state_t  = pending_acceptance | accepted | declined | expired   -- Delivery sub-state, ไม่ใช่ OrderStatus
assignment_source_t = admin_push | self_accept
rider_availability_t= online | offline
shift_status_t      = open | settled
shift_entry_kind_t  = opening_float | collection | reversal | adjustment   -- [แก้ INT-6: enum แทน free text]
refund_status_t     = owed | sent | confirmed | failed
refund_reason_t     = cancelled | payment_rejected | delivery_failed | returned   -- [RECON-FLASH] parcel ตีกลับ
publish_state_t     = draft | published
promo_type_t        = percent | fixed_baht
promo_scope_t       = subtotal | delivery
consent_purpose_t   = data_processing | marketing | rider_location
notif_audience_t    = customer | admin | rider
notif_class_t       = transactional | marketing
notif_category_t    = order | payment | delivery | promo | shop | stock | refund | system
notif_channel_t     = in_app | push | sms | line
notif_delivery_status_t = pending | deferred | sent | failed   -- [แก้ COV: รองรับ quiet-hours/​backoff]
stock_reason_t      = reserve_placed | commit_confirmed | commit_understocked | release_cancel |
                      release_payment_rejected | release_expiry | restock_cancel |
                      restock_delivery_failed | admin_adjust   -- [แก้ INT-4: commit_understocked]
cancel_reason_t     = customer_request | out_of_stock | payment_timeout | undeliverable | shop_cancel | other
rider_decline_t     = busy | too_far | vehicle_issue | other
slip_reject_t       = amount_mismatch | unclear | not_found | duplicate | other
delivery_fail_t     = no_answer | no_recipient | wrong_address | refused | other
data_request_t      = export | erasure
data_req_status_t   = pending | processing | completed | cancelled
cta_target_t        = promo_collection | category | product | external
media_kind_t        = payment_slip | pod_photo | refund_proof | data_export   -- signed-URL mediation
```

## DOMAIN: Settings / Shop / Audit
```
shops
  id pk | name | slug uniq | timezone default 'Asia/Bangkok'
  promptpay_id | promptpay_name | active bool | created_at

shop_settings  (1 row/shop; owner-only via RPC)
  shop_id pk fk->shops
  delivery_fee int default 40 CHECK>=0 | free_delivery_threshold int default 200 CHECK>=0
  cod_enabled bool default true | cod_cap int null            -- COD order-value cap (GROOM-PAY-01)
  payment_window_min int default 30 | reservation_ttl_min int default 30
  acceptance_window_sec int default 120 | offline_threshold_sec int default 300
  max_delivery_attempts int default 3 | max_batch_size int default 4
  max_active_jobs_per_rider int null | low_stock_default_threshold int default 5
  quiet_hours_start time default '22:00' | quiet_hours_end time default '08:00'
  promo_rounding text default 'floor'          -- [แก้ INT-low: pin rounding ใช้ร่วม validate/redeem]
  slip_retention_days int default 365 | pod_retention_days int default 90
  rider_pii_window_hours int default 6 | export_url_ttl_min int default 15  -- [แก้ SEC retention/exposure]
  sla_thresholds jsonb | updated_at | updated_by fk->app_users

shop_hours
  id pk | shop_id fk | weekday smallint(0-6) | open_time time | close_time time | uniq(shop_id, weekday)

audit_log  (append-only; ไม่มี UPDATE/DELETE policy; owner-read)
  id pk | shop_id fk | actor_user_id fk null | actor_role role_t | actor_tier admin_tier_t null
  action text | target_table text | target_id text
  summary text                       -- [แก้ SEC-3: คำอธิบายแบบไม่มี PII แทน before/after ดิบ]
  changed_fields text[] null          -- ชื่อฟิลด์ที่เปลี่ยน (ไม่เก็บค่า PII)
  step_up_verified bool default false -- [แก้ COV: ADM-AUTH-06 freshness-of-auth]
  reason text | created_at
  -- ห้ามใส่ phone/OTP/slip/before-after ดิบ; PII-by-id เท่านั้น
  idx (shop_id, created_at desc), idx (target_table, target_id)
```

## DOMAIN: Identity / Roles / PDPA
```
app_users  (id = auth.users.id)
  id pk fk->auth.users(id) on delete cascade
  shop_id fk->shops | role role_t default 'customer'
  admin_tier admin_tier_t null   CHECK ((role='admin') = (admin_tier is not null))
  account_state account_state_t default 'active'
  display_name text | email citext null | phone text null
  avatar_path text null | locale text default 'th-TH'
  is_anonymized bool default false              -- [แก้ SEC-2: PDPA erasure = anonymise]
  deactivated_at null | anonymized_at null
  preferred_shop_mode shop_mode_t null          -- [แก้ COV: CUS-MODE-02 persist mode]
  created_at | updated_at
  uniq (shop_id, phone) where phone is not null and is_anonymized=false
  idx (shop_id, role, account_state)
  -- ≥1 owner ต้องคงอยู่ (บังคับใน RPC, ACC-ROLE-02)

policy_versions
  id pk | shop_id fk | purpose consent_purpose_t | version text | body_th text | published_at
  uniq (shop_id, purpose, version)

pdpa_consents  (ENG-NOTIF-03 = แหล่งความจริงเดียวของ marketing consent)
  id pk | user_id fk | purpose consent_purpose_t
  policy_version text fk->policy_versions(version composite)  -- [แก้ SEC-low: FK ไป policy_versions]
  granted bool | granted_at | withdrawn_at null | source text
  idx (user_id, purpose, granted_at desc)   -- latest row = current state

data_requests  (CUS-PROFILE-06/07)
  id pk | user_id fk | type data_request_t | status data_req_status_t default 'pending'
  requested_at | completed_at null | export_path null | export_expires_at null
  partial uniq (user_id, type) where status in ('pending','processing')

push_tokens
  id pk | user_id fk | token text uniq | platform text | created_at | revoked_at null

notification_preferences  (channel routing เท่านั้น — consent อยู่ที่ pdpa_consents)
  user_id pk fk | push_enabled bool default true | sms_enabled bool default false
  line_enabled bool default false | quiet_hours_start time null | quiet_hours_end time null | timezone text

rider_profiles
  user_id pk fk->app_users(role=rider)
  vehicle_type text null | license_plate text null | photo_path text null
  availability rider_availability_t default 'offline' | availability_updated_at
  idx (availability) where availability='online'
```

## DOMAIN: Addresses (PDPA personal data)
```
addresses
  id pk | user_id fk->app_users
  label | recipient_name | recipient_phone
  address_line | subdistrict | district | province | postal_code char(5) CHECK ~ '^[0-9]{5}$'
  note null | lat double precision null | lng double precision null | zone text null
  is_default bool default false | created_at | updated_at
  partial uniq (user_id) where is_default
  idx (user_id)
```

## DOMAIN: Catalog (per-size variant = own price+stock)
```
categories
  id pk | shop_id fk | name | slug | display_order int default 0 | created_at | uniq(shop_id, name)

products
  id pk | shop_id fk | category_id fk
  name | subtitle | description | rating numeric(2,1) default 0
  publish_state publish_state_t default 'draft' | archived_at null
  orderable_delivery bool default true | orderable_online bool default true   -- [RECON-FLASH] pickup→online
  row_version int default 0 | created_at | updated_at
  idx (shop_id, publish_state) where archived_at is null; idx (category_id)

product_images
  id pk | product_id fk | storage_path | alt_text
  display_order int default 0 | is_primary bool default false
  partial uniq (product_id) where is_primary

product_variants
  id pk | product_id fk
  size text null | size_key generated always as (coalesce(size,'default')) stored
  price int CHECK > 0 | stock_qty int default 0 CHECK >= 0
  reserved_qty int default 0 CHECK >= 0 | low_stock_threshold int default 5
  available_qty generated always as (greatest(0, stock_qty - reserved_qty)) stored
  low_stock_alerted_at null | out_of_stock_alerted_at null   -- [แก้ COV: low-stock episode reset]
  uniq (product_id, size_key)
  idx (product_id) ; idx where available_qty <= low_stock_threshold

stock_movements  (append-only ledger)
  id pk | variant_id fk | order_id fk null
  delta_stock int | delta_reserved int | reason stock_reason_t
  actor_user_id fk null | created_at
  idx (variant_id, created_at), idx (order_id)
```

## DOMAIN: Cart & Wishlist
```
carts  (ACC-MERGE-01 merge target)
  id pk | shop_id fk | owner_user_id fk uniq
  shop_mode shop_mode_t null | applied_promo_code_id fk->promo_codes null  -- [แก้ COV: ACC-MERGE preserve]
  updated_at

cart_items
  id pk | cart_id fk | variant_id fk->product_variants  -- [แก้ INT-low: drop product_id, derive via variant]
  qty int CHECK > 0 | added_at | uniq (cart_id, variant_id)

wishlist_items
  id pk | user_id fk | product_id fk | added_at
  uniq (user_id, product_id) ; idx (user_id, added_at desc)
```

## DOMAIN: Orders
```
orders
  id pk | shop_id fk | customer_user_id fk
  order_number text | shop_mode shop_mode_t | payment_method payment_method_t
  order_status order_status_t default 'placed'
  payment_status payment_status_t default 'awaiting_payment'  -- [แก้ INT-1: MIRROR ของ payments, trigger-maintained]
  subtotal int CHECK>=0 | delivery_fee int default 0 CHECK>=0
  discount_amount int default 0 CHECK>=0 | total int CHECK>=0
  CHECK (total = subtotal + delivery_fee - discount_amount)   -- [แก้ INT-5]
  promo_code_id fk->promo_codes null
  address_id fk->addresses null on delete set null            -- [แก้ INT-8: PDPA erasure ไม่ block]
  ship_recipient | ship_phone | ship_address_text | ship_lat | ship_lng   -- snapshot (fulfillment คงอยู่หลังลบ address)
  cancel_reason cancel_reason_t null | cancel_note null
  placed_at | confirmed_at null | preparing_at null | shipped_at null   -- [RECON-FLASH] ready_for_pickup_at→shipped_at (ส่งเข้า Flash)
  out_for_delivery_at null | delivered_at null | picked_up_at null | terminal_at null
  idempotency_key text null | row_version int default 0
  CHECK: online ⇒ payment_method='promptpay_slip'             -- [RECON-FLASH] online (Flash) = prepay only ใน v1 (Flash COD เปิดภายหลัง); cod ⇒ delivery
  uniq (shop_id, order_number)                                -- [แก้ INT-9: per-shop scope]
  uniq (shop_id, idempotency_key) where idempotency_key is not null
  idx (shop_id, order_status, placed_at desc); idx (customer_user_id, placed_at desc)
  idx (shop_id, payment_status) where payment_status='slip_uploaded'

order_number_seq  (per-shop human-code generator — [แก้ INT-9])
  shop_id pk fk | next_val bigint default 1   -- incremented row-locked ใน place_order

order_items
  id pk | order_id fk | product_id fk null | variant_id fk null
  name_snapshot | size_snapshot null | unit_price int CHECK>=0 | qty int CHECK>0
  line_total generated always as (unit_price * qty) stored    -- [แก้ INT-5: derived]

order_status_events  (append-only timeline + KPI)
  id pk | order_id fk | from_status null | to_status order_status_t
  actor_user_id fk null | actor_role role_t null | is_system bool default false
  reason | created_at | idx (order_id, created_at)

order_ratings
  order_id pk fk | rating smallint CHECK 1..5 | comment null | created_at
```

## DOMAIN: Payment — SENSITIVE
```
payments  (1:1 order — AUTHORITATIVE payment state; [แก้ INT-1])
  order_id pk fk->orders | method payment_method_t | status payment_status_t
  amount int CHECK>=0 | paid_at null | funds_received bool default false
  locked_by fk null | locked_at null | updated_at
  -- AFTER UPDATE trigger mirror status -> orders.payment_status (1 tx); orders.payment_status อ่านอย่างเดียว
  CHECK (amount = (select total from orders ... ))  -- ยืนยันใน RPC (cross-row ใช้ trigger/RPC)

payment_slips  (re-upload history; payment-slips PRIVATE bucket)
  id pk | order_id fk | storage_path | uploaded_by fk | uploaded_at
  observed_amount null | is_active bool default true
  reject_reason slip_reject_t null | reject_note null | verified_by fk null | verified_at null
  bank_ref null | retention_until null            -- [แก้ SEC retention]
  partial uniq (order_id) where is_active | idx (bank_ref)

refunds  (manual PromptPay owed→sent→confirmed→failed)
  id pk | order_id fk | shop_id fk | amount int CHECK>=0 | status refund_status_t default 'owed'
  reason refund_reason_t | promptpay_ref null | proof_path null  -- refund-slips PRIVATE
  created_by fk null | sent_by fk null | sent_at null | confirmed_at null | confirmed_by_customer bool
  not_received_reported_at null                   -- [แก้ COV: GROOM-PAY-08 'ยังไม่ได้รับ']
  created_at | partial uniq (order_id) where status <> 'failed'
```

## DOMAIN: Fulfilment — Delivery (rider) / Parcel (Flash) / Rider
```
-- shop_mode discriminates the 1:1 fulfilment row: delivery→`deliveries`, online→`parcel_shipments`.

parcel_shipments  (1:1 online order; Flash Express — [RECON-FLASH] ADR-0003)
  order_id pk fk->orders | shop_id fk
  courier text default 'Flash Express'
  tracking_no text null                            -- `pno` จาก Flash Create Order (POST /open/v3/orders); แทนเลขปลอม trackingNoFor()
  flash_state smallint null | flash_state_text text null   -- raw Flash code 1-9 (+label); map→order_status ผ่าน lib/flash.ts
  weight_g int null | express_category smallint null | article_category smallint null  -- ของสด = express_category 5 (Fruit)
  cod_amount int default 0                          -- v1 = 0 (prepay only); Flash codEnabled เปิดภายหลัง
  label_printed_at null                             -- pre_print PDF (ฝั่งแอดมิน)
  shipped_at null | delivered_at null | returned_at null | failed_at null
  failure_reason delivery_fail_t null               -- ใช้ enum เดียวกับ deliveries
  client_op_id uuid null                            -- idempotent create + webhook apply (กัน webhook ซ้ำ)
  uniq (tracking_no) where tracking_no is not null
  idx (shop_id, flash_state)
  -- NOTE: ไม่มี rider/GPS/POD/cash — Flash จัดการเอง. สถานะมาจาก webhook (verify ด้วยการ re-call routes ก่อนเชื่อ — ADR-0003)

deliveries  (1:1 delivery order — rider mode เท่านั้น)
  order_id pk fk->orders | shop_id fk | rider_user_id fk null
  is_available bool default false                 -- [แก้ INT-3: denormalized gate, maintained ใน RPC]
                                                  --   true เมื่อ order=preparing & rider null (partial index ใช้ได้จริง)
  assignment_state assignment_state_t null | assignment_source assignment_source_t null
  assigned_by fk null | assigned_at null | accepted_at null | acceptance_deadline null
  batch_id uuid null | zone text null
  attempt_count int default 0 | next_attempt_at null
  failure_reason delivery_fail_t null | failure_note null | failed_at null
  pod_photo_path null | pod_no_photo_reason null | pod_captured_at null
  pod_lat | pod_lng | delivered_at null | retention_until null   -- [แก้ SEC: POD retention]
  client_op_id uuid null                          -- [แก้ INT-2: idempotent delivered/​cash sync]
  idx (rider_user_id, assignment_state)
  partial idx (shop_id) where is_available        -- available pool (ใช้ได้จริงแล้ว)

delivery_assignments  (append-only history)
  id pk | order_id fk | rider_user_id fk | state assignment_state_t | source assignment_source_t
  assigned_by fk null | assigned_at | responded_at null | decline_reason rider_decline_t null | note
  idx (order_id, assigned_at)

rider_shifts  (cash float + settlement)
  id pk | shop_id fk | rider_user_id fk | status shift_status_t default 'open'
  opening_float int default 0
  expected_cash generated/derived from shift_cash_entries  -- [แก้ INT-6: derived, ไม่ใช่ counter มือ]
  actual_cash null | variance null
  variance_note text null | variance_accepted_by fk null   -- [แก้ COV: GROOM-PAY-06 owner accept]
  opened_at | opened_by fk | settled_at null | settled_by fk null
  partial uniq (rider_user_id) where status='open'

shift_cash_entries  (running tally; expected_cash = opening_float + Σcollection - Σreversal)
  id pk | shift_id fk | order_id fk null | amount int | kind shift_entry_kind_t  -- [แก้ INT-6: enum]
  client_op_id uuid null | created_at
  partial uniq (order_id) where kind='collection'   -- [แก้ INT-2: COD เก็บเงินครั้งเดียว/ออเดอร์]
  idx (shift_id)
```

## DOMAIN: Promo (atomic redemption)
```
promo_codes
  id pk | shop_id fk | code citext | type promo_type_t | value int CHECK>0
  max_discount null | min_spend int default 0 | scope promo_scope_t default 'subtotal'
  active_from null | active_to null | total_limit int null | per_user_limit int null
  total_redeemed int default 0 | active bool default true | created_by fk | created_at
  uniq (shop_id, code) | CHECK (type='percent' ⇒ value<=100)
  CHECK (total_limit is null or total_redeemed <= total_limit)   -- [แก้ INT-7]

promo_redemptions  (redemption + per-user cap — serialize ผ่าน lock promo_codes row ใน RPC)
  id pk | promo_code_id fk | user_id fk | order_id fk uniq
  amount_discounted int | redeemed_at | released_at null
  idx (promo_code_id, user_id) where released_at is null   -- [แก้ INT-7: per-user count กรอง active]
```

## DOMAIN: Notifications
```
notifications  (one entity, all surfaces)
  id pk | shop_id fk | audience notif_audience_t | classification notif_class_t
  category notif_category_t | title | body   -- ห้ามมี PII ดิบ (id + deep link เท่านั้น) [แก้ SEC]
  target_type null | target_id null | dedupe_key text uniq null
  created_at | idx (shop_id, audience, created_at desc)

notification_recipients  (fan-out + read-state)
  id pk | notification_id fk | user_id fk | read_at null | created_at  -- [แก้ COV: created_at สำหรับ paginate]
  uniq (notification_id, user_id) | idx (user_id, created_at desc) where read_at is null

notification_deliveries  (channel + fallback + scheduling)
  id pk | notification_id fk | user_id fk | channel notif_channel_t
  status notif_delivery_status_t default 'pending' | scheduled_at null  -- [แก้ COV: quiet-hours/backoff]
  attempts int default 0 | error null | last_attempt_at
```

## DOMAIN: Merchandising
```
banners
  id pk | shop_id fk | image_path | alt_text | headline
  cta_label text default 'ช้อปเลย' | cta_target_type cta_target_t | cta_target_id null | cta_url null
  display_order int default 0 | publish_state publish_state_t default 'draft'
  active_from null | active_to null | created_by fk
  idx (shop_id, publish_state, display_order)

featured_sections
  id pk | shop_id fk | title | see_all_target_type cta_target_t null | see_all_target_id null
  display_order int default 0 | publish_state publish_state_t default 'draft'

featured_section_items
  id pk | section_id fk | product_id fk | display_order int default 0 | uniq (section_id, product_id)
```

## RPC (SECURITY DEFINER, search_path='', role-granted)
| RPC | หน้าที่ | atomic guarantee |
|-----|--------|------------------|
| `place_order(...)` | สร้าง order + reserve stock + redeem promo + gen per-shop order_number | 1 tx; lock variant rows + promo_codes row; idempotency_key; floor reserve |
| `approve_slip` / `reject_slip` / `claim_slip` | ตรวจสลิป → payments.status (mirror→order) + commit/release stock | 1 tx; payments authoritative |
| `advance_order` / `cancel_order` | เปลี่ยน OrderStatus ตาม state machine + restock (delivery: assigned→out→delivered; **online: picked_up→in_transit→out→delivered/returned**) | row_version optimistic; restock ledger |
| `assign_rider` / `rider_respond` / `accept_available_job` | (delivery) มอบหมาย/รับงาน + set is_available | first-writer-wins บน deliveries |
| `start_run` / `complete_delivery` / `fail_delivery` | (delivery) out_for_delivery→delivered/​failed + POD + COD cash | client_op_id idempotent; floor(0) commit |
| `create_flash_shipment` / `apply_flash_webhook` | **(online)** สร้างพัสดุ Flash → เก็บ `pno` ใน parcel_shipments / apply สถานะจาก webhook → order_status (ผ่าน lib/flash map) | client_op_id idempotent; webhook **verify ด้วย re-call `routes`** ก่อนเชื่อ (sig อ่อน — ADR-0003) | [RECON-FLASH] |
| `settle_shift` | ปิดกะ: variance = actual − expected(derived) | owner-tier accept ถ้า variance≠0 |
| `record_refund_sent` / `confirm_refund` | refund owed→sent→confirmed | partial-uniq 1 open refund |
| `validate_promo` | apply-time ตรวจ + คำนวณส่วนลด (rounding ร่วม place_order) | shared rounding fn |
| `get_media_signed_url(kind, id)` | mint signed URL หลังเช็คสิทธิ์ความเป็นเจ้าของ | [แก้ SEC: ownership-checked, TTL สั้น] |
| `anonymize_user(user_id)` | PDPA erasure: anonymise PII คง order finance | [แก้ SEC-2: erasure path จริง] |
| `expire_unpaid_orders()` [cron] | ยกเลิก prepay เกิน payment_window + release stock | idempotent |
| `expire_assignments()` [cron] | assignment เกิน deadline → reassign | — |
| `purge_expired_media()` [cron] | ลบ slip/POD/export เกิน retention + audit | [แก้ SEC retention] |
| `defer_quiet_hours_notifications()` [cron] | ส่ง notification ที่ scheduled ถึงเวลา | — |

## RLS (สรุป)
- **customer:** เห็นเฉพาะ order/address/cart/wishlist/notification ของตัวเอง; `notifications` SELECT ผ่าน `notification_recipients` membership เท่านั้น (ไม่ใช่ audience) [แก้ SEC]; อ่าน slip/POD/refund ของตัวเองผ่าน signed URL เท่านั้น
- **rider:** เห็นเฉพาะ delivery ที่ assigned; **available pool เห็นแค่ zone + สรุปสินค้า ไม่เห็น PII ผู้รับ** จนกว่าจะ accept [แก้ SEC]; PII ผู้รับซ่อนหลัง terminal เกิน `rider_pii_window_hours`; ติดต่อลูกค้าผ่าน phone proxy/RPC
- **admin:** scope ตาม shop_id; owner vs staff gating (owner-only: ราคา, ลบ, settle variance, slip approve config); ไม่มี blanket read PII ลูกค้า — เห็นผ่าน order snapshot เท่านั้น [แก้ SEC]
- **catalog/price/stock mutation:** ผ่าน audited RPC (REVOKE direct UPDATE) → audit_log ทุกครั้ง [แก้ SEC-4]
- **Realtime Authorization (RLS บน `realtime.messages`):** ทุก private/broadcast/presence topic ต้อง authorize — customer join เฉพาะ `user:{own}` / `delivery:{ownOrder}:location`; rider เฉพาะ `rider:{self}` + pool ถ้า online; admin เฉพาะ shop ตัวเอง [แก้ SEC: GPS feed]

## Realtime plan
- **Durable (Postgres Changes, RLS-filtered):** order/payment/refund timeline ของลูกค้า; `shop:{id}:orders` (admin queue); `shop:{id}:slips`; `rider:{id}:jobs`; `shop:{id}:available-jobs`; `user:{id}:notifications`; stock (admin + PDP)
- **Ephemeral (Broadcast):** `delivery:{orderId}:location` GPS ไรเดอร์ (ไม่ persist — เฉพาะ POD geo ที่เก็บ) — **authorized to customer+rider+shop ของ order นั้นเท่านั้น**
- **Ephemeral (Presence):** `shop:{id}:riders` online/offline; `slip:{orderId}:lock` hint (authoritative lock = `payments.locked_by`)

## Storage buckets
| bucket | access | หมายเหตุ |
|--------|--------|---------|
| product-images | PUBLIC read / admin write | + thumbnails |
| banners | PUBLIC read / admin write | hero |
| avatars | owner write / public-ish read | รูปไรเดอร์โชว์ตอนส่ง |
| payment-slips | **PRIVATE** | signed URL สั้น, retention purge, bank PII |
| pod-photos | **PRIVATE** | customer(own)+admin, retention |
| refund-slips | **PRIVATE** | admin write, customer own read |
| data-exports | **PRIVATE** | owner read, signed URL หมดอายุ (export_url_ttl_min) |

**storage.objects RLS:** deny-all baseline; object key prefix `{shop_id}/{order_id}/...` ตรวจตอน insert; เข้าถึงผ่าน `get_media_signed_url` RPC เท่านั้น [แก้ SEC]

---

## Changelog (รวม findings จากรีวิว)
**High (แก้แล้ว):**
- **INT-1** payment state ซ้ำ 2 ที่ → `payments` เป็น authoritative, `orders.payment_status` เป็น mirror ผ่าน trigger (1 tx)
- **INT-2** COD offline idempotency → เพิ่ม `shift_cash_entries.client_op_id` + partial uniq(order_id) where kind='collection'; `deliveries.client_op_id`
- **INT-3** partial index บน deliveries อ้าง column ข้ามตาราง (สร้างไม่ได้) → denormalize `deliveries.is_available` maintained ใน RPC
- **SEC** ไรเดอร์เห็น PII ลูกค้าเกิน + available pool รั่ว → pool เห็นแค่ zone/สรุป, PII หลัง accept, phone proxy, ตัดสิทธิ์หลัง terminal+window
- **SEC** ไม่มี path ลบ PDPA → `anonymize_user()` RPC (anonymise PII คง finance)
- **SEC** audit_log เก็บ PII ถาวร → เก็บ `summary` + `changed_fields` (ไม่เก็บค่า PII ดิบ)
- **SEC** ราคา/สต็อก/auth ไม่มี audit path → mutation ผ่าน audited RPC, REVOKE direct UPDATE

**Medium (แก้แล้ว):** INT-4 (commit floor-at-0 + `commit_understocked`), INT-5 (order_items.line_total GENERATED + orders total CHECK), INT-6 (expected_cash derived + `shift_entry_kind_t` enum), INT-7 (promo cap: lock promo_codes row + filter released_at + CHECK), INT-8 (orders.address_id ON DELETE SET NULL), INT-9 (order_number per-shop uniq + seq table), SEC (storage.objects RLS + `get_media_signed_url`), SEC (Realtime authorization บน broadcast/presence GPS), SEC (marketing consent = pdpa_consents เป็น gate เดียว), SEC (SECURITY DEFINER search_path + role resolver), SEC (retention crons + columns), COV (carts.shop_mode/applied_promo, low-stock alert reset, notification_deliveries.scheduled_at, refunds.not_received, rider_shifts.variance_note/accepted_by, notification_recipients.created_at)

**[RECON-FLASH] (2026-06-29) — โหมด online = Flash Express, ไม่ใช่ pickup (ADR-0003):**
- `shop_mode_t` `pickup`→`online`; `products.orderable_pickup`→`orderable_online`; `orders.ready_for_pickup_at`→`shipped_at`; invariant `pickup⇒prepay`→`online⇒prepay`
- `order_status_t`: ลบ `ready_for_pickup`; เพิ่ม/นิยามใหม่ `picked_up`(Flash code1) `in_transit`(2) `returned`(7) — map Flash 1-9 ที่ `lib/flash.ts`; `assigned_to_rider`=delivery เท่านั้น
- ตารางใหม่ `parcel_shipments` (1:1 online order): `tracking_no(pno)`, `flash_state`, `weight_g`, `express_category`, ไม่มี rider/GPS/POD/cash
- RPC ใหม่ `create_flash_shipment` / `apply_flash_webhook` (webhook verify ด้วย re-call routes); `advance_order` รองรับ online courier transitions
- address required สำหรับ **ทั้ง** delivery และ online (parcel ต้องมีที่อยู่ — เลิก special-case "pickup ไม่มีที่อยู่"); `ship_*` snapshot ครบทั้งสองโหมด
- **ค้าง:** v1 online = prepay only (Flash COD เปิดภายหลัง); ค่าส่ง Flash จริงจาก `estimate_rate` แทน flat fee

**Residual open items (ขึ้นกับ business/legal):**
- COD physical stock decrement: commit ที่ `confirmed` หรือเลื่อนถึง `delivered` (GROOM-STOCK-03 ยังเปิด)
- Post-settlement cash reversal: COD ที่ flip cancelled/failed หลังปิดกะ → ต้องนิยาม adjustment target
- Retention periods ตัวเลขจริง (slip/POD/export/audit) + erase-vs-anonymise สำหรับ finance retention → รอ DPO
- Minors/age consent: ยังไม่มี DOB/guardian field
- Data residency cross-border (Supabase SG ↔ ผู้ใช้ไทย) → infra/legal (DPA)
- Recent searches (CUS-SEARCH-06): v1 device-local; ถ้า sync → เพิ่มตาราง + erasure scope
- Column-level encryption (phone, bank_ref): พิจารณา pgsodium/Vault ถ้าตีความ NFR-SEC-01 เข้ม
