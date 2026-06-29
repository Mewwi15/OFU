-- 0002_tables.sql
-- อู้ฟู่ (Oofoo) — full schema (all domains, all 3 surfaces).
-- Source of truth: docs/06-data-model.md, reconciled (RECON-FLASH, ADR-0003).
-- One shared Postgres; RLS (0003) + RPC (0004) layer on top. Forward-only.
-- Tables created in FK-dependency order.

-- ─────────────────────────────────────────────────────────────────────────────
-- Settings / Shop / Audit
-- ─────────────────────────────────────────────────────────────────────────────
create table shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  timezone        text not null default 'Asia/Bangkok',
  promptpay_id    text,
  promptpay_name  text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table app_users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  shop_id             uuid references shops(id),
  role                role_t not null default 'customer',
  admin_tier          admin_tier_t,
  account_state       account_state_t not null default 'active',
  display_name        text,
  email               citext,
  phone               text,
  avatar_path         text,
  locale              text not null default 'th-TH',
  is_anonymized       boolean not null default false,
  deactivated_at      timestamptz,
  anonymized_at       timestamptz,
  preferred_shop_mode shop_mode_t,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint admin_tier_iff_admin check ((role = 'admin') = (admin_tier is not null))
);
create unique index app_users_shop_phone_uq on app_users (shop_id, phone)
  where phone is not null and is_anonymized = false;
create index app_users_shop_role_state_ix on app_users (shop_id, role, account_state);

create table shop_settings (
  shop_id                   uuid primary key references shops(id),
  delivery_fee              int not null default 40 check (delivery_fee >= 0),
  free_delivery_threshold   int not null default 200 check (free_delivery_threshold >= 0),
  cod_enabled               boolean not null default true,
  cod_cap                   int,
  payment_window_min        int not null default 30,
  reservation_ttl_min       int not null default 30,
  acceptance_window_sec     int not null default 120,
  offline_threshold_sec     int not null default 300,
  max_delivery_attempts     int not null default 3,
  max_batch_size            int not null default 4,
  max_active_jobs_per_rider int,
  low_stock_default_threshold int not null default 5,
  quiet_hours_start         time not null default '22:00',
  quiet_hours_end           time not null default '08:00',
  promo_rounding            text not null default 'floor',
  slip_retention_days       int not null default 365,
  pod_retention_days        int not null default 90,
  rider_pii_window_hours    int not null default 6,
  export_url_ttl_min        int not null default 15,
  sla_thresholds            jsonb,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references app_users(id)
);

create table shop_hours (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id),
  weekday     smallint not null check (weekday between 0 and 6),
  open_time   time not null,
  close_time  time not null,
  unique (shop_id, weekday)
);

create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id),
  actor_user_id   uuid references app_users(id),
  actor_role      role_t not null,
  actor_tier      admin_tier_t,
  action          text not null,
  target_table    text,
  target_id       text,
  summary         text,            -- PII-free description (no raw before/after)
  changed_fields  text[],
  step_up_verified boolean not null default false,
  reason          text,
  created_at      timestamptz not null default now()
);
create index audit_log_shop_ix on audit_log (shop_id, created_at desc);
create index audit_log_target_ix on audit_log (target_table, target_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity / PDPA
-- ─────────────────────────────────────────────────────────────────────────────
create table policy_versions (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id),
  purpose       consent_purpose_t not null,
  version       text not null,
  body_th       text,
  published_at  timestamptz not null default now(),
  unique (shop_id, purpose, version)
);

create table pdpa_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app_users(id) on delete cascade,
  purpose         consent_purpose_t not null,
  policy_version  text,            -- references policy_versions.version (per shop+purpose); enforced in RPC
  granted         boolean not null,
  granted_at      timestamptz not null default now(),
  withdrawn_at    timestamptz,
  source          text
);
create index pdpa_consents_latest_ix on pdpa_consents (user_id, purpose, granted_at desc);

