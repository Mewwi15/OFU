# Bug audit — full system sweep (2026-07-16)

Tester sweep across all three systems (customer app, admin/POS, Supabase backend) — 15 audit lanes, every finding adversarially verified. **31 confirmed** (2 blocker · 10 high · 10 medium · 9 low). Ordered by severity.

Tags: `system` (customer / admin / backend / cross) · `category` · `file:line`. `[known]` = already surfaced in a prior audit. `[plausible]` = likely real, reachability not fully confirmed.

---

## BLOCKER (2) — fix before anything else

- [ ] **B1 · Self-signup can claim `role=admin` → full customer-data breach** — cross / security · `supabase/migrations/0004_auth_identity.sql:20`
  - Impact: anyone with the public anon key can `signUp({ options: { data: { role: 'admin' } } })`; `handle_new_auth_user` trusts `raw_user_meta_data.role` and `app_role()` has no `account_state` filter, so a pending row already reads `admin`. Grants read of every customer's payment slip (financial PII), chat images, deletion emails; write on catalog images.
  - Fix: force `role='customer'` on self-signup (staff/admin only via service_role invite or `app_metadata`); make `app_role()` + slip/chat/product-image/deletion policies require `account_state='active'`.

- [ ] **B2 · Editing a product clobbers `stock_qty` with a stale snapshot** — admin / data-loss · `admin/src/pages/Products.tsx:632`
  - Impact: any product edit re-sends the modal-open stock value; `upsert_variant` does an absolute `coalesce(p_stock_qty, stock_qty)` with no optimistic lock (POS sales don't bump `products.row_version`, so that guard can't catch it). Concurrent POS sales/restocks are lost → overselling + wrong inventory + false `admin_adjust` movement. Clearing the field writes 0.
  - Fix: don't send `stock_qty` from the product editor on UPDATE (omit `p_stock_qty` so it coalesces to current DB); route stock through `set_stock_qty`/`receive_stock`. Or add a variant-level optimistic check to `upsert_variant`.

---

## HIGH (10)

- [ ] **H1 · Duplicate order/charge when a success response is lost** — cross / money · `lib/data/order.ts:75`
  - Impact: `placeOrder` mints a new idempotency key every call and re-runs `clear_cart`+`add_cart_item`, defeating server replay/cart-lock. Lost success response + user retry (UI prompts "try again") → second order. COD → cash collected twice; prepay → order #1 stranded in `awaiting_payment`.
  - Fix: one idempotency key per checkout attempt (useRef), reused across retries; don't rebuild the cart once a key was submitted.

- [ ] **H2 · Frozen promo discount → PromptPay QR ≠ server-charged total** — customer / money · `app/(tabs)/cart.tsx:208`
  - Impact: `appliedPromo.discount` captured once and never recomputed on cart edits; flows frozen into the QR while `place_order` recomputes from the live cart. Editing the cart after applying a percent promo → customer transfers an amount that doesn't match `order.total`. Dropping below `min_spend` fails checkout *after* the QR/slip step.
  - Fix: re-run `validatePromo` (or clear the promo) whenever the subtotal changes, or render the QR only from the server `order.total`.

- [ ] **H3 · Address book never reset on logout → next login sees previous user's addresses** — customer / security · `store/address.ts:61`
  - Impact: `load()` short-circuits on an in-memory `loaded` flag cleared only by a full page reload; logout clears only auth. On web, A logs out → B logs in without reload → B sees A's recipient name, phone, home line, map pin. B's stale `selectedId` also fails `place_order` ownership → confusing generic error.
  - Fix: add `reset()` to the address store, call from logout + `SIGNED_OUT`; or refetch when `userId` differs from last-loaded.

- [ ] **H3b · Chat message typed before the thread loads is silently lost** — customer / data-loss · `store/chat.ts:79` `[known]`
  - Impact: `send()`/`sendImage()` early-return (resolve, never throw) when `threadId` is null; `onSend` clears the draft before awaiting and only restores in `.catch` (never runs). Cold-open race + deterministic after a thread-load failure (threadId stays null → every send swallowed). Lost order questions / slip photos.
  - Fix: ensure/await the thread (or throw when missing so the draft restores), and disable the composer while loading.

