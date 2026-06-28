# 04 — Non-Functional Requirements (v1)

> NFR เขียนเป็น story แบบวัดผลได้ — เกณฑ์เหล่านี้กลายเป็น acceptance ในเฟส Testing (`09-test-plan.md`)

### NFR — Non-Functional Requirements — Accessibility, Performance, Security & Privacy, Reliability, Observability, i18n & Compatibility
> Make อู้ฟู่ measurably accessible, fast, secure/PDPA-compliant, reliable, observable, localizable and cross-platform across the customer app, rider app and admin web, with release gates that anyone can verify.

#### NFR-A11Y-01 — Color contrast meets WCAG 2.1 AA on every surface and theme  `🔴 MUST`
**As** ป้าสมศรี (elderly customer with reduced vision), **I want** all text and meaningful UI to have sufficient color contrast in both light and dark mode, **so that** I can read prices, totals and buttons without squinting or guessing.

*Acceptance criteria:*
- Given any text rendered on its actual background across the customer app, rider app and admin web, When contrast is measured, Then normal text is >= 4.5:1 and large text (>= 18pt regular / 14pt bold) and meaningful icons/UI components are >= 3:1, per WCAG 2.1 AA.
- Given the current muted token #9B9B9B on background #F2F3F5 (~2.5:1) and on card #FFFFFF (~2.6:1) used for secondary text (e.g. 'ยอดรวมสินค้า', 'ค่าจัดส่ง', placeholders), When audited, Then it FAILS today and must be darkened until it passes the applicable threshold.
- Given the free-delivery label 'ฟรี' rendered in primary green #00A94F on white (~3.0:1), When shown, Then it is rendered as large/bold (so 3:1 large-text rule applies) or the color is darkened to reach 4.5:1.
- Given dark mode is enabled, When any screen is shown, Then every token pair still meets AA (no regressions between light/dark).
- Given disabled or placeholder text, When shown, Then it meets >= 3:1 or is paired with a non-color cue (icon/label).
- Given the design-token test in CI, When the build runs, Then it asserts zero AA failures for defined foreground/background pairs and blocks release on any failure.

*Dependencies:* Design tokens (theme/colors.ts, constants/theme.ts), BNA UI theme provider

*Notes:* a11y is a hard requirement for ป้าสมศรี, not a nicety. #9B9B9B muted text is documented baseline debt and a real, measurable failure. Status colors used for OrderStatus/PaymentStatus badges must also pass AA and never rely on color alone.

#### NFR-A11Y-02 — Accessible labels, roles and >=44pt touch targets on all controls  `🔴 MUST`
**As** ป้าสมศรี shopping with TalkBack/VoiceOver and large fingers, **I want** every button (especially icon-only ones) to be announced clearly and be easy to tap, **so that** I can browse, add to cart and check out without mis-taps or unlabeled controls.

*Acceptance criteria:*
- Given every icon-only control (notifications bell, bag/cart, options/filter, QuantityStepper +/-, IconButton), When inspected with VoiceOver/TalkBack, Then each exposes a meaningful Thai accessibilityLabel and role=button and never announces only 'button' or the raw icon name.
- Given controls currently wired to onPress={() => {}} placeholders, When audited, Then they are either functional or not focusable, and decorative images are marked accessibility-hidden.
- Given any interactive control on the mobile apps, When measured, Then its tap target is >= 44x44pt (iOS) / 48x48dp (Android), using hitSlop where the visual is smaller (e.g. stepper, promo 'ใช้โค้ด').
- Given the cart badge / dynamic counts change, When updated, Then the new value is announced to the screen reader.
- Given ป้าสมศรี uses TalkBack end-to-end, When she adds a product and completes checkout, Then every step is reachable and labeled with no dead-ends.
- Given the admin web, When navigated by keyboard only, Then focus order is logical, focus is visibly ringed, and icon buttons expose ARIA labels (operable without a mouse).

