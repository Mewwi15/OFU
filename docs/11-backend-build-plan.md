# 11 — Backend Build Plan (Phase 3 kickoff)

- **สถานะ:** Draft (2026-06-29) — แผน *implementation* สำหรับเริ่มสร้าง backend
- **ความสัมพันธ์กับเอกสารอื่น:** สเปก design เสร็จแล้ว (`05-architecture`, `06-data-model` 39 ตาราง, `07-api-contract` 50+ RPC, ADR-0001/0002/0003). เอกสารนี้คือ **วิธีแปลงสเปก → ของที่สร้างได้จริง และลำดับการสร้าง** ไม่ใช่ออกแบบ schema ใหม่
- **กฎความปลอดภัยที่ทับทุกอย่าง:** business logic อยู่ใน Postgres (`SECURITY DEFINER` RPC) เท่านั้น, key/secret อยู่ฝั่ง server เท่านั้น, ห้าม commit key (มี Google Maps key หลุดใน `app.json` อยู่แล้ว — flag ให้เจ้าของ)

---

## 1. Decisions ที่เคาะแล้ว (2026-06-29)

| # | เรื่อง | ตัดสิน | กระทบ |
|---|---|---|---|
| D1 | ราคา+สต็อก | **แยกตาม variant (ขนาด)** | `product_variants` ถือ `price`+`stock_qty` ของตัวเอง; `order_items` อ้าง `variant_id`; oversell guard ที่ระดับ variant |
| D2 | ตัดสต็อก | **กันตอนสั่ง (reserve@place_order) → ตัดจริงตอนยืนยันชำระ/คอนเฟิร์ม** | `place_order` reserve, `approve_slip`/`confirm` commit (floor 0), ปล่อย reserve เมื่อ cancel/หมดเวลา |
| D3 | Slice แรก | **Auth/เข้าสู่ระบบก่อน** | ดู §6 — ปลดล็อกทุก flow ที่ตามมา + ตั้ง long-lead (SMS sender-ID) แต่เนิ่นๆ |

ฟุลฟิลเมนต์ยึดตาม ADR-0003: `online` = Flash Express (พัสดุ), `delivery` = ไรเดอร์ร้าน

---

## 2. Doc reconciliation ที่ต้องทำก่อนเขียน migration

เอกสาร `06`/`07` เขียนตอน ShopMode ยังเป็น `delivery|pickup` — **ล้าสมัยแล้ว**. ต้อง patch ให้ตรงโมเดลปัจจุบันก่อนแปลงเป็น SQL:

1. **ShopMode enum** `delivery|pickup` → `delivery|online` (online=Flash). ลบ flow pickup ออกจาก order state machine
2. **OrderStatus** ขยายให้ตรงโค้ดที่ทำไปแล้ว (8 สถานะ): `preparing|picked_up|in_transit|out_for_delivery|delivered|delivery_failed|returned|cancelled` + map Flash code 1-9 (มีใน `lib/flash.ts` แล้ว)
3. **เพิ่ม Flash fields** ลง `deliveries` (หรือตารางใหม่ `parcel_shipments`): `courier`, `tracking_no(pno)`, `flash_state`, `weight_g`, `express_category`, `article_category`
4. **Variant pricing (D1):** ย้าย `price` จาก `products` → `product_variants`; `products.sizes[]` (mock ปัจจุบัน) กลายเป็น rows ใน `product_variants`
5. **Stock fields (D2):** `product_variants` เพิ่ม `stock_qty`, `reserved_qty`; นิยาม `available = stock_qty - reserved_qty`

> งานนี้เป็นการแก้เอกสาร + เพิ่ม changelog ไม่ใช่ redesign — ทำเป็น commit เดียวก่อนเริ่ม migration

---

## 3. Repository seam (สะพาน: stores ↔ Supabase)

หัวใจของการสลับ mock → ของจริงแบบเจ็บน้อย คือ **ชั้น repository บางๆ** คั่นกลาง store กับ `supabase-js`:

```
UI (screens)
   ↓
zustand stores (UI/session state)  +  TanStack Query (server cache, reads)
   ↓                    ↓
lib/data/*Repository.ts        ← interface (ของที่ store เรียก)
   ↓
lib/data/supabase/Supabase*Repository.ts   ← impl (เรียก supabase-js: rpc / from / channel)
   ↓
Supabase (Postgres RPC + PostgREST + Realtime + Storage)
```

หลักการ:
- **store เรียก repo เท่านั้น ไม่เรียก `supabase-js` ตรง** → mock-repo สำหรับเทสต์/ออฟไลน์ได้, swap provider ได้ (รองรับ scale-to NestJS ตาม ADR-0001)
- **reads → TanStack Query** (cache/invalidate/refetch), **session/UI state → zustand** คงเดิม
- **Realtime** ห่อใน repo (`subscribeOrders(shopId, cb)`) แล้ว store/Query invalidate
- **Error envelope เดียว:** `lib/data/errors.ts` → `ApiError { code, messageTh, retryable }`; map จาก Postgres error code ของ RPC; UI โชว์ `messageTh` จาก catalog (keyed by code)