- [ ] **H4 · Web chunk-reload guard defeated → infinite reload loop** — customer / crash · `app/_layout.tsx:154`
  - Impact: the mount effect unconditionally removes the `sessionStorage` "already reloaded" flag on every boot, before any chunk error can fire — so the flag never survives a reload. During a bad-cache/broken-chunk window (Vercel deploy trap), affected visitors get an infinite white-screen reload storm.
  - Fix: don't clear the flag synchronously on mount; re-arm only after the boot proves stable (~10s), or use a bounded reload counter (max 1–2).

- [ ] **H5 · POS replay omits `subtotal` → receipt render throws → whole till whiteouts** — cross / crash · `supabase/migrations/0060_pos_sale_zero_total_payment.sql:39`
  - Impact: the idempotent-replay branch returns a truncated object with no `subtotal`; `Receipt.tsx` renders `baht(undefined)` → `undefined.toLocaleString` throws → the single root ErrorBoundary blanks the entire POS until manual reload. Fires on the ambiguous-error retry / fast double-click of pay. Sale commits once (no double-charge) but the cashier loses the till mid-shift.
  - Fix: replay branch returns the full shape (subtotal/discount/net_amount) AND harden `baht`: `(n) => (n ?? 0).toLocaleString('th-TH')`.

- [ ] **H6 · Capped promo bricks checkout shop-wide after one cancellation** — backend / crash · `supabase/migrations/0057_order_number_sequence.sql:407`
  - Impact: `place_order` enforces the cap on the live (`released_at is null`) count but then bumps a monotonic `total_redeemed` with `CHECK(total_redeemed <= total_limit)`; `cancel_order` frees only the live count. Once a promo hits its limit and one order using it is cancelled, every further checkout passes the live cap then violates the CHECK → raw `check_violation` aborts `place_order`.
  - Fix: decrement `total_redeemed` on release (in `cancel_order`), or drop the monotonic counter+CHECK and rely on the `released_at` live cap.

- [ ] **H7 · Store-credit customer lookup can never match** — cross / correctness · `admin/src/pages/StoreCredit.tsx:61`
  - Impact: placeholder tells the cashier to type `0812345678`; passed raw to `find_customer_by_phone` which does `where phone = p_phone` exactly, but phones are stored `66812345678`. Every lookup via the only-suggested format returns "not found" → the whole Store Credit feature is unusable.
  - Fix: normalize the phone before comparison (strip non-digits, `0`+9 → `66`+9, accept `+`) in the RPC or a client helper; fix the placeholder.

- [ ] **H8 · Admin chat fetches the OLDEST 200 messages, not the newest** — admin / correctness · `admin/src/lib/chat.ts:66`
  - Impact: `listMessages` uses `.order('created_at', asc).limit(200)`. On any thread past 200 messages (one permanent thread per customer, no pruning) the admin can't see current questions and can't confirm their own just-sent replies (re-fetch keeps returning the oldest window).
  - Fix: fetch newest 200 — `.order('created_at', {ascending:false}).limit(200)` then reverse client-side (or paginate from the tail).

- [ ] **H9 · Admin chat markRead realtime self-loop → unbounded DB traffic** — admin / perf · `admin/src/pages/Chat.tsx:80`
  - Impact: the realtime callback calls `markRead` → `chat_mark_read` does an unconditional `update chat_threads set admin_unread=0` (no guard); the table has replica identity full + is realtime-published, so the write echoes back → `markRead` again → forever. Every admin who opens a thread starts continuous UPDATE/SELECT/signed-URL traffic against live prod.
  - Fix: don't call `markRead` from the realtime callback (only on explicit open / real customer INSERT); guard the RPC with `where id=p_thread and admin_unread<>0`.

