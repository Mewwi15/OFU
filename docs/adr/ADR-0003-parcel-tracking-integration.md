# ADR-0003 — Parcel Tracking Integration (โหมด online = Flash Express)

- **สถานะ:** ✅ Accepted (2026-06-29) — **เลือก A) ต่อ Flash Express Open API ตรง (เจ้าเดียว)**
- **วันที่:** 2026-06-29
- **เกี่ยวข้อง:** `docs/adr/ADR-0001-backend-platform.md` (Supabase), `docs/adr/ADR-0002-payment.md` (COD), `docs/06-data-model.md`, `docs/07-api-contract.md`, epic CUS-TRACK / ADM-FULFILMENT
- **โค้ดที่มีอยู่:** `components/order/ParcelTrackingView.tsx`, `data/fulfillment.ts` (`OrderStatus`, `PARCEL_STAGES`), `lib/flash.ts` (state mapping), `store/mode.ts` (`FLASH_FEE`)

## Context

โหมด `online` ถูกนิยามใหม่เป็น **การจัดส่งพัสดุทั่วประเทศผ่าน Flash Express** (ดู [[oofoo-product-decisions]] / fulfilment model change). ตอนนี้ฝั่ง frontend เตรียม slot ไว้แล้ว:
หน้า `ParcelTrackingView` มี timeline 5 ขั้น, เลขพัสดุ, ปุ่ม "ติดตามบน Flash" — แต่สถานะทั้งหมดยัง **mock** (demo timer ใน `app/order/[id].tsx`) และเลขพัสดุยัง **ปั้นเอง** (`trackingNoFor()` สร้าง `TH...A` ปลอม)

ต้องตัดสินใจว่าจะดึงสถานะจริงด้วยวิธีไหน เพื่อให้ backend phase ต่อได้ถูกทาง

## Decision (Accepted)

**A) ต่อ Flash Express Open API โดยตรง** (`https://open-docs.flashexpress.com/`) เพราะ v1 ส่ง **Flash เจ้าเดียว** ตามสโคปที่ล็อกไว้

เหตุผล:
- **ฟรี** (ไม่มีค่า subscription รายเดือนแบบ aggregator) — เราเป็น merchant ที่ส่งผ่าน Flash เองอยู่แล้ว
- **สร้างเลขพัสดุได้ในตัว** (`POST /open/v3/orders` คืน `pno`) → เลิกปั้นเลขปลอม
- ได้ **ค่าส่งจริง** (`estimate_rate`), **ใบปะหน้า PDF** (`pre_print`), **COD ในตัว** (`codEnabled` — ตรงกับ ADR-0002)
- มี **webhook** ผลักสถานะแบบ near-realtime

### Options considered
- **A) Flash Open API ตรง — ✅ เลือก** คุ้มสุดเมื่อส่งเจ้าเดียว, ครบทั้ง create+track+label+COD
- B) AfterShip (aggregator) — ต่อง่าย normalize หลายขนส่ง + webhook+HMAC พร้อม แต่จ่ายรายเดือน + dependency บุคคลที่สาม → **เก็บเป็น fallback** เมื่อขยายหลายขนส่งในอนาคต (ไม่ใช่ v1)
- C) TrackingMore / Track123 — คล้าย B, ตัดด้วยเหตุผลเดียวกัน

## Integration design

**ตำแหน่งของ key — สำคัญที่สุด:** ทุก request ต้องเซ็น `sign = SHA256(เรียงพารามิเตอร์ ASCII + "&key=API_KEY").toUpperCase()` พร้อม `mchId` + `nonceStr`
→ **API key + การเซ็นต้องอยู่ฝั่ง server เท่านั้น** (Supabase Edge Function) — customer app **ห้าม**เรียก Flash ตรง (จะรั่ว key)

**Environments:** prod `open-api.flashexpress.com` / training `open-api-tra.flashexpress.com`
**หน่วย:** น้ำหนัก = กรัม, เงิน = สตางค์ (1 บาท = 100)

