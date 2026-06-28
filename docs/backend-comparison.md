# Backend Platform Comparison (สนับสนุน ADR-0001)

> ประเมินแบบถ่วงน้ำหนัก 12 เกณฑ์ อิงข้อมูลจริงปี 2026 (web research) เทียบกับโจทย์ อู้ฟู่ (193 stories, 3 surfaces, realtime, OTP+social, COD reconciliation, รองรับผู้ใช้เยอะ, PDPA)
> *หมายเหตุ: shared hosting ในรูปที่จะเช่า ถูกตัดจากการเทียบตั้งแต่ต้น เพราะสเกลแนวนอน/realtime/worker ไม่ได้ — ไม่เหมาะเป็น backend หลัก*

## Trade-off matrix

| Criterion (weight) | A) Supabase | B) Firebase | C) NestJS | D) Laravel |
|---|---|---|---|---|
| C1 Scale/concurrency (18) | 3 | 5 | 5 | 4 |
| C2 Realtime (12) | 4 | 5 | 4 | 4 |
| C3 Auth OTP+social (12) | 4 | 3 | 4 | 4 |
| C4 Dev velocity / time-to-market (12) | 4 | 4 | 3 | 4 |
| C5 Ops burden (10) | 4 | 4 | 2 | 2 |
| C6 Cost now + at-scale (10) | 4 | 2 | 4 | 4 |
| C7 Relational/transactional fit (8) | 5 | 2 | 5 | 5 |
| C8 Background jobs/workers (6) | 3 | 4 | 5 | 5 |
| C9 PDPA / SEA residency (4) | 5 | 2 | 5 | 5 |
| C10 Lock-in / exit path (4) | 4 | 2 | 5 | 5 |
| C11 Storage slips/images (2) | 5 | 4 | 5 | 4 |
| C12 Expo-RN + admin-web fit (2) | 5 | 4 | 4 | 3 |
| **Weighted total (/100)** | **78.4** | **73.2** | **82.0** | **80.0** |

ลำดับคะแนนดิบ: **NestJS (82.0) > Laravel (80.0) > Supabase (78.4) > Firebase (73.2)**

## คำแนะนำ (risk-adjusted สำหรับทีมเล็ก + ออกจริงเร็ว)
**Launch บน Supabase → วางเส้นทางสเกลไป NestJS-on-Postgres** (แม้ NestJS ชนะคะแนนดิบ 3.6 แต้ม)

เหตุผล: ช่องว่างคะแนนมาจาก C1/C8/C10 ของ NestJS ที่สูงกว่า แต่ NestJS จ่ายคืนด้วย **C4=3 (velocity) + C5=2 (ops)** ซึ่งเป็น 2 แกนที่ "ทำทีมเล็กล่ม" จริง — matrix ให้คะแนนเชิงเส้น แต่ความเสี่ยงการส่งมอบ/ความเสถียรของการสร้าง auth+realtime+storage+worker เองมัน compound. Supabase ตัดความเสี่ยงนั้นออก โดยยังได้:
1. **Postgres จริง** → logic การเงิน (ตัดสต็อกต่อขนาด, promo usage cap, COD float/settlement) ถูกต้องด้วย ACID + row lock (C7=5 vs Firebase C7=2)
2. **Auth/Realtime/Storage ในตัว** SDK เดียว (`supabase-js`) ใช้ทั้ง 3 surfaces → ออกเร็ว
3. **เข้ากับไทย:** BYO SMS (เสียบ ThaiBulkSMS/SMSMKT ราคาถูก ไม่มี markup) + region Singapore (PDPA) (C9=5)
4. **ทางออกดีสุดในกลุ่ม** — เป็น Postgres มาตรฐาน ไม่ติดกับ (C10=4)

**Firebase ไม่แนะนำ** สำหรับแอปนี้: NoSQL ไม่เหมาะข้อมูลการเงิน/relational (C7=2), คิดเงินต่อ read ไม่มี cap → ค่าใช้จ่ายบานตามจำนวนผู้ใช้ (C6=2), Auth/FCM วิ่งนอก region กระทบ PDPA (C9=2)

## เส้นทางสเกล (non-destructive — ฐานเป็น Postgres เดียวกันตลอด)
1. **Launch:** ทั้ง 3 surfaces บน Supabase; business logic เป็น SQL functions/RPC; แยก realtime (Broadcast/Presence = GPS ไรเดอร์, Postgres Changes = OrderStatus)
2. **Harden:** ย้าย COD reconciliation/cron ออกจาก pg_cron ไป external worker (NestJS/BullMQ) ชี้ DB เดิม
3. **Scale:** วาง NestJS API + realtime tier หน้า DB เดิม (strangler) เมื่อใกล้เพดาน connection
4. **Exit (ถ้าต้อง):** self-host/NestJS เต็มตัว — ย้ายข้อมูล 0 (เป็น Postgres มาตลอด)

## ความเสี่ยงหลัก + การลด
- **เพดาน connection (โจทย์ #1):** → ตั้ง Supavisor pooling, index hot tables, load-test ก่อน launch, แยก realtime ตามความ durable, ล้าง channel เมื่อ unmount
- **COD reconciliation บน pg_cron ไม่มี retry/alert:** → ทำ job ให้ idempotent + heartbeat/dead-man's-switch ภายนอก หรือรันเป็น external worker
- **LINE login ไม่ native:** → spike custom OIDC ใน staging สัปดาห์แรก
- **OTP ไทย:** เริ่มจดทะเบียน sender-ID กับ aggregator ทันที (long-lead, ต้องมีนิติบุคคล)

## ข้อเท็จจริงที่ต้องเช็กก่อนเซ็น
- เพดาน realtime connection ต่อ tier (อ้าง ~500 Pro / ~10k Team) + ราคา Team (~$599/mo)
- Supabase region Singapore ครอบ Auth/Storage/Realtime (ไม่ใช่แค่ DB) → ยืน PDPA ได้
- BYO SMS hook รองรับใน tier ที่จะใช้; ค่า ThaiBulkSMS/SMSMKT ต่อข้อความ + เงื่อนไขจดทะเบียน sender-ID
- pg_cron retry/alert ปัจจุบันบน Supabase (สำคัญต่อ COD settlement)
- Expo push (Expo Push API/FCM) limit สำหรับ OTP/slip/low-stock

*(รายงานวิจัยเต็ม + แหล่งอ้างอิงราคา 2026 อยู่ใน workflow transcript — สรุปไว้ที่นี่)*
