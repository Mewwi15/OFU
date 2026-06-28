# 03 — Functional Requirements (v1)

> ที่มา: requirements workflow (19 epics, 149 stories) + consistency critic — ดู `OPEN-QUESTIONS.md` สำหรับช่องโหว่/คำถามค้าง
> Canonical enums: Roles `customer|admin|rider` · ShopMode `delivery|pickup` · PaymentStatus `awaiting_payment|slip_uploaded|verifying|paid|rejected` · OrderStatus (ดู §0)

## §0 OrderStatus lifecycle (อ้างอิงร่วมทุก surface)
```
placed → awaiting_payment → slip_uploaded → payment_verifying → confirmed → preparing →
   (delivery) assigned_to_rider → out_for_delivery → delivered
   (pickup)   ready_for_pickup → picked_up
branch/terminal: cancelled · payment_rejected · delivery_failed
```

## สรุป epic
| Epic | Surface | Stories | Must |
|------|---------|---------|------|
| CUS-ONB Onboarding & Authentication | customer | 8 | 7 |
| CUS-PROFILE Account, Profile & Addresses | customer | 8 | 6 |
| CUS-BROWSE Home / Discover | customer | 8 | 6 |
| CUS-SEARCH Search, Filter & Sort | customer | 8 | 4 |
| CUS-PRODUCT Product Detail | customer | 8 | 6 |
| CUS-CART Cart | customer | 8 | 7 |
| CUS-WISHLIST Wishlist (รายการโปรด) | customer | 8 | 6 |
| CUS-MODE Shopping Mode (delivery / pickup) | customer | 7 | 6 |
| CUS-CHECKOUT Checkout & Payment (PromptPay + slip) | customer | 8 | 7 |
| CUS-ORDERS Order Tracking, History & Reorder | customer | 7 | 3 |
| ADM-AUTH Admin Auth & Roles | admin | 7 | 5 |
| ADM-CATALOG Catalog Management (จัดการแคตตาล็อกสินค้า) | admin | 9 | 5 |
| ADM-ORDERS Order Management & Rider Assignment | admin | 8 | 7 |
| ADM-PAYMENT Payment / Slip Verification | admin | 8 | 4 |
| ADM-DASH Dashboard & Reports | admin | 8 | 2 |
| RID-AUTH Rider Auth & Availability | rider | 7 | 3 |
| RID-QUEUE Delivery Jobs Queue | rider | 8 | 4 |
| RID-DELIVERY Active Delivery & Proof of Delivery | rider | 7 | 5 |


## ฝั่งลูกค้า (Customer App)

### CUS-ONB — Onboarding & Authentication
> Let new and returning customers browse อู้ฟู่ as guests and authenticate via phone+OTP or LINE/Apple/Google with explicit PDPA consent and a persistent, secure session, deferring sign-in to the checkout moment.

#### CUS-ONB-01 — First-run welcome with guest entry  `🔴 MUST`
**As** first-time visitor (น้องแนน), **I want** to open อู้ฟู่ and start browsing the shop without being forced to sign up, **so that** I can see real products and prices before deciding to create an account.

*Acceptance criteria:*
- Given a fresh install with no stored session and the first-run flag unset, When the app finishes launching past the splash, Then a one-time welcome screen renders with the อู้ฟู่ brand and two primary actions: 'เริ่มช้อปเลย' (continue as guest) and 'เข้าสู่ระบบ / สมัครสมาชิก'.
- Given the welcome screen, When I tap 'เริ่มช้อปเลย', Then the first-run flag is persisted, I land on the home tab as a guest, and the default ShopMode is delivery.
- Given I have completed first-run once (as guest or authed), When I relaunch the app, Then the welcome screen does NOT appear again and I resume in my prior state.
- Given the device has Reduce Motion enabled, When the welcome screen and the home auto-rotating promo banner render, Then animations are disabled/replaced with a static frame and the banner does not auto-advance.
- Given ป้าสมศรี with the OS at the largest dynamic-type setting, When the welcome screen renders, Then all text scales without truncation or overlap and both action buttons have a touch target >= 48x48dp and >= 4.5:1 (WCAG AA) text contrast.
- Given a guest who taps 'เข้าสู่ระบบ / สมัครสมาชิก', When the auth screen opens, Then they can close/back out and continue browsing as a guest without authenticating.

*Dependencies:* CUS-ONB-06 (persisted first-run/session flag)

*Notes:* Greenfield: the app today has no first-run or auth screen. account.tsx currently shows a hardcoded logged-in profile (คุณอู้ฟู่ / oofoo@email.com) that must instead reflect guest vs authed. Reduced-motion AC ties directly to the known auto-rotating banner a11y debt on home (app/(tabs)/index.tsx).

#### CUS-ONB-02 — Phone number entry and OTP request  `🔴 MUST`
**As** customer, **I want** to enter my Thai mobile number and receive a one-time code by SMS, **so that** I can prove the number is mine and sign in.

*Acceptance criteria:*
- Given the login screen, When I enter a valid Thai mobile number (10 digits starting with 0, or +66 format) and tap 'ขอรหัส OTP', Then an OTP is requested and I advance to the code-entry screen showing the masked number.
- Given an empty or malformed number (wrong length, non-digit, or not a Thai mobile prefix), When I tap 'ขอรหัส OTP', Then the request is blocked and an inline Thai error explains the problem and the field shows an error state.
- Given a code was just sent, When I am on the code-entry screen, Then 'ส่งรหัสอีกครั้ง' is disabled with a visible countdown (e.g. 60s) before it can be used again.
- Given I exceed the allowed OTP requests within the rate-limit window, When I request again, Then I see a Thai 'ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง' message and further requests are throttled.
- Given no or poor network, When the OTP request fails, Then a non-blocking Thai error with a Retry action is shown and no navigation occurs.
- Given ป้าสมศรี at the largest dynamic type, When the phone field renders, Then label/helper/error text scale and stay AA-contrast, a numeric keyboard opens automatically, and the input exposes an accessibilityLabel.

*Dependencies:* SMS/OTP provider (open question), CUS-ONB-04 (PDPA consent gates first account creation)

*Notes:* A11y debt: textMuted #9B9B9B on the white card is ~2.8:1 and fails AA — helper/error text must use a darker token. SMS provider and sender-ID registration are unresolved (open question).

#### CUS-ONB-03 — OTP verification and customer account creation  `🔴 MUST`
**As** customer, **I want** to enter the 6-digit code to verify my number and get my account, **so that** I am signed in as a customer and can check out.

*Acceptance criteria:*
- Given a valid OTP was sent, When I enter the correct 6-digit code, Then I am authenticated; if no account exists for the number a User is created with role customer, and I proceed to the post-auth destination (home, or back to checkout if gated).
- Given I enter an incorrect code, When I submit, Then I see an inline Thai 'รหัสไม่ถูกต้อง' error, the entry highlights/clears, and my remaining attempts decrement and are shown.
- Given the code has passed its TTL, When I submit, Then I see 'รหัสหมดอายุ กรุณาขอรหัสใหม่' and must request a new code.
- Given I exceed the maximum wrong attempts, When I submit again, Then verification is locked for a cooldown and a Thai lockout message is shown.
- Given an Android device that supports SMS auto-retrieval, When the SMS arrives, Then the code may auto-fill, but manual entry and paste always work.
- Given ป้าสมศรี, When the 6-digit entry renders, Then each digit box is >= 48dp, supports paste, exposes accessibilityLabels, announces remaining attempts to screen readers, and meets AA contrast.

*Dependencies:* CUS-ONB-02, CUS-ONB-04

*Notes:* New account MUST use the canonical Role customer. Whether a phone account merges with a later social-login identity is an open question (account-merge policy).

#### CUS-ONB-04 — PDPA consent at signup  `🔴 MUST`
**As** new customer (PDPA data subject), **I want** to review and explicitly agree to the privacy terms before my account is created, **so that** my personal data is collected lawfully and I understand my rights.

*Acceptance criteria:*
- Given I am completing signup for the first time (phone or social), When the consent step renders, Then it shows Thai-language PDPA consent text, a link to the full นโยบายความเป็นส่วนตัว, the consent version, and an explicit unchecked agreement control.
- Given consent is not granted, When I try to proceed, Then account creation is blocked and the primary button stays disabled with guidance.
- Given I grant consent, When the account is created, Then the consent version and timestamp are recorded against the User.
- Given I decline or close the consent step, When I exit, Then no account is created and I return to browsing as a guest.
- Given the consent version changes after I signed up, When I next sign in, Then I am re-prompted to accept the new version before continuing (re-consent).
- Given ป้าสมศรี at the largest dynamic type, When consent renders, Then the full text is scrollable and readable, and the checkbox plus its label form one >= 48dp tappable target whose accessibilityState reflects checked/unchecked.

*Dependencies:* Legal/Thai privacy-policy copy, CUS-ONB-02, CUS-ONB-05

*Notes:* Mandatory data-processing consent must be SEPARATE from any optional marketing/notification opt-in (do not bundle). Consent withdrawal, account-deletion flow, data-retention period, and minor/age handling are open questions.

#### CUS-ONB-05 — Social login (LINE / Apple / Google)  `🟠 SHOULD`
**As** customer who prefers not to type a phone number (น้องแนน), **I want** to sign in with LINE, Apple, or Google, **so that** I can onboard in a single tap.

*Acceptance criteria:*
- Given the auth screen, When it renders, Then it offers 'เข้าสู่ระบบด้วย LINE', Apple, and Google buttons that follow each provider's brand/button guidelines, alongside the phone-OTP option.
- Given I choose a provider and complete its flow for the first time, When the provider returns success, Then PDPA consent (CUS-ONB-04) is required, after which a User with role customer is created and I am signed in.
- Given I cancel or the provider returns an error, When control returns to the app, Then I land back on the auth screen with a Thai error and no partial account is created.
- Given I am on iOS and any third-party social login is offered, When the auth screen renders, Then 'Sign in with Apple' is present (App Store Guideline 4.8).
- Given a returning user signs in with the same provider, When auth succeeds, Then they resume their existing account and no duplicate User is created.
- Given ป้าสมศรี, When provider buttons render, Then each has an accessibilityLabel, is >= 48dp tall, and meets AA contrast against the background.

*Dependencies:* Provider SDKs/credentials: LINE Login channel, Apple Sign In capability, Google OAuth client (per Expo SDK 54 docs), CUS-ONB-04

*Notes:* BLOCKED on which providers ship in v1 and on obtaining credentials (open question). Cross-provider and provider-vs-phone account-merge policy is unresolved. Apple is mandatory on iOS only if another social provider is present.

#### CUS-ONB-06 — Session persistence, auto-login and token refresh  `🔴 MUST`
**As** returning customer, **I want** to stay signed in across app restarts without re-entering an OTP, **so that** shopping is fast and I don't lose my place.

*Acceptance criteria:*
- Given I authenticated successfully, When the session token is issued, Then it is stored in secure device storage (not plain AsyncStorage) and the account tab reflects my real profile instead of the hardcoded placeholder.
- Given a valid stored session, When I relaunch the app, Then I am auto-logged-in without re-entering an OTP and the welcome screen is skipped.
- Given my access token has expired but the refresh token is valid, When I open the app or make a request, Then the session refreshes silently and I stay signed in.
- Given my session is revoked or expired beyond refresh, When I next take an authed action, Then I am cleanly returned to guest state and prompted to sign in again, with no crash and my cart preserved.
- Given secure-storage read fails or the token is tampered, When the app launches, Then it fails safe to guest state without exposing another user's data.
- Given dynamic type / screen reader, When the account screen shows authed vs guest, Then the state is announced and either the sign-in CTA (guest) or the profile (authed) is fully accessible.

*Dependencies:* Secure storage (expo-secure-store per SDK 54), Backend session/token API

*Notes:* Today store/cart.ts and store/mode.ts are in-memory only (no persistence) and account.tsx hardcodes คุณอู้ฟู่ / oofoo@email.com — both must become session-aware.

#### CUS-ONB-07 — Logout  `🔴 MUST`
**As** signed-in customer (including shared-device users), **I want** to log out from the account screen, **so that** my account isn't accessible to whoever uses the phone next.

*Acceptance criteria:*
- Given I am signed in, When I tap 'ออกจากระบบ' on the account screen, Then a Thai confirmation dialog ('ออกจากระบบ?') with Confirm/Cancel appears.
- Given the confirmation, When I confirm, Then the secure session and tokens are cleared, the account tab reverts to the guest state, and I am returned to a browsable guest experience.
- Given I confirm logout, When the session clears, Then the selected ShopMode resets to the default delivery and any authed-only cached data (addresses, order history) is dropped from memory.
- Given I cancel the dialog, When it dismisses, Then I remain signed in with no change.
- Given the logout network call fails, When I confirm, Then the local session is still cleared (fail-safe local logout) and a best-effort server revoke is retried.
- Given ป้าสมศรี, When the logout row renders, Then it keeps its danger styling at AA contrast, exposes accessibilityRole=button with a clear label, and is >= 48dp tall.

*Dependencies:* CUS-ONB-06

*Notes:* The logout row already exists in account.tsx (label 'ออกจากระบบ', danger styling) but only console.logs today. Whether the guest cart is kept or cleared on logout depends on the guest-cart-merge open question.

#### CUS-ONB-08 — Guest browse with auth gate at checkout  `🔴 MUST`
**As** guest shopper, **I want** to fill my cart while browsing and only sign in when I'm ready to pay, **so that** I'm not blocked by signup until it actually matters.

*Acceptance criteria:*
- Given I am a guest, When I browse, add items to the cart, toggle ShopMode (delivery/pickup), and apply a promo code, Then all of that works without authentication.
- Given a guest cart with items, When I tap the checkout CTA ('สั่งซื้อ & จัดส่ง' for delivery or 'ชำระเงินออนไลน์' for pickup), Then I am routed to the auth flow (phone-OTP or social) before any Order is created.
- Given I complete authentication from the gate, When auth succeeds, Then my guest cart, ShopMode, and applied promo are preserved and I am returned to the checkout step I was on (not the home screen).
- Given I cancel or abandon the auth gate, When I go back, Then my cart is intact and I remain a guest.
- Given an empty cart, When I am on the cart tab, Then the existing empty state ('ตะกร้าว่างเปล่า') shows and neither the auth gate nor checkout is reachable.
- Given ป้าสมศรี in pickup mode at the largest dynamic type, When the gated checkout CTA renders, Then it has an accessibilityLabel describing the action, AA contrast, and a >= 48dp height.

*Dependencies:* CUS-ONB-02 or CUS-ONB-05, CUS-ONB-06 (guest/account cart persistence)

*Notes:* BLOCKED by the open payment decision: whether delivery is prepay (promptpay_slip) or pay-on-receipt changes the post-auth checkout copy/flow; COD and a real gateway are not finalized, so this story stops at the Order reaching OrderStatus placed and proceeding to payment selection. Current cart 'Buy Now' just clears the cart and shows an Alert with NO auth — that placeholder must be replaced. Guest-to-account cart-merge rule is an open question. Enum mismatch to resolve: code uses ShopMode value 'online' while the canonical enum is pickup.

### CUS-PROFILE — Account, Profile & Addresses
> A logged-in customer can view and edit their profile, manage multiple labelled delivery addresses (with map pin, notes and a single default), and exercise their PDPA rights to view, export and delete their personal data — all accessible to both น้องแนน and ป้าสมศรี.

#### CUS-PROFILE-01 — View my account & profile hub  `🔴 MUST`
**As** logged-in customer (Roles: customer) — both น้องแนน and ป้าสมศรี, **I want** open the บัญชีของฉัน tab and see my avatar, display name, auth identity (phone/email) and a menu to reach my profile, addresses, orders, privacy and sign-out, **so that** I have one predictable place to manage everything about my account.

