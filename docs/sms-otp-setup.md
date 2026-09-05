# เปิดใช้ล็อกอินด้วยเบอร์ + OTP ทาง SMS

โค้ดพร้อมหมดแล้วทั้งฝั่งแอปและฝั่งเซิร์ฟเวอร์ เหลือแค่ต่อกับผู้ให้บริการ SMS
ทำตามนี้เสร็จภายในวันเดียวได้ **ไม่ต้องรอจดชื่อผู้ส่ง**

ระหว่างที่ยังไม่ต่อ ทดสอบในเครื่องได้ฟรีด้วยเบอร์ทดสอบ **`0812345678` → รหัส `123456`**
(ไม่มี SMS ส่งออกจริง)

---

## ขั้นที่ 1 — สมัครผู้ให้บริการ SMS ไทย

เจ้าที่คนไทยใช้กันเยอะ: **Thaibulk SMS**, **SMSMKT**, **ANTS**, **MoveMe**

ตอนสมัครถามให้ครบ 3 ข้อ:

1. **มีชื่อผู้ส่งกลางให้ใช้เลยไหม** (จะได้เริ่มก่อนโดยไม่ต้องรออนุมัติชื่อ `OOFOO`)
2. ราคาต่อข้อความ ของชื่อกลาง เทียบกับชื่อที่จดเอง
3. ส่ง OTP ถึงครบทุกค่ายไหม (AIS / True / NT)

เติมเงินแล้วเก็บของพวกนี้ไว้ — เอาไปใช้ขั้นที่ 3:

- URL ของ API ที่ใช้ส่ง (endpoint)
- กุญแจ/รหัสผ่าน (API key, บางเจ้ามี secret คู่กัน)
- ชื่อผู้ส่งที่ใช้ได้ (ชื่อกลางของเจ้านั้น)
- **หน้าคู่มือ API ของเจ้านั้น** — ต้องดูว่าเขาเรียกช่องต่าง ๆ ว่าอะไร

---

## ขั้นที่ 2 — สร้างรหัสลับของฮุค

Supabase Dashboard → **Authentication → Hooks** → **Send SMS hook**
กด generate secret จะได้ค่าหน้าตาแบบ `v1,whsec_xxxxxxxx` — คัดลอกเก็บไว้

---

## ค่าสำหรับ SMS KUB (ที่สมัครไว้แล้ว)

อ่านจากคู่มือ API ของเขาแล้ว — ใช้ชุดนี้ได้เลย ไม่ต้องเดา

```bash
npx supabase secrets set \
  SEND_SMS_HOOK_SECRET='v1,whsec_...' \
  SMS_API_URL='https://console.sms-kub.com/api/messages' \
  SMS_AUTH='header:key:<API Key ที่สร้างในหน้า SMS API>' \
  SMS_CONTENT_TYPE='json' \
  SMS_SENDER='<ชื่อผู้ส่งที่ใช้ได้>' \
  SMS_BODY='{"to":["{phone_local}"],"from":"{sender}","message":"{message}"}'
```

หมายเหตุของเจ้านี้:

- กุญแจส่งทาง **หัวข้อชื่อ `key`** ไม่ใช่ `Authorization`
- ช่อง `to` เป็น **อาร์เรย์** และใช้เบอร์แบบในประเทศ `08…` (จึงใช้ `{phone_local}`)
- ดูชื่อผู้ส่งที่ใช้ได้จริงของบัญชีตัวเอง:

```bash
curl -s 'https://console.sms-kub.com/api/senders/usable' -H 'key: <API Key>'
```

  เลือกอันที่ `type` เป็น **OTP** ถ้ามี — SMS ประเภท OTP ส่งได้ตลอดเวลาและถึงเร็วกว่า
  ประเภทการตลาด

- เช็กเครดิตคงเหลือ: `curl -s 'https://console.sms-kub.com/api/transactions/balance' -H 'key: <API Key>'`

---

## ขั้นที่ 3 — ตั้งค่าให้ตรงกับผู้ให้บริการ (เจ้าอื่น)

**ไม่ต้องแก้โค้ด** ทุกอย่างมาจากค่าที่ตั้งไว้ตรงนี้

รันในโฟลเดอร์โปรเจกต์ (แทนค่าของจริงลงไป):

```bash
npx supabase secrets set \
  SEND_SMS_HOOK_SECRET='v1,whsec_...' \
  SMS_API_URL='https://api.ผู้ให้บริการ/send' \
  SMS_SENDER='ชื่อผู้ส่งที่เขาให้มา' \
  SMS_AUTH='bearer:กุญแจของคุณ' \
  SMS_CONTENT_TYPE='json' \
  SMS_BODY='{"sender":"{sender}","msisdn":"{phone}","message":"{message}"}'
```

### `SMS_AUTH` — เลือกให้ตรงกับที่คู่มือเขาบอก

| คู่มือเขาเขียนว่า | ใส่แบบนี้ |
|---|---|
| `Authorization: Bearer <token>` | `bearer:<token>` |
| ใช้ api key + secret (Basic auth) | `basic:<key>:<secret>` |
| หัวข้อของตัวเอง เช่น `api-key: xxx` | `header:api-key:xxx` |
| ไม่ต้องยืนยันตัวตน (กุญแจอยู่ในเนื้อคำขอ) | `none` |

