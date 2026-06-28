# 03b — Functional Requirements: Grooming (connective + COD stories)

> รอบ grooming หลัง ADR-0002 (delivery=both) — เติม story ที่ critic ชี้ว่าขาด เพื่อให้ v1 'สร้างได้จริง'
> ต่อท้าย `03-functional-requirements.md` (149 stories) — รวมเป็น 193 stories

## สรุป
- **GROOM-PAY** Payment & COD — connective payment lifecycle for delivery (prepay + COD) — 11 stories
- **GROOM-STOCK** Inventory / Stock Lifecycle — reserve, decrement, restock & overselling guard — 6 stories
- **GROOM-FULFILL** Order Recovery & Fulfillment Edges — 7 stories
- **GROOM-ACCOUNTS** Accounts: Rider Provisioning, Roles & Guest Merge — 8 stories
- **GROOM-ENGAGE** Notifications Center & Merchandising Authoring — 12 stories

**รวมรอบ grooming: 44 stories**


## GROOM-PAY — Payment & COD — connective payment lifecycle for delivery (prepay + COD)
> Make the อู้ฟู่ v1 payment flows buildable and internally consistent across the three surfaces by closing the gaps ADR-0002 opened: a delivery checkout selector for promptpay_slip vs cod; the COD lifecycle (skip awaiting_payment, auto-confirm, collect paid at delivered); rider cash collection with a per-shift float and end-of-shift settlement/reconciliation; the manual-PromptPay refund lifecycle (owed->sent->confirmed) for cancelled/payment_rejected/delivery_failed and how the customer is told; awaiting_payment expiry/auto-cancel plus QR reissue for abandoned prepay orders; and an unambiguous rule for who sets OrderStatus=confirmed (slip-approval for prepay vs system for COD).

#### GROOM-PAY-01 — Delivery checkout payment-method selector (PromptPay prepay vs COD)  `🔴 MUST`
**As** customer placing a delivery order (P1 น้องแนน), **I want** to choose between PromptPay prepay (promptpay_slip) and cash-on-delivery (cod) at checkout, **so that** I can pay the way that suits me, while pickup orders stay prepay-only per ADR-0002.
> 🩹 *closes:* checkout prepay/COD selector for delivery (pickup forced prepay)

*Acceptance criteria:*
- Given ShopMode=delivery, When I reach the payment step, Then a selector offers exactly two PaymentMethod options — promptpay_slip and cod — with promptpay_slip preselected.
- Given ShopMode=pickup, When I reach the payment step, Then the selector is hidden/locked to promptpay_slip and cod is never offered (pickup-is-always-prepay invariant).
- Given cod is unavailable for my order (subtotal above the COD cap, or COD disabled by admin), When I view the selector, Then cod is shown disabled with a Thai reason and promptpay_slip stays selectable.
- Given I select cod and place the order, When the order is created, Then PaymentMethod=cod is persisted and carried to ADM-ORDERS and RID-QUEUE.
- Given I am P2 ป้าสมศรี using a screen reader, When I focus each option, Then it exposes an accessible label and selected/disabled state (e.g. 'พร้อมเพย์ จ่ายก่อน, เลือกอยู่' / 'เก็บเงินปลายทาง'), the disabled reason is announced, and touch targets are >=44pt.
- Given I selected cod then switched ShopMode delivery->pickup, When I return to the payment step, Then the method resets to promptpay_slip and I am re-prompted.

*Dependencies:* CUS-CHECKOUT, CUS-MODE

*Notes:* Realises ADR-0002 at the UI. COD cap value and per-customer eligibility are TBD (see open questions). Note the live code's store/mode.ts still uses ShopMode 'online' rather than canonical 'pickup' — must be reconciled.

#### GROOM-PAY-02 — COD order lifecycle — skip awaiting_payment, auto-confirm on placement  `🔴 MUST`
**As** the order subsystem / admin (P3) handling COD delivery orders, **I want** a placed COD order to move straight to confirmed without an awaiting_payment/slip stage, **so that** there is nothing to verify up front and the order flows into preparing immediately.
> 🩹 *closes:* COD order lifecycle: skip awaiting_payment -> confirmed; paid collected at delivered

*Acceptance criteria:*
- Given PaymentMethod=cod, When the order is placed (OrderStatus=placed), Then the system auto-transitions OrderStatus placed->confirmed, skipping awaiting_payment, slip_uploaded and payment_verifying.
- Given a confirmed COD order, When viewed before delivery, Then PaymentStatus=awaiting_payment (cash owed, collect at delivered) and the order is eligible to advance to preparing in ADM-ORDERS.
- Given PaymentMethod=cod, When I view the order as the customer, Then no PromptPay QR or slip-upload step is ever shown.
- Guard: Given ShopMode=pickup, When placement is attempted with cod, Then it is rejected so this auto-confirm path is delivery-only.
- Idempotency: Given the placement event is replayed, When processed again, Then no duplicate placed->confirmed transition is recorded.
- Edge: Given a COD order is cancelled before delivered (PaymentStatus still awaiting_payment), When it becomes cancelled, Then no refund is created because no money was collected.

*Dependencies:* CUS-CHECKOUT, ADM-ORDERS, GROOM-PAY-01

*Notes:* PaymentStatus enum has no dedicated cod-pending value; awaiting_payment is deliberately reused to mean 'cash owed, collect at delivered'. Confirm this mapping (open questions).

#### GROOM-PAY-03 — Authority for setting confirmed — slip approval (prepay) vs system (COD)  `🔴 MUST`
**As** admin (owner/staff, P3) and the order subsystem, **I want** one clear rule for who/what sets OrderStatus=confirmed, **so that** prepay and COD orders confirm consistently and unpaid prepay orders cannot be confirmed by mistake.
> 🩹 *closes:* who actually sets confirmed (slip-approval vs order epic)

*Acceptance criteria:*
- Given a prepay order (promptpay_slip) in payment_verifying, When an admin approves the slip in ADM-PAYMENT, Then PaymentStatus->paid and the same action transitions OrderStatus payment_verifying->confirmed.
- Given a prepay order in payment_verifying, When an admin rejects the slip, Then PaymentStatus->rejected and OrderStatus->payment_rejected (never confirmed).
- Given a COD order, When it is placed, Then OrderStatus=confirmed is set by the system (per GROOM-PAY-02), not by any ADM-PAYMENT action.
- Guard: Given a prepay order whose PaymentStatus != paid, When anyone tries to set OrderStatus=confirmed from ADM-ORDERS, Then it is blocked with an error ('รอตรวจสลิปก่อน').
- Audit: Given any confirmed transition, When it occurs, Then it records the actor (admin id + tier, or 'system') and timestamp.
- Given both owner and staff tiers, When approving slips, Then both may approve unless restricted by ADM-AUTH config (no extra restriction added here).

*Dependencies:* ADM-PAYMENT, ADM-ORDERS, ADM-AUTH, GROOM-PAY-02

*Notes:* Resolves the ownership boundary: ADM-PAYMENT owns prepay confirmed via slip approval; the system owns COD confirmed; ADM-ORDERS never confirms unpaid prepay.

#### GROOM-PAY-04 — Rider collects COD cash at delivery and marks paid  `🔴 MUST`
**As** rider (P4), **I want** to record cash collected when I hand over a COD order and mark it delivered, **so that** the order's payment closes as paid and my shift cash tally stays accurate.
> 🩹 *closes:* rider cash collection (paid set at delivered)

*Acceptance criteria:*
- Given a COD order out_for_delivery, When I tap 'Delivered', Then I am prompted to confirm cash collected equal to the order total before completion.
- Given I confirm full cash collected, When I complete, Then OrderStatus->delivered, PaymentStatus->paid, and the amount is added to my open shift tally (GROOM-PAY-05).
- Given a prepay (promptpay_slip) order out_for_delivery, When I mark Delivered, Then no cash prompt appears (PaymentStatus already paid) and OrderStatus->delivered.
- Edge — customer cannot/won't pay: Given I cannot collect the cash, When I select 'Cannot collect', Then OrderStatus->delivery_failed, PaymentStatus stays awaiting_payment, and nothing is added to my tally.
- Offline: Given no connectivity at the doorstep, When I record collection, Then it is queued locally and syncs idempotently when back online without double-counting.
- a11y: Given the collect prompt, When shown, Then the amount-to-collect is large-text and announced, and completing requires an explicit second confirm to avoid mis-taps.

*Dependencies:* RID-DELIVERY, RID-QUEUE, GROOM-PAY-02, GROOM-PAY-05

*Notes:* Short/partial payment is out of scope for v1 — treat as delivery_failed (open questions). delivery_failed on COD never creates a refund (no money collected; see GROOM-PAY-07).

#### GROOM-PAY-05 — Per-shift rider cash float and running tally  `🟠 SHOULD`
**As** rider (P4) and admin (P3), **I want** each rider shift to start with a recorded cash float and track expected cash as COD is collected, **so that** the cash a rider holds is always reconcilable at end of shift.
> 🩹 *closes:* per-shift rider cash float

*Acceptance criteria:*
- Given a rider starts a shift, When the opening float is recorded (by rider or admin), Then ShiftStatus=open and ExpectedCash = float.
- Given an open shift, When a COD order is marked paid (GROOM-PAY-04), Then ExpectedCash += order total and the rider sees the updated running tally.
- Given an open shift, When the rider views it, Then a breakdown is shown (opening float + each COD collection with order id and amount).
- Guard: Given a rider with an open, unsettled shift, When they try to start a new shift, Then it is blocked until settlement completes (GROOM-PAY-06).
- Edge: Given a collected COD order later moves to delivery_failed/cancelled, When that happens, Then its amount is reversed out of ExpectedCash with an audit entry.
- a11y: Given the tally screen, When read by a screen reader, Then float, each collection and the total are labelled with currency.

*Dependencies:* RID-AUTH, RID-DELIVERY, GROOM-PAY-04

