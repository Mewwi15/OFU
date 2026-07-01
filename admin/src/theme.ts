import type { ThemeConfig } from 'antd';

// อู้ฟู่ brand tokens for Ant Design — coral primary on a warm canvas,
// green reserved for success/discount. One source of truth for the whole admin.
export const oofooTheme: ThemeConfig = {
  token: {
    colorPrimary: '#F15929',
    colorInfo: '#F15929',
    colorSuccess: '#1E9E5C',
    colorWarning: '#E08C00',
    colorError: '#E5484D',
    colorLink: '#C5410F',
    borderRadius: 8,
    fontFamily: "'Mitr', system-ui, 'Noto Sans Thai', sans-serif",
    fontSize: 14,
    colorBgLayout: '#FBF2EC',
    colorTextBase: '#2B2320',
    colorTextSecondary: '#6E625C',
    colorBorderSecondary: '#F0EAE6',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: '#FBF2EC',
      headerHeight: 60,
      headerPadding: '0 20px',
    },
    Menu: {
      itemSelectedBg: '#FDEEE7',
      itemSelectedColor: '#C5410F',
      itemBorderRadius: 8,
      itemHeight: 40,
      iconSize: 18,
    },
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Table: { headerBg: '#FBF7F4', headerColor: '#6E625C', borderColor: '#F0EAE6', cellPaddingBlock: 12 },
    Card: { borderRadiusLG: 12 },
    Modal: { borderRadiusLG: 12 },
    Statistic: { titleFontSize: 13 },
  },
};
