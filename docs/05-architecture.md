# 05 — Architecture (อู้ฟู่ / Oofoo v1) — FINAL

> Phase 2 (Design). System architecture across the three client surfaces + the Supabase backend.
> Authoritative companions: `06-data-model.md` (schema/RPC/RLS/Realtime/Storage — names here MUST match it exactly),
> `07-api-contract.md` (the wire contract), `ADR-0001` (backend platform), `ADR-0002` (payment), `08-design-system.md` (tokens).
> This doc integrates the Auth/Session design and resolves the verifier's HIGH/MEDIUM findings (see §15 + `07` Changelog).

---

## 1. Purpose & scope

อู้ฟู่ v1 is a **single Thai grocery shop**, a real product, with three client surfaces over one Supabase backend (managed Postgres + Auth + Realtime + Storage + Edge Functions, Singapore region — ADR-0001):

| Surface | Stack | Audience | Hosting |
|---|---|---|---|
| **Customer app** | Expo SDK 54 / RN 0.81 / expo-router 6 (existing codebase) | ป้าสมศรี, น้องแนน — iOS + Android | App Store / Play |
| **Rider app** | Expo RN (SDK 54) | Own delivery riders | App Store / Play (internal/managed) |
| **Admin web** | React SPA (Vite) | เฮียอู้ฟู่ (owner) + staff | Vercel / Netlify |

**Architectural north star (ADR-0001):** Supabase is the *launch* platform; **NestJS-on-Postgres is the planned, non-destructive scale-to target** (same Postgres, zero data migration). Two invariants make that migration cheap:

1. **All business logic lives in Postgres** (`SECURITY DEFINER` RPCs), never in the client. Clients orchestrate; the database decides and enforces.
2. **Every client talks to the backend through a swappable Repository layer** — no screen imports `supabase-js`. Swapping Supabase for a NestJS REST/GraphQL gateway becomes a re-implementation of the repository interfaces, not a rewrite of screens.

---

## 2. System overview + topology

```
                                   ┌──────────────────────── CLIENTS ────────────────────────┐
   ┌───────────────────┐    ┌───────────────────┐    ┌────────────────────────┐
   │  CUSTOMER APP     │    │  RIDER APP        │    │  ADMIN WEB (React SPA) │
   │  Expo SDK54/RN081 │    │  Expo RN          │    │  Vite, Vercel/Netlify  │
   │  expo-router 6    │    │  job queue/POD/COD │    │  catalog/orders/slips  │
   └─────────┬─────────┘    └─────────┬─────────┘    └────────────┬───────────┘
             │  Repository layer (lib/data/*Repository) — the ONLY place supabase-js is referenced
             │  guest cache: SecureStore + zustand          offline queue: SQLite/MMKV (rider)
             ▼                          ▼                                ▼
   ╔═════════════════════════════════════════════════════════════════════════════════════╗
   ║                         SUPABASE (Singapore region) — ADR-0001                        ║
   ║                                                                                       ║
   ║  ┌──────────┐   ┌───────────────────┐   ┌───────────────┐   ┌─────────────────────┐ ║
   ║  │  Auth    │   │ PostgREST (REST)  │   │  Realtime     │   │  Storage (buckets)  │ ║
   ║  │  GoTrue  │   │  RLS-filtered     │   │  PgChanges /  │   │  public + PRIVATE   │ ║
   ║  │  phone   │   │  SELECT only      │   │  Broadcast /  │   │  signed-URL mediated│ ║
   ║  │  OTP +   │   │  + RPC (/rpc/*)   │   │  Presence     │   │                     │ ║
   ║  │  OIDC    │   └─────────┬─────────┘   └───────┬───────┘   └──────────┬──────────┘ ║
   ║  └────┬─────┘             │                     │                      │            ║
   ║       │  Auth Hooks       ▼                     │                      │            ║
   ║       │  ┌──────────────────────────────────────────────────────────────────────┐ ║
   ║       └─▶│   POSTGRES  — 39 tables · SECURITY DEFINER RPCs (all state writes)     │ ║
   ║          │   payments = authoritative · orders.payment_status = trigger mirror     │ ║
   ║          │   RLS (claim-filtered SELECT) · audit_log (append-only) · pg_cron        │ ║
   ║          └───────────────────────────────────┬──────────────────────────────────┘ ║
   ║                                               │ webhooks / cron triggers            ║
   ║  ┌────────────────────────────────────────────▼─────────────────────────────────┐  ║
   ║  │  EDGE FUNCTIONS  (Deno):                                                       │  ║
   ║  │  send-sms-hook · auth-line-exchange · invite-rider · invite-staff ·            │  ║
   ║  │  expo-push-fanout · process-data-export · generate-promptpay-qr · request-step-up│ ║
   ║  └───────┬───────────────┬──────────────────┬──────────────────┬─────────────────┘  ║
   ╚══════════╪═══════════════╪══════════════════╪══════════════════╪═════════════════════╝
              ▼               ▼                  ▼                  ▼
      Thai SMS aggregator  LINE OIDC      Expo Push (FCM/APNs)   PromptPay (EMVCo)
      (OTP + fallback)     /Messaging API
```