ตัวอย่าง seam ที่มีอยู่แล้วและพร้อมต่อ — `store/auth.ts` ปัจจุบันคือ interface ที่ `SupabaseAuthRepository` จะ back ได้พอดี (login/logout/updateProfile/status/user) → §6

---

## 4. โครงไฟล์ที่จะสร้าง

```
supabase/
  config.toml                      # CLI config (project ref, local ports)
  migrations/
    0001_extensions_enums.sql      # pgcrypto, citext; 17 enums (06-data-model)
    0002_tables.sql                # 39 ตาราง + constraints + indexes
    0003_rls.sql                   # RLS per role (REVOKE direct write บน orders/payments/catalog)
    0004_rpc.sql                   # 30+ SECURITY DEFINER RPC (place_order, approve_slip, ...)
    0005_realtime.sql              # publications + realtime.messages RLS (channels ใน 07)
    0006_storage.sql               # 7 buckets (public/private) + signed-URL policy
  functions/                       # Edge Functions (Deno) — สร้างทีละตัวตาม slice
    send-sms-hook/ auth-line-exchange/ expo-push-fanout/ generate-promptpay-qr/ ...
  seed.sql                         # shop, หมวด, สินค้า+variant, test customer/admin/rider

lib/
  supabase/client.ts               # createClient (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY)
  data/
    types.ts                       # DTOs + enums (mirror 06)
    errors.ts                      # ApiError + code→messageTh catalog
    AuthRepository.ts CatalogRepository.ts CartRepository.ts OrderRepository.ts
    DeliveryRepository.ts PaymentRepository.ts AccountRepository.ts
    supabase/Supabase*Repository.ts
  auth/guards.ts                   # requireRole/requireActive/requireConsent (อ่าน JWT claims)
```

**ลำดับ migration สำคัญ:** enums → tables → RLS → RPC → realtime → storage. แต่ละไฟล์ idempotent ได้ (CREATE ... IF NOT EXISTS) เพื่อ re-run บน local

---

## 5. Local dev & secrets

- **Supabase CLI** `supabase init` + `supabase start` → ได้ stack ครบบนเครื่อง (Postgres/Studio/Realtime/Storage) ไม่ต้องแตะ cloud จนกว่าจะ deploy
- `.env.local` (gitignored): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ฝั่ง client); `SUPABASE_SERVICE_ROLE_KEY` ใช้ใน Edge Function เท่านั้น — **ห้ามเข้า bundle**
- `seed.sql` provision: 1 ร้าน, แคตตาล็อก, และ test accounts (customer/admin/rider) ให้ login ได้ทันทีตอน dev
- Cloud project (region **Singapore**) สร้างเมื่อพร้อม staging — migration เดียวกัน apply ขึ้นได้เลย

---

## 6. Slice 1 — Auth (ออกแบบละเอียด)

**เป้า:** ปลด gate `app/_layout.tsx` ให้ขับด้วย session จริงจาก Supabase Auth แทน mock `useAuth.login()` โดยไม่แตะ UX เดิม

### 6.1 ความจริงเรื่อง long-lead (ออกแบบให้ไม่ติดบล็อก)
Phone OTP เป็น primary ของคนไทย **แต่จด sender-ID กับ aggregator ใช้เวลาเป็นสัปดาห์** (ต้องนิติบุคคล) → แยกเส้นทาง:
- **Dev/staging:** เปิด **Google + Apple OIDC** (ใช้ได้ทันที) + OTP ผ่าน `send-sms-hook` แบบ **stub** (คืนรหัสคงที่ใน dev) → gate ใช้งานได้เลยโดยไม่รอ SMS
- **Prod:** สลับ `send-sms-hook` ไปต่อ aggregator จริงเมื่อ sender-ID อนุมัติ; LINE OIDC (R1, ซับซ้อนสุด) ทำเป็น spike แยกสัปดาห์แรก
→ **แนะนำเปิด social ก่อน** เพื่อให้ทั้งทีมเดินต่อได้ระหว่างรอ SMS

### 6.2 AuthRepository (interface ที่ store เรียก)
```ts
interface AuthRepository {
  current(): Promise<Session | null>;
  onChange(cb: (s: Session | null) => void): () => void;   // supabase.auth.onAuthStateChange
  startPhoneOtp(phone: string): Promise<void>;             // signInWithOtp
  verifyPhoneOtp(phone: string, code: string): Promise<Session>;
  signInWithIdToken(p: 'google'|'apple'|'line', token: string): Promise<Session>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;// RPC update_profile
}
```
`SupabaseAuthRepository` รับผิดชอบ: เรียก `supabase.auth.*`, ฟัง `onAuthStateChange`, อ่าน JWT claims (`role`, `account_state`), และ map error → `ApiError`