create table data_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app_users(id) on delete cascade,
  type            data_request_t not null,
  status          data_req_status_t not null default 'pending',
  requested_at    timestamptz not null default now(),
  completed_at    timestamptz,
  export_path     text,
  export_expires_at timestamptz
);
create unique index data_requests_open_uq on data_requests (user_id, type)
  where status in ('pending', 'processing');

create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_users(id) on delete cascade,
  token       text not null unique,
  platform    text,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create table notification_preferences (
  user_id           uuid primary key references app_users(id) on delete cascade,
  push_enabled      boolean not null default true,
  sms_enabled       boolean not null default false,
  line_enabled      boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end   time,
  timezone          text
);

create table rider_profiles (
  user_id                 uuid primary key references app_users(id) on delete cascade,
  vehicle_type            text,
  license_plate           text,
  photo_path              text,
  availability            rider_availability_t not null default 'offline',
  availability_updated_at timestamptz not null default now()
);
create index rider_profiles_online_ix on rider_profiles (availability) where availability = 'online';

-- ─────────────────────────────────────────────────────────────────────────────
-- Addresses (PDPA personal data) — structured (รองรับ Flash parcel)
-- ─────────────────────────────────────────────────────────────────────────────
create table addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app_users(id) on delete cascade,
  label           text,
  recipient_name  text not null,
  recipient_phone text not null,
  address_line    text not null,
  subdistrict     text,
  district        text,
  province        text,
  postal_code     char(5) check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  note            text,
  lat             double precision,
  lng             double precision,
  zone            text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index addresses_default_uq on addresses (user_id) where is_default;
create index addresses_user_ix on addresses (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog (per-size variant = own price + stock — D1/D2)
-- ─────────────────────────────────────────────────────────────────────────────
create table categories (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id),
  name          text not null,
  slug          text,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  unique (shop_id, name)
);

create table products (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id),
  category_id       uuid references categories(id),
  name              text not null,
  subtitle          text,
  description       text,
  rating            numeric(2,1) not null default 0,
  publish_state     publish_state_t not null default 'draft',
  archived_at       timestamptz,
  orderable_delivery boolean not null default true,
  orderable_online  boolean not null default true,   -- [RECON-FLASH] was orderable_pickup
  row_version       int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index products_shop_publish_ix on products (shop_id, publish_state) where archived_at is null;
create index products_category_ix on products (category_id);

create table product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  storage_path  text not null,
  alt_text      text,
  display_order int not null default 0,
  is_primary    boolean not null default false
);
create unique index product_images_primary_uq on product_images (product_id) where is_primary;

create table product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete cascade,
  size                text,
  size_key            text generated always as (coalesce(size, 'default')) stored,
  price               int not null check (price > 0),
  stock_qty           int not null default 0 check (stock_qty >= 0),
  reserved_qty        int not null default 0 check (reserved_qty >= 0),
  low_stock_threshold int not null default 5,
  available_qty       int generated always as (greatest(0, stock_qty - reserved_qty)) stored,
  low_stock_alerted_at    timestamptz,
  out_of_stock_alerted_at timestamptz,
  unique (product_id, size_key)
);
create index product_variants_product_ix on product_variants (product_id);
create index product_variants_lowstock_ix on product_variants (product_id)
  where available_qty <= low_stock_threshold;

-- ─────────────────────────────────────────────────────────────────────────────
-- Promo (before orders/carts — referenced by both)
-- ─────────────────────────────────────────────────────────────────────────────
create table promo_codes (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id),
  code            citext not null,
  type            promo_type_t not null,
  value           int not null check (value > 0),
  max_discount    int,
  min_spend       int not null default 0,
  scope           promo_scope_t not null default 'subtotal',
  active_from     timestamptz,
  active_to       timestamptz,
  total_limit     int,
  per_user_limit  int,
  total_redeemed  int not null default 0,
  active          boolean not null default true,
  created_by      uuid references app_users(id),
  created_at      timestamptz not null default now(),
  unique (shop_id, code),
  check (type <> 'percent' or value <= 100),
  check (total_limit is null or total_redeemed <= total_limit)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cart & Wishlist