*Acceptance criteria:*
- Given I am logged in, When I open the บัญชีของฉัน tab, Then I see my avatar, display name, and my auth identity (phone shown as 0XX-XXX-XXXX; email shown if a social/email identity is linked).
- Given the account screen, When it renders, Then it shows menu rows: ข้อมูลส่วนตัว, ที่อยู่จัดส่ง, ประวัติการสั่งซื้อ, รายการโปรดที่บันทึก, ความเป็นส่วนตัว & ข้อมูล (PDPA), ศูนย์ช่วยเหลือ, and ออกจากระบบ (rendered in the danger color).
- Given I have not uploaded an avatar, When the screen loads, Then a default placeholder avatar (initials) is shown and no broken-image icon appears.
- Given the profile fetch fails (offline/server error), When the screen loads, Then an inline error state with a 'ลองใหม่' retry is shown; any cached profile is shown read-only meanwhile and the app does not crash.
- Given I tap ออกจากระบบ, When I confirm, Then my session is cleared and I land on the sign-in entry (actual session teardown owned by CUS-AUTH).
- Given I am NOT logged in (edge), When I open the tab, Then a sign-in prompt is shown instead of profile data (no crash, no placeholder identity).
- a11y (ป้าสมศรี): every icon button (notifications, settings, edit-pencil) exposes a Thai accessibilityLabel; each menu row is exposed to the screen reader with accessibilityRole=button and its Thai label.
- a11y: all text honours OS dynamic-type scaling without truncation or clipping, every text/label meets WCAG AA contrast (the legacy muted gray #9B9B9B is not used for any meaningful text), and each menu-row touch target is ≥ 44×44 pt.

*Dependencies:* CUS-AUTH (identity, login/guest state, logout), CUS-ORDERS (ประวัติการสั่งซื้อ entry), existing app/(tabs)/account.tsx

*Notes:* Grounds the existing account.tsx screen (display name 'คุณอู้ฟู่', avatar + edit pencil, Thai menu rows). Adds a dedicated PDPA row and an explicit ที่อยู่จัดส่ง row not present today. Logout AC is thin here; full auth/session behaviour is CUS-AUTH. Fixes A11Y-1 (missing accessibilityLabel) and A11Y-2 (#9B9B9B fails AA) for this surface.

#### CUS-PROFILE-02 — Edit my profile details (name, avatar, email)  `🔴 MUST`
**As** logged-in customer, **I want** edit my display name, profile photo and email, **so that** my orders, receipts and rider hand-off show the correct name and contact.

*Acceptance criteria:*
- Given the ข้อมูลส่วนตัว edit screen, When I change my display name and tap บันทึก, Then it persists and the account header immediately reflects the new name.
- Given I tap the edit-avatar control, When I pick a photo from library or take one with the camera, Then it uploads with a visible progress indicator and replaces the avatar; tapping ยกเลิก leaves the previous avatar unchanged.
- Given an empty display name, When I try to save, Then an inline error 'กรุณากรอกชื่อ' is shown and บันทึก stays disabled until the form is valid.
- Given an invalid email format, When I edit the email, Then an inline error 'อีเมลไม่ถูกต้อง' is shown and save is blocked.
- Given I attempt to change my phone number (the auth identity), When I submit the new number, Then OTP re-verification is required and the old number remains active until the new one is verified.
- Given the save request fails, When I tap บันทึก, Then a non-destructive error message is shown, the form keeps everything I typed, and I can retry without re-entering data.
- Given I deny camera/photo-library permission, When I try to change the avatar, Then a clear Thai explanation with a path to Settings is shown and the rest of the form still works.
- a11y (ป้าสมศรี): all fields and the edit-avatar control have Thai labels, inputs and the save button are ≥ 44 pt tall and grow with dynamic type, error text meets WCAG AA contrast, and upload progress/result is announced to the screen reader.

*Dependencies:* CUS-PROFILE-01, CUS-AUTH (OTP for phone change)

*Notes:* Avatar/photo and email are personal data under PDPA — capture/storage must stay within the consent scope from signup. Open question: is changing the phone identity allowed at all in v1, or locked (see openQuestions). Avatar storage location/size/type limits TBD.

#### CUS-PROFILE-03 — Manage my delivery addresses (label, recipient, notes)  `🔴 MUST`
**As** logged-in customer who uses ShopMode delivery (น้องแนน), **I want** add, edit and delete multiple delivery addresses, each with a label, recipient name + phone, full Thai address and an optional delivery note, **so that** I can keep home/work addresses ready and tell the rider exactly where to drop off.

*Acceptance criteria:*
- Given I have no saved addresses, When I open ที่อยู่จัดส่ง, Then a friendly empty state with a 'เพิ่มที่อยู่' call-to-action is shown (no blank list).
- Given the add-address form, When I fill the required fields (label, recipient name, recipient phone, address line, แขวง/ตำบล, เขต/อำเภอ, จังหวัด, รหัสไปรษณีย์) and tap บันทึก, Then the address is saved and appears in my address list.
- Given the label field, When I create an address, Then I can pick a quick label chip บ้าน or ที่ทำงาน or type a custom label, and I can add an optional note (e.g. 'ฝากไว้ที่ รปภ. ตึก A ชั้น 1').
- Given an existing address, When I edit any field and save, Then the changes persist; When I tap delete, Then a confirmation dialog appears and the address is removed only after I confirm.
- Given required fields are empty or invalid, When I save, Then inline errors are shown per field; รหัสไปรษณีย์ must be exactly 5 digits and recipient phone must be a valid Thai mobile number.
- Given ShopMode is pickup (codebase alias 'online'), When I place that order, Then a delivery address is NOT required — addresses apply to the delivery flow only.
- Given a save or delete request fails (offline/server), When I submit, Then an error with retry is shown and no partial/duplicate address is created.
- a11y (ป้าสมศรี): every input has a visible Thai label (not placeholder-only), inputs and the delete/confirm controls are ≥ 44 pt and scale with dynamic type, all text meets WCAG AA contrast, and the delete confirmation dialog is fully operable by screen reader.

*Dependencies:* CUS-PROFILE-01

*Notes:* Maps to the canonical Address entity. Default-address behaviour is CUS-PROFILE-05; map pin is CUS-PROFILE-04 (an address is fully usable with text only). Open question: free-text address vs structured Thai dataset with จังหวัด/อำเภอ/ตำบล + postal autofill (see openQuestions).

#### CUS-PROFILE-04 — Pin an address location on a map  `🟠 SHOULD`
**As** logged-in customer, **I want** drop and adjust a map pin (optionally from my current GPS location) for a delivery address, **so that** the shop's own rider can find my home accurately.

*Acceptance criteria:*
- Given the add/edit address form, When I tap 'ปักหมุดบนแผนที่', Then a map opens centred on a best-guess location and I can drag the pin and tap ยืนยัน to save its lat/lng with the address.
- Given I tap 'ใช้ตำแหน่งปัจจุบัน' and grant location permission, When the fix is acquired, Then the pin snaps to my current location.
- Given I deny location permission or GPS is unavailable, When I open the map, Then a graceful fallback keeps the manual text address, shows guidance, and the address is still saveable without a pin (no crash).
- Given the OS 'reduce motion' setting is on, When the map pans/zooms, Then no auto-animated camera movement is used (respects WCAG 2.2.2 / reduced-motion).
- a11y (ป้าสมศรี): pin and confirm controls have Thai accessibilityLabels and are ≥ 44 pt, and the selected location is also summarised as readable text for screen-reader users so it is not map-only.

*Dependencies:* CUS-PROFILE-03, RID-DELIVERY (rider app consumes the lat/lng for routing)

*Notes:* Saved lat/lng feeds the rider app. Open question: map provider (Google/Apple/OSM) and whether precise lat/lng is actually required for v1 rider routing or text address is enough (see openQuestions). Mirrors reduced-motion debt A11Y-5 from the banner.

#### CUS-PROFILE-05 — Set a default delivery address  `🔴 MUST`
**As** logged-in customer (น้องแนน wants a 2-minute checkout), **I want** mark exactly one address as my default, **so that** delivery checkout preselects it and I don't re-pick every time.

*Acceptance criteria:*
- Given I have at least one address, When I set an address as default, Then it is flagged 'ค่าเริ่มต้น' and any previous default is unset, so exactly one default exists at all times.
- Given I add my very first address, When it is saved, Then it automatically becomes the default.
- Given I delete the default address, When the deletion completes, Then the next available address is promoted to default; if none remain, there is no default and checkout falls back to the add-address flow.
- Given ShopMode is delivery and a default exists, When I reach checkout, Then the default address is preselected and remains changeable before I confirm.
- Given ShopMode is pickup (alias 'online'), When I check out, Then the default delivery address is ignored (no address needed).
- a11y (ป้าสมศรี): the default state is conveyed with text + accessibilityState selected (not colour alone), and the 'ค่าเริ่มต้น' badge meets WCAG AA contrast.

*Dependencies:* CUS-PROFILE-03, CUS-CHECKOUT/cart (consumes the preselected default)

*Notes:* Checkout preselection is the integration point for CUS-CHECKOUT; this story owns the data rule (single default + promotion on delete). Pickup mode (delivery-fee waived, paid up-front) does not use an address.

#### CUS-PROFILE-06 — View my consent and request a copy of my data (PDPA)  `🔴 MUST`
**As** logged-in customer, **I want** see what personal data อู้ฟู่ stores, review the consent I gave at signup, and request a copy/export of my data, **so that** I stay in control of my personal data as required by PDPA.

*Acceptance criteria:*
- Given the ความเป็นส่วนตัว & ข้อมูล screen, When it opens, Then it shows the consent I gave at signup (purpose, date, policy version) plus links to นโยบายความเป็นส่วนตัว and ข้อกำหนดการใช้งาน.
- Given an optional consent (e.g. marketing push notifications), When I withdraw or re-grant it, Then the change takes effect, is recorded with a timestamp, and the screen explains which processing is mandatory to fulfil my orders and cannot be withdrawn while using the service.
- Given I tap 'ขอสำเนาข้อมูลของฉัน', When I confirm, Then a data export (profile, addresses, order history) is generated and delivered in-app/by email, and the expected response timeframe is shown.
- Given I already have a pending export request, When I request again, Then the existing request status is shown and a duplicate request is prevented.
- a11y (ป้าสมศรี): all policy/legal text scales with OS dynamic type, is scrollable, meets WCAG AA contrast, and links/buttons carry Thai accessibilityLabels and are ≥ 44 pt.

*Dependencies:* CUS-AUTH (PDPA consent captured at signup), CUS-PROFILE-01

*Notes:* PDPA is a hard legal constraint. Exact export/access response SLA and which data categories are included need legal/DPO sign-off (see openQuestions). Withdrawing marketing consent ties into the Notification entity.

#### CUS-PROFILE-07 — Delete my account and data (PDPA right to erasure)  `🔴 MUST`
**As** logged-in customer, **I want** request deletion of my account and personal data, **so that** I can exercise my PDPA right to be forgotten.

*Acceptance criteria:*
- Given the ความเป็นส่วนตัว & ข้อมูล screen, When I tap 'ลบบัญชีและข้อมูล', Then I see a clear Thai explanation of the consequences and irreversibility, plus a re-authentication step (OTP / re-login) before the request is accepted.
- Given I have an active order — OrderStatus is any non-terminal state (i.e. NOT one of delivered, picked_up, cancelled, payment_rejected, delivery_failed) including PaymentStatus verifying / awaiting_payment / slip_uploaded — When I request deletion, Then the request is blocked with a message asking me to wait until those orders complete, listing the blocking order(s).
- Given I have no active orders, When I confirm deletion, Then the request is scheduled, I am logged out, and my personal data is erased per the retention policy; the screen discloses that some records may be retained for legal/financial obligations.
- Given the deletion request fails (offline/server), When I confirm, Then an error with retry is shown and my account remains unchanged.
- a11y (ป้าสมศรี): the destructive action uses a danger colour that still passes WCAG AA and is paired with a text label (not colour alone), the confirm dialog is screen-reader operable, and all controls are ≥ 44 pt and scale with dynamic type.

*Dependencies:* CUS-AUTH (re-auth/OTP, session teardown), CUS-ORDERS (active-order check), CUS-PROFILE-06

*Notes:* Active-order guard uses the canonical OrderStatus and PaymentStatus enums verbatim. Open question: does deletion anonymise past orders (to preserve the shop's financial records) or hard-delete, and what is the cancel/grace window — needs legal/DPO + finance sign-off (see openQuestions).

#### CUS-PROFILE-08 — View payment-channel info in my account (blocked by payment decision)  `🟡 COULD`
**As** logged-in customer, **I want** open the ช่องทางชำระเงิน entry in my account and understand how I pay, **so that** I know what to expect at checkout.

*Acceptance criteria:*
- Given PaymentMethod in v1 is promptpay_slip only, When I open ช่องทางชำระเงิน, Then I see informational content explaining the PromptPay QR + upload-slip + admin-verification flow, with no stored card or bank account.
- Given no payment gateway exists in v1, When I view this screen, Then there is NO 'add/save payment method' management UI (saved gateway methods and cod are explicitly out of scope until the payment decision is resolved).
- a11y (ป้าสมศรี): the informational text scales with dynamic type, meets WCAG AA contrast (the orange #F5821F is not used as low-contrast body/total text — A11Y-4), and any icon buttons carry Thai accessibilityLabels.

*Dependencies:* CUS-PROFILE-01

*Notes:* BLOCKED / informational-only because the payment model is undecided. The account already surfaces a ช่องทางชำระเงิน row, so v1 keeps it read-only. Saved-payment-method management (PaymentMethod future values gateway, cod) and whether delivery is prepay vs pay-on-receipt are open questions — do not build saved-method storage until resolved.

### CUS-BROWSE — Home / Discover
> Give อู้ฟู่ customers a fast, accessible Home that lets them recognize the shop and its open/closed status, browse rotating promotions, filter by category, and discover featured products within their chosen ShopMode.

#### CUS-BROWSE-01 — Shop / branch header with open-closed status and quick entry points  `🔴 MUST`
**As** customer (Role: customer) opening the app, **I want** a Home header that shows the อู้ฟู่ shop identity, the current open/closed status, and quick access to notifications and my cart, **so that** I know I am in the right shop, whether it is open right now, and can reach my cart in one tap.

*Acceptance criteria:*
- Given I open Home as a customer, When the screen finishes loading, Then the header shows the อู้ฟู่ brand logo/name, a shop status badge derived from the shop's configured opening hours, a notifications icon button, and a cart icon button (grounds: ScreenHeader brand + IconButton notifications-outline/bag-outline in index.tsx).
- Given the current time is within configured opening hours, When I view the header, Then the status reads "เปิดอยู่" together with the next closing time (e.g. "เปิดอยู่ · ปิด 21:00").
- Given the current time is outside opening hours, When I view the header, Then the status reads "ปิดแล้ว" with the next opening time, and browsing the catalog is still permitted (the closed state must not blank the screen).
- Given opening-hours data fails to load or is missing, When the header renders, Then no false "เปิดอยู่" claim is shown; the status falls back to a neutral/hidden state and the rest of the header still renders.
- Given I tap the cart icon button, Then I navigate to /cart.
- Given the cart has N items, When the header renders, Then the cart icon shows a badge with N and the badge count is included in the icon's accessibility label.
- Given a screen reader is active, Then each icon button exposes a descriptive Thai accessibilityLabel (e.g. "การแจ้งเตือน", "ตะกร้าสินค้า, 3 ชิ้น") and accessibilityRole button, with a touch target of at least 44x44pt (WCAG AA / baseline debt).

*Dependencies:* Shop opening-hours config (ADMIN settings), Notifications destination (notifications epic), Cart store (store/cart.ts)

*Notes:* Baseline debt: current IconButtons use empty onPress and have no accessibilityLabel. Open: is there >1 branch/pickup location, or a single shop only? That determines whether 'branch' content (name/address) appears here vs only in pickup context.

#### CUS-BROWSE-02 — Auto-rotating hero promo banner (happy path)  `🔴 MUST`
**As** busy customer น้องแนน (P1, delivery), **I want** an auto-rotating hero banner carousel of current promotions with a tappable CTA, **so that** I quickly spot deals like free delivery or discounts without hunting through the catalog.

*Acceptance criteria:*
- Given Home loads with one or more active banners, When the banner renders, Then the first slide shows its image, Thai headline, and a "ช้อปเลย" CTA, with page-indicator dots reflecting the slide count and the active index (grounds: BANNER_SLIDES + dots in index.tsx).
- Given there are multiple banners and reduced-motion is OFF, When I leave the banner untouched, Then it auto-advances to the next slide approximately every 2000ms (BANNER_INTERVAL) and wraps from the last slide back to the first.
- Given I swipe the banner horizontally, Then it pages to the next/previous slide and the active dot updates to match.
- Given I tap the "ช้อปเลย" CTA on a slide, Then I am taken to that banner's configured target (promo collection / category / product).
- Edge: Given exactly one active banner, Then no auto-rotation occurs and the dots are hidden (single static slide).
- Empty: Given there are zero active banners, Then the hero region is omitted entirely with no empty box or layout gap, and the rest of Home renders normally.
- Error: Given a banner image fails to load, Then a branded placeholder/tint (Colors.primaryTint) is shown behind the headline and the carousel stays functional.
- Edge: Given the banner width is not yet measured at first paint (bannerWidth = 0), Then auto-rotation does not start until layout is measured (no flicker or jump).

*Dependencies:* Banner content source (ADMIN merchandising / CMS), CUS-BROWSE-03 (reduced-motion + pause behavior)

*Notes:* Currently the "ช้อปเลย" CTA is a no-op (onPress={() => {}}) — link targets are unknown (see open questions). Banners are hardcoded BANNER_SLIDES today; v1 should make them admin-managed.

#### CUS-BROWSE-03 — Hero banner respects reduced-motion and can be paused  `🔴 MUST`
**As** customer sensitive to motion / using assistive settings (ป้าสมศรี, P2), **I want** the hero banner to honor the OS reduce-motion setting and let me pause it, **so that** moving content does not distract or disorient me and I have time to read each slide.

*Acceptance criteria:*
- Given the OS "Reduce Motion" setting is ON, When Home loads, Then the banner does NOT auto-advance; slides change only by my own swipe, and slide transitions avoid animated motion (instant or cross-fade per platform guidance).
- Given reduced-motion is OFF and the banner is auto-rotating, When I touch, press-and-hold, or begin dragging the banner, Then auto-advance pauses immediately; When I release and an idle period passes, Then auto-advance may resume.
- Given a screen reader (VoiceOver/TalkBack) is active, When focus enters the banner, Then auto-advance is paused so the reader can announce the current slide without content changing underneath.
- Given reduced-motion is ON, Then the page-indicator dots still update to reflect the manually selected slide.
- Given the reduce-motion setting is toggled while Home is open, When it changes, Then the banner starts/stops auto-advancing without an app restart.
- a11y: each slide's headline and CTA are readable by the screen reader; the CTA accessibilityLabel includes the promo intent (e.g. "ช้อปเลย, <headline>"); dots are hidden from the reader or summarized as "หน้า X จาก Y".

*Dependencies:* CUS-BROWSE-02 (banner carousel)

*Notes:* Explicit baseline debt: index.tsx runs setInterval unconditionally with no AccessibilityInfo.isReduceMotionEnabled check and no pause-on-touch. This is the highest-priority a11y gap for the banner.

#### CUS-BROWSE-04 — Category chips filter the discovery list  `🔴 MUST`
**As** customer browsing the shop, **I want** a row of category chips to filter what is shown on Home, **so that** I can quickly narrow to ของสด, เครื่องดื่ม, etc..

*Acceptance criteria:*
- Given Home loads, Then a horizontally scrollable chip row shows ทั้งหมด, ของสด, เครื่องดื่ม, ของแห้ง, ของใช้ในบ้าน, ขนม with ทั้งหมด selected by default (grounds: categories + Chip row in index.tsx).
- Given I tap a category chip, Then that chip enters the active/selected state and the product list updates to show only products whose ProductCategory matches; ทั้งหมด shows all products.
- Empty: Given I select a category that currently has no products, Then a friendly empty state is shown (e.g. "ไม่พบสินค้าในหมวดนี้") rather than a blank area.
- Edge: Given both a search query and a category are active, Then results must match BOTH (category AND name/subtitle contains the query), consistent with the existing filter logic.
- a11y: each chip has accessibilityRole button, exposes its selected state via accessibilityState={{ selected: true }}, and uses the category name as its label.
- a11y (WCAG AA): both the selected and unselected chip styles meet AA contrast, and the touch target is at least 44x44pt.
- a11y (ป้าสมศรี): chip labels scale with dynamic type and the row stays horizontally scrollable without clipping when text is enlarged.

*Dependencies:* data/products.ts catalog shape, Search ownership (separate search epic)

*Notes:* Search filtering is wired into the same grid today via SearchBar; confirm whether search is owned here or by a separate CUS-SEARCH epic (open question).

#### CUS-BROWSE-05 — Discovery list loading, empty, and error states  `🔴 MUST`
**As** customer on a real network, **I want** the product discovery list to clearly show loading, empty, and error states, **so that** I am never staring at a blank screen and can recover from failures.

*Acceptance criteria:*
- Given products are loading, Then skeleton placeholders render in the 2-column grid layout (matching the ~47.5% gridCell width) until data resolves.
- Given products load successfully, Then they render in a 2-column grid of ProductCards respecting the active category/search filters.
- Empty: Given the active filter yields no products, Then a friendly empty state with "ไม่พบสินค้าที่ค้นหา" and an option to clear filters is shown (grounds: existing empty copy in index.tsx).
- Error: Given the catalog request fails, Then an error state with Thai copy and a "ลองใหม่" retry control is shown; tapping retry re-requests the catalog.
- Edge: Given the device is offline, Then the last cached catalog is shown if available; otherwise the error/retry state appears, optionally with a subtle offline indicator.
- a11y: loading skeletons are hidden from the screen reader or announced as "กำลังโหลด"; the retry control has a descriptive accessibilityLabel and accessibilityRole button.

*Dependencies:* Remote catalog API (ADMIN catalog), CUS-BROWSE-04 (filter interaction)

*Notes:* Current code uses a static in-memory `products` array with no async/loading/error path. Whether the v1 catalog is remote (async) is an open question that gates this story's scope.

#### CUS-BROWSE-06 — Curated featured sections on Home  `🟠 SHOULD`
**As** customer who likes recommendations, **I want** curated Home sections (e.g. แนะนำ / ของสดใหม่ทุกวัน / ลดราคา) with horizontal product rows, **so that** I discover highlighted products without scrolling the entire catalog.

*Acceptance criteria:*
- Given Home loads with curated sections configured, Then each section shows a Thai title and a horizontally scrollable row of ProductCards.
- Given I tap a product within a section, Then I navigate to that product's detail screen.
- Given a section has a "ดูทั้งหมด" link, When I tap it, Then I see the full list for that section/category.
- Empty: Given a configured section currently has no products, Then that section is omitted (never shown empty).
- Edge: Given a category filter chip is active, Then curated sections collapse and the filtered flat grid is shown instead (sections appear only in the unfiltered ทั้งหมด view).
- a11y: section titles are exposed with accessibilityRole header; horizontal rows are reachable and swipeable by the screen reader; cards scale with dynamic type and meet AA contrast.

*Dependencies:* ADMIN merchandising (which products are featured), CUS-BROWSE-04 (filter interaction)

*Notes:* Forward-looking: today Home renders a single flat grid only, no sections. Section membership is admin-managed. Reuse existing Thai banner copy themes (e.g. ของสดใหม่ทุกวัน) where appropriate.

#### CUS-BROWSE-07 — Home reflects the selected ShopMode (delivery | pickup)  `🟠 SHOULD`
**As** customer choosing how to receive the order (น้องแนน delivery, ป้าสมศรี pickup), **I want** Home to reflect my chosen ShopMode and adjust the discovery context accordingly, **so that** what I see matches whether the shop will deliver to me or I will pick up at the store.

*Acceptance criteria:*
- Given the ShopMode switch is shown on Home, Then it offers exactly the two canonical modes delivery and pickup, with the selected one visually indicated and persisted across screens via the shared mode store.
- Given ShopMode = delivery, Then Home may surface a free-delivery hint reflecting the real numbers (ส่งฟรีเมื่อสั่งครบ 200฿; ค่าจัดส่ง 40฿ below the threshold), consistent with deliveryFeeFor in store/mode.ts.
- Given ShopMode = pickup, Then no delivery-fee messaging is shown, and (if applicable) the pickup branch/location is referenced.
- Given I change ShopMode on Home, Then the change is reflected immediately on Home and downstream (e.g. cart summary) without a reload.
- Edge: Given ShopMode = delivery and the customer has no saved Address yet, Then delivery context still renders generically (Address is collected at checkout, not on Home).
- a11y: mode-switch controls have accessibilityRole button, expose selected state via accessibilityState, use descriptive Thai labels, meet AA contrast, and have >=44pt targets.

*Dependencies:* store/mode.ts (ShopMode + deliveryFeeFor), CUS-BROWSE-01 (header for pickup branch reference)

*Notes:* BLOCKED/flag: canonical ShopMode is `pickup` but store/mode.ts currently uses `online` (label ออนไลน์) — code must be reconciled to `delivery | pickup`. BLOCKED by the open payment decision: Home must NOT state whether delivery is prepay (promptpay_slip) or pay-on-receipt/COD until that decision is finalized.

#### CUS-BROWSE-08 — Home accessibility baseline (large text, contrast, targets, labels)  `🔴 MUST`
**As** ป้าสมศรี (P2, elderly, pickup; needs large text, high contrast, big touch targets), **I want** the whole Home screen to support large dynamic type, AA contrast, big touch targets, and labeled controls, **so that** I can read and operate Home comfortably.

*Acceptance criteria:*
- Given I set the OS text size to the largest dynamic-type setting, When I open Home, Then all text (header, banner headline, chips, section titles, product names/prices, empty/error copy) scales without truncation that hides meaning, and layouts reflow without overlapping or clipped text.
- Given WCAG AA, Then every text/icon foreground vs background combination on Home meets >=4.5:1 for normal text and >=3:1 for large text and UI components, including banner text over imagery (the scrim/overlay must guarantee this).
- Given every icon-only control on Home (notifications, cart, search filter, banner CTA), Then each exposes a descriptive Thai accessibilityLabel and accessibilityRole button.
- Given any interactive target (chips, mode switch, icon buttons, CTA), Then each has a touch target of at least 44x44pt even when visually smaller.
- Given a screen reader, When I traverse Home, Then focus order is logical (header -> search -> mode -> banner -> categories -> sections/grid) and decorative elements (banner dots, overlay scrim) are not focusable.
- Edge: Given banner headline text sits over a light region of an image, Then contrast remains compliant (e.g. via overlay scrim) and is verified at the largest text size.

*Dependencies:* CUS-BROWSE-01, CUS-BROWSE-02, CUS-BROWSE-04, Design tokens (theme/colors.ts, constants/theme.ts)

*Notes:* Consolidates baseline debt: WCAG AA contrast, accessibilityLabel on icon buttons, dynamic-type support. Reduced-motion for the banner is split into CUS-BROWSE-03. The search filter button (options-outline) is currently a no-op with no label.

### CUS-SEARCH — Search, Filter & Sort
> Let customers find อู้ฟู่ products fast via Thai text search, category filtering and sorting, with clear empty/error states and recent searches — accessible to elderly users like ป้าสมศรี.

#### CUS-SEARCH-01 — Thai free-text product search  `🔴 MUST`
**As** customer (Roles: customer) such as น้องแนน, **I want** to type a Thai (or mixed Thai/Latin) term and see matching shop products, **so that** I can find what I need without scrolling the whole catalog.

*Acceptance criteria:*
- Given the customer is on the Search tab with an empty query, When the screen loads, Then the full catalog renders in the 2-column grid with no filtering applied.
- Given the search field shows placeholder 'ค้นหาสินค้า', When the customer types 'นม' and input settles for the 300ms debounce, Then only products whose name OR subtitle contains the substring 'นม' are shown (e.g. 'นมจืด UHT 1 ลิตร').
- Given a mixed-script query 'uht', When applied, Then matching is case-insensitive for Latin characters so 'นมจืด UHT 1 ลิตร' matches.
- Given Thai text has no word boundaries, When the customer types a partial token 'บะหมี่', Then substring matching returns 'บะหมี่กึ่งสำเร็จรูป (แพ็ค 6)'.
- Given a query with leading/trailing whitespace '  ไข่  ', When applied, Then the query is trimmed before matching and returns 'ไข่ไก่สด (แผง 30 ฟอง)'.
- Given text is present in the field, When the customer taps the clear (X) control, Then the query resets to empty and the full grid returns.
- Given a query that matches no product, When applied, Then the empty-results state from CUS-SEARCH-05 is shown instead of an empty grid.
- Given an icon-only clear (X) control, When inspected by a screen reader, Then it exposes accessibilityLabel 'ล้างคำค้นหา' and the input exposes an accessibilityLabel (a11y baseline debt).

*Notes:* Grounded in /Users/mewwi/dev/my-rn-app/app/(tabs)/search.tsx (matches name+subtitle via lowercased includes) and /Users/mewwi/dev/my-rn-app/components/ui/searchbar.tsx (300ms debounce, clear button). V1 scope = name+subtitle only (matches current code). OPEN: whether to also search product.description and category synonyms — Thai shoppers often search by qualities/brand that only appear in description (see openQuestions). Results are identical across ShopMode delivery and pickup in v1 (single shop, single catalog). Thai normalization (tone marks, zero-width chars, Thai vs Arabic numerals, typo tolerance) is NOT in v1 — exact substring only (flagged in openQuestions).

#### CUS-SEARCH-02 — Category filter chips  `🔴 MUST`
**As** customer (Roles: customer), **I want** to tap a category chip to narrow the catalog to one product category, **so that** I can browse just the kind of item I'm after (e.g. drinks).

*Acceptance criteria:*
- Given the chip row [ทั้งหมด, ของสด, เครื่องดื่ม, ของแห้ง, ของใช้ในบ้าน, ขนม], When the screen loads, Then 'ทั้งหมด' (All) is selected by default and all products show.
- Given the customer taps 'เครื่องดื่ม', When applied, Then only products with category 'เครื่องดื่ม' show (e.g. 'นมจืด UHT 1 ลิตร', 'น้ำดื่ม') and exactly one chip is selected at a time (single-select).
- Given a chip is selected, When rendered, Then it shows the active state (coral fill, white text per Chip component) and inactive chips show white-with-border.
- Given both a text query and an active category, When applied, Then results must satisfy BOTH conditions (category AND text combine).
- Given an active non-'ทั้งหมด' category, When the customer re-selects 'ทั้งหมด', Then the category filter is cleared and all products (still subject to any text query) show.
- Given a category + text combination yields zero products, When applied, Then the empty-results state from CUS-SEARCH-05 is shown.
- Given the persona ป้าสมศรี and a screen reader, When focused on a chip, Then it exposes accessibilityRole='button' and accessibilityState.selected, and the selected chip is announced.
- Given ป้าสมศรี (large touch targets are a requirement), When chips render, Then each chip's touch target is >=44x44pt (current Chip height is 40px and MUST be raised) and chip text meets WCAG AA contrast.

*Dependencies:* CUS-SEARCH-01

*Notes:* Categories enum from /Users/mewwi/dev/my-rn-app/data/products.ts (Chip in components/ui/Chip.tsx already sets accessibilityRole + accessibilityState.selected — good). 'ทั้งหมด' is the All sentinel, not a real Product.category. Touch-target debt: Chip is 40px tall today.

#### CUS-SEARCH-03 — Sort results by price  `🟠 SHOULD`
**As** customer (Roles: customer) such as ป้าสมศรี watching her budget, **I want** to sort the visible results by price low-to-high or high-to-low, **so that** I can find the cheapest (or premium) option quickly.

*Acceptance criteria:*
- Given the customer is on the Search tab, When they tap the sort/options control (the existing 'options-outline' icon next to the search bar), Then a sort sheet/menu opens with: 'แนะนำ' (default catalog order), 'ราคาน้อยไปมาก' (price ascending), 'ราคามากไปน้อย' (price descending).
- Given 'ราคาน้อยไปมาก' is selected, When applied, Then the currently filtered results are ordered ascending by product.price, with stable ordering for equal prices.
- Given 'ราคามากไปน้อย' is selected, When applied, Then results are ordered descending by product.price.
- Given a sort is active, When the customer changes the text query or category, Then the chosen sort persists for the session and re-applies to the new result set.
- Given a sort other than 'แนะนำ' is active, When the sheet is open, Then the active option is visibly indicated as selected.
- Given prices are shown, When results render, Then prices use the existing money() formatter (e.g. '฿165') so sorting and display stay consistent.
- Given the icon-only sort trigger (currently has no accessibilityLabel), When inspected by a screen reader, Then it exposes accessibilityLabel 'จัดเรียงสินค้า', each option is reachable, the selected option is announced, and each option row is >=44x44pt for ป้าสมศรี.

*Dependencies:* CUS-SEARCH-01

*Notes:* The 'options-outline' Pressable in app/(tabs)/search.tsx is currently a no-op (onPress => {}) and has NO accessibilityLabel — this story wires it up and fixes that a11y debt. money() lives in /Users/mewwi/dev/my-rn-app/lib/format.ts. Sort is independent of ShopMode and of payment.

#### CUS-SEARCH-04 — Sort results by popularity  `🟡 COULD`
**As** customer (Roles: customer), **I want** to sort results by how popular/best-selling items are, **so that** I can trust the shop's bestsellers when I'm unsure what to pick.

*Acceptance criteria:*
- Given the popularity metric is defined (see openQuestions), When the customer opens the sort sheet, Then it includes an additional option 'ยอดนิยม' (popularity).
- Given 'ยอดนิยม' is selected, When applied, Then the currently filtered results are ordered by the agreed popularity metric in descending order, with stable ordering for ties.
- Given 'ยอดนิยม' is active, When the customer changes query/category, Then the popularity sort persists and re-applies (consistent with CUS-SEARCH-03).
- Given a screen-reader user, When the sort sheet is open, Then 'ยอดนิยม' is reachable and its selected state is announced.

*Dependencies:* CUS-SEARCH-03

*Notes:* BLOCKED on data, not on payment: Product (data/products.ts) has NO sales/popularity field — only rating (0..5). v1 cannot truthfully sort by popularity until a metric is agreed (sales volume vs rating proxy vs admin-curated ranking). Do NOT assume rating==popularity. Kept as 'could' and contingent; see openQuestions.

#### CUS-SEARCH-05 — Empty / no-results state with recovery  `🔴 MUST`
**As** customer (Roles: customer), **I want** a clear message and an easy way to recover when my search/filter finds nothing, **so that** I'm not stuck on a blank screen and can try again.

*Acceptance criteria:*
- Given any combination of text query + category + sort that yields zero products, When applied, Then the empty state renders with the large search icon, title 'ไม่พบสินค้าที่ค้นหา', and body 'ลองค้นหาด้วยคำอื่นหรือเลือกหมวดหมู่อื่นดูนะคะ'.
- Given the empty state is shown, When the customer taps a 'ล้างตัวกรอง' (clear filters) action, Then the query resets to empty, the category resets to 'ทั้งหมด', the sort resets to 'แนะนำ', and the full grid returns.
- Given keyboard is open over the grid, When the customer taps the clear/recovery action, Then the tap is honored (keyboardShouldPersistTaps='handled') and not swallowed by keyboard dismissal.
- Given a screen-reader user (incl. ป้าสมศรี), When results change to zero, Then the no-results message is announced (accessibilityLiveRegion/announceForAccessibility) rather than silently swapping the grid.
- Given the empty-state icon is decorative, When inspected by a screen reader, Then it is either marked importantForAccessibility='no'/accessibilityElementsHidden or given a meaningful label — it MUST NOT be an unlabeled, disabled icon button (current a11y debt).

*Dependencies:* CUS-SEARCH-01, CUS-SEARCH-02

*Notes:* Exact copy reused from app/(tabs)/search.tsx. Current empty state uses a disabled IconButton with no accessibilityLabel — fix it. 'ล้างตัวกรอง' recovery button does not exist yet and must be added. Distinct from the catalog-load error state in CUS-SEARCH-08 (no-match vs load-failure wording must differ).

#### CUS-SEARCH-06 — Recent searches  `🟠 SHOULD`
**As** customer (Roles: customer) such as น้องแนน who re-orders staples, **I want** to see and re-tap my recent search terms, **so that** I can repeat a frequent search without retyping Thai text.

*Acceptance criteria:*
- Given the customer has submitted searches before, When the search field is focused and empty, Then a 'ค้นหาล่าสุด' section lists recent terms, most-recent-first, de-duplicated, capped at a max (e.g. 8).
- Given the recent list is shown, When the customer taps a term, Then that term populates the field and re-runs the search (reusing CUS-SEARCH-01 behavior).
- Given a recent term row, When the customer taps its remove (X) control, Then only that term is removed from history and the list updates.
- Given the recent list has items, When the customer taps 'ล้างทั้งหมด', Then all recent searches are cleared and the section disappears.
- Given a brand-new user with no history (or after clearing), When the field is focused and empty, Then the recent-searches section is not shown (no empty placeholder clutter).
- Given a term is committed (on submit / when results are viewed), When stored, Then it is saved at most once and persists across app restarts on-device.
- Given the persona ป้าสมศรี, When recent items render, Then each item and its remove control are >=44x44pt, labelled for screen readers, and text meets WCAG AA contrast.

*Dependencies:* CUS-SEARCH-01

*Notes:* No recent-search persistence exists today. PDPA: search history is personal data — it must be stored locally by default, included in account-data deletion, and clearable via 'ล้างทั้งหมด'. Do NOT sync history to the server without explicit consent (open). The SearchBarWithSuggestions component in components/ui/searchbar.tsx is a possible UI base but is suggestion-driven, not history-driven.

#### CUS-SEARCH-07 — Accessible search & filtering for ป้าสมศรี  `🔴 MUST`
**As** elderly customer ป้าสมศรี (Roles: customer) who needs large text and high contrast, **I want** search, chips and results to scale, contrast and announce properly, **so that** I can search and read results comfortably without help.

*Acceptance criteria:*
- Given the OS font scale is increased up to accessibility sizes, When the Search tab renders, Then the search field, category chips and product name/subtitle/price reflow without clipping essential info; at the largest sizes the result grid may collapse to a single column rather than truncate.
- Given WCAG AA is required, When the screen renders, Then search placeholder/text, chip text, price text and empty-state text all meet >=4.5:1 contrast (>=3:1 for large text) in both light and dark themes.
- Given all icon-only controls (clear X, sort/options, notifications, bag, recent-item remove), When inspected by a screen reader, Then each exposes a meaningful Thai accessibilityLabel.
- Given results change after a search/filter/sort, When the update completes, Then the count is announced to assistive tech, e.g. 'พบ X รายการ' (and 'ไม่พบสินค้า' when zero).
- Given a screen-reader user, When navigating, Then focus order is logical: search field -> category chips -> sort control -> results grid.
- Given the user has 'reduce motion' enabled, When loading/result transitions occur, Then the SearchBar spinner and product-image transitions (currently 250ms) are reduced or disabled so nothing flashes or animates distractingly.
- Given any interactive search control, When measured, Then its touch target is >=44x44pt.

*Dependencies:* CUS-SEARCH-01, CUS-SEARCH-02, CUS-SEARCH-03

*Notes:* Bakes the KNOWN BASELINE DEBT (WCAG AA contrast, accessibilityLabel on icon buttons, dynamic-type support, reduced-motion) into the search surface specifically. Cross-cutting and independently testable (axe/VoiceOver/TalkBack + font-scale + reduce-motion checks). reduced-motion also applies to the home auto-rotating banner but that's a separate epic; here it covers the SearchBar spinner and ProductCard image transition.

#### CUS-SEARCH-08 — Catalog load: loading & error/retry states  `🟠 SHOULD`
**As** customer (Roles: customer), **I want** clear loading and retry handling when the product catalog can't load, **so that** I understand the difference between 'no results' and 'something went wrong'.

*Acceptance criteria:*
- Given the catalog is being fetched (forward-looking API; today it is static data/products.ts), When the Search tab opens, Then a loading affordance is shown (SearchBar loading indicator and/or a skeleton grid) and search input is queued/disabled until ready.
- Given the catalog fetch fails (server error), When detected, Then an error state shows a Thai message and a 'ลองอีกครั้ง' retry control — visually distinct from the CUS-SEARCH-05 no-match empty state.
- Given the customer taps 'ลองอีกครั้ง' and the fetch succeeds, When data loads, Then the grid renders and any prior query/category/sort is re-applied.
- Given the device is offline, When the catalog can't be reached, Then an offline message is shown; if a cached catalog exists it is used and labelled as possibly outdated.
- Given a screen-reader user, When loading completes or an error occurs, Then the state change (loaded / error) is announced, and the retry control exposes an accessibilityLabel.

*Dependencies:* CUS-SEARCH-01

*Notes:* Catalog is currently static (data/products.ts) so this is forward-looking and depends on a Catalog API (owned outside this epic). SearchBar already supports a `loading` prop. Error wording MUST differ from the 'ไม่พบสินค้าที่ค้นหา' no-results copy to avoid confusing ป้าสมศรี.

### CUS-PRODUCT — Product Detail
> Let a customer open any อู้ฟู่ catalog item, understand it (photos, name, price, rating, description, stock), choose size and quantity, and add it to cart or save/share it — accessibly.

#### CUS-PRODUCT-01 — View product photos and core info  `🔴 MUST`
**As** น้องแนน (busy worker shopping delivery), **I want** to open a product and immediately see its photos, name, price, rating and description, **so that** I can decide whether to buy without digging around.

*Acceptance criteria:*
- Given a valid product id, When the detail screen opens, Then the header title reads 'รายละเอียดสินค้า' and the body shows the product name, subtitle, rating stars with the numeric value (e.g. 4.8), and a description.
- Given a product price, When the screen renders, Then the price is formatted via money() (e.g. '฿165', '฿14.50') and shown in the bottom-left overlay pill alongside the ShopBadge ('ช้อป').
- Given a product with more than one image, When I swipe the carousel horizontally, Then images page one full screen at a time and the active dot indicator updates to match the visible image.
- Given a product with exactly one image, When the carousel renders, Then no dot indicators are displayed.
- Given a long description, When the screen first renders, Then it is truncated to 2 lines with an 'อ่านเพิ่มเติม' control; When I tap it, Then the full description expands and the control changes to 'ย่อ'; tapping 'ย่อ' collapses it again.
- Given an image URI fails to load, When the carousel renders that slot, Then a neutral placeholder is shown (no broken-image glyph, no crash).

*Notes:* Grounded in app/product/[id].tsx + lib/format.ts. All current mock items in data/products.ts ship a single image, so the multi-image/dots path is forward-looking — see open question on multi-image content. Price overlay is white-on-coral (Colors.textOnPrimary on Colors.primary); contrast must be verified WCAG AA (covered in CUS-PRODUCT-08).

#### CUS-PRODUCT-02 — Loading, not-found and error states  `🔴 MUST`
**As** customer, **I want** a clear message when a product cannot be shown, **so that** I am never stuck on a blank or broken screen.

*Acceptance criteria:*
- Given an id that matches no product (getProduct returns undefined), When the screen opens, Then an empty state renders with the alert-circle icon and the text 'ไม่พบสินค้านี้', and the header back chevron still returns to the previous screen.
- Given the catalog is still loading from a remote source (future state), When the screen opens, Then a loading indicator/skeleton is shown instead of empty placeholder fields.
- Given the product fetch fails with a network error, When the screen opens, Then an error state with Thai copy and a retry affordance is shown, and tapping retry re-attempts the fetch.
- Given any of the empty/loading/error states, Then no add-to-cart, size, quantity, share or wishlist controls are interactable for a non-existent product.

*Notes:* Only the undefined/empty 'ไม่พบสินค้านี้' case exists today (data is local/in-memory). Loading + network-error states are forward-looking for when the catalog moves to a remote API.

#### CUS-PRODUCT-03 — Choose size/options and quantity  `🔴 MUST`
**As** ป้าสมศรี (elderly customer, pickup), **I want** to pick the size and quantity I need with controls I can actually tap, **so that** I order the right item and amount without mistakes.

*Acceptance criteria:*
- Given a product with sizes (e.g. ข้าวหอมมะลิ → '1 กก.' / '5 กก.'), When the screen opens, Then the 'ขนาด' section shows the size pills and the first size is pre-selected.
- Given the size pills, When I tap a size, Then it becomes the selected (coral) pill and exactly one size is selected at a time.
- Given a product with no sizes, When the screen renders, Then the 'ขนาด' section is omitted entirely.
- Given a product with colors, When the screen renders, Then the 'เลือกสี' section shows swatches with the first color pre-selected; with no colors the section is omitted.
- Given the quantity stepper, When the screen opens, Then quantity defaults to 1, the minus button is disabled at the minimum (1), and the plus button increments by 1.
- Given the stepper and size pills, Then each control presents a touch target of at least 44x44 px (size pills are 44px tall today; the quantity stepper buttons are 32px and must be enlarged).

*Notes:* Grocery items currently carry no colors, so the 'เลือกสี' path rarely renders in practice. Selecting a size does NOT change the displayed price today — Product has a single flat price field (see open question on size-specific pricing).

#### CUS-PRODUCT-04 — Add the chosen item to cart  `🔴 MUST`
**As** น้องแนน (busy worker shopping delivery), **I want** to add the product with my chosen size and quantity to my cart, **so that** I can continue toward checkout.

*Acceptance criteria:*
- Given a selected size, color and quantity, When I tap 'เพิ่มลงตะกร้า', Then a cart line keyed by productId+size (cartItemId = `${id}-${size ?? 'default'}`) is created with the chosen quantity and the app navigates to the cart.
- Given a line for the same product and same size already exists in the cart, When I add again, Then the quantities merge into that existing line instead of creating a duplicate.
- Given any quantity value, When the item is added, Then the persisted quantity is at least 1 (Math.max(1, qty)).
- Given the item is successfully added, Then the customer gets explicit confirmation feedback (e.g. toast/haptic) — today the screen only navigates to the cart with no confirmation.
- Given a product that is out of stock or where total cart qty would exceed available stock, When I attempt to add, Then the add is blocked (see CUS-PRODUCT-05).

*Dependencies:* CUS-PRODUCT-03, CUS-PRODUCT-05

*Notes:* Merge + line-id behavior grounded in store/cart.ts (add merges by `${product.id}-${size ?? 'default'}`). The flat product price flows into the cart line; size-specific pricing is unresolved (open question). ShopMode (delivery|pickup) does not change PDP add-to-cart behavior; delivery fee logic lives in cart, not PDP.

#### CUS-PRODUCT-05 — Stock and availability gating  `🔴 MUST`
**As** ป้าสมศรี (elderly customer, pickup), **I want** to know whether an item is in stock before I try to buy it, **so that** I do not order or travel to the shop for something unavailable.

*Acceptance criteria:*
- Given a product with available stock, When the screen opens, Then 'เพิ่มลงตะกร้า' is enabled and no out-of-stock messaging is shown.
- Given a product that is out of stock, When the screen opens, Then a 'สินค้าหมด' badge is shown, the 'เพิ่มลงตะกร้า' button is disabled with accessibilityState disabled, and the quantity stepper is disabled.
- Given a product with low remaining stock (e.g. ≤5), When the screen opens, Then a low-stock hint is shown (e.g. 'เหลือ X ชิ้น').
- Given limited stock N, When I use the quantity stepper, Then quantity cannot exceed N (stepper max = N, plus disables at N), accounting for any quantity already in the cart so the total never exceeds N.
- Given availability could differ between ShopMode delivery and ShopMode pickup, Then the displayed availability reflects the customer's current mode (flagged — see notes/open question).

*Dependencies:* CUS-PRODUCT-03

*Notes:* Forward-looking: the Product type in data/products.ts has NO stock/availability field today and the QuantityStepper has no max — both must be added. Whether availability/stock varies by ShopMode (delivery vs pickup) is an open question and must not be assumed.

#### CUS-PRODUCT-06 — Toggle wishlist from product detail  `🟠 SHOULD`
**As** ป้าสมศรี (elderly customer, pickup), **I want** to save a product to my wishlist from its detail page, **so that** I can find and re-order it easily later.

*Acceptance criteria:*
- Given a product not yet wishlisted, When I tap the heart in the header, Then the icon fills (coral 'heart') and the product id is added to the wishlist.
- Given an already-wishlisted product, When I tap the heart, Then the icon returns to 'heart-outline' and the id is removed from the wishlist.
- Given I wishlist a product here, When I open the Wishlist tab, Then the product is present there (consistent with seeded defaults for ids 1/3/5).
- Given a screen reader, When the heart button is focused, Then it exposes a state-reflecting Thai accessibilityLabel (e.g. 'เพิ่มไปยังรายการโปรด' when off, 'นำออกจากรายการโปรด' when on) — the IconButton has no label today.

*Notes:* Grounded in store/wishlist.ts (toggle by id, seeded ids 1/3/5). Wishlist is local/in-memory only — whether it must persist to the user account / require login (PDPA) is an open question.

#### CUS-PRODUCT-07 — Share a product  `🟡 COULD`
**As** น้องแนน (busy worker shopping delivery), **I want** to share a product with friends or family, **so that** they can see what I recommend from the shop.

*Acceptance criteria:*
- Given the product detail screen, When I tap the share icon, Then the OS native share sheet opens containing the product name and a deep link to that product.
- Given the share sheet is open, When I cancel it, Then I return to the detail screen unchanged.
- Given sharing is unavailable on the device, When I tap share, Then a graceful fallback (e.g. copy link to clipboard) is offered.
- Given a screen reader, When the share button is focused, Then it exposes the accessibilityLabel 'แชร์สินค้า'.

*Notes:* Today share is a placeholder Alert (title 'แชร์', body `แชร์ "<name>"`) and must be replaced with the real native share sheet. Deep linking requires a stable product URL/route scheme.

#### CUS-PRODUCT-08 — Accessible product detail for ป้าสมศรี  `🔴 MUST`
**As** ป้าสมศรี (elderly customer needing large text, high contrast, big targets), **I want** the product page to be readable and operable with large text and a screen reader, **so that** I can shop on my own without help.

*Acceptance criteria:*
- Given OS large/dynamic text is enabled, When the screen renders, Then the name, price, description, size labels and button text scale up without truncation or overlap and the page remains fully scrollable/readable.
- Given a screen reader, When focus reaches the rating, Then it is announced as a single value (e.g. 'คะแนน 4.8 จาก 5') rather than five separate star icons.
- Given a screen reader, Then every icon-only control (back, share, wishlist, quantity − / +, and carousel) exposes a descriptive Thai accessibilityLabel.
- Given the OS 'Reduce Motion' setting is on, When the carousel renders or advances, Then the image cross-fade transition (and any auto-advance) is disabled and changes are instant.
- Given all text and icon/background pairs (including the muted subtitle/description and the white-on-coral price pill), Then color contrast meets WCAG AA.
- Given all interactive controls, Then every touch target is at least 44x44 px (the quantity stepper buttons are 32px today and must be enlarged).

*Dependencies:* CUS-PRODUCT-01, CUS-PRODUCT-03

*Notes:* Directly addresses baseline a11y debt: missing accessibilityLabel on IconButton (back/share/wishlist), RatingStars announced as 5 icons, 32px stepper targets, reduced-motion for the image transition (and reuse of the same reduced-motion handling as the home auto-rotating banner), dynamic type, and WCAG AA contrast.

### CUS-CART — Cart
> Let a customer build and adjust a correct cart — add/merge lines, change quantity, remove items, see an accurate subtotal/delivery-fee/total in Baht, apply a basic promo code, and handle out-of-stock and empty states accessibly — before handing off to checkout.

#### CUS-CART-01 — Add a product to the cart and merge by product + size  `🔴 MUST`
**As** customer (P1 น้องแนน, delivery shopper), **I want** to add a product with its chosen size to my cart and have repeat adds of the same product+size combine into one line with summed quantity, **so that** my cart stays tidy and the quantity is correct instead of sprouting duplicate rows.

*Acceptance criteria:*
- Given an empty cart, When I add 'ข้าวหอมมะลิ' size '1 กก.' without specifying qty, Then one line is created with qty 1 keyed by `${productId}-1 กก.` and the cart count badge shows 1.
- Given a cart already containing 'ข้าวหอมมะลิ / 1 กก.' at qty 2, When I add the same product+size with qty 1, Then the existing line becomes qty 3 and no second line is created.
- Given a product with two sizes, When I add 'น้ำดื่ม / 600 มล.' then 'น้ำดื่ม / 1.5 ลิตร', Then the cart shows two distinct lines, one per size.
- Given a product with no sizes (e.g. 'ไข่ไก่สด'), When I add it, Then the line id uses the `-default` suffix and repeat adds merge into that single line.
- Given any add, When qty is omitted or a value <= 0 is supplied, Then the created/merged line has at least qty 1 (minimum clamp).
- Edge (color): Given I add the same product+size twice with two different `color` values, Then the two adds MERGE into one line (color is NOT part of the line key) and the line keeps the first color — this must match the agreed grocery model.
- Given a line is added, Then the subtotal (Σ price × qty) and cart count recompute (see CUS-CART-04).

*Dependencies:* CUS-CART-04

*Notes:* Grounded in store/cart.ts: cartItemId(productId, size) and add(). Merge key = productId + size ONLY; color is excluded and the second color is silently dropped on merge — latent template behavior that is harmless today only because grocery products have colors: []. FLAG: Product carries a single `price` regardless of size, so '1 กก.' vs '5 กก.' (or '600 มล.' vs '1.5 ลิตร') currently share one price — almost certainly wrong; needs per-size pricing (open question). Cart is in-memory zustand with no persistence today (open question).

#### CUS-CART-02 — Change a cart line's quantity with a stepper  `🔴 MUST`
**As** customer, **I want** to increase or decrease a line's quantity with + / − controls and see the price update immediately, **so that** I can buy the right amount without going back to the catalog to re-add.

*Acceptance criteria:*
- Given a line at qty 1, When I tap '+', Then qty becomes 2 and the line price (price × qty), subtotal, and total update immediately.
- Given a line at qty 1, When I tap '−', Then the stepper does NOT go below the minimum of 1 ('−' is disabled/no-op at 1); removing a line is done via the trash control (CUS-CART-03), not by stepping to 0.
- Given any qty change, Then cartCount and cartSubtotal recompute and the summary re-renders.
- Edge: Given a known available stock N for the product, When qty reaches N, Then '+' is disabled and a hint 'มีสินค้าเท่านี้' is shown (depends on CUS-CART-06).
- a11y: Given ป้าสมศรี uses the stepper, Then '+' and '−' have touch targets >= 44x44 pt, carry accessibilityLabel 'เพิ่มจำนวน {ชื่อสินค้า}' / 'ลดจำนวน {ชื่อสินค้า}', and the new quantity is announced to the screen reader after each change.

*Dependencies:* CUS-CART-01, CUS-CART-04, CUS-CART-06

*Notes:* Grounded in components/product/ProductListItem.tsx (QuantityStepper min={1}) and store/cart.ts setQty (qty <= 0 removes the line, but the stepper clamps at 1 so removal happens via trash). No maximum is enforced today — a max requires the stock model (open question).

#### CUS-CART-03 — Remove a cart line with accidental-deletion protection  `🔴 MUST`
**As** customer (esp. P2 ป้าสมศรี), **I want** to remove a line from my cart and recover if I tap delete by mistake, **so that** a single mis-tap doesn't wipe out items I meant to keep.

*Acceptance criteria:*
- Given a cart with 2 lines, When I remove one via the trash control, Then that line disappears and subtotal/total/count update to reflect only the remaining line.
- Given a cart with 1 line, When I remove it, Then the cart transitions to the empty state (CUS-CART-07) and the tab badge shows 0.
- Accidental-deletion protection: Given ป้าสมศรี removes a line, Then either a confirm dialog ('ลบสินค้านี้ออกจากตะกร้า?') OR an undo affordance ('เลิกทำ') is presented so the action is recoverable.
- a11y: Given the trash icon button, Then it has accessibilityLabel 'ลบ {ชื่อสินค้า} ออกจากตะกร้า', a touch target >= 44x44 pt, and the danger color meets WCAG AA contrast on the surface.

*Dependencies:* CUS-CART-07

*Notes:* Grounded in store/cart.ts remove(id) and ProductListItem.tsx, which currently removes INSTANTLY with no confirm/undo and the trash IconButton has NO accessibilityLabel — both are gaps for the elderly persona.

#### CUS-CART-04 — Cart summary: subtotal, delivery fee, and total  `🔴 MUST`
**As** customer, **I want** to see my item subtotal, any delivery fee, and the grand total in Baht before checkout, **so that** I know exactly what I'll pay and whether I qualify for free delivery.

*Acceptance criteria:*
- Given cart lines, Then 'ยอดรวมสินค้า' equals Σ(price × qty) (cartSubtotal) formatted via money() (e.g. ฿165, ฿1,250).
- Given ShopMode = delivery and subtotal < 200, Then 'ค่าจัดส่ง' shows ฿40 and 'รวมทั้งหมด' = subtotal + 40.
- Given ShopMode = delivery and subtotal >= 200, Then 'ค่าจัดส่ง' shows 'ฟรี' in the primary color and total = subtotal.
- Given ShopMode = pickup, Then the delivery-fee row is hidden and total = subtotal (no delivery fee).
- Given ShopMode = delivery and subtotal just below 200, Then a hint shows how much more to spend for free delivery (e.g. 'ซื้ออีก ฿35 รับส่งฟรี').
- Given a promo is applied (CUS-CART-05), Then a discount line appears between subtotal and total and the total reflects it.
- a11y: Given dynamic type at the largest setting, Then all summary rows and the total remain legible without truncation/overlap and the total meets WCAG AA contrast.

*Dependencies:* CUS-CART-01, CUS-CART-05

*Notes:* Grounded in store/mode.ts (DELIVERY_FEE=40, FREE_DELIVERY_MIN=200, deliveryFeeFor) and app/(tabs)/cart.tsx summary. BLOCKED: the 'การชำระเงิน' hint row's delivery copy ('ชำระปลายทาง หรือโอนเมื่อรับของ') assumes pay-on-receipt is allowed for delivery — do not treat as final pending the open payment decision. Canonical ShopMode value is `pickup`; the code currently names this mode `online` and must be reconciled.

#### CUS-CART-05 — Apply a basic promo code  `🟠 SHOULD`
**As** customer, **I want** to enter a promo code and have the discount actually reflected in my total, **so that** I pay the discounted price instead of just seeing a confirmation message.

*Acceptance criteria:*
- Given a valid, active code whose conditions are met, When I tap 'ใช้โค้ด', Then a discount line ('ส่วนลด −฿XX') appears in the summary and 'รวมทั้งหมด' decreases accordingly.
- Given an empty input, When I tap 'ใช้โค้ด', Then I see 'กรุณากรอกโค้ดส่วนลดก่อน' and no discount is applied.
- Given an invalid / expired / not-yet-started code, When I apply it, Then I see a clear Thai error ('โค้ดไม่ถูกต้องหรือหมดอายุ') and the total is unchanged.
- Given a code with a minimum spend not met, When I apply it, Then the min-spend requirement is shown and no discount is applied.
- Given a code is already applied, When I apply a second code, Then only one code is active at a time (replace-or-reject per the agreed rule) — no stacking.
- a11y: Given the promo input and apply button, Then the input has an accessibilityLabel, errors are announced to the screen reader, and the button target is >= 44x44 pt.

*Dependencies:* CUS-CART-04

*Notes:* Current app/(tabs)/cart.tsx promo is a MOCK Alert that does NOT change the total — core gap. Needs a PromoCode(basic) entity + admin-managed rules (code, type % or ฿, min spend, validity window, usage limit). OPEN: does a promo discount apply to subtotal only, or can it also reduce/waive the delivery fee, and how does it interact with the ฿200 free-delivery threshold? (open questions).

#### CUS-CART-06 — Out-of-stock handling in the cart  `🔴 MUST`
**As** customer, **I want** to be told when an item in my cart is out of stock or limited, **so that** I don't try to buy something the shop can't fulfil.

*Acceptance criteria:*
- Given a line whose product is out of stock, Then the line is marked 'สินค้าหมด', excluded from subtotal/total, and its qty stepper is disabled.
- Given an out-of-stock line, When I try to proceed to checkout, Then checkout is blocked with a prompt to remove or save-for-later the out-of-stock item(s).
- Given a product with limited stock N, When I increase qty toward N, Then the stepper caps at N and shows 'มีสินค้าเท่านี้'.
- Given a product that goes out of stock while open in the catalog, When I tap add, Then add is disabled and I see 'สินค้าหมด' (no line is created).
- a11y: Given ป้าสมศรี with a screen reader, Then the 'สินค้าหมด' state is conveyed as text (not color alone) and meets WCAG AA contrast.

*Dependencies:* CUS-CART-02

*Notes:* FORWARD-LOOKING — data/products.ts has NO stock/inventory field today, so this cannot be built until the Product model gains a stock representation (boolean inStock vs numeric stockQty) maintained by the admin (Roles: admin). OPEN: does the cart reserve stock on add, or only validate availability at checkout? (open questions).

#### CUS-CART-07 — Empty cart state  `🔴 MUST`
**As** customer, **I want** a friendly, clear empty-cart screen with a way to start shopping, **so that** I'm guided back to the catalog instead of staring at a blank screen.

*Acceptance criteria:*
- Given the cart has no items, Then the screen shows the bag icon, title 'ตะกร้าว่างเปล่า', body 'ไปเลือกซื้อสินค้ากันเลย', and a 'ช้อปเลย' button.
- Given the empty state, When I tap 'ช้อปเลย' or the bag icon, Then I navigate to the home/catalog tab.
- Given I complete checkout or clear the cart, Then the cart returns to the empty state and the tab badge count is 0.
- a11y: Given ป้าสมศรี, Then the bag icon button has an accessibilityLabel (e.g. 'เริ่มช้อปปิ้ง'), the text uses dynamic type, and 'ช้อปเลย' has a >= 44x44 pt target meeting WCAG AA contrast.

*Notes:* Grounded in the empty branch of app/(tabs)/cart.tsx. The bag IconButton currently lacks an accessibilityLabel. clear() is invoked by the mock 'Buy Now' today; in the real flow the cart clears once an Order is created (OrderStatus: placed -> awaiting_payment).

#### CUS-CART-08 — Cart accessibility baseline for ป้าสมศรี  `🔴 MUST`
**As** elderly customer (P2 ป้าสมศรี, pickup shopper needing large text / high contrast / big touch targets), **I want** the whole cart screen usable with large text, high contrast, and a screen reader, **so that** I can manage my own order without needing help.

*Acceptance criteria:*
- Given the cart screen, Then every icon-only control (notification bell, trash, stepper +/−, empty-state bag) has a descriptive Thai accessibilityLabel.
- Given OS dynamic-type at the largest size, Then all cart text (line names, prices, summary rows, total) scales without clipping or overlap and stays tappable.
- Given any text/background pair on the cart (muted labels, 'ฟรี', danger trash, accent total), Then contrast meets WCAG AA (>= 4.5:1 normal text, >= 3:1 large text).
- Given interactive controls, Then each has a touch target >= 44x44 pt and >= 8 pt spacing from its neighbors.
- Given a screen reader, When subtotal/total changes (qty change, remove, promo), Then the new total is announced.
- Given reduced-motion is enabled, Then cart image/transition animations are minimized.

*Dependencies:* CUS-CART-02, CUS-CART-03, CUS-CART-05, CUS-CART-07

*Notes:* Consolidated a11y acceptance for the cart surface addressing the KNOWN BASELINE DEBT (WCAG AA contrast, accessibilityLabel on icon buttons, dynamic-type, reduced-motion). Per-control a11y is also baked into CUS-CART-02/03/05/07. Today the bell/trash/bag IconButtons and the QuantityStepper +/− have no accessibilityLabel.

### CUS-WISHLIST — Wishlist (รายการโปรด)
> Let a logged-in customer save products to a private, per-account wishlist they can browse, manage, and add to their cart at any time, with the elderly pickup persona ป้าสมศรี fully able to use it.

#### CUS-WISHLIST-01 — Toggle a product as favorite from anywhere it appears  `🔴 MUST`
**As** ลูกค้า (Roles: customer) such as น้องแนน, **I want** tap the heart on any product (home/search card, product detail header, or wishlist row) to add or remove it from my รายการโปรด, **so that** I can save products I like without putting them in my cart yet.

*Acceptance criteria:*
- Given a product that is not in my wishlist, When I tap its heart-outline control, Then it changes to a filled heart in Colors.primary and the product is added to my wishlist optimistically within ~200ms.
- Given a product already in my wishlist, When I tap its filled heart, Then it returns to heart-outline and is removed from the wishlist.
- Given the same product is visible in several places at once (e.g. home card + product/[id] header + รายการโปรด tab), When I toggle it in one place, Then every other instance reflects the new state with no manual refresh.
- Given I rapidly double-tap the heart, When both taps register, Then the net result is no change (idempotent) and no duplicate wishlist entry is created.
- Given the heart control, Then it exposes accessibilityRole=button, an accessibilityState selected=true/false, and a Thai accessibilityLabel that reads 'เพิ่มในรายการโปรด' when unselected and 'นำออกจากรายการโปรด' when selected.
- Given state must not rely on color alone (WCAG), Then the filled-vs-outline icon shape plus accessibilityState convey the favorited state independently of Colors.primary.

*Notes:* Hearts live in components/product/ProductListItem.tsx (wishlist variant: image overlay + right column), app/product/[id].tsx header, and product cards. Baseline debt: those icon hearts currently have no accessibilityLabel/accessibilityState. Reduced-motion: any fill/scale animation on toggle must be disabled when OS Reduce Motion is on. Persistence of the toggle is covered by CUS-WISHLIST-05.

#### CUS-WISHLIST-02 — View my wishlist in the รายการโปรด tab  `🔴 MUST`
**As** ลูกค้า (Roles: customer), **I want** open the รายการโปรด tab and see every product I have favorited, **so that** I can review and revisit my saved products later.

*Acceptance criteria:*
- Given I have one or more favorited products, When I open the รายการโปรด tab, Then each row shows the primary image, name, subtitle, RatingStars, price formatted via money() in Baht, and a filled heart.
- Given the list, When it renders, Then items are ordered most-recently-added first.
- Given a wishlist row, When I tap it outside the controls, Then I navigate to /product/[id] details for that product.
- Given I remove a product elsewhere (e.g. its detail screen) while the tab is open, When the store updates, Then the row disappears reactively without a manual refresh.
- Given a favorited id that no longer exists in the catalog (discontinued product), When the list resolves ids to products, Then that id is skipped gracefully and the screen does not crash.
- Given large system text (dynamic type), When rows render, Then the product name wraps or scales and is not clipped.

*Dependencies:* CUS-WISHLIST-01

*Notes:* Header title is 'รายการโปรด'. Debt: store/wishlist.ts wishlistProducts() currently returns catalog order, not add order, and ProductListItem name uses numberOfLines={1} (clips at large text). An optional tab count badge is out of scope (see openQuestions).

#### CUS-WISHLIST-03 — Friendly empty state when I have no favorites  `🔴 MUST`
**As** ป้าสมศรี (elderly, pickup customer), **I want** a clear, friendly message when my wishlist is empty, **so that** I understand the list is not broken and I know how to start adding favorites.

*Acceptance criteria:*
- Given I have zero favorited products, When I open รายการโปรด, Then I see the heart-outline icon, the title 'ยังไม่มีรายการโปรด', and the body 'แตะรูปหัวใจที่สินค้าเพื่อบันทึกไว้ดูภายหลัง'.
- Given the empty state, When it is shown, Then a primary CTA (e.g. 'เลือกซื้อสินค้า'/'ช้อปเลย') is present and navigates to the home catalog.
- Given I remove my last remaining favorite, When the wishlist reaches zero items, Then the list view is replaced by the empty state.
- Given a screen reader, When the empty state appears (including after removing the last item), Then the change is announced via accessibilityLiveRegion or moved focus.
- Given WCAG AA, Then the empty-state text (including Colors.textMuted body) meets >=4.5:1 contrast and the CTA is >=44x44 pt with a Thai accessibilityLabel.

*Dependencies:* CUS-WISHLIST-02

*Notes:* Copy is reused verbatim from app/(tabs)/wishlist.tsx. A CTA must be added (the cart empty state in app/(tabs)/cart.tsx already uses 'ช้อปเลย' as precedent). The current wishlist empty state has no CTA.

#### CUS-WISHLIST-04 — Add a favorited product to my cart from the wishlist  `🔴 MUST`
**As** น้องแนน (busy worker, delivery customer), **I want** add a favorited product to my cart directly from a รายการโปรด row, **so that** I can buy a saved item quickly without opening its detail page.

*Acceptance criteria:*
- Given a wishlist row for a product with NO sizes (e.g. นมจืด UHT), When I tap 'เพิ่มลงตะกร้า', Then 1 unit is added to the cart via cart.add (merging qty if a matching line already exists) and a confirmation is shown.
- Given a wishlist row for a product WITH sizes (e.g. ข้าวหอมมะลิ '1 กก.'/'5 กก.', น้ำดื่ม '600 มล.'/'1.5 ลิตร'), When I tap add-to-cart, Then I am prompted to choose a size (or routed to product detail) before it is added, and the app does NOT silently pick a size.
- Given the active ShopMode is delivery | pickup, When I add to cart from the wishlist, Then the item lands in the single shared cart and mode-specific fees (DELIVERY_FEE 40, free when subtotal >= 200) are applied later at cart/checkout, not at favorite time.
- Given a product already in the cart at the same size, When I add it again from the wishlist, Then the existing cart line qty increments (no duplicate line).
- Given the add-to-cart control, Then it is >=44x44 pt with accessibilityLabel 'เพิ่มลงตะกร้า' and the resulting confirmation is announced to screen readers.

*Dependencies:* CUS-WISHLIST-02

*Notes:* Canonical ShopMode is delivery | pickup (store/mode.ts currently labels pickup as 'online'/'ออนไลน์' — a naming debt). Wishlist stores only product id, so size selection is the key edge case; color defaults to product.colors[0] (catalog colors are currently empty). Out-of-stock handling is unresolved because Product has no stock field (see openQuestions). Whether this is a true 'move' (remove from wishlist after adding) or 'add' (keep) is an open question — assumed 'keep' for now.

#### CUS-WISHLIST-05 — Persist my wishlist per account across sessions  `🔴 MUST`
**As** ลูกค้า (Roles: customer), **I want** my wishlist saved to my account so it survives app restarts and re-logins and stays private to me, **so that** I never lose my saved products and other people on the device cannot see them.

*Acceptance criteria:*
- Given I am logged in and have favorited products, When I force-quit and reopen the app, Then my exact wishlist is restored.
- Given a brand-new account, When I open รายการโปรด for the first time, Then it is EMPTY (the demo SEED_IDS ['1','3','5'] in store/wishlist.ts must be removed for production).
- Given user A logs out and user B logs in on the same device, When B opens รายการโปรด, Then B sees only B's wishlist and never A's (per-user scope; cleared from memory on logout).
- Given I favorited products as a guest and then log in, When my account loads, Then guest favorites are merged into my account wishlist, de-duplicated by product id (merge policy is an open question; depends on CUS-AUTH).
- Given PDPA, Then the wishlist is treated as personal data tied to my account; When I delete my account, Then my wishlist data is deleted, and consent is covered by the signup PDPA consent.
- Given I am offline (if the wishlist is server-backed), When I toggle favorites, Then changes apply locally and sync on reconnect without data loss.

*Dependencies:* CUS-AUTH, CUS-WISHLIST-01

*Notes:* Today store/wishlist.ts is in-memory zustand, not persisted, and seeded — both must change. Auth is locked (phone+OTP and LINE/Apple/Google social), so this is a dependency, not a blocker. NOT blocked by the open payment decision (wishlist never touches payment). Open: device-local only vs server-synced across devices; guest->login merge policy.

#### CUS-WISHLIST-06 — Wishlist is fully accessible for ป้าสมศรี  `🔴 MUST`
**As** ป้าสมศรี (elderly, pickup customer needing large text / high contrast / big touch targets), **I want** the whole wishlist surface usable with large fonts, high contrast, and large buttons, with screen-reader support, **so that** I can manage my favorites without straining my eyes or mis-tapping.

*Acceptance criteria:*
- Given system text size at the maximum (~200%), When I view รายการโปรด rows and the empty state, Then all text scales (dynamic type) and no critical info (name, price, buttons) is clipped or overlapped.
- Given every interactive control (heart toggle, add-to-cart, header bell/bag IconButtons, empty-state CTA), Then each has a touch target >=44x44 pt and a descriptive Thai accessibilityLabel (the image-overlay heart is size 28 today and must reach the minimum via size or hitSlop).
- Given a screen reader (VoiceOver/TalkBack), When I focus a heart, Then it announces its label and selected state; When I activate it, Then the new state ('เพิ่มในรายการโปรด' / 'นำออกจากรายการโปรด') is announced.
- Given WCAG AA, Then wishlist text (including Colors.textMuted subtitle/price) meets >=4.5:1 and the heart/icon UI meets >=3:1 contrast against its background.
- Given the OS Reduce Motion setting is on, When images load (expo-image transition is 250/300ms today) or a heart toggles, Then transitions/animations are disabled or minimized.

*Dependencies:* CUS-WISHLIST-02, CUS-WISHLIST-03, CUS-WISHLIST-04

*Notes:* Directly targets the known baseline a11y debt: accessibilityLabel on icon buttons, dynamic-type support, WCAG AA contrast, reduced motion. This story is the persona acceptance lens (ป้าสมศรี, pickup) for the whole wishlist surface; the same a11y requirements are also embedded in the individual stories.

#### CUS-WISHLIST-07 — Undo an accidental wishlist removal  `🟠 SHOULD`
**As** ป้าสมศรี (elderly, pickup customer), **I want** a quick undo after I remove a product from my wishlist, **so that** I can recover from an accidental tap on the heart without re-finding the product.

*Acceptance criteria:*
- Given I remove a product from the wishlist, When it is removed, Then a brief snackbar 'นำออกจากรายการโปรดแล้ว' with an 'เลิกทำ' (undo) action appears for at least ~5 seconds.
- Given the undo snackbar is visible, When I tap 'เลิกทำ', Then the product is restored to its previous position in the wishlist.
- Given I take no action, When the snackbar dismisses, Then the removal stands.
- Given accessibility, Then the snackbar is announced via a live region, the undo control is >=44x44 with a Thai accessibilityLabel, the auto-dismiss timeout is generous for elderly users, and the appearance respects Reduce Motion (no slide animation when enabled).

*Dependencies:* CUS-WISHLIST-01, CUS-WISHLIST-02

*Notes:* Improves error-recovery for ป้าสมศรี given the small heart targets; with undo present, no destructive confirmation dialog is needed. Marked should (not must) for v1.

#### CUS-WISHLIST-08 — Add all favorites to the cart at once  `🟡 COULD`
**As** น้องแนน (busy worker, delivery customer), **I want** add all my favorited products to the cart in a single action, **so that** I can quickly re-stock my usual items.

*Acceptance criteria:*
- Given all my favorites have NO sizes, When I tap 'เพิ่มทั้งหมดลงตะกร้า', Then 1 unit of each is added to the cart and a summary confirms how many were added.
- Given some favorites HAVE sizes, When I bulk-add, Then sized items are skipped (or flagged for manual size choice) and the user is told which ones still need a size — no silent default size is applied.
- Given my wishlist is empty, Then the bulk-add control is hidden or disabled.
- Given accessibility, Then the bulk control is >=44x44 with a Thai accessibilityLabel and the result summary is announced to screen readers.

*Dependencies:* CUS-WISHLIST-02, CUS-WISHLIST-04

*Notes:* Convenience could-have; reuses the size-selection rule from CUS-WISHLIST-04. Open: how to handle sized items in a bulk action.

### CUS-MODE — Shopping Mode (delivery / pickup)
> Let a customer choose between delivery and pickup and have that single choice consistently and accessibly drive delivery-fee, payment flow, CTA, and the order's fulfillment branch across the app.

#### CUS-MODE-01 — Select a shopping mode (delivery / pickup)  `🔴 MUST`
**As** customer (น้องแนน / ป้าสมศรี), **I want** to pick whether I want my order delivered or to pick it up at the shop, **so that** the app shops, prices, and checks out the way that suits me.

*Acceptance criteria:*
- Given a customer opens the home screen for the first time in a session, When the ModeSwitch renders, Then exactly one mode is preselected and it is `delivery` (label "เดลิเวอรี่", tagline "สั่งเลย ส่งถึงบ้าน") per the store default.
- Given the two mode options are shown, Then each renders its canonical label + tagline from MODE_META: `delivery` = "เดลิเวอรี่" / "สั่งเลย ส่งถึงบ้าน", `pickup` = "รับที่ร้าน" (currently "ออนไลน์") / "ช้อปออนไลน์ รับที่ร้าน".
- Given `delivery` is selected, When the customer taps the `pickup` option, Then `pickup` becomes selected (accent ring + check shown) and `delivery` is deselected.
- Given the ModeSwitch, Then at all times exactly one mode is selected — there is no state where both or neither is selected.
- Given the customer toggles back and forth, When they tap the already-selected mode, Then it stays selected and no error/flicker occurs (idempotent).

*Notes:* Ground: store/mode.ts (initial mode 'delivery', MODE_META) and components/shop/ModeSwitch.tsx. CANONICAL ShopMode is `delivery | pickup`; the code currently names the second mode `online`. This story assumes the rename to `pickup` (and a Thai label review — see open questions); use `pickup` verbatim in all downstream surfaces.

#### CUS-MODE-02 — Mode selection stays in sync everywhere and persists across sessions  `🔴 MUST`
**As** customer (น้องแนน), **I want** my chosen mode to be the same on every screen and remembered next time I open the app, **so that** I never accidentally check out in the wrong mode or re-pick it each visit.

*Acceptance criteria:*
- Given the customer sets `pickup` on home, When they open the cart tab, Then the cart's compact ModeSwitch also shows `pickup` selected (single shared source of truth).
- Given the customer changes mode to `delivery` from the cart, When they return to home, Then home reflects `delivery`.
- Given the customer selected `pickup`, When they fully close and relaunch the app, Then `pickup` is still selected.
- Given a brand-new install with no saved preference, When the app first launches, Then mode defaults to `delivery`.
- Given the saved value is missing or unreadable (storage error/corruption), When the app launches, Then it falls back to `delivery` without crashing.

*Dependencies:* CUS-MODE-01

*Notes:* GAP: useMode in store/mode.ts is in-memory zustand — it already syncs across screens but does NOT persist; it resets to 'delivery' on restart. Requires persistence (e.g. zustand persist + AsyncStorage). Open question: should the preference be per-device or per-account (and should login override it)?

#### CUS-MODE-03 — Delivery fee and free-delivery threshold are applied correctly  `🔴 MUST`
**As** customer (น้องแนน), **I want** to see a 40 THB delivery fee that becomes free once I spend enough, **so that** I know exactly what I pay and am nudged toward free delivery.

*Acceptance criteria:*
- Given `delivery` and a cart subtotal of ฿40 (< ฿200), When the cart summary renders, Then the "ค่าจัดส่ง" row shows ฿40 and total = subtotal + ฿40.
- Given `delivery` and a subtotal of exactly ฿200 (the FREE_DELIVERY_MIN boundary), Then the fee is waived and shown as "ฟรี" in the primary color, and total = subtotal.
- Given `delivery` and a subtotal of ฿250 (> ฿200), Then the fee is "ฟรี" and total = subtotal.
- Given `delivery` and a subtotal of ฿199 (just below the boundary), Then the fee is ฿40 (off-by-one guard).
- Given `pickup` at any subtotal, Then no "ค่าจัดส่ง" row is shown, the applied delivery fee is 0, and total = subtotal.
- Given an empty cart, Then the cart shows its empty state and no fee/summary is computed.

*Dependencies:* CUS-MODE-01

*Notes:* Ground: deliveryFeeFor(mode, subtotal) with DELIVERY_FEE = 40 and FREE_DELIVERY_MIN = 200 in store/mode.ts; cart summary rendering in app/(tabs)/cart.tsx. Open question: are ฿40 / ฿200 fixed constants or admin-configurable from the Admin Web?

#### CUS-MODE-04 — Show progress toward free delivery  `🟠 SHOULD`
**As** customer (น้องแนน), **I want** to see how much more I need to add to get free delivery, **so that** I can decide whether to add one more item.

*Acceptance criteria:*
- Given `delivery` and a subtotal of ฿150, Then the cart shows a textual nudge "เหลืออีก ฿50 ส่งฟรี" (FREE_DELIVERY_MIN − subtotal).
- Given `delivery` and a subtotal of ฿199, Then the nudge reads "เหลืออีก ฿1 ส่งฟรี".
- Given `delivery` and a subtotal ≥ ฿200, Then the nudge is replaced by a clear "คุณได้ส่งฟรีแล้ว" confirmation (not conveyed by color alone).
- Given `pickup` at any subtotal, Then no free-delivery nudge is shown.
- Given the subtotal crosses ฿200 (e.g. customer raises qty from ฿180 to ฿210), When the summary updates, Then the change is announced politely via an a11y live region for ป้าสมศรี.

*Dependencies:* CUS-MODE-03

*Notes:* Reuses the ฿200 threshold already advertised on the home banner copy "ส่งฟรี! เมื่อสั่งครบ 200฿" (app/(tabs)/index.tsx). Keep wording consistent with the banner.

#### CUS-MODE-05 — Mode drives the cart summary, payment hint, and checkout CTA  `🔴 MUST`
**As** customer (น้องแนน), **I want** the cart to clearly reflect how my current mode pays and what the button does, **so that** there are no surprises at checkout.

*Acceptance criteria:*
- Given `delivery`, Then the cart summary shows the "ค่าจัดส่ง" row, the delivery payment hint, and the primary CTA labeled "สั่งซื้อ & จัดส่ง".
- Given `pickup`, Then no "ค่าจัดส่ง" row is shown, the payment hint reads "ชำระออนไลน์ PromptPay/โอน + แนบสลิป", and the CTA is labeled "ชำระเงินออนไลน์".
- Given the customer toggles mode from the compact ModeSwitch inside the cart, When the toggle changes, Then the fee row, payment hint, and CTA label all update immediately without leaving the screen.
- Given `delivery`, Then the payment-hint copy MUST be treated as provisional and is BLOCKED pending the prepay-vs-COD decision (see open questions); it must not ship as final.
- Given any mode, Then the displayed total exactly equals subtotal + applied delivery fee per CUS-MODE-03.

*Dependencies:* CUS-MODE-01, CUS-MODE-03

*Notes:* Ground: PAYMENT_HINT and CTA labels in app/(tabs)/cart.tsx. WARNING: the existing delivery hint 'ชำระปลายทาง หรือโอนเมื่อรับของ' silently assumes COD/pay-on-receipt, which is exactly the UNRESOLVED decision — do not finalize this copy. PaymentMethod v1 = promptpay_slip.

#### CUS-MODE-06 — Accessible mode switch with spoken confirmation of the change  `🔴 MUST`
**As** ป้าสมศรี (elderly customer, large text / high contrast / screen reader), **I want** to clearly see and hear which mode is selected and when it changes, **so that** I can confidently choose pickup without help.

*Acceptance criteria:*
- Given the ModeSwitch, Then each option exposes an accessibilityRole (radio/button) with accessibilityState={{selected}} and an accessibilityLabel combining label + tagline + selected status (e.g. "รับที่ร้าน, ช้อปออนไลน์ รับที่ร้าน, เลือกอยู่").
- Given the compact pills and large cards, Then every tappable mode option has a touch target of at least 44x44 pt.
- Given the OS is set to the largest dynamic-type / font-scale setting, When the ModeSwitch renders, Then labels and taglines scale without truncation, clipping, or overlap.
- Given WCAG AA, Then selected and unselected label text and icons meet at least 4.5:1 contrast, and the selected state is conveyed by more than color (check icon + accessibilityState), not color alone.
- Given the customer changes mode, When the selection commits, Then AccessibilityInfo.announceForAccessibility announces the consequence in Thai, e.g. "เปลี่ยนเป็นรับที่ร้าน ไม่มีค่าจัดส่ง" / "เปลี่ยนเป็นเดลิเวอรี่ ค่าจัดส่ง 40 บาท ส่งฟรีเมื่อครบ 200 บาท".
- Given the OS has Reduce Motion enabled, When the selection changes, Then any selection transition is non-essential/instant and selection is still fully conveyed via state + check.

*Dependencies:* CUS-MODE-01

*Notes:* Addresses known baseline debt: components/shop/ModeSwitch.tsx Pressables currently have no accessibilityRole/State/Label, compact pills can fall below 44pt, and there is no announce-on-change. The announced copy for `delivery` payment must stay neutral until the prepay-vs-COD decision lands.

#### CUS-MODE-07 — Mode determines the order's fulfillment and payment branch  `🔴 MUST`
**As** customer placing an order, **I want** my chosen mode to set the right payment flow and order lifecycle, **so that** I pay and receive my order the correct way for delivery vs pickup.

*Acceptance criteria:*
- Given `pickup` at checkout, When the order is placed, Then PaymentMethod = promptpay_slip, the Payment starts at PaymentStatus `awaiting_payment`, and the Order follows the pickup branch: placed → awaiting_payment → slip_uploaded → payment_verifying → confirmed → preparing → ready_for_pickup → picked_up, with no Delivery/Rider record and no delivery fee.
- Given `delivery` at checkout, When the order is placed, Then the Order follows the delivery branch through preparing → assigned_to_rider → out_for_delivery → delivered and carries the delivery fee from CUS-MODE-03 plus a Delivery assignment.
- Given `delivery`, Then the payment step (whether the customer prepays via promptpay_slip up-front like pickup, or pays on receipt / cod) is BLOCKED and MUST NOT be implemented until the prepay-vs-COD decision is made; PaymentStatus timing for delivery is undefined until then.
- Given items in the cart but no order yet, When the customer switches mode, Then the fee, payment flow, and CTA recompute for the new mode.
- Given an order has already been placed, When the customer revisits it, Then the mode is locked on that Order and cannot be switched.
- Given a slip is rejected by the admin (Roles: admin), Then PaymentStatus = `rejected` and OrderStatus = `payment_rejected` regardless of mode, and the customer is informed.

*Dependencies:* CUS-MODE-01, CUS-MODE-03

*Notes:* Uses canonical OrderStatus / PaymentStatus / PaymentMethod / Roles verbatim. The delivery payment behavior is the core blocked item — see open questions. PaymentMethod `gateway`/`cod` are future/open; do not assume `cod` is in v1 scope. Checkout itself (slip upload, QR) is owned by other epics; this story only asserts how MODE selects the branch.

### CUS-CHECKOUT — Checkout & Payment (PromptPay + slip)
> Let a customer review their order, confirm delivery address or pickup branch, pay the exact total via PromptPay QR + uploaded transfer slip, place the order, and track it through the awaiting_payment → slip_uploaded → verifying → paid/rejected states.

#### CUS-CHK-01 — Review order before paying  `🔴 MUST`
**As** customer (P1 น้องแนน on delivery, P2 ป้าสมศรี on pickup), **I want** to see a full order-review screen with items, quantities, subtotal, delivery fee and grand total before I commit, **so that** I can confirm everything is correct before paying.

*Acceptance criteria:*
- Given a non-empty cart in ShopMode delivery, When I tap the checkout CTA from the cart, Then I see a review screen listing each OrderItem (name, chosen size, qty, line price), the subtotal, the delivery fee row, and the grand total.
- Given ShopMode delivery and subtotal < 200 THB, When the review renders, Then ค่าจัดส่ง shows 40 บาท and total = subtotal + 40.
- Given ShopMode delivery and subtotal >= 200 THB, When the review renders, Then ค่าจัดส่ง shows ฟรี and total = subtotal.
- Given ShopMode pickup, When the review renders, Then no delivery-fee row appears and total = subtotal.
- Given an empty cart, When I attempt to open checkout, Then the checkout CTA is disabled/hidden and I stay on the cart showing the empty state ตะกร้าว่างเปล่า / ไปเลือกซื้อสินค้ากันเลย.
- Given I am on the review screen, When I tap back/แก้ไข, Then I return to the cart with all lines and quantities intact (no data loss).
- Given dynamic type is enlarged, When the review renders, Then all amounts and the รวมทั้งหมด total scale without truncation, and the total is exposed as one accessibility label (e.g. รวมทั้งหมด 219 บาท).

*Dependencies:* store/cart.ts (cartSubtotal), store/mode.ts (deliveryFeeFor)

*Notes:* Reuse real numbers from store/mode.ts: DELIVERY_FEE=40, free when subtotal>=200. A basic PromoCode could discount the total here (PromoCode entity + existing promo input in cart.tsx) — out of this epic's v1 scope unless prioritised separately. a11y: WCAG AA contrast on all amounts.

#### CUS-CHK-02 — Choose delivery address  `🔴 MUST`
**As** delivery customer (P1 น้องแนน), **I want** to select a saved address or add a new one during checkout, **so that** the shop's rider delivers to the right place.

*Acceptance criteria:*
- Given ShopMode delivery and I have >=1 saved Address, When I reach the address step, Then my default Address is preselected and I can switch to any other saved Address.
- Given ShopMode delivery and I have no saved Address, When I reach the address step, Then I see an empty state with เพิ่มที่อยู่จัดส่ง and I cannot place the order until an address is chosen.
- Given I tap add address, When I complete the required fields (recipient name, phone, address detail) and save, Then the new Address appears in the list and becomes the selected address.
- Given ShopMode delivery and no address selected, When I tap place order, Then it is blocked with inline error กรุณาเลือกที่อยู่จัดส่ง.
- Given ShopMode pickup, When I checkout, Then the address step is skipped entirely.
- Given the address radio list, Then each option has a >=44pt touch target, an accessibilityState of selected/unselected, and a label that reads recipient + address.

*Dependencies:* CUS-AUTH (authenticated User + Address entity)

*Notes:* Address is PDPA personal data — collected with consent, displayed only to the owning User. Editing/deleting addresses lives in a profile epic, not here; this story only consumes/selects them.

#### CUS-CHK-03 — Confirm pickup branch  `🔴 MUST`
**As** pickup customer (P2 ป้าสมศรี), **I want** to see and confirm the shop branch where I'll collect my order, with address and opening hours, **so that** I know exactly where and when to pick it up.

*Acceptance criteria:*
- Given ShopMode pickup, When I reach the fulfillment step, Then I see the shop name อู้ฟู่, its address, opening hours, and a location/map with a clear รับที่ร้าน label and a confirm affordance.
- Given a single branch in v1, When the step renders, Then the branch is preselected and shown read-only (no branch picker).
- Given ShopMode delivery, When I checkout, Then this pickup step is skipped.
- Given P2 ป้าสมศรี, When the branch info renders, Then name/address/hours use base font >=18pt that scales with dynamic type, meet WCAG AA contrast, and the map has a text alternative (address read aloud) for screen readers.

*Dependencies:* store/mode.ts (ShopMode pickup)

*Notes:* v1 assumes a single store/branch — confirm in open questions. ShopMode code label is currently online (ออนไลน์) but canonical enum value is pickup; align label vs enum.

#### CUS-CHK-04 — Place order and enter awaiting_payment  `🔴 MUST`
**As** customer, **I want** to place my reviewed order and be taken to payment, **so that** my order is recorded and I can pay for it.

*Acceptance criteria:*
- Given a valid review (address chosen for delivery, or pickup branch confirmed), When I tap place order, Then an Order + OrderItems are created with OrderStatus transitioning placed -> awaiting_payment, PaymentStatus awaiting_payment, and PaymentMethod promptpay_slip.
- Given the Order is created successfully, When I land on the next screen, Then the cart is cleared only after success and I see the Order reference id and the exact total.
- Given order creation fails (network/server), When I tap place order, Then the cart and selections are preserved, no partial Order exists, and I see a retryable error สั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้ง.
- Given I double-tap place order, When the request is in flight, Then the CTA is disabled/locked so only one Order is created (idempotent).

*Dependencies:* CUS-CHK-01, CUS-CHK-02, CUS-CHK-03

*Notes:* Current cart.tsx clears the cart BEFORE showing the success alert (baseline debt) — must clear only on confirmed success. For ShopMode delivery, whether placing the order routes to PromptPay (prepay) or to a pay-on-receipt confirmation is BLOCKED by the open delivery-payment-timing decision; pickup always routes to PromptPay+slip.

#### CUS-CHK-05 — Pay via PromptPay QR for the exact total  `🔴 MUST`
**As** pickup customer (P2 ป้าสมศรี), **I want** a PromptPay QR that encodes the exact order total plus the shop's PromptPay name, **so that** I can scan it in my banking app and transfer the right amount.

*Acceptance criteria:*
- Given PaymentStatus awaiting_payment in ShopMode pickup, When the payment screen loads, Then a PromptPay QR encoding the exact total (THB) is shown together with the amount in large text and the shop's PromptPay/account name.
- Given the order total is 219 THB, When the QR is generated, Then the amount embedded in the QR equals 219 exactly (no rounding).
- Given the QR is shown, When I want to pay later, Then I can use บันทึก QR (save/screenshot) and a copy-amount action.
- Given a screen reader, When the QR renders, Then it carries accessibilityLabel like PromptPay QR ยอด 219 บาท, the amount and shop name are real selectable text (not only baked into the image), and the QR keeps a high-contrast quiet zone.

*Dependencies:* CUS-CHK-04

*Notes:* Pickup is definitively prepay so this story is unblocked. BLOCKED for ShopMode delivery — whether delivery shows this QR depends on the open prepay-vs-pay-on-receipt decision. Confirm whether QR is dynamic EMVCo with embedded amount or a static shop PromptPay ID (open question). Real gateway is future/open.

#### CUS-CHK-06 — Upload transfer slip  `🔴 MUST`
**As** customer, **I want** to attach my bank transfer slip from camera or gallery, **so that** the shop can verify my payment.

*Acceptance criteria:*
- Given PaymentStatus awaiting_payment, When I pick an image from camera or gallery, Then I can preview it and confirm the upload.
- Given I confirm a valid upload, When it succeeds, Then a Payment(Slip) is stored, PaymentStatus -> slip_uploaded and OrderStatus -> slip_uploaded, and the QR/upload CTA is replaced by a รอตรวจสอบสลิป status.
- Given an unsupported file type or an oversized image, When I select it, Then I see ไฟล์ไม่รองรับ / size error and can choose another without leaving the screen.
- Given the upload fails (network), When it errors, Then PaymentStatus stays awaiting_payment and I can retry without losing the Order.
- Given PaymentStatus slip_uploaded and an admin has not yet started verifying, When I want to fix a wrong slip, Then I can replace the slip (define cutoff once admin verification begins).
- Given P2 ป้าสมศรี, When the upload controls render, Then the camera/gallery icon buttons have accessibilityLabel (ถ่ายรูปสลิป / เลือกจากคลังภาพ), >=44pt touch targets, and the preview image has alt text.

*Dependencies:* CUS-CHK-05

*Notes:* Use expo-image-picker — verify the SDK 54 API at the versioned docs before coding (camera + media library permissions, PDPA: slip is financial personal data). Slip image must be readable by admin in ADM-PAY verification.

#### CUS-CHK-07 — Track payment state and recover from rejection  `🔴 MUST`
**As** customer, **I want** to see my payment/verification status and re-upload if my slip is rejected, **so that** I know whether my order is confirmed and can fix payment problems.

*Acceptance criteria:*
- Given PaymentStatus slip_uploaded, When an admin starts verification, Then I see PaymentStatus verifying / OrderStatus payment_verifying with copy กำลังตรวจสอบการชำระเงิน.
- Given an admin approves the slip, When the decision lands, Then PaymentStatus -> paid and OrderStatus -> confirmed, I receive a Notification, and the screen shows ชำระเงินสำเร็จ.
- Given an admin rejects the slip, When the decision lands, Then PaymentStatus -> rejected and OrderStatus -> payment_rejected, I see the reject reason, and an อัปโหลดสลิปใหม่ CTA returns the Order to awaiting_payment for re-upload.
- Given OrderStatus cancelled, When I open the order, Then all payment actions are disabled and the status shows ยกเลิกแล้ว.
- Given any status change, When it occurs, Then it is announced via an accessibility live region and conveyed by icon + text + color (never color alone) at WCAG AA contrast.

*Dependencies:* CUS-CHK-06, ADM-PAY (admin slip approve/reject)

*Notes:* PaymentStatus<->OrderStatus mapping: awaiting_payment<->awaiting_payment, slip_uploaded<->slip_uploaded, verifying<->payment_verifying, paid<->confirmed, rejected<->payment_rejected. Re-upload after payment_rejected loops back to awaiting_payment. Open: max re-upload attempts, whether a fresh QR is issued, and real-time push vs polling for status.

#### CUS-CHK-08 — Guided large-text PromptPay payment for elderly pickup customer  `🟠 SHOULD`
**As** elderly pickup customer (P2 ป้าสมศรี), **I want** simple step-by-step Thai instructions in large, high-contrast text on how to scan, transfer, and attach my slip, **so that** I can complete payment by myself without help.

*Acceptance criteria:*
- Given the payment screen in ShopMode pickup, When it renders, Then numbered Thai steps are shown (e.g. 1. สแกน QR ด้วยแอปธนาคาร / 2. โอนยอด 219 บาท / 3. แนบสลิป) at base font >=18pt.
- Given dynamic type is set to the largest size, When the steps render, Then all text and the primary CTA remain fully visible without clipping or overlap, and the primary CTA is >=48pt tall.
- Given reduced-motion is enabled, When the screen loads, Then no auto-advancing or animated step transitions play.
- Given I complete a step (e.g. slip attached), When state updates, Then progress is indicated both visually and programmatically (accessibilityValue/state) at WCAG AA contrast.

*Dependencies:* CUS-CHK-05, CUS-CHK-06

*Notes:* Directly addresses baseline a11y debt: dynamic-type support, WCAG AA contrast, reduced-motion, accessibilityLabel on icon buttons. Independently testable as an end-to-end usability check that ป้าสมศรี can pay unaided.

### CUS-ORDERS — Order Tracking, History & Reorder
> Customers can track any order through its full OrderStatus lifecycle for both delivery and pickup, get notified on changes, browse their history, reorder their usuals in one tap, and cancel or recover from payment problems.

#### CUS-ORDERS-01 — View order history list  `🔴 MUST`
**As** authenticated customer (P1 น้องแนน / P2 ป้าสมศรี), **I want** a list of all my orders, newest first, with status and total at a glance, **so that** I can quickly find an order and see whether it is still active or completed.

*Acceptance criteria:*
- Given I am an authenticated customer with at least one order, When I open 'ประวัติการสั่งซื้อ' from บัญชีของฉัน, Then I see my orders sorted newest-first, each row showing order number, order date, a ShopMode badge (เดลิเวอรี่ for delivery / ออนไลน์ for pickup), the current OrderStatus as a Thai status chip, item count, a primary item thumbnail, and the total in ฿ via money().
- Given I have both in-progress and finished orders, When the list loads, Then active orders (any non-terminal OrderStatus) are sectioned above terminal ones (delivered, picked_up, cancelled, payment_rejected, delivery_failed).
- Given I am authenticated but have no orders, When the screen loads, Then I see a friendly empty state ('ยังไม่มีคำสั่งซื้อ') with a 'ช้อปเลย' CTA that routes to home, mirroring the existing empty-cart pattern.
- Given the order fetch fails (network/server), When the screen loads, Then I see an error state with a retry action and no crash, and a successful retry replaces the error with the list.
- Given the list has more orders than one page, When I scroll to the end, Then older orders load (pagination/infinite scroll) with a loading indicator, and pull-to-refresh re-fetches the newest page.
- Given an order changes status while I am away, When I return to or pull-to-refresh the list, Then the status chip reflects the latest OrderStatus.
- (a11y / ป้าสมศรี) Given large dynamic-type and AA-contrast settings, When the list renders, Then text scales without truncation or overlap, each row is a single touch target ≥44pt with an accessibilityLabel summarizing order number + Thai status + total, and status chips convey meaning by text+icon (not color alone) at WCAG AA contrast.

*Dependencies:* Auth (phone+OTP / LINE/Apple/Google) to identify the customer, Order entity + order-list API

*Notes:* Entry point already exists as the no-op 'orders' row (label 'ประวัติการสั่งซื้อ') in app/(tabs)/account.tsx. Reuses money() (฿) and MODE_META Thai labels. Status chip meaning must not be color-only (AA + color-blind). 'Active vs terminal' grouping uses the OrderStatus enum verbatim.

#### CUS-ORDERS-02 — View order detail with full lifecycle timeline  `🔴 MUST`
**As** customer, **I want** to open one order and see its items, payment, totals, and a step-by-step status timeline appropriate to its mode, **so that** I know exactly what I ordered and where it is in the process.

*Acceptance criteria:*
- Given I tap an order in history, When the detail opens, Then I see order number, placed date/time, ShopMode, OrderItems (name, size, qty, line price), subtotal, delivery fee (delivery only: 'ฟรี' when subtotal ≥ ฿200 else ฿40), and total via money().
- Given a delivery order, When I view the timeline, Then it renders the delivery branch in order: placed → awaiting_payment → slip_uploaded → payment_verifying → confirmed → preparing → assigned_to_rider → out_for_delivery → delivered, with the current step highlighted, completed steps timestamped, and the delivery address shown.
- Given a pickup order, When I view the timeline, Then it renders the pickup branch: placed → awaiting_payment → slip_uploaded → payment_verifying → confirmed → preparing → ready_for_pickup → picked_up, showing the store pickup location/hours instead of an address and no delivery-fee row.
- Given a terminal/branch state (cancelled, payment_rejected, delivery_failed), When I view detail, Then the timeline clearly marks where it stopped with a Thai explanation and a relevant next-step CTA (e.g. re-upload slip, contact shop) rather than showing later steps as pending.
- Given the order's PaymentStatus (awaiting_payment | slip_uploaded | verifying | paid | rejected) with PaymentMethod promptpay_slip, When I view detail, Then a payment section shows the current PaymentStatus in Thai and the uploaded slip thumbnail when one exists.
- Given the detail fails to load, When I open it, Then I see an inline error with retry, and the loading state shows a skeleton rather than a blank screen.
- (a11y / ป้าสมศรี) Given large dynamic type, When the timeline renders, Then each step has a visible text label (not icon/color only), the current step is exposed to screen readers via accessibilityState/label, and the layout reflows without clipping.

*Dependencies:* CUS-ORDERS-01, Order / OrderItem / Payment(Slip) / Delivery entities, Admin-driven status transitions (ADM order state machine)

*Notes:* Define one shared OrderStatus→Thai label map reused by the list chip, this timeline, and push copy. The delivery-branch payment steps (awaiting_payment…paid before confirmed) are only valid if delivery is PREPAY — BLOCKED by the open payment decision; if delivery becomes pay-on-receipt the delivery timeline must skip slip/verify steps. Note codebase ShopMode currently uses 'online' not canonical 'pickup' (store/mode.ts) — needs reconciliation so order records/labels stay consistent.

#### CUS-ORDERS-03 — Push notification on order status change  `🔴 MUST`
**As** customer (P1 น้องแนน), **I want** a push notification whenever my order's status changes, **so that** I don't have to keep reopening the app to know what is happening.

*Acceptance criteria:*
- Given notifications are permitted, When an order transitions to a customer-relevant OrderStatus (confirmed, preparing, out_for_delivery, ready_for_pickup, delivered, picked_up, payment_rejected, cancelled, delivery_failed), Then I receive exactly one push with Thai copy naming the order and its new status.
- Given I tap a status push, When the app opens, Then it deep-links directly to that order's detail (CUS-ORDERS-02).
- Given I have not yet granted notification permission, When I reach a point where it adds value (e.g. just after placing an order), Then I see a Thai rationale and the OS permission prompt, and declining still leaves in-app order status fully usable.
- Given permission is denied, When status changes occur, Then no push is sent but a Notification record is still created and surfaced in the in-app notifications list/badge.
- Given the same transition is delivered more than once (server retry), When notifications are processed, Then duplicates are de-duped so the customer sees one notification per transition.
- Given intermediate/admin-only transitions (placed, awaiting_payment, slip_uploaded, payment_verifying, assigned_to_rider), When they occur, Then no push fires for them — only the curated customer-relevant set — to avoid notification spam.
- (a11y / ป้าสมศรี) Given an in-app Notification row, When it renders, Then its text is dynamic-type friendly and the row is a ≥44pt target with an accessibilityLabel.

*Dependencies:* Push infrastructure (Expo push tokens / device token capture), Notification entity + in-app notifications list, PDPA consent at signup, CUS-ORDERS-02 for deep link

*Notes:* Status pushes are transactional (tied to a placed order), distinct from any marketing-consent push. Quiet hours / throttling are open. Whether delivery payment-status transitions fire pushes depends on the open delivery-prepay decision. The bell icon already exists in headers (cart.tsx / account.tsx) and can host the in-app list.

#### CUS-ORDERS-04 — Cancel an order before it is prepared  `🟠 SHOULD`
**As** customer, **I want** to cancel my order while it is still early in the process, **so that** I am not committed to an order I no longer need.

*Acceptance criteria:*
- Given an order in an early OrderStatus (placed, awaiting_payment, slip_uploaded, payment_verifying, or confirmed), When I open its detail, Then a 'ยกเลิกคำสั่งซื้อ' action is available.
- Given an order already in preparing, assigned_to_rider, out_for_delivery, ready_for_pickup, delivered, picked_up, or any terminal state, When I open its detail, Then self-cancel is hidden/disabled and I am directed to 'ติดต่อร้าน' instead.
- Given I tap cancel, When the confirmation dialog appears, Then I must confirm (with an optional Thai reason) before anything changes, and dismissing leaves the order unchanged.
- Given I confirm cancellation of an eligible order, When it succeeds, Then OrderStatus becomes cancelled, the timeline reflects it, and a confirmation is shown.
- Given the order advanced (e.g. to preparing) between screen load and my confirm, When I confirm, Then the cancel is rejected with a clear message and the detail refreshes to the new status (no silent failure).
- Given a cancelled order, When I view it, Then no further cancel is possible and reorder (CUS-ORDERS-05) is still offered.
- (a11y / ป้าสมศรี) Given the cancel dialog, When it shows, Then buttons are ≥44pt, labelled in Thai, AA-contrast, and the destructive action is distinguishable by text, not color alone.

*Dependencies:* CUS-ORDERS-02, Admin order state machine

*Notes:* Whether a PAID order can be self-cancelled and how it is refunded is BLOCKED by the open payment decision (no gateway in v1; refunds would be manual PromptPay by admin). Proposed safe v1 default: self-cancel allowed only up to confirmed and before PaymentStatus=paid; paid/preparing → contact shop. Confirm with stakeholders (openQuestions).

#### CUS-ORDERS-05 — Reorder a previous order  `🟠 SHOULD`
**As** customer (P2 ป้าสมศรี), **I want** to re-add the items from a past order to my cart in one tap, **so that** I can quickly buy my usual groceries again.

*Acceptance criteria:*
- Given a past order, When I tap 'สั่งซ้ำ', Then its still-available items are added to the cart preserving size and quantity, merged by line id (product + size) per the existing cart rules.
- Given some items are unavailable or removed from the catalog, When I reorder, Then available items are added and I see a clear Thai summary of what was skipped and why, without blocking the rest.
- Given a product's price changed since the original order, When items are added, Then the cart uses the current catalog price (not the historical price) and the summary reflects current totals and delivery-fee rules.
- Given the reorder succeeds, When it completes, Then I am taken to the cart with the added items visible and a confirmation.
- Given my cart already has matching items, When I reorder, Then reordered quantities merge into the existing lines rather than duplicating them.
- (a11y / ป้าสมศรี) Given the reorder control, When it renders, Then it is a ≥44pt button with a clear Thai accessibilityLabel (e.g. 'สั่งซ้ำ คำสั่งซื้อ …') and AA contrast.

*Dependencies:* store/cart.ts (cartItemId merge logic), data/products.ts catalog + product availability/stock model, CUS-ORDERS-01 / CUS-ORDERS-02

*Notes:* Requires product availability/stock to be modeled — NOT present in current data/products.ts; flag as a dependency. Reordered cart mode: proposed default to current ShopMode; confirm whether to restore the original order's mode (openQuestion).

#### CUS-ORDERS-06 — Recover from a rejected payment  `🟠 SHOULD`
**As** customer, **I want** to be told clearly when my transfer slip is rejected and be able to re-submit, **so that** my order is not silently stuck and I can still get my groceries.

*Acceptance criteria:*
- Given an admin rejects my slip, When the order updates, Then OrderStatus becomes payment_rejected and PaymentStatus becomes rejected, I get a push (CUS-ORDERS-03), and the order detail shows a Thai reason plus a 'แนบสลิปใหม่' CTA.
- Given a payment_rejected order, When I tap 'แนบสลิปใหม่', Then I am taken to the slip-upload flow (owned by the checkout/payment epic) pre-scoped to that order.
- Given I successfully re-upload, When it is submitted, Then PaymentStatus returns to slip_uploaded and OrderStatus re-enters the payment_verifying path, and the timeline reflects the resubmission.
- Given a payment_rejected order I no longer want, When I view it, Then I can cancel it (per CUS-ORDERS-04 rules) instead of re-uploading.
- Given repeated rejections, When I re-upload again, Then each attempt is recorded and only the latest PaymentStatus/OrderStatus is shown (no orphaned states).
- (a11y / ป้าสมศรี) Given the rejection reason and CTA, When they render, Then text is dynamic-type friendly, AA-contrast, and the CTA is a ≥44pt labelled button.

*Dependencies:* Checkout/payment epic (slip-upload UI), CUS-ORDERS-02, CUS-ORDERS-03

*Notes:* promptpay_slip is the only v1 PaymentMethod, so this recovery path is concrete for pickup. Its applicability to DELIVERY depends on the open delivery-prepay decision (BLOCKED). Re-upload attempt limits / slip expiry are open.

#### CUS-ORDERS-07 — Rate a completed order and contact the shop (light)  `🟡 COULD`
**As** customer, **I want** to leave a quick rating after my order is done and an easy way to reach the shop, **so that** I can give feedback or get help with a problem.

*Acceptance criteria:*
- Given an order in delivered or picked_up, When I view its detail, Then a light rating control (1–5 ดาว + optional Thai comment) is available, and submitting shows a thank-you and makes the rating read-only.
- Given an order not yet in a terminal-success state, When I view it, Then rating is hidden/disabled (only completed orders can be rated).
- Given any active order, When I view its detail, Then a 'ติดต่อร้าน' action is available (call / LINE / chat link) so I can reach the shop.
- Given the rating submit fails, When I retry, Then my entered stars/comment are preserved and no duplicate rating is created.
- Given I already rated an order, When I reopen it, Then my previous rating shows read-only (single rating per order in v1).
- (a11y / ป้าสมศรี) Given the star control, When it renders, Then each star is a ≥44pt target with an accessibilityLabel (e.g. 'ให้ 4 ดาว'), works with the screen reader, and passes AA contrast.

*Dependencies:* CUS-ORDERS-02, Shop contact channel (LINE / phone / in-app chat)

*Notes:* 'Light' scope: rating stored against the Order, visible to admin only in v1 (no public reviews, no per-product reviews). Contact channel (tel: vs LINE deep link vs in-app chat) is an openQuestion.


## เว็บแอดมิน (Admin Web)

### ADM-AUTH — Admin Auth & Roles
> Shop owner and staff can securely sign in to the อู้ฟู่ admin web, act only within their permitted scope, stay protected by session and audit controls, and have every sensitive action attributable.

#### ADM-AUTH-01 — Staff/owner sign-in to admin web  `🔴 MUST`
**As** shop owner or staff member (เฮียอู้ฟู่ and his staff), **I want** to sign in to the อู้ฟู่ admin web using my registered phone number + OTP (or LINE/Apple/Google), **so that** only authorised shop people can reach the back office.

*Acceptance criteria:*
- Given a user whose account holds Roles=admin enters a valid registered phone number, When they request an OTP, Then an OTP is sent to that number and an OTP-entry field appears with a visible countdown and a disabled 'ขอรหัสใหม่' (resend) link until the countdown ends.
- Given a valid OTP is entered before it expires, When they submit, Then a session is created, they land on the admin dashboard, and a success audit entry is recorded (actor, timestamp, source IP/device, result=success).
- Given a phone number or social account that does NOT hold Roles=admin (e.g. a customer or rider), When OTP/social auth itself succeeds, Then admin access is denied with the non-enumerating message 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบหลังร้าน' and a denied-access audit entry is recorded (see ADM-AUTH-02).
- Given an expired or wrong OTP, When submitted, Then an inline error 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' is shown, the OTP field keeps focus, and the attempt counts toward rate-limiting.
- Given the phone field is empty, When the user requests an OTP, Then a required-field error is shown and no OTP is sent.
- Given the failed-OTP threshold is exceeded for a number (proposed default 5 attempts / 10 min), When the next attempt is made, Then OTP requests for that number are temporarily locked for a cool-down and the user sees 'ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง'; the lockout is audit-logged.
- A11y: Given the admin login page, Then every field has a programmatic label, errors are announced via aria-live and associated with their field, contrast meets WCAG 2.1 AA, the page stays usable at 200% browser zoom / OS large-text, all interactive targets are >= 44x44px, and the page is fully keyboard-operable with a visible focus indicator.

*Dependencies:* Locked customer-app auth infra (phone+OTP, LINE/Apple/Google), Platform User/Roles store

*Notes:* Admin reuses the locked phone+OTP / social auth; only the Roles=admin gate differs. OPEN: exact admin credential method (reuse phone+OTP/social vs dedicated email+password) and whether the owner must use mandatory 2FA. ป้าสมศรี (P2) is a customer/pickup persona, not an admin user; the same a11y baseline (dynamic type, >=44pt targets, WCAG AA) is still applied because shop staff may share her needs.

#### ADM-AUTH-02 — Role-gated access to the admin web  `🔴 MUST`
**As** shop owner, **I want** the admin web to be reachable only by accounts with Roles=admin, **so that** customers and riders can never see back-office data or customer PII.

*Acceptance criteria:*
- Given an authenticated user with Roles=customer or Roles=rider, When they navigate or deep-link to any admin route, Then they are redirected to an access-denied page and the admin API returns 403 to their token (no data leaks).
- Given an authenticated Roles=admin user, When they request an admin route, Then access is granted subject to their owner/staff permission tier (ADM-AUTH-03).
- Given an unauthenticated request to any admin route or admin API, Then it is rejected (redirect to login / 401) and no PII renders before auth resolves.
- Given a user's role is changed or revoked while they hold an active session, When their next request is made, Then the server re-checks the role and revokes access if it is no longer Roles=admin.
- Given any denied access attempt, Then an audit entry (actor, route, result=denied) is recorded.

*Dependencies:* ADM-AUTH-01

*Notes:* Roles enum is customer|admin|rider verbatim; owner vs staff is a sub-tier within admin, not a separate Roles value (see open questions). Authorization must be enforced server-side, not by merely hiding UI.

#### ADM-AUTH-03 — Owner vs staff permission tiers  `🔴 MUST`
**As** shop owner (เฮียอู้ฟู่), **I want** staff accounts limited to operational actions while owner-only actions stay with me, **so that** staff can run day-to-day orders without changing sensitive settings or managing other staff.

*Acceptance criteria:*
- Given a Roles=admin user with the owner tier, Then they can access all admin areas: catalog, orders, payment-slip verification, rider assignment, dashboard, staff management, audit log, and shop settings.
- Given a Roles=admin user with the staff tier, Then they can access operational areas (orders, catalog edits, payment-slip verification, rider assignment), but staff management, audit-log viewing, and shop settings are hidden in the UI AND blocked server-side (403 on direct call).
- Given a staff-tier user attempts an owner-only action via API, Then it returns 403 and is audit-logged as a denied attempt.
- Given the permission matrix, Then every protected action maps to exactly one required tier/permission, and that matrix is the single source of truth used by both UI gating and server checks.
- Edge: Given the very first or only admin account, Then it must be owner tier so the shop is never left without an owner.

*Dependencies:* ADM-AUTH-02

*Notes:* Owner/staff modeled as a permission attribute on the admin role pending the open question on promoting them to first-class Roles. The exact staff-allowed action set (which slip/order/catalog actions) is a proposed default needing PO sign-off.

#### ADM-AUTH-04 — Owner manages staff accounts  `🟠 SHOULD`
**As** shop owner, **I want** to invite, assign a tier to, and deactivate staff accounts, **so that** I control who has back-office access as people join or leave.

*Acceptance criteria:*
- Given the owner opens staff management and invites a staff member by phone number, When the invite is sent, Then an admin account with Roles=admin + staff tier is provisioned in a pending state and the action is audit-logged.
- Given a pending invite, When the invitee completes phone+OTP / social sign-in, Then their account activates and they gain staff-tier access.
- Given the owner deactivates or revokes a staff account, Then that account immediately loses admin access (active sessions invalidated on next request) and the change is audit-logged.
- Given the owner tries to deactivate the last remaining owner, Then the action is blocked with 'ต้องมีเจ้าของอย่างน้อยหนึ่งคน'.
- Empty state: Given no staff have been added yet, Then the list shows an empty state with a clear 'เพิ่มพนักงาน' call to action.
- Error: Given an invite to a phone number that already holds Roles=admin, Then a duplicate error is shown and no second account is created.
- A11y: The staff table and its actions are keyboard-operable, icon-only action buttons carry text labels, and each status (active / pending / revoked) is conveyed by text+icon, not color alone.

*Dependencies:* ADM-AUTH-03

*Notes:* PDPA: staff phone numbers are personal data — capture a lawful basis and show them only to the owner. OPEN: whether staff get granular per-permission toggles or a fixed staff tier (affects ADM-AUTH-03).

#### ADM-AUTH-05 — Session security & secure logout  `🔴 MUST`
**As** shop owner, **I want** admin sessions to time out, be revocable, and log out cleanly, **so that** an unattended or lost device cannot be used to access shop and customer data.

*Acceptance criteria:*
- Given an active admin session idle past the idle threshold (proposed default 30 min), When the user next interacts, Then they are signed out and must re-authenticate, and any unsaved sensitive form warns before discarding.
- Given a session older than the absolute max lifetime (proposed default 12 h), Then it expires regardless of activity and requires a fresh sign-in.
- Given the user clicks 'ออกจากระบบ', Then the session/token is invalidated server-side (not just cleared client-side), the user returns to login, and a logout audit entry is recorded.
- Given the owner views active sessions, Then they can see their own active sessions/devices and revoke any one; revocation takes effect on that device's next request.
- Edge: Given a token is replayed after logout, expiry, or revocation, Then the server rejects it (401) and logs the attempt.
- Security: tokens are not exposed to XSS (httpOnly/secure where applicable) and are transmitted only over HTTPS.

*Dependencies:* ADM-AUTH-01

*Notes:* OPEN: concrete idle/absolute timeout values and whether a 'remember this device' option is permitted need a security-policy decision.

#### ADM-AUTH-06 — Step-up re-auth for sensitive actions  `🟠 SHOULD`
**As** shop owner, **I want** high-impact actions to require a fresh identity check, **so that** a walk-up to an already-open admin screen cannot approve payments or change prices.

*Acceptance criteria:*
- Given a user initiates a sensitive action — approving/rejecting a payment slip (moving PaymentStatus verifying -> paid or verifying -> rejected), bulk price/stock changes, or staff management — And their last authentication is older than the step-up window (proposed default 10 min), When they confirm, Then they must re-enter an OTP before the action commits.
- Given step-up succeeds, Then the action commits and the audit entry records that step-up was satisfied.
- Given step-up fails or is cancelled, Then the action is not committed and state is unchanged (e.g. PaymentStatus stays verifying and OrderStatus stays payment_verifying).
- Edge: Given the payment decision (prepay vs pay-on-receipt for delivery, gateway, COD) is still open, Then which payment actions require step-up for delivery vs pickup orders is provisional and must be revisited once that decision lands (see open questions).

*Dependencies:* ADM-AUTH-01, ADM-AUTH-05

*Notes:* BLOCKED by the open payment decision: v1's only PaymentMethod is promptpay_slip, so slip approve/reject is the only payment action covered; if a gateway or COD is added, step-up rules must extend. Step-up window value needs security sign-off.

#### ADM-AUTH-07 — Audit log of admin actions  `🔴 MUST`
**As** shop owner, **I want** an append-only record of who did what and when, **so that** I can investigate mistakes/disputes and meet PDPA accountability.

*Acceptance criteria:*
- Given any of these events occurs — sign-in success/failure, access denied, logout, staff invite/deactivate, payment-slip approve (-> PaymentStatus paid) / reject (-> PaymentStatus rejected), OrderStatus changes, and catalog/price/stock edits — Then an audit entry is appended with actor (admin id + tier), action, target entity/id, before/after where applicable, timestamp, and source IP/device.
- Given the owner opens the audit log, Then entries are listed newest-first and can be filtered by actor, action type, and date range; staff-tier users cannot view it (403).
- Given audit entries exist, Then they are append-only/immutable (no edit or delete via the app) and survive even if the related staff account is later deactivated.
- Empty/edge: Given a filter returns no rows, Then a clear empty state is shown; given a very large date range, results are paginated.
- PDPA: Given audit entries reference customer orders/PII, Then access is owner-only, only the minimum data needed is shown, and a defined retention period applies (see open questions).

*Dependencies:* ADM-AUTH-01, ADM-AUTH-03

*Notes:* OrderStatus and PaymentStatus values referenced use the canonical enums verbatim. OPEN: audit-log retention duration and PDPA export/erasure handling for entries containing customer PII.

### ADM-CATALOG — Catalog Management (จัดการแคตตาล็อกสินค้า)
> Give the shop admin (เฮียอู้ฟู่) full control to create, price, stock, image, publish/unpublish and retire products and categories so the customer app never shows an "out of stock but orderable" product and ป้าสมศรี never taps into a dead or unavailable item.

#### ADM-CAT-01 — สร้างสินค้าใหม่ (Create a product)  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** เพิ่มสินค้าใหม่เข้าแคตตาล็อกพร้อมข้อมูลที่จำเป็น (ชื่อ หมวด ราคา รูป และสต็อกเริ่มต้น), **so that** ลูกค้าได้เห็นและสั่งสินค้าใหม่ โดยข้อมูลถูกต้องครบถ้วนตั้งแต่ครั้งแรก ไม่ต้องไปแก้หลายที่ภายหลัง.

*Acceptance criteria:*
- Given a user with role=admin on the catalog screen, When they open 'เพิ่มสินค้า', Then a form shows: name (required), subtitle, description, category (required, chosen from existing categories), price in THB (required), images (≥1 required), initial stockQty (required, integer ≥ 0), sizes (optional) — and the product defaults to publishState=draft (unpublished).
- Given all required fields are valid, When the admin saves, Then the product persists with a unique id, appears in the admin product list, and is NOT visible in the customer app until it is published (see ADM-CAT-04).
- Given a required field is blank (name / category / price / no image), When the admin saves, Then the save is blocked, an inline Thai error is shown per missing field (e.g. 'กรุณากรอกราคา', 'ต้องมีรูปอย่างน้อย 1 รูป'), and no partial product is created.
- Given price is entered as 0, negative, or non-numeric, When the admin saves, Then it is rejected with 'ราคาต้องมากกว่า 0' (guards the money() NaN/negative baseline, ROBUST-1); Given stockQty is negative or a decimal, Then it is rejected with 'จำนวนสต็อกต้องเป็นจำนวนเต็มและไม่ติดลบ'.
- Given a name that duplicates an existing active product, When the admin saves, Then a non-blocking warning 'มีสินค้าชื่อนี้แล้ว' is shown and the admin may confirm or cancel (duplicates allowed but flagged).
- Given a user with role=customer or role=rider, When they attempt to reach catalog management, Then access is denied (no create form is reachable).

*Dependencies:* ADM-CAT-06

*Notes:* Product shape comes from data/products.ts (name, subtitle, description, price, rating, images[], colors[], sizes[], category). New fields stockQty + publishState are introduced by this epic. rating stays catalog-seeded in v1 (real user reviews are out of scope per docs/01). OPEN: should a size variant (e.g. ข้าวหอมมะลิ '1 กก.'/'5 กก.', น้ำดื่ม '600 มล.'/'1.5 ลิตร') carry its OWN price and stockQty? Today there is one shared price/stock per product yet the cart already keys by productId+size (store/cart.ts) — flagged as open question, do not assume.

#### ADM-CAT-02 — แก้ไขข้อมูลสินค้าและราคา (Edit product details & price)  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** แก้ไขฟิลด์ใด ๆ ของสินค้ารวมถึงราคา แล้วให้การเปลี่ยนแปลงไปแสดงผลฝั่งลูกค้า, **so that** แก้คำผิด/ปรับราคาได้ที่เดียวจบ (ตรงกับ pain ของเฮียอู้ฟู่ 'แก้ราคาหลายที่').

*Acceptance criteria:*
- Given an existing product, When the admin edits name / subtitle / description / category / sizes / price and saves valid values, Then the changes persist and the customer app reflects them on next load.
- Given a price set to ≤ 0 or non-numeric, When the admin saves, Then it is rejected with 'ราคาต้องมากกว่า 0' and the previous price is left unchanged (validation is the guard since money() has no NaN/negative protection, ROBUST-1).
- Given a customer already has the product in their cart at the old price, When the admin changes the price, Then checkout uses the NEW price and the customer cart line recomputes via cartSubtotal (no silent old-price honoring in v1); this behavior is documented to the admin.
- Given two admins edit the same product concurrently, When the second admin saves over stale data, Then a conflict warning 'ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่' is shown instead of silently overwriting.
- Given any successful save, Then a basic audit record (who / when / which fields changed) is stored.
- Given a user without role=admin, When they attempt to edit, Then the action is denied.

*Dependencies:* ADM-CAT-01

*Notes:* Preserve the real seeded prices when demoing (ข้าวหอมมะลิ 165, ไข่ไก่ 125, นมจืด 55, บะหมี่ 42, น้ำดื่ม 14, น้ำมันพืช 58, ผงซักฟอก 69, มันฝรั่ง 25). Whether THB price allows satang or is integer-only is an open question (see ADM-CAT-08-adjacent currency note).

#### ADM-CAT-03 — สต็อกและสถานะพร้อมขาย — กันสั่งของที่หมด (Stock & availability, prevents out-of-stock ordering)  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** กำหนดจำนวนสต็อกและสถานะพร้อมขาย (รวมถึงพร้อมขายแยกตามโหมด) ของแต่ละสินค้า, **so that** ปิดความเสี่ยงพื้นฐาน 'ของหมดแต่ลูกค้ายังสั่งได้' และป้าสมศรีไม่สั่งของรับที่ร้านที่ของหมดไปแล้ว.

*Acceptance criteria:*
- Given a product, When the admin sets stockQty (integer ≥ 0), Then it persists and the admin list shows the current stock.
- Given stockQty = 0 OR availability = unavailable, When a customer views the product, Then the customer app marks it 'สินค้าหมด', disables Add-to-cart / Buy, and the product cannot be placed in an order.
- Given a customer already has the item in their cart and it drops to stockQty = 0 before checkout, When they reach checkout, Then that line is flagged 'สินค้าหมด' and must be removed before the order can be placed (no order may contain an unavailable line).
- Given the admin marks a product available for ShopMode pickup only (e.g. a ของสด fresh item not suitable for delivery), When a customer is in ShopMode delivery, Then the item shows 'ไม่พร้อมส่งเดลิเวอรี่' and is not orderable in delivery, but remains orderable in pickup.
- Given the 'สินค้าหมด' / unavailable state in the customer app, Then its badge meets WCAG AA contrast, exposes an accessible name to screen readers (accessibilityLabel 'สินค้าหมด'), and the disabled Add button sets accessibilityState disabled — so a low-vision pickup customer (ป้าสมศรี) is not misled into a dead tap.
- Given concurrent orders that would drive stock below 0, When orders are placed, Then overselling is prevented (stock cannot go negative); the exact reserve/decrement moment is deferred (see notes).

*Dependencies:* ADM-CAT-01

*Notes:* data/products.ts currently has NO stock/availability field — this epic adds stockQty, availability, and availabilityByMode keyed by ShopMode (delivery | pickup). BLOCKED/OPEN: when is stock reserved/decremented — at OrderStatus placed, at PaymentStatus paid, or at fulfillment (ready_for_pickup / out_for_delivery)? This depends on the unresolved delivery prepay (promptpay_slip) vs pay-on-receipt decision; do not finalize the overselling guard until that ADR lands.

#### ADM-CAT-04 — เผยแพร่ / ซ่อนสินค้า (Publish / unpublish)  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** สลับสถานะสินค้าระหว่างฉบับร่าง (draft) กับเผยแพร่ (published), **so that** เตรียมสินค้าเป็นการภายในก่อน และควบคุมได้ว่าลูกค้าจะเห็นอะไร รวมถึงดึงสินค้าออกได้ทันที.

*Acceptance criteria:*
- Given a draft product that has the required fields (name, category, price, ≥1 image), When the admin publishes it, Then it becomes visible in the customer app browse / search / category lists.
- Given a product missing required fields, When the admin attempts to publish, Then publish is blocked and a checklist of what is missing is shown (e.g. 'ต้องมีรูปอย่างน้อย 1 รูป', 'ต้องมีราคา').
- Given a published product, When the admin unpublishes it, Then it disappears from all customer lists on next load, cannot be added to cart, and any existing cart line referencing it is treated as unavailable at checkout (must be removed before placing the order).
- Given a published product with stockQty = 0, Then it remains VISIBLE but shown as 'สินค้าหมด' (not orderable); whereas an unpublished product is HIDDEN entirely — the two states are distinct and independently testable.
- Given an unpublished product, When ป้าสมศรี browses, Then she never sees it and there are no orphan links that lead to a removed/empty product page.
- Given a user without role=admin, When they attempt publish/unpublish, Then the action is denied.

*Dependencies:* ADM-CAT-01, ADM-CAT-05

*Notes:* publishState (draft | published) is introduced here and is separate from stock/availability (ADM-CAT-03). Archiving (ADM-CAT-08) hides like unpublish but additionally retains the record for history.

#### ADM-CAT-05 — รูปสินค้าและข้อความแทนภาพ (Manage images + accessible alt text)  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** อัปโหลด/จัดลำดับ/ลบรูปสินค้า และใส่ข้อความแทนภาพ (alt text) ภาษาไทยให้แต่ละรูป, **so that** สินค้าดูน่าซื้อ และ screen reader / สายตาเลือนของป้าสมศรีได้รับคำอธิบายภาพที่มีความหมาย.

*Acceptance criteria:*
- Given the product edit screen, When the admin uploads ≥1 image, Then images persist and the FIRST image is the primary/grid image (matches the images[0] convention in data/products.ts).
- Given multiple images, When the admin reorders or removes them, Then the order updates and the new first image becomes primary; the admin cannot remove the last remaining image of a published product (shows 'ต้องมีรูปอย่างน้อย 1 รูป').
- Given an unsupported file type or an oversized file, When the admin uploads, Then it is rejected with a Thai error; the accepted types and max size are stated in the UI.
- Given each image, When the admin saves, Then a Thai alt text / accessible name is captured (prompted) and rendered as the image accessibilityLabel in the customer app; if left blank, a fallback (the product name) is used so the image is NEVER unlabeled to a screen reader (addresses baseline A11Y-1).
- Given a draft product with no images yet, Then the form shows a 'ยังไม่มีรูป' placeholder and publishing is blocked until ≥1 image exists.
- Given a stored image URL fails to load in the customer app, Then a labeled placeholder is shown (not a broken-image element with no accessible name).

*Dependencies:* ADM-CAT-01

*Notes:* Today's catalog uses remote picsum.photos URIs in images[] with no alt text; this story adds the alt-text field. Directly serves persona ป้าสมศรี and clears baseline a11y debt for unlabeled imagery. Image hosting/storage target and limits are an open question (see openQuestions).

#### ADM-CAT-06 — จัดการหมวดหมู่ (Manage categories — CRUD)  `🟠 SHOULD`
**As** admin (เฮียอู้ฟู่), **I want** สร้าง/เปลี่ยนชื่อ/จัดลำดับ/ลบหมวดหมู่สินค้า, **so that** จัดระเบียบแคตตาล็อก และแถบหมวดหมู่ฝั่งลูกค้าสะท้อนสินค้าจริงของร้าน.

*Acceptance criteria:*
- Given v1 launch, Then the five seed categories exist: ของสด, เครื่องดื่ม, ของแห้ง, ของใช้ในบ้าน, ขนม (matching data/products.ts).
- Given the category manager, When the admin adds a category, renames one, or changes display order, Then the change persists and the order drives the customer chip-row order on next load.
- Given the 'ทั้งหมด' All-filter, When the admin tries to create / rename / delete it, Then the action is blocked because 'ทั้งหมด' is a reserved virtual filter, not a stored category.
- Given a category that still contains products, When the admin tries to delete it, Then deletion is blocked with 'ยังมีสินค้าในหมวดนี้' and the admin must reassign/move those products first (no orphaned-category products).
- Given a category rename, Then linked products keep their association and the customer app shows the new name on next load.
- Given a newly created category with no products, Then admin shows 'ยังไม่มีสินค้าในหมวดนี้', and in the customer app an empty category is hidden from the chip row (define) so customers never tap into an empty list.
- Given long Thai category names, Then chips support dynamic type and do not truncate text (addresses baseline A11Y-6).

*Notes:* ProductCategory is currently a hardcoded TS union in data/products.ts; this story promotes categories to admin-managed data while keeping 'ทั้งหมด' as the virtual All filter in the customer chip row.

#### ADM-CAT-07 — เกณฑ์สต็อกต่ำและการแจ้งเตือน (Low-stock threshold & alerts)  `🟠 SHOULD`
**As** admin (เฮียอู้ฟู่), **I want** ตั้งเกณฑ์สต็อกต่ำต่อสินค้า และได้รับการแจ้งเตือน/เห็นรายการสต็อกต่ำ, **so that** เติมของได้ทันก่อนหมด ลดเซอร์ไพรส์ 'ของหมด' ที่กระทบลูกค้าอย่างป้าสมศรี.

*Acceptance criteria:*
- Given a product, When the admin sets a lowStockThreshold (integer ≥ 0; default e.g. 5), Then it persists.
- Given the catalog, Then the admin can open a 'สต็อกต่ำ/หมด' list of products where stockQty ≤ lowStockThreshold (including 0), sorted lowest-stock first.
- Given a product crosses from above its threshold to ≤ threshold (e.g. via incoming orders), Then an in-app admin Notification 'สต็อกใกล้หมด: <ชื่อสินค้า> เหลือ N' is created (Notification entity), de-duplicated so it does not fire repeatedly while the item stays low.
- Given stockQty reaches 0, Then a distinct 'สินค้าหมด: <ชื่อสินค้า>' notification is created and the item is treated as out-of-stock per ADM-CAT-03.
- Given no products are at or under threshold, Then the low-stock list shows the empty state 'สต็อกครบทุกรายการ'.
- Given the admin changes a threshold above current stock, Then the product is immediately re-evaluated and appears in the low-stock list.

*Dependencies:* ADM-CAT-03

*Notes:* Uses the Notification core entity. v1 scope is an in-app admin low-stock list + notification; push-to-admin is a nice-to-have. Does not depend on the payment decision.

#### ADM-CAT-08 — เก็บถาวร / ลบสินค้าอย่างปลอดภัย (Archive / delete product safely)  `🟠 SHOULD`
**As** admin (เฮียอู้ฟู่), **I want** เก็บถาวรหรือลบสินค้าโดยไม่ทำลายประวัติออเดอร์, **so that** เลิกขายสินค้าที่ยกเลิกได้ ขณะที่ออเดอร์เก่ายังแสดงผลถูกต้อง.

*Acceptance criteria:*
- Given a product, When the admin archives it, Then it is removed from the active catalog and the customer app (like unpublish) but its record + images are retained for reporting and for existing OrderItem references.
- Given a product referenced by any OrderItem in a non-terminal OrderStatus (placed, awaiting_payment, slip_uploaded, payment_verifying, confirmed, preparing, assigned_to_rider, out_for_delivery, ready_for_pickup), When the admin attempts a hard delete, Then it is blocked with 'สินค้านี้อยู่ในออเดอร์ที่กำลังดำเนินการ' and archiving is offered instead.
- Given a product referenced only by terminal orders (delivered, picked_up, cancelled, payment_rejected, delivery_failed), When it is archived/deleted, Then those past orders still render the product name and price because OrderItem stores a snapshot rather than a live join.
- Given an archived product, When the admin restores it, Then it returns as draft (unpublished) and must be re-published before customers see it.
- Given a destructive delete, Then a confirm dialog is required and its confirm/cancel buttons carry accessibilityLabels (addresses baseline A11Y-1).
- Given no archived products, Then the archived list shows 'ไม่มีสินค้าที่เก็บถาวร'.

*Dependencies:* ADM-CAT-01

*Notes:* Uses the OrderStatus enum lifecycle verbatim. Requires OrderItem to snapshot name/price so deletion is safe. PromoCode coupling to specific products is out of scope for this epic.

#### ADM-CAT-09 — แก้ราคา/สต็อกเร็วแบบหลายรายการ (Quick / bulk price & stock edit)  `🟡 COULD`
**As** admin (เฮียอู้ฟู่), **I want** แก้ราคาและสต็อกแบบ inline จากหน้ารายการสินค้า และทำหลายรายการพร้อมกัน, **so that** อัปเดตของจำนวนมากได้เร็วในตอนเช้าก่อนเปิดร้าน.

*Acceptance criteria:*
- Given the product list, When the admin edits stockQty or price inline and confirms, Then it saves using the same validation as ADM-CAT-02/03 (price > 0, stockQty integer ≥ 0).
- Given selected rows, When the admin runs a bulk publish / unpublish / archive, Then a single confirm applies the action to all selected products.
- Given a bulk action where some rows fail validation, When it runs, Then valid rows succeed and failed rows are listed with reasons — nothing is silently dropped.
- Given the bulk-select controls and per-row actions, Then checkboxes and action buttons have accessibilityLabels and are keyboard-operable on the admin web.

*Dependencies:* ADM-CAT-02, ADM-CAT-03

*Notes:* Pure efficiency; v1 can ship without it. Lowest priority of the epic.

### ADM-ORDERS — Order Management & Rider Assignment
> Give the shop admin one reliable queue to view, advance, fulfil (assign riders for delivery, mark pickup ready), and cancel orders with clear SLA and refund-note tracking, strictly following the canonical OrderStatus lifecycle.

#### ADM-ORD-01 — Live incoming order queue  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** a live queue of incoming orders showing status and mode at a glance, **so that** I never miss a new order and can decide what to work on next.

*Acceptance criteria:*
- Given active orders exist, When admin opens Orders, Then a list shows each order's id, customer name, ShopMode (delivery|pickup), OrderStatus, item count, total in THB, and time-placed, sorted newest-first by default.
- Given orders span several statuses, When admin filters by OrderStatus and/or ShopMode, Then only matching orders show and the active filter is visible and clearable.
- Given a new order is placed while the queue is open, When the backend receives it, Then it appears within 30s via live update or auto-refresh (no manual reload) with an 'unseen' indicator.
- Given no orders match the current filter, When the list renders, Then an empty state reads 'ยังไม่มีออเดอร์' and names the active filter.
- Given the queue request fails, When it loads, Then an error state with a Retry action is shown (never a blank screen).
- Given an order is in a terminal status (cancelled, delivered, picked_up, payment_rejected, delivery_failed), When the default queue loads, Then it is excluded from the active queue but reachable via a 'closed/completed' filter.

*Dependencies:* ADM-AUTH (admin login), Order backend

*Notes:* ShopMode enum is delivery|pickup; existing customer code (store/mode.ts) labels pickup as ออนไลน์/online so UI copy may show ออนไลน์ even though the value is pickup. Totals reuse money() THB formatting; delivery fee 40 THB, free when subtotal>=200 (deliveryFeeFor).

#### ADM-ORD-02 — Order detail view  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** the full detail of a single order, **so that** I can prepare it correctly and answer customer questions.

*Acceptance criteria:*
- Given an order, When admin opens it, Then it shows each OrderItem (name, size, qty, unit price, line total), subtotal, delivery fee, and grand total in THB.
- Given mode=delivery, Then the delivery fee shows 40 THB or 'ฟรี' when subtotal>=200; Given mode=pickup, Then delivery fee is 0 and no fee row is implied.
- Given a delivery order, Then the customer's Address and phone are shown; Given a pickup order, Then a 'รับที่ร้าน' label and customer phone are shown with no address.
- Given any order, Then current OrderStatus, ShopMode, PaymentMethod (promptpay_slip), and PaymentStatus (awaiting_payment|slip_uploaded|verifying|paid|rejected) are displayed, plus a chronological status history with timestamps.
- Given a slip was uploaded, Then the slip image is viewable read-only and zoomable here (approve/reject lives in the payment epic).
- Given an invalid or unknown order id, Then a not-found state with a back-to-queue action is shown.

*Dependencies:* ADM-ORD-01, ADM-PAY (slip verification epic)

*Notes:* Detail is read-only on payment; slip approve/reject is a separate epic. money() THB formatting; OrderItem shape mirrors CartItem (product, qty, size) from store/cart.ts.

#### ADM-ORD-03 — Advance order along the canonical lifecycle  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** to move an order forward through valid OrderStatus transitions only, **so that** customers and riders always see accurate progress and no step is skipped.

*Acceptance criteria:*
- Given an order at confirmed, When admin taps the primary advance action, Then OrderStatus becomes preparing, the change is timestamped, and it is visible to the customer.
- Given the current OrderStatus, When admin views actions, Then only transitions valid from that state are offered (from preparing: delivery -> assign rider; pickup -> ready_for_pickup); invalid/skip transitions are never selectable.
- Given the lifecycle, Then the enforced forward path is placed -> awaiting_payment -> slip_uploaded -> payment_verifying -> confirmed -> preparing -> [delivery: assigned_to_rider -> out_for_delivery -> delivered | pickup: ready_for_pickup -> picked_up], and the UI cannot skip a required step.
- Given two admins act on the same order, When one advances it, Then the other's now-stale action is rejected with a 'this order already changed' message (optimistic concurrency) and no double-transition occurs.
- Given a transition fails (network/server), Then OrderStatus is unchanged, an error with Retry shows, and no partial update persists.
- Given pickup mode (paid up-front), When PaymentStatus is not paid, Then advancing to confirmed is blocked with a clear reason.

*Dependencies:* ADM-ORD-02

*Notes:* BLOCKED BY OPEN PAYMENT DECISION: whether a DELIVERY order may reach confirmed/assigned_to_rider before PaymentStatus=paid is UNRESOLVED (prepay vs pay-on-receipt). Do NOT enforce a payment gate on delivery until decided. Pickup is paid up-front per product spec, so the pickup gate above is safe.

#### ADM-ORD-04 — Assign / reassign a rider for delivery  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** to assign one of the shop's own riders to a delivery order, **so that** the order gets delivered and the rider is notified.

*Acceptance criteria:*
- Given a delivery order at preparing, When admin opens 'assign rider', Then a list of users with Role=rider marked available is shown; selecting one sets OrderStatus=assigned_to_rider, creates/links a Delivery record, and notifies that rider.
- Given a pickup order, Then no rider-assignment action is offered (mode-gated).
- Given no riders are available, When admin opens assign, Then an empty state 'ไม่มีไรเดอร์ว่าง' is shown and the order stays at preparing.
- Given an order at assigned_to_rider (not yet out_for_delivery), When admin reassigns, Then the previous rider is unassigned and notified, the new rider is assigned, and history records both events.
- Given assignment fails, Then OrderStatus and the Delivery record are unchanged and an error with Retry is shown.
- Given a rider reported the delivery as delivery_failed (terminal branch), When admin opens the order, Then admin can re-attempt by reassigning a rider (back to assigned_to_rider) or cancel, and the failure reason is recorded.
- Given out_for_delivery and delivered are driven by the rider app, Then admin sees those updates read-only in history.

*Dependencies:* ADM-ORD-03, RID app (rider availability + status updates), Rider/Delivery entities

*Notes:* out_for_delivery -> delivered are owned by the Rider epic; admin override of those is out of scope here. OPEN: whether assignment may occur before payment is verified for delivery depends on the prepay/pay-on-receipt decision (see open questions). OPEN: how a rider becomes 'available'.

#### ADM-ORD-05 — Mark pickup order ready_for_pickup and picked_up  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** to tell a pickup customer their order is ready and confirm collection, **so that** customers like ป้าสมศรี arrive at the right time and the order is closed.

*Acceptance criteria:*
- Given a pickup order at preparing with PaymentStatus=paid, When admin taps 'พร้อมให้รับ', Then OrderStatus=ready_for_pickup and a customer Notification is sent.
- Given a pickup order at preparing with PaymentStatus != paid, Then the ready-for-pickup action is blocked with a reason (pickup is paid up-front).
- Given the customer collects, When admin taps 'รับสินค้าแล้ว', Then OrderStatus=picked_up (terminal) and the order moves to closed.
- Given a delivery order, Then ready_for_pickup and picked_up actions are not offered (mode-gated).
- A11y (ป้าสมศรี, elderly pickup customer): the customer-facing ready_for_pickup notification and any pickup-status screen she sees must meet WCAG AA contrast, support dynamic type (large text) without truncation, use touch targets >= 44x44, carry an accessibilityLabel on icon-only controls, use plain Thai (e.g. 'ออเดอร์ของคุณพร้อมให้รับที่ร้านแล้วค่ะ'), and never convey readiness by color alone.
- Given the notification send fails, Then OrderStatus still updates and admin sees a non-blocking warning that the customer was not notified, with a Resend action.

*Dependencies:* ADM-ORD-03, Notification entity, PaymentStatus from ADM-PAY

*Notes:* Pickup is paid up-front (product spec). ShopMode value is pickup though existing customer UI labels it ออนไลน์/online. OPEN: customer notification channel (push/SMS/LINE) and Thai-copy ownership.

#### ADM-ORD-06 — Cancel order with reason and refund note  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** to cancel an order and record any refund owed, **so that** we keep an auditable record and the customer is informed.

*Acceptance criteria:*
- Given a non-terminal order, When admin cancels, Then admin must select/enter a reason, OrderStatus=cancelled (terminal), and the customer is notified.
- Given the order's PaymentStatus=paid, When admin cancels, Then admin is prompted to add a free-text refund note (amount + reason) stored on the order; the actual refund is performed manually out-of-band in v1.
- Given PaymentStatus is awaiting_payment, slip_uploaded, or verifying (not yet paid), When admin cancels, Then no refund note is required and copy makes clear no money was captured.
- Given an order is already terminal (delivered, picked_up, cancelled, payment_rejected, delivery_failed), Then the cancel action is not offered.
- Given a delivery order is already out_for_delivery, When admin cancels, Then a confirmation warns the rider is en route and the assigned rider is notified to abort.
- Given cancel fails, Then OrderStatus is unchanged and an error with Retry is shown.

*Dependencies:* ADM-ORD-03, Notification entity

*Notes:* BLOCKED BY OPEN PAYMENT DECISION: automated/gateway refunds and COD are out of v1, so refund is a manual note only; full refund mechanics are blocked until the payment-gateway decision lands. OPEN: the canonical cancel-reason enum values (proposed as short enum + optional free text).

#### ADM-ORD-07 — SLA / order-aging visibility  `🟠 SHOULD`
**As** admin (เฮียอู้ฟู่), **I want** to see how long orders have waited and which are overdue, **so that** I prioritize work and keep delivery and pickup promises.

*Acceptance criteria:*
- Given orders in the queue, Then each shows time-since-placed and time-in-current-status, and orders past a configurable SLA threshold are flagged 'เกินเวลา/overdue'.
- Given an overdue flag, Then it is conveyed by icon + text label (not color alone) and meets WCAG AA contrast, so it is distinguishable without color perception.
- Given an order is nearing its SLA, Then a distinct 'ใกล้ครบเวลา' warning state shows before it becomes overdue.
- Given admin sorts by 'most overdue', Then the queue reorders accordingly.
- Given no SLA config exists, Then a sensible default threshold is applied and surfaced, and the feature still functions.

*Dependencies:* ADM-ORD-01

*Notes:* Non-color-only + AA contrast directly addresses baseline a11y debt. OPEN: actual SLA target times per OrderStatus and whether they differ for delivery vs pickup (needs shop-owner input).

#### ADM-ORD-08 — Role-based access to order management  `🔴 MUST`
**As** shop owner (admin), **I want** only admin-role accounts to view and act on orders, **so that** customer and rider accounts cannot read or change order state.

*Acceptance criteria:*
- Given a user with Role=admin, When they open Order Management, Then they have full access to queue, detail, advance, assign, and cancel.
- Given a user with Role=customer or Role=rider, When they attempt to reach admin order screens/endpoints, Then access is denied with no data leaked and they are redirected/blocked.
- Given an unauthenticated session, When admin order screens are requested, Then the user is sent to admin login.
- Given an admin session expires mid-task, When admin submits a status change, Then the action is rejected and re-authentication is required before retry (no silent failure).

*Dependencies:* ADM-AUTH (admin login), Roles enum

*Notes:* v1 uses a single admin role (no owner/staff split). OPEN: whether owner-vs-staff permission granularity is needed in v1 or later.

### ADM-PAYMENT — Payment / Slip Verification
> Give shop admins a fast, fair, auditable workflow to manually verify customer-uploaded PromptPay slips and move each order to paid (confirmed) or payment_rejected, while surfacing the scale risk of doing this by hand.

#### ADM-PAY-01 — Slip verification queue  `🔴 MUST`
**As** admin (เฮียอู้ฟู่ / shop staff, Role = admin), **I want** a single queue listing every order whose Payment.status = slip_uploaded, oldest-first, showing order id, customer, amount, ShopMode and how long it has been waiting, **so that** I can verify transfers promptly and in fair order without missing anyone.

*Acceptance criteria:*
- Given I am authenticated with Role = admin, When I open the verification screen, Then I see all orders with PaymentStatus = slip_uploaded (OrderStatus = slip_uploaded) sorted by slip-upload time ascending (oldest first).
- Given a queue item, Then it shows order id, customer display name, ShopMode (delivery | pickup), order total via money() (e.g. ฿250), PaymentMethod = promptpay_slip, and a waiting-age badge (e.g. 'รอ 12 นาที').
- Given the queue has zero items, When it loads, Then the empty state 'ไม่มีสลิปรอตรวจสอบ' is shown (not an error) and the nav badge count = 0.
- Given a customer uploads a new slip while I am viewing, When the backend receives it, Then the new item appears within ~10s (or on pull-to-refresh) without a full reload and the badge increments.
- Given I am authenticated with Role = customer or rider, When I open the screen or call its API, Then access is denied (403) and no slip data is returned.
- Given an order is cancelled (OrderStatus = cancelled) after its slip was uploaded, Then it is removed from the queue automatically.
- Given the queue fails to load (network/server error), Then an error state with a Retry action is shown instead of a blank screen.

*Dependencies:* ADM-AUTH (role gating), CUS slip-upload flow

*Notes:* Oldest-first protects SLA fairness; badge/count feeds ADM-PAY-07 scale visibility. Uses ShopMode enum verbatim. Code drift to reconcile: store/mode.ts currently encodes pickup as ShopMode 'online' — canonical enum is 'pickup'.

#### ADM-PAY-02 — Inspect slip and check amount match  `🔴 MUST`
**As** admin (Role = admin), **I want** to open one queued order and see the uploaded slip image alongside the order total with a clear match / mismatch indicator, **so that** I can decide approve vs reject from the right evidence rather than guessing.

*Acceptance criteria:*
- Given a queue item, When I open it, Then I see the full slip image (zoom, pan, rotate), the order summary (line items, subtotal, deliveryFee, total), customer name/phone, ShopMode, and PaymentMethod = promptpay_slip.
- Given order total = ฿250 and the slip amount = ฿250, Then a 'ยอดตรง' match indicator is shown (and is not conveyed by color alone).
- Given the slip amount differs from the order total (short or over payment), Then a warning 'ยอดไม่ตรง: สลิป ฿x / ออเดอร์ ฿y' is shown and Approve requires explicit confirmation.
- Given a delivery order, Then the displayed total includes deliveryFee per deliveryFeeFor() (40 THB, free when subtotal ≥ 200); given a pickup order, deliveryFee = 0.
- Given the slip image cannot be decoded/loaded, Then a placeholder with 'เปิดสลิปไม่ได้' and a re-fetch action are shown, and Approve is disabled until the image loads.
- Given the same slip (matching bank reference / amount / timestamp) was already used to approve another order, Then a 'สลิปนี้ถูกใช้แล้ว' duplicate warning is surfaced.
- Given the slip has no machine-readable amount, Then I can manually enter the observed amount before the match check runs.

*Dependencies:* ADM-PAY-01

*Notes:* Amount match is advisory; the final call is human. Duplicate-slip detection mitigates fraud and is part of the scale story. Whether the amount is OCR-extracted vs hand-entered is unresolved — recorded as an open question, not assumed.

#### ADM-PAY-03 — Approve slip -> paid  `🔴 MUST`
**As** admin (Role = admin), **I want** to approve a verified slip, **so that** the order becomes paid and moves on into fulfillment.

*Acceptance criteria:*
- Given an order with PaymentStatus ∈ {slip_uploaded, verifying}, When I tap Approve and confirm, Then Payment.status becomes paid and OrderStatus transitions payment_verifying -> confirmed.
- Given approval succeeds, Then a Notification ('ยืนยันการชำระเงินแล้ว') is sent to the customer and the item leaves the verification queue.
- Given the amount did not match (ADM-PAY-02), When I approve, Then I must pass a confirmation dialog naming the discrepancy before the transition commits.
- Given the approve call fails mid-flight, Then the transition is atomic (not partially applied): PaymentStatus and OrderStatus stay consistent, I see a Retry, and re-tapping Approve is idempotent (no double transition, no duplicate notification).
- Given the order is already paid (PaymentStatus = paid), Then Approve is disabled/no-op and labeled 'ชำระแล้ว'.
- Given the order was cancelled while I was reviewing, When I approve, Then approval is blocked with 'ออเดอร์ถูกยกเลิกแล้ว'.
- Given any approval, Then an audit record (actor, timestamp, order id, amount) is written and retrievable later.

*Dependencies:* ADM-PAY-01, ADM-PAY-02

*Notes:* Atomicity + idempotency are the core engineering risks of manual approval. PaymentMethod stays promptpay_slip in v1.

#### ADM-PAY-04 — Reject slip -> payment_rejected with a customer-readable reason  `🔴 MUST`
**As** admin (Role = admin), **I want** to reject an invalid slip with a required, plain-Thai reason, **so that** the customer understands why and can re-pay, and we keep a record.

*Acceptance criteria:*
- Given an order with PaymentStatus ∈ {slip_uploaded, verifying}, When I tap Reject, Then I must pick a reason ('ยอดไม่ตรง', 'สลิปไม่ชัด', 'ไม่พบยอดเข้าบัญชี', 'สลิปซ้ำ') or enter a custom Thai reason before Confirm is enabled.
- Given I confirm Reject, Then Payment.status becomes rejected and OrderStatus transitions payment_verifying -> payment_rejected, and the item leaves the queue.
- Given reject succeeds, Then a Notification carrying the chosen reason plus a re-upload / re-pay call-to-action is sent to the customer.
- A11y (ป้าสมศรี, pickup): Given ป้าสมศรี receives the rejection, Then the reason renders in plain Thai at body-large size, supports OS dynamic-type scaling, meets WCAG AA contrast, exposes the re-upload control as a ≥44pt target with an accessibilityLabel, and conveys no status by color alone.
- Given I try to confirm Reject with no reason selected/entered, Then Confirm stays disabled and the field is flagged.
- Given the order is already paid, When Reject is attempted, Then it is blocked ('ชำระแล้ว ไม่สามารถปฏิเสธได้') and I am directed to the dispute flow.
- Given the reject call fails, Then the order stays in payment_verifying, I see a Retry, and no premature notification is sent.
- Given any rejection, Then an audit record (actor, timestamp, reason) is written.

*Dependencies:* ADM-PAY-01, ADM-PAY-02, CUS re-upload flow

*Notes:* The reason is the only thing the customer sees — must be kind, human Thai, never internal codes. A11y is a requirement for ป้าสมศรี, not optional. Re-upload returns the order toward awaiting_payment/slip_uploaded; that transition is owned by the customer epic.

#### ADM-PAY-05 — Claim/lock a slip while reviewing (verifying)  `🟠 SHOULD`
**As** admin in a multi-staff shop (Role = admin), **I want** opening a slip to mark it verifying and lock it to me, **so that** two staff don't verify, approve, or reject the same order twice.

*Acceptance criteria:*
- Given two staff, When staff A opens a queued order, Then Payment.status moves slip_uploaded -> verifying and OrderStatus slip_uploaded -> payment_verifying, and the item shows 'กำลังตรวจสอบโดย A' to staff B.
- Given an order already in verifying by A, When staff B opens it, Then B sees it is locked and cannot Approve/Reject unless they explicitly take over.
- Given staff A takes no action within the lock timeout or closes the order, Then the lock auto-releases and the item returns to the actionable queue without data loss.
- Given staff A and B both tap Approve at nearly the same instant, Then exactly one transition commits and the other receives 'ออเดอร์นี้ถูกดำเนินการแล้ว'.

*Dependencies:* ADM-PAY-01, ADM-PAY-03, ADM-PAY-04

*Notes:* Directly mitigates double-handling as volume grows. 'verifying' maps to OrderStatus payment_verifying. Lock-timeout duration is an open question. Could be deferred if v1 launches single-staff, hence 'should'.

#### ADM-PAY-06 — Disputes and post-approval correction  `🟠 SHOULD`
**As** admin (Role = admin), **I want** to handle disputes — a wrongly rejected payment, a short/over payment, or a slip problem found after approval, **so that** I can correct mistakes without corrupting order state or losing trust.

*Acceptance criteria:*
- Given an order in payment_rejected that the customer disputes (they did pay), When admin re-opens it, Then it returns to payment_verifying for a fresh approve/reject decision with a mandatory audit note.
- Given a paid order later found short-paid or fraudulent, When admin flags a dispute, Then the order is marked under-review (paid is not silently reverted) and resolution options are offered: request top-up, manual refund, or cancel.
- Given a refund is required, Then v1 records a manual/offline refund action plus note (no automated gateway refund).
- Given any dispute action, Then an audit entry (actor, before/after status, reason) is written and the customer is notified of the outcome.
- Given the goods have already been released (OrderStatus = picked_up or delivered), When a dispute is opened, Then the UI warns that fulfillment already completed.

*Dependencies:* ADM-PAY-03, ADM-PAY-04

*Notes:* Refund/charge-back mechanics depend on the unresolved gateway decision; keep manual/offline in v1 and flag as open question. COD is out of scope for v1.

#### ADM-PAY-07 — Verification backlog and SLA visibility (manual-verification scale risk)  `🟡 COULD`
**As** shop owner / admin (Role = admin), **I want** to see how many slips are pending, the oldest wait time, and average time-to-verify, **so that** I know when manual verification can no longer keep up and needs more staff or a gateway.

*Acceptance criteria:*
- Given the payments dashboard, Then it shows the count of orders in slip_uploaded, the oldest waiting age, and a rolling average time from slip_uploaded -> paid/rejected.
- Given pending count exceeds a configurable threshold OR oldest age exceeds the SLA (e.g. 15 min), Then a visible alert is raised to admin.
- Given there are no pending slips, Then the dashboard shows a healthy/empty state, not an error.
- Given a date range, Then daily metrics are retrievable/exportable for capacity planning.

*Dependencies:* ADM-PAY-01

*Notes:* This story exists specifically to expose the manual-verification scale risk and to inform the future gateway decision. Threshold and SLA values are open questions.

#### ADM-PAY-08 — Whether delivery-mode orders require slip verification (BLOCKED by open payment decision)  `🟡 COULD`
**As** admin (Role = admin), **I want** clarity on whether ShopMode = delivery orders require slip verification at all, or are pay-on-receipt, **so that** the verification queue only contains orders that actually need manual review.

*Acceptance criteria:*
- Provisional (do not build until decided): Given the delivery payment model is resolved, When it is prepay (PromptPay + slip), Then delivery orders enter the same slip_uploaded queue and follow ADM-PAY-01..06.
- Provisional: Given it is resolved as pay-on-receipt / COD, Then delivery orders skip slip verification and reach confirmed via a separate path, and settlement is handled outside this epic.
- Given current pickup orders, Then they always require slip verification (PaymentMethod = promptpay_slip) regardless of the delivery decision.

*Dependencies:* ADM-PAY-01

*Notes:* BLOCKED. Existing cart copy already implies delivery may be 'ชำระปลายทาง หรือโอนเมื่อรับของ' (pay on receipt), which conflicts with prepay+slip — must be resolved before building delivery verification. Gateway (Omise/2C2P/GB Prime) and COD are also open. Kept 'could' so it isn't scheduled until unblocked.

### ADM-DASH — Dashboard & Reports
> Give shop staff a lean, admin-only, accessible dashboard that surfaces the vision's core KPIs (orders/day, AOV, fulfillment time) plus filterable order and sales views and CSV export, so เฮียอู้ฟู่ can run อู้ฟู่ by the numbers.

#### ADM-DASH-01 — Headline KPI cards: orders today, AOV, fulfillment time  `🔴 MUST`
**As** admin (เฮียอู้ฟู่), **I want** see today's key numbers — number of orders, average order value (AOV), and average fulfillment time — at the top of the dashboard, **so that** I can tell at a glance how the shop is doing today and whether orders are moving fast enough.

*Acceptance criteria:*
- Given I am signed in with Roles=admin and open the dashboard, When the page loads for the default period (today, Asia/Bangkok), Then I see three KPI cards: 'ออเดอร์วันนี้' (count), 'มูลค่าเฉลี่ย/ออเดอร์ (AOV)' formatted via money() e.g. ฿185, and 'เวลาเฉลี่ยจัดการออเดอร์' shown in ชม./นาที.
- Given orders exist today, When 'ออเดอร์วันนี้' is computed, Then it counts Orders whose placed timestamp falls within today 00:00–23:59 Asia/Bangkok and whose OrderStatus is not cancelled and not payment_rejected.
- Given counted orders exist, When AOV is computed, Then AOV = sum(order total in THB) / count(counted orders), rounded to whole Baht and rendered with money(); the order-counting basis is identical to 'ออเดอร์วันนี้'.
- Given fulfilled orders exist, When average fulfillment time is computed, Then it averages the duration from each order's confirmed status timestamp to its delivered timestamp (ShopMode=delivery) or its ready_for_pickup timestamp (ShopMode=pickup), excluding orders that are cancelled, payment_rejected, delivery_failed, or not yet fulfilled.
- Empty: Given no orders match the period, When the cards render, Then 'ออเดอร์วันนี้' shows 0, AOV shows ฿0, and fulfillment shows '—' with helper text 'ยังไม่มีออเดอร์ในช่วงนี้' — this is a normal empty state, not an error.
- Loading: Given metrics are still loading, Then each card shows a skeleton/loading state with accessibilityLabel 'กำลังโหลด' rather than a literal 0 that could be misread as real data.
- Error: Given the metrics request fails, Then an inline error with a 'ลองใหม่' retry button is shown; any last-known values are labelled 'ข้อมูล ณ <เวลา>'; tapping retry refetches.
- Accessibility: Given any operator, Then KPI numbers meet WCAG AA contrast, scale with OS/browser large-text (dynamic type) without truncation or overlap, and each card exposes a screen-reader label combining title + value + unit (e.g. 'ออเดอร์วันนี้ 12 รายการ').

*Dependencies:* ADM-DASH-03, Order data model with stored status-transition timestamps, Auth & Roles epic

*Notes:* Maps directly to the vision KPI table (orders/day, AOV, Ops fulfillment time = 'เวลาตั้งแต่รับออเดอร์→ส่ง/พร้อมรับ'). Proposed definitions (orders exclude cancelled/payment_rejected; fulfillment starts at confirmed, ends at delivered/ready_for_pickup) need PO sign-off. AOV/revenue for delivery is sensitive to the OPEN delivery-payment decision (prepay vs pay-on-receipt/COD). ป้าสมศรี is a customer (pickup), not the dashboard operator (เฮียอู้ฟู่); WCAG AA still applies to the admin web by project mandate.

#### ADM-DASH-02 — Orders view — filter and search by canonical enums  `🟠 SHOULD`
**As** admin, **I want** browse a list of orders and filter by OrderStatus, PaymentStatus, and ShopMode, and search by order id or customer phone, **so that** I can find and review specific orders for reporting and follow-up.

*Acceptance criteria:*
- Given I open the orders view, Then I see a paginated list sorted newest-first by placed time, where each row shows order id, placed time, customer name, ShopMode (delivery|pickup), OrderStatus, PaymentStatus, and order total via money().
- Given the OrderStatus filter, When I select a value from {placed, awaiting_payment, slip_uploaded, payment_verifying, confirmed, preparing, assigned_to_rider, out_for_delivery, delivered, ready_for_pickup, picked_up, cancelled, payment_rejected, delivery_failed}, Then only matching orders are shown.
- Given the PaymentStatus filter {awaiting_payment, slip_uploaded, verifying, paid, rejected} and the ShopMode filter {delivery, pickup}, When combined with the OrderStatus filter, Then filters apply together with AND logic.
- Given a search term, When I enter an order id or a phone number (partial phone allowed), Then the list filters to matching orders.
- Empty: Given no orders match the active filters/search, Then show 'ไม่พบออเดอร์ตามเงื่อนไข' with a 'ล้างตัวกรอง' (clear filters) button.
- Error: Given the list fails to load, Then show an inline error with a retry control and no stale rows presented as fresh.
- Edge: Given many orders, Then the list paginates/virtualizes and filter+search are applied server-side so result counts are accurate beyond the first page.
- Accessibility: filter chips have touch targets ≥44pt, are keyboard-reachable with a visible focus ring, indicate active state by text+state (not colour alone), and status badges meet WCAG AA contrast.

*Dependencies:* ADM-DASH-03, Order data model

*Notes:* Scope is READ-ONLY browsing for reporting/lookup; order actions (status change, slip verification, rider assignment) belong to the ADM-ORD admin epics — flag overlap. Customer name/phone shown are PDPA personal data, restricted to Roles=admin.

#### ADM-DASH-03 — Admin-only access to dashboard & reports (PDPA gate)  `🔴 MUST`
**As** shop owner (admin), **I want** the dashboard, order data, and reports to be visible only to users with Roles=admin, **so that** customer personal data and sales figures are never exposed to riders or customers.

*Acceptance criteria:*
- Given a user with Roles=admin, When they navigate to the dashboard, Then it loads normally.
- Given a user with Roles=rider or Roles=customer, or an unauthenticated request, When they request any dashboard/report URL or its data API, Then access is denied (redirect to sign-in or 403) and no KPI, order, or customer data is returned in the response body.
- Given an expired or invalid session, When the dashboard is opened, Then the user is routed to sign-in and no cached report or customer data is rendered.
- PDPA: Given any view or export of customer personal data (name/phone/address), Then it is gated to Roles=admin only; whether each access/export is written to an audit log is an open question (see open questions).
- Accessibility: the access-denied and sign-in prompts meet WCAG AA contrast and are announced to screen readers.

*Dependencies:* Auth & Roles epic

*Notes:* v1 has a single 'admin' role with no per-staff granularity (e.g. revenue-only-for-owner) — flagged in open questions. This story is the PDPA boundary for the whole epic since the dashboard surfaces customer phone/address and sales totals.

#### ADM-DASH-04 — Date-range selector for KPIs and sales  `🟠 SHOULD`
**As** admin, **I want** switch the dashboard period between today, last 7 days, last 30 days, and a custom range, **so that** I can compare performance over time instead of only seeing today.

*Acceptance criteria:*
- Given the dashboard, Then a period control offers 'วันนี้ / 7 วัน / 30 วัน / กำหนดเอง', defaulting to 'วันนี้'.
- Given I choose a preset or a custom range, When applied, Then the KPI cards (ADM-DASH-01) and the sales view (ADM-DASH-05) recompute for that range using Asia/Bangkok day boundaries, inclusive of both endpoints.
- Edge: Given a custom range where start date > end date, Then show validation 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด' and do not run the query.
- Edge: Given a custom end date in the future, Then clamp it to today (or disallow selection).
- Empty: Given a valid range with no qualifying orders, Then KPIs/sales show their empty state (0 / —), not an error.
- Accessibility: the date pickers and presets are keyboard-operable, have visible labels and ≥44pt touch targets, and the active preset is indicated by text+state (not colour alone).

*Dependencies:* ADM-DASH-01, ADM-DASH-05

*Notes:* All boundaries computed in Asia/Bangkok (UTC+7). Long ranges (30 days+) must stay performant via server-side aggregation; note pagination limits for any underlying order scan.

#### ADM-DASH-05 — Sales over time with delivery vs pickup breakdown  `🟠 SHOULD`
**As** admin, **I want** see sales totals over the selected period as a simple chart, broken down by ShopMode (delivery vs pickup), **so that** I understand revenue trends and which channel drives sales.

*Acceptance criteria:*
- Given the selected period, Then a per-day time series of sales total is shown, plus a delivery-vs-pickup split (amount + %) and order counts per ShopMode.
- Given the v1 payment model, When realized sales are summed, Then only Orders with PaymentStatus=paid are counted (amounts rendered via money()); orders in awaiting_payment, slip_uploaded, verifying, or rejected are excluded from realized sales but surfaced separately as a 'รอชำระ/ตรวจสลิป' count.
- BLOCKED: Given ShopMode=delivery, Then how delivery revenue is recognized (prepay PromptPay+slip vs pay-on-receipt/COD) is undecided; the delivery revenue line is shown as provisional and must not assume a model until the payment decision is made (see open questions).
- Empty: Given no PaymentStatus=paid orders in the range, Then the chart shows an empty state 'ยังไม่มียอดขายที่ชำระแล้ว'.
- Loading/Error: Given data is loading, Then a skeleton is shown; Given the request fails, Then an inline error with retry is shown.
- Accessibility: the chart provides a text/data-table alternative for screen readers, series are distinguished by pattern+label (not colour alone), all labels meet WCAG AA contrast, and any draw-in/auto animation is disabled when reduce-motion is set.

*Dependencies:* ADM-DASH-04, PaymentStatus recorded on orders

*Notes:* Revenue-recognition rule is partly BLOCKED by the open delivery-payment decision. Implementation note: current code's ShopMode uses the string 'online' (store/mode.ts) — it must be mapped to the canonical 'pickup' for all reporting.

#### ADM-DASH-06 — Export orders/sales to CSV  `🟠 SHOULD`
**As** admin, **I want** export the orders and sales for the selected period to a CSV file, **so that** I can keep records and do my own accounting in a spreadsheet.

*Acceptance criteria:*
- Given a selected period with orders, When I tap 'ส่งออก CSV', Then a CSV downloads with one row per order including columns: order id, placed time, ShopMode, OrderStatus, PaymentStatus, PaymentMethod (promptpay_slip in v1), customer name, phone, delivery address, subtotal, delivery fee, total.
- Given Thai content, Then the file is UTF-8 with BOM so Thai renders correctly in Excel, and monetary columns are plain numbers (e.g. 185, not the money() '฿185' string) so spreadsheets can compute on them.
- Empty: Given no orders in the range, Then the export button is disabled, or it produces a header-only file with a toast 'ไม่มีข้อมูลให้ส่งออก'.
- Large: Given a large range, Then the export streams/generates without freezing the UI (progress shown), with a reasonable row cap or async-job fallback.
- Error: Given generation fails, Then show an error with retry and never deliver a partial/corrupt file.
- PDPA: Given the CSV contains personal data (name/phone/address), Then export is restricted to Roles=admin, the UI warns the file contains personal data, and an audit record of who exported what/when is recommended (audit logging is an open question).
- Accessibility: the export control is a real button with accessibilityLabel 'ส่งออกเป็นไฟล์ CSV' (an icon-only button must not rely on the glyph alone) and is keyboard-activable.

*Dependencies:* ADM-DASH-03, ADM-DASH-04

*Notes:* v1 is CSV download only — no scheduled/emailed exports. PDPA retention/access policy for exported personal data is an open question. Column set may need a paid/COD/payment-timing flag once the open payment decision lands.

#### ADM-DASH-07 — Dashboard accessibility & readability pass  `🟠 SHOULD`
**As** shop staff operating the admin web (which may include older or less tech-savvy family members with the same needs as ป้าสมศรี), **I want** the dashboard to use large readable numbers, high contrast, labelled controls, and respect reduced-motion, **so that** anyone helping run the shop can read the reports without strain.

*Acceptance criteria:*
- Given OS/browser large-text settings, When the dashboard renders, Then KPI numbers and labels scale (dynamic type) without clipping or overlap up to the largest supported step.
- Given WCAG AA, Then all text, KPI numbers, status badges, and chart labels meet ≥4.5:1 contrast (≥3:1 for large text) against their background.
- Given a screen reader, Then every icon-only control (refresh, export, filter) has an accessibilityLabel, charts expose a text/table alternative, and KPI cards read as title + value + unit.
- Given reduce-motion is enabled, Then auto-animations (chart draw-in, count-up numbers, pulsing refresh spinners) are disabled or reduced.
- Given keyboard-only operation, Then all controls are reachable in a logical order with a visible focus indicator and ≥44pt touch targets.

*Dependencies:* ADM-DASH-01, ADM-DASH-05

*Notes:* Consolidates the WCAG AA / dynamic-type / contrast / reduced-motion / accessibilityLabel baseline debt for the admin web; core a11y criteria are also embedded in ADM-DASH-01/02/05/06. Note: ป้าสมศรี is a CUSTOMER persona (pickup), not the admin operator (เฮียอู้ฟู่) — this story is justified by the project-wide WCAG AA mandate and shop-staff readability, not by ป้าสมศรี directly. Marked 'should' for v1 sequencing only; a11y is a requirement, not optional.

#### ADM-DASH-08 — Fulfillment-time drill-down by mode and stage  `🟡 COULD`
**As** admin, **I want** break the average fulfillment time down by ShopMode and by stage transition, **so that** I can see where orders get stuck and fix the slow step.

*Acceptance criteria:*
- Given fulfilled orders in the period, When I open the fulfillment drill-down, Then I see average time split by ShopMode (delivery vs pickup) and by stage, computed from OrderStatus transition timestamps.
- Given delivery orders, Then stages are confirmed→preparing→assigned_to_rider→out_for_delivery→delivered; given pickup orders, Then stages are confirmed→preparing→ready_for_pickup (optionally →picked_up).
- Edge: Given orders missing a transition timestamp, Then they are excluded from that stage's average and a note 'ข้อมูลไม่ครบ N ออเดอร์' is shown.
- Edge: Given delivery_failed or cancelled orders, Then they are excluded from fulfillment averages but counted separately as 'ส่งไม่สำเร็จ/ยกเลิก'.
- Empty/Error: Given no qualifying orders, Then show the empty state; given a failure, show retry.
- Accessibility: the breakdown is available as an accessible data table, meets WCAG AA contrast, and respects reduced-motion.

*Dependencies:* ADM-DASH-01, Order status-transition event log

*Notes:* Requires a full per-order status-transition event log. Valuable for ops but deferrable — kept 'could' to keep v1 lean.


## แอปไรเดอร์ (Rider App)

### RID-AUTH — Rider Auth & Availability
> An authorized อู้ฟู่ rider can securely sign in, control their online/offline availability so they only receive delivery jobs while actually working, and manage their identifying profile.

#### RID-AUTH-01 — Rider login via phone number + OTP  `🔴 MUST`
**As** rider (P4), **I want** log into the rider app with my phone number and a one-time SMS code, **so that** only I, an authorized อู้ฟู่ rider, can access delivery jobs.

*Acceptance criteria:*
- Given a phone number belonging to an active account with Role `rider`, When the rider enters it and taps 'ขอรหัส OTP', Then an OTP is sent via SMS and the code-entry screen appears showing the masked phone number and a resend countdown.
- Given a valid OTP entered before it expires, When the rider submits it, Then they are authenticated as Role `rider` and land on the availability/home screen in the default `offline` state.
- Given an incorrect OTP, When submitted, Then the inline Thai error 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่' is shown, the field is cleared and re-focused, and no navigation occurs.
- Given an expired OTP, When submitted, Then the app shows 'รหัสหมดอายุ กรุณาขอรหัสใหม่' and offers Resend.
- Given the resend cooldown is active, When the rider taps Resend, Then the button is disabled with a visible countdown and no new SMS is sent until it elapses; after N failed attempts the account is temporarily rate-limited with a clear message.
- Given a phone number not provisioned as a `rider` (e.g. a `customer` number or unknown), When OTP is requested or verified, Then login is refused with 'บัญชีนี้ไม่ใช่ไรเดอร์ของร้าน กรุณาติดต่อแอดมิน' and no rider session is created.
- Given an account an `admin` has deactivated/suspended, When the rider attempts login, Then access is denied with 'บัญชีถูกระงับ กรุณาติดต่อแอดมิน'.
- Given no network or an SMS-gateway failure, When requesting OTP, Then a non-blocking 'เครือข่ายมีปัญหา ลองอีกครั้ง' with Retry is shown and no partial session is created.
- Given an empty or malformed phone number, When tapping request, Then the request button is disabled or shows 'กรอกเบอร์โทรให้ถูกต้อง'.
- Given accessibility needs, When the login/OTP screens render, Then OTP fields, request and resend controls have touch targets ≥ 44pt, visible focus, WCAG AA contrast, dynamic-type support without truncation, every icon-only control has a Thai accessibilityLabel, and the OTP input is announced by screen readers.

*Dependencies:* ADM rider-provisioning epic, SMS/OTP provider

*Notes:* Assumes admin-provisioned riders (no self-signup) — confirm (see openQuestions). Uses Roles `rider`/`admin`/`customer` verbatim. ป้าสมศรี is a customer (pickup) persona, not a rider, so she is not directly on this surface; the documented a11y baseline still applies product-wide because riders may equally be older/low-vision.

#### RID-AUTH-02 — PDPA consent & location-data disclosure on first sign-in  `🔴 MUST`
**As** rider (P4), **I want** a clear explanation of what personal and location data the app collects, and to give consent, **so that** my data is handled lawfully under PDPA and I understand why location is used.

*Acceptance criteria:*
- Given a rider signing in for the first time (or after the consent version changed), When they reach the consent screen, Then a Thai-language PDPA notice explains what is collected (identity, phone, and live location while on delivery) and why, links to the privacy policy, and requires Accept to continue.
- Given the rider taps 'ยอมรับ', When consent is recorded, Then the consent version and timestamp are stored against the rider account and they proceed; later sign-ins with the same version skip the screen.
- Given the rider taps 'ไม่ยอมรับ', When they decline, Then they cannot use delivery features and are shown a screen explaining consent is required to work as a rider.
- Given location permission has not been granted, When the rider first attempts to go `online`, Then an in-app rationale ('ใช้ตำแหน่งเพื่อรับและนำทางงานส่งเท่านั้น') precedes the OS prompt, and denial is handled gracefully per RID-AUTH-03.
- Given the PDPA notice was updated to a new version, When an existing rider next opens the app, Then re-consent is requested before continuing.
- Given accessibility needs, When the consent screen renders, Then the text is selectable and scrollable, meets WCAG AA contrast, scales with dynamic type, and Accept/Decline buttons are ≥ 44pt with a non-color affordance.

*Dependencies:* RID-AUTH-01

*Notes:* ShopMode `delivery` used verbatim — riders serve only `delivery`, never `pickup`. Location-consent scope (foreground vs background) and data-retention period are unresolved (see openQuestions).

#### RID-AUTH-03 — Go online / offline (availability toggle)  `🔴 MUST`
**As** rider (P4), **I want** a clear control to set myself online or offline, **so that** I only receive delivery assignments when I'm actually working.

*Acceptance criteria:*
- Given a logged-in rider whose default state after login is `offline`, When they tap the toggle to go online, Then their status becomes `online`, the UI shows a prominent 'พร้อมรับงาน' indicator, and the change persists across app restart.
- Given an `online` rider, When they tap the toggle to go offline, Then their status becomes `offline`, the UI shows 'พักงาน/ออฟไลน์', and they stop receiving new assignments.
- Given a rider toggles availability, When the status-update request fails, Then the toggle reverts to its prior state with 'อัปเดตสถานะไม่สำเร็จ ลองใหม่' (no silent optimistic stick), so the rider is never shown online when the server disagrees.
- Given location permission is denied or off, When the rider tries to go online, Then going online is blocked with guidance to enable location ('เปิดตำแหน่งเพื่อรับงานส่ง') and the rider stays `offline`.
- Given the app is force-closed or loses connectivity while `online`, When connectivity returns or the app reopens, Then the last known availability is re-synced and shown accurately.
- Given accessibility needs, When the toggle renders, Then it has a ≥ 44pt target, a text label (not color alone) for its state, an accessibilityLabel + accessibilityState announcing online/offline, WCAG AA contrast in both states, and any pulsing/animated 'online' indicator respects reduced-motion (no animation when the OS setting is on).

*Dependencies:* RID-AUTH-01, RID-AUTH-02

*Notes:* Availability `online`/`offline` is a NEW rider field, distinct from the canonical OrderStatus/PaymentStatus enums — do not conflate. Idle/auto-offline timeout (on inactivity/backgrounding/shift end) is an open question.

#### RID-AUTH-04 — Availability gates assignments & safe offline with an active job  `🟠 SHOULD`
**As** rider (P4), **I want** to not be assigned work while offline, and not accidentally abandon a job in progress, **so that** customers' deliveries aren't stranded and the admin sees an accurate rider pool.

*Acceptance criteria:*
- Given a rider is `offline`, When the `admin` opens the assign-rider list, Then that rider is not offered for assignment to a `delivery` order (no order moves to `assigned_to_rider` for them).
- Given a rider is `online` with no active job, When an order is assigned, Then the order becomes `assigned_to_rider` and the rider enters the active-delivery context (handoff to the delivery epic).
- Given a rider has an active delivery (an order in `out_for_delivery`), When they attempt to go offline, Then they are warned 'คุณมีงานส่งที่ยังไม่เสร็จ' and must finish/return the job or explicitly confirm before going offline — they cannot silently disappear mid-delivery.
- Given a rider holding an order `assigned_to_rider` (not yet picked up) goes offline or loses connectivity beyond a threshold, When the threshold passes, Then the `admin` is flagged so the order can be reassigned (and may move toward `delivery_failed`); exact threshold TBD.
- Given a rider with no active job, When they go offline, Then no warning is shown and they go offline immediately.

*Dependencies:* RID-AUTH-03, ADM assign-rider epic, RID-DLV active-delivery epic

*Notes:* Uses OrderStatus `assigned_to_rider`, `out_for_delivery`, `delivery_failed` and ShopMode `delivery` verbatim. Whether cash-in-hand (`cod`) must block going offline, and the reassignment threshold, depend on the open payment decision (see openQuestions).

#### RID-AUTH-05 — Stay signed in, sign out & admin-revoked access  `🟠 SHOULD`
**As** rider (P4), **I want** to stay logged in across shifts but be able to sign out, and lose access if deactivated, **so that** I don't re-OTP every shift, yet access stays secure when I leave or am removed.

*Acceptance criteria:*
- Given a rider has logged in, When they close and reopen the app within the session validity, Then they remain authenticated as Role `rider` without re-entering OTP, restored to their last availability state.
- Given a rider taps 'ออกจากระบบ', When they confirm, Then their session/token is cleared from the device, availability is forced to `offline`, and they return to the login screen.
- Given an `admin` deactivates the rider while signed in, When the app next syncs (or in near-real-time), Then the rider is forced `offline`, signed out, and shown 'บัญชีถูกระงับ กรุณาติดต่อแอดมิน'.
- Given the session token expires, When the rider performs an action, Then they are prompted to re-authenticate without losing unsynced job state where possible.
- Given security requirements, When a session is created, Then tokens are stored in secure device storage and signing out invalidates the refresh token server-side.

*Dependencies:* RID-AUTH-01, ADM rider-management epic

*Notes:* Uses Roles `rider`/`admin` verbatim. Whether concurrent multi-device sessions per rider are allowed (or force single-device with auto sign-out elsewhere) is an open question.

#### RID-AUTH-06 — View & edit rider profile  `🟠 SHOULD`
**As** rider (P4), **I want** to view and update my profile (name, phone, photo, vehicle type & licence plate), **so that** the shop and customers can identify me and my vehicle for deliveries.

*Acceptance criteria:*
- Given a logged-in rider, When they open 'โปรไฟล์', Then they see display name, phone, profile photo, vehicle type, and licence-plate.
- Given the rider edits an editable field and saves, When the save succeeds, Then the new value is persisted and reflected immediately; on failure the prior value is kept with a Thai error.
- Given the rider updates their profile photo, When they pick or take a photo, Then it uploads with progress feedback, and a fallback initial-avatar is shown when none is set.
- Given a newly provisioned rider with only a phone number, When opening the profile, Then required-but-empty fields (e.g. vehicle, plate) are clearly marked 'ยังไม่ได้กรอก' and prompt completion.
- Given phone number is identity-critical, When a rider tries to change it, Then it requires OTP re-verification (or is admin-only) — not a silent edit.
- Given accessibility needs, When the profile renders, Then the edit (pencil) and photo controls are icon buttons with Thai accessibilityLabel and ≥ 44pt targets, and all fields/labels meet WCAG AA contrast and scale with dynamic type.

*Dependencies:* RID-AUTH-01

*Notes:* BLOCKED-ASPECT: cash-handling/settlement fields (cash float, COD collected, payout) are deliberately NOT specified because they depend on the open payment decision (`cod` vs prepay `promptpay_slip`) — see openQuestions. Whether phone is rider- or admin-editable is also open.

#### RID-AUTH-07 — Social login (LINE/Apple/Google) linked to a rider account  `🟡 COULD`
**As** rider (P4), **I want** to optionally sign in with LINE, Apple, or Google, **so that** I can log in faster without typing an OTP every shift.

*Acceptance criteria:*
- Given a provisioned `rider` account, When the rider links a LINE/Apple/Google identity (verified against their registered phone/email), Then future sign-ins via that provider authenticate them as Role `rider`.
- Given a social identity not linked to any `rider` account, When used to sign in to the rider app, Then access is refused (no auto-provisioning) with guidance to contact the `admin`.
- Given Apple sign-in, When used, Then Apple's private-relay email and name-hiding are handled without breaking account matching.
- Given a provider is unavailable or the rider cancels the provider flow, When returning to the app, Then a graceful error is shown and phone + OTP remains available as the primary method.
- Given accessibility needs, When provider buttons render, Then they follow platform branding with WCAG AA contrast, are ≥ 44pt, have accessibilityLabels, and scale with dynamic type.

*Dependencies:* RID-AUTH-01

*Notes:* Social login is a locked product-wide decision, but riders are provisioned staff so phone+OTP is primary; whether riders need social login at all is an open question and may be deprioritized. Uses Roles `rider`/`admin` verbatim.

### RID-QUEUE — Delivery Jobs Queue
> Give the shop's own riders a reliable in-app queue to see assigned and available delivery jobs, accept work, read each order's summary + delivery address, and batch nearby jobs — so deliveries go out fast without admin phone calls.

#### RID-QUEUE-01 — See the delivery jobs queue (my jobs + available)  `🔴 MUST`
**As** rider (Roles=rider), **I want** a queue showing the jobs assigned to me and the available jobs I can pick up, **so that** I can see my workload at a glance and choose what to deliver next.

*Acceptance criteria:*
- Given I am signed in with Roles=rider, When I open the งานจัดส่ง (Jobs) tab, Then I see two segments 'งานของฉัน' (My jobs) and 'งานที่ว่าง' (Available), defaulting to 'งานของฉัน'.
- Given orders exist, When 'งานของฉัน' renders, Then it lists only Orders where Delivery.riderId == my id and OrderStatus in {assigned_to_rider, out_for_delivery}.
- Given orders exist, When 'งานที่ว่าง' renders, Then it lists only Orders with ShopMode=delivery, OrderStatus=preparing, released to the rider pool, and with no assigned rider.
- Given a ShopMode=pickup order, When the queue loads, Then it NEVER appears in either segment (pickup is in-store, never dispatched to a rider).
- Given a job card, Then it shows the order code (e.g. #A1B2), zone/area label, item count (e.g. '8 ชิ้น'), order total via money() (e.g. '฿245'), a PaymentStatus badge, and an OrderStatus chip.
- Given multiple jobs, When 'งานของฉัน' renders, Then cards sort out_for_delivery first, then assigned_to_rider; available jobs sort by oldest placed time first.
- Given a job card, When I tap it, Then the job detail (RID-QUEUE-03) opens.
- Given the queue is visible, When I pull to refresh, Then the list re-fetches and the refresh control has an accessibilityLabel 'รีเฟรชรายการงาน'.
- Given there are 0 jobs in a segment, Then the empty state from RID-QUEUE-04 is shown instead of a blank list.

*Dependencies:* Auth/role epic (rider sign-in, Roles=rider), Admin 'assign rider' / release-to-pool epic, Order + Delivery entities

*Notes:* Uses canonical OrderStatus (assigned_to_rider, out_for_delivery, preparing) and ShopMode (delivery, pickup) verbatim. Whether 'งานที่ว่าง' (self-assign pull pool) exists in v1 vs admin-only push assignment is an open question — see openQuestions; if push-only, the 'งานที่ว่าง' segment is descoped and RID-QUEUE-02/05 shrink accordingly. Zone label + distance need geocoded addresses (open question).

#### RID-QUEUE-02 — Accept an available delivery job  `🔴 MUST`
**As** rider, **I want** to accept an available job so it becomes mine, **so that** I commit to delivering it and it's removed from other riders' pools.

*Acceptance criteria:*
- Given an available job (ShopMode=delivery, OrderStatus=preparing, no rider), When I tap 'รับงาน' and confirm, Then Delivery.riderId is set to me, OrderStatus transitions preparing -> assigned_to_rider, and the job moves from 'งานที่ว่าง' to 'งานของฉัน'.
- Given two riders tap 'รับงาน' on the same job, When my request arrives second, Then I see 'งานนี้ถูกรับไปแล้ว', the card is removed from my available list, and no double assignment occurs (first writer wins).
- Given a job was cancelled or recalled (OrderStatus became cancelled, or rider cleared) between render and my tap, When I confirm 'รับงาน', Then accept fails with a clear Thai message and the stale card is removed.
- Given my device loses connectivity, When I tap 'รับงาน', Then no state changes, I see a retry-able error, and the button returns to its idle (not stuck/spinner) state.
- Given accept succeeds, Then I get a confirmation toast 'รับงาน #A1B2 แล้ว' and focus moves to the new job in 'งานของฉัน'.
- Given the 'รับงาน' button, Then it has accessibilityLabel 'รับงาน คำสั่งซื้อ #A1B2', role=button, and a touch target ≥ 44x44pt.

*Dependencies:* RID-QUEUE-01, Backend optimistic-lock / atomic assignment on Delivery

*Notes:* Concurrency must be enforced server-side, not just client-side. Max concurrent active jobs per rider is a config value (open question) — if a cap applies, exceeding it shows 'รับงานได้สูงสุด N งาน'. Accept does NOT move the order to out_for_delivery (that belongs to a later delivery-execution epic).

#### RID-QUEUE-03 — View job detail: order summary, address, contact  `🔴 MUST`
**As** rider, **I want** to open a job and see exactly what to pick, where to deliver, and how to reach the customer, **so that** I can pack/verify, navigate, and contact the recipient without calling the shop.

*Acceptance criteria:*
- Given I open a job, Then the order summary lists each OrderItem (product name, chosen size, qty), the subtotal, the delivery fee, and the total via money().
- Given ShopMode=delivery, Then the delivery fee shows '฿40', or 'ฟรี' when subtotal ≥ ฿200 (matching the customer app's deliveryFeeFor rule).
- Given the job has a delivery Address, Then I see recipient name, full address text, optional landmark/note, a map thumbnail, and a 'นำทาง' button that opens the OS maps app to that location.
- Given the customer phone, When I tap 'โทรหาลูกค้า', Then the OS dialer opens with the customer number (tel:); the number is masked in display per PDPA policy.
- Given the order, Then a PaymentStatus badge and PaymentMethod (promptpay_slip in v1) are shown so I know if it is already paid.
- Given the customer left delivery notes (e.g. 'ผู้สูงอายุ โทรก่อนถึง ช่วยยกของขึ้นบ้านด้วยค่ะ'), Then the notes are shown prominently above the address so the rider acts on them.
- Given the Address is missing or unverifiable, Then the 'นำทาง' button is disabled with a hint and 'โทรหาลูกค้า' is emphasized so I can confirm the location by phone.
- Given the icon buttons (นำทาง, โทรหาลูกค้า, back), Then each has an accessibilityLabel and a ≥ 44x44pt touch target.

*Dependencies:* RID-QUEUE-01, Order/OrderItem/Address entities, PDPA phone-masking policy

*Notes:* Delivery-notes display is the ป้าสมศรี recipient angle: elderly customers can't always come to the gate, so the rider must clearly see 'call on arrival / carry upstairs' instructions and have a one-tap call. Reuses real numbers (฿40 fee, ฿200 free threshold) and money() formatting from store/mode.ts + lib/format.ts.

#### RID-QUEUE-04 — Empty, error, and offline states for the queue  `🟠 SHOULD`
**As** rider, **I want** clear feedback when there are no jobs, the fetch fails, or I'm offline, **so that** I'm never stuck staring at a blank or frozen screen and know what to do next.

*Acceptance criteria:*
- Given 'งานของฉัน' has 0 jobs, Then I see a friendly empty state with an icon and 'ยังไม่มีงานของคุณ ตอนนี้พักได้เลย' (large, legible).
- Given 'งานที่ว่าง' has 0 jobs, Then I see 'ยังไม่มีงานว่างตอนนี้' with a hint to pull to refresh.
- Given the queue fetch fails, Then I see an error state with 'โหลดงานไม่สำเร็จ' and a 'ลองใหม่' retry button (accessibilityLabel 'ลองโหลดใหม่').
- Given I am offline, Then the last successfully loaded queue is shown with an offline banner 'ออฟไลน์ - แสดงข้อมูลล่าสุด', and 'รับงาน' is disabled with a hint that I must be online to accept.
- Given connectivity returns, Then the offline banner clears and the queue auto-refreshes.
- Given any empty/error state, Then its text meets WCAG AA contrast and scales with dynamic type without clipping.

*Dependencies:* RID-QUEUE-01, RID-QUEUE-02

*Notes:* Mirrors the customer cart's friendly empty-state pattern (app/(tabs)/cart.tsx). Offline read-only cache prevents a rider mid-shift in a dead-zone from losing their job list.

#### RID-QUEUE-05 — Batch nearby jobs into one trip (batching basics)  `🟠 SHOULD`
**As** rider, **I want** to select several available jobs in the same area and accept them as one batch, **so that** I deliver multiple orders in a single trip instead of returning to the shop each time.

*Acceptance criteria:*
- Given 'งานที่ว่าง' jobs, When I enter selection mode, Then I can multi-select jobs and see a running count and combined item total.
- Given I select jobs, Then I may only batch jobs in the same delivery zone; selecting a job from a different zone is blocked with 'เลือกได้เฉพาะงานในโซนเดียวกัน'.
- Given a configured max batch size (e.g. 4 stops), When I try to exceed it, Then further selection is blocked with a clear limit message.
- Given a valid selection, When I tap 'รับงานเป็นชุด', Then all selected Orders get the same Delivery.batchId, each transitions preparing -> assigned_to_rider, and they appear grouped under one batch in 'งานของฉัน'.
- Given one job in the batch was taken by another rider during accept, When the batch accept runs, Then the remaining jobs are still accepted and I'm told which one failed ('งาน #A1B2 ถูกรับไปแล้ว').
- Given a batch in 'งานของฉัน', Then stops are listed in a basic suggested order (by zone/sequence), and each stop still opens its own job detail (RID-QUEUE-03).

*Dependencies:* RID-QUEUE-01, RID-QUEUE-02, Delivery.batchId support, Zone data on Address

*Notes:* Scope is 'batching basics' only: group + accept + simple zone-based ordering. True route optimization / live ETA sequencing is explicitly OUT of scope for v1 (open question). Requires zoned/geocoded addresses; if addresses are free-text only at v1, batching may degrade to manual multi-select without zone validation — flagged in openQuestions.

#### RID-QUEUE-06 — Collect payment on delivery (COD / pay-on-receipt) — BLOCKED by payment decision  `⚪ WON'T`
**As** rider, **I want** to know whether to collect money on delivery and record the amount I collected, **so that** cash deliveries are reconciled correctly.

*Acceptance criteria:*
- (DEFERRED) Given an unpaid delivery order reaches my queue, When I open it, Then it clearly flags 'เก็บเงินปลายทาง ฿X' and how to collect.
- (DEFERRED) Given I deliver an unpaid order, When I mark collection done, Then PaymentStatus and PaymentMethod (cod) update and the amount is recorded for shift reconciliation.
- (INTERIM, in scope now) Given any job, Then its PaymentStatus badge is read-only and color-coded: paid=green, awaiting_payment/slip_uploaded/verifying=amber, rejected=red, so the rider can see at a glance whether money is owed.
- (INTERIM, in scope now) Given v1 prepay (PaymentMethod=promptpay_slip), Then jobs reaching the queue are expected to be PaymentStatus=paid; if PaymentStatus != paid, the rider sees a 'ยังไม่ชำระเงิน' warning and must NOT improvise cash collection until the payment policy is decided.

*Dependencies:* RID-QUEUE-01, RID-QUEUE-03, OPEN payment-model decision, Admin slip-verification epic

*Notes:* BLOCKED: it is unresolved whether DELIVERY mode is prepay (promptpay_slip + admin slip verification) or pay-on-receipt/COD. The cash-collection and reconciliation criteria are deferred (priority wont for v1) and recorded so they are not forgotten. The read-only PaymentStatus badge is the only in-scope part and is also covered by RID-QUEUE-01/03. Uses canonical PaymentStatus (awaiting_payment, slip_uploaded, verifying, paid, rejected) and PaymentMethod (promptpay_slip; future cod) verbatim.

#### RID-QUEUE-07 — Accessible, glanceable rider queue (large text, contrast, reduced motion)  `🔴 MUST`
**As** rider who may need large text and reads the screen outdoors (ป้าสมศรี-grade accessibility), **I want** the queue and job cards to stay legible and operable at large font sizes, in sunlight, and with reduced motion, **so that** any rider, including an older one, can work the queue safely one-handed.

*Acceptance criteria:*
- Given the OS font size is set to the largest accessibility size, When I view the queue and a job detail, Then the order code, total, address, and 'รับงาน' label remain fully visible (no truncation) and cards reflow rather than overlap.
- Given any status badge, chip, or button, Then text/background contrast meets WCAG AA (≥ 4.5:1 normal, ≥ 3:1 large/icon) and remains readable in bright outdoor light.
- Given every icon-only control (refresh, navigate, call, accept, notification bell, segment toggle, batch select), Then each exposes an accessibilityLabel and role=button to screen readers.
- Given primary actions (รับงาน, โทรหาลูกค้า, นำทาง), Then each touch target is ≥ 44x44pt.
- Given the OS 'reduce motion' setting is on, When a new job arrives or the list updates, Then there is no pulsing/auto-sliding/auto-rotating animation; a static highlight is used instead.
- Given a screen reader is active, When a new job appears, Then it is announced politely (accessibilityLiveRegion=polite) without stealing focus from my current action.

*Dependencies:* RID-QUEUE-01, RID-QUEUE-02, RID-QUEUE-03, RID-QUEUE-08

*Notes:* Directly addresses known baseline debt (WCAG AA contrast, accessibilityLabel on icon buttons, dynamic-type support, reduced-motion) on the rider surface. ป้าสมศรี's persona drives the requirement: although she is a pickup customer, an elderly/low-vision RIDER has the same needs, and her legibility/contrast/touch-target bar is the acceptance standard. Reduced-motion mirrors the customer app's auto-rotating-banner debt.

#### RID-QUEUE-08 — Live queue updates and recalled/cancelled job handling  `🟠 SHOULD`
**As** rider, **I want** the queue to update when new jobs are assigned or jobs are pulled/cancelled, **so that** I never accept or drive toward a job that no longer exists.

*Acceptance criteria:*
- Given the admin assigns me a new job (OrderStatus -> assigned_to_rider with my riderId), When it lands, Then I receive a push notification and the 'งานของฉัน' badge increments.
- Given the queue is open, When a new job arrives, Then it appears at the top of 'งานของฉัน' with a static (reduced-motion-safe) highlight.
- Given a job displayed in my queue becomes OrderStatus=cancelled or is reassigned away from me, When the update arrives, Then I see a toast 'งาน #A1B2 ถูกยกเลิก/มอบหมายใหม่' and the card is removed or greyed.
- Given I am viewing the detail of a job that gets cancelled/recalled, Then a banner appears and accept/navigate/call actions are disabled.
- Given I re-focus the Jobs tab after backgrounding, Then the queue refreshes so its state is current.
- Given updates rely on notifications, When notification permission is denied, Then the queue still refreshes on focus and pull-to-refresh so I am not blind to changes.

*Dependencies:* RID-QUEUE-01, RID-QUEUE-02, Notification/push epic, Realtime/polling backend

*Notes:* delivery_failed and out_for_delivery progression are owned by a separate delivery-execution epic; this story only keeps the QUEUE in sync. Real-time vs short-interval polling is an implementation choice; either must satisfy the 'never act on a dead job' criteria. New-job animation must obey RID-QUEUE-07 reduced-motion.

### RID-DELIVERY — Active Delivery & Proof of Delivery
> Enable อู้ฟู่'s own riders to run an active delivery end-to-end — navigate to and contact the customer, move a delivery-mode order from out_for_delivery to delivered with photo proof of delivery, and handle delivery_failed — so orders close reliably with an auditable trail.

#### RID-DLV-01 — See my current delivery and navigate to the customer  `🔴 MUST`
**As** rider, **I want** open my active delivery and launch turn-by-turn navigation to the customer's address, **so that** I can drive to the right drop without re-typing the address.

*Acceptance criteria:*
- Given I am role `rider` with a job in OrderStatus `out_for_delivery` (or `assigned_to_rider`) and ShopMode `delivery`, When I open the Active Delivery screen, Then I see the customer display name, the full delivery Address, order number, item count, and a prominent 'นำทาง' (Navigate) button.
- Given the Address has valid coordinates, When I tap 'นำทาง', Then the OS hands off to an installed maps app (Apple Maps / Google Maps) with the destination pre-filled.
- Given no maps app is installed or the handoff fails, When I tap 'นำทาง', Then I see a fallback showing the address text with a copy-address action and a non-blocking toast 'เปิดแผนที่ไม่ได้ ลองคัดลอกที่อยู่' (no crash).
- Given the Address has no/invalid geocode, When the screen loads, Then 'นำทาง' falls back to a text search of the address and the raw address is shown so the rider can still proceed.
- Given I have no job in `assigned_to_rider`/`out_for_delivery`, When I open the screen, Then I see an empty state 'ยังไม่มีงานส่งตอนนี้' with no error.
- Given pickup-mode orders exist (ShopMode `pickup`, status `ready_for_pickup`/`picked_up`), Then they never appear in the rider's delivery list — only ShopMode `delivery` jobs do.
- A11y: customer name and address render at >= body size and support dynamic type to the largest setting without truncation; 'นำทาง' and any icon buttons expose accessibilityLabel and have a touch target >= 44pt; text-on-background passes WCAG AA so it stays readable in sunlight.

*Dependencies:* Assignment epic (produces `assigned_to_rider`), Address entity, Order/OrderItem entities

*Notes:* Rider only ever sees ShopMode `delivery` orders. PDPA: expose only the display name + delivery Address needed for this drop, not the customer's full account PII.

#### RID-DLV-02 — Contact the customer (call / message) from the active delivery  `🔴 MUST`
**As** rider, **I want** call or message the customer directly from the job, **so that** I can coordinate the handover (gate code, building entrance, 'I'm downstairs').

*Acceptance criteria:*
- Given an active delivery with a contactable phone on file, When I tap the call action, Then the device dialer opens with the customer number (or proxy number) prefilled.
- Given I tap the message action, Then an available messaging channel (SMS / LINE) opens ready to send.
- Given the order has no contactable phone, When the screen loads, Then call/message actions are disabled with a hint 'ไม่มีเบอร์ติดต่อ — ติดต่อร้าน' and a fallback to contact the shop/admin.
- Given a call cannot be placed (no SIM / permission denied), When I tap call, Then a non-blocking error is shown and I can still proceed with the delivery.
- PDPA: the customer's raw number is masked in the UI where feasible (proxy/relay or last-4) and the contact action is logged; the number is exposed only to place the call, not copied to the clipboard.
- A11y (ป้าสมศรี as recipient): call is the primary, most prominent contact action because elderly recipients may not read chat; call/message icon buttons expose accessibilityLabel ('โทรหาลูกค้า' / 'ส่งข้อความ') with >= 44pt targets and WCAG AA contrast.

*Dependencies:* RID-DLV-01, User/Address phone field

*Notes:* Whether v1 uses a phone proxy/relay (PDPA-preferred) or a masked real number revealed only on dial is an open question — see openQuestions.

#### RID-DLV-03 — Start the run (assigned_to_rider -> out_for_delivery)  `🔴 MUST`
**As** rider, **I want** mark that I've collected the order from the shop and am heading out, **so that** the shop and the customer know the order is on the way.

*Acceptance criteria:*
- Given a job in OrderStatus `assigned_to_rider`, When I tap 'ออกส่งแล้ว' and confirm, Then OrderStatus transitions to `out_for_delivery` and the customer receives a Notification 'ไรเดอร์กำลังนำส่ง'.
- Given the order is not yet `assigned_to_rider` (e.g. still `preparing`), Then the start action is unavailable.
- Given the transition request fails because I am offline, Then it is queued and retried, the rider sees 'กำลังซิงก์', and the state is never silently lost (see RID-DLV-07).
- Given admin cancelled the order while it was in my hand, When I next refresh/sync, Then the order shows OrderStatus `cancelled` and I am told to return it to the shop.
- A11y: the confirm control is >= 44pt with an accessibilityLabel and WCAG AA contrast.

*Dependencies:* Assignment epic, Notification entity

*Notes:* BLOCKED-DEPENDENCY: whether dispatch to `out_for_delivery` requires PaymentStatus `paid` first depends on the unresolved 'delivery prepay vs pay-on-receipt' decision. Under prepay (PaymentMethod `promptpay_slip`) the order should reach `paid` before `assigned_to_rider`; under COD an unpaid order may legitimately go out. Do not finalize the payment gate until the ADR resolves.

#### RID-DLV-04 — Complete delivery with proof of delivery (out_for_delivery -> delivered)  `🔴 MUST`
**As** rider, **I want** mark the order delivered and capture a proof-of-delivery photo plus confirmation, **so that** there is evidence the customer received the goods and the order closes.

*Acceptance criteria:*
- Given a job in OrderStatus `out_for_delivery`, When I tap 'ส่งสำเร็จ', Then I am prompted to capture proof of delivery before the order can complete.
- Given I take/attach a photo and tap confirm, Then OrderStatus transitions to `delivered`; the proof photo, timestamp, and (if permitted) geolocation are saved to the Delivery record; and the customer and admin receive a Notification.
- Given camera permission is denied, When I proceed, Then a 'confirm without photo' path is available that records a reason; the app never hard-blocks completing the drop (no crash).
- Given the photo upload fails (no signal), Then the `delivered` outcome and photo are queued offline and synced later with a pending-sync indicator, so I am not blocked at the customer's door (see RID-DLV-07).
- Given the order is already `delivered`, Then the complete action is idempotent/disabled — no double transition.
- A11y (ป้าสมศรี as recipient): completion must NOT require the elderly customer to operate any app — a rider-side photo + confirm is sufficient proof; the camera and confirm buttons expose accessibilityLabel, are >= 44pt, and pass WCAG AA contrast for outdoor use.

*Dependencies:* RID-DLV-03, Delivery entity, Camera/media permission, Notification entity

*Notes:* Under the prepay assumption the rider handles no money at `delivered` (PaymentStatus already `paid`); the COD variant is RID-DLV-06 and is blocked. PDPA: POD photos may capture a person/home — store securely, purpose-limited to dispute resolution, with a defined retention period and access limited to shop/admin. Whether a stronger customer OTP/signature proof is required (and its fallback for recipients like ป้าสมศรี) is an open question.

#### RID-DLV-05 — Report a failed delivery (out_for_delivery -> delivery_failed)  `🔴 MUST`
**As** rider, **I want** record that a delivery could not be completed, with a reason, **so that** the shop can follow up or reschedule and I am not stuck on the job.

*Acceptance criteria:*
- Given a job in OrderStatus `out_for_delivery`, When I tap 'ส่งไม่สำเร็จ' and pick a reason from a fixed list (ลูกค้าไม่รับสาย / ไม่มีคนรับ / ที่อยู่ผิด / ลูกค้าปฏิเสธรับ / อื่นๆ), Then OrderStatus transitions to `delivery_failed` and admin receives a Notification.
- Given I select 'อื่นๆ', Then a free-text note is required before the submit button enables.
- Given I optionally attach a photo (e.g. closed gate), Then it is saved to the Delivery record alongside the failure reason.
- Given no reason is selected, Then the submit button stays disabled with a hint to choose a reason.
- Given I am offline, Then the `delivery_failed` outcome is queued and synced later, not lost (see RID-DLV-07).
- Given a COD order where no cash was collected, Then no payment is recorded and PaymentStatus is left unchanged (flagged — depends on the COD decision).
- A11y: reason options are large single-tap rows >= 44pt with WCAG AA contrast; icon and submit buttons expose accessibilityLabels.

*Dependencies:* RID-DLV-03, Delivery entity, Notification entity

*Notes:* `delivery_failed` is a branch/terminal state in the lifecycle. Re-dispatch/retry (resetting back to `assigned_to_rider`) is owned by the admin/assignment epic — flag as cross-surface, not built here.

#### RID-DLV-06 — Collect cash on delivery (COD) at handover — BLOCKED by open payment decision  `🟡 COULD`
**As** rider, **I want** collect the order total in cash at the door and mark it collected, **so that** pay-on-receipt customers can pay me and the order is reconciled.

*Acceptance criteria:*
- Given the payment decision selects pay-on-receipt and the order uses PaymentMethod `cod`, When I complete delivery (RID-DLV-04), Then I am shown the amount due and can tap 'เก็บเงินแล้ว', which sets PaymentStatus to `paid` and records the collected amount on the Payment record.
- Given the customer cannot pay the full amount, When I record a short/declined payment, Then the order routes to `delivery_failed` or an admin-review path (exact rule TBD by the ADR).
- Given a prepay order (PaymentMethod `promptpay_slip`, PaymentStatus `paid`), Then no cash-collection step is shown — this story is inert for prepay orders.
- A11y: the amount due is shown in large high-contrast type and 'เก็บเงินแล้ว' is a >= 44pt button with an accessibilityLabel.

*Dependencies:* RID-DLV-04, Payment entity, ADR-pending payment decision

*Notes:* BLOCKED: this entire story is contingent on the unresolved 'delivery prepay vs pay-on-receipt' decision and whether PaymentMethod `cod` is in v1 at all. Do NOT implement until the ADR resolves. Cash float / end-of-shift reconciliation between rider and shop is unspecified. Recorded in openQuestions.

#### RID-DLV-07 — Capture delivery outcomes through poor signal (offline-first sync)  `🟠 SHOULD`
**As** rider, **I want** record delivery outcomes and proof even with no or weak signal, **so that** handovers are never blocked at the door and nothing is lost.

*Acceptance criteria:*
- Given I am offline, When I complete (`delivered`) or fail (`delivery_failed`) a delivery, Then the outcome and any proof photo are stored locally and a 'รอซิงก์' indicator is shown.
- Given connectivity returns, Then queued outcomes sync automatically in the order they occurred, the indicator clears, and server state matches the local outcome.
- Given a sync conflict (e.g. admin already moved the order to `cancelled`), Then the rider is shown the authoritative server state and the local change is reconciled, not silently overwritten.
- Given the app is killed before sync, Then queued outcomes persist across restart and still sync.
- A11y: the sync status is conveyed by text plus icon (not color alone) and passes WCAG AA contrast.

*Dependencies:* RID-DLV-04, RID-DLV-05

*Notes:* Defines the reliability behavior shared by the complete/fail (and future COD) flows; supports the crash-free >= 99.5% target. Could be deferred to a fast-follow if v1 launch assumes always-connected riders.
