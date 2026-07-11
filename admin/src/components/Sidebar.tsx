import {
  RiBarChart2Line,
  RiBillLine,
  RiCashLine,
  RiChat1Line,
  RiFileList3Line,
  RiImageLine,
  RiLayoutMasonryLine,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiPriceTag3Line,
  RiSettings3Line,
  RiShoppingBag3Line,
  RiStore2Line,
  RiWallet3Line,
} from '@remixicon/react';
import { Badge, Button, Menu } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';
import { subscribeChatActivity, totalUnread } from '../lib/chat';

/** Live unread-chat total for the sidebar badge (best-effort). */
function useChatUnread(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const refresh = () => void totalUnread().then(setUnread).catch(() => {});
    refresh();
    return subscribeChatActivity(refresh);
  }, []);
  return unread;
}

export type NavItem = { to: string; label: string; Icon: typeof RiCashLine };
export type NavGroup = { title: string; items: NavItem[] };

/** Sidebar grouped into zones: on-site, online, catalog/app, overview. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'หน้าร้าน',
    items: [
      { to: '/pos', label: 'ขายหน้าร้าน', Icon: RiCashLine },
      { to: '/pos-sales', label: 'บิลขาย', Icon: RiFileList3Line },
    ],
  },
  {
    title: 'ออนไลน์',
    items: [
      { to: '/orders', label: 'ออเดอร์', Icon: RiShoppingBag3Line },
      { to: '/payments', label: 'ตรวจสลิป', Icon: RiBillLine },
      { to: '/chat', label: 'แชตลูกค้า', Icon: RiChat1Line },
    ],
  },
  {
    title: 'จัดการแอป',
    items: [
      { to: '/products', label: 'สินค้า', Icon: RiStore2Line },
      { to: '/categories', label: 'หมวดหมู่', Icon: RiPriceTag3Line },
      { to: '/featured', label: 'จัดหน้าแอป', Icon: RiLayoutMasonryLine },
      { to: '/banners', label: 'แบนเนอร์', Icon: RiImageLine },
      { to: '/broadcast', label: 'ประกาศ', Icon: RiMegaphoneLine },
    ],
  },
  {
    title: 'ภาพรวม',
    items: [
      { to: '/reports', label: 'รายงาน', Icon: RiBarChart2Line },
      { to: '/store-credit', label: 'เครดิตร้าน', Icon: RiWallet3Line },
      { to: '/settings', label: 'ตั้งค่า', Icon: RiSettings3Line },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Match on a path boundary so e.g. "/pos-sales" doesn't get captured by "/pos".
const navMatches = (pathname: string, to: string) => pathname === to || pathname.startsWith(to + '/');

export const currentNavLabel = (pathname: string) =>
  NAV.find((n) => navMatches(pathname, n.to))?.label ?? '';

function Brand({ collapsed, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  // Collapsed: just the fold toggle (click to expand). Expanded: logo + name + fold toggle.
  if (collapsed) {
    return (
      <div className="h-[60px] flex items-center justify-center border-b border-[#F0EAE6]">
        <button
          onClick={onToggle}
          title="ขยายเมนู"
          className="w-9 h-9 grid place-items-center rounded-lg text-gray-500 hover:bg-gray-50">
          <RiMenuUnfoldLine className="w-5 h-5" />
        </button>
      </div>
    );
  }
  return (
    <div className="h-[60px] flex items-center border-b border-[#F0EAE6] px-4">
      <img src="/logo-oofoo.png" alt="อู้ฟู่" style={{ height: 36 }} className="object-contain" />
      {onToggle && (
        <button
          onClick={onToggle}
          title="ยุบเมนู"
          className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700">
          <RiMenuFoldLine className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/** Full-height brand + nav + logout column. Used inside the desktop Sider and the mobile Drawer. */
export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const chatUnread = useChatUnread();
  const active = NAV.find((n) => navMatches(pathname, n.to))?.to ?? '/pos';

  return (
    <div className="flex flex-col h-full">
      <Brand collapsed={collapsed} onToggle={onToggle} />
      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[active]}
        style={{ flex: 1, borderInlineEnd: 'none', padding: collapsed ? 8 : 12, overflowY: 'auto', overflowX: 'hidden' }}
        onClick={({ key }) => {
          nav(key);
          onNavigate?.();
        }}
        items={NAV_GROUPS.map((g) => ({
          type: 'group' as const,
          key: g.title,
          label: g.title,
          children: g.items.map((n) => ({
            key: n.to,
            icon: <n.Icon className="w-[18px] h-[18px]" />,
            label:
              n.to === '/chat' && chatUnread > 0 ? (
                <span className="flex items-center justify-between gap-2">
                  {n.label}
                  <Badge count={chatUnread} size="small" />
                </span>
              ) : (
                n.label
              ),
          })),
        }))}
      />
      <div className="p-3 border-t border-[#F0EAE6]">
        <Button
          type="text"
          block
          icon={<RiLogoutBoxRLine className="w-[18px] h-[18px]" />}
          onClick={() => void signOut()}
          title="ออกจากระบบ"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', color: '#6E625C' }}>
          {!collapsed && 'ออกจากระบบ'}
        </Button>
        {/* Build stamp: which version this tab is ACTUALLY running (stale-tab tell). */}
        {!collapsed && (
          <div className="mt-1 text-center text-[10px] text-[#B7ACA5]">เวอร์ชัน {__BUILD_TIME__}</div>
        )}
      </div>
    </div>
  );
}