*Dependencies:* BNA UI components (components/ui/*), components/ui/IconButton.tsx, components/ui/QuantityStepper.tsx

*Notes:* Missing accessibilityLabel on icon buttons is documented baseline debt. Touch >=44pt directly serves ป้าสมศรี. Empty onPress placeholders in cart.tsx/index.tsx are the concrete offenders.

#### NFR-A11Y-03 — Dynamic-type scaling and reduced-motion support  `🔴 MUST`
**As** ป้าสมศรี who runs her phone at the largest font size and gets motion sick, **I want** text to scale up without breaking layouts and animations to stop when I ask the OS to reduce motion, **so that** I can read everything and the screen does not move on its own.

*Acceptance criteria:*
- Given OS font scaling at the largest accessibility setting (iOS Dynamic Type AX5 / Android font scale 2.0), When any screen is opened, Then text scales and critical info (price, รวมทั้งหมด total, CTA buttons, tab labels) is never clipped, truncated or overlapped, and the screen remains scrollable.
- Given fixed-height containers (e.g. promo input height 40, hero banner height 180), When font scale increases, Then they grow or wrap so text is not cut off.
- Given the OS 'Reduce Motion' setting is ON, When the home screen is shown, Then the auto-rotating hero banner (currently BANNER_INTERVAL = 2000ms) does NOT auto-advance, and parallax/hello-wave/transition animations are disabled or made instant.
- Given Reduce Motion is ON, When the user swipes the banner manually, Then paging still works and the position dots still update.
- Given Reduce Motion is OFF, When the home screen is shown, Then the banner auto-rotates as today (no regression).
- Given ป้าสมศรี with large text + Reduce Motion enabled, When she shops, Then content is readable and nothing animates unexpectedly.

*Dependencies:* Hero banner (app/(tabs)/index.tsx), AccessibilityInfo (isReduceMotionEnabled), NFR-A11Y-01

*Notes:* Reduced-motion for the auto-rotating banner and dynamic-type support are both documented baseline debt and both affect ป้าสมศรี. Use AccessibilityInfo.isReduceMotionEnabled + listener to pause the setInterval.

#### NFR-PERF-01 — Performance budgets: cold start, list scroll, image loading  `🔴 MUST`
**As** น้องแนน, a busy worker on a mid-range phone and patchy network, **I want** the app to start fast and scroll the catalog smoothly without janky or broken images, **so that** I can shop in a hurry without waiting or stutter.

*Acceptance criteria:*
- Given a reference mid-range device (iPhone SE 2nd gen and a Snapdragon-6xx Android, e.g. Galaxy A23 / Pixel 4a) with the app fully closed, When launched, Then time-to-interactive home-with-content is <= 3.0s at p90 and <= 4.0s at p99.
- Given the full catalog scaled to ~500 products, When scrolling the home grid, Then median frame rate is >= 58fps with < 1% dropped frames, and the grid is rendered by a virtualized list (FlatList/FlashList) rather than the current ScrollView + .map().
- Given product images, When the grid renders, Then images lazy-load with a placeholder, are cached (memory-disk), cause no layout shift, and are served resized for the thumbnail (not full resolution).
- Given a slow network or empty catalog, When a screen loads, Then a skeleton/placeholder appears within 300ms and there is never a blank white screen for > 1s.
- Given the device is offline, When images cannot load, Then a cached image or branded placeholder is shown (never a broken-image icon).
- Given a tap on a product card, When navigating to details, Then the screen responds within 300ms.
- Given the release pipeline, When built, Then cold-start and scroll-fps budgets are measured and a regression beyond budget fails the gate.

*Dependencies:* Catalog virtualization (replace ScrollView+map grid), expo-image, data/products.ts shape

*Notes:* Current home grid (app/(tabs)/index.tsx) maps all products into a ScrollView — not virtualized; this is the main scroll-perf risk. Reference-device list to be confirmed (see open questions).

#### NFR-SEC-01 — Security & privacy: PDPA consent, OTP/social auth, slip storage, RBAC  `🔴 MUST`
**As** เฮียอู้ฟู่ (shop owner) accountable under PDPA, **I want** customer data, login and uploaded payment slips to be handled securely and lawfully, **so that** we protect customers and avoid legal/financial exposure.

*Acceptance criteria:*
- Given any client-server request, When sent, Then it uses TLS 1.2+ and no PII is transmitted or stored in plaintext.
- Given signup, When the user gives PDPA consent, Then consent (purpose, policy version, timestamp) is recorded server-side, the user cannot proceed without explicit consent, and they can later view/withdraw consent and request account + data deletion.
- Given phone+OTP login, When an OTP is issued, Then it is 6 digits, expires within 5 minutes, allows max 5 verify attempts before lockout/backoff, is rate-limited per phone and IP, and is never written to logs or analytics.
- Given social login (LINE, Apple, Google), When the session is established, Then tokens are stored in Keychain/Keystore (expo-secure-store) — never AsyncStorage/plaintext — no client secret ships in the bundle, and tokens are revoked on logout.
- Given a customer uploads a transfer slip (PaymentStatus = slip_uploaded), When stored, Then the slip image (contains bank/PII) lives in a private bucket (not a public CDN), is encrypted at rest and in transit, is accessible only via short-lived signed URLs, is readable only by Roles = admin, and is auto-purged per a defined retention policy.
- Given the canonical Roles (customer | admin | rider), When any API is called, Then role-based access is enforced server-side — a customer or rider cannot approve/reject slips (move PaymentStatus to paid/rejected) or read another user's orders.
- Given a rejected slip (PaymentStatus = rejected / OrderStatus = payment_rejected), When the customer re-uploads, Then the new and old slip images remain private and access-controlled.

*Dependencies:* Auth backend (OTP + social), Payment-slip storage backend, PDPA consent flow, Roles enforcement

*Notes:* PDPA consent and slip privacy are mandatory. PaymentMethod v1 = promptpay_slip only. OPEN: a real gateway (Omise/2C2P/GB Prime) would add PCI-DSS SAQ scope + tokenization NFRs, and COD has no slip — both deferred (see open questions); do NOT design final payment-security controls yet.

#### NFR-REL-01 — Reliability: crash-free >=99.5%, offline & error handling  `🔴 MUST`
**As** any อู้ฟู่ user (customer, rider, admin), **I want** the apps to rarely crash and to fail gracefully when the network drops, **so that** I never lose my cart or an order and always understand what went wrong.

*Acceptance criteria:*
- Given a production release, When measured over a rolling 7 days per surface, Then crash-free sessions >= 99.5% and crash-free users >= 99.7% on the customer and rider apps, and the admin web JS error rate is tracked against a target.
- Given the device is offline with previously loaded data, When the app is opened, Then the cached catalog and current cart are viewable, the selected ShopMode (delivery | pickup) persists, and nothing crashes.
- Given an action needs network (place order, upload slip, request OTP) and it fails, When the user retries, Then a Thai error message + retry is shown, the cart/order draft is preserved with no data loss, and retry is idempotent (no duplicate order is created).
- Given a rider loses connection mid-delivery, When connectivity returns, Then queued status updates sync and no OrderStatus transition is lost.
- Given the server returns a 5xx or a request times out, When it happens, Then the user sees a graceful Thai error (never a raw stack trace) and timeouts use sensible limits with backoff.
- Given any list is empty, When shown, Then a friendly Thai empty state appears (e.g. cart 'ตะกร้าว่างเปล่า', search 'ไม่พบสินค้าที่ค้นหา', no orders) and never a blank screen.

*Dependencies:* NFR-OBS-01 (crash tooling to measure the KPI), Offline cache layer, store/cart.ts persistence

*Notes:* The 99.5% KPI is only verifiable once crash reporting (NFR-OBS-01) is in place. Idempotent order submission is important because the payment decision is open and a double-charge/double-order must not happen.

#### NFR-OBS-01 — Observability: crash reporting + funnel analytics on canonical enums  `🔴 MUST`
**As** เฮียอู้ฟู่ / the product team, **I want** crashes and key business events captured consistently across all surfaces, **so that** we can measure reliability, spot drop-off, and fix issues quickly without exposing customer data.

*Acceptance criteria:*
- Given any surface, When an unhandled crash or JS error occurs, Then it is captured with release/version, OS, device and Roles tag — and never with PII (no phone, OTP, address or slip image) — enabling the crash-free KPI in NFR-REL-01.
- Given key funnel moments, When they happen, Then structured events are emitted for app_open, mode_selected (value in ShopMode: delivery | pickup), add_to_cart, checkout_started and order_placed.
- Given order lifecycle changes, When they occur, Then events use the exact OrderStatus values (placed, awaiting_payment, slip_uploaded, payment_verifying, confirmed, preparing, assigned_to_rider, out_for_delivery, delivered, ready_for_pickup, picked_up, cancelled, payment_rejected, delivery_failed) and exact PaymentStatus values (awaiting_payment, slip_uploaded, verifying, paid, rejected).
- Given PDPA, When a user has not consented or has opted out, Then no analytics/tracking fires before consent and no PII appears in any event payload.
- Given crash-free sessions drop below 99.5%, When the threshold is crossed, Then an alert fires; and an admin-facing metric tracks the payment-verification (slip) backlog.
- Given the device is offline, When events are generated, Then they are buffered and flushed on reconnect with no duplicates.

*Dependencies:* Crash/analytics vendor selection, PDPA consent (NFR-SEC-01), Canonical OrderStatus/PaymentStatus/ShopMode enums

*Notes:* Analytics MUST use canonical enum values verbatim (note: code currently uses ShopMode 'online' — normalize to 'pickup' before emitting). OPEN: gateway/COD payment events are TBD pending the payment decision. Vendor (Sentry/Firebase/Amplitude) and PDPA data-processing agreement to be confirmed.

#### NFR-I18N-01 — i18n-readiness: externalized Thai-first strings and locale formatting  `🟠 SHOULD`
**As** the product team (Thai-first, possibly adding English later), **I want** all user-facing copy and formatting to be locale-driven rather than hardcoded, **so that** we can add a language or adjust copy without touching screen code.

*Acceptance criteria:*
- Given the app, When any screen renders, Then Thai (th-TH) is the default and all user-facing strings come from a centralized string catalog, not literals in components (current hardcoded Thai in cart.tsx/index.tsx must be externalized).
- Given a new locale (e.g. en) is added to the catalog, When the app builds, Then no screen code changes are needed, and any missing key falls back to Thai (never blank).
- Given monetary and numeric values, When displayed, Then currency uses THB via lib/format.ts money() and numbers/dates use locale-aware formatting, with pluralization handled (e.g. item counts).
- Given long translated strings, When rendered, Then layouts do not clip (ties to NFR-A11Y-03 dynamic-type) and no hardcoded left/right would block a future RTL locale.
- Given OrderStatus, PaymentStatus and ShopMode enum values, When shown to users, Then each maps to a localized Thai display label kept separate from the canonical enum value used in code/analytics.
- Given a missing translation key in development, When encountered, Then it is logged for the team while production falls back gracefully.

*Dependencies:* String catalog / i18n library, lib/format.ts (money), Canonical enum -> label mapping

*Notes:* Keep canonical enum values (delivery/pickup, OrderStatus, PaymentStatus) in code; only the display label is localized. Externalizing strings also de-risks the open payment copy (delivery prepay vs pay-on-receipt) changing later.

#### NFR-COMPAT-01 — Compatibility matrix: iOS, Android and admin-web browsers  `🔴 MUST`
**As** ป้าสมศรี on an older phone and เฮียอู้ฟู่ on a shop laptop, **I want** the apps and admin web to work on the OS and browser versions we actually use, **so that** no customer, rider or staff member is locked out by their device.

*Acceptance criteria:*
- Given the customer and rider apps are built on Expo SDK 54, When installed, Then they run on the SDK 54 minimum and current OS versions — targeting iOS 15.1+ and Android 7.0 (API 24)+ (exact floors to be confirmed against the Expo SDK 54 docs) — covering ป้าสมศรี's older phone.
- Given screen sizes from small (iPhone SE) to large/tablet, including notch and safe-area devices, When any screen renders, Then layouts use safe-area insets and reflow in portrait without clipping.
- Given the admin web app, When opened, Then it works on the latest 2 versions of Chrome, Edge, Safari and Firefox and is responsive from 1280px desktop down to 768px tablet.
- Given the admin core flows (verify slip, assign rider, view dashboard), When used on the web, Then they are fully keyboard-accessible (ties to NFR-A11Y-02).
- Given OS light/dark theme, When toggled, Then both light and dark token sets render correctly on all three surfaces.
- Given an unsupported/old browser opens the admin web, When detected, Then a graceful 'please upgrade' notice is shown rather than a broken page.

*Dependencies:* Expo SDK 54, Admin web stack, react-native-safe-area-context

*Notes:* AGENTS.md requires confirming exact API/OS floors against https://docs.expo.dev/versions/v54.0.0/ before coding. Web-admin browser matrix needs sign-off (see open questions).
