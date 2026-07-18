import { AudioMutedOutlined, SoundOutlined } from '@ant-design/icons';
import { RiMenuLine, RiNotification3Line } from '@remixicon/react';
import { Avatar, Badge, Button, Drawer, Grid, Layout as AntLayout, Tooltip } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth';
import { VOICE_STORAGE_KEY } from '../lib/voiceAnnounce';
import { OrderAlerts } from './OrderAlerts';
import { Sidebar, currentNavLabel } from './Sidebar';

const { Header, Sider, Content } = AntLayout;

export function Layout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = screens.lg;
  const initials = (profile?.displayName || 'แอ').trim().slice(0, 2).toUpperCase();

  // Spoken new-order announcements. Default OFF; persisted in localStorage and
  // read at speak time by OrderAlerts, so this toggle is the whole UI for it.
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(VOICE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* private mode / storage blocked — the in-memory toggle still holds for this session */
    }
    // Turning it on is a user gesture; prime speechSynthesis with a silent
    // utterance so the first real order isn't swallowed by autoplay policy.
    if (next) {
      try {
        window.speechSynthesis?.speak(new SpeechSynthesisUtterance(''));
      } catch {
        /* no speech engine — the toggle still persists, announcements degrade to chime */
      }
    }
  };

  return (
    <AntLayout style={{ height: '100vh' }}>
      {/* Live new-order / new-slip alerts (chime + notification) on every page */}
      <OrderAlerts />
      {/* Fixed sidebar — full height, only the content area scrolls */}
      {isDesktop && (
        <Sider
          width={240}
          collapsedWidth={72}
          collapsed={collapsed}
          theme="light"
          style={{ height: '100vh', borderInlineEnd: '1px solid #E8E8E8', overflow: 'hidden' }}>
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </Sider>
      )}
      <AntLayout style={{ height: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid #E8E8E8',
            flex: '0 0 auto',
          }}>
          {!isDesktop && (
            <Button type="text" icon={<RiMenuLine className="w-5 h-5" />} onClick={() => setDrawerOpen(true)} />
          )}
          <span className="text-[15px] font-medium text-[#2B2320]">{currentNavLabel(pathname)}</span>
          <div className="ml-auto flex items-center gap-3">
            <Tooltip title={voiceOn ? 'เสียงประกาศออเดอร์: เปิด' : 'เสียงประกาศออเดอร์: ปิด'}>
              <Button
                type={voiceOn ? 'primary' : 'text'}
                size="small"
                icon={voiceOn ? <SoundOutlined /> : <AudioMutedOutlined />}
                onClick={toggleVoice}
                aria-pressed={voiceOn}
                aria-label="สลับเสียงประกาศออเดอร์">
                เสียงประกาศ
              </Button>
            </Tooltip>
            <Badge dot color="#5B8C6E" offset={[-2, 2]}>
              <Button type="text" shape="circle" icon={<RiNotification3Line className="w-5 h-5" />} />
            </Badge>
            <Avatar style={{ backgroundColor: '#5B8C6E', fontSize: 13 }}>{initials}</Avatar>
          </div>
        </Header>
        <Content style={{ padding: isDesktop ? 28 : 16, overflowY: 'auto', flex: '1 1 auto' }}>
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