-- ─────────────────────────────────────────────────────────────────────────────
create table carts (
  id                    uuid primary key default gen_random_uuid(),
  shop_id               uuid not null references shops(id),
  owner_user_id         uuid not null unique references app_users(id) on delete cascade,
  shop_mode             shop_mode_t,
  applied_promo_code_id uuid references promo_codes(id),
  updated_at            timestamptz not null default now()
);

create table cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references carts(id) on delete cascade,
  variant_id  uuid not null references product_variants(id),
  qty         int not null check (qty > 0),
  added_at    timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  added_at    timestamptz not null default now(),
  unique (user_id, product_id)
);
create index wishlist_user_ix on wishlist_items (user_id, added_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Orders
-- ─────────────────────────────────────────────────────────────────────────────
create table orders (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id),
  customer_user_id  uuid not null references app_users(id),
  order_number      text not null,
  shop_mode         shop_mode_t not null,
  payment_method    payment_method_t not null,
  order_status      order_status_t not null default 'placed',
  payment_status    payment_status_t not null default 'awaiting_payment',  -- mirror of payments (trigger)
  subtotal          int not null check (subtotal >= 0),
  delivery_fee      int not null default 0 check (delivery_fee >= 0),
  discount_amount   int not null default 0 check (discount_amount >= 0),
  total             int not null check (total >= 0),
  promo_code_id     uuid references promo_codes(id),
  address_id        uuid references addresses(id) on delete set null,
  ship_recipient    text,
  ship_phone        text,
  ship_address_text text,
  ship_lat          double precision,
  ship_lng          double precision,
  cancel_reason     cancel_reason_t,
  cancel_note       text,
  placed_at         timestamptz not null default now(),
  confirmed_at      timestamptz,
  preparing_at      timestamptz,
  shipped_at        timestamptz,        -- [RECON-FLASH] was ready_for_pickup_at (ส่งเข้า Flash)
  out_for_delivery_at timestamptz,
  delivered_at      timestamptz,
  picked_up_at      timestamptz,        -- [RECON-FLASH] = Flash รับพัสดุ
  terminal_at       timestamptz,
  idempotency_key   text,
  row_version       int not null default 0,
  check (total = subtotal + delivery_fee - discount_amount),
  -- [RECON-FLASH] online (Flash) = prepay only ใน v1; cod ⇒ delivery
  check (shop_mode <> 'online' or payment_method = 'promptpay_slip'),
  unique (shop_id, order_number)
);
create unique index orders_idempotency_uq on orders (shop_id, idempotency_key) where idempotency_key is not null;
create index orders_shop_status_ix on orders (shop_id, order_status, placed_at desc);
create index orders_customer_ix on orders (customer_user_id, placed_at desc);
create index orders_slip_queue_ix on orders (shop_id, payment_status) where payment_status = 'slip_uploaded';

create table order_number_seq (
  shop_id   uuid primary key references shops(id),
  next_val  bigint not null default 1
);

create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id),
  variant_id    uuid references product_variants(id),
  name_snapshot text not null,
  size_snapshot text,
  unit_price    int not null check (unit_price >= 0),
  qty           int not null check (qty > 0),
  line_total    int generated always as (unit_price * qty) stored
);
create index order_items_order_ix on order_items (order_id);

create table order_status_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  from_status   order_status_t,
  to_status     order_status_t not null,
  actor_user_id uuid references app_users(id),
  actor_role    role_t,
  is_system     boolean not null default false,
  reason        text,
  created_at    timestamptz not null default now()
);
create index order_status_events_ix on order_status_events (order_id, created_at);

