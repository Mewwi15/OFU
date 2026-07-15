import type { ThemeConfig } from 'antd';

// อู้ฟู่ admin tokens for Ant Design — a clean white canvas, square corners,
// and a deep forest-green accent (buttons, links, active state). Owner
// requests: 2026-07-15 white/square redesign, then 2026-07-16 swap the
// accent off the customer app's coral (locked brand color there) — tried
// near-black monotone first ("ไม่เอาสีดำๆ" — rejected), landed on forest
// green #14532D — so the internal admin/POS tool reads as its own distinct
// tool, plus a soft shadow on cards. One source of truth for the whole admin.
// NOTE: colorPrimary (#14532D, deep forest) is a DIFFERENT green from
// colorSuccess (#1E9E5C, brighter) — primary is brand/action, success stays
// reserved for success/discount semantics. Don't merge these.
export const oofooTheme: ThemeConfig = {
  token: {
    colorPrimary: '#14532D',
    colorInfo: '#14532D',
    colorSuccess: '#1E9E5C',
    colorWarning: '#E08C00',
    colorError: '#E5484D',
    colorLink: '#14532D',
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
      itemSelectedColor: '#14532D',
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