**Data-flow principles**
- **Reads** = PostgREST `SELECT` constrained by RLS (claim-filtered) + Realtime subscriptions. Never a write path.
- **Writes** = `POST /rpc/<fn>` to a `SECURITY DEFINER` function. Direct table `UPDATE` is `REVOKE`d on `orders/payments/product_variants/catalog`; RLS only governs `SELECT` + cross-tenant isolation there. A small set of personal tables (`carts/cart_items/wishlist_items/addresses/notification_preferences`) are owner-RLS-writable but are *also* fronted by thin RPCs where invariants need enforcing (see `07` §1).
- **Sensitive media** never appears in row reads — only via `get_media_signed_url`.
- **Background work** = `pg_cron` (idempotent SQL jobs) + Edge Functions invoked by DB webhooks/cron.

---

## 3. Backend platform & the scale-to path

- **Postgres is the application server.** Order placement, slip verification, stock reserve/commit/release, promo redemption, rider assignment, COD cash, refunds, PDPA erasure — all are atomic RPCs. This keeps multi-user concurrency correct (row locks, optimistic `row_version`, first-writer-wins) regardless of how many app instances call them (ADR-0001 driver #1).
- **Supabase services** map 1:1 to v1 needs: Auth (phone OTP + OIDC social), Realtime (order/rider live state), Storage (slips/POD/exports), Edge Functions (BYO SMS, LINE exchange, push fan-out, PromptPay QR), `pg_cron` (timeouts/retention).
- **Scale-to NestJS** (planned, non-destructive): the same Postgres stays; a NestJS API re-implements the RPC surface as service methods and the RLS intent as guards. Clients change *only* their Repository implementations. No table moves; `07-api-contract.md`'s versioning (§9) carries the same `code`-based error model across both.

---

## 4. Data-access / Repository layer (the swappable seam)

Every surface ships a `lib/data/` package of **interface + Supabase implementation** pairs. Screens depend on the interface only.

```
lib/
  supabase/client.ts              // createClient(url, anonKey, {auth:{storage, autoRefresh,...}}) — the ONLY import of supabase-js
  data/
    types.ts                      // DTOs mirroring 06 enums (canonical strings, never localized)
    errors.ts                     // ApiError envelope + code→message_th catalog (07 §6)
    CatalogRepository.ts          // interface
    OrderRepository.ts
    CartRepository.ts
    DeliveryRepository.ts
    PaymentRepository.ts
    AccountRepository.ts          // addresses, wishlist, prefs, consent, PDPA
    NotificationRepository.ts
    MediaRepository.ts            // signed upload/download URLs
    supabase/
      SupabaseCatalogRepository.ts  // implements via postgrest .from()/.rpc()
      SupabaseOrderRepository.ts
      ...
lib/auth/
    AuthRepository.ts             // interface (request-otp, verify-otp, social, linkIdentity, reauth, signOut)
    SupabaseAuthRepository.ts
    guards.ts                     // requireRole / requireTier / requireActive / requireConsent
```

**Rules** (enforced by lint + review):
1. No file outside `lib/supabase/` and `lib/data/supabase/` may import `@supabase/supabase-js`.
2. Repositories return **canonical DTOs**, never raw PostgREST rows; they normalize errors to the `ApiError` envelope (`07` §6) so screens render `message_th` from a catalog keyed by `code` (NFR-I18N-01, NFR-OBS-01).
3. RPC names and Realtime topic strings live as constants in `lib/data/supabase/*` only — the contract surface to swap.

This is shared (as a workspace package or duplicated module) across the three apps so the wire contract is defined once.

---

## 5. Customer app architecture (existing Expo / expo-router)

### 5.1 Folder structure (target)

Today `app/_layout.tsx` is a bare `Stack` with `(tabs)` + `product/[id]` and no auth. Target:

```
app/
  _layout.tsx           // SessionProvider + boot guard (session restore + consent re-check)
  (auth)/
    welcome.tsx         // social + phone buttons (a11y baseline ≥48dp, AA)
    phone.tsx  otp.tsx  // phone OTP
    consent.tsx         // PDPA data_processing gate / re-consent interstitial
    link.tsx            // link social to phone-anchored account
  (tabs)/               // GUEST-ALLOWED: browse, cart, mode, promo preview
    index.tsx search.tsx cart.tsx wishlist.tsx account.tsx
  (protected)/          // requireAuthed + requireConsent
    checkout.tsx orders/ addresses/ privacy/
  product/[id].tsx
```

Guest browses freely; the **checkout CTA is the auth gate** (§8.4). `(protected)` routes mount only when `status==='authed' && consentCurrent`.

### 5.2 State management
- **zustand** stores remain the UI state layer, but become **session-aware** and **server-backed** once authed:
  - `store/session.ts` — `useSession()` `{status, role, tier, accountState, consentCurrent}`, fed by `onAuthStateChange`.
  - `store/cart.ts` — guest mode = device-local persisted cart (de-seeded). Authed mode = **read-through cache of the server cart**; mutations call `CartRepository` (`add_cart_item`/`set_cart_item_qty`/`remove_cart_item`/`clear_cart`/`set_cart_mode`/`apply_cart_promo`), which is authoritative and re-validates `available_qty`. The legacy `productId+size` line id maps to one `product_variant` (`(cart_id, variant_id)` key). **Resolves verifier HIGH #3.**
  - `store/wishlist.ts` — **remove `SEED_IDS`** (`['1','3','5']`); guest = local set, authed = server via `toggle_wishlist_item` / reads `wishlist_items`.
  - `store/mode.ts` — **reconcile `'online' → 'pickup'`** to match canonical `shop_mode_t = delivery | pickup`; default `delivery`; persisted; authed value mirrors `app_users.preferred_shop_mode` / `carts.shop_mode`.
- Server data (catalog, orders, notifications) is fetched through repositories and cached with **TanStack Query** (stale-while-revalidate, offline cache), invalidated by Realtime events.

### 5.3 Navigation & guards
- `_layout.tsx` hosts `SessionProvider` and a boot guard: `getSession()` → restore or fail-safe-to-guest; then `get_consent_status()` → force `(auth)/consent` if `data_processing` missing/stale.
- Guard contract in `lib/auth/guards.ts` (shared across apps): `requireRole`, `requireTier`, `requireActive`, `requireConsent`. **Client guards are UX only — the server (RLS + RPC) is the enforcement boundary.**

### 5.4 Performance posture (NFR-PERF-01)
- Replace the current `ScrollView + .map()` home grid with a **virtualized `FlashList`**.
- `expo-image` with memory/disk cache + resized thumbnails (`product-images` served via CDN); skeletons within 300ms; branded placeholder offline.
- Keyset pagination on all hot lists (`07` §0); cold-start budget ≤3.0s p90.

---

## 6. Rider app architecture

### 6.1 Folder structure
```
app/
  (auth)/ welcome otp consent(rider_location) ...
  (rider)/
    queue.tsx           // assigned jobs + available pool (sanitized)
    delivery/[id].tsx   // active delivery; recipient PII fetched via get_assigned_delivery (post-accept)
    pod/[id].tsx        // proof-of-delivery capture
    shift.tsx           // open/settle shift, cash tally
    account.tsx
```

### 6.2 Root guard & availability
- Root guard: `requireRole('rider') && requireActive()`; otherwise sign out with a non-enumerating Thai message (RID-AUTH-01/05).
- **Availability is a separate, consent-gated gate** (not `account_state`): going online calls **`set_rider_availability('online')`**, which **rejects without `rider_location` consent** (`CONSENT_REQUIRED`), sets `rider_profiles.availability` + `availability_updated_at`, and is the single trigger that maintains `deliveries.is_available` eligibility and the `shop:{sid}:riders` Presence membership. **Resolves verifier MEDIUM (rider availability).**

### 6.3 Offline-tolerant flow (NFR-REL-01)
- A local **durable mutation queue** (SQLite/MMKV) holds COD-cash + delivered/failed updates created while offline. On reconnect they re-sync **idempotently** via `client_op_id` (`complete_delivery`/`fail_delivery`/cash entries are at-most-once; COD collection also guarded by `partial uniq(order_id) where kind='collection'`). No `OrderStatus` transition is lost.
- **Recipient PII** (`ship_recipient/ship_phone/ship_address_text`) is **never** read through RLS row reads. The active-delivery screen calls **`get_assigned_delivery(p_order_id)`** — a `SECURITY DEFINER` RPC that returns `ship_*` + item lines **only when** `assignment_state='accepted' AND now() < terminal_at + rider_pii_window_hours`, else nulls them. The `rider:{uid}:jobs` Realtime payload is PII-free (a `deliveries` row has no `ship_*` columns; those live on `orders`). **Resolves verifier HIGH #2.**
- Customer contact uses **`request_contact_proxy`** (masked/relay), never a raw phone (§8 / `07` §1).

### 6.4 Live GPS & POD
- While `out_for_delivery`, the rider **publishes** `{lat,lng,heading,at}` (~5s) on `delivery:{orderId}:location` **Broadcast** (ephemeral, never persisted). Only the POD geolocation is written (`deliveries.pod_lat/lng`).

---

## 7. Admin web architecture (React SPA)

### 7.1 Structure & stack
- Vite + React + React Router; same `lib/data/` repositories (web build of supabase-js). Hosted on Vercel/Netlify with strict CSP.
```
src/
  routes/  login  orders  order/[id]  slips  catalog  riders  shifts  refunds  promos  merch  settings(owner)  audit(owner)  dashboard(owner)
  data/    (shared repository interfaces) + supabase impls
  auth/    session, guards (requireTier('owner'))
```

### 7.2 Role/tier gating
- Route guard `requireRole('admin')`; owner-only routes `requireTier('owner')`. **Client gating mirrors the single ACC-ROLE-01 matrix 1:1**, but the server (RLS by `admin_tier` claim + live `app.current_user()` re-check in every owner-only RPC) is authoritative. Non-admin → access-denied page + API 403 + denied-attempt `audit_log` row.
- **Catalog & stock mutation** is fully RPC-backed (see `07` §1 new RPCs `upsert_category/upsert_product/upsert_variant/set_publish_state/archive_product/adjust_stock/bulk_adjust_variants`) — staff for create/edit/publish/archive + single-item stock; **owner + step-up** for bulk price/stock. Each writes `stock_movements(admin_adjust)` and `audit_log`. **Resolves verifier HIGH #1.**

### 7.3 Session security (no biometric on web)
- In-memory session + refresh token; idle 30m / absolute 12h (ADM-AUTH-05); server-side revocation; step-up re-auth for sensitive actions (§9).

---

## 8. Auth & Session (integrated)

> Full rationale in the Auth design; this is the load-bearing summary. `auth.users` is the **single identity anchor**; `app_users.id = auth.users.id`. Every method — phone OTP, LINE, Apple, Google — converges on one `auth.users` row.

### 8.1 Phone OTP — Supabase Auth `phone` + BYO Send-SMS hook
Keep Supabase Auth as the OTP engine (6-digit, ≤5min TTL, ≤5 attempts, per-phone/IP rate-limit, OTP never logged — NFR-SEC-01) but replace the built-in SMS sender with a **Send-SMS Auth Hook → `send-sms-hook` Edge Function → Thai aggregator** (no Supabase/Twilio markup). Client: `signInWithOtp({phone})` → `verifyOtp({phone, token, type:'sms'})`. `signInWithIdToken` is **not** used for phone (reserved for OIDC social).

### 8.2 Social
| Provider | Mechanism |
|---|---|
| Apple | `expo-apple-authentication` → `id_token` → `signInWithIdToken({provider:'apple', token, nonce})` (mandatory on iOS) |
| Google | `@react-native-google-signin` (native, public client id only) → `signInWithIdToken({provider:'google', ...})` |
| LINE | custom OIDC: `expo-auth-session` PKCE → `auth-line-exchange` Edge fn verifies LINE `id_token` (JWKS/iss/aud/nonce) → Admin-API link/create → Supabase session |

### 8.3 Session persistence
| Concern | Customer & Rider | Admin web |
|---|---|---|
| Token store | **expo-secure-store** chunked adapter (Keychain/Keystore — never AsyncStorage) | in-memory + refresh token, strict CSP |
| Refresh | `autoRefreshToken` + `AppState` start/stopAutoRefresh; `onAuthStateChange` drives router | silent refresh; idle 30m / absolute 12h |
| Restore | cold-start `getSession()` → valid skips welcome; refresh/tamper failure → **fail-safe to guest, cart preserved** | refresh failure → login |
| Logout | clear SecureStore + memory **even if server revoke fails**; reset to clean empty guest (mode→`delivery`) | server-side invalidation |
| Biometric | optional local app-lock (`expo-local-authentication` + `requireAuthentication` keychain item) — recommended-on for COD riders; **not** a server factor | none |

### 8.4 Guest → auth-at-checkout → merge
Guest cart/wishlist/mode are device-local (not PII). Checkout CTA snapshots `{items, shop_mode, promo}` + `returnTo`, routes to `(auth)`; on success: consent gate → **`merge_guest_cart` / `merge_guest_wishlist`** (server-side, idempotent on `client_op_id`, sum/clamp to `available_qty`, preserve `shop_mode`+promo) → return to exact checkout step. Abandon → guest intact, no merge.

### 8.5 PDPA consent gate
`data_processing` mandatory at signup (blocks app use); `marketing` separate optional opt-in (single source for marketing-notification gating, never bundled); `rider_location` mandatory to work as rider. Boot guard uses `get_consent_status()`; stale `policy_version` → re-consent interstitial. Withdrawal/export/erasure are first-class (`withdraw_consent`, `request_data_export`, `request_data_erasure` + step-up — `07` §1).

### 8.6 Account-merge policy
Phone = canonical customer identity; social = explicitly **linked** convenience identity via `supabase.auth.linkIdentity()` while authed. No silent cross-`auth.users` merge in v1; `uniq(shop_id, phone)` blocks duplicate active customers; collisions routed to "sign in then link." Cross-user data migration is out of v1 scope (risk §14).

---

## 9. Authorization model (security-critical, recursion-free)

**Two layers** so RLS never recurses and mutations never trust a stale token:

- **Layer A — JWT claims (cheap, for RLS `SELECT`).** A **Custom Access Token Auth Hook** (runs as `supabase_auth_admin`, BYPASSRLS) injects minimal claims `{app_role, admin_tier, account_state, shop_id}` at every token issue/refresh. RLS policies read `auth.uid()` + `auth.jwt()->>'…'` — **never** sub-select the guarded table (`app_users`' own SELECT policy is self-contained: `id=auth.uid()` + claim-based admin cross-read). No PII in tokens/logs/analytics.
- **Layer B — live re-check (for mutations).** Every state-writing RPC calls `app.current_user()` (BYPASSRLS helper reading `app_users` live) and rejects `account_state='deactivated'`, `is_anonymized=true`, or insufficient `admin_tier`. **Revocation/demotion takes effect on the next request** even before the JWT refreshes. Instant kick-out: a `user:{uid}` Broadcast `force_signout` event.

**Provisioning:** customers self-provision (trigger creates `app_users(role=customer, active)` on first auth). **Riders/admins are invite-first** (`invite-rider`/`invite-staff` Edge fns, owner + step-up, Admin-API create `auth.users(phone, unconfirmed)` + `app_users(pending)` with `uniq(shop_id, phone)`). First confirmed OTP login flips `pending→active` via an **`activate_invited_account` mechanism** (trigger on phone-confirm / first-login RPC), audited. **Resolves verifier LOW (activation).** `≥1-owner` and `first-admin-forced-owner` invariants are enforced in these RPCs (ACC-ROLE-01/02).

**Step-up re-auth** (ADM-AUTH-06) for sensitive actions (`approve_slip`/`reject_slip`, `record_refund_sent`/`mark_refund_failed`, `change_admin_tier`, bulk price/stock, `request_data_erasure`): `request-step-up` → `reauthenticate()` → `verifyOtp({type:'reauthentication'})`; the RPC requires reauth ≤ step-up window and writes `audit_log.step_up_verified=true`.

---

## 10. Realtime, Push, Background jobs

### 10.1 Realtime split (per data model)
- **Postgres Changes** (durable, RLS-filtered): customer order/payment/refund timeline; `shop:{sid}:orders`; `shop:{sid}:slips` (filters `payment_status='slip_uploaded'`); `shop:{sid}:stock`; `rider:{uid}:jobs` (PII-free payload); `shop:{sid}:available-jobs` (CDC on **base `deliveries` where `is_available=true`**, signalling pool change — riders re-read the sanitized `available_jobs_v` over REST; **a view cannot be a CDC source** — resolves verifier MEDIUM); `user:{uid}:notifications`.
- **Broadcast** (ephemeral): `delivery:{orderId}:location` GPS; `user:{uid}` control (`force_signout`/`consent_stale`).
- **Presence**: `shop:{sid}:riders` (online roster); `slip:{orderId}:lock` (hint only — authoritative lock = `payments.locked_by`).
- Every private/broadcast/presence topic is authorized by **RLS on `realtime.messages`** against `auth.uid()`/claims.

### 10.2 Push (Expo Push → FCM/APNs)
- `register_push_token` stores tokens; `expo-push-fanout` Edge fn (DB webhook on `notification_deliveries` pending / cron) resolves tokens, **respects `notification_preferences` + quiet hours + marketing consent** (transactional bypasses; marketing requires `pdpa_consents.marketing`), sends, and writes `notification_deliveries.status`/`attempts`.
- **SMS/LINE fallback (ENG-NOTIF-02 AC6):** the same dispatcher resolves a fallback channel (`notif_channel_t = sms|line`) when a **critical transactional** push cannot deliver — SMS via the Thai aggregator (reusing the `send-sms-hook` provider), LINE via the LINE Messaging API — gated by `notification_preferences.sms_enabled/line_enabled` and a provider flag. The **fallback decision is wired in v1**; SMS/LINE *delivery* ships behind a provider flag (SHOULD). **Resolves verifier MEDIUM (fallback sender).**

### 10.3 Background jobs (pg_cron + Edge)
Idempotent SQL crons: `expire_unpaid_orders`, `expire_assignments`, `purge_expired_media`, `defer_quiet_hours_notifications`, `process_data_requests`. Edge fns invoked by webhook/cron: `expo-push-fanout`, `process-data-export`. See `07` §1/§5.

---

## 11. Cross-cutting concerns

### 11.1 Security & privacy (NFR-SEC-01)
- TLS 1.2+ everywhere; no PII in tokens/logs/analytics/error payloads/correlation ids.
- **Server is the authz boundary**: RLS (claim-filtered SELECT) + `SECURITY DEFINER` RPCs (`SET search_path=''`, `REVOKE EXECUTE FROM public/anon`, role-granted). Direct UPDATE revoked on orders/payments/variants/catalog.
- Private buckets (`payment-slips`/`pod-photos`/`refund-slips`/`data-exports`) are deny-all baseline; **reads only via `get_media_signed_url`** (ownership-checked, short TTL), writes only via signed-upload RPCs (`07` §4); retention purge crons.
- Rider recipient-PII and customer phone are mediated by RPCs (§6.3, §8), never raw rows.
- Every mutation writes an `audit_log` row (actor id+role+tier, action, target, PII-free `summary`, `changed_fields`, `step_up_verified`).

### 11.2 Observability (NFR-OBS-01)
- Crash reporting (Sentry/Firebase — vendor TBD) on all three surfaces with release/version/OS/device + `Roles` tag, **never PII**.
- Structured funnel analytics on **canonical enums** (`app_open`, `mode_selected` ∈ `delivery|pickup`, `add_to_cart`, `checkout_started`, `order_placed`; order/payment lifecycle uses exact `OrderStatus`/`PaymentStatus` strings). No analytics before consent.
- Error `code` (not `message_th`) is the analytics key; alert when crash-free <99.5%; admin metric tracks slip-verification backlog.

### 11.3 Resilience / offline (NFR-REL-01)
- Cached catalog + cart viewable offline; selected `shop_mode` persists; friendly Thai empty states; graceful Thai errors (never raw 5xx → mapped to `SERVER_ERROR`).
- **Idempotency everywhere a retry can happen**: `place_order` (`idempotency_key`), delivery/cash/refund/merge (`client_op_id`), optimistic `row_version` → `STALE_WRITE`. Rider offline queue re-syncs idempotently. Crons are idempotent.

### 11.4 Config
- Operational tunables live in **`shop_settings`** (delivery fee, free-delivery threshold, COD cap/enabled, payment/reservation windows, acceptance/offline thresholds, max attempts/active-jobs, quiet hours, promo rounding, retention days, `rider_pii_window_hours`, `export_url_ttl_min`) — owner-editable via `update_shop_settings`, never hardcoded in clients. Secrets (SMS/LINE/Apple/Google keys, service-role) live in Supabase/Edge secrets, never in the bundle.

### 11.5 Deployment / CI-CD
- **DB**: migrations in `supabase/migrations`, applied via Supabase CLI in CI (staging → prod), with RLS + RPC tests (pgTAP) gating merge.
- **Mobile**: EAS Build + EAS Update (OTA for JS); store submissions per release; **cold-start + scroll-fps budgets measured and gate the pipeline** (NFR-PERF-01).
- **Admin web**: Vercel/Netlify preview per PR; prod on main.
- **Design tokens**: single source `theme/tokens.ts` (from `proposed/tokens.ts`); CI asserts **zero WCAG AA failures** on defined token pairs (NFR-A11Y-01) and blocks release on any failure.
- Edge Functions deployed via Supabase CLI; secrets via project config.

### 11.6 i18n (NFR-I18N-01)
- Thai-first; all copy from a central string catalog (current hardcoded Thai in `cart.tsx`/`index.tsx` externalized). Enum → Thai **display label** is separate from the canonical enum used in code/analytics. Error `message_th` resolved from a catalog keyed by error `code` (`07` §6). Money via `lib/format.ts money()` (THB integer).

### 11.7 Performance (NFR-PERF-01) — see §5.4; keyset pagination, virtualized lists, `expo-image`, skeletons, server `limit ≤ 50`.

---

## 12. NFR mapping

| NFR | How the architecture satisfies it |
|---|---|
| **A11Y-01/02/03** | single `theme/tokens.ts` + CI AA gate; ≥48dp targets & Thai a11y labels on shared UI; reduced-motion + dynamic-type in client components |
| **PERF-01** | virtualized lists, `expo-image` cache/resize, keyset pagination, skeletons, CI budget gate |
| **SEC-01** | RLS + DEFINER RPCs, REVOKE direct UPDATE, SecureStore tokens, private buckets + signed URLs, PDPA consent/erasure, no PII in tokens/logs |
| **REL-01** | idempotent RPCs (`idempotency_key`/`client_op_id`), optimistic `row_version`, offline rider queue, fail-safe-to-guest, Thai error/empty states |
| **OBS-01** | crash + funnel analytics on canonical enums, error `code` as key, consent-gated tracking, slip-backlog metric |
| **I18N-01** | central string catalog, enum↔label separation, `code`-keyed error catalog |
| **COMPAT-01** | Expo SDK 54 floors, safe-area insets, admin browser matrix + keyboard a11y, light/dark token sets |

---

## 13. Risks

- **R1 — LINE OIDC complexity.** Custom token-exchange (`auth-line-exchange`) is the riskiest auth path (JWKS/iss/aud/nonce verification, Admin-API session minting). Mitigate with contract tests + a feature flag to ship phone+Apple+Google first.
- **R2 — Cross-`auth.users` data merge.** v1 deliberately forbids silent merge; a customer who created both a phone and a social account cannot merge order history. Mitigate with "link from a session" UX; flag for v2.
- **R3 — Realtime fan-out cost/limits.** GPS Broadcast + per-shop channels grow with load; cap GPS cadence (~5s), scope channels tightly, monitor Supabase Realtime quotas.
- **R4 — SMS/LINE provider dependency.** OTP and fallback depend on a Thai aggregator + LINE OA; provider outage degrades login. Mitigate with per-IP throttle, provider failover slot, and Supabase Auth's native rate-limit/lockout.
- **R5 — Supabase lock-in vs scale-to.** Mitigated structurally by the Repository seam + logic-in-Postgres; NestJS migration is re-implementation, not rewrite.
- **R6 — Admin-web token hardening.** In-memory + refresh-token model deferred cookie/token-broker hardening (CSP only today) — revisit before public admin exposure.

## 14. Open items (architecture-level)

- COD physical stock-decrement milestone (`confirmed` vs `delivered`) — v1 commits at `confirmed` (GROOM-STOCK-03); confirm with stakeholders.
- Post-settlement COD cash-reversal target (next-shift adjustment vs shop-level) — partially specified (§ `07` §1 `record_cash_adjustment`), final accounting target pending.
- Final owner-2FA policy (phone-OTP-as-possession + mandatory step-up is the provisional control).
- Retention period numbers (slip/POD/export/audit) + erase-vs-anonymize for finance retention — pending DPO.
- Data residency (Supabase SG ↔ Thai users) DPA; minors/age consent; recent-searches sync scope; column-level encryption for `phone`/`bank_ref` (pgsodium/Vault) if NFR-SEC-01 is read strictly.
- Admin-web cookie/token-broker hardening (R6); reference-device list for PERF budgets; admin browser-matrix sign-off.

## 15. Verifier-finding resolution (summary)

All HIGH + MEDIUM findings are resolved in design; the detailed contract changes live in `07-api-contract.md` (§1 new RPCs, §2.3 rider RPC, §3 channels, §4 upload RPCs, §5 fallback) and its Changelog. Highlights: HIGH#1 catalog/stock RPCs (§7.2); HIGH#2 rider PII via `get_assigned_delivery` + PII-free realtime (§6.3, §9); HIGH#3 authed-cart RPCs (§5.2); slip-state model fixed to `slip_uploaded`(queue)→`verifying`(on claim) (§ `07`); plus phone-proxy, rider availability, erasure step-up, everyday-table writes, fallback sender, and the view-CDC fix. LOW items (COD reversal, refund-failed RPC, invite activation, avatar/public uploads, pickup-handoff identity) are also addressed in `07`.