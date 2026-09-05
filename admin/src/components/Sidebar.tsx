import {
  RiBarChart2Line,
  RiCashLine,
  RiChat1Line,
  RiCouponLine,
  RiFileList3Line,
  RiGiftLine,
  RiHistoryLine,
  RiImageLine,
  RiInboxArchiveLine,
  RiInboxUnarchiveLine,
  RiLock2Line,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiPriceTag3Line,
  RiRocket2Line,
  RiSafe2Line,
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
import { ZONE } from '../theme';
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
/** หมวดย่อยในโซน — ใช้เฉพาะหลังร้านที่เมนูเยอะจนต้องแยกอีกชั้น */
export type NavSection = { title: string; items: NavItem[] };
export type NavGroup = { title: string; color: string; items?: NavItem[]; sections?: NavSection[] };


/* เมนูแบ่งสามโซนตามที่เจ้าของสั่ง 30 ส.ค. 2026: หน้าร้าน · ออนไลน์ · หลังร้าน
 *
 * รอบก่อนผมยุบออเดอร์กับแชตเข้าไปรวมในหน้าร้าน ด้วยเหตุผลว่าคนทำคือคนเดียวกัน
 * เจ้าของสั่งแยกออกมาเป็นโซนของตัวเอง — และถูก เพราะเวลาทำงานจริงคนแยกสองอย่างนี้
 * ออกจากกันอยู่แล้ว: หน้าร้านคือลูกค้ายืนอยู่ตรงหน้า ออนไลน์คือลูกค้าอยู่ปลายสาย
 * คนละจังหวะ คนละความเร่งด่วน หาไม่เจอถ้าเอาไปกองรวมกัน
 *
 * หลังร้านคืองานที่นั่งทำตอนว่างหรือปิดร้าน และเป็นโซนเดียวที่ต้องใส่รหัสเข้า
 * เมนูในนั้นมี 13 อัน ยาวจนเลื่อนหา เจ้าของสั่งให้แยกหมวดอีกชั้น (30 ส.ค.) จึงมี
 * sections ซ้อนข้างใน ส่วนสองโซนแรกมีไม่กี่อัน ไม่ต้องแยกซ้ำ
 *
 * ทุกโซนพับได้ตามที่สั่ง — ใช้ submenu ของ antd ไม่ใช่ group ที่พับไม่ได้
 */
// eslint-disable-next-line react/only-export-components -- nav data lives beside its component
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'หน้าร้าน',
    color: ZONE.front,
    items: [
      { to: '/pos', label: 'ขายหน้าร้าน', Icon: RiCashLine },
      { to: '/shift', label: 'เปิด-ปิดรอบ', Icon: RiSafe2Line },
      { to: '/pos-sales', label: 'บิลขาย', Icon: RiFileList3Line },
    ],
  },
  {
    title: 'ออนไลน์',
    color: ZONE.online,
    items: [
      { to: '/orders', label: 'ออเดอร์', Icon: RiShoppingBag3Line },
      { to: '/chat', label: 'แชตลูกค้า', Icon: RiChat1Line },
    ],
  },
  {
    title: 'หลังร้าน',
    color: ZONE.back,
    sections: [
      {
        // ของในร้าน — ตั้งแต่ของเข้ามาจนขึ้นชั้นให้ลูกค้าเห็น
        title: 'สินค้าและสต๊อก',
        items: [
          { to: '/stock', label: 'สต๊อก', Icon: RiInboxArchiveLine },
          { to: '/receive', label: 'รับของเข้า', Icon: RiInboxUnarchiveLine },
          { to: '/products', label: 'สินค้า', Icon: RiStore2Line },
          { to: '/categories', label: 'หมวดหมู่', Icon: RiPriceTag3Line },
        ],
      },
      {
        // ของที่ยิงออกไปหาลูกค้า
        title: 'การตลาด',
        items: [
          { to: '/promotions', label: 'โปรโมชั่น', Icon: RiCouponLine, ownerOnly: true },
          { to: '/member-rewards', label: 'สมาชิก/ของรางวัล', Icon: RiGiftLine, ownerOnly: true },
          { to: '/banners', label: 'แบนเนอร์', Icon: RiImageLine },
          { to: '/broadcast', label: 'ประกาศ', Icon: RiMegaphoneLine },
        ],
      },
      {
        title: 'เงินและรายงาน',
        items: [
          { to: '/reports', label: 'รายงาน', Icon: RiBarChart2Line },
          { to: '/store-credit', label: 'เครดิตร้าน', Icon: RiWallet3Line },
        ],
      },
      {
        // ของที่ตั้งครั้งเดียวแล้วแทบไม่กลับมาแตะ
        title: 'ตั้งค่าระบบ',
        items: [
          { to: '/staff', label: 'พนักงาน', Icon: RiTeamLine, ownerOnly: true },
          { to: '/settings', label: 'ตั้งค่า', Icon: RiSettings3Line },
          { to: '/audit-log', label: 'ประวัติแก้ไข', Icon: RiHistoryLine, ownerOnly: true },
          { to: '/deploys', label: 'อัปเดตระบบ', Icon: RiRocket2Line, ownerOnly: true },
        ],
      },
    ],
  },
];

