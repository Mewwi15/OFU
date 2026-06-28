# 00 — Current-State Assessment (Baseline)

> ผลจากการรีวิวโค้ดแบบ multi-agent (6 มิติ + adversarial verification) บนฐานปัจจุบัน (branch `bna-ui-migration`)
> ใช้เป็น baseline ของหนี้ทางเทคนิคที่ต้องสะสางระหว่างพัฒนา v1 — ทุกข้อ map ไป backlog ได้

## สรุป
`tsc` + `eslint` ผ่านสะอาด ไม่มีบั๊กระดับแครช โครงสร้างแยกหน้าที่ดี แต่มี 2 ธีมหลัก: **(A) Accessibility/WCAG** จากพาเลตต์ใหม่, **(B) หนี้ migration** (ธีมซ้อน 2 ระบบ, hook ซ้ำ, โค้ด template ตาย)

## ปัญหาที่ยืนยันแล้ว (จัดลำดับ)

### 🔴 High
| ID | ปัญหา | ตำแหน่ง |
|----|------|---------|
| A11Y-1 | IconButton ไม่มี `accessibilityLabel` → ปุ่มไอคอนทุกปุ่มไม่มีชื่อต่อ screen reader | `components/ui/IconButton.tsx` |
| A11Y-2 | ข้อความเทา `#9B9B9B` ตก WCAG AA (2.5:1) ทุกที่ | `constants/theme.ts:40`, `theme/colors.ts:47` |

### 🟠 Medium
| ID | ปัญหา | ตำแหน่ง |
|----|------|---------|
| A11Y-3 | เขียว `#00A94F` เป็นราคา/ตัวอักษรบนปุ่ม ตก AA (3.09:1) | `ProductCard.tsx:80`, `button.tsx` |
| A11Y-4 | ส้ม `#F5821F` เป็นยอดรวม/pill ออนไลน์ ตก AA (2.59:1) | `cart.tsx:186`, `ModeSwitch.tsx` |
| A11Y-5 | แบนเนอร์ auto-rotate ไม่มี pause/reduced-motion (WCAG 2.2.2), 2s เร็วไป | `app/(tabs)/index.tsx:77-85` |
| A11Y-6 | ปุ่ม/pill ความสูง fix → ตัดตัวอักษรเมื่อฟอนต์ใหญ่ | `Chip.tsx`, `button.tsx` |
| A11Y-7 | ModeSwitch ขาด `accessibilityRole`/`State(selected)` | `ModeSwitch.tsx` |

### 🟡 Low (เด่น)
| ID | ปัญหา | ตำแหน่ง |
|----|------|---------|
| LOGIC-1 | โปรโมโค้ด no-op แต่แจ้ง "ใช้โค้ดแล้ว" | `cart.tsx:60-66` |
| LOGIC-2 | แบนเนอร์ timer ไม่รีเซ็ตเมื่อผู้ใช้ปัด + วิ่งต่อแม้ออกจากแท็บ | `index.tsx:77-85` |
| LOGIC-3 | cart line id ไม่รวมสี (dormant) | `store/cart.ts:43-45` |
| DEBT-1 | โค้ด template ตายทั้งกอง (ลบได้ 1 commit) | `hooks/useThemeColor.ts`, `parallax-scroll-view`, `collapsible`, `themed-*`, `icon-symbol`, `hello-wave`, `external-link`, `haptic-tab`, `useModeToggle` |
| DEBT-2 | พาเลตต์ซ้อน 2 ระบบ sync มือ | `constants/theme.ts` ↔ `theme/colors.ts` |
| DEBT-3 | hook color-scheme ขัดกัน / `Typography`+`Fonts` ตาย / คอมเมนต์ค้าง (coral/Stylo/AppText) | `hooks/`, `constants/theme.ts` |
| ROBUST-1 | `money()` ไม่กัน NaN/ติดลบ | `lib/format.ts` |

### ⚪ Expo SDK 54 (ตรวจเพิ่มเอง)
- การใช้ Expo API ถูกต้องตาม SDK 54 ทั้งหมด ✅
- deps ติดตั้งแต่ไม่ใช้: `expo-linear-gradient`, `expo-constants`, `expo-system-ui`, `expo-linking` (+ `expo-web-browser`/`expo-symbols` ผ่านโค้ดตาย) → ตัดได้
- `app.json` เปิด `reactCompiler: true` → memoize อัตโนมัติ; `userInterfaceStyle:"automatic"` ขัดกับ light-pinned ควรตั้ง `"light"`

## ตีตก (false positive)
- เขียน ref ตอน render (`index.tsx:75`) เป็น latest-value ref pattern มาตรฐาน — ไม่ใช่บั๊ก

## แผนสะสาง (เสนอลำดับ)
1. รวม a11y (High+Medium) เป็นชุดเดียว — กระทบผู้ใช้สูงสุด (โยงกับ persona ป้าสมศรี)
2. ลบโค้ด template ตาย 1 commit → ปลดล็อกการรวม hook/ธีม
3. รวมพาเลตต์เป็น source เดียว (จะทำใน Design Phase: `08-design-system.md`)
