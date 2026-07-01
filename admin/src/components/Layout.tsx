import { RiMenuLine, RiNotification3Line } from '@remixicon/react';
import { Avatar, Badge, Button, Drawer, Grid, Layout as AntLayout } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth';
import { Sidebar, currentNavLabel } from './Sidebar';

const { Header, Sider, Content } = AntLayout;

export function Layout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = screens.lg;
  const initials = (profile?.displayName || 'แอ').trim().slice(0, 2).toUpperCase();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {isDesktop && (
        <Sider width={240} theme="light" style={{ borderInlineEnd: '1px solid #F0EAE6' }}>
          <Sidebar />
        </Sider>
      )}
      <AntLayout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid #F0EAE6',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}>
          {!isDesktop && (
            <Button type="text" icon={<RiMenuLine className="w-5 h-5" />} onClick={() => setDrawerOpen(true)} />
          )}
          <span className="text-[15px] font-medium text-[#2B2320]">{currentNavLabel(pathname)}</span>
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
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </AntLayout>
  );
}