// eslint-disable-next-line react/only-export-components -- nav data lives beside its component
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => [
  ...(g.items ?? []),
  ...(g.sections ?? []).flatMap((sec) => sec.items),
]);

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

  /* โซนที่เปิดค้างไว้ — เปิดโซนของหน้าที่ยืนอยู่ให้อัตโนมัติ ไม่งั้นรีเฟรชแล้ว
     เมนูพับหมดจนมองไม่เห็นว่าตัวเองอยู่ตรงไหน */
  const zoneOf = (p: string) =>
    NAV_GROUPS.find((g) =>
      [...(g.items ?? []), ...(g.sections ?? []).flatMap((sec) => sec.items)].some((n) => navMatches(p, n.to)),
    )?.title;
  const [openKeys, setOpenKeys] = useState<string[]>(() => [zoneOf(pathname) ?? 'หน้าร้าน']);
  useEffect(() => {
    const z = zoneOf(pathname);
    if (z) setOpenKeys((cur) => (cur.includes(z) ? cur : [...cur, z]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navItem = (n: NavItem) => ({
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
  });

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
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={NAV_GROUPS.map((g) => ({
          /* submenu ไม่ใช่ group เพราะเจ้าของสั่งให้หัวข้อหลักพับได้ — group ของ antd
             เป็นแค่ป้ายคั่น กดพับไม่ได้ */
          type: 'submenu' as const,
          key: g.title,
          /* จุดสีเป็น "ไอคอน" ของ submenu ไม่ใช่แปะไว้ใน label — ตอนยุบเมนูข้าง
             antd ซ่อน label เหลือแต่ไอคอน ถ้าเอาจุดไว้ใน label หัวโซนจะกลายเป็น
             ช่องว่างเปล่า แยกโซนไม่ออกเลยตอนยุบ */
          icon: (
            <i
              style={{
                width: 9, height: 9, background: g.color,
                display: 'inline-block', flex: '0 0 9px',
              }}
            />
          ),
          label: <span style={{ color: g.color, fontWeight: 700 }}>{g.title}</span>,
          children:
            /* ล็อกอยู่ = ซ่อนเมนูหลังร้านทั้งโซน เหลือรายการเดียวไว้ใส่รหัส กดแล้วพาไป
               หน้าสต๊อกซึ่งด่านดักถามรหัสให้เอง ไม่ต้องมีกลไกถามรหัสซ้ำอีกชุด */
            g.title === 'หลังร้าน' && backOfficeLocked
              ? [{ key: '/stock', icon: <RiLock2Line className="w-[18px] h-[18px]" />, label: 'ใส่รหัสเพื่อเข้า' }]
              : g.sections
                ? g.sections
                    .map((sec) => ({
                      type: 'group' as const,
                      key: `${g.title}/${sec.title}`,
                      label: sec.title,
                      children: sec.items.filter((n) => !n.ownerOnly || isOwner).map(navItem),
                    }))
                    .filter((sec) => sec.children.length > 0)
                : (g.items ?? []).filter((n) => !n.ownerOnly || isOwner).map(navItem),
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
