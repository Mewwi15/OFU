# อู้ฟู่ (Oofoo) — Engineering Docs

เอกสารวิศวกรรมของโปรเจกต์ อู้ฟู่ จัดทำตามกระบวนการ **SDLC เต็มรูปแบบ** (Requirements → Design → Implementation → Testing → Release)

## สถานะปัจจุบัน
- **Phase:** 2 — Design ✅ เสร็จ · 1 — Requirements ✅ (193 stories) → ถัดไป 3 — Implementation
- **Target:** Real product, **ร้านเดียว (อู้ฟู่)**, 3 surfaces = แอปลูกค้า (Expo iOS/Android) + เว็บแอดมิน + แอปไรเดอร์
- **Auth:** เบอร์+OTP และ LINE/Apple/Google · **Payment v1:** PromptPay+สลิป (pickup + delivery) **และ COD (delivery)** — ADR-0002 ✅
- **Backend:** ✅ Supabase (launch) → NestJS-on-Postgres (scale-to) — ADR-0001 · **Testing:** Jest + RNTL + Maestro

## วิธีทำงาน (Definition of "เสร็จ")
ทุก feature ต้อง **traceable**: User Story → Design/ADR → Code (PR) → Test → Acceptance Criteria ผ่าน
เรายึดหลัก **shift-left**: คุณภาพ / accessibility / security / testing ถูกออกแบบเข้ามาตั้งแต่ต้นทาง ไม่ใช่แปะตอนท้าย

## แผนผังเอกสาร
| ไฟล์ | เฟส | สถานะ |
|------|-----|-------|
| `00-current-state-assessment.md` | 0 | ✅ (จากรายงานรีวิวโค้ด) |
| `01-vision-and-scope.md` | 1 | 🟡 ร่างแรก |
| `02-personas.md` | 1 | 🟡 ร่างแรก |
| `03-functional-requirements.md` (19 epics, 149 stories) | 1 | ✅ |
| `03b-functional-requirements-grooming.md` (44 connective + COD) | 1 | ✅ |
| `04-non-functional-requirements.md` | 1 | ✅ |
| `OPEN-QUESTIONS.md` (คำถามค้าง + consistency critique) | 1 | 🟡 living doc |
| `adr/ADR-0001-backend-platform.md` + `backend-comparison.md` | 2 | ✅ Accepted (Supabase → NestJS) |
| `adr/ADR-0002-payment.md` | 2 | ✅ Accepted (delivery = prepay หรือ COD) |
| `adr/ADR-0003-parcel-tracking-integration.md` | 2 | ✅ Accepted (online = Flash Open API ตรง) |
| `06-data-model.md` (Postgres schema 39 ตาราง + RLS + RPC + Realtime) | 2 | ✅ FINAL (รวมรีวิว 3 มุม) |
| `07-api-contract.md` (RPC/PostgREST/Realtime/Storage/Edge Fn + error model) | 2 | ✅ FINAL |
| `05-architecture.md` (3 surfaces, auth, realtime, cross-cutting) | 2 | ✅ FINAL |
| `08-design-system.md` + `theme/tokens.ts` (token เดียว, AA-verified) | 2 | ✅ implemented · 🔥 **warm coral rebrand** |
| `10-ui-direction.md` (study: Oroshi reference) | 2 | ✅ study + roadmap |
| `09-test-plan.md` | 4 | ⬜ |
| `11-backend-build-plan.md` (implementation plan: seam + slices, auth-first) | 3 | 🟡 Draft — Phase 3 kickoff |

## หมายเหตุ
รายงานรีวิวโค้ดล่าสุด (ดู memory / สรุปในแชต) ทำหน้าที่เป็น **baseline ของฐานปัจจุบัน** — หนี้ทางเทคนิคที่ต้องสะสางระหว่างทาง (พาเลตต์ซ้อน, hook ซ้ำ, โค้ด template ตาย, a11y/contrast)
