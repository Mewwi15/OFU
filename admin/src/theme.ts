import type { ThemeConfig } from 'antd';

// อู้ฟู่ admin tokens for Ant Design — a clean white canvas, square corners,
// and a monotone ink accent (buttons, links, active state). Owner requests:
// 2026-07-15 white/square redesign, then 2026-07-16 swap the accent off the
// customer app's coral (locked brand color there) to a near-black monotone
// so the internal admin/POS tool reads as its own distinct, serious tool,
// plus a soft shadow on cards. One source of truth for the whole admin.
export const oofooTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1E1E1E',
    colorInfo: '#1E1E1E',
    colorSuccess: '#1E9E5C',
    colorWarning: '#E08C00',
    colorError: '#E5484D',
    colorLink: '#1E1E1E',
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
      itemSelectedColor: '#1E1E1E',
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