*Notes:* Exactly one open shift per rider. Float source (admin pre-funds cash vs rider's own) is TBD (open questions).

#### GROOM-PAY-06 — End-of-shift cash settlement and reconciliation with the shop  `🟠 SHOULD`
**As** admin (owner tier, P3) and rider (P4), **I want** to reconcile a rider's expected cash against actual cash handed in and record any variance, **so that** COD cash is fully accounted for and discrepancies are surfaced.
> 🩹 *closes:* rider settlement/reconciliation with the shop

*Acceptance criteria:*
- Given an open shift, When the rider ends it, Then the system shows ExpectedCash = opening float + sum(COD collected) for the shift.
- Given settlement, When the admin enters ActualCash counted, Then Variance = ActualCash - ExpectedCash is computed and stored, labelled over/short.
- Given |Variance| == 0, When settlement is submitted, Then ShiftStatus=settled and the shift closes automatically.
- Given |Variance| > 0, When settlement is submitted, Then it requires an owner-tier admin to accept/annotate the variance before close (staff tier cannot accept variance).
- Audit: Given a settlement, When closed, Then it records rider id, admin id + tier, expected, actual, variance and timestamp, and is immutable thereafter.
- Guard: Given a settled shift, When a correction is needed, Then it cannot be re-opened — corrections create a new adjustment entry, not an edit.
- a11y: Given the settlement screen, When read by a screen reader, Then expected/actual/variance are labelled and the variance sign is announced ('ขาด'/'เกิน').

*Dependencies:* ADM-AUTH, ADM-DASH, GROOM-PAY-05

*Notes:* Variance auto-accept tolerance threshold is TBD (open questions). Reporting surfaces on ADM-DASH.

#### GROOM-PAY-07 — Create refund obligation (owed) when a paid order is not fulfilled  `🔴 MUST`
**As** the order subsystem / admin (P3), **I want** a Refund at RefundStatus=owed created whenever an order that already holds the customer's money becomes terminal-unfulfilled, **so that** money owed back to customers is never lost and is queued for payout.
> 🩹 *closes:* refund lifecycle (owed) trigger for cancel/payment_rejected/delivery_failed

*Acceptance criteria:*
- Given an order with PaymentStatus=paid, When OrderStatus transitions to cancelled, payment_rejected, or delivery_failed, Then a Refund is created with RefundStatus=owed and amount = the paid amount.
- Given an order whose money was never received (COD awaiting_payment, or prepay still in awaiting_payment), When it becomes cancelled/delivery_failed/payment_rejected, Then NO refund is created.
- Given payment_rejected specifically, When the order is rejected, Then a refund is created only if funds were actually received and an admin marked 'funds received'; a plain bad-slip rejection with no money creates no refund.
- Idempotency: Given an order, When a terminal event is replayed, Then at most one open Refund exists for that order (no duplicates).
- Given a Refund is created, When stored, Then it records source order id, trigger reason (cancelled|payment_rejected|delivery_failed), amount and created-by.
- Edge: Given an order already fully refunded, When it re-enters a terminal state, Then no second owed refund is created.

*Dependencies:* ADM-ORDERS, ADM-PAYMENT, GROOM-PAY-02

*Notes:* RefundStatus enum = owed|sent|confirmed. payment_rejected needs a 'funds received' flag distinct from slip approval to disambiguate (open questions).

#### GROOM-PAY-08 — Admin issues manual PromptPay refund (owed -> sent -> confirmed)  `🔴 MUST`
**As** admin (owner tier, P3), **I want** to pay out an owed refund via manual PromptPay, record proof, and have the customer confirm receipt, **so that** the refund lifecycle reaches a verified close.
> 🩹 *closes:* refund lifecycle owed->sent->confirmed (manual PromptPay)

*Acceptance criteria:*
- Given RefundStatus=owed, When an owner-tier admin records the PromptPay transfer (amount, PromptPay ref/txn id, optional slip image), Then RefundStatus->sent and the customer is notified (GROOM-PAY-09).
- Guard: Given a refund, When the recorded amount != the owed amount, Then it is rejected (partial refunds out of scope in v1).
- Given RefundStatus=sent, When the customer confirms receipt, Then RefundStatus->confirmed and the refund closes.
- Edge — not received: Given RefundStatus=sent, When the customer reports 'not received', Then the refund stays sent, is flagged for admin follow-up, and a re-send is allowed and audited.
- Permission: Given a refund, When moving owed->sent, Then only owner-tier admins may do so; staff tier can view only.
- Audit + idempotency: Given any transition, When it occurs, Then actor + timestamp are recorded and re-submitting the same transfer does not create a duplicate sent event.

*Dependencies:* ADM-PAYMENT, ADM-AUTH, GROOM-PAY-07, GROOM-PAY-09

*Notes:* Manual PromptPay only (no payment gateway in v1). Whether sent auto-confirms after a timeout if the customer never acts is an open question.

#### GROOM-PAY-09 — Customer is told about refund status and can confirm receipt  `🟠 SHOULD`
**As** customer (P2 ป้าสมศรี, a11y critical), **I want** to see my refund's status (owed/sent/confirmed) with the PromptPay details and confirm when I receive it, **so that** I know my money is coming and can close the loop.
> 🩹 *closes:* how the customer is told about refunds

*Acceptance criteria:*
- Given my order triggered a refund, When I open it in CUS-ORDERS, Then a refund banner/timeline shows RefundStatus owed|sent|confirmed with Thai copy ('กำลังดำเนินการคืนเงิน' / 'โอนคืนแล้ว' / 'ยืนยันรับเงินคืนแล้ว').
- Given RefundStatus=sent, When I view the order, Then the PromptPay reference and amount are shown and a 'ยืนยันได้รับเงินคืน' action is available.
- Given RefundStatus=sent, When I tap 'ยังไม่ได้รับ', Then admin is notified (GROOM-PAY-08) and the status copy explains follow-up.
- Notification: Given a transition to sent or confirmed, When it occurs, Then a push notification is sent; if push is unavailable, a fallback channel is used.
- a11y (P2): Given any refund state, When read by a screen reader, Then all states, the amount and actions are labelled, the confirm action is a large touch target, and it requires a confirmation step to avoid accidental confirmation.
- Edge: Given RefundStatus=confirmed, When I view the order, Then a read-only completed state is shown with no actions.

*Dependencies:* CUS-ORDERS, GROOM-PAY-07, GROOM-PAY-08, NFR

*Notes:* Fallback channel (e.g. SMS) matters for P2 a11y; exact channel TBD (open questions).

#### GROOM-PAY-10 — awaiting_payment expiry and auto-cancel for abandoned prepay orders  `🔴 MUST`
**As** the order subsystem / admin (P3), **I want** prepay orders left unpaid in awaiting_payment to auto-cancel after a deadline, **so that** reserved stock and queue slots are released and stale orders don't linger.
> 🩹 *closes:* awaiting_payment expiry/auto-cancel for abandoned prepay orders

*Acceptance criteria:*
- Given a prepay order at OrderStatus=awaiting_payment with no slip, When the payment window elapses, Then OrderStatus->cancelled with reason=payment_timeout.
- Given an order auto-cancelled for timeout, When it cancels, Then reserved stock/holds are released and the customer is notified.
- Exemption: Given the customer uploads a slip before the deadline (OrderStatus->slip_uploaded->payment_verifying, PaymentStatus->verifying), When the timer fires, Then the order is not timed out while under review.
- Given a slip was rejected (PaymentStatus->rejected, OrderStatus->payment_rejected), When the timeout job runs, Then it is NOT auto-cancelled by this rule (handled via refund/reorder paths).
- Given a COD order, When the timeout job runs, Then it is never subject to awaiting_payment expiry (it is confirmed, not awaiting_payment).
- a11y + visibility: Given an awaiting_payment order, When the customer views it, Then a labelled countdown / 'ชำระภายใน …' is shown in CUS-ORDERS with screen-reader support.
- Idempotency: Given the timeout job, When it runs repeatedly, Then each eligible order is cancelled at most once.

*Dependencies:* CUS-CHECKOUT, CUS-ORDERS, ADM-ORDERS, GROOM-PAY-11

*Notes:* Payment window length is configurable; default TBD. Whether QR reissue extends the deadline is an open question (cross-ref GROOM-PAY-11).

#### GROOM-PAY-11 — PromptPay QR reissue for unpaid prepay orders  `🟠 SHOULD`
**As** customer (P1 น้องแนน), **I want** to regenerate the PromptPay QR (correct amount + order reference) for an order awaiting payment, **so that** I can still pay if I lost or never saw the original QR.
> 🩹 *closes:* QR/PromptPay reissue for abandoned prepay orders

*Acceptance criteria:*
- Given an order at OrderStatus=awaiting_payment, When I tap 'แสดง QR อีกครั้ง', Then a fresh PromptPay QR is generated with the exact order amount and a stable order reference.
- Given a reissued QR, When I act on it, Then the order stays in awaiting_payment and I can proceed to upload a slip (OrderStatus->slip_uploaded).
- Edge — already cancelled: Given the order was already auto-cancelled (GROOM-PAY-10) or payment_rejected, When I attempt reissue, Then it is blocked with a message and I am offered 'สั่งใหม่' (reorder).
- Given canonical enums treat payment_rejected as terminal, When a slip was rejected, Then reissue/re-upload on the same order is blocked by default in v1 and the customer is routed to reorder (pending business decision).
- Given reissue, When a new QR is produced, Then it does not by itself reset or extend the auto-cancel deadline unless configured (cross-ref GROOM-PAY-10).
- a11y: Given the QR screen, When read by a screen reader, Then the QR has a text alternative (amount + reference read out) and the reissue button is a large, labelled target.

*Dependencies:* CUS-CHECKOUT, CUS-ORDERS, GROOM-PAY-10

*Notes:* Per canonical enums payment_rejected is terminal, so a rejected->awaiting_payment re-upload loop is gated on a business decision; default v1 path is reorder, not re-upload.


## GROOM-STOCK — Inventory / Stock Lifecycle — reserve, decrement, restock & overselling guard
> Make อู้ฟู่ v1 inventory buildable and internally consistent by giving Product a real per-size stock+price model and wiring it end-to-end through the canonical OrderStatus/PaymentStatus lifecycle. Under ADR-0002 (delivery = customer-chosen PREPAY promptpay_slip or COD; pickup always prepay), stock is RESERVED atomically at OrderStatus placed (the overselling guard ADM-CAT-03 promised), DECREMENTED on commit at OrderStatus confirmed (prepay: PaymentStatus paid via ADM-PAY-03; COD: direct placed->confirmed via ADM-ORD-03), and RESTOCKED when an order reaches a non-success terminal (cancelled / payment_rejected / delivery_failed). The customer out-of-stock surfacing (CUS-PRODUCT-05, CUS-CART-06) and admin low-stock alerts (ADM-CAT-07) are wired to the live reservation-aware availableQty. This closes the high-severity stock-lifecycle gap, the per-size price/stock inconsistency, and the abandoned-order stock-leak gap.

#### GROOM-STOCK-01 — Per-size stock & price variant model on Product  `🔴 MUST`
**As** admin (เฮียอู้ฟู่, Role admin) and every surface that reads the catalog, **I want** every Product to carry its inventory and price PER SIZE — one ProductVariant per size, or a single 'default' variant when the product has no sizes — each with its own price, stockQty, reservedQty and lowStockThreshold, with availableQty derived as stockQty − reservedQty, **so that** the cart (which already keys lines by productId+size), the checkout subtotal, and the out-of-stock guard are correct for the exact size the customer buys instead of sharing one flat price/stock across all sizes.
> 🩹 *closes:* Inconsistency 'Single flat price vs per-size pricing/stock' + Gap '[high] Stock lifecycle ... data/products.ts has no stock field at all'

*Acceptance criteria:*
- Given a Product with sizes ['1 กก.','5 กก.'] (e.g. ข้าวหอมมะลิ), When it is modeled, Then it has exactly one ProductVariant per size, each carrying its own price (THB integer > 0), stockQty (integer ≥ 0), reservedQty (integer ≥ 0, default 0) and lowStockThreshold (integer ≥ 0, default 5); and availableQty is derived as max(0, stockQty − reservedQty).
- Given a Product with empty sizes [] (e.g. ไข่ไก่สด, นมจืด UHT, น้ำมันพืช), When it is modeled, Then it has a single variant keyed 'default' so the existing cartItemId `${productId}-${size ?? 'default'}` (store/cart.ts) maps 1:1 to exactly one variant.
- Given the single shop has one physical inventory, Then stockQty is shared across ShopMode delivery and pickup (it is NOT split into a per-mode pool); availabilityByMode (from ADM-CAT-03) remains an orthogonal visibility/orderability flag layered over the same variant stock, never a second stock count.
- Given variants of one product have different prices, When the catalog grid/list renders, Then the card shows a 'เริ่มต้น ฿X' (from-price) using the lowest variant price via money(); When product detail renders a selected size, Then it shows that variant's exact price, and the cart line and CUS-CART-04 subtotal compute Σ(selected-variant price × qty), not a single product-level price.
- Given CUS-SEARCH-03 sorts by price, When applied, Then it sorts by each product's from-price (lowest variant price) so a multi-size product orders deterministically by its cheapest variant.
- Edge (admin lowers on-hand below held stock): Given a variant with reservedQty = 3, When the admin saves stockQty = 2 (via ADM-CAT-03 / ADM-CAT-09), Then the save is allowed but a warning 'มีออเดอร์จองสต็อกนี้อยู่ 3 ชิ้น' is shown, availableQty is floored at 0 for customer display, and existing reservations/orders are still honored (the shop is flagged short, not silently corrupted).
- Validation: Given any variant, When the admin saves, Then price must be an integer > 0 ('ราคาต้องมากกว่า 0') and stockQty/reservedQty/lowStockThreshold must be integers ≥ 0 ('จำนวนสต็อกต้องเป็นจำนวนเต็มและไม่ติดลบ'), reusing ADM-CAT-01/02/03 validation (guards the money() NaN/negative baseline ROBUST-1).
- Migration: Given the 8 seeded products in data/products.ts that today carry one flat `price` and no stock, When the model is introduced, Then each is migrated to variant(s) preserving the real seeded prices (ข้าวหอมมะลิ 165, ไข่ไก่ 125, นมจืด 55, บะหมี่ 42, น้ำดื่ม 14, น้ำมันพืช 58, ผงซักฟอก 69, มันฝรั่ง 25) as each variant's initial price plus an admin-set initial stockQty, with no product left without at least one variant.
- a11y: the from-price 'เริ่มต้น ฿X' and the selected-variant price meet WCAG AA contrast and scale with OS dynamic type wherever they render (inherited from CUS-PRODUCT-08 / CUS-CART-08); the orange #F5821F is not used as low-contrast price/total text (A11Y-4).

*Dependencies:* ADM-CAT-01, ADM-CAT-02, ADM-CAT-03, CUS-PRODUCT-03, CUS-CART-01, CUS-CART-04

*Notes:* Resolves the long-standing open question (ADM-CAT-01/ADM-CAT-03 notes; OPEN-QUESTIONS 'Single flat price vs per-size pricing/stock') in favor of per-variant price+stock, matching the engineer default 'ราคาต่อขนาด = มี'. data/products.ts Product type gains a `variants` array (size, price, stockQty, reservedQty, lowStockThreshold) and `price` becomes a derived from-price for display only. This is the foundational data story all other GROOM-STOCK stories depend on. Open: per-mode availabilityByMode is assumed a pure visibility flag over one shared pool — confirm the shop never wants ของสด split into a separate pickup-only stock count.

#### GROOM-STOCK-02 — Reserve stock atomically at order placement (overselling guard)  `🔴 MUST`
**As** customer placing an order, and the shop that must never oversell, **I want** each order line's quantity to be atomically checked against and reserved from the exact variant's availableQty at the moment the Order is created (OrderStatus placed), with the whole placement rejected if any line cannot be satisfied, **so that** two customers racing for the last unit cannot both succeed and ADM-CAT-03's promised overselling guard actually exists.
> 🩹 *closes:* Gap '[high] Stock lifecycle (reserve)' — 'without an owning story the overselling guard ADM-CAT-03 promises cannot actually exist'

*Acceptance criteria:*
- Given a customer placing an order (CUS-CHK-04) with lines [variant, qty], When the Order transitions to OrderStatus placed, Then in ONE atomic transaction each line is validated availableQty ≥ qty and, only if ALL lines pass, reservedQty += qty for every variant; if any line fails, no reservation is made and no Order/OrderItems are persisted.
- Given the cart never holds stock (adding to cart does not reserve), When the customer reaches checkout, Then availability is (re)validated only at placement — so an item that was available when added to cart but sold out before placement is caught here rather than silently oversold.
- Concurrency: Given a variant with availableQty = 1 and two customers placing for qty 1 each at the same time, When both placements run, Then exactly one succeeds (reservedQty -> 1, availableQty -> 0) and the other is rejected; reservedQty can never drive availableQty negative.
- Per-line error surfacing: Given one or more lines exceed availableQty at placement, When placement is rejected, Then the customer sees a Thai message naming each affected line and its current max available (e.g. 'ข้าวหอมมะลิ (5 กก.) เหลือ 2 ชิ้น') with an affordance to reduce that line to the available qty or remove it, and no partial Order exists (consistent with CUS-CHK-04 'no partial Order').
- Given a line whose variant availableQty = 0 at placement, Then the line is flagged 'สินค้าหมด' and must be removed before placement can succeed (no Order may contain an unavailable line, per ADM-CAT-03).
- Idempotency: Given the place-order CTA is double-tapped (CUS-CHK-04 idempotency lock), When two requests arrive, Then stock is reserved at most once under the same single-Order guard — no double reservation.
- Failure: Given the reservation transaction fails mid-flight (network/server), Then no reservation persists, OrderStatus does not advance to placed, and the retryable error 'สั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้ง' is shown with the cart preserved.
- Observability: Given any successful reservation, Then a stock-movement record (variant, +reserved qty, orderId, reason 'reserve@placed', timestamp) is written for later reconciliation.
- a11y: the per-line out-of-stock / reduce-to-available message is conveyed as text (not color alone), meets WCAG AA contrast, scales with dynamic type, and the 'ลดจำนวน' / 'นำออก' controls are ≥44pt (inherited CUS-CART-08).

*Dependencies:* GROOM-STOCK-01, CUS-CHK-04, ADM-CAT-03, CUS-CART-06

*Notes:* Resolves the open question 'does the cart reserve stock on add or only validate at checkout?' (CUS-CART-06 notes, OPEN-QUESTIONS CUS-CART) in favor of reserve-at-placed only — the cart validates but never holds. The atomic check-and-reserve is the actual mechanism behind ADM-CAT-03's 'overselling is prevented; stock cannot go negative' AC, which ADM-CAT-03 explicitly deferred. Implementation on Supabase (ADR-0001) needs a row-level lock or atomic conditional decrement; concurrency control is the core engineering risk.

#### GROOM-STOCK-03 — Commit (decrement) reserved stock at confirmation / payment  `🔴 MUST`
**As** shop / inventory system, **I want** a placed order's reservation to convert into a real on-hand stockQty decrement when the order becomes confirmed — for prepay when PaymentStatus -> paid, for COD on the direct placed -> confirmed transition, **so that** physical on-hand stockQty reflects goods committed to fulfilment exactly once, and 'decrement on paid' is wired to the canonical lifecycle for both PaymentMethod promptpay_slip and cod.
> 🩹 *closes:* Gap '[high] ... NO story decrements stock when an order is placed/paid' + 'Commitment timing ... no story owns the mechanic in either direction'

*Acceptance criteria:*
- Prepay commit: Given an order with PaymentMethod promptpay_slip holding a reservation (from placed), When an admin approves the slip (ADM-PAY-03: PaymentStatus verifying -> paid, OrderStatus payment_verifying -> confirmed), Then for each line, in one atomic step, reservedQty −= qty AND stockQty −= qty (availableQty unchanged, on-hand drops) and the reservation is marked committed.
- COD commit: Given a delivery order with PaymentMethod cod (per ADR-0002 it skips awaiting_payment), When OrderStatus transitions placed -> confirmed (ADM-ORD-03), Then the same atomic reservedQty −= qty / stockQty −= qty commit runs at confirmed — even though COD cash is collected (PaymentStatus -> paid) later at delivered.
- Pickup branch: Given a pickup order (always prepay), When PaymentStatus -> paid / OrderStatus -> confirmed (ADM-ORD-03 pickup gate requires paid), Then commit runs identically to the prepay-delivery branch.
- Single commit only: Given an order already committed at confirmed, When any later forward transition occurs (preparing, ready_for_pickup, assigned_to_rider, out_for_delivery, delivered, picked_up), Then no further decrement happens — stock is committed exactly once.
- Idempotency/atomicity: Given the approve/confirm call is retried (ADM-PAY-03 and ADM-ORD-03 are idempotent), Then the commit applies at most once — re-confirming never double-decrements stockQty, and PaymentStatus/OrderStatus/stock stay mutually consistent.
- Guard against negative on-hand: Given a variant whose stockQty was lowered by admin below the committed qty (GROOM-STOCK-01 edge), When commit runs, Then stockQty floors at 0, the discrepancy is flagged to admin ('สต็อกจริงไม่พอสำหรับออเดอร์ที่ยืนยันแล้ว'), and the order is NOT blocked (the reservation was already valid) — the shortage is surfaced for manual resolution.
- Observability: Given any commit, Then a stock-movement record (variant, −stock qty, −reserved qty, orderId, reason 'commit@confirmed', timestamp) is written and ties to the ADM-PAY-03 / ADM-ORD-03 audit entry.

*Dependencies:* GROOM-STOCK-02, ADM-PAY-03, ADM-ORD-03

*Notes:* Resolves the deferred commitment-timing question (ADM-CAT-03 notes; OPEN-QUESTIONS ADM-CATALOG) now that ADR-0002 is Accepted: commit at OrderStatus=confirmed for BOTH branches — for prepay this coincides with PaymentStatus=paid (ADM-PAY-03), for COD confirmed is reached directly (ADM-ORD-03). Choosing confirmed (not delivered) as the COD commit point keeps the on-hand count correct through preparing/out_for_delivery; goods that come back are handled by GROOM-STOCK-04 restock. Open: confirm COD physical-decrement milestone is confirmed vs deferred to delivered.

#### GROOM-STOCK-04 — Release / restock stock on cancellation, payment_rejected, delivery_failed  `🔴 MUST`
**As** shop / inventory system, **I want** stock held or committed by an order to be returned to availableQty when the order reaches a non-success terminal — released (reservation undone) if not yet committed, or restocked (on-hand returned) if already committed, **so that** cancelled, payment_rejected and delivery_failed orders never permanently swallow inventory and goods physically returned to the shop become sellable again.
> 🩹 *closes:* Gap '[high] ... NO story restores stock when an order is cancelled (ADM-ORD-06), payment_rejected (ADM-PAY-04) or delivery_failed (RID-DLV-05)'

*Acceptance criteria:*
- Pre-commit release (reservation undone, on-hand untouched): Given an order still holding a reservation and NOT yet committed (OrderStatus ∈ {placed, awaiting_payment, slip_uploaded, payment_verifying}), When it becomes cancelled (ADM-ORD-06 or customer CUS-ORDERS-04) or payment_rejected (ADM-PAY-04), Then for each line reservedQty −= qty (availableQty rises) and stockQty is NOT changed (units never left the shelf).
- Post-commit restock (on-hand returned): Given an order already committed (OrderStatus ∈ {confirmed, preparing, assigned_to_rider, out_for_delivery, ready_for_pickup}), When it becomes cancelled (ADM-ORD-06) or delivery_failed (RID-DLV-05), Then for each line stockQty += qty (goods returned to sellable on-hand) and reservedQty is unchanged (already 0 since commit).
- delivery_failed specifics: Given a delivery order at out_for_delivery (committed) that the rider marks delivery_failed (RID-DLV-05), Then each line's stockQty += qty so returned goods are immediately sellable, whether the order was prepay (paid) or cod (not yet paid).
- payment_rejected + recovery interaction: Given an order at payment_verifying that is rejected (ADM-PAY-04 -> payment_rejected), Then its reservation is released; When the customer recovers by re-uploading a slip (CUS-ORDERS-06 / CUS-CHK-07, returning toward awaiting_payment), Then the reservation is RE-ACQUIRED by re-running the GROOM-STOCK-02 atomic guard, and if the variant is no longer available the recovery is blocked with 'สินค้าหมดแล้ว' and the customer must reduce qty or cancel.
- No double release: Given an order already in a terminal state (cancelled, payment_rejected, delivery_failed, delivered, picked_up), When a release/restock is retried, Then it is idempotent — stock is released/restocked at most once per order line (no inflation of stockQty).
- Success terminals never restock: Given an order reaching delivered or picked_up, Then no release or restock occurs (goods were correctly handed over).
- Observability: Given any release or restock, Then a stock-movement record (variant, qty, orderId, reason ∈ {'release@cancel','release@payment_rejected','restock@cancel','restock@delivery_failed'}, timestamp) is written, enabling unit-level reconciliation.

*Dependencies:* GROOM-STOCK-02, GROOM-STOCK-03, ADM-ORD-06, ADM-PAY-04, RID-DLV-05, CUS-ORDERS-04, CUS-ORDERS-06

*Notes:* The pre-commit-release vs post-commit-restock split keeps both numbers physically correct: a reservation that never committed just frees the hold (units never left the shelf), while a committed order that fails returns real units to on-hand. Per the task, payment_rejected releases the reservation; the recovery loop (CUS-ORDERS-06) re-runs the GROOM-STOCK-02 guard, which surfaces the genuine edge case that stock can be gone by re-upload time. Open: whether payment_rejected should instead HOLD the reservation for a short grace window during normal re-upload (avoids losing the spot) — flagged for stakeholders.

#### GROOM-STOCK-05 — Wire customer out-of-stock & admin low-stock alerts to live availableQty  `🔴 MUST`
**As** customer (P2 ป้าสมศรี, pickup) and admin (เฮียอู้ฟู่, Role admin), **I want** the customer out-of-stock/low-stock UI and the admin low-stock list and alerts to read the real reservation-aware availableQty per variant rather than a placeholder or raw on-hand number, **so that** ป้าสมศรี is never offered an item that is actually reserved away, and the admin is warned in time to restock.
> 🩹 *closes:* Gap '[high] ... stock managed by admin, surfaced to customer, but never actually decremented' — wires CUS-PRODUCT-05/CUS-CART-06/ADM-CAT-07 to the live availableQty field

*Acceptance criteria:*
- Customer PDP out-of-stock (CUS-PRODUCT-05): Given a variant with availableQty = 0, When product detail renders that size, Then a 'สินค้าหมด' badge shows, 'เพิ่มลงตะกร้า' is disabled with accessibilityState disabled, and the quantity stepper is disabled — driven by availableQty (stockQty − reservedQty), not raw stockQty.
- Customer PDP low-stock (CUS-PRODUCT-05): Given a variant with 0 < availableQty ≤ lowStockThreshold, Then a 'เหลือ X ชิ้น' hint shows where X = availableQty, and the stepper max = availableQty minus any quantity of that same variant already in the cart, so PDP plus cart together can never exceed availableQty.
- Cart (CUS-CART-06): Given a cart line whose variant availableQty drops to 0 before checkout, Then the line is marked 'สินค้าหมด', excluded from subtotal/total, its stepper disabled, and checkout is blocked until it is removed; Given availableQty = N > 0, Then the line stepper caps at N with hint 'มีสินค้าเท่านี้'.
- Admin low-stock list (ADM-CAT-07): Given the catalog, When the admin opens the 'สต็อกต่ำ/หมด' list, Then it lists variants where availableQty ≤ lowStockThreshold (including 0), per size, sorted lowest availableQty first, showing availableQty alongside on-hand stockQty and reservedQty so the admin can act; Given no variant is at/under threshold, Then the empty state 'สต็อกครบทุกรายการ' is shown.
- Low-stock notification: Given a variant crossing from availableQty > lowStockThreshold to ≤ lowStockThreshold (via reserve@placed or commit@confirmed, GROOM-STOCK-02/03), Then one admin Notification 'สต็อกใกล้หมด: <ชื่อสินค้า> (<ขนาด>) เหลือ N' is created (N = availableQty), de-duplicated so it does not re-fire while the variant stays low.
- Out-of-stock notification: Given a variant reaching availableQty = 0, Then a distinct admin Notification 'สินค้าหมด: <ชื่อสินค้า> (<ขนาด>)' is created and the variant is treated as out-of-stock per ADM-CAT-03 across all customer surfaces.
- Recovery from low: Given a low/out variant whose availableQty rises back above lowStockThreshold (admin restock GROOM-STOCK-01 or release/restock GROOM-STOCK-04), Then it leaves the low-stock list and the de-dupe resets so a future dip re-alerts.
- a11y (ป้าสมศรี): every 'สินค้าหมด' / 'เหลือ X ชิ้น' state is conveyed by text (not color alone), meets WCAG AA contrast, scales with dynamic type, and the disabled add button exposes accessibilityState disabled plus accessibilityLabel 'สินค้าหมด' so a low-vision pickup customer is never misled into a dead tap (ADM-CAT-03 a11y).

*Dependencies:* GROOM-STOCK-01, GROOM-STOCK-02, CUS-PRODUCT-05, CUS-CART-06, ADM-CAT-07

*Notes:* CUS-PRODUCT-05, CUS-CART-06 and ADM-CAT-07 all already describe the UI but explicitly note 'data/products.ts has NO stock field' — this story connects them to the real availableQty so the surfacing is reservation-aware (an item fully reserved by pending orders correctly shows 'สินค้าหมด' even if on-hand stockQty > 0). Low-stock alert is based on availableQty (customer-facing) while the list still exposes on-hand stockQty for replenishment. Open: confirm the alert should trigger on availableQty crossing vs on-hand stockQty, and the default per-variant lowStockThreshold (5).

#### GROOM-STOCK-06 — Release reserved stock on awaiting_payment expiry / abandoned order  `🟠 SHOULD`
**As** shop / inventory system, **I want** a prepay order that sits unpaid in awaiting_payment past a configurable timeout to auto-cancel and release its reservation, **so that** stock reserved at placed is not held forever by an abandoned cart and the units become sellable again.
> 🩹 *closes:* Gap '[medium] awaiting_payment expiry / abandoned-order cleanup ... If stock is ever reserved at placed, abandoned carts permanently hold inventory'

*Acceptance criteria:*
- Given a prepay order (PaymentMethod promptpay_slip) at OrderStatus awaiting_payment whose reservation has been held longer than the configured reservation TTL (e.g. 30 minutes — exact value TBD), When the TTL elapses, Then OrderStatus -> cancelled (reason 'หมดเวลาชำระเงิน'), PaymentStatus stays unpaid, and the reservation is released via GROOM-STOCK-04 (reservedQty −= qty, stockQty untouched).
- Given the customer uploads a slip that is approved before the TTL, Then no auto-cancel occurs and the order proceeds normally (commit at confirmed, GROOM-STOCK-03).
- Given an order at slip_uploaded or payment_verifying (a slip is in the admin queue), When the TTL would otherwise fire, Then auto-cancel does NOT fire while a slip is pending review — the timeout pauses so the shop never cancels an order it is actively verifying.
- COD exempt: Given a delivery order with PaymentMethod cod (no awaiting_payment state), Then this expiry never applies (it has no unpaid hold to expire).
- Customer notice: Given an order auto-cancelled by expiry, When the customer opens it, Then they see 'คำสั่งซื้อหมดเวลาชำระเงินและถูกยกเลิก', can reorder (CUS-ORDERS-05), and a Notification is sent (CUS-ORDERS-03).
- Idempotency: Given the expiry job runs repeatedly, Then a given order is cancelled and its reservation released at most once (no double release / no stockQty inflation).
- a11y: the expiry/cancellation copy is plain Thai, dynamic-type friendly, WCAG AA contrast, and not conveyed by color alone (inherited CUS-ORDERS-02).

*Dependencies:* GROOM-STOCK-02, GROOM-STOCK-04, CUS-CHK-04, CUS-CHK-06

*Notes:* Answers the open question 'Does awaiting_payment expire (stock reserved for N minutes, auto-cancel on timeout)?' (CUS-CHK notes; OPEN-QUESTIONS CUS-CHECKOUT) — required because GROOM-STOCK-02 reserves at placed, so without expiry an abandoned prepay cart holds inventory forever. SHOULD (not MUST) because a manual admin cancel (ADM-ORD-06) is an acceptable interim release until the timeout job ships. Open: exact TTL value and whether a fresh PromptPay QR is reissued on re-attempt.


## GROOM-FULFILL — Order Recovery & Fulfillment Edges
> Make the อู้ฟู่ v1 delivery fulfillment edges buildable and internally consistent without inventing any new canonical enum value. Give every assigned_to_rider order an explicit accept/decline/timeout sub-state on the Delivery record that reconciles admin push-assign (ADM-ORD-04) with rider self-accept (RID-QUEUE-02); give every delivery_failed order an admin recovery path (re-dispatch / reschedule / cancel-as-undeliverable) that always reaches a true terminal; close the refund loop (owed -> sent -> confirmed) for paid prepay orders that end undeliverable while correctly skipping refunds for never-collected COD; and expose assigned-rider identity plus proof-of-delivery to the customer and admin. OrderStatus stays canonical (placed|awaiting_payment|slip_uploaded|payment_verifying|confirmed|preparing|assigned_to_rider|out_for_delivery|delivered|ready_for_pickup|picked_up|cancelled|payment_rejected|delivery_failed); acceptance is a Delivery sub-state, not an OrderStatus value.

#### GROOM-FULFILL-01 — Unify the rider-assignment model: one Delivery assignment with an acceptance sub-state (reconcile push-assign + self-accept)  `🔴 MUST`
**As** requirements/platform owner serving admin (P3) and rider (P4), **I want** a single canonical Delivery assignment record carrying an acceptance sub-state (pending_acceptance | accepted | declined | expired) that both admin push-assign (ADM-ORD-04) and rider self-accept (RID-QUEUE-02) write to, while OrderStatus stays assigned_to_rider, **so that** a pushed order and a self-accepted order behave consistently and a rider must actively commit before the run can start.
> 🩹 *closes:* Rider assignment accept/decline/timeout has no substate today, and ADM-ORD-04 push-assign vs RID-QUEUE-02 self-accept are unreconciled (two paths to assigned_to_rider with no shared acceptance model).

*Acceptance criteria:*
- Given a delivery order at OrderStatus=preparing, When admin push-assigns a rider (ADM-ORD-04), Then OrderStatus becomes assigned_to_rider AND the linked Delivery records assignmentState=pending_acceptance with riderId, assignedAt and assignedBy=admin (not yet committed by the rider).
- Given a ShopMode=delivery order at OrderStatus=preparing in the available pool, When the rider self-accepts via RID-QUEUE-02 ('รับงาน'), Then OrderStatus becomes assigned_to_rider AND the Delivery records assignmentState=accepted with riderId, acceptedAt and source=self_accept (commitment is implicit because the rider chose it).
- Given OrderStatus=assigned_to_rider, Then exactly one active Delivery assignment exists for the order and its assignmentState is in {pending_acceptance, accepted}; the values declined and expired are recorded only on superseded/historical assignment records and are never an OrderStatus value.
- Given a Delivery with assignmentState != accepted, When the rider attempts to start the run (RID-DLV-03 'ออกส่งแล้ว'), Then the transition assigned_to_rider -> out_for_delivery is blocked with 'ต้องกดรับงานก่อนจึงจะออกส่งได้'; only assignmentState=accepted may advance to out_for_delivery.
- Given the canonical OrderStatus enum has NO 'rider_accepted' value, Then acceptance is modeled solely as Delivery.assignmentState and OrderStatus remains assigned_to_rider throughout accept/decline/timeout, so no new OrderStatus value is introduced.
- Given any change of assignmentState (assigned -> accepted/declined/expired -> reassigned), Then each event is timestamped and retained on the Delivery/assignment history (who assigned, who accepted/declined, when, and the reason where applicable).
- Edge: Given a rider self-accepts (RID-QUEUE-02) an order that an admin push-assigned to a different rider moments earlier, When the second write arrives, Then first-writer-wins is enforced server-side, the loser sees 'งานนี้ถูกรับ/มอบหมายไปแล้ว', and no double assignment occurs.

*Dependencies:* ADM-ORD-03, ADM-ORD-04, RID-QUEUE-01, RID-QUEUE-02, RID-DLV-03

*Notes:* Introduces a NEW Delivery.assignmentState field (pending_acceptance|accepted|declined|expired) as an order-orthogonal sub-state — this is NOT a canonical OrderStatus value and must not be added to OrderStatus. It is the single reconciliation point for the two coexisting assignment paths (push vs pull) so the RID-DLV-03 dispatch gate is unambiguous. Whether the self-assign pull pool (RID-QUEUE-02 'งานที่ว่าง') ships in v1 or assignment is push-only is an open question (RID-QUEUE-01); if push-only, every assignment starts pending_acceptance.

#### GROOM-FULFILL-02 — Rider accepts or declines a pushed assignment  `🔴 MUST`
**As** rider (P4), **I want** when the shop pushes a delivery order to me, to be notified and explicitly accept or decline it within a time window, **so that** I only commit to jobs I can actually take and the shop quickly learns if it must reassign.
> 🩹 *closes:* A pushed assignment can otherwise stall with no rider commitment — there is no rider accept/decline action between assigned_to_rider and out_for_delivery.

*Acceptance criteria:*
- Given an order assigned to me with Delivery.assignmentState=pending_acceptance (admin push, ADM-ORD-04), When the assignment is created, Then I receive a push/in-app notification 'คุณได้รับงานส่ง #A1B2 — รับหรือปฏิเสธ' and the job appears in 'งานของฉัน' (RID-QUEUE-01) flagged 'รอกดรับงาน' with a visible countdown to the acceptance deadline.
- Given a pending_acceptance job, When I tap 'รับงาน' and confirm, Then Delivery.assignmentState becomes accepted, the countdown stops, OrderStatus stays assigned_to_rider, and 'ออกส่งแล้ว' (RID-DLV-03) becomes available.
- Given a pending_acceptance job, When I tap 'ปฏิเสธงาน', pick a reason ('ติดงานอื่น' / 'ไกลเกินไป' / 'รถมีปัญหา' / 'อื่นๆ' with required free-text for อื่นๆ) and confirm, Then Delivery.assignmentState becomes declined, the order is released back to OrderStatus=preparing (unassigned, re-enters the assignable pool / available list), and admin is notified to reassign (GROOM-FULFILL-03).
- Given I declined or the order was reassigned away from me, When I return to 'งานของฉัน', Then the job is removed from my list and I cannot start its run.
- Edge (concurrency): Given admin reassigns or cancels the order while my accept/decline dialog is open, When I confirm, Then my stale action is rejected with 'งานนี้เปลี่ยนสถานะแล้ว' and my queue refreshes to the authoritative state (no double assignment, no orphaned accept).
- Edge (offline): Given I am offline (RID-QUEUE-04), When I tap 'รับงาน'/'ปฏิเสธงาน', Then no state changes, I see a retry-able error, the button returns to idle (not a stuck spinner), and the acceptance countdown continues server-side.
- a11y (ป้าสมศรี-grade rider): 'รับงาน' and 'ปฏิเสธงาน' are >=44x44pt with Thai accessibilityLabels, the countdown/deadline is announced as text (not color/motion alone), reason rows are >=44pt single-tap targets at WCAG AA contrast, and the chosen decline reason is conveyed by text not color.

*Dependencies:* GROOM-FULFILL-01, ADM-ORD-04, RID-QUEUE-01, RID-QUEUE-02, RID-DLV-03, CUS-ORDERS-03

*Notes:* Self-accepted jobs (RID-QUEUE-02) skip this step (already assignmentState=accepted). On decline the order returns to OrderStatus=preparing — a backward edge that must be explicitly allowed in the state machine and is consistent with RID-QUEUE-01 listing preparing orders as available. The rider decline-reason enum is an open question. The acceptance-window duration is a config value shared with the timeout (GROOM-FULFILL-03).

#### GROOM-FULFILL-03 — Acceptance timeout / unreachable rider auto-releases and flags admin to reassign  `🔴 MUST`
**As** admin (P3), **I want** a pushed assignment the rider never accepts (or who goes offline/unreachable) to auto-release after a configurable window and surface for reassignment, **so that** an order never stalls indefinitely with an uncommitted or unreachable rider.
> 🩹 *closes:* RID-AUTH-04 flags a reassignment threshold but no story owns the release/reassign flow for a never-accepted or unreachable assignment.

*Acceptance criteria:*
- Given Delivery.assignmentState=pending_acceptance, When the acceptance window elapses with no accept/decline, Then assignmentState becomes expired, the order returns to OrderStatus=preparing (unassigned), and admin receives a 'ไรเดอร์ไม่ตอบรับงาน #A1B2' notification with a one-tap reassign entry.
- Given a rider holding an assignment (pending_acceptance or accepted, not yet out_for_delivery) goes offline or loses connectivity beyond the configured threshold (RID-AUTH-04), When the threshold passes, Then admin is flagged that the assignment is at risk and may reassign; reassigning releases the stale assignment (assignmentState=expired) and assigns a new rider (back to assigned_to_rider, pending_acceptance for the new rider).
- Given admin reassigns from the flagged/expired state, Then the prior rider is unassigned and notified 'งาน #A1B2 ถูกมอบหมายใหม่', the assignment history records both events, and no double assignment exists (reconciles the ADM-ORD-04 reassign criterion).
- Given no rider is available when an assignment expires, Then the order rests at OrderStatus=preparing in the assignable pool / 'ไม่มีไรเดอร์ว่าง' empty state (per ADM-ORD-04) and is neither lost nor auto-cancelled.
- Edge: Given the rider taps 'รับงาน' at the same instant the window expires, Then exactly one outcome commits server-side (accept wins only if it arrives before expiry); the loser is shown the authoritative state and no order is both accepted and expired.
- Edge: Given repeated expiry/decline cycles on the same order, Then each cycle is recorded and admin sees an attempt/assignment count so a chronically unassignable order can be escalated (links to GROOM-FULFILL-04).
- a11y: the admin reassign alert conveys urgency by text+icon (not color alone), meets WCAG AA contrast, and the reassign control is a labelled >=44pt target.

*Dependencies:* GROOM-FULFILL-01, GROOM-FULFILL-02, ADM-ORD-04, RID-AUTH-04, RID-AUTH-05, CUS-ORDERS-03

*Notes:* Unifies the RID-AUTH-04 'offline beyond threshold' flag and the acceptance-window timeout into one auto-release-and-reassign mechanic. The acceptance window and the offline/unreachable threshold values (and whether they are one shared config or two) are open questions. Auto-release returns the order to preparing, NOT to delivery_failed — delivery_failed is reserved for a started run that fails (RID-DLV-05).

#### GROOM-FULFILL-04 — Admin recovers a delivery_failed order: re-dispatch, reschedule, or cancel-as-undeliverable (true terminal)  `🔴 MUST`
**As** admin (P3), **I want** from a delivery_failed order, to re-dispatch a rider now, schedule a later re-attempt, or close it as undeliverable, **so that** a failed delivery always reaches a real resolution instead of becoming an orphaned dead-end.
> 🩹 *closes:* delivery_failed has no reacting admin surface and no true terminal — re-dispatch / reschedule / cancel+refund were undefined and the order became an orphaned terminal.

*Acceptance criteria:*
- Given an order at OrderStatus=delivery_failed (set by RID-DLV-05), When admin opens it, Then the recorded failure reason, attempt count, any rider failure photo, and three recovery actions are shown: 'จัดส่งใหม่ทันที' (re-dispatch), 'นัดส่งใหม่ภายหลัง' (reschedule), and 'ยกเลิก/ปิดงาน' (cancel as undeliverable).
- Given admin taps 'จัดส่งใหม่ทันที', Then OrderStatus transitions delivery_failed -> assigned_to_rider via a fresh assignment (Delivery.assignmentState=pending_acceptance for the chosen rider) or -> preparing if released to the pool, the attempt count increments, and the customer is notified 'กำลังจัดส่งใหม่' (CUS-ORDERS-03).
- Given admin taps 'นัดส่งใหม่ภายหลัง' and sets a target window, Then the order is marked for a scheduled re-attempt (remains delivery_failed with a nextAttemptAt) and at that time becomes re-dispatchable (-> assigned_to_rider/preparing), and the customer is notified of the new plan.
- Given admin taps 'ยกเลิก/ปิดงาน', Then OrderStatus transitions delivery_failed -> cancelled (the true terminal) with a required reason; if PaymentStatus=paid (PaymentMethod=promptpay_slip) a refund is initiated (GROOM-FULFILL-05); if the order is COD and was never collected, copy makes clear no money was captured and no refund is owed.
- Given a configured max-attempts cap is reached, When admin opens the delivery_failed order, Then 'จัดส่งใหม่ทันที' and 'นัดส่งใหม่ภายหลัง' are disabled with 'ครบจำนวนครั้งที่ส่งได้' and only 'ยกเลิก/ปิดงาน' (cancel+refund) or 'ติดต่อลูกค้า' remain.
- Edge (concurrency): Given two admins act on the same delivery_failed order, When one re-dispatches and the other cancels, Then optimistic concurrency lets exactly one commit and the other sees 'ออเดอร์นี้เปลี่ยนสถานะแล้ว' (reuses the ADM-ORD-03 concurrency rule).
- Edge (error): Given any recovery transition fails (network/server), Then OrderStatus and the Delivery/refund records are unchanged, an error with Retry is shown, and no partial state persists.
- a11y: the three recovery actions are >=44pt labelled controls at WCAG AA contrast, the destructive 'ยกเลิก/ปิดงาน' is distinguished by text not color alone, and the failure reason/attempt count render as scalable text.

*Dependencies:* ADM-ORD-03, ADM-ORD-04, ADM-ORD-06, RID-DLV-05, GROOM-FULFILL-01, GROOM-FULFILL-05, CUS-ORDERS-03

*Notes:* Resolves the canonical contradiction that delivery_failed is listed as terminal yet ADM-ORD-04 already allows a re-attempt: in v1 delivery_failed is a 'needs admin decision' branch whose true terminals are delivered (successful re-attempt) or cancelled (closed+refunded). Adds the delivery_failed -> assigned_to_rider/preparing and delivery_failed -> cancelled edges to the state machine. The max-attempts cap, whether 'reschedule' ships in v1 or is deferred, and the undeliverable cancel-reason enum value are open questions. The COD-vs-prepay refund branch follows ADR-0002.

#### GROOM-FULFILL-05 — Execute and track a manual refund with customer-visible status for a paid order closed undeliverable/cancelled  `🔴 MUST`
**As** admin (P3) executing refunds and the customer (P1) awaiting their money back, **I want** when a paid order is closed as cancelled (from delivery_failed or another cancel), to record a manual PromptPay refund through owed -> sent -> confirmed and show that status to the customer, **so that** refunds for prepaid orders actually close out and the customer can see their money is coming.
> 🩹 *closes:* Refund path never closes — ADM-ORD-06 records 'refund owed' but nothing executes it, confirms it, or shows it to the customer.

*Acceptance criteria:*
- Given an order reaches OrderStatus=cancelled with PaymentStatus=paid and PaymentMethod=promptpay_slip, When the cancel commits, Then a Refund record is created with status 'owed' carrying the amount and the linked cancel/failure reason (extends the ADM-ORD-06 refund note into a tracked lifecycle).
- Given a refund is 'owed', When admin performs the manual PromptPay transfer and marks it 'sent' (attaching a transfer ref/slip and timestamp), Then the refund status becomes sent and the customer is notified 'กำลังคืนเงินให้คุณ'.
- Given a refund is 'sent', When the customer confirms receipt or admin confirms completion, Then the refund status becomes confirmed and the order's money state is closed; if the transfer bounces, admin can mark it 'failed' and retry, never silently dropping it.
- Given the customer opens the order detail (CUS-ORDERS-02), Then a refund section shows the current refund status in plain Thai (รอคืนเงิน / กำลังคืนเงิน / คืนเงินแล้ว), the amount via money(), and the expected timeframe — the customer is never left guessing.
- Given a COD order that was never collected (PaymentStatus not paid) is cancelled, Then NO Refund record is created and the customer detail states that no payment was taken (no false 'refund owed').
- Edge: Given the same cancel is processed twice (retry), Then at most one Refund record exists per order (idempotent) and no duplicate refund is owed.
- Edge (error): Given marking sent/confirmed fails, Then the prior refund status is retained, an error with Retry is shown, and an audit entry (actor, before/after status, amount, ref) is written for every refund transition.
- a11y (ป้าสมศรี): the customer refund status renders at body-large with dynamic type, WCAG AA contrast, conveys state by text+icon (not color alone), and any action (e.g. 'ยืนยันได้รับเงินคืน') is a >=44pt labelled control.

*Dependencies:* ADM-ORD-06, ADM-PAY-06, GROOM-FULFILL-04, CUS-ORDERS-02, CUS-ORDERS-03

*Notes:* v1 has no payment gateway (ADR-0002), so refunds are manual PromptPay; this story defines the refund lifecycle (owed -> sent -> confirmed, plus failed) and a new Refund record/entity. Scoped here to the fulfillment-recovery path (a paid prepay order ending delivery_failed/cancelled) but the same lifecycle should also serve payment_rejected and self-cancel (CUS-ORDERS-04). Refund SLA, whether the customer self-confirms receipt, and required transfer proof are open questions for finance/legal.

#### GROOM-FULFILL-06 — Customer sees a delivery_failed outcome and what happens next  `🟠 SHOULD`
**As** customer on a delivery order (P1 น้องแนน), **I want** when my delivery fails, a clear in-app explanation and the next step (re-attempt, rescheduled, or refund), **so that** I am not left with a stuck order and I know what the shop is doing about it.
> 🩹 *closes:* delivery_failed has no customer-facing 'what happens next' surface — CUS-ORDERS only shows status, leaving the customer with a stuck order.

*Acceptance criteria:*
- Given my delivery order is at OrderStatus=delivery_failed, When I open its detail (CUS-ORDERS-02), Then the timeline marks where it stopped with plain-Thai copy 'จัดส่งไม่สำเร็จ', a customer-appropriate reason (internal rider reason codes are not exposed verbatim), and a 'ติดต่อร้าน' CTA.
- Given admin has chosen a recovery (GROOM-FULFILL-04), When I view the order, Then the outcome is reflected: re-dispatch shows 'กำลังจัดส่งใหม่' and returns the timeline to assigned_to_rider/out_for_delivery; reschedule shows the planned re-attempt window; cancel shows 'ออเดอร์ถูกยกเลิก' plus refund status (GROOM-FULFILL-05) when prepaid.
- Given a customer-relevant transition (delivery_failed, re-dispatch, cancelled) occurs, Then I receive exactly one push per transition (reuses the CUS-ORDERS-03 curated set) deep-linking to the order detail.
- Given the order is delivery_failed and not yet resolved by admin, When I view it, Then later steps are not shown as 'pending/normal'; the state is clearly an exception awaiting the shop, not a silent stall.
- Given a COD order (PaymentMethod=cod) that failed and is then cancelled, When I view it, Then copy confirms no payment was taken (no refund), distinct from a prepaid cancel that shows refund status.
- a11y (ป้าสมศรี): the failure explanation and CTA render at body-large with dynamic type without truncation, meet WCAG AA contrast, convey the exception by text+icon (not color alone), and 'ติดต่อร้าน' is a >=44pt labelled control.

*Dependencies:* CUS-ORDERS-02, CUS-ORDERS-03, CUS-ORDERS-04, RID-DLV-05, GROOM-FULFILL-04, GROOM-FULFILL-05

*Notes:* Extends the CUS-ORDERS-02 timeline rather than creating a new screen (CUS-ORDERS-02 already promises a terminal/branch explanation for delivery_failed; this adds the recovery-outcome reflection). Customer-facing failure wording must be kind/plain Thai (mirrors the ADM-PAY-04 rule), never internal codes. Which RID-DLV-05 rider failure reasons are safe to show the customer verbatim is an open question.

#### GROOM-FULFILL-07 — Expose assigned-rider identity and proof-of-delivery to customer and admin  `🟠 SHOULD`
**As** customer awaiting a delivery (P1) and admin handling questions/disputes (P3), **I want** to see who is delivering my order (name, photo, vehicle, plate, masked contact) while it is on the way, and the proof-of-delivery photo once it is delivered, **so that** I can recognise the rider at my door and there is visible evidence the order arrived.
> 🩹 *closes:* Proof-of-delivery photo and assigned-rider identity are never exposed to customer/admin — CUS-ORDERS-02 shows status only and RID-AUTH-06/RID-DLV-04 data is captured but unsurfaced.

*Acceptance criteria:*
- Given a delivery order with an accepted assignment (GROOM-FULFILL-01) at OrderStatus=out_for_delivery, When the customer opens the order detail (CUS-ORDERS-02), Then the assigned rider's display name, profile photo, vehicle type and licence plate (from RID-AUTH-06) are shown, plus a masked/proxy 'โทรหาไรเดอร์' action consistent with the rider->customer PDPA masking (RID-DLV-02).
- Given OrderStatus is before out_for_delivery (e.g. assigned_to_rider with assignmentState=pending_acceptance) or the assignment was reassigned, Then rider identity is NOT shown, or it updates to the new rider, so the customer never sees a rider who is not actually bringing the order.
- Given OrderStatus=delivered with a captured proof-of-delivery photo (RID-DLV-04), When the customer opens the order, Then the POD photo, delivered timestamp, and 'ส่งสำเร็จ' confirmation are viewable read-only.
- Given a 'confirm without photo' delivery (the RID-DLV-04 camera-denied path), Then the customer and admin see the recorded no-photo reason instead of a broken/empty image.
- Given admin opens the order detail (ADM-ORD-02), Then admin sees the assigned rider identity, the POD photo (or no-photo reason) and timestamp for fulfillment verification and dispute handling, regardless of customer-facing visibility settings.
- Edge (PDPA): Given the rider's raw phone, Then it is never shown in full to the customer (proxy/relay or reveal-on-dial only), and POD photos are access-limited to the order's customer + admin with a defined retention period.
- a11y (ป้าสมศรี): rider name/vehicle/plate and the POD image render at body-large with dynamic type, the rider photo and POD image carry descriptive Thai accessibility labels (not image-only), and 'โทรหาไรเดอร์' is a >=44pt labelled control at WCAG AA contrast.

*Dependencies:* CUS-ORDERS-02, ADM-ORD-02, RID-AUTH-06, RID-DLV-02, RID-DLV-04, GROOM-FULFILL-01

*Notes:* Reuses the rider profile fields (RID-AUTH-06) and POD media (RID-DLV-04) — no new capture work. Admin POD visibility is the operationally critical slice (dispute handling); customer-facing POD photo visibility (in-app vs available-on-request) is the softer slice and may degrade to admin-only if PDPA review requires. Whether the customer also sees live rider location (map) vs identity-only, plus POD/rider-location retention and who may view, are PDPA open questions.


## GROOM-ACCOUNTS — Accounts: Rider Provisioning, Roles & Guest Merge
> Provide the missing connective tissue around accounts so the อู้ฟู่ v1 delivery and auth flows are buildable and internally consistent: (1) give the shop owner an owning surface to create/invite/edit/deactivate the Roles=rider pool that ADM-ORD-04 assigns from and that RID-AUTH-05 deactivation depends on; (2) formalize the admin owner-vs-staff permission tiers as one canonical matrix (single source of truth for UI gating AND server authorization), keeping the canonical Roles enum customer|admin|rider unchanged; and (3) define how a guest's cart and wishlist merge into the account at the CUS-ONB-08 checkout sign-in gate (dedupe rules) and what happens to that data on logout. Closes three flagged gaps: admin rider provisioning, the owner/staff tier inconsistency, and guest-to-account merge.

#### ACC-RID-01 — Owner provisions / invites a rider account (the assignment pool)  `🔴 MUST`
**As** shop owner (เฮียอู้ฟู่, Roles=admin, owner tier), **I want** view the rider roster and invite a new rider by phone number, provisioning an account with Roles=rider in a pending state, **so that** ADM-ORD-04 has a real pool of riders to assign from and a new hire can sign in via phone+OTP without self-signup.
> 🩹 *closes:* [high] Admin rider account provisioning / deactivation missing

*Acceptance criteria:*
- Given an owner-tier admin opens 'ไรเดอร์/Riders', When the roster loads, Then it lists every account with Roles=rider showing display name, masked phone (0XX-XXX-XXXX), availability (online|offline from RID-AUTH-03), account state (pending|active|deactivated), and a 'เพิ่มไรเดอร์' action; Given no riders exist, Then a friendly empty state with the same CTA is shown (never a blank list).
- Given the owner taps 'เพิ่มไรเดอร์' and enters a valid Thai mobile number (and optional display name), When they submit, Then an account is provisioned with Roles=rider in state=pending, it appears in the roster, and an audit entry (actor=owner id+tier, action=rider_invite, target=rider id) is recorded per ADM-AUTH-07.
- Given a pending rider, When that person completes phone+OTP sign-in in the rider app (RID-AUTH-01), Then the account transitions pending->active, they default to availability=offline, and only then are they eligible to appear in ADM-ORD-04's assignable list (which further filters to availability=online via RID-AUTH-03).
- Given the entered phone number already holds Roles=rider, When the owner submits, Then a duplicate error 'เบอร์นี้เป็นไรเดอร์อยู่แล้ว' is shown and no second account is created.
- Given the entered phone number already holds a different Role (customer or admin), When the owner submits, Then provisioning is blocked with a conflict message and guidance, and no rider account is created (multi-role handling is an open question).
- Given a staff-tier admin (not owner), When they open or deep-link the rider-management screen/API, Then access is denied in the UI and the server returns 403, and the denied attempt is audit-logged (per the ACC-ROLE-01 matrix).
- Given the invite request fails (offline/server), When the owner submits, Then a non-blocking error with Retry is shown and no partial or duplicate rider account is created.
- A11y (admin web): the roster table and the 'เพิ่มไรเดอร์' flow are fully keyboard-operable with a visible focus indicator, the phone field has a programmatic label with errors announced via aria-live, every account state (pending|active|deactivated) is conveyed by text+icon not color alone, contrast meets WCAG 2.1 AA, the page stays usable at 200% zoom, and all interactive targets are >=44x44px.

*Dependencies:* ADM-AUTH-03, ADM-AUTH-07, ADM-ORD-04, RID-AUTH-01, ACC-ROLE-01

*Notes:* Closes the broken reference where ADM-ORD-04 assigns 'one of the shop's own riders' but no surface creates them. Assumes admin-provisioned riders, no self-signup (RID-AUTH open question). Roles=rider used verbatim; availability online|offline is the NEW rider field from RID-AUTH-03, distinct from OrderStatus/PaymentStatus. Mirrors the ADM-AUTH-04 staff-invite pattern (pending->active on first OTP). Note that 'marked available' in ADM-ORD-04 means availability=online, not mere existence in the roster.

#### ACC-RID-02 — Admin edits a rider account's details  `🟠 SHOULD`
**As** shop owner (and, per the ACC-ROLE-01 matrix, optionally staff), **I want** correct or update a rider's display name, vehicle type and licence plate, and (with re-verification) their phone number, **so that** the roster and the rider hand-off info stay accurate when details change or were entered wrong.
> 🩹 *closes:* [high] Admin rider account provisioning / deactivation missing

*Acceptance criteria:*
- Given the rider roster, When the owner opens a rider and edits display name, vehicle type, or licence plate and saves, Then the change persists, is reflected immediately in the roster and in the rider's own profile (RID-AUTH-06), and is audit-logged (ADM-AUTH-07).
- Given the owner changes the rider's phone number (the auth identity), When they submit, Then the change requires OTP re-verification of the new number before it becomes active and the old number remains valid until the new one is verified (mirrors RID-AUTH-06 / CUS-PROFILE-02), so a rider is never silently locked out.
- Given a validation error (malformed Thai mobile number or empty required field), When the owner saves, Then an inline error is shown per field and no partial update persists.
- Given the new phone number already belongs to another account, When the owner submits, Then a conflict error is shown and the change is rejected.
- Given the save request fails (offline/server), When the owner saves, Then the prior values are kept, a non-destructive error with Retry is shown, and no data is lost.
- A11y (admin web): all fields have programmatic labels, edit controls are keyboard-operable with visible focus, errors are announced via aria-live, contrast meets WCAG 2.1 AA, the page is usable at 200% zoom, and targets are >=44x44px.

*Dependencies:* ACC-RID-01, RID-AUTH-06, RID-AUTH-01

*Notes:* Admin-side counterpart to RID-AUTH-06 (rider self-edit); covers the 'edit' verb in the gap. Whether phone is rider-editable, admin-editable, or both is an open question (RID-AUTH-06 note). Cash-handling/float/settlement fields are deliberately omitted pending the COD payment grooming (ADR-0002 accepted COD but left rider settlement to be groomed separately). Who may edit (owner-only vs staff) is resolved by the ACC-ROLE-01 matrix.

#### ACC-RID-03 — Admin deactivates / reactivates a rider account  `🔴 MUST`
**As** shop owner (เฮียอู้ฟู่), **I want** deactivate a rider who leaves (and reactivate one who returns), immediately revoking back-office access, **so that** a former rider can no longer receive jobs or see customer PII, delivering the access loss that RID-AUTH-05 promises.
> 🩹 *closes:* [high] Admin rider account provisioning / deactivation missing

*Acceptance criteria:*
- Given an active rider with no active delivery, When the owner deactivates them, Then account state becomes deactivated, they are removed from ADM-ORD-04's assignable pool, availability is forced offline, their session is invalidated on next request, and on next sync the rider app signs them out with 'บัญชีถูกระงับ กรุณาติดต่อแอดมิน' (RID-AUTH-05); the action is audit-logged.
- Given a rider currently holding an active delivery (OrderStatus=assigned_to_rider or out_for_delivery), When the owner attempts to deactivate them, Then the action is blocked with a clear warning listing the in-progress order(s), requiring those orders to be reassigned (ADM-ORD-04) or cancelled (ADM-ORD-06) first, so no delivery is orphaned.
- Given a deactivated rider, When the owner reactivates them, Then state returns to active, they default to availability=offline, and they may sign in again and re-appear in the pool once online; the reactivation is audit-logged.
- Given a deactivated rider attempts to sign in (RID-AUTH-01) or an existing session makes a request, Then access is refused/revoked with the suspended message and no rider session is created or continued.
- Given the deactivate/reactivate request fails (offline/server), When the owner confirms, Then the account state is unchanged, an error with Retry is shown, and no partial state persists.
- Given a staff-tier admin, When they attempt deactivate/reactivate via UI or direct API, Then it is denied (403) and audit-logged (ACC-ROLE-01 matrix).
- A11y (admin web): the deactivate action uses a danger affordance paired with a text label (not color alone), the confirm dialog is keyboard-operable and screen-reader-announced, account state is shown as text+icon, contrast meets WCAG 2.1 AA, the page is usable at 200% zoom, and targets are >=44x44px.

*Dependencies:* ACC-RID-01, RID-AUTH-05, RID-AUTH-04, ADM-ORD-04, ADM-ORD-06, ADM-AUTH-07

*Notes:* Closes the dangling 'if deactivated' reference in RID-AUTH-05 (which reacts to this action but no surface performed it). The active-delivery guard ties to RID-AUTH-04 safe-offline and the ADM-ORD-04 reassign path. Uses OrderStatus assigned_to_rider/out_for_delivery and availability online|offline verbatim. Soft-disable (not hard-delete) is assumed so audit history survives, mirroring ADM-AUTH-04 staff deactivation and ADM-AUTH-07 immutability; PDPA retention follows the audit-log policy.

#### ACC-ROLE-01 — Canonical admin permission matrix (owner vs staff) as single source of truth  `🔴 MUST`
**As** shop owner (เฮียอู้ฟู่), **I want** one authoritative matrix that maps every protected admin action to the tier (owner-only vs staff-allowed) required to perform it, enforced identically by the UI and the server, **so that** every admin epic gates consistently and staff can run daily operations without touching sensitive settings or accounts.
> 🩹 *closes:* Inconsistency: Roles enum (customer|admin|rider) vs owner/staff permission tiers assumed inconsistently

*Acceptance criteria:*
- Given the Roles enum is customer|admin|rider (canonical, unchanged), Then owner vs staff is modeled as a tier ATTRIBUTE on a Roles=admin account (not a new Roles value), and every admin account resolves to exactly one tier: owner or staff.
- Given the matrix, Then STAFF-allowed (operational) actions include: order queue/detail/advance/assign/pickup-status/cancel (ADM-ORD-01..06), payment-slip verification approve/reject (ADM-PAY), and catalog create/edit (ADM-CAT) — each mapped to the staff tier.
- Given the matrix, Then OWNER-ONLY actions include: staff management (ADM-AUTH-04), rider account provisioning/edit/deactivation (ACC-RID-01..03), audit-log viewing (ADM-AUTH-07), shop settings including delivery-fee/free-delivery-threshold config, refund execution, dashboard revenue/AOV visibility (ADM-DASH), and merchandising/promo authoring — each blocked for the staff tier.
- Given any protected action, Then it maps to exactly one required tier in the matrix, and that single matrix is consumed by BOTH client-side UI gating (hide/disable) AND server-side authorization (no action is permitted by hiding UI alone).
- Given a staff-tier admin invokes an owner-only action via direct API call or deep link, Then the server returns 403 and the denied attempt is audit-logged (actor id+tier, action, result=denied) per ADM-AUTH-07.
- Edge: Given the very first or only admin account, Then it is forced to owner tier so the shop is never left without an owner (mirrors ADM-AUTH-03).
- Given an owner-tier admin, Then they can reach every admin area, subject only to step-up re-auth where the matrix requires it (ADM-AUTH-06).
- A11y (admin web): owner-only controls hidden for staff are removed from the tab/focus order (not merely visually hidden), and any 'no permission' messaging meets WCAG 2.1 AA and is announced to screen readers.

*Dependencies:* ADM-AUTH-02, ADM-AUTH-03, ADM-AUTH-04, ADM-ORD-08, ADM-PAY-01, ADM-DASH-03, ADM-AUTH-07, ACC-RID-01

*Notes:* Formalizes the matrix that ADM-AUTH-03 AC4 asserts but never enumerates, and resolves the cross-epic inconsistency the critic flags (owner/staff gated inconsistently across ADM-AUTH/ADM-ORD-08/ADM-PAY/ADM-DASH/ADM-CAT). Keeps the canonical Roles enum verbatim; tier is an attribute, not a Roles value (open question to confirm vs first-class roles). The exact staff-allowed action set is a proposed default needing PO sign-off (ADM-AUTH-03 note). This is the single normative source; per-epic role ACs (ADM-ORD-08 etc.) should reference it rather than re-decide.

#### ACC-ROLE-02 — Owner changes an existing admin's tier (promote / demote) with guards  `🟠 SHOULD`
**As** shop owner (เฮียอู้ฟู่), **I want** change an existing admin account's tier between owner and staff, with a last-owner guard and a fresh identity check, **so that** I can promote a trusted staff member or step a co-owner down without ever leaving the shop ownerless.
> 🩹 *closes:* Inconsistency: Roles enum (customer|admin|rider) vs owner/staff permission tiers assumed inconsistently

*Acceptance criteria:*
- Given the staff/admin management screen (ADM-AUTH-04), When an owner changes another admin's tier staff->owner or owner->staff and confirms, Then the new tier takes effect on that account's next request, the ACC-ROLE-01 matrix re-applies immediately, and the change is audit-logged with before/after tier (ADM-AUTH-07).
- Given the change would remove the last remaining owner (demoting the only owner, or self-demotion when sole owner), When the owner confirms, Then the action is blocked with 'ต้องมีเจ้าของอย่างน้อยหนึ่งคน' (mirrors ADM-AUTH-04).
- Given a tier change is a sensitive action and the owner's last authentication is older than the step-up window, When they confirm, Then OTP step-up re-auth (ADM-AUTH-06) is required before the change commits; if step-up fails or is cancelled, the tier is unchanged.
- Given a staff-tier admin, When they attempt to change any tier, Then it is denied (403) and audit-logged (owner-only per ACC-ROLE-01).
- Given the change request fails (offline/server), When the owner confirms, Then the tier is unchanged and an error with Retry is shown.
- A11y (admin web): the tier control is keyboard-operable with visible focus and a text label, the confirm and step-up dialogs are screen-reader-announced, contrast meets WCAG 2.1 AA, the page is usable at 200% zoom, and targets are >=44x44px.

*Dependencies:* ACC-ROLE-01, ADM-AUTH-04, ADM-AUTH-06, ADM-AUTH-07

*Notes:* ADM-AUTH-04 assigns a tier only at invite time; this adds the missing mutate-tier-later path with the last-owner guard so the owner/staff model is complete and not a one-way door. Step-up re-auth reuses ADM-AUTH-06. Whether staff get granular per-permission toggles versus a fixed two-tier model is an open question (ADM-AUTH-04 note).

#### ACC-MERGE-01 — Guest cart merges into the account cart at the checkout sign-in gate  `🔴 MUST`
**As** guest shopper (P1 น้องแนน building a delivery cart; P2 ป้าสมศรี a pickup cart), **I want** the cart I built as a guest to merge into my account when I sign in at the checkout gate, with duplicate lines combined, **so that** I never lose the cart I just built when CUS-ONB-08 routes me to authenticate, and quantities stay correct.
> 🩹 *closes:* [medium] Guest cart & wishlist merge on login

*Acceptance criteria:*
- Given a guest with cart lines who hits the checkout auth gate (CUS-ONB-08) and completes sign-in (CUS-ONB-03 or CUS-ONB-05), When auth succeeds, Then the guest cart is merged into the account cart and I am returned to the exact checkout step I was on (not home), with the selected ShopMode (delivery|pickup) and any applied promo preserved.
- Given the signed-in account already has cart lines (e.g. from another device/session), When the merge runs, Then lines are combined by the canonical key productId+size (store/cart.ts cartItemId, per CUS-CART-01): matching lines sum quantities and non-matching lines are appended, so no duplicate line is created.
- Given a merged line whose summed quantity exceeds known available stock N (when the stock model exists, CUS-CART-06), When the merge completes, Then the line is clamped to N and a non-blocking notice explains the adjustment; with no stock model present, quantities sum without a cap.
- Given the guest had applied a promo (CUS-CART-05), When the cart is merged, Then the promo is re-validated against the merged cart and the signed-in user's per-user usage and min-spend rules; if it no longer qualifies it is removed with a clear Thai notice and the total recalculates (CUS-CART-04).
- Given the merge has already run for this sign-in, When I navigate back into checkout or the gate re-renders, Then the merge is idempotent and quantities are NOT double-counted.
- Given I cancel or abandon the auth gate, When I go back, Then no merge occurs, my guest cart is intact, and I remain a guest (CUS-ONB-08).
- Error: Given the merge persistence fails (offline/server), When auth completes, Then the guest cart is not lost, a retry path is offered, and no Order is created (the flow still stops before OrderStatus=placed, per CUS-ONB-08).
- A11y (ป้าสมศรี): after the merge the updated cart count and grand total are announced to the screen reader, and any 'quantity adjusted / promo removed' notice is conveyed as text (not color alone) at WCAG AA contrast with dynamic-type support.

*Dependencies:* CUS-ONB-08, CUS-ONB-06, CUS-CART-01, CUS-CART-04, CUS-CART-05, CUS-CART-06

*Notes:* Resolves the open 'guest-to-account cart-merge rule' flagged in CUS-ONB-08, in CUS-CART (CART PERSISTENCE), and the broken 'Guest -> account merge' end-to-end flow. Merge key reuses store/cart.ts productId+size (color excluded, per CUS-CART-01). Cart is in-memory today (store/cart.ts) and must become session-aware (CUS-ONB-06). The ShopMode value reconciliation online->pickup is a prerequisite (open question). The stock-cap branch is contingent on the still-open stock model (CUS-CART-06).

#### ACC-MERGE-02 — Guest wishlist merges into the account wishlist on sign-in  `🔴 MUST`
**As** guest shopper such as น้องแนน who hearted products before signing in, **I want** my guest favorites to merge into my account wishlist when I sign in, de-duplicated, **so that** I keep the products I saved and the same item never appears twice.
> 🩹 *closes:* [medium] Guest cart & wishlist merge on login

*Acceptance criteria:*
- Given a guest who favorited products (CUS-WISHLIST-01) then signs in, When auth succeeds, Then the guest wishlist is merged into my account wishlist as a UNION de-duplicated by product id (mirrors CUS-WISHLIST-05), with the result ordered most-recently-added first (CUS-WISHLIST-02).
- Given a product id present in both the guest and account wishlists, When the merge runs, Then exactly one entry remains (no duplicate).
- Given a guest-favorited id that no longer exists in the catalog (discontinued), When the merge resolves ids to products, Then that id is skipped gracefully and no crash occurs (CUS-WISHLIST-02).
- Given the merge has already run for this sign-in, When the wishlist tab re-renders, Then the merge is idempotent (no re-duplication).
- Given a shared device, When the merge completes, Then the guest (device-local) wishlist is cleared so the next guest/user cannot see the previous person's favorites (per-user privacy, CUS-WISHLIST-05).
- Error: Given the merge persistence fails, When auth completes, Then the local favorites are not lost and sync is retried on reconnect (CUS-WISHLIST-05 offline AC) with no data loss.
- A11y (ป้าสมศรี): when the wishlist updates after merge, the change is announced via accessibilityLiveRegion or a focus move, and rows remain dynamic-type and WCAG AA contrast compliant (CUS-WISHLIST-06).

*Dependencies:* CUS-ONB-08, CUS-WISHLIST-05, CUS-WISHLIST-01

*Notes:* Implements the merge clause that CUS-WISHLIST-05 explicitly defers ('guest favorites are merged ... de-duplicated by product id (merge policy is an open question)'). store/wishlist.ts is in-memory and seeded with SEED_IDS ['1','3','5'] today — that seeding must be removed (CUS-WISHLIST-05) so merge starts from real guest data. Once merged, the wishlist is PDPA personal data tied to the account.

#### ACC-MERGE-03 — Cart & wishlist state on logout and on abandoned sign-in  `🔴 MUST`
**As** customer on a possibly shared phone (P1 น้องแนน / P2 ป้าสมศรี), and a guest who backs out of the gate, **I want** clear, predictable handling of my cart and wishlist when I log out or abandon sign-in, **so that** the next person on the device cannot see my items and I am never surprised by leftover or lost data.
> 🩹 *closes:* [medium] Guest cart & wishlist merge on login

*Acceptance criteria:*
- Given a signed-in customer with an account cart and wishlist, When they confirm logout (CUS-ONB-07), Then the account cart, wishlist, addresses and order history are dropped from memory, the selected ShopMode resets to the default delivery, and the device returns to a CLEAN empty guest cart and empty guest wishlist (no previous-user items leak into the fresh guest session).
- Given a guest at the checkout auth gate, When they cancel or abandon authentication, Then no merge runs, the guest cart and guest wishlist remain exactly as built, and they continue as a guest (CUS-ONB-08).
- Given a customer who logs out while at checkout, When logout completes, Then they are returned to a browsable guest state with no Order created and no authed data retained on the device.
- Given the logout server call fails, When logout is confirmed, Then the local session and local authed cart/wishlist are still cleared (fail-safe local logout, CUS-ONB-07) so data is not exposed, and a server revoke is retried best-effort.
- Edge: Given a fresh guest session started after a logout, When they add items, Then they build a new independent guest cart/wishlist unrelated to the prior account's data.
- A11y (ป้าสมศรี): the post-logout guest state (empty cart/wishlist) is announced and reachable, and the logout confirm dialog is screen-reader-operable with >=44pt danger-styled controls at WCAG AA contrast (CUS-ONB-07).

*Dependencies:* CUS-ONB-07, CUS-ONB-08, ACC-MERGE-01, ACC-MERGE-02

*Notes:* Resolves the open dependency CUS-ONB-07 flags ('Whether the guest cart is kept or cleared on logout depends on the guest-cart-merge open question') and the 'what happens on logout' clause of this theme. Default is clear-on-logout for shared-device privacy; retaining a device-local cart for single-user convenience is an open question (also tied to whether cart/wishlist are device-local vs server-synced — CUS-CART/CUS-WISHLIST open questions). ShopMode reset to delivery mirrors CUS-ONB-07.


## GROOM-ENGAGE — Notifications Center & Merchandising Authoring
> Make อู้ฟู่ v1 internally consistent and buildable by closing two connective gaps. (1) Give the header bell (no-op in index.tsx/cart.tsx/account.tsx) a real in-app notification center, and define one canonical trigger->channel->audience routing policy across customer/admin/rider surfaces for the events that already imply notifications (order status changes, rider-assigned, low-stock, new-order), with explicit transactional-vs-consented (PDPA) classification, quiet hours/throttling, and push/SMS/LINE channel selection + fallback. (2) Add the missing admin authoring for the hero banners, featured sections, and promo codes that customers already consume (CUS-BROWSE-02/06, CUS-CART-05) but no admin epic creates, schedules, or limits. Uses canonical Roles/ShopMode/PaymentStatus/OrderStatus enums verbatim and reuses the existing Notification and (new) PromoCode entities.

#### ENG-NOTIF-01 — In-app notification center the bell opens  `🔴 MUST`
**As** customer (P1 น้องแนน / P2 ป้าสมศรี), **I want** tapping the notifications bell in the header to open a notification center listing my notifications newest-first with read/unread state and an unread-count badge, **so that** I can catch up on order updates, promotions, and shop messages in one place instead of the bell being a dead end.
> 🩹 *closes:* GAP-HIGH (Notification center / bell destination, OPEN-QUESTIONS.md L218/L269): gives the header bell its missing inbox screen.

*Acceptance criteria:*
- Given I am on Home, Cart, or บัญชีของฉัน, When I tap the notifications bell (today a notifications-outline IconButton with onPress={()=>{}} in app/(tabs)/index.tsx, cart.tsx, and account.tsx), Then a notification center screen opens listing my Notification records newest-first.
- Given I have unread notifications, When any header bell renders, Then it shows an unread-count badge ('9+' above 9) and exposes accessibilityLabel 'การแจ้งเตือน, ยังไม่อ่าน N รายการ'.
- Given a notification row, When the list renders, Then it shows a Thai title, a body preview, a relative timestamp ('เมื่อ 5 นาทีที่แล้ว'), a category icon (order / payment / promo / shop), and an unread indicator; tapping it marks it read and deep-links to its target (order detail per CUS-ORDERS-02, a promo/collection, or stays in-center for informational items).
- Given the center is open, When I tap 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด', Then all unread items become read and the bell badge resets to 0.
- Empty: Given I have no notifications, When the center opens, Then a friendly empty state 'ยังไม่มีการแจ้งเตือน' is shown (mirroring the empty-cart pattern) with no crash.
- Error: Given the notifications fetch fails (network/server), When the center opens, Then an inline error with a 'ลองใหม่' retry is shown and a successful retry replaces it with the list.
- Offline: Given the device is offline, When I open the center, Then previously synced notifications are shown from cache labelled possibly outdated, and new ones sync on reconnect.
- Edge: Given more notifications than one page, When I scroll to the end, Then older ones page in with a loading indicator and pull-to-refresh re-fetches the newest.
- a11y (ป้าสมศรี): Given large dynamic type and AA contrast, When the list renders, Then each row is a single ≥44pt target with an accessibilityLabel summarizing title + read state + time, unread state is conveyed by text/icon (not color alone), and focus order is logical.

*Dependencies:* CUS-BROWSE-01, CUS-ORDERS-02, CUS-ORDERS-03, CUS-PROFILE-01, ENG-NOTIF-02

*Notes:* The Notification entity is already referenced by CUS-ORDERS-03 and ADM-CAT-07 but no screen renders it. Define one shared Notification shape (category, title, body, target, audience, readAt, createdAt). The admin web and rider app get equivalent inboxes reading the same entity filtered by audience (ENG-NOTIF-05/06). This is the destination the CUS-BROWSE open question 'Notifications destination for the header bell' asks for.

#### ENG-NOTIF-02 — Notification trigger -> channel -> audience routing matrix  `🔴 MUST`
**As** shop owner (P3 admin), **I want** a single defined mapping from each notification trigger to its audience, channels (in-app, push, SMS, LINE), and classification (transactional vs marketing), **so that** every event that should notify someone reaches the right person on a reliable channel, with no spam and no missed events.
> 🩹 *closes:* GAP-HIGH (scattered triggers, no channel/trigger owner, OPEN-QUESTIONS.md L218/L255): defines the missing trigger->channel->audience policy for status changes, rider-assigned, low-stock, new-order.

*Acceptance criteria:*
- Given an order transitions to a customer-relevant OrderStatus (confirmed, preparing, out_for_delivery, ready_for_pickup, delivered, picked_up, payment_rejected, cancelled, delivery_failed), When it commits, Then one Notification is created for the order's customer with audience=customer, classification=transactional, delivered via in-app (always) + push (per CUS-ORDERS-03).
- Given intermediate/admin-only transitions (placed, awaiting_payment, slip_uploaded, payment_verifying, assigned_to_rider), When they occur, Then NO customer push fires (matches the CUS-ORDERS-03 curated set); instead placed routes to audience=admin (new-order, ENG-NOTIF-06) and assigned_to_rider routes to audience=rider (ENG-NOTIF-05).
- Given an order reaches assigned_to_rider via ADM-ORD-04, When committed, Then a Notification (audience=rider, transactional, in-app + push) is created for the assigned rider, and on reassignment the previously-assigned rider receives an 'unassigned/recalled' Notification.
- Given a new order is placed (OrderStatus=placed) in the live queue (ADM-ORD-01), When received, Then an admin-audience Notification (transactional, in-app + optional admin push) is created.
- Given a product crosses its lowStockThreshold or reaches stockQty=0 (ADM-CAT-07), When the event fires, Then an admin-audience Notification (transactional, in-app + optional admin push) is created and de-duped per ADM-CAT-07.
- Given a promotional message (new promo code launch / hero-banner campaign), When admin broadcasts it, Then it is classified marketing and sent only to customers with marketing consent (CUS-PROFILE-06 / CUS-ONB-04) — never forced as transactional.
- Given a critical transactional trigger whose primary channel cannot deliver, When delivery is attempted, Then the configured fallback channel (SMS or LINE) is used per ENG-NOTIF-07.
- Edge: Given a transition mapped to no audience/channel (explicitly-silent set), When it occurs, Then no notification is produced and no error is raised.
- Edge: Given the same trigger arrives twice (server retry), When processed, Then it is de-duped to one Notification per (trigger, entity, transition).

*Dependencies:* CUS-ORDERS-03, ADM-ORD-01, ADM-ORD-04, ADM-CAT-07, ENG-NOTIF-03, ENG-NOTIF-05, ENG-NOTIF-06, ENG-NOTIF-07

*Notes:* This is the canonical routing table and the home for ownership of Thai copy for ready_for_pickup, rejection (ADM-PAY-04), assignment, and cancellation messages (OPEN-QUESTIONS L142/L269). v1 MUST floor = in-app + push; SMS/LINE are SHOULD and provider-gated. Uses OrderStatus and Roles enums verbatim.

#### ENG-NOTIF-03 — Transactional vs consented classification & PDPA gating  `🔴 MUST`
**As** customer (P2 ป้าสมศรี) and the DPO, **I want** order/payment/delivery notifications to always reach me while promotional notifications are sent only if I opted in and stop the moment I withdraw consent, **so that** I never miss something about an order I placed but am not marketed to without consent, as PDPA requires.
> 🩹 *closes:* GAP-HIGH (consent wiring missing, OPEN-QUESTIONS.md L109/L255): wires transactional-vs-consented classification into the notification flow.

*Acceptance criteria:*
- Given a transactional notification (any from the curated OrderStatus set, a PaymentStatus change such as paid or rejected, or a rider assignment), When it is generated, Then it is delivered regardless of marketing-consent state because it is necessary to fulfil an order I placed.
- Given I have NOT granted marketing/notification consent (the optional opt-in kept separate from mandatory PDPA processing per CUS-ONB-04), When a marketing notification would be sent, Then it is not delivered to me on any channel (push, SMS, LINE, in-app center).
- Given I withdraw marketing consent in ความเป็นส่วนตัว & ข้อมูล (CUS-PROFILE-06), When the change is saved, Then it takes effect with a timestamp and no further marketing notifications are sent, while transactional ones continue unaffected.
- Given OS-level notification permission is denied but a transactional event occurs, When it is processed, Then no push is sent but the in-app Notification record is still created and surfaced in the center/badge (consistent with CUS-ORDERS-03).
- Edge: Given a message authored without an explicit classification, When it is queued, Then the system requires classification (transactional | marketing) and defaults to marketing (the more restrictive, consent-gated) when unset.
- a11y: Given the consent screen (CUS-PROFILE-06), When the marketing toggle renders, Then it has a Thai accessibilityLabel and clearly explains that withdrawing it does NOT affect order notifications.

*Dependencies:* CUS-ONB-04, CUS-PROFILE-06, CUS-ORDERS-03, ENG-NOTIF-02

*Notes:* PDPA hard constraint: order-processing notifications must NOT be bundled with the optional marketing opt-in. Whether suppressed marketing messages may still appear in the in-app center vs be fully withheld needs DPO sign-off (see openQuestions); default here is fully withheld without consent.

#### ENG-NOTIF-04 — Quiet hours, throttling & de-duplication  `🟠 SHOULD`
**As** customer (P1 น้องแนน), **I want** a quiet-hours window during which non-urgent notifications don't buzz my phone, plus protection from duplicate or rapid-fire alerts, **so that** I'm not woken at night by a promo and I'm not spammed by repeated alerts for one order.
> 🩹 *closes:* GAP-HIGH (quiet hours/throttling left unowned, OPEN-QUESTIONS.md L109/L269): defines quiet-hours and throttling on top of the routing matrix.

*Acceptance criteria:*
- Given a configurable quiet-hours window (default 22:00–08:00 Asia/Bangkok), When a non-urgent notification (marketing or low-priority) would push during quiet hours, Then it is deferred until the window ends or downgraded to in-app only (no sound/vibration).
- Given an urgent transactional notification (e.g. out_for_delivery, ready_for_pickup, payment_rejected, rider assignment) occurs during quiet hours, When it is processed, Then it is still delivered immediately — quiet hours applies only to non-urgent classes derived from the ENG-NOTIF-02 matrix.
- Given multiple status changes for the same order in a short window, When they are processed, Then pushes are throttled/coalesced to the latest relevant state (rapid hops collapse), while each Notification is still recorded in the center.
- Given the same transition arrives more than once (retry), When processed, Then duplicates are de-duped to one delivered push per (entity, transition), consistent with CUS-ORDERS-03.
- Given the customer has set a custom quiet-hours window or is in another timezone, When notifications are scheduled, Then their configured window/timezone is honored.
- Edge: Given a deferred notification's event becomes stale before the window ends (the order advanced again), When the window opens, Then only the still-relevant latest state is delivered, not the stale one.
- a11y: Given the quiet-hours setting control, When it renders, Then it has a Thai accessibilityLabel, is reachable by the screen reader, and is a ≥44pt target.

*Dependencies:* ENG-NOTIF-02, ENG-NOTIF-03, CUS-ORDERS-03

*Notes:* Quiet-hours defaults and the urgent vs non-urgent split need PO confirmation (OPEN-QUESTIONS L109). De-dup logic is shared with CUS-ORDERS-03's 'exactly one push per transition' rule.

#### ENG-NOTIF-05 — Rider 'you were assigned a job' notification  `🔴 MUST`
**As** rider (P4), **I want** an immediate push + in-app notification the moment a delivery is assigned to me, and a clear notice if it is reassigned away or recalled, **so that** I start delivering quickly and don't waste time on a job that was taken back.
> 🩹 *closes:* GAP-HIGH (no rider 'assigned a job' push story, OPEN-QUESTIONS.md L218): makes ADM-ORD-04's notify assertion a real story.

*Acceptance criteria:*
- Given a delivery order is assigned to me (OrderStatus=assigned_to_rider via ADM-ORD-04), When the assignment commits, Then I receive one push + an in-app Notification 'คุณได้รับงานจัดส่งใหม่' naming the order, and tapping it deep-links to my job detail (RID-QUEUE-03).
- Given I go offline (RID-AUTH-03) after assignment, When the job is still active, Then its notifications and job entry still reach me (no silent loss); admin can only newly assign riders who are available per ADM-ORD-04.
- Given the order is reassigned to another rider before I start it, When the reassignment commits, Then I receive an 'งานนี้ถูกมอบหมายใหม่' notification, the job leaves my queue (RID-QUEUE-08), and the new rider is notified.
- Given the order is cancelled or recalled while assigned to me, When it happens, Then I get a clear Thai notification and the job is removed from my active list (RID-QUEUE-08).
- Given my push permission is denied or my token is missing, When I am assigned, Then no push is sent but the in-app Notification + queue update still appear, and a critical-channel fallback may be used per ENG-NOTIF-07.
- Edge: Given the app was killed when the assignment push arrives, When I tap it, Then the app cold-starts and routes to the job detail (deep link survives cold start).
- Edge: Given duplicate assignment events (server retry), When processed, Then I receive exactly one assignment notification.
- a11y: Given the rider in-app notification row and push, When they render, Then text is dynamic-type friendly, AA-contrast, and the row is a ≥44pt labelled target.

*Dependencies:* ADM-ORD-04, RID-QUEUE-03, RID-QUEUE-08, RID-AUTH-03, ENG-NOTIF-01, ENG-NOTIF-02, ENG-NOTIF-07

*Notes:* Turns ADM-ORD-04's bare 'notifies that rider' assertion into a concrete, testable rider-assignment notification with channel + deep link + reassignment/recall handling. Whether assignment can occur before delivery payment is verified depends on ADR-0002 (prepay vs COD) but the notification itself is unaffected. audience=rider on the shared Notification entity.

#### ENG-NOTIF-06 — Admin new-order & low-stock alert delivery  `🔴 MUST`
**As** shop owner / staff (P3 admin), **I want** to actually be alerted in-app (with an optional push) when a new order arrives or a product runs low/out of stock, **so that** I never miss an order and can restock before customers like ป้าสมศรี hit 'สินค้าหมด'.
> 🩹 *closes:* GAP-HIGH (admin new-order/low-stock alerts unowned, OPEN-QUESTIONS.md L218/L255): gives them a delivery channel + admin inbox.

*Acceptance criteria:*
- Given a new order is placed (OrderStatus=placed) and surfaces in the live queue (ADM-ORD-01), When it arrives, Then an admin-audience Notification 'มีออเดอร์ใหม่ #<id>' is created in-app within 30s and the bell badge increments; an optional admin push may also fire.
- Given a product crosses its lowStockThreshold or reaches stockQty=0 (ADM-CAT-07), When the event fires, Then the corresponding admin Notification ('สต็อกใกล้หมด: <ชื่อ> เหลือ N' / 'สินค้าหมด: <ชื่อ>') is delivered to the admin inbox and de-duped per ADM-CAT-07 (no repeat while it stays low).
- Given admin owner vs staff tiers, When alerts route, Then both can receive operational alerts (new-order, low-stock) but configuration of channels/recipients is owner-restricted, consistent with ADM-ORD-08 / ADM-DASH-03 role gating.
- Given multiple admins are signed in, When an alert fires, Then each receives the in-app alert with per-admin read state (marking read on one device does not hide it as unread incorrectly on another).
- Given the admin opens a new-order alert, When tapped, Then it deep-links to that order's detail (ADM-ORD-02); a low-stock alert deep-links to the product / 'สต็อกต่ำ/หมด' list (ADM-CAT-07).
- Empty/Edge: Given no qualifying events, Then the admin inbox shows 'ยังไม่มีการแจ้งเตือน'; Given a burst of new orders, Then each order is individually actionable (not collapsed away) but sound/push may be rate-limited.
- a11y: Given the admin web inbox, When it renders, Then rows meet WCAG AA contrast, are keyboard-focusable, and status is conveyed by text+icon (not color alone).

*Dependencies:* ADM-ORD-01, ADM-ORD-02, ADM-CAT-07, ADM-ORD-08, ADM-DASH-03, ENG-NOTIF-01, ENG-NOTIF-02

*Notes:* ADM-ORD-01 and ADM-CAT-07 create alerts but specify no delivery channel/inbox — this owns that. v1 MUST = in-app admin inbox + badge; admin push is SHOULD. Low-stock copy and de-dup are already defined in ADM-CAT-07; this story owns delivery + routing only.

#### ENG-NOTIF-07 — Channel selection, fallback & per-recipient preferences  `🟠 SHOULD`
**As** customer / rider, **I want** to choose which channels I receive non-critical notifications on and still get critical ones via a fallback channel if push fails, **so that** I get updates the way I prefer without ever missing something important.
> 🩹 *closes:* GAP-HIGH (push/SMS/LINE channel choice + fallback missing, OPEN-QUESTIONS.md L269): defines channel selection and fallback.

*Acceptance criteria:*
- Given a notification preferences screen, When it renders, Then I can toggle channels (push, and where available SMS / LINE) for non-critical categories, with transactional/critical categories shown as always-on (not disableable) and explained in Thai.
- Given a critical transactional notification (e.g. ready_for_pickup, payment_rejected, rider assignment) and my push token is missing/revoked, When delivery is attempted, Then the system falls back to a configured channel (SMS or LINE) per the ENG-NOTIF-02 matrix and always records the in-app Notification.
- Given SMS or LINE is not configured/available in v1, When a fallback would be used, Then the system degrades gracefully to in-app only and logs the gap (no crash, no infinite retry).
- Given a delivery attempt fails (provider error, invalid number), When it fails, Then it is retried with backoff up to a cap then marked failed, while the in-app record remains so the user can still see the update.
- Given LINE is offered as a channel, When I link my LINE account, Then linking follows the LINE provider flow and can be unlinked later.
- Edge: Given I disable all optional channels, When events occur, Then I still receive critical transactional notifications and the in-app center still records everything.
- a11y: Given the preferences screen, When it renders, Then each toggle has a Thai accessibilityLabel, AA contrast, and a ≥44pt target, and always-on items are announced as such.

*Dependencies:* ENG-NOTIF-02, ENG-NOTIF-03, CUS-PROFILE-06, CUS-ORDERS-03

*Notes:* SMS provider + Thai sender-ID and the LINE Login/Notify channel under a registered business are open questions (ADR-0001, OPEN-QUESTIONS L14/L15). Push-only is the v1 floor with SMS/LINE behind those decisions. Critical categories cannot be opted out (fulfilment necessity) even though they remain transactional under ENG-NOTIF-03.

#### ENG-MERCH-01 — Admin authoring of hero banners  `🔴 MUST`
**As** shop owner (P3 admin), **I want** to create, edit, order, schedule, and publish/unpublish the Home hero banners (image, Thai headline, CTA target), **so that** the customer hero carousel shows real, current, admin-controlled promotions instead of hardcoded slides.
> 🩹 *closes:* GAP-MED (no admin authoring of hero banners, OPEN-QUESTIONS.md L219): adds the authoring CUS-BROWSE-02 consumes.

*Acceptance criteria:*
- Given the merchandising area, When admin creates a banner, Then a form captures: image (≥1, required, with required alt text), Thai headline, CTA label (default 'ช้อปเลย'), CTA target (one of promo collection / category / product / external), publishState (draft | published), display order, and an optional active window (start/end datetime).
- Given published banners with an active window, When a customer loads Home, Then only currently-active published banners appear in CUS-BROWSE-02, in the admin display order.
- Given a banner image is missing or fails validation (wrong type / too large), When admin saves, Then it is rejected with a Thai error and the banner cannot be published without a valid image + alt text.
- Given admin reorders banners, When saved, Then the customer carousel reflects the new order; Given exactly one active banner, Then the carousel shows a single static slide with dots hidden (matches the CUS-BROWSE-02 edge).
- Empty: Given zero active banners, When Home loads, Then the customer hero region is omitted entirely (matches the CUS-BROWSE-02 empty rule) with no layout gap.
- Given a CTA target pointing to an unpublished/deleted product or category, When validated, Then admin is warned and the banner cannot be published with a broken target (prevents dead 'ช้อปเลย' taps).
- Given owner vs staff tiers, When staff vs owner access merchandising, Then access follows ADM-AUTH role rules (banners editable by authorized admins only).
- a11y: Given the authoring form, When it renders, Then alt text is required and the admin UI is keyboard-accessible and AA-contrast; customer-side a11y (scrim contrast, reduced motion) remains owned by CUS-BROWSE-02/03.

*Dependencies:* CUS-BROWSE-02, CUS-BROWSE-03, ADM-AUTH, ADM-CAT-04

*Notes:* Replaces the hardcoded BANNER_SLIDES in app/(tabs)/index.tsx and resolves the open 'are banners CMS-managed in v1' + 'banner CTA target' questions (OPEN-QUESTIONS L37/L38). Banner entity: image, alt, headline, ctaLabel, ctaTarget, order, publishState, activeFrom/activeTo. publishState mirrors ADM-CAT-04 (draft | published).

#### ENG-MERCH-02 — Admin authoring of featured sections  `🟠 SHOULD`
**As** shop owner (P3 admin), **I want** to define the curated Home sections (Thai title, ordered product membership, 'ดูทั้งหมด' target, publish, order), **so that** the customer featured rows are real and merchandised, not hardcoded.
> 🩹 *closes:* GAP-MED (no admin authoring of featured sections, OPEN-QUESTIONS.md L219): adds the authoring CUS-BROWSE-06 consumes.

*Acceptance criteria:*
- Given the merchandising area, When admin creates a featured section, Then a form captures: Thai title (e.g. ของสดใหม่ทุกวัน), an ordered list of member products (add / remove / reorder), an optional 'ดูทั้งหมด' target (category or collection), publishState, and section display order.
- Given a published section with members, When a customer loads the unfiltered ทั้งหมด Home, Then the section appears with its title + horizontal ProductCard row in the configured order (CUS-BROWSE-06).
- Empty: Given a section whose members are all unpublished/unavailable or it has zero members, When Home renders, Then the section is omitted (never shown empty) per CUS-BROWSE-06.
- Given a member product becomes unpublished or out of stock (ADM-CAT-03/04), When the section renders, Then unpublished items drop out and out-of-stock items show the 'สินค้าหมด' state (not silently removed mid-list), keeping ordering stable.
- Given a category filter chip is active on Home, When the customer filters, Then sections collapse to the flat grid per CUS-BROWSE-06 (admin config does not override that interaction).
- Given admin reorders sections, When saved, Then the customer Home section order updates.
- Given owner vs staff tiers, When editing sections, Then only authorized admins (ADM-AUTH) can change them.
- a11y: Given the authoring UI, When it renders, Then it is keyboard-accessible; customer-side header roles and swipe a11y remain owned by CUS-BROWSE-06.

*Dependencies:* CUS-BROWSE-06, ADM-CAT-03, ADM-CAT-04, ADM-AUTH, ENG-MERCH-01

*Notes:* Section membership references catalog products and respects publishState/stock. Reuse Thai theme copy (แนะนำ / ของสดใหม่ทุกวัน / ลดราคา). Today Home renders only a flat grid (app/(tabs)/index.tsx) — sections are net-new and admin-managed.

#### ENG-MERCH-03 — Admin authoring of promo codes (PromoCode entity)  `🔴 MUST`
**As** shop owner (P3 admin), **I want** to create, edit, activate/deactivate, and expire promo codes with discount type, min spend, validity window, and usage limits, **so that** the customer promo input validates against real, admin-controlled codes instead of a mock alert.
> 🩹 *closes:* GAP-MED (no admin authoring of promo codes, OPEN-QUESTIONS.md L219): introduces the PromoCode create/limit/expire authoring behind CUS-CART-05's mock.

*Acceptance criteria:*
- Given the promo authoring screen, When admin creates a code, Then a form captures: code string (unique, case-insensitive; customer input autoCapitalizes per cart.tsx), discount type (percent | fixed_baht), discount value, optional max-discount cap (for percent), min spend, validity window (start/end), total usage limit, per-user usage limit, scope (subtotal only | may reduce/waive delivery fee), and an active flag.
- Given an invalid configuration (value ≤ 0, percent > 100, end before start, duplicate code), When admin saves, Then it is rejected with a specific Thai error and not persisted.
- Given a published active code within its window, When a customer applies it (CUS-CART-05), Then a 'ส่วนลด −฿XX' line appears per its type/scope (CUS-CART-04); Given an expired / not-yet-started / inactive code, Then the customer sees 'โค้ดไม่ถูกต้องหรือหมดอายุ'.
- Given a code scoped to subtotal only, When applied, Then it never reduces the ฿40 delivery fee; Given a code that waives delivery, Then its precedence against the ฿200 free-delivery threshold (CUS-MODE-03) is explicitly defined so the customer never gets a double benefit.
- Given a code reaches its total or per-user usage limit, When a customer tries to apply it, Then it is rejected with 'โค้ดนี้ถูกใช้ครบแล้ว' (enforced by ENG-MERCH-04).
- Given admin deactivates or expires a code, When saved, Then new applications fail immediately while already-placed orders keep their recorded discount (historical integrity).
- Given owner vs staff tiers, When managing codes, Then only authorized admins (ADM-AUTH) can create/limit/expire codes.
- a11y: Given the authoring form, When validation fails, Then errors are announced and fields are labelled; customer-side promo a11y stays in CUS-CART-05.

*Dependencies:* CUS-CART-05, CUS-CART-04, CUS-MODE-03, ADM-AUTH, ENG-MERCH-04

*Notes:* The customer cart (app/(tabs)/cart.tsx onApply) currently mocks promo application with an Alert that does not change the total — this entity is what CUS-CART-05 must bind to. PromoCode shape: code, type(percent|fixed_baht), value, maxDiscount, minSpend, activeFrom/activeTo, totalLimit, perUserLimit, scope(subtotal|delivery), active. Resolves the OPEN promo-scope question (OPEN-QUESTIONS L69).

#### ENG-MERCH-04 — Shared promo validation & redemption engine  `🟠 SHOULD`
**As** customer (P1 น้องแนน), **I want** the promo code I apply to be validated and redeemed by the same rules the admin set, enforced consistently at apply-time and at order placement, **so that** I get the correct discount and am never surprised by a code silently failing at checkout.
> 🩹 *closes:* GAP-MED (promo consumed but no authoring/redemption contract, OPEN-QUESTIONS.md L219/L69): closes the consume-without-author gap between CUS-CART-05 and ENG-MERCH-03.

*Acceptance criteria:*
- Given a code applied in cart (CUS-CART-05), When validated, Then the engine checks: exists + active, within validity window, min spend met against current subtotal, total + per-user usage caps not exceeded, and scope (subtotal vs delivery) — returning either a computed discount or a specific Thai reason.
- Given the discount is applied, When the order is placed (cart Buy Now / CUS-CHK), Then the engine re-validates atomically at placement (the code may have expired or hit its cap between apply and place) and either confirms or blocks with a clear message and refreshed totals (no stale discount).
- Given the order is placed successfully with a code, When committed, Then the code's total-usage and the customer's per-user usage are incremented atomically (a limited code cannot be oversold under concurrency).
- Given an order is cancelled before fulfilment (CUS-ORDERS-04 / ADM-ORD-06), When the cancellation commits, Then the consumed usage is released back (configurable) so a limited code is not permanently burned by a cancelled order.
- Given min spend depends on subtotal and the cart changes after a code is applied, When the subtotal drops below min spend, Then the discount is automatically removed/invalidated with a Thai notice and the CUS-CART-04 summary updates.
- Given a percent code with a max-discount cap, When subtotal is large, Then the discount is capped at maxDiscount.
- Edge: Given a code is already applied and the customer tries to apply a second, When they do, Then v1 allows only one active code per order (no stacking) with a clear message.
- a11y: Given the discount changes, When the total updates, Then the new total/discount line is announced to the screen reader (consistent with CUS-CART-08).

*Dependencies:* ENG-MERCH-03, CUS-CART-05, CUS-CART-04, CUS-MODE-03, CUS-ORDERS-04, ADM-ORD-06

*Notes:* Provides the contract between the customer promo UI (CUS-CART-05) and admin authoring (ENG-MERCH-03): apply-time vs placement-time re-validation, atomic usage decrement under concurrency, and cancel-time release. Single-code-per-order is the v1 rule (stacking out of scope).

#### ENG-MERCH-05 — Merchandising scheduling, preview, access control & audit  `🟡 COULD`
**As** shop owner (P3 admin), **I want** to preview merchandising changes before they go live, schedule them, restrict who can publish, and see an audit trail of changes, **so that** campaigns launch cleanly, only authorized staff change the storefront, and mistakes are traceable.
> 🩹 *closes:* GAP-MED (merchandising authoring lacks scheduling/role-gating/audit, OPEN-QUESTIONS.md L219): makes the authoring safe and complete.

*Acceptance criteria:*
- Given a draft banner / section / promo, When admin taps 'ดูตัวอย่าง', Then a preview renders the customer-facing result (banner slide / featured row / promo discount example) without publishing it.
- Given a scheduled active window (ENG-MERCH-01/03), When the start time arrives, Then the item goes live automatically and at the end time it retires automatically (no manual toggle), evaluated in Asia/Bangkok time.
- Given owner vs staff tiers (ADM-AUTH), When a staff member without publish permission edits merchandising, Then they can save drafts but cannot publish/schedule; only owner (or permitted staff) can publish — consistent with ADM-ORD-08 / ADM-DASH-03 gating.
- Given any create / edit / publish / expire action on banners, sections, or promo codes, When it commits, Then an audit entry records who, what, and when.
- Edge: Given overlapping scheduled banners that would all be active at once, When the window opens, Then admin is warned (the carousel still renders all per display order; no crash).
- a11y: Given the preview and authoring screens, When they render, Then they are keyboard-accessible and AA-contrast.

*Dependencies:* ENG-MERCH-01, ENG-MERCH-02, ENG-MERCH-03, ADM-AUTH, ADM-ORD-08, ADM-DASH-03

*Notes:* Governance/efficiency layer on top of the authoring stories. v1 can ship the MUST/SHOULD merchandising without it, but it de-risks campaign launches and enforces owner vs staff publishing. Scheduling reuses the active windows defined in ENG-MERCH-01 (banners) and ENG-MERCH-03 (promo validity).


## Open questions (รอบ grooming)
- **GROOM-PAY:** COD eligibility: what is the COD order-value cap, and is COD restricted for new vs returning customers or specific zones?
- **GROOM-PAY:** PaymentStatus mapping for COD: confirm reusing awaiting_payment to mean 'cash owed, collect at delivered' (no dedicated cod-pending value exists in the enum).
- **GROOM-PAY:** Short/partial COD payment: is it ever allowed (and recorded), or always treated as delivery_failed as assumed in v1?
- **GROOM-PAY:** Rider float source and granularity: does the shop pre-fund the rider's opening float in cash, and is the float per rider per shift or carried across shifts?
- **GROOM-PAY:** Settlement variance: is there an auto-accept tolerance threshold below which owner approval is not required, and how are over/short amounts settled financially?
- **GROOM-PAY:** payment_rejected refunds: how does an admin determine 'funds actually received' to justify a refund, given a rejected slip may correspond to a real transfer? Needs a 'funds received' flag distinct from slip approval.
- **GROOM-PAY:** awaiting_payment window: what is the default expiry duration, and does QR reissue (GROOM-PAY-11) reset/extend it?
- **GROOM-PAY:** Rejected-prepay recovery: confirm v1 treats payment_rejected as terminal (customer must reorder) vs allowing re-upload back into awaiting_payment — this changes GROOM-PAY-11 AC4.
- **GROOM-PAY:** Refund auto-confirm: if a customer never confirms a 'sent' refund, does it auto-confirm after a timeout, and what proof is retained?
- **GROOM-PAY:** Customer notification fallback channel (SMS/LINE) for refund and timeout events, important for P2 ป้าสมศรี accessibility.
- **GROOM-PAY:** Canonical ShopMode is delivery|pickup but the current code (store/mode.ts) uses delivery|online — confirm the rename and that pickup is always prepay end to end.
- **GROOM-STOCK:** payment_rejected reservation policy: the task specifies RELEASE on payment_rejected (GROOM-STOCK-04), and recovery (CUS-ORDERS-06) re-runs the reserve guard — but should the order instead HOLD its reservation for a short grace window during normal re-upload so the customer does not lose their stock to another buyer mid-recovery? Needs PO decision.
- **GROOM-STOCK:** COD commit milestone: GROOM-STOCK-03 commits (decrements on-hand) at OrderStatus=confirmed for COD, even though COD cash 'paid' lands at delivered. Confirm confirmed (chosen, keeps shelf count correct) vs deferring the physical decrement to delivered.
- **GROOM-STOCK:** availabilityByMode vs stock pool: confirm stockQty is one shared physical pool across delivery|pickup with availabilityByMode as a pure visibility flag, and the shop never wants a separate pickup-only/delivery-only stock count for any product (e.g. ของสด).
- **GROOM-STOCK:** Low-stock alert trigger basis: ADM-CAT-07 wording says 'stockQty ≤ threshold' but GROOM-STOCK-05 triggers on availableQty crossing (customer-facing). Confirm which number drives the threshold, and whether a separate on-hand replenishment threshold is also wanted.
- **GROOM-STOCK:** Reservation TTL for awaiting_payment expiry (GROOM-STOCK-06): exact timeout (proposed 30 min), and whether a fresh PromptPay QR is reissued when the customer re-attempts payment.
- **GROOM-STOCK:** Default per-variant lowStockThreshold (proposed 5) and whether the threshold is per-variant or shared per-product.
- **GROOM-STOCK:** Admin-lowers-below-held edge: confirm availableQty floors at 0 for customers and the shop is flagged short (GROOM-STOCK-01/03) rather than blocking the admin from reducing stockQty below reservedQty.
- **GROOM-STOCK:** Concurrency mechanism on Supabase (ADR-0001): atomic conditional decrement vs row lock for the place-time reserve (GROOM-STOCK-02) — confirm the chosen primitive guarantees no oversell under simultaneous placements.
- **GROOM-FULFILL:** Acceptance-window duration for a pushed assignment and the RID-AUTH-04 offline/unreachable threshold: one shared config value or two separate values?
- **GROOM-FULFILL:** On decline/timeout, does the order revert to OrderStatus=preparing (re-entering the pull pool) or stay assigned_to_rider flagged for admin-only manual reassign? Depends on whether the self-assign pull pool (RID-QUEUE-01/02 'งานที่ว่าง') ships in v1 or assignment is push-only.
- **GROOM-FULFILL:** Canonical rider decline-reason enum values (GROOM-FULFILL-02).
- **GROOM-FULFILL:** Max delivery attempts before re-dispatch is blocked (attempt cap), and whether 'นัดส่งใหม่ภายหลัง' (reschedule with a target time) is in v1 or deferred to a fast-follow.
- **GROOM-FULFILL:** Is delivery_failed always resolved to cancelled as the true terminal, or can delivery_failed itself be a closed/written-off terminal? Confirm the canonical lifecycle, which currently lists delivery_failed as terminal yet ADM-ORD-04 re-attempts from it.
- **GROOM-FULFILL:** Undeliverable cancel-reason enum value, and whether it is distinct from a normal admin cancel reason (ADM-ORD-06).
- **GROOM-FULFILL:** Refund lifecycle sign-off: confirm states owed -> sent -> confirmed (+ failed), whether a dedicated Refund entity is added, whether the customer self-confirms receipt, required transfer proof (ref/slip), and the refund SLA — needs finance/legal, and applies beyond delivery_failed to payment_rejected and self-cancel (CUS-ORDERS-04).
- **GROOM-FULFILL:** COD failed-delivery handling: confirm a never-collected COD order cancel = no refund, and define how an at-door COD short/decline (RID-DLV-06, blocked) feeds delivery_failed recovery (cross-theme with COD).
- **GROOM-FULFILL:** Which RID-DLV-05 rider failure reasons are safe to surface verbatim to the customer vs internal-only (GROOM-FULFILL-06).
- **GROOM-FULFILL:** Customer exposure of rider info: identity-only vs live rider location (map); POD photo shown in-app to the customer vs available-on-request; POD/rider-location retention period and who may view (PDPA).
- **GROOM-FULFILL:** Does admin need a manual override to set out_for_delivery/delivered when an accepted rider becomes unreachable mid-run (ADM-ORD-04 currently treats those rider-owned transitions as read-only)?
- **GROOM-ACCOUNTS:** Owner-only vs staff-allowed for rider account provisioning/edit/deactivation: proposed owner-only (account administration, like staff management). Confirm with PO — affects ACC-RID-01..03 and the ACC-ROLE-01 matrix.
- **GROOM-ACCOUNTS:** Can one phone number hold multiple Roles (e.g. a customer who is also a rider), or is Role single-per-account? Determines conflict handling when inviting a rider whose number is already a customer (ACC-RID-01). Ties to the CUS-ONB account-merge / identity-resolution open question.
- **GROOM-ACCOUNTS:** Confirm owner/staff is modeled as a tier ATTRIBUTE on Roles=admin (canonical enum unchanged) vs promoted to first-class Roles (ACC-ROLE-01). Already flagged inconsistent across ADM-AUTH/ADM-ORD-08/ADM-PAY/ADM-DASH.
- **GROOM-ACCOUNTS:** Final owner-only vs staff-allowed action list needs PO sign-off (exactly which catalog/order/payment actions staff may perform) — ADM-AUTH-03 calls the current split a proposed default.
- **GROOM-ACCOUNTS:** Rider onboarding model: admin-provisioned only (assumed in ACC-RID-01) vs rider self-signup (RID-AUTH open question).
- **GROOM-ACCOUNTS:** Does rider account provisioning/deactivation and tier change require step-up re-auth (ADM-AUTH-06), as staff management does? Proposed yes.
- **GROOM-ACCOUNTS:** Guest cart merge conflict policy when the account already holds a cart on another device: sum quantities (proposed) vs replace vs keep-both; and whether cart/wishlist are device-local only or server-synced (changes both merge and logout semantics) — CUS-CART/CUS-WISHLIST open questions.
- **GROOM-ACCOUNTS:** Promo-on-merge re-validation: confirm a guest-applied promo is re-checked against the signed-in user's per-user usage cap and min-spend, and dropped if it no longer qualifies (ACC-MERGE-01).
- **GROOM-ACCOUNTS:** Logout data policy: always clear cart/wishlist for shared-device privacy (proposed) vs retain a device-local cart for single-user convenience (ACC-MERGE-03 / CUS-ONB-07).
- **GROOM-ACCOUNTS:** Stock-cap-at-merge depends on the still-open stock model (CUS-CART-06): once stock exists, confirm clamp-and-notify vs reject for over-stock merged lines.
- **GROOM-ENGAGE:** Channels in v1: is push the only delivery channel at launch, or do SMS and/or LINE ship too? SMS requires a provider + Thai sender-ID registration (OPEN-QUESTIONS L14) and LINE requires a Login/Notify channel under a registered business (ADR-0001, OPEN-QUESTIONS L15) — both gate ENG-NOTIF-07 and the fallback rows of ENG-NOTIF-02.
- **GROOM-ENGAGE:** Quiet-hours defaults and timezone handling: confirm the default window (proposed 22:00–08:00 Asia/Bangkok), whether customers can customize it, and exactly which OrderStatus transitions count as 'urgent' (override quiet hours) vs deferrable (ENG-NOTIF-04).
- **GROOM-ENGAGE:** Marketing without consent: when a customer has not granted marketing consent, are marketing messages fully withheld on all channels (current default) or may they still appear passively in the in-app center? Needs DPO sign-off (ENG-NOTIF-03).
- **GROOM-ENGAGE:** Admin push: do owner/staff receive push (not just in-app) for new-order and low-stock in v1, and which alerts are owner-only vs delegable to staff (ENG-NOTIF-06, ADM-ORD-08)?
- **GROOM-ENGAGE:** Promo scope precedence: when a promo can waive/reduce the ฿40 delivery fee, how does it interact with the ฿200 free-delivery threshold (CUS-MODE-03) — which applies first and is double benefit prevented (ENG-MERCH-03/04, OPEN-QUESTIONS L69)?
- **GROOM-ENGAGE:** Promo usage on cancellation: is consumed promo usage released back when an order is cancelled (proposed configurable default = release), and does a refunded/rejected order behave the same (ENG-MERCH-04)?
- **GROOM-ENGAGE:** Banner CTA target types to support in v1: promo collection / category / product / external — confirm the supported set and how broken/unpublished targets are prevented (ENG-MERCH-01, OPEN-QUESTIONS L37).
- **GROOM-ENGAGE:** Single-code-per-order: confirm stacking is disallowed in v1 (one active promo per order) as assumed in ENG-MERCH-04.
- **GROOM-ENGAGE:** Ownership of Thai notification copy for ready_for_pickup, payment rejection (ADM-PAY-04), rider assignment, and cancellation messages — confirmed to live in the ENG-NOTIF-02 routing matrix (OPEN-QUESTIONS L142/L269)?
- **GROOM-ENGAGE:** Notification entity reach: should price-drop/restock notifications on wishlisted items (OPEN-QUESTIONS L78) be in v1 scope for the marketing class, or explicitly deferred?