### `SMS_BODY` — เนื้อคำขอ ใส่ตัวแปรได้

| ตัวแปร | ได้ค่าอะไร |
|---|---|
| `{phone}` | `66812345678` (รูปแบบสากล) |
| `{phone_local}` | `0812345678` (รูปแบบในประเทศ — บางเจ้าใช้แบบนี้) |
| `{message}` | ข้อความ OTP ภาษาไทยเต็มประโยค |
| `{sender}` | ค่าจาก `SMS_SENDER` |
| `{otp}` | เลข 6 หลักล้วน ๆ (เผื่อเจ้าไหนมีช่องแยก) |

**ชื่อช่อง (`sender` / `msisdn` / `message`) ต้องเปลี่ยนให้ตรงกับคู่มือของเจ้านั้น** —
แต่ละเจ้าเรียกไม่เหมือนกัน (บางเจ้าใช้ `to`, `phone`, `text`, `body`)

ถ้าคู่มือเขาเป็นแบบฟอร์ม (`application/x-www-form-urlencoded`) ให้ตั้ง:

```bash
SMS_CONTENT_TYPE='form'
SMS_BODY='sender={sender}&msisdn={phone_local}&message={message}'
```

---

## ขั้นที่ 4 — อัปโหลดฟังก์ชัน

```bash
npx supabase functions deploy send-sms-hook
```

---

## ขั้นที่ 5 — เปิดใช้งาน

Dashboard → **Authentication**:

1. **Providers → Phone** → เปิด · ถ้ามีช่อง Twilio ให้ปิด/เว้นว่าง (ฮุคทำงานแทน)
2. **Hooks → Send SMS hook** → เปิด
   - URI: `https://ejohcdbzvscgakpvgytj.supabase.co/functions/v1/send-sms-hook`
   - Secret: ค่าที่ generate ไว้ในขั้นที่ 2

---

## ขั้นที่ 6 — ทดสอบด้วยเบอร์จริง

ยิงคำขอตรง ๆ ก่อนเข้าแอป จะได้รู้ว่าพังตรงไหน:

```bash
curl -X POST 'https://ejohcdbzvscgakpvgytj.supabase.co/auth/v1/otp' \
  -H 'apikey: <anon key>' -H 'Content-Type: application/json' \
  -d '{"phone":"66xxxxxxxxx"}'
```

- ได้ SMS → เรียบร้อย ไปเปิดแอปล็อกอินด้วยเบอร์ได้เลย
- ไม่ได้ SMS → ดูบันทึกที่ Dashboard → **Edge Functions → send-sms-hook → Logs**
  ฟังก์ชันบันทึกคำตอบของผู้ให้บริการไว้ทุกครั้ง จะเห็นเลยว่าช่องไหนผิด
  (แก้ `SMS_BODY` แล้วรัน `secrets set` ใหม่ ไม่ต้อง deploy ซ้ำ)

---

## ขั้นที่ 7 — ส่งขึ้นแอปจริง

หน้าล็อกอินที่มีปุ่ม "เบอร์โทร" **ยังไม่ได้ push** ตั้งใจไว้แบบนั้น — ถ้าส่งขึ้นก่อนที่ SMS
จะใช้ได้ ลูกค้าจะกดแล้วไม่มีอะไรมาถึง

พอขั้นที่ 6 ผ่านแล้วค่อย push (บอกผมได้ ผมจัดการให้)

---

## หลังจากนั้น

- **จดชื่อผู้ส่ง `OOFOO` คู่ขนานไป** พออนุมัติแล้วแค่เปลี่ยนค่า `SMS_SENDER` แล้ว
  `secrets set` ใหม่ ไม่ต้องแก้โค้ด ไม่ต้อง deploy
- **คุมค่าใช้จ่าย**: แอปบังคับรอ 60 วินาทีก่อนขอรหัสซ้ำ และ Supabase มีเพดานต่อชั่วโมง
  ของตัวเองอีกชั้น (`[auth.sms] max_frequency` ใน `supabase/config.toml`)
- เบอร์ที่ลูกค้าใช้ล็อกอิน = เบอร์เดียวกับที่หน้าร้านใช้ค้นสมาชิกสะสมแต้ม (0102)
  สมัครในแอปแล้วแคชเชียร์ค้นเจอทันที ไม่ต้องลงทะเบียนซ้ำ

---

## ทดสอบในเครื่องโดยไม่เสียเงิน

`supabase/config.toml` มี `[auth.sms.test_otp]` ตั้งไว้ว่าเบอร์ `66812345678` ใช้รหัส
`123456` เสมอ — ลัดก่อนถึงฮุค จึงไม่มี SMS ออกจริง ใช้ทดสอบหน้าจอได้ไม่จำกัด
(สลับแอปไปต่อฐานข้อมูลในเครื่องด้วยการสลับบรรทัด `EXPO_PUBLIC_SUPABASE_URL` ใน
`.env.local` แล้วรีสตาร์ต Metro)
