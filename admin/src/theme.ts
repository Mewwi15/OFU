import type { ThemeConfig } from 'antd';

// อู้ฟู่ admin tokens for Ant Design — a clean white canvas, square corners,
// and a sage-green accent (buttons, links, active state). Owner requests:
// 2026-07-15 white/square redesign, then 2026-07-16 accent-color search —
// coral (rejected, "ใช้สีอื่น"), near-black monotone (rejected, "ไม่เอาสี
// ดำๆ"), deep forest green (rejected, "หนักไปหน่อย") — landed on softer
// sage green #5B8C6E, so the internal admin/POS tool reads as its own
// distinct tool, plus a soft shadow on cards. One source of truth for the
// whole admin.
// NOTE: colorPrimary (#5B8C6E, sage) is a DIFFERENT green from
// colorSuccess (#1E9E5C, brighter) — primary is brand/action, success stays
// reserved for success/discount semantics. Don't merge these.
export const oofooTheme: ThemeConfig = {
  token: {
    colorPrimary: '#5B8C6E',
    colorInfo: '#5B8C6E',
    colorSuccess: '#1E9E5C',
    colorWarning: '#E08C00',
    colorError: '#E5484D',
    colorLink: '#5B8C6E',
    borderRadius: 0,
    fontFamily: "'Mitr', system-ui, 'Noto Sans Thai', sans-serif",
    fontSize: 14,
    colorBgLayout: '#ffffff',
    colorTextBase: '#2B2320',
    colorTextSecondary: '#6E625C',
    colorBorderSecondary: '#E8E8E8',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: '#ffffff',
      headerHeight: 60,
      headerPadding: '0 20px',
    },
    Menu: {
      itemSelectedBg: '#F5F5F5',
      itemSelectedColor: '#5B8C6E',
      itemBorderRadius: 0,
      itemHeight: 40,
      iconSize: 18,
    },
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Table: { headerBg: '#FAFAFA', headerColor: '#6E625C', borderColor: '#E8E8E8', cellPaddingBlock: 12 },
    Card: { borderRadiusLG: 0 },
    Modal: { borderRadiusLG: 0 },
    Statistic: { titleFontSize: 13 },
  },
};

/* สีประจำโซนของเมนูข้าง (เจ้าของสั่ง 30 ส.ค. 2026 ให้หน้าร้าน/หลังร้านแยกสีกัน)
 *
 * อยู่ที่นี่เพราะมีสองที่ใช้แล้ว — เมนูข้าง กับการ์ดใส่รหัสเข้าหลังร้าน ถ้าต่างคน
 * ต่างฮาร์ดโค้ด เดี๋ยวเปลี่ยนสีที่หนึ่งแล้วอีกที่ไม่ตาม แล้วสีก็เลิกสื่อความหมาย
 *
 * คุมทั้งสามให้อยู่ตระกูลเดียวกัน ความอิ่มสีต่ำและน้ำหนักใกล้กัน ไม่งั้นเมนูข้าง
 * กลายเป็นป้ายไฟ ตัดกับธีมแอดมินที่เรียบ ๆ
 */
export const ZONE = {
  front: '#5B8C6E',   // เขียวเสจ — สีแบรนด์ ให้โซนที่ทำเงินอยู่ตรงหน้า
  online: '#4A7C94',  // ฟ้าอมเทา — ลูกค้าอยู่ปลายสาย
  back: '#8A6A4F',    // น้ำตาลอุ่น — งานหลังบ้าน ไม่ต้องเรียกสายตา
} as const;

/** เข้มลงหนึ่งขั้นของแต่ละโซน — ใช้กับแถบรองใต้หัวการ์ด */
export const ZONE_DARK = {
  front: '#4A7259',
  online: '#3C6678',
  back: '#71563E',
} as const;
