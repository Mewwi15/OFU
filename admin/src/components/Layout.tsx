import {
  RiBarChart2Line,
  RiBillLine,
  RiCashLine,
  RiImageLine,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiMenuLine,
  RiNotification3Line,
  RiShoppingBag3Line,
  RiStore2Line,
} from '@remixicon/react';
import { Avatar, Badge, Button, Drawer, Grid, Layout as AntLayout, Menu } from 'antd';
import { useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';

const { Header, Sider, Content } = AntLayout;

const NAV: { to: string; label: string; Icon: typeof RiCashLine }[] = [
  { to: '/pos', label: 'ขายหน้าร้าน', Icon: RiCashLine },
  { to: '/reports', label: 'รายงาน', Icon: RiBarChart2Line },
  { to: '/products', label: 'สินค้า', Icon: RiStore2Line },
  { to: '/broadcast', label: 'ประกาศ', Icon: RiMegaphoneLine },
  { to: '/banners', label: 'แบนเนอร์', Icon: RiImageLine },
  { to: '/orders', label: 'ออเดอร์', Icon: RiShoppingBag3Line },
  { to: '/payments', label: 'ตรวจสลิป', Icon: RiBillLine },
];

function Brand() {
  return (
    <div className="h-[60px] flex items-center gap-2 px-5 border-b border-[#F0EAE6]">
      <div className="w-8 h-8 rounded-lg bg-[#F15929] text-white grid place-items-center font-semibold">อ</div>
      <span className="font-semibold text-[15px] text-[#2B2320]">
        อู้ฟู่ <span className="text-gray-400 font-light">แอดมิน</span>
      </span>
    </div>
  );
}

function SideMenu({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const active = NAV.find((n) => pathname.startsWith(n.to))?.to ?? '/pos';
  return (
    <div className="flex flex-col h-full">
      <Menu
        mode="inline"
        selectedKeys={[active]}
        style={{ flex: 1, borderInlineEnd: 'none', padding: 12 }}
        onClick={({ key }) => {
          nav(key);
          onNavigate?.();
        }}
        items={NAV.map((n) => ({
          key: n.to,
          icon: <n.Icon className="w-[18px] h-[18px]" />,
          label: n.label,
        }))}
      />
      <div className="p-3 border-t border-[#F0EAE6]">
        <Button type="text" block icon={<RiLogoutBoxRLine className="w-[18px] h-[18px]" />} onClick={() => void signOut()} style={{ justifyContent: 'flex-start', color: '#6E625C' }}>
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );
}

export function Layout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = screens.lg;
  const current = NAV.find((n) => pathname.startsWith(n.to))?.label ?? '';
  const initials = (profile?.displayName || 'แอ').trim().slice(0, 2).toUpperCase();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {isDesktop && (
        <Sider width={240} theme="light" style={{ borderInlineEnd: '1px solid #F0EAE6' }}>
          <Brand />
          <SideMenu />
        </Sider>
      )}
      <AntLayout>
        <Header style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #F0EAE6', position: 'sticky', top: 0, zIndex: 10 }}>
          {!isDesktop && (
            <Button type="text" icon={<RiMenuLine className="w-5 h-5" />} onClick={() => setDrawerOpen(true)} />
          )}
          <span className="text-[15px] font-medium text-[#2B2320]">{current}</span>
          <div className="ml-auto flex items-center gap-3">
            <Badge dot color="#F15929" offset={[-2, 2]}>
              <Button type="text" shape="circle" icon={<RiNotification3Line className="w-5 h-5" />} />
            </Badge>
            <Avatar style={{ backgroundColor: '#C5410F', fontSize: 13 }}>{initials}</Avatar>
          </div>
        </Header>
        <Content style={{ padding: isDesktop ? 28 : 16 }}>
          <Outlet />
        </Content>
      </AntLayout>

      <Drawer
        placement="left"
        open={!isDesktop && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}>
        <Brand />
        <div style={{ height: 'calc(100% - 60px)' }}>
          <SideMenu onNavigate={() => setDrawerOpen(false)} />
        </div>
      </Drawer>
    </AntLayout>
  );
}

// kept for any external imports expecting a wrapper
export type LayoutChildren = { children: ReactNode };