### Lifecycle (แทน demo timer ปัจจุบัน)
1. ลูกค้าจ่ายเงิน → ออเดอร์เข้า DB, status ภายใน = `preparing`
2. แอดมินแพ็คเสร็จ → Edge Function ยิง `POST /open/v3/orders` → เก็บ `pno` ลงออเดอร์ (`courier='Flash Express'`, `trackingNo=pno`)
3. ลงทะเบียน webhook ครั้งเดียว `POST /open/v1/setting/web_hook_service` (`webhookApiCode` 0=status, 4=routes)
4. Flash → webhook → Edge Function → อัปเดต `order.status` → **Supabase Realtime** push เข้า `ParcelTrackingView`
5. ลูกค้าเปิดดู timeline ละเอียดผ่าน `POST /open/v1/orders/{pno}/routes`

### Status mapping (Flash code → `OrderStatus`) — implement ใน `lib/flash.ts`

| Flash `state` | ความหมาย | `OrderStatus` | PARCEL_STAGES |
|---|---|---|---|
| (ก่อน pickup) | ร้านแพ็ค | `preparing` | 0 |
| 1 | Picked Up | `picked_up` | 1 |
| 2 | In Transit | `in_transit` | 2 |
| 3 | On Delivery | `out_for_delivery` | 3 |
| 5 | Delivered | `delivered` | 4 |
| 4 Detained / 6 Problematic | มีปัญหา/นำจ่ายไม่สำเร็จ | `delivery_failed` | (exception) |
| 7 Returned | ตีกลับ | `returned` | (exception) |
| 8 Closed / 9 Cancelled | ปิด/ยกเลิก | `cancelled` | (exception) |

## Consequences

- **`OrderStatus` ขยายจาก 3 → 8 ค่า** (เพิ่ม `picked_up`, `in_transit`, `delivery_failed`, `returned`, `cancelled`) — UI tracking ต้องรองรับ state ผิดปกติ (ทำแล้วฝั่ง frontend: hero เตือน + timeline node สีแดง + footer ติดต่อร้าน)
- **Webhook signature อ่อน** (เซ็นจาก `mchId`+`nonceStr` เท่านั้น ไม่รวม payload) → Edge Function ต้อง **เรียก `routes` กลับไปยืนยัน** ก่อนเชื่อสถานะจาก webhook (กัน spoof)
- ต้องเก็บ credential (`mchId`, API key) เป็น secret ใน Supabase — เพิ่ม config ต่อ env (training/prod)
- data model: ออเดอร์ parcel ต้องเก็บ `pno`, `weight` (กรัม), `expressCategory` (สินค้าสด = `5=Fruit`), `articleCategory`, sender warehouse — groom เป็น stories ฝั่ง ADM-FULFILMENT
- `store/mode.ts` `FLASH_FEE=40` เป็น placeholder → ภายหลังแทนด้วย `estimate_rate` จริง
- ภาษีความเสี่ยง: ผูกกับ Flash เจ้าเดียว ถ้าจะเพิ่มขนส่งอื่นต้องต่อ API แยกทีละเจ้า (หรือสลับไป AfterShip ตาม Option B)

## Follow-ups (groom เป็น stories ตอน backend phase)

- Edge Function: `createFlashOrder`, `flashWebhookHandler` (verify + re-confirm via `routes`), `flashEstimateRate`
- ADM: ปุ่ม "สร้างพัสดุ Flash" + พิมพ์ใบปะหน้า (`pre_print` PDF) + ยกเลิก (`cancel`)
- CUS: realtime push เข้า tracking, แจ้งเตือนเมื่อ `out_for_delivery` / `delivery_failed`
- COD ผ่าน Flash (`codEnabled`) — เชื่อมกับ reconciliation ตาม ADR-0002
- ค่าส่งจริงจาก `estimate_rate` แทน flat 40 บาท