---

## MEDIUM (10)

- [ ] **M1 · Client hardcodes online shipping fee (`FLASH_FEE=150`) → QR drifts when owner edits the fee** — cross / money · `store/mode.ts:68` `[known]`
  - Impact: client never reads `shop_settings`; `place_order` computes the fee from `online_fee`/`online_free_threshold`, now self-serve editable (0059) with no code deploy. Latent today (both 150) but the moment the owner edits the online fee or sets a free threshold, every online PromptPay order over/underpays until the app is rebuilt.
  - Fix: fetch `online_fee`+`online_free_threshold` (extend `loadShopInfo`/`useShop`) and compute from those, or derive the QR amount from the server `order.total`.

- [ ] **M2 · Offline sale re-prices at sync; no reconcile vs cash collected** — cross / money · `admin/src/lib/offline.ts:197`
  - Impact: `flushQueue` discards the `send()` result and never compares the server total to the `entry.total` on the printed provisional receipt; the queued input carries no price, so `create_pos_sale` recomputes from the current variant at sync time. A price change during the offline window silently diverges recorded revenue/VAT/change from the drawer and the customer's receipt; still reports "synced".
  - Fix: after replay, compare server total to `entry.total`; on mismatch route to a needs-review list instead of clean-sync.

- [ ] **M3 · "ยอดขายวันนี้" counts unpaid / awaiting-payment orders** — admin / money · `admin/src/pages/Orders.tsx:188`
  - Impact: sums `o.total` for every non-cancelled order placed today, including `placed`/`awaiting_payment`/`slip_uploaded`/`payment_verifying`. Since slip = manual verify is the primary path and there's no auto-expiry, every abandoned/unpaid order inflates the headline KPI.
  - Fix: count only confirmed/paid (from `confirmed` onward, or `payment_status='paid'` with COD handling).

- [ ] **M4 · Stock CSV import treats a blank cell as 0 → silently zeroes stock** — admin / data-loss · `admin/src/pages/Stock.tsx:454`
  - Impact: `Number('')===0` passes the `qty>=0` set-mode filter → `setStockQty(variant, 0)` → products silently unsellable. Separately, `qtyCol` matches whichever of `คงเหลือ`/`จำนวน` comes first, so appending `จำนวน` (as the tip suggests) while leaving `คงเหลือ` re-applies the stale old value.
  - Fix: treat empty/whitespace as skip-row (mark unmatched in preview), prefer an explicit `จำนวน` override column.

- [ ] **M5 · Product detail adds cheapest variant even when it's out of stock** — customer / correctness · `app/product/[id].tsx:90`
  - Impact: `soldOut` is true only when *every* variant is zero; the page always adds `variants[0]` (no size picker). Cheapest OOS + pricier in stock → Add stays enabled, adds the OOS variant, checkout rejects with generic "สินค้าบางรายการมีไม่พอ". Multi-variant products become unbuyable when only the cheapest size is depleted.
  - Fix: add the cheapest IN-STOCK variant (or expose a picker); compute `soldOut`/disable on the specific variant.

- [ ] **M6 · Editing an address overwrites the saved line with a fresh reverse-geocode** — customer / correctness · `app/address/picker.tsx:196`
  - Impact: on web (Google) the map's `idle` fires once on load, reaching `onCameraMove` with `keepLine=false` and `lastGeo` unseeded → `runGeocode` overwrites the saved custom `line` with a coarser Nominatim line. Editing an unrelated field (phone/label) silently loses hand-entered landmark/floor; coarser line can misdeliver parcels.
  - Fix: when editing, seed `lastGeo.current = initialCenter` (and/or keepLine on first settle) so the initial geocode only fills blank fields.

