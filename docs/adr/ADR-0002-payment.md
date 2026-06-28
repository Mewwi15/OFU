# ADR-0002 — Payment Method & Delivery Payment Timing

- **สถานะ:** ✅ Accepted (2026-06-27) — **เลือก B) ทั้งคู่ (prepay หรือ COD)**
- **วันที่:** 2026-06-27
- **เกี่ยวข้อง:** `docs/OPEN-QUESTIONS.md`, ทุก epic ฝั่ง CUS-CHECKOUT/CUS-MODE/ADM-PAYMENT/RID-*

## Context
v1 ล็อกไว้ว่า payment = **PromptPay QR + แนบสลิป (แอดมินตรวจมือ)** แต่ consistency critic พบว่าโค้ดปัจจุบัน
(`app/(tabs)/cart.tsx`: `PAYMENT_HINT.delivery = 'ชำระปลายทาง หรือโอนเมื่อรับของ'`, CTA `'สั่งซื้อ & จัดส่ง'`)
ได้ implement **pay-on-receipt (COD)** สำหรับโหมดเดลิเวอรี่ไปแล้ว — ขัดกับ decision ที่ล็อก ทำให้ delivery happy path
ไม่สมบูรณ์ และค้างทั้ง flow ไรเดอร์/แอดมินตรวจเงิน

โหมด **pickup จ่ายก่อน (PromptPay+สลิป) ชัดเจน ไม่มีปัญหา** — ค้างเฉพาะ **โหมดเดลิเวอรี่**

## Decision (Accepted)
**B) โหมดเดลิเวอรี่ — ลูกค้าเลือกได้ทั้ง prepay (PromptPay+สลิป) และ COD (เก็บปลายทาง) ตอน checkout**
โหมด pickup = จ่ายก่อน (PromptPay+สลิป) เสมอ

→ `PaymentMethod` ของ v1 = `promptpay_slip` | `cod`

### Options considered
- A) จ่ายก่อนทั้งคู่ — ง่ายสุด ไม่มีเงินสด แต่ไม่ตรงนิสัยคนไทย
- **B) ทั้งคู่ (เลือกได้) — ✅ เลือก** Thai-friendly สุด
- C) COD อย่างเดียวสำหรับเดลิเวอรี่ — ตรงโค้ดเดิม แต่ผูก cash handling ทั้งหมด

## Dependencies / Consequences
- ถ้า B/C: ต้องเลื่อน `cod` จาก future → v1 (PaymentMethod), เปิด RID cash-collection stories, refund/float/settlement
- ถ้า A: customer ทุกออเดอร์ต้องถึง `paid` ก่อน `confirmed`/`assigned_to_rider`; แก้โค้ด cart ให้เลิก pay-on-receipt
- payment gateway จริง (Omise/2C2P/GB Prime) ยัง defer (ยืนยันว่านอก v1) — ถ้าเอาเข้าจะดึง PCI-DSS + tokenization เข้ามา
- refund แบบไม่มี gateway = โอน PromptPay มือ → ต้องนิยาม lifecycle (owed → sent → confirmed) + แจ้งลูกค้า

## Follow-ups ที่เปิดจาก decision นี้ (จะ groom เป็น stories)
- COD order lifecycle: ข้าม `awaiting_payment` → `confirmed` ได้เลย, เก็บเงิน (`paid`) ตอน `delivered`
- Checkout: ตัวเลือก prepay/COD (เฉพาะเดลิเวอรี่); แสดง QR+อัปสลิป เมื่อเลือก prepay
- ไรเดอร์: เก็บเงินสด, ยืนยันรับเงิน, float ต่อรอบ, settlement/รีคอนซายล์กับร้าน
- Refund lifecycle (owed → sent → confirmed) สำหรับทั้ง prepay และ COD (โอน PromptPay มือ — ยังไม่มี gateway)
- ยังเปิด (defer ยืนยันนอก v1): payment gateway จริง (Omise/2C2P/GB Prime)
