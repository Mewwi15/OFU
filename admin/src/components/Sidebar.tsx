import {
  RiInboxArchiveLine,
  RiInboxUnarchiveLine,
  RiSafe2Line,
  RiBarChart2Line,
  RiCashLine,
  RiChat1Line,
  RiCouponLine,
  RiFileList3Line,
  RiHistoryLine,
  RiRocket2Line,
  RiImageLine,
  RiLock2Line,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiPriceTag3Line,
  RiSettings3Line,
  RiShoppingBag3Line,
  RiStore2Line,
  RiTeamLine,
  RiWallet3Line,
} from '@remixicon/react';
import { Badge, Button, Menu } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';
import { useBackOfficeLock } from '../lib/backOffice';
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

export type NavItem = { to: string; label: string; Icon: typeof RiCashLine; ownerOnly?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

/* เมนูแบ่งสองโซนตามที่เจ้าของสั่ง 30 ส.ค. 2026: หน้าร้าน กับ หลังร้าน
 *
 * เส้นแบ่งคือ "ตอนนี้มีลูกค้ายืนรออยู่ไหม" ไม่ใช่ "ออนไลน์หรือออฟไลน์" แบบเดิม
 * งานหน้าร้านคืองานที่ทำตอนเปิดร้านและมีคนรอ — ต้องกดถึงเร็ว อยู่บนสุดเสมอ
 * งานหลังร้านคืองานที่นั่งทำตอนว่างหรือปิดร้าน ช้าได้ ไม่ต้องแย่งที่ข้างบน
 *
 * ออเดอร์กับแชตลูกค้าอยู่หน้าร้าน ทั้งที่มาจากออนไลน์ เพราะคนทำคือคนเดียวกับที่
 * ยืนหน้าเคาน์เตอร์ และมีลูกค้ารออยู่จริงเหมือนกัน — เดิมแยกไปกลุ่ม "ออนไลน์"
 * ซึ่งเป็นการแบ่งตามช่องทาง ไม่ใช่ตามงานที่คนต้องทำ
 *
 * สต๊อกกับรับของเข้าย้ายลงหลังร้าน เพราะเป็นงานที่ทำตอนของมาส่งหรือตอนปิดร้าน
 * ไม่ใช่งานที่ทำตอนลูกค้ายืนรอ
 */
// eslint-disable-next-line react/only-export-components -- nav data lives beside its component
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'หน้าร้าน',
    items: [
      { to: '/pos', label: 'ขายหน้าร้าน', Icon: RiCashLine },
      { to: '/shift', label: 'เปิด-ปิดรอบ', Icon: RiSafe2Line },
      { to: '/pos-sales', label: 'บิลขาย', Icon: RiFileList3Line },
      { to: '/orders', label: 'ออเดอร์', Icon: RiShoppingBag3Line },
      { to: '/chat', label: 'แชตลูกค้า', Icon: RiChat1Line },
    ],
  },
  {
    title: 'หลังร้าน',
    items: [
      { to: '/stock', label: 'สต๊อก', Icon: RiInboxArchiveLine },
      { to: '/receive', label: 'รับของเข้า', Icon: RiInboxUnarchiveLine },
      { to: '/products', label: 'สินค้า', Icon: RiStore2Line },
      { to: '/categories', label: 'หมวดหมู่', Icon: RiPriceTag3Line },
      { to: '/promotions', label: 'โปรโมชั่น', Icon: RiCouponLine, ownerOnly: true },
      { to: '/banners', label: 'แบนเนอร์', Icon: RiImageLine },
      { to: '/broadcast', label: 'ประกาศ', Icon: RiMegaphoneLine },
      { to: '/reports', label: 'รายงาน', Icon: RiBarChart2Line },
      { to: '/store-credit', label: 'เครดิตร้าน', Icon: RiWallet3Line },
      { to: '/audit-log', label: 'ประวัติแก้ไข', Icon: RiHistoryLine, ownerOnly: true },
      { to: '/deploys', label: 'อัปเดตระบบ', Icon: RiRocket2Line, ownerOnly: true },
      { to: '/staff', label: 'พนักงาน', Icon: RiTeamLine, ownerOnly: true },
      { to: '/settings', label: 'ตั้งค่า', Icon: RiSettings3Line },
    ],
  },
];

// eslint-disable-next-line react/only-export-components -- nav data lives beside its component
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Match on a path boundary so e.g. "/pos-sales" doesn't get captured by "/pos".
const navMatches = (pathname: string, to: string) => pathname === to || pathname.startsWith(to + '/');

// eslint-disable-next-line react/only-export-components -- nav helper lives beside its component
export const currentNavLabel = (pathname: string) =>
  NAV.find((n) => navMatches(pathname, n.to))?.label ?? '';

function Brand({ collapsed, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  // Collapsed: just the fold toggle (click to expand). Expanded: logo + name + fold toggle.
  if (collapsed) {
    return (
      <div className="h-[60px] flex items-center justify-center border-b border-[#E8E8E8]">
        <button
          onClick={onToggle}
          title="ขยายเมนู"
          className="w-9 h-9 grid place-items-center rounded-none text-gray-500 hover:bg-gray-50">
          <RiMenuUnfoldLine className="w-5 h-5" />
        </button>
      </div>
    );
  }
  return (
    <div className="h-[60px] flex items-center border-b border-[#E8E8E8] px-4">
      <img src="/logo-oofoo.png" alt="อู้ฟู่" style={{ height: 36 }} className="object-contain" />
      {onToggle && (
        <button
          onClick={onToggle}
          title="ยุบเมนู"
          className="ml-auto w-8 h-8 grid place-items-center rounded-none text-gray-400 hover:bg-gray-50 hover:text-gray-700">
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
  const { signOut, profile } = useAuth();
  const chatUnread = useChatUnread();
  const active = NAV.find((n) => navMatches(pathname, n.to))?.to ?? '/pos';
  const isOwner = profile?.tier === 'owner';
  const { locked: backOfficeLocked } = useBackOfficeLock();

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
        items={NAV_GROUPS.map((g) =>
          /* ล็อกอยู่ = ซ่อนเมนูหลังร้านทั้งกลุ่ม เหลือปุ่มเดียวไว้ใส่รหัส (เจ้าของสั่ง
             30 ส.ค.: "ต้องซ่อนเมนูหลังร้านด้วย ถ้าใส่ถึงจะเห็น") — กดแล้วพาไปหน้าสต๊อก
             ซึ่งด่านจะดักถามรหัสให้เอง ไม่ต้องมีกลไกถามรหัสซ้ำอีกชุด */
          g.title === 'หลังร้าน' && backOfficeLocked
            ? {
                type: 'group' as const,
                key: g.title,
                label: g.title,
                children: [{
                  key: '/stock',
                  icon: <RiLock2Line className="w-[18px] h-[18px]" />,
                  label: 'ใส่รหัสเพื่อเข้า',
                }],
              }
            : ({
          type: 'group' as const,
          key: g.title,
          label: g.title,
          children: g.items
            .filter((n) => !n.ownerOnly || isOwner)
            .map((n) => ({
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
      <div className="p-3 border-t border-[#E8E8E8]">
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