- [ ] **M7 · Cart / CheckoutSheet show cheapest-variant price, not the line's unit price** — customer / correctness · `components/shop/CheckoutSheet.tsx:177`
  - Impact: CheckoutSheet and the cart row render `product.price` (cheapest variant) while subtotal/total sum `unitPrice`. For a non-cheapest line the per-line price shows lower than the (correct) total — a trust/overcharge-appearance at the pay-confirm moment. Reachable via reorder (the only path that carts a non-cheapest variant). Total charged is correct — display-only.
  - Fix: render `it.unitPrice` (fallback `product.price`) in `CheckoutSheet.tsx:177` and `ProductListItem.tsx:134`.

- [ ] **M8 · POS can oversell stock reserved (and prepaid) by a pending online order** — cross / correctness · `supabase/migrations/0060_pos_sale_zero_total_payment.sql:60`
  - Impact: `place_order` reserves via `reserved_qty` (leaves `stock_qty`) and admits on `available_qty`, but `create_pos_sale` reads raw `stock_qty` and the POS shows `คงเหลือ = stock_qty`. The till can ring up units held for a pending slip order; `approve_slip`'s `greatest(0, …)` clamp hides the resulting negative → two customers sold the same physical units, no alert.
  - Fix: gate `create_pos_sale` on `available_qty` (`if (stock - reserved) < qty then raise OUT_OF_STOCK`).

- [ ] **M9 · Notifications realtime fires a full 50-row reload per row change** — customer / perf · `lib/data/notifications.ts:127`
  - Impact: `postgres_changes` (`event:'*'`, no filter/debounce) calls a full `listNotifications()` per event. `markAllNotificationsRead` is one multi-row UPDATE → logical replication emits one event per row → marking N unread fires ~N concurrent identical 50-row SELECTs.
  - Fix: debounce/coalesce `onChange` (~300ms trailing), apply incremental update from `payload.new`, optionally scope the channel by `user_id`.

- [ ] **M10 · Scanning an OOS variant fails the ENTIRE POS sale with a name-less error** — admin / ux · `admin/src/pages/Pos.tsx:320`
  - Impact: `scan()` calls `addVariant` unconditionally (only a transient warn), bypassing grid/picker gating. At checkout the server raises `OUT_OF_STOCK` with the product name in `detail`, but `apiError` maps it to a fixed "สินค้าบางรายการมีไม่พอ" and drops `detail` → whole multi-item sale blocked with no clue which line to remove. Worse in the concurrent-depletion race (no scan-time warning).
  - Fix: block/hard-warn adding a variant with `stock < qty` at scan time (cap at available); surface the `OUT_OF_STOCK` `detail` and mark the offending line.

---

## LOW (9)

- [ ] **L1 · POS store-credit tender reads balance without locking → concurrent overspend to negative** — admin / money · `supabase/migrations/0060_pos_sale_zero_total_payment.sql:92`
  - Impact: the store-credit branch checks balance with a plain unlocked aggregate then inserts the debit later; the variant `FOR UPDATE` lock only serializes sales sharing an item. Two concurrent store-credit sales for the same customer with disjoint baskets both read the same balance, both pass, both debit → wallet negative → real money loss. Low likelihood (two simultaneous sessions, same customer).
  - Fix: lock the wallet before the check — `select 1 from app_users where id=p_customer_user_id for update` or `pg_advisory_xact_lock(shop_id, user_id)`.

- [ ] **L2 · LINE callback accepts empty saved state (login-CSRF / session fixation)** — customer / security · `app/line-callback.tsx:54`
  - Impact: state check only rejects when a saved state *exists and differs*; a null saved state passes, server never validates state, no PKCE. An attacker with a fresh unused LINE code can lure a victim (no saved state) to the callback → victim signed into the attacker's account; anything the victim then enters leaks. Heavy preconditions, low blast radius.
  - Fix: require `saved===state` for login too, or bind state to a first-party cookie / server nonce.

- [ ] **L3 · No throttling/lockout on the PIN screen** — customer / security · `store/lock.ts:104` `[plausible]`
  - Impact: `verifyPin` is a plain local equality check, no failure counter/delay/lockout; the screen just flashes and clears. Unlimited retries, but bounded by the 10^6 keyspace, manual entry, needing an already-unlocked device, and being a secondary gate. Hardening gap, not an open hole.
  - Fix: persist a consecutive-failure counter (survives remounts), escalating backoff, force sign-out (account password) after N failures.

