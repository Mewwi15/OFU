# 10 — UI Direction (study: "Oroshi" sushi-delivery reference)

> ที่มา: ผู้ใช้ส่ง reference UI ที่ถูกใจ (Oroshi — modern food-delivery, Figma+Mobbin, 14 จอ) ให้ศึกษา
> เอกสารนี้ถอด **design language** จาก reference แล้ว map เข้ากับอู้ฟู่ (โค้ดจริง + `08-design-system.md`/`theme/tokens.ts`)
> สถานะ: study + proposal — รอเคาะ "ทิศทางสี/ความอุ่น" ก่อน implement

## 1. Design DNA ที่ถอดได้ (ทำไมมันดูดี)
1. **Canvas อุ่น พาสเทล** — พื้นหลังพีช/ชมพูอ่อน (ไม่ใช่เทาเย็น) + การ์ดขาวลอยบนพื้น → อบอุ่น เชิญชวน
2. **โค้งเยอะ + เงานุ่มใหญ่** — การ์ด radius ~20-24, ปุ่ม pill เต็ม, เงา diffuse นุ่ม → ลอย เบา พรีเมียม
3. **CTA เด่นชัด** — ปุ่ม pill เต็มกว้าง สีแบรนด์ทึบ ตัวอักษรขาว ตัวใหญ่ ("Place Order", "Continue", "Go to Orders")
4. **3D illustration เล่นๆ** — อาหาร/ไรเดอร์ 3D render → สนุก จับต้องได้ (จุดที่ทำให้ "แพง")
5. **Bottom nav มี label + สี active** — icon + คำ + เส้น indicator บน (ของเราตอนนี้ icon ล้วน ไม่มี label)
6. **Quick-add ปุ่ม + กลม** ที่มุมการ์ดสินค้า → เพิ่มลงตะกร้าเร็ว ไม่ต้องเข้าหน้า detail
7. **Header เลือกที่อยู่** — "Deliver now / 123 Tokyo Lane ▼" + กระดิ่งจุดแดง → เหมาะโหมดเดลิเวอรี่
8. **Search bar ใหญ่ pill** — icon นำ + ไมค์ท้าย
9. **Section + "See All"** — หัวข้อหนา + ลิงก์สีแบรนด์ขวา
10. **Hero detail การ์ดเหลื่อม** — รูปอาหารเต็มกว้างโค้งล่าง + การ์ดขาวเหลื่อมขึ้นมา (rating·เวลา·ราคา + tag chips + tabs)
11. **Icon tile รายการ** — สี่เหลี่ยมโค้งพื้น tint + glyph สี (notifications/orders/profile menu)
12. **Tracking stepper** — ไอคอนสถานะเชื่อมเส้น (เสร็จ=ทึบ) + bottom-sheet + ETA เด่น
13. **Promo banner gradient** — การ์ดไล่สี + "20% OFF" หนา + 3D อาหาร
14. **สถานะใช้สีสื่อความหมาย** — เขียว = สำเร็จ/ส่วนลด ("20% OFF Applied"), แบรนด์ = กำลังดำเนินการ

## 2. อู้ฟู่มีอะไรแล้ว vs ต้องปรับ (map กับโค้ดจริง)
| Pattern | อู้ฟู่ตอนนี้ | ทำอะไร |
|---------|-------------|--------|
| 2-col product card + heart + rating | ✅ `ProductCard` (มี ShopBadge + heart + rating) | เพิ่ม **ปุ่ม + quick-add** มุมล่างขวา |
| Category chips | ✅ `Chip` | ปรับให้ active เด่นขึ้น (มีแล้ว) |
| Floating bottom nav | ✅ `TabBar` (pill ลอย + indicator เลื่อน) แต่ **icon ล้วน** | เพิ่ม **label ใต้ icon** + สี active (เป็น a11y win ที่ note ไว้พอดี) |
| Search bar | ✅ `searchbar` | ทำให้ใหญ่ pill + ไมค์ (optional) |
| Quantity stepper | ✅ `QuantityStepper` | ใช้ได้เลย |
| Hero detail | ✅ `product/[id]` (carousel + price tag) | adopt **การ์ดขาวเหลื่อม** (rating·เวลา·tags) |
| Promo banner | ✅ banner carousel | adopt **gradient + % หนา + illustration** |
| Section + See All | บางส่วน | ทำ pattern หัวข้อ + See All ให้ทั่ว |
| Location header | `ScreenHeader` (title + icons) | โหมดเดลิเวอรี่ → header เลือกที่อยู่ |
| Icon-tile list | ❌ | adopt สำหรับ notifications/profile/orders |
| Canvas | เทาเย็น `#F2F3F5` | → **ตัดสินใจ: คงเทา หรือเปลี่ยนพีชอุ่น** (ดู §4) |
| Shadow | `elevation.e1-e3` (มีแล้ว) | ใช้ e2 ให้การ์ดลอยนุ่มขึ้น |
| Radius | lg 20 / xl 24 (ตรงแล้ว) | ใช้ได้เลย |

## 3. จอใหม่ที่ reference โชว์ (ยังไม่ build — มีใน requirements แล้ว)
Tracking (map + stepper + rider), Chat กับไรเดอร์, Review (ดาว + textarea), Checkout (address + payment), Delivery address (map + pin), Notifications center, Profile (stats + menu) — **reference เป็นแม่แบบที่ดีมาก** เก็บไว้ใช้ตอน build feature เหล่านี้ (ตรงกับ stories CUS-ORDERS/CUS-CHECKOUT/CUS-PROFILE/ENG-NOTIF/RID-*)

## 4. 🔑 การตัดสินใจหลัก: ทิศทางสี/ความอุ่น
**Reference เป็น "ส้ม/coral บนพีชอุ่น"** แต่อู้ฟู่เพิ่งล็อกแบรนด์ **เขียว 7-Eleven** (+ ส้มเป็น accent) บนเทาเย็น และเพิ่ง verify AA เสร็จ
นี่คือจุดที่ต้องเคาะ เพราะกระทบทุกจอ:
- **A) คงเขียว — เอาแค่ layout/ความ polish** (warm canvas optional): ได้ความ "Oroshi" ทั้งโครงสร้าง แต่สีแบรนด์ยังเขียว
- **B) กลับไปอุ่น (ส้ม/coral เป็น primary)** ให้เหมือน reference: ต้องรื้อ token (ส้มเป็น primary, ปรับ AA ใหม่) — อู้ฟู่เดิมก่อน migration ก็เป็น coral
- **C) ไฮบริด**: เขียวเป็น brand/CTA + **canvas อุ่น (ครีม/พีช) + accent ส้ม** ให้ได้ feel อุ่นแต่คงเอกลักษณ์เขียว

*ทุก token ที่เราวางรองรับการสลับได้ (แก้ที่ `theme/tokens.ts` ที่เดียว) และ contrast verifier พร้อม re-run*

## 5. Roadmap ที่เสนอ (หลังเคาะ §4)
1. **Quick wins บน design system** (ไม่ขึ้นกับสี): bottom nav + label, ปุ่ม + quick-add บนการ์ด, การ์ดเหลื่อมใน detail, gradient promo, icon-tile list, ใช้ e2 shadow
2. **ปรับ token ตาม §4** (สี/canvas) + re-verify AA
3. **3D illustration / empty states** (asset — อาจใช้ภายหลัง)
4. ใช้ reference เป็นแม่แบบตอน build จอใหม่ (tracking/chat/review/checkout) ใน Phase 3
