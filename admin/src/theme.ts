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
    borderRadius: 10,
    fontFamily: "'Mitr', system-ui, 'Noto Sans Thai', sans-serif",
    colorBgLayout: '#FBF2EC',
    colorTextBase: '#2B2320',
    colorTextSecondary: '#6E625C',
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
      itemBorderRadius: 10,
      itemHeight: 42,
      iconSize: 18,
    },
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Table: { headerBg: '#FBF7F4', headerColor: '#6E625C', borderColor: '#F0EAE6', cellPaddingBlock: 14 },
    Card: { borderRadiusLG: 16 },
    Modal: { borderRadiusLG: 16 },
    Statistic: { titleFontSize: 13 },
  },
};
