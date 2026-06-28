# Open Questions & Requirements Critique (living doc)

> รวมคำถามค้างจากทุก epic + ผลตรวจ consistency/gap — ใช้เป็น backlog ของ decisions ที่ต้องเคาะ

## ✅ Resolved (2026-06-27)
- **BLOCKER #1 delivery payment timing** → เลือก **B) เดลิเวอรี่จ่ายได้ทั้ง prepay (promptpay_slip) และ COD** (ดู `adr/ADR-0002-payment.md`). เปิดงานต่อ: COD lifecycle, ไรเดอร์เก็บเงิน/float/รีคอนซายล์, refund lifecycle → กำลัง groom เป็น stories
- **Engineer defaults (ใช้เว้นแต่จะค้าน):** ราคาต่อขนาด = มี · สาขาเดียว · แคตตาล็อก remote (ผ่าน backend) · admin มี tier owner/staff · ค่าส่ง ฿40 / ส่งฟรี ฿200 hardcode ก่อน แล้วทำให้ admin ปรับได้ทีหลัง
- **Backend platform** → ADR-0001 เสนอ **Supabase** (Proposed — รอ ✅ ยืนยัน)
- ยังเปิด: enum `online`→`pickup` + แยก PaymentStatus/OrderStatus (จะแก้ในเฟส implementation)

## A. Open questions ราย epic

### CUS-ONB — Onboarding & Authentication
- SMS/OTP provider and Thai sender-ID registration (e.g. Twilio vs a Thai aggregator such as ThaiBulkSMS/Movider) — cost and deliverability to Thai mobile numbers.
- Which social providers actually ship in v1 and obtaining their credentials: LINE Login channel (under a registered business), Apple Sign In capability, Google OAuth client.
- Account-merge / identity resolution: if the same person uses phone OTP and a social provider (or two providers), do accounts merge, and on what matching key?
- PAYMENT (locked-open): is the delivery ShopMode prepay (PaymentMethod promptpay_slip) or pay-on-receipt? COD and a real gateway (Omise/2C2P/GB Prime) are deferred — this directly shapes the post-auth checkout that the CUS-ONB-08 gate leads into.
- PDPA specifics: data-retention period, DPO/contact details, consent-withdrawal and full account-deletion flow (in v1 scope?), and handling of minors/age consent.
- Guest cart lifetime and merge rule: does a guest cart persist on-device, and does it merge into the account cart on sign-in (and what happens to it on logout)?
- ShopMode enum reconciliation: store/mode.ts currently uses the value 'online'; the canonical enum is 'pickup' — rename in code before building the auth-gated checkout?
- Marketing/notification consent: confirm it must be a separate optional opt-in (not bundled with the mandatory PDPA data-processing consent).

