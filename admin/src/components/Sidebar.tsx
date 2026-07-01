import {
  RiBarChart2Line,
  RiBillLine,
  RiCashLine,
  RiImageLine,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiPriceTag3Line,
  RiShoppingBag3Line,
  RiStore2Line,
} from '@remixicon/react';
import { Button, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';

export type NavItem = { to: string; label: string; Icon: typeof RiCashLine };

export const NAV: NavItem[] = [
  { to: '/pos', label: 'ขายหน้าร้าน', Icon: RiCashLine },
  { to: '/reports', label: 'รายงาน', Icon: RiBarChart2Line },
  { to: '/products', label: 'สินค้า', Icon: RiStore2Line },
  { to: '/categories', label: 'หมวดหมู่', Icon: RiPriceTag3Line },
  { to: '/broadcast', label: 'ประกาศ', Icon: RiMegaphoneLine },
  { to: '/banners', label: 'แบนเนอร์', Icon: RiImageLine },
  { to: '/orders', label: 'ออเดอร์', Icon: RiShoppingBag3Line },
  { to: '/payments', label: 'ตรวจสลิป', Icon: RiBillLine },
];

export const currentNavLabel = (pathname: string) =>
  NAV.find((n) => pathname.startsWith(n.to))?.label ?? '';

function Brand() {
  return (
    <div className="h-[60px] flex items-center gap-2 px-5 border-b border-[#F0EAE6]">
      <div className="w-8 h-8 rounded-lg bg-[#F15929] text-white grid place-items-center font-medium">อ</div>
      <span className="font-medium text-[15px] text-[#2B2320]">
        อู้ฟู่ <span className="text-gray-400 font-light">แอดมิน</span>
      </span>
    </div>
  );
}

/** Full-height brand + nav + logout column. Used inside the desktop Sider and the mobile Drawer. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const active = NAV.find((n) => pathname.startsWith(n.to))?.to ?? '/pos';

  return (
    <div className="flex flex-col h-full">
      <Brand />
      <Menu
        mode="inline"
        selectedKeys={[active]}
        style={{ flex: 1, borderInlineEnd: 'none', padding: 12, overflowY: 'auto' }}
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
        <Button
          type="text"
          block
          icon={<RiLogoutBoxRLine className="w-[18px] h-[18px]" />}
          onClick={() => void signOut()}
          style={{ justifyContent: 'flex-start', color: '#6E625C' }}>
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );
}
