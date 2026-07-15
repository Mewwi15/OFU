import type { ThemeConfig } from 'antd';

// อู้ฟู่ brand tokens for Ant Design — coral accent (buttons, links, active
// state) on a clean white canvas with square corners. Owner request
// 2026-07-15: white backgrounds, sharp (0px) frames instead of the earlier
// warm-cream/rounded look — the coral brand color stays for actions/
// highlights, only the background tint and corner radius changed. One
// source of truth for the whole admin.
export const oofooTheme: ThemeConfig = {
  token: {
    colorPrimary: '#F15929',
    colorInfo: '#F15929',
    colorSuccess: '#1E9E5C',
    colorWarning: '#E08C00',
    colorError: '#E5484D',
    colorLink: '#C5410F',
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
      itemSelectedColor: '#C5410F',
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
