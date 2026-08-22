# ยื่น OFU ขึ้น App Store — คู่มือทีละขั้น

ค่าประจำแอป: bundle `com.oofoo.shop` · ชื่อ OFU (อู้ฟู่) · Privacy `https://ofu-ivory.vercel.app/privacy`
Screenshots: `~/Desktop/ofu-screenshots-ios/` (1290×2796) · .ipa: build บน expo.dev

---

## ขั้น 0 — อัป build เข้า App Store Connect (เลือกทางเดียว)

**ทาง A (ง่ายสุด) — eas submit:**
```
cd ~/dev/my-rn-app
eas submit -p ios --profile production
```
- เลือก "Select a build from EAS" → เลือก build ล่าสุด
- ถาม Apple ID/App-specific password → ใส่
- มันจะอัป .ipa เข้า App Store Connect ให้เอง (ใช้เวลา 5-10 นาที + Apple ประมวลผล build อีก ~15 นาที)

**ทาง B — แอป Transporter (Mac App Store, ฟรี):**
ดาวน์โหลด .ipa → เปิด Transporter → ลากไฟล์เข้า → Deliver

---

## ขั้น 1 — สร้างแอปใน App Store Connect
appstoreconnect.apple.com → **My Apps → + → New App**
- Platform: iOS · Name: **OFU** (ถ้าซ้ำ ลอง"OFU อู้ฟู่") · Language: Thai
- Bundle ID: **com.oofoo.shop** · SKU: `ofu-shop` (อะไรก็ได้)
- (ถ้าเคยสร้างตอนทำ App ID แล้ว ข้ามได้)

---

## ขั้น 2 — กรอกข้อมูลเวอร์ชัน (แท็บซ้าย "1.0 Prepare for Submission")

**Screenshots** (บังคับ): อัป 6.7" iPhone จาก `~/Desktop/ofu-screenshots-ios/` (3-10 รูป)
**Description:** ก็อปจาก `docs/store-listing-android.md` (คำอธิบายเต็ม) มาปรับได้
**Keywords:** ร้านชำ,ของสด,สั่งของ,ส่งถึงบ้าน,อู้ฟู่,delivery (คั่นด้วย , รวม ≤100 ตัว)
**Promotional Text / Subtitle:** "ของสดของดี ส่งถึงบ้าน"
**Support URL:** ใส่ ofu-ivory.vercel.app/privacy ไปก่อนได้ (หรือหน้าเว็บร้าน)
**Privacy Policy URL:** `https://ofu-ivory.vercel.app/privacy`
**Category:** Shopping

---

## ขั้น 3 — เลือก Build
ในหน้าเวอร์ชัน เลื่อนหา **Build → +** → เลือก build ที่อัปในขั้น 0 (รอ Apple ประมวลผลเสร็จก่อนถึงจะขึ้นให้เลือก)

---

## ขั้น 4 — App Privacy (แท็บ App Privacy)
กด Edit → ตอบว่าเก็บข้อมูลอะไร (ให้ตรงกับ Data Safety ที่ทำไว้):
- **Contact Info:** Name, Email, Phone → เก็บ · ผูกตัวตน · เพื่อ App Functionality
- **Location:** Precise + Coarse → App Functionality (ปักหมุดที่อยู่) — **ไม่ใช่ Tracking**
- **User Content:** Photos (สลิป/โปรไฟล์) · Other (แชต) → App Functionality
- **Identifiers:** Device ID (push) → App Functionality
- **Purchases:** Purchase History → App Functionality
- **ไม่ใช้ tracking, ไม่ขายข้อมูล, ไม่มีโฆษณา**

---

## ขั้น 5 — Age Rating
แท็บ Age Rating → Edit → ตอบ No ทุกข้อ (ร้านค้าทั่วไป ไม่มีเนื้อหาโต) → ได้เรต 4+

---

## ขั้น 6 — App Review Information (สำคัญ! ไม่งั้นโดนตีกลับ)
เลื่อนล่างสุดหน้าเวอร์ชัน:
- **Sign-In required: Yes** → ใส่ **บัญชีทดสอบให้ Apple**:
  - Email: `p.ongsakornx15@gmail.com` · Password: `Ofu12345` · (Note: หลัง login มี PIN = **111111**)
- **Notes:** เขียนสั้น ๆ ว่า "Grocery delivery app for a single shop. Physical goods only (no digital IAP). Payment = PromptPay QR + manual slip verification by staff. PIN after login = 111111."
- Contact: ชื่อ + เบอร์ + อีเมลคุณ

---

## ขั้น 7 — Submit
กด **Add for Review → Submit for Review** → รอ Apple รีวิว (ปกติ 24-48 ชม.)

---

## ⚠️ กับดักรีวิว Apple ที่แอปนี้ต้องมี (มีแล้ว ✅)
- **Sign in with Apple** (guideline 4.8 — บังคับเมื่อมี Google login) → ✅ มีปุ่ม Apple บน iOS
- **ลบบัญชีได้** (5.1.1(v)) → ✅ มีหน้า delete-account
- **บัญชีทดสอบ** ให้ reviewer → ใส่ในขั้น 6
- **ขายของจริง (physical)** → ไม่ต้องใช้ In-App Purchase (จ่ายนอกแอปได้)
