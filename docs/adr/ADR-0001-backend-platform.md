# ADR-0001 — Backend Platform & Hosting

- **สถานะ:** ✅ Accepted (2026-06-27) — **Supabase (launch) → NestJS-on-Postgres (scale-to)** · ดู `../backend-comparison.md`
- **วันที่:** 2026-06-27
- **ผู้ตัดสินใจ:** Product Owner + Engineering
- **เกี่ยวข้อง:** ADR-0002 (Payment — ยังไม่เปิด), `docs/01-vision-and-scope.md`, `docs/04-non-functional-requirements.md`

## Context & Problem
อู้ฟู่ v1 เป็น real product ร้านเดียว มี 3 surfaces (แอปลูกค้า Expo, เว็บแอดมิน, แอปไรเดอร์)
Product Owner ระบุ requirement สำคัญ: **ต้องรองรับผู้ใช้หลายคนพร้อมกัน (concurrent multi-user, scalable & reliable)**

### Decision drivers
1. **Scalability / concurrency** — รองรับผู้ใช้เยอะพร้อมกัน (driver หลัก)
2. **Real-time** — สถานะออเดอร์อัปเดตสด + ตำแหน่ง/สถานะไรเดอร์
3. **Auth** — phone OTP + LINE/Apple/Google
4. **Storage** — สลิปโอนเงิน + รูปสินค้า
5. **Background work** — ส่ง OTP/push, ตรวจ/แจ้งเตือน, งานตามเวลา
6. **PDPA / ไทย** — ที่ตั้งข้อมูล, สิทธิเจ้าของข้อมูล
7. **Time-to-market + ทีมเล็ก** — ออกเร็ว ดูแลไหว
8. **Lock-in / exit path** — ย้ายได้ ไม่ผูกขาด

## Options

### A) Supabase (BaaS บน managed Postgres) — ✅ แนะนำ
- **+** Postgres + pooling (Supavisor) สเกล concurrent ได้; Realtime, Auth (OTP/Apple/Google), Storage, Edge Functions ครบในตัว; RLS เข้ากับ PDPA; รีเจียน Singapore; exit ง่าย (Postgres มาตรฐาน)
- **−** LINE login ต้องตั้ง custom OIDC; logic ซับซ้อนมากต้องพึ่ง Edge Functions/บริการเสริม; cost โตตามการใช้งาน
- **เหมาะเมื่อ:** อยากออกเร็ว + ได้ auth/realtime/storage ฟรีจากแพลตฟอร์ม + สเกลได้จริง

### B) Custom backend (NestJS หรือ Laravel) บน PaaS ที่ autoscale + managed Postgres
- **+** คุม 100%, worker/WebSocket เต็มที่, สเกลแนวนอน (stateless API + LB), เลือกคอมโพเนนต์เอง (Redis, S3/R2, Pusher)
- **−** ต้องสร้าง auth/realtime เอง, ops เยอะกว่า, time-to-market ช้ากว่า
- **เหมาะเมื่อ:** ต้องการ logic ฝั่ง server หนัก/ควบคุมเต็มที่

### C) Shared cPanel/LiteSpeed hosting + Laravel — ❌ ไม่แนะนำเป็น backend หลัก
- **+** ถูก, คุ้น PHP, MySQL/Redis/SSL/backup ครบ
- **−** **สเกลแนวนอนไม่ได้** (ขัด driver #1), ไม่มี WebSocket, worker ได้แค่ cron, Node ไม่สะดวก, ทรัพยากรแชร์
- **เหมาะเมื่อ:** เว็บไซต์แนะนำร้าน/marketing เท่านั้น — ไม่ใช่ backend ของแอป real-time

## Decision (Proposed)
เลือก **Option A — Supabase** เป็นแพลตฟอร์ม backend หลักของ v1 เพราะตอบ driver #1–4, 6–8 ได้ดีที่สุดด้วย ops ต่ำ
และมี exit path ชัด หาก logic บางส่วนซับซ้อนเกิน Edge Functions ค่อยเสริม service เฉพาะทาง (hybrid กับ Option B ได้)
- เว็บแอดมิน: React/Next.js SPA คุยกับ Supabase (โฮสต์ Vercel/Netlify)
- **ไม่ต้องเช่า shared hosting ในรูป** (จะเสียเงินเปล่า) — เก็บไว้พิจารณาเฉพาะกรณีอยากได้เว็บ marketing แยก

**อัปเดต (weighted comparison):** raw matrix = NestJS 82 > Laravel 80 > Supabase 78.4 > Firebase 73.2 แต่ risk-adjusted สำหรับทีมเล็ก/ออกจริงเร็ว → **Supabase เป็น launch platform โดยมี NestJS-on-Postgres เป็น scale-to target ที่ตั้งใจไว้** (ย้ายข้อมูล 0 เพราะ Postgres เดียวกัน) ดูรายละเอียด + risks/mitigations ใน `../backend-comparison.md`

## Consequences
- ต้องตั้ง: Supabase project (รีเจียน Singapore), schema + RLS, Auth providers, Storage buckets, Edge Functions, Expo push
- ผูกกับ Supabase API/SDK ในระดับหนึ่ง (ลดด้วยการแยก data-access layer ในแอป)
- ต้องเฝ้า cost เมื่อ usage โต + วาง observability (logs/metrics)
- **ขึ้นกับ ADR-0002 (Payment):** ถ้าใช้ payment gateway จริง อาจต้องมี webhook handler (Edge Function) เพิ่ม

## ❓ ต้องยืนยัน/ตัดสินต่อ
- ยืนยันเลือก A (Supabase) หรือ B (custom) ?
- LINE Login (สมัคร channel ในนามนิติบุคคล) — ทำใน v1 ไหม
- ที่ตั้งข้อมูล/PDPA: รับรีเจียน Singapore ได้ไหม
- ADR-0002 Payment (gateway/COD/เดลิเวอรี่จ่ายเมื่อไหร่) — ค้างอยู่