create table order_ratings (
  order_id   uuid primary key references orders(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references product_variants(id),
  order_id      uuid references orders(id),
  delta_stock   int not null default 0,
  delta_reserved int not null default 0,
  reason        stock_reason_t not null,
  actor_user_id uuid references app_users(id),
  created_at    timestamptz not null default now()
);
create index stock_movements_variant_ix on stock_movements (variant_id, created_at);
create index stock_movements_order_ix on stock_movements (order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Payment (SENSITIVE)
-- ─────────────────────────────────────────────────────────────────────────────
create table payments (
  order_id        uuid primary key references orders(id) on delete cascade,
  method          payment_method_t not null,
  status          payment_status_t not null default 'awaiting_payment',
  amount          int not null check (amount >= 0),  -- = orders.total, enforced in RPC (cross-row)
  paid_at         timestamptz,
  funds_received  boolean not null default false,
  locked_by       uuid references app_users(id),
  locked_at       timestamptz,
  updated_at      timestamptz not null default now()
);

create table payment_slips (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  storage_path    text not null,
  uploaded_by     uuid references app_users(id),
  uploaded_at     timestamptz not null default now(),
  observed_amount int,
  is_active       boolean not null default true,
  reject_reason   slip_reject_t,
  reject_note     text,
  verified_by     uuid references app_users(id),
  verified_at     timestamptz,
  bank_ref        text,
  retention_until timestamptz
);
create unique index payment_slips_active_uq on payment_slips (order_id) where is_active;
create index payment_slips_bankref_ix on payment_slips (bank_ref);

create table refunds (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references orders(id),
  shop_id                 uuid not null references shops(id),
  amount                  int not null check (amount >= 0),
  status                  refund_status_t not null default 'owed',
  reason                  refund_reason_t not null,
  promptpay_ref           text,
  proof_path              text,
  created_by              uuid references app_users(id),
  sent_by                 uuid references app_users(id),
  sent_at                 timestamptz,
  confirmed_at            timestamptz,
  confirmed_by_customer   boolean not null default false,
  not_received_reported_at timestamptz,
  created_at              timestamptz not null default now()
);
create unique index refunds_open_uq on refunds (order_id) where status <> 'failed';

-- ─────────────────────────────────────────────────────────────────────────────
-- Fulfilment — Parcel (Flash) / Delivery (rider) / Rider
-- shop_mode discriminates the 1:1 fulfilment row: delivery→deliveries, online→parcel_shipments
-- ─────────────────────────────────────────────────────────────────────────────
-- [RECON-FLASH] online order = Flash Express parcel (ADR-0003); no rider/GPS/POD/cash
create table parcel_shipments (
  order_id          uuid primary key references orders(id) on delete cascade,
  shop_id           uuid not null references shops(id),
  courier           text not null default 'Flash Express',
  tracking_no       text,             -- Flash `pno` from Create Order
  flash_state       smallint,         -- raw Flash code 1-9
  flash_state_text  text,
  weight_g          int,
  express_category  smallint,         -- ของสด = 5 (Fruit)
  article_category  smallint,
  cod_amount        int not null default 0,
  label_printed_at  timestamptz,
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  returned_at       timestamptz,
  failed_at         timestamptz,
  failure_reason    delivery_fail_t,
  client_op_id      uuid
);
create unique index parcel_shipments_tracking_uq on parcel_shipments (tracking_no) where tracking_no is not null;
create index parcel_shipments_state_ix on parcel_shipments (shop_id, flash_state);

create table deliveries (
  order_id            uuid primary key references orders(id) on delete cascade,
  shop_id             uuid not null references shops(id),
  rider_user_id       uuid references app_users(id),
  is_available        boolean not null default false,
  assignment_state    assignment_state_t,
  assignment_source   assignment_source_t,
  assigned_by         uuid references app_users(id),
  assigned_at         timestamptz,
  accepted_at         timestamptz,
  acceptance_deadline timestamptz,
  batch_id            uuid,
  zone                text,
  attempt_count       int not null default 0,
  next_attempt_at     timestamptz,
  failure_reason      delivery_fail_t,
  failure_note        text,
  failed_at           timestamptz,
  pod_photo_path      text,
  pod_no_photo_reason text,
  pod_captured_at     timestamptz,
  pod_lat             double precision,
  pod_lng             double precision,
  delivered_at        timestamptz,
  retention_until     timestamptz,
  client_op_id        uuid
);
create index deliveries_rider_ix on deliveries (rider_user_id, assignment_state);
create index deliveries_available_ix on deliveries (shop_id) where is_available;

create table delivery_assignments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  rider_user_id   uuid not null references app_users(id),
  state           assignment_state_t not null,
  source          assignment_source_t not null,
  assigned_by     uuid references app_users(id),
  assigned_at     timestamptz not null default now(),
  responded_at    timestamptz,
  decline_reason  rider_decline_t,
  note            text
);
create index delivery_assignments_ix on delivery_assignments (order_id, assigned_at);

create table rider_shifts (
  id                    uuid primary key default gen_random_uuid(),
  shop_id               uuid not null references shops(id),
  rider_user_id         uuid not null references app_users(id),
  status                shift_status_t not null default 'open',
  opening_float         int not null default 0,
  -- expected_cash = opening_float + Σcollection − Σreversal — computed (view/RPC), not stored
  actual_cash           int,
  variance              int,
  variance_note         text,
  variance_accepted_by  uuid references app_users(id),
  opened_at             timestamptz not null default now(),
  opened_by             uuid references app_users(id),
  settled_at            timestamptz,
  settled_by            uuid references app_users(id)
);
create unique index rider_shifts_open_uq on rider_shifts (rider_user_id) where status = 'open';

create table shift_cash_entries (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null references rider_shifts(id) on delete cascade,
  order_id      uuid references orders(id),
  amount        int not null,
  kind          shift_entry_kind_t not null,
  client_op_id  uuid,
  created_at    timestamptz not null default now()
);
create unique index shift_cash_collection_uq on shift_cash_entries (order_id) where kind = 'collection';
create index shift_cash_shift_ix on shift_cash_entries (shift_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Promo redemptions (after orders)
-- ─────────────────────────────────────────────────────────────────────────────
create table promo_redemptions (
  id                uuid primary key default gen_random_uuid(),
  promo_code_id     uuid not null references promo_codes(id),
  user_id           uuid not null references app_users(id),
  order_id          uuid not null unique references orders(id) on delete cascade,
  amount_discounted int not null,
  redeemed_at       timestamptz not null default now(),
  released_at       timestamptz
);
create index promo_redemptions_user_ix on promo_redemptions (promo_code_id, user_id) where released_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────────────────────
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id),
  audience        notif_audience_t not null,
  classification  notif_class_t not null,
  category        notif_category_t not null,
  title           text not null,
  body            text,
  target_type     text,
  target_id       text,
  dedupe_key      text unique,
  created_at      timestamptz not null default now()
);
create index notifications_shop_ix on notifications (shop_id, audience, created_at desc);