- [ ] **L4 · Shop open/closed uses the browser's LOCAL timezone** — customer / correctness · `lib/data/shop.ts:55` `[plausible]`
  - Impact: `isShopOpen` compares `now.getHours()/getMinutes()` (viewer local) against Bangkok hours with no conversion, feeding `canCheckout`. A non-ICT web viewer would be wrongly blocked/allowed. Dormant today (prod hours 00:00–24:00 → `isAllDay` short-circuits before the buggy line; no admin UI for a non-24h window).
  - Fix: compute Bangkok time first (`Intl.DateTimeFormat timeZone:'Asia/Bangkok'` or fixed +07:00) before extracting hours/minutes and `getDay()`.

- [ ] **L5 · Slip `observed_amount` records `order.total`, not the amount actually transferred** — cross / correctness · `app/checkout/index.tsx:200`
  - Impact: `attachSlip` passes `order.total` (what `place_order` just computed) as `observed_amount`, not the client QR total the customer paid, so it equals `order.total` by construction and can never flag the over/underpayments from the QR-vs-total findings. Nothing reads it yet → latent, but defeats any future auto-verify.
  - Fix: pass the client `total` used to build the QR, or omit and populate from real slip data (OCR/slip API).

- [ ] **L6 · Order-drawer print buttons enabled while items still load → empty pick sheet** — admin / correctness · `admin/src/pages/Orders.tsx:462` `[known]`
  - Impact: print buttons aren't gated on the drawer's loading state; `items` is `[]` until `getOrderItems` resolves. Clicking in that window prints an A4 with a correct recipient block but an empty products table + "รวม 0 รายการ". Self-correcting (re-print works) but a wrong document on the common open-then-print path.
  - Fix: disable both print buttons while loading and/or when `items.length===0`.

- [ ] **L7 · Push-notification tap doesn't deep-link** — customer / ux · `lib/push.ts:20`
  - Impact: `send-push` emits `data.targetId` (order/chat id) but the app registers no response listener and never reads the payload → a tap opens the default route, not the chat/order. Native-only; unreachable on the current web-only product (push early-returns on web). Negligible today, bites once native ships.
  - Fix: add a root-layout `useLastNotificationResponse` + `addNotificationResponseReceivedListener` reading `targetId`/`target_type` → `router.push`; include `target_type` in the push data.

- [ ] **L8 · Broadcast success banner drops its heading (antd `Alert` prop is `message`, not `title`)** — admin / ux · `admin/src/pages/Broadcast.tsx:56`
  - Impact: the success `Alert` uses `title="ส่งแล้ว"`; antd's main line prop is `message`, so the heading is dropped (passed as an HTML `title` attr) and only the recipient count shows. Cosmetic. Same mistake also in `Login.tsx` alerts.
  - Fix: rename to `message="ส่งแล้ว"` (keep `description`).

- [ ] **L9 · Header notification bell is a dead control with a permanently-lit dot** — admin / ux · `admin/src/components/Layout.tsx:50`
  - Impact: the bell's `Badge` uses an unconditional `dot` bound to no state and the `Button` has no `onClick` → every page shows a permanent unread dot on an inert control, implying a pending notification that isn't there.
  - Fix: wire the bell to real notification state (hide dot when empty), or remove the badge/button until it does something.

---

### Notes
- **B1** and **H3** are the two data-exposure issues — treat as security-sensitive.
- The money cluster (**H1, H2, M1, M2, M8, L1, L5**) all trace to the same root theme: the client/QR computes money the server owns. Fixing "derive the QR from server `order.total`" (H2/M1) closes several at once.
- Verified against real code + prod DB state on 2026-07-16. Two items marked `[plausible]` need a reachability confirmation before fixing.