### CUS-PROFILE — Account, Profile & Addresses
- PAYMENT (blocked): Is the delivery flow prepay (PromptPay + slip) or pay-on-receipt? And will a real gateway (Omise/2C2P/GB Prime) and/or COD be added? This blocks CUS-PROFILE-08 saved-payment-method management and may change whether the address/checkout flow collects payment proof. Do not assume.
- PDPA SLA & scope: What is the legal response timeframe for data access/export and deletion requests, and exactly which data categories are included in an export? Needs legal/DPO sign-off (affects CUS-PROFILE-06 and 07).
- PDPA erasure vs retention: On account deletion, are past orders anonymised (to keep the shop's financial/tax records) or hard-deleted, and what is the cancellation/grace window? Needs legal + finance sign-off (affects CUS-PROFILE-07).
- Map provider & precision: Which map/geocoding provider (Google/Apple/OSM) do we use, and is precise lat/lng actually required for v1 rider routing or is text address sufficient? (affects CUS-PROFILE-04).
- Address data model: Free-text address fields vs a structured Thai address dataset with จังหวัด/อำเภอ/ตำบล + postal-code autofill? (affects validation in CUS-PROFILE-03).
- Phone identity: Since login is phone + OTP, is changing the phone number allowed in v1 (with OTP re-verification) or locked? (affects CUS-PROFILE-02).
- Guest vs login-required: Is there any guest browsing/checkout, or is login mandatory before a profile/addresses exist? (affects the not-logged-in state in CUS-PROFILE-01).
- Avatar storage & limits: Where are profile photos stored and what are the size/type/moderation limits? (affects CUS-PROFILE-02).
- ShopMode naming: Canonical enum is delivery | pickup, but the current codebase (store/mode.ts) uses 'online' as the pickup alias and 'ออนไลน์' copy — confirm whether v1 renames the enum/value to 'pickup' or keeps the 'online' alias.

### CUS-BROWSE — Home / Discover
- BLOCKED (payment decision): Is DELIVERY mode prepay (PaymentMethod promptpay_slip) or pay-on-receipt/COD? Until resolved, Home must not make any payment-timing claims; this gates messaging in CUS-BROWSE-07.
- ShopMode naming: canonical enum is `delivery | pickup`, but store/mode.ts uses `delivery | online` (label ออนไลน์). Reconcile to `pickup` and confirm the customer-facing Thai label (ออนไลน์ vs รับที่ร้าน).
- Banner CTA deep-link targets: where does each "ช้อปเลย" go (promo collection / category / product)? Currently a no-op.
- Are hero banners and featured sections admin/CMS-managed in v1, or hardcoded? (Ties to an ADMIN merchandising epic.)
- Is the catalog remote/async in v1? This gates the loading/error states in CUS-BROWSE-05; today products is a static in-memory array.
- Single shop vs multiple branches: does the 'branch header' need a branch name/address (esp. for pickup), or is it always the one อู้ฟู่ shop?
- Source and format of shop opening hours, and the closed-shop policy: allow browse only, block checkout, or allow scheduling for later?
- Does Search belong to Home/Discover or a separate CUS-SEARCH epic? The SearchBar and options-outline filter button live on index.tsx but the filter button is currently a no-op.
- Notifications destination for the header bell icon (which epic owns the notifications screen)?

### CUS-SEARCH — Search, Filter & Sort
- Payment decision (delivery prepay PromptPay+slip vs pay-on-receipt/COD; gateway) is UNRESOLVED but does NOT block this Search/Filter/Sort epic — recorded explicitly so reviewers don't infer a dependency. No story here assumes a PaymentMethod/PaymentStatus.
- Popularity metric for CUS-SEARCH-04 is undefined: Product has only `rating` (0..5), no sales/popularity field. Decide source — sales volume, rating proxy, or admin-curated ranking — before popularity sort can ship. Do not assume rating==popularity.
- Search scope: should free-text also match product.description and/or category names/synonyms, or stay name+subtitle as in the current code? Thai shoppers often search by qualities/brand that appear only in description.
- ShopMode naming mismatch: canonical enum is ShopMode: delivery | pickup, but /Users/mewwi/dev/my-rn-app/store/mode.ts uses 'online' (label 'ออนไลน์'). Confirm reconciliation to 'pickup', and confirm search results are identical across delivery and pickup in v1 (single catalog) — or will the two modes ever expose different availability?
- Out-of-stock / availability: Product has no stock field. Should unavailable items be hidden, shown disabled, or sorted last in search results? Requires an availability model (and affects sort).
- Recent-search persistence & PDPA: store on-device only (default) vs sync to the customer's account; must be covered by account-data deletion; confirm retention window and cap (proposed 8).
- Thai search normalization: does v1 stay exact-substring, or do we need tolerance for tone marks/sara, zero-width characters, Thai vs Arabic numerals, and common typos? Affects recall for ป้าสมศรี.

### CUS-PRODUCT — Product Detail
- PAYMENT (blocked/flagged): the v1 payment decision — whether ShopMode delivery is prepay (promptpay_slip) vs pay-on-receipt/COD, and the future gateway (Omise/2C2P/GB Prime) — is unresolved. The Product Detail screen itself surfaces no payment UI, so no PDP story is blocked; confirm PDP must not show any pay/checkout affordance until this is settled.
- STOCK SOURCE OF TRUTH: the Product type has no stock/availability field today. Does the catalog expose per-product stock counts, and does availability/stock vary by ShopMode (delivery vs pickup)? (CUS-PRODUCT-05 assumes a stock field is added.)
- SIZE-SPECIFIC PRICING: Product has a single flat `price`; should each size (e.g. '1 กก.' vs '5 กก.', '600 มล.' vs '1.5 ลิตร') carry its own price and reflect in the overlay pill and cart line?
- SHOPMODE NAMING: the canonical enum is ShopMode = delivery | pickup, but store/mode.ts implements delivery | online (label 'ออนไลน์'). Reconcile naming/copy before build so PDP and the rest of the app stay consistent.
- WISHLIST PERSISTENCE/AUTH: the wishlist is local/in-memory and seeded with ids 1/3/5. Must it persist to the user account / require login (with PDPA consent)?
- REVIEWS: rating is a single static number with no review list. Is a reviews/ratings section in scope for the v1 Product Detail screen?
- MULTI-IMAGE CONTENT: every catalog item currently ships exactly one image, so the carousel/dots path is untested with real content — confirm multi-image products will exist for v1.

### CUS-CART — Cart
- PAYMENT (blocking): Is DELIVERY mode prepay (PromptPay QR + slip, PaymentMethod=promptpay_slip) or pay-on-receipt? Unresolved per locked decisions. The cart's delivery payment hint 'ชำระปลายทาง หรือโอนเมื่อรับของ' and the 'สั่งซื้อ & จัดส่ง' CTA currently assume pay-on-receipt is allowed — must not be finalized in CUS-CART-04 until decided.
- PAYMENT (blocking): Real payment gateway (Omise/2C2P/GB Prime) and Cash-on-Delivery (COD) are flagged 'discuss later' and are out of v1 — so the cart must not surface gateway/COD options yet.
- PER-SIZE PRICING: Product carries a single `price` but products have multiple sizes ('1 กก.'/'5 กก.', '600 มล.'/'1.5 ลิตร'). Should price (and the subtotal in CUS-CART-04) be per size-variant? The data model needs a decision before subtotal can be correct.
- STOCK MODEL: data/products.ts has no stock field. Need a Product stock representation (boolean inStock vs numeric stockQty), an owner (admin), and a rule for whether the cart reserves stock on add or only validates at checkout. CUS-CART-06 is blocked on this.
- COLOR AS A VARIANT: The cart line key (store/cart.ts) excludes color and grocery products have colors: []. Confirm color is never a real grocery variant axis; if any product (e.g. kitchenware) uses color, the merge key must include color to avoid silently dropping the second color.
- PROMO SCOPE: For a basic PromoCode, does the discount apply to subtotal only or can it also waive/reduce the ฿40 delivery fee, and how does it interact with the ฿200 free-delivery threshold? Plus min-spend, validity window, and per-user usage limits.
- CART PERSISTENCE: store/cart.ts is in-memory zustand with no persistence — should the cart survive app restarts (local) and/or sync to the account across devices?
- SHOPMODE NAMING: Code uses ShopMode value `online` for the pickup flow; the canonical enum is `pickup`. Confirm the rename/reconciliation so all surfaces use `delivery | pickup`.

### CUS-WISHLIST — Wishlist (รายการโปรด)
- Storage scope: is the wishlist device-local only for v1, or server-synced across the customer's devices? Cross-device sync requires a backend and the authenticated identity (affects CUS-WISHLIST-05).
- Guest behavior and merge: can a customer favorite products before logging in, and if so do we merge the local guest wishlist into the account on first login (deduped by product id), or require login before favoriting? Depends on CUS-AUTH.
- Move vs add semantics: should 'move to cart' REMOVE the item from the wishlist after adding (true move), or KEEP it (add-to-cart)? Currently assumed keep — needs product decision.
- Availability/stock: Product has no stock or availability field today. Should the wishlist show availability and block add-to-cart for out-of-stock or discontinued items? Requires an inventory model.
- Engagement features: should the รายการโปรด tab show a count badge, and should we notify customers (Notification entity) about price drops or restocks on favorited items? Likely out of v1 scope — confirm.
- Production seeding: confirm removal of the demo SEED_IDS ['1','3','5'] in store/wishlist.ts so new accounts start with an empty wishlist.
- Payment decision does NOT block this epic: move-to-cart only populates the shared cart; the unresolved DELIVERY prepay (PromptPay+slip) vs pay-on-receipt question lives downstream in checkout/payment, and the wishlist makes no payment assumptions.

### CUS-MODE — Shopping Mode (delivery / pickup)
- BLOCKING (delivery payment): Is `delivery` mode prepay (PromptPay QR + slip up-front, identical to pickup) or pay-on-receipt / COD? This blocks CUS-MODE-05 (delivery payment-hint copy), CUS-MODE-06 (announced consequence), and CUS-MODE-07 (delivery payment step + PaymentStatus timing). The current code's hint 'ชำระปลายทาง หรือโอนเมื่อรับของ' assumes COD and is NOT validated.
- Dependent on the above: if delivery is pay-on-receipt, must `cod` be promoted from future/open into a v1 PaymentMethod (alongside promptpay_slip)? Canonical currently lists `cod` as future/open only.
- ShopMode enum naming: code uses `online`; canonical is `pickup`. Confirm the rename across store/mode.ts (MODE_META keys, ModeSwitch ACCENT keys). Also confirm the Thai-facing label for pickup — keep "ออนไลน์" or switch to the clearer "รับที่ร้าน" used in this epic?
- Persistence scope: should the mode preference persist per-device, per-account, or both — and does logging in/out reset it? (Today it is in-memory and resets to `delivery` on restart.)
- Are the delivery fee (฿40) and free-delivery threshold (฿200) fixed constants or admin-configurable from the Admin Web? This decides whether values are hardcoded in store/mode.ts or fetched.
- Should selecting `delivery` be gated by serviceability (address in delivery zone) or a delivery minimum-order value? Out of scope for this epic but it constrains when `delivery` can be chosen.

### CUS-CHECKOUT — Checkout & Payment (PromptPay + slip)
- BLOCKER: Is ShopMode delivery prepay (PromptPay QR + slip up front) or pay-on-receipt? This blocks CUS-CHK-05/06/07 for delivery. Current cart.tsx copy assumes pay-on-receipt (ชำระปลายทาง หรือโอนเมื่อรับของ) — needs an explicit decision.
- Will v1 add a real payment gateway (Omise / 2C2P / GB Prime) as PaymentMethod gateway? Flagged discuss-later; not assumed in these stories.
- Will Cash-on-Delivery (PaymentMethod cod) be offered for delivery? Open; tied to the delivery payment-timing decision.
- Naming mismatch: store/mode.ts uses ShopMode value online (label ออนไลน์) while the canonical enum value is pickup. Confirm whether to rename the code value to pickup or keep online as a display label only.
- PromptPay QR: dynamic EMVCo QR with the order amount embedded, or a static shop PromptPay ID where the customer types the amount? Affects exact-amount verification in CUS-CHK-05.
- Slip rejection recovery: how many re-upload attempts are allowed after payment_rejected, and is a fresh QR issued each time?
- Payment-status delivery to the customer: real-time push (Notification) vs client polling for the verifying -> paid/rejected transition in CUS-CHK-07?
- Does awaiting_payment expire (e.g. stock reserved for N minutes, auto-cancel on timeout)? Not yet defined.
- Pickup branches: v1 assumes a single store branch in CUS-CHK-03 — confirm there is no multi-branch picker for v1.

### CUS-ORDERS — Order Tracking, History & Reorder
- BLOCKER (payment): Is DELIVERY prepay (PromptPay+slip, traversing awaiting_payment → slip_uploaded → payment_verifying → paid before confirmed) or pay-on-receipt? This determines the delivery-branch timeline, which pushes fire, and cancel/refund rules. Affects CUS-ORDERS-02/03/04/06.
- BLOCKER (payment): How are refunds handled for cancelled or delivery_failed orders already paid via promptpay_slip, given there is no payment gateway in v1 (manual PromptPay refund by admin)? Affects paid-order cancel in CUS-ORDERS-04.
- Future PaymentMethods 'gateway' and 'cod': if COD is added for delivery, the awaiting_payment/slip states are skipped — confirm before hard-coding the lifecycle.
- Self-cancel cutoff: the exact last OrderStatus a customer may self-cancel (proposed: up to confirmed and before PaymentStatus=paid); beyond that, contact shop.
- delivery_failed recovery: who re-initiates (customer re-schedule vs admin), and is the outcome a refund or a re-attempt?
- Codebase ShopMode enum is 'delivery' | 'online' (store/mode.ts, labels เดลิเวอรี่/ออนไลน์) but canonical is delivery | pickup — confirm reconciliation so Order records and labels stay consistent across surfaces.
- Order/slip retention & PDPA: how long are orders and uploaded slips stored, and what happens to order history when a customer deletes their account?
- Push policy: are status pushes treated as purely transactional (no separate consent) or do they require the PDPA notification consent, and are there quiet hours / throttling?
- Reorder behavior: keep the current ShopMode or restore the original order's mode; and product availability/stock must be modeled (absent in data/products.ts today).
- Rating exposure & contact channel: is rating admin-only in v1, and is 'ติดต่อร้าน' a tel: link, a LINE deep link, or in-app chat?

### ADM-AUTH — Admin Auth & Roles
- Admin login credential method: reuse the locked phone+OTP / LINE-Apple-Google auth gated by Roles=admin, or a dedicated email+password — and is 2FA mandatory for the owner?
- Roles modeling: the canonical Roles enum is customer|admin|rider only. Confirm owner vs staff stays a permission tier/attribute within admin (current assumption across all stories), or should it be promoted to first-class roles?
- Session-policy values: idle timeout (proposed 30 min), absolute session lifetime (proposed 12 h), step-up window (proposed 10 min), and whether 'remember this device' is permitted.
- Login lockout thresholds: failed-OTP count/window and cool-down duration (proposed 5 attempts / 10 min).
- BLOCKED by the open payment decision: whether DELIVERY is prepay (PaymentMethod=promptpay_slip) or pay-on-receipt, plus future gateway (Omise/2C2P/GB Prime) and COD — this determines which payment actions require step-up re-auth (ADM-AUTH-06) and which payment events the audit log must capture beyond slip approve/reject.
- Audit-log retention period and PDPA export/erasure handling for audit records that contain customer PII.
- Staff permission granularity: fixed staff tier vs per-permission toggles (affects ADM-AUTH-03 and ADM-AUTH-04).
- ป้าสมศรี (P2) is a customer/pickup persona, not an admin user — confirm there is no elderly/low-vision staff requirement beyond the WCAG AA baseline already applied to the admin web.

### ADM-CATALOG — Catalog Management (จัดการแคตตาล็อกสินค้า)
- Stock commitment timing is BLOCKED by the open payment decision: is stock reserved/decremented at OrderStatus=placed, at PaymentStatus=paid, or at fulfillment? This depends on whether ShopMode=delivery is prepay (promptpay_slip) or pay-on-receipt — affects the overselling guard in ADM-CAT-03.
- Size variants and pricing: should each size (e.g. ข้าวหอมมะลิ '1 กก.'/'5 กก.', น้ำดื่ม '600 มล.'/'1.5 ลิตร') carry its OWN price and stockQty? Current data/products.ts has one shared price/stock per product, but the cart already keys by productId+size. Must be decided before ADM-CAT-01/03 finalize.
- Roles granularity: the canonical Roles set has a single 'admin'. Do we need owner-vs-staff sub-roles to restrict who can change price or delete products? v1 currently assumes one admin role.
- Should the catalog-seeded 'rating' field remain admin-editable/visible in v1 (real user reviews are out of scope per docs/01), or be hidden until reviews exist?
- Per-mode availability (delivery | pickup): confirm the shop actually wants fresh ของสด restricted to pickup-only; this defines the scope of availabilityByMode in ADM-CAT-03.
- Image hosting: v1 catalog uses remote picsum.photos URLs. What is the real upload/storage/CDN target and the accepted file types and max size for ADM-CAT-05?
- Price format/currency: confirm whether THB prices are integer-only or allow satang, and the rounding rule — note money() in lib/format.ts has no NaN/negative guard (baseline ROBUST-1), so input validation must enforce it.
- Category model migration: confirm moving ProductCategory from the hardcoded TS union to admin-managed data, and that the customer 'ทั้งหมด' stays a virtual All filter rather than a stored category.

### ADM-ORDERS — Order Management & Rider Assignment
- DELIVERY payment model is UNRESOLVED: is delivery prepay (PromptPay + slip, must be paid before confirmed/assigned_to_rider) or pay-on-receipt? This gates the payment checks in ADM-ORD-03 and ADM-ORD-04.
- Will v1 add a real payment gateway (Omise/2C2P/GB Prime) and/or Cash-on-Delivery? COD especially changes the delivery PaymentStatus flow and rider-collected payment, affecting ADM-ORD-04 and ADM-ORD-06.
- Refund mechanism: is a manual out-of-band refund note acceptable for v1, or is an automated/gateway refund required? Blocks ADM-ORD-06 beyond note-taking.
- What is the canonical set of cancel-reason enum values the shop owner wants (ADM-ORD-06)?
- What are the SLA target times per OrderStatus (e.g. preparing, out_for_delivery) and do they differ between delivery and pickup (ADM-ORD-07)?
- Rider availability model: how does a rider become 'available' for assignment — self-toggle in the rider app, schedule, or admin-set (ADM-ORD-04)?
- Does admin need manual override of rider-owned transitions (out_for_delivery, delivered) when a rider cannot update the app?
- Owner-vs-staff permission split within the admin role — required in v1 or deferred (ADM-ORD-08)?
- Customer/rider notification channels (push, SMS, LINE) and ownership of the Thai notification copy for ready_for_pickup and cancellation messages.

### ADM-PAYMENT — Payment / Slip Verification
- Delivery payment model is unresolved: is ShopMode = delivery prepay (PromptPay + slip, enters the verification queue) or pay-on-receipt/COD (skips it)? Blocks ADM-PAY-08 and changes what ADM-PAY-01 contains. Existing cart copy ('ชำระปลายทาง หรือโอนเมื่อรับของ') currently assumes pay-on-receipt and conflicts with prepay.
- Will a real payment gateway (Omise / 2C2P / GB Prime) replace or augment manual slip verification? Directly affects ADM-PAY-03, ADM-PAY-06 (refunds) and ADM-PAY-07 (capacity justification).
- Is the slip amount auto-extracted via OCR or manually entered by the admin? (ADM-PAY-02)
- Lock/claim auto-release timeout for 'verifying' (N minutes) when an admin abandons review? (ADM-PAY-05)
- SLA threshold and pending-count alert thresholds for the backlog dashboard? (ADM-PAY-07)
- Refund mechanism in v1 — manual/offline only, with automated refunds deferred until a gateway exists? (ADM-PAY-06)
- Admin sub-roles: is verification permission flat across Role = admin, or split owner vs staff? Affects role gating in ADM-PAY-01 and audit in ADM-PAY-03/04.
- On payment_rejected, does customer re-upload reset PaymentStatus awaiting_payment -> slip_uploaded, and is there a max retry count before manual escalation?
- Short/over-payment policy: accept-and-note, require top-up, or auto-reject? (ADM-PAY-02/06)
- Canonical-enum drift: store/mode.ts uses ShopMode 'online' for what the canonical enum calls 'pickup' — reconcile before cross-surface work so admin queue labels match.

### ADM-DASH — Dashboard & Reports
- BLOCKED (payment decision): Is DELIVERY prepay (PromptPay+slip) or pay-on-receipt/COD? This drives revenue recognition, AOV counting basis, and whether a payment-method/COD breakdown appears in sales reports (ADM-DASH-01, ADM-DASH-05, ADM-DASH-06).
- Revenue recognition rule: count realized sales at PaymentStatus=paid (proposed) vs at order placed vs at delivered? Depends on the delivery-payment decision.
- KPI definitions need PO sign-off: does 'orders/day' exclude only {cancelled, payment_rejected}? Does fulfillment time start at 'confirmed' (proposed, matching vision 'รับออเดอร์') or at 'placed', and end at delivered / ready_for_pickup vs picked_up?
- Does v1 persist per-order status-transition timestamps (event log)? Fulfillment-time KPI (ADM-DASH-01) and drill-down (ADM-DASH-08) cannot be computed without it — dependency on the order data model.
- PDPA: should every view/export of customer personal data be audit-logged (who/what/when)? What is the retention and access policy for exported CSVs containing name/phone/address?
- Role granularity: v1 has a single 'admin' role — should some staff see operations but not revenue/AOV, or is full visibility acceptable for all admin users in v1?
- Dashboard freshness: real-time/live metrics vs periodic cached aggregation (e.g. every N minutes)? Affects performance for long date ranges.
- Data-model naming: current code uses ShopMode value 'online' (store/mode.ts) while the canonical enum is 'pickup' — confirm the mapping/migration so reporting is consistent across surfaces.
- Should the dashboard surface an actionable queue (e.g. count of PaymentStatus=slip_uploaded awaiting verification) or is that owned entirely by the ADM-ORD order-management epic?

### RID-AUTH — Rider Auth & Availability
- [Payment ADR-pending] Is `delivery` prepay (`promptpay_slip`) or pay-on-receipt (`cod`)? If `cod` is adopted, the rider profile (RID-AUTH-06) and the go-online flow likely need cash-handling/float/settlement fields plus a reconciliation step, and cash-in-hand may have to block going offline (RID-AUTH-04). Left unspecified until resolved.
- Rider onboarding model: admin-provisioned only (assumed throughout) vs rider self-signup? Affects RID-AUTH-01 and RID-AUTH-07.
- Does the rider app need social login at all, given riders are shop staff and phone+OTP is primary? Drives the priority of RID-AUTH-07.
- ป้าสมศรี is a customer (pickup) persona, not a rider, and no elderly/low-vision rider persona is defined. Is the product-wide a11y baseline (WCAG AA, ≥44pt, dynamic type, accessibilityLabels, reduced-motion) sufficient for the rider app, or should a dedicated rider a11y persona be added?
- PDPA location scope: foreground-only vs background tracking while `online`/`out_for_delivery`, and the retention period for rider location data.
- Idle/auto-offline behaviour: should a rider auto-go `offline` after inactivity, app backgrounding, or shift end — and after how long?
- Concurrent sessions: may a rider be signed in on multiple devices, or enforce single-device with auto sign-out elsewhere (RID-AUTH-05)?
- Reassignment threshold: how long may an `assigned_to_rider` order's rider be offline/unreachable before the `admin` is prompted to reassign and the order risks `delivery_failed` (RID-AUTH-04)?
- Code drift to fix in the customer app: store/mode.ts currently models ShopMode as `delivery | 'online'`; canonical enum is `delivery | pickup`. Riders only serve `delivery`, but this inconsistency should be reconciled product-wide.

### RID-QUEUE — Delivery Jobs Queue
- BLOCKING (payment): Is DELIVERY mode prepay (PromptPay + slip, admin-verified) or pay-on-receipt/COD? This blocks RID-QUEUE-06 (cash collection + reconciliation, PaymentMethod=cod) and whether a job with PaymentStatus != paid may ever be dispatched to a rider.
- Assignment model: Does v1 include a self-assign 'งานที่ว่าง' (pull) pool, or are all jobs admin-assigned (push only)? Affects RID-QUEUE-01/02/05 scope.
- Config values: max concurrent active jobs per rider, and max batch size (number of stops). Needed for RID-QUEUE-02 and RID-QUEUE-05 limit criteria.
- Batching depth: v1 is basic zone-grouping + accept; is any route optimization / sequenced ETA expected, or explicitly deferred?
- Address data: Are delivery addresses geocoded/zoned (enables distance sort + batch zone validation), or free-text only at v1?
- PDPA: How much customer PII (phone, full address) is exposed to riders, masking rules, and how long after OrderStatus=delivered the rider retains access to the job detail.
- Enum naming drift in the existing codebase: store/mode.ts uses ShopMode='online' for what the canon calls 'pickup'. Align the codebase to canonical ShopMode (delivery | pickup) so rider/admin/customer stories stay consistent (not rider-blocking, but a consistency risk).

### RID-DELIVERY — Active Delivery & Proof of Delivery
- ADR-pending (blocks RID-DLV-03, RID-DLV-04, RID-DLV-06): is delivery-mode prepay (PromptPay+slip, PaymentStatus `paid` before dispatch) or pay-on-receipt? This directly gates the dispatch payment-rule, whether the rider handles money at `delivered`, and the whole COD story.
- Is PaymentMethod `cod` in v1 scope at all? If not, RID-DLV-06 is out of scope and should be dropped rather than built.
- COD cash reconciliation: how does a rider hand collected cash back to the shop (float, end-of-shift settlement, receipts)? Currently unspecified.
- Rider-to-customer contact privacy: does v1 use a phone proxy/relay (PDPA-preferred) or expose a masked real number revealed only at dial time?
- Proof-of-delivery strength: is a rider-captured photo sufficient, or is a customer OTP/signature required? If required, what is the rider-assisted fallback so elderly recipients like ป้าสมศรี are never blocked?
- POD media governance (PDPA): where are proof photos stored, what is the retention period, who may view them, and what is the deletion policy?
- Is capturing GPS geolocation with the POD/failure record permitted under PDPA and is it required, optional, or off by default?
- Re-dispatch after `delivery_failed`: does admin reset the order to `assigned_to_rider` for a retry, or is `delivery_failed` terminal? Confirm cross-surface ownership with the admin/assignment epic.
- Mapping in v1: rely on OS handoff to Apple/Google Maps (assumed here) or embed a map SDK with in-app routing?
- Boundary check: does the assigned_to_rider -> out_for_delivery transition (RID-DLV-03) belong in this epic or in the rider assignment/queue epic? Avoid duplicate ownership.

### NFR — Non-Functional Requirements — Accessibility, Performance, Security & Privacy, Reliability, Observability, i18n & Compatibility
- PAYMENT (blocking): Will a real gateway (Omise/2C2P/GB Prime) be added? If so it pulls PCI-DSS SAQ scope, tokenization and gateway analytics/error NFRs into NFR-SEC-01 and NFR-OBS-01 — deferred until decided.
- PAYMENT (blocking): Is Cash-on-Delivery (COD) in scope? COD has no slip, which changes slip-storage volume (NFR-SEC-01), reliability/idempotency assumptions (NFR-REL-01) and payment analytics (NFR-OBS-01).
- PAYMENT (blocking): Is the delivery ShopMode prepay (promptpay_slip) or pay-on-receipt? This determines whether delivery orders generate slips at all and the wording of payment copy (affects NFR-SEC-01, NFR-I18N-01).
- PERF: Confirm the exact reference-device list and p90/p99 cold-start + fps budgets for NFR-PERF-01 (proposed: iPhone SE 2nd gen + a Snapdragon-6xx Android).
- COMPAT: Confirm exact minimum iOS/Android floors against the Expo SDK 54 docs, and get sign-off on the admin-web browser support matrix (NFR-COMPAT-01).
- OBS/SEC: Select crash + analytics vendors (e.g. Sentry/Firebase/Amplitude) and confirm a PDPA data-processing agreement and data-residency requirement.
- REL/OBS: Confirm whether the >=99.5% crash-free KPI is per-release or rolling-7-day, and the admin-web JS error-rate target.
- ENUM HYGIENE: Existing code uses ShopMode 'online' while the canonical value is 'pickup' — confirm the normalization point (UI label vs stored/analytics value) so events stay consistent.

## B. Consistency & gap critique

**ภาพรวม:** The v1 requirements set is broad and well-structured per surface, with strong a11y and PDPA coverage and good cross-surface enum discipline in the stories. However it is not yet a coherent, buildable v1 because of one central unresolved decision and several missing connective stories. (1) The DELIVERY payment-timing decision (prepay PromptPay+slip vs pay-on-receipt/COD) is flagged "open" in literally every epic but the existing code (app/(tabs)/cart.tsx PAYMENT_HINT.delivery='ชำระปลายทาง หรือโอนเมื่อรับของ', CTA 'สั่งซื้อ & จัดส่ง') has already silently implemented pay-on-receipt, which contradicts the locked PromptPay+slip decision and breaks the entire delivery happy path and all rider/admin payment gating. (2) The canonical model has two structural inconsistencies that will cause cross-surface bugs: ShopMode 'online' vs 'pickup' (still 'online' in code), and a PaymentStatus/OrderStatus naming+containment collision (awaiting_payment/slip_uploaded/verifying|payment_verifying/rejected|payment_rejected appear in BOTH enums). (3) Several lifecycle states can be SET by one surface but no surface REACTS: delivery_failed (rider sets, no admin recovery story), refund (admin notes 'owed' but nothing executes/closes it or informs the customer), and stock (managed by admin, surfaced to customer, but never actually decremented on order or restored on cancel). (4) Multiple UI affordances already exist with no owning epic: the notification bell (no notification center/inbox), promo codes and hero banners/featured sections (no admin authoring epic), and rider accounts (assigned and 'deactivated' but no admin provisioning story). The pickup flow traces end-to-end cleanly; the delivery flow does not. Recommend resolving the delivery-payment ADR and the enum reconciliation FIRST, then adding the ~8 connective stories below before build.

### Gaps
- **[high] Stock lifecycle (decrement / reserve / restock)** — ADM-CAT-03 lets admin set stock and CUS-PRODUCT-05/CUS-CART-06 surface out-of-stock to customers, but NO story decrements stock when an order is placed/paid, and NO story restores stock when an order is cancelled (ADM-ORD-06), payment_rejected (ADM-PAY-04) or delivery_failed (RID-DLV-05). data/products.ts has no stock field at all. Without an owning story the overselling guard ADM-CAT-03 promises cannot actually exist. Commitment timing (placed vs paid vs fulfillment) is flagged open but no story owns the mechanic in either direction.
- **[high] delivery_failed has no reacting surface** — RID-DLV-05 lets a rider set out_for_delivery -> delivery_failed, but no admin story handles it: ADM-ORD has no re-dispatch/reschedule/refund flow for a failed delivery, and ADM-ORD-03 only allows 'valid forward transitions'. The order becomes an orphaned terminal. CUS-ORDERS lacks a customer-facing 'your delivery failed, here's what happens next' story. Cross-surface ownership of delivery_failed -> (reset to assigned_to_rider | cancelled+refund) is undefined.
- **[high] Refund path never closes** — ADM-ORD-06 records a refund 'note/owed' and ADM-PAY-06 handles disputes, but there is no story that executes a refund, marks it completed, or informs the customer. Since v1 has no gateway, refunds are manual PromptPay, yet no refund lifecycle (owed -> sent -> confirmed) and no customer visibility story exists for paid orders that are cancelled (CUS-ORDERS-04), payment_rejected, or delivery_failed.
- **[high] Admin rider account provisioning / deactivation missing** — ADM-ORD-04 assigns 'one of the shop's own riders' and RID-AUTH-05 says access is lost 'if deactivated', but NO admin story creates, invites, edits, or deactivates rider accounts. ADM-AUTH-04 covers STAFF only, not riders. The rider pool that ADM-ORD-04 selects from and the deactivation RID-AUTH-05 depends on have no owning surface — a broken reference.
- **[high] Notification center / bell destination + triggers** — CUS-BROWSE-01 and cart.tsx both render a notification bell with onPress={()=>{}} and no destination screen or owning epic (flagged in CUS-BROWSE OpenQ). CUS-ORDERS-03 defines customer status pushes, but there is no notification inbox, no rider 'you were assigned a job' push story (ADM-ORD-04 only asserts 'the rider is notified'), and no admin new-order/low-stock alert delivery story (ADM-ORD-01/ADM-CAT-07 assume alerts with no channel/trigger owner). The Notification entity exists with scattered triggers but no unified epic.
- **[medium] Admin merchandising authoring (banners, featured, promo codes)** — Customers consume hero banners (CUS-BROWSE-02), curated featured sections (CUS-BROWSE-06), and promo codes (CUS-CART-05, PromoCode entity), but NO admin story authors any of them. There is no ADM epic to create/schedule banners, configure featured rows, or create/limit/expire PromoCodes (min-spend, validity, per-user cap). CUS-BROWSE OpenQ explicitly asks whether banners are CMS-managed and ties it to a missing 'ADMIN merchandising epic'.
- **[medium] Guest cart & wishlist merge on login** — CUS-ONB-08 establishes guest browse with an auth gate at checkout, and CUS-WISHLIST/CUS-CART are device-local in code, but no story defines merging the guest cart (and guest wishlist) into the account on sign-in, dedupe rules, or what happens on logout. Without it, the auth gate at checkout risks losing the cart the customer just built.
- **[medium] Delivery serviceability / address validation** — CUS-PROFILE-03 stores addresses and CUS-CHK-02 selects one, but no story validates the address is in a delivery zone or meets a delivery minimum before allowing a delivery order (CUS-MODE OpenQ flags it, no story owns it). A customer can place a delivery order to an unserviceable address with no check, and RID-DLV-01 navigation assumes a usable/geocoded address that CUS-PROFILE-04 (map pin) leaves as a [should].
- **[medium] Rider assignment accept/decline/timeout -> reassignment** — ADM-ORD-04 (admin push-assign) and RID-QUEUE-02 (rider self-accept) coexist, but there is no state or story for a pushed assignment the rider never accepts or declines: no 'rider accepted' substate between assigned_to_rider and out_for_delivery, and no reassignment-on-timeout flow (RID-AUTH-04/ADM-ORD OpenQs flag the threshold but no story owns it). A pushed order can stall with an offline/unreachable rider.
- **[medium] awaiting_payment expiry / abandoned-order cleanup** — CUS-CHK-04 enters awaiting_payment and CUS-CHK OpenQ asks whether it expires, but no story defines an auto-cancel/timeout, stock-release, or QR-reissue for orders abandoned before slip upload. If stock is ever reserved at placed, abandoned carts permanently hold inventory.
- **[medium] Proof-of-delivery & rider identity visibility** — RID-DLV-04 captures a POD photo and RID-AUTH-06 maintains rider name/vehicle/plate 'so customers can identify me', but no customer or admin story exposes the POD photo or the assigned rider's identity/contact/location. CUS-ORDERS-02 timeline shows status only — the delivery customer cannot see who is delivering or proof it arrived.
- **[medium] Who sets OrderStatus=confirmed (payment vs order epic)** — ADM-PAY-03 says approving a slip moves the order 'on into fulfillment' (payment_verifying -> paid), while the canonical lifecycle has payment_verifying -> confirmed and ADM-ORD-03 owns forward transitions. It is unspecified whether slip approval auto-advances OrderStatus to confirmed or whether admin must separately advance it in ADM-ORD-03 — risking a stuck 'paid but not confirmed' gap or duplicate ownership.
- **[low] Order receipt / tax record after paid** — No story produces a customer receipt/confirmation artifact after PaymentStatus=paid, yet PDPA erasure (CUS-PROFILE-07) wants to retain financial/tax records on account deletion. The receipt/record that erasure must preserve has no owning story.

### Inconsistencies
- **ShopMode value: 'online' vs canonical 'pickup' (and 3 Thai labels)** (CUS-ONB, CUS-PROFILE, CUS-BROWSE, CUS-SEARCH, CUS-PRODUCT, CUS-CART, CUS-MODE, CUS-CHECKOUT, CUS-ORDERS, ADM-ORDERS, ADM-PAYMENT, ADM-DASH, RID-AUTH, RID-QUEUE, NFR) — Canonical enum is delivery|pickup, but store/mode.ts, MODE_META keys, ModeSwitch ACCENT keys, and cart.tsx PAYMENT_HINT all use 'online' with label 'ออนไลน์'. Stories variously call it pickup / online / ออนไลน์ / รับที่ร้าน (CUS-CHK-03, CUS-MODE-01 use 'รับที่ร้าน'/pickup). One concept, four names. Every epic's OpenQ flags this but it is still unreconciled in code, and Order records + admin queue labels + dashboard breakdowns will diverge until renamed.
- **PaymentStatus vs OrderStatus naming + containment collision** (CUS-CHECKOUT, CUS-ORDERS, ADM-PAYMENT, ADM-ORDERS, ADM-DASH) — The canonical PaymentStatus values awaiting_payment|slip_uploaded|verifying|paid|rejected are ALSO embedded as OrderStatus values (placed -> awaiting_payment -> slip_uploaded -> payment_verifying -> confirmed). Same concept is named two ways: 'verifying' (PaymentStatus, used in ADM-PAY-05, CUS-CHECKOUT goal) vs 'payment_verifying' (OrderStatus, used in CUS-ORDERS-02); 'rejected' (PaymentStatus) vs 'payment_rejected' (OrderStatus terminal). It is undefined whether OrderStatus and PaymentStatus are orthogonal tracks (ADM-DASH-02 filters them independently, implying orthogonal) or a single merged enum (the lifecycle merges them). This will produce mismatched state machines across surfaces.
- **payment_rejected listed as terminal but treated as recoverable** (CUS-CHECKOUT, CUS-ORDERS, ADM-PAYMENT) — The canonical lifecycle lists payment_rejected under 'terminal/branch', yet CUS-CHK-07, CUS-ORDERS-06, ADM-PAY-04/ADM-PAY-08 all describe the customer re-uploading a slip and the order returning to slip_uploaded -> verifying. A terminal state cannot loop back; the lifecycle definition contradicts the recovery stories. The reset path (rejected -> awaiting_payment -> slip_uploaded) and a max-retry cap are undefined.
- **Delivery payment copy contradicts the locked PromptPay+slip decision** (CUS-CART, CUS-MODE, CUS-CHECKOUT, ADM-PAYMENT, ADM-ORDERS, RID-QUEUE, RID-DELIVERY) — Locked decision = PromptPay QR + uploaded slip, admin-verified. But cart.tsx hardcodes PAYMENT_HINT.delivery='ชำระปลายทาง หรือโอนเมื่อรับของ' (pay-on-receipt/COD) and CTA 'สั่งซื้อ & จัดส่ง', and onBuyNow just clears the cart with an Alert — no Order, no PaymentStatus, no slip. This uses a PaymentMethod (cod/pay-on-receipt) that is NOT in the v1 enum (promptpay_slip only). Code and stories disagree on the delivery payment method.
- **Roles enum (customer|admin|rider) vs owner/staff tiers** (ADM-AUTH, ADM-CATALOG, ADM-ORDERS, ADM-PAYMENT, ADM-DASH) — Canonical Roles has a single 'admin', but ADM-AUTH-03/04, ADM-ORD-08, ADM-PAY, ADM-DASH, ADM-CAT all assume an owner-vs-staff permission split (owner-only actions, staff-limited actions, step-up re-auth). Whether owner/staff is a sub-tier attribute within Roles=admin or first-class roles is unresolved and assumed inconsistently (some stories gate by tier, the canonical enum cannot express it).
- **Wishlist concept named 'wishlist' vs 'favorite/รายการโปรด'** (CUS-PRODUCT, CUS-WISHLIST) — CUS-PRODUCT-06 calls it 'wishlist' while CUS-WISHLIST consistently uses 'favorite'/'รายการโปรด' and 'heart'. Same feature, two names across epics — low risk but should be normalized for copy and analytics events (NFR-OBS-01 funnel events).
- **Cart line merge key excludes color while data model carries colors[]** (CUS-CART, CUS-PRODUCT, ADM-CATALOG) — store/cart.ts keys lines by productId+size only and silently drops a second color (color excluded from cartItemId). CUS-CART OpenQ asks to confirm color is never a real grocery variant axis. If any product (e.g. kitchenware) uses color, two different colors merge into one line — a correctness inconsistency between the CartItem model and the merge rule.
- **Single flat price vs per-size pricing/stock** (CUS-PRODUCT, CUS-CART, ADM-CATALOG) — Product has one price and no per-size stock (data/products.ts), but products carry multiple sizes ('1 กก.'/'5 กก.', '600 มล.'/'1.5 ลิตร') and the cart already keys by size. CUS-CART-04 subtotal, ADM-CAT-01/03 stock, and CUS-PRODUCT-03 size selection cannot be correct until price+stock are decided per variant. The data model and the size-aware UI are inconsistent.

### Duplications
- CUS-BROWSE-04 (category chips filter the discovery list) and CUS-SEARCH-02 (category filter chips) are the same control on two screens — CUS-BROWSE OpenQ itself asks whether Search belongs to Home or a separate epic. Merge into one filtering capability with two entry points or clearly split Home-discovery vs Search ownership.
- CUS-BROWSE-05 (discovery loading/empty/error states), CUS-SEARCH-05 (empty/no-results), and CUS-SEARCH-08 (catalog load loading & error/retry) overlap heavily on the same loading/empty/error/retry states for the same catalog. Consolidate the catalog list-state pattern once.
- CUS-PRODUCT-06 (toggle wishlist from product detail) is a strict subset of CUS-WISHLIST-01 (toggle favorite from anywhere it appears, which explicitly includes 'product detail header'). Fold CUS-PRODUCT-06 into CUS-WISHLIST-01.
- Per-epic a11y stories duplicate the cross-cutting NFR: CUS-BROWSE-08, CUS-SEARCH-07, CUS-PRODUCT-08, CUS-CART-08, CUS-WISHLIST-06, CUS-MODE-06, CUS-CHK-08, RID-QUEUE-07, ADM-DASH-07 all re-assert the same WCAG-AA/44pt/dynamic-type/reduced-motion baseline owned by NFR-A11Y-01/02/03. Keep NFR as the single normative baseline and reduce per-screen stories to only screen-specific a11y deltas to avoid 9x duplicated ACs.
- CUS-MODE-05 (mode drives cart summary, payment hint, CTA) and CUS-MODE-03 (delivery fee + free-delivery threshold) overlap with CUS-CART-04 (cart summary: subtotal, delivery fee, total). Both the Mode epic and the Cart epic own the cart summary rendering — define one owner (cart renders, mode supplies the rule).
- Add-to-cart + merge logic is restated across CUS-PRODUCT-04, CUS-CART-01, CUS-WISHLIST-04, CUS-WISHLIST-08, and CUS-ORDERS-05 (reorder). CUS-CART-01 should own the canonical merge-by-product+size rule; the others should reference it rather than re-specify it.
- ADM-DASH-02 (orders view: filter/search by canonical enums) overlaps ADM-ORD-01 (live incoming order queue) and ADM-ORD-02 (order detail). ADM-DASH OpenQ flags whether the dashboard should surface an actionable queue or leave it to ADM-ORD. Define read-only reporting (DASH) vs operational queue (ORD) to avoid two order lists.
- Customer-side reject recovery appears twice: CUS-CHK-07 (track payment state and recover from rejection) and CUS-ORDERS-06 (recover from a rejected payment). Same re-upload loop from two screens — merge or explicitly scope checkout-session recovery vs order-history recovery.

### Missing end-to-end flows
- DELIVERY happy path is BROKEN at payment: placed -> awaiting_payment -> ??? . Because the prepay-vs-pay-on-receipt decision is unresolved, it is undefined whether delivery orders enter the slip flow (slip_uploaded -> payment_verifying -> paid, ADM-PAY) before confirmed, or skip straight to confirmed/preparing. Downstream this blocks ADM-PAY-08 (is delivery in the verify queue), ADM-ORD-04 (is PaymentStatus=paid a precondition to assign a rider), and RID-QUEUE-06/RID-DLV-06 (cash collection). Code (cart.tsx) assumes pay-on-receipt; stories assume prepay. This single flow cannot be traced end-to-end today.
- PICKUP happy path traces cleanly and should be the reference: placed (CUS-CHK-04) -> awaiting_payment -> pay PromptPay QR + upload slip (CUS-CHK-05/06) -> slip_uploaded -> verifying/claim (ADM-PAY-05) -> approve (ADM-PAY-03) -> paid/confirmed -> preparing (ADM-ORD-03) -> ready_for_pickup (ADM-ORD-05) -> push to customer (CUS-ORDERS-03) -> picked_up (ADM-ORD-05). The only gaps are stock decrement (no story) and the ambiguous 'who sets confirmed' handoff between ADM-PAY-03 and ADM-ORD-03.
- Stock decrement-on-order and restock-on-cancel: no end-to-end flow exists from order placement back to the ADM-CAT-03 inventory in either direction.
- Refund flow for an already-paid order that is cancelled (CUS-ORDERS-04 / ADM-ORD-06), payment_rejected, or delivery_failed: 'refund owed' is recorded but never executed, confirmed, or shown to the customer — no terminal for money.
- delivery_failed recovery: rider reports it (RID-DLV-05) but there is no admin re-dispatch/refund flow and no customer-facing outcome — the order has no path to a true terminal.
- Rider assignment acceptance: assigned_to_rider (ADM-ORD-04 push) has no accept/decline/timeout substate before out_for_delivery (RID-DLV-03), so a never-accepted push assignment has no reassignment flow.
- Notification trigger->delivery->inbox flow: status changes (CUS-ORDERS-03), rider-assigned (ADM-ORD-04), low-stock (ADM-CAT-07) and new-order (ADM-ORD-01) all imply notifications, but there is no channel, consent wiring, or inbox screen the bell (CUS-BROWSE-01/cart.tsx) opens.
- Guest -> account merge: guest builds cart/wishlist (CUS-ONB-08) then signs in at the checkout gate, but there is no merge flow, so the just-built cart's fate at the auth boundary is untraceable.
- Order creation handoff: cart.tsx onBuyNow currently clear()s the cart and shows an Alert with NO Order/Payment created — the cart->CUS-CHK-04 (create Order, enter awaiting_payment) handoff is unimplemented and undefined for who persists the Order.

### Open decisions to surface
- BLOCKER #1 — DELIVERY payment timing: is ShopMode=delivery prepay (PaymentMethod=promptpay_slip, must reach paid before confirmed/assigned_to_rider) or pay-on-receipt? This is flagged open in EVERY epic and the code already assumes pay-on-receipt (cart.tsx). It gates ADM-PAY-08, ADM-ORD-03/04, RID-QUEUE-06, RID-DLV-03/06, the delivery timeline (CUS-ORDERS-02/03), and revenue recognition (ADM-DASH). Resolve before any delivery build.
- COD as a v1 PaymentMethod: if delivery is pay-on-receipt, must 'cod' be promoted from future/open into v1 (alongside promptpay_slip)? This activates RID-QUEUE-06/RID-DLV-06 (cash collection), rider float/settlement/reconciliation fields (RID-AUTH-06), and a cash-in-hand block on going offline (RID-AUTH-04).
- Real payment gateway (Omise/2C2P/GB Prime): deferred — confirm it stays out of v1. If in, it pulls PCI-DSS SAQ scope, tokenization, and gateway analytics into NFR-SEC-01/NFR-OBS-01 and changes ADM-PAY entirely.
- Refund mechanism with no gateway: confirm manual out-of-band PromptPay refunds for v1, define the refund lifecycle (owed -> sent -> confirmed), who executes it, and how the customer is informed (affects ADM-ORD-06, ADM-PAY-06, CUS-ORDERS-04/06).
- Enum reconciliation #1 — rename ShopMode 'online' -> 'pickup' across store/mode.ts (ShopMode type, MODE_META keys), components/shop/ModeSwitch ACCENT keys, and cart.tsx PAYMENT_HINT keys; decide the customer-facing Thai label (keep 'ออนไลน์' vs switch to clearer 'รับที่ร้าน').
- Enum reconciliation #2 — decide whether OrderStatus and PaymentStatus are orthogonal tracks or one merged enum, and pick ONE name for each shared state: verifying vs payment_verifying, rejected vs payment_rejected. Then make payment_rejected explicitly recoverable (not terminal) with a reset path and max-retry cap.
- Stock model & commitment timing: add a stock field to Product (boolean inStock vs numeric stockQty, per-size?), and decide whether stock is reserved at placed, decremented at paid, or at fulfillment, plus restock-on-cancel/reject/failed. Depends on the delivery-payment decision.
- Per-size pricing: does each size carry its own price and stockQty (cart already keys by size, but cartSubtotal uses one flat price)? Blocks correct CUS-CART-04 subtotal and ADM-CAT-01/03.
- Admin role granularity: is owner vs staff a permission tier within Roles=admin or first-class roles? Needed for ADM-AUTH-03/04, step-up re-auth (ADM-AUTH-06), price/delete gating (ADM-CAT), payment approval (ADM-PAY), and revenue visibility (ADM-DASH).
- Notifications: pick channel(s) (push/SMS/LINE), decide transactional vs consented pushes + quiet hours, name the owning epic/inbox screen the bell opens, and assign ownership of Thai copy for ready_for_pickup, rejection, assignment, and cancellation messages.
- Delivery serviceability: is choosing delivery gated by a delivery zone and/or minimum order value, and does the rider need geocoded lat/lng (CUS-PROFILE-04 map pin is only a [should]) for RID-DLV-01 navigation? Pick the map/geocoding provider and address model (free-text vs structured จังหวัด/อำเภอ/ตำบล + postcode).
- PDPA specifics needing legal/DPO sign-off: data-access/export/erasure SLAs and scope, erase-vs-anonymise for past orders (finance/tax retention), slip/POD media retention and who may view, cancellation/grace window, minors/age consent, and the separate optional marketing consent vs mandatory processing consent.
- Delivery fee (฿40) and free-delivery threshold (฿200): hardcoded constants (current store/mode.ts) or admin-configurable from the admin web?
- Pickup branch count: confirm v1 is a single branch with no branch picker (CUS-CHK-03), and confirm the Home 'branch header' (CUS-BROWSE-01) is always the one อู้ฟู่ shop.
- Catalog source: is the catalog remote/async in v1 (gates CUS-BROWSE-05/CUS-SEARCH-08 loading/error states) or the current static in-memory array? And the CUS-SEARCH-04 popularity metric source (no sales field exists) and whether product reviews are in scope.
- SMS/OTP provider + Thai sender-ID registration, which social providers actually ship (LINE/Apple/Google credentials), and account-merge/identity-resolution rules when one person uses phone OTP and a social provider.

### Recommendations
- Resolve the delivery-payment ADR FIRST (prepay vs pay-on-receipt, and whether COD/gateway enter v1). It is the single dependency that unblocks the most stories across all three surfaces; nothing in the delivery branch is safely buildable until it lands.
- Publish a one-page canonical state-machine doc that (a) separates OrderStatus from PaymentStatus into two explicit orthogonal tracks, (b) fixes one spelling per state, (c) marks which surface owns each transition (e.g. ADM-PAY owns ->paid, ADM-ORD owns ->confirmed/preparing/ready_for_pickup/picked_up/cancelled, RID owns out_for_delivery/delivered/delivery_failed), and (d) defines reverse edges (reject->re-upload, delivery_failed->re-dispatch, cancel->refund, restock).
- Do the ShopMode 'online'->'pickup' rename as a small prerequisite refactor across store/mode.ts, components/shop/ModeSwitch, and app/(tabs)/cart.tsx PAYMENT_HINT before building any new mode-dependent surface, so analytics (NFR-OBS-01) and admin labels stay consistent.
- Add the missing connective stories: stock decrement/reserve + restock; refund execution & customer-visible refund status; delivery_failed admin recovery; admin rider-account provisioning/deactivation; a Notifications epic (triggers + channel + inbox the bell opens); admin merchandising authoring (banners/featured/promo codes); guest cart+wishlist merge on login; and assignment accept/decline/timeout->reassignment.
- Decide per-size price+stock and add stock to the Product model now; it is a shared blocker for CUS-PRODUCT-05, CUS-CART-04/06, ADM-CAT-01/03 and the overselling guard. Also fix the cart merge key (store/cart.ts) to include color if any product ever uses color, or assert grocery is colorless.
- Consolidate duplicated stories: merge the category-filter and loading/empty/error stories across CUS-BROWSE and CUS-SEARCH; fold CUS-PRODUCT-06 into CUS-WISHLIST-01; make NFR-A11Y the single normative a11y baseline and trim the nine per-screen a11y stories to screen-specific deltas; pick one owner for the cart summary between CUS-MODE and CUS-CART.
- Replace the placeholder cart.tsx onBuyNow (which clears the cart with an Alert and creates no Order) with the real CUS-CHK-04 handoff that persists an Order and enters awaiting_payment, and remove the COD-implying delivery payment hint until the payment ADR is decided.
- Expose proof-of-delivery and assigned-rider identity to the delivery customer (extend CUS-ORDERS-02) and define awaiting_payment expiry + abandoned-order cleanup so reserved stock and stale QR codes are released.