create table notification_recipients (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id         uuid not null references app_users(id) on delete cascade,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (notification_id, user_id)
);
create index notification_recipients_unread_ix on notification_recipients (user_id, created_at desc) where read_at is null;

create table notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id         uuid not null references app_users(id) on delete cascade,
  channel         notif_channel_t not null,
  status          notif_delivery_status_t not null default 'pending',
  scheduled_at    timestamptz,
  attempts        int not null default 0,
  error           text,
  last_attempt_at timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Merchandising
-- ─────────────────────────────────────────────────────────────────────────────
create table banners (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id),
  image_path      text not null,
  alt_text        text,
  headline        text,
  cta_label       text not null default 'ช้อปเลย',
  cta_target_type cta_target_t,
  cta_target_id   text,
  cta_url         text,
  display_order   int not null default 0,
  publish_state   publish_state_t not null default 'draft',
  active_from     timestamptz,
  active_to       timestamptz,
  created_by      uuid references app_users(id)
);
create index banners_ix on banners (shop_id, publish_state, display_order);

create table featured_sections (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references shops(id),
  title               text not null,
  see_all_target_type cta_target_t,
  see_all_target_id   text,
  display_order       int not null default 0,
  publish_state       publish_state_t not null default 'draft'
);

create table featured_section_items (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references featured_sections(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  display_order int not null default 0,
  unique (section_id, product_id)
);