### 6.3 ต่อกับ gate ที่มีอยู่
- `store/auth.ts`: `status`/`user` เปลี่ยนมาเซ็ตจาก `AuthRepository.onChange` (session) แทน `login()` mock — **interface เดิมคงรูป** gate ใน `_layout.tsx` ไม่ต้องแก้ logic (`showLogin = onboarded && !isAuthed` ฯลฯ)
- **app_users provisioning:** ตอน sign-in ครั้งแรก → trigger `on auth.users insert` หรือ RPC `ensure_app_user()` สร้างแถวใน `app_users` (role=customer, account_state=active) + เก็บ phone/ชื่อ
- **PIN app-lock** (`store/lock.ts`) ยังเป็น client-side ตามเดิม — เป็นชั้น UX ทับ session ไม่เกี่ยวกับ Supabase
- **PDPA consent:** หลัง login เรียก `get_consent_status`; ถ้ายังไม่ยินยอม → หน้า consent → `grant_consent` ก่อนเข้าแอป (เพิ่มเป็น guard ใน gate หรือ interstitial)

### 6.4 Edge Functions ของ slice นี้
- `send-sms-hook` (Auth SMS hook) — dev stub → prod aggregator
- `auth-line-exchange` — LINE OIDC custom (ทำทีหลัง/spike)

### 6.5 Acceptance criteria
- [ ] เปิดแอปครั้งแรก → onboarding → login ด้วย Google/Apple → เข้าแอปได้, `app_users` มีแถว
- [ ] login ด้วยเบอร์ + OTP (dev stub) สำเร็จ, session persist ข้าม cold start
- [ ] logout → กลับหน้า login, session ถูกล้าง
- [ ] consent gate ทำงาน (ครั้งแรกต้องยินยอมก่อน)
- [ ] PIN lock ยังทำงานทับ session ได้เหมือนเดิม
- [ ] ไม่มี key หลุดใน bundle; reads/writes ผ่าน repo seam

---

## 7. ลำดับ slice ถัดไป (หลัง Auth)

| Slice | ขอบเขต | RPC/ช่องทางหลัก |
|---|---|---|
| 2 Catalog (read) | สินค้า/หมวด/แบนเนอร์/variant จาก Supabase แทน mock | PostgREST read (RLS public), TanStack Query |
| 3 Cart | cart authoritative ฝั่ง server | `add_cart_item`/`set_cart_item_qty`/`set_cart_mode`/`apply_cart_promo` |
| 4 Order + Payment | checkout, **reserve สต็อก (D2)**, สลิป+ตรวจ | `place_order` (idempotent), `approve_slip`, PromptPay QR Edge Fn |
| 5 Delivery + Flash | ไรเดอร์ realtime / Flash webhook → สถานะ | Realtime channels, `flashWebhookHandler` Edge Fn (verify+re-`routes`) |
| 6 Admin web | catalog/orders/slip/rider จัดการ | RPC ชุด `upsert_*`, `approve_slip`, `assign_rider` |

---

## 8. Decisions ที่ยังเป็นของเจ้าของ (ทำคู่ขนาน)

- **SMS aggregator** (ThaiBulkSMS vs SMSMKT) — **long-lead, เริ่มเลือก+จด sender-ID ตั้งแต่วันนี้** (บล็อก prod OTP ไม่บล็อก dev)
- **PDPA SLA / retention** — รอ DPO sign-off (export/erasure window, erase-vs-anonymise ออเดอร์เก่า)
- **Payment gateway จริง** (Omise/2C2P/GB Prime) — defer นอก v1 (ADR-0002)

---

## 9. Testing & CI

- **pgTAP** — เทสต์ RLS (ลูกค้าอ่านออเดอร์ตัวเองเท่านั้น, rider ไม่เห็น PII นอกหน้าต่างเวลา) + contract ของ RPC (idempotency, oversell guard)
- **Jest + RNTL** — เทสต์ repository ด้วย mock + store wiring
- **Maestro** — E2E happy path (login → สั่ง → ชำระ → ติดตาม)
- **GitHub Actions** — apply migration บน Postgres ephemeral + run pgTAP ก่อน merge

---

## 10. ก้าวถัดไปทันที

1. (เอกสาร) reconcile `06`/`07` ตาม §2 — commit เดียว
2. (infra) `supabase init` + เขียน `0001`–`0002` (enums+tables, รวม variant/stock ตาม D1/D2)
3. (seam) วาง `lib/supabase/client.ts` + `lib/data/errors.ts` + `AuthRepository` + `SupabaseAuthRepository`
4. (slice 1) ต่อ `store/auth.ts` เข้า repo + เปิด Google/Apple + consent gate → ผ่าน acceptance §6.5
