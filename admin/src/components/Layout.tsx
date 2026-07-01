import {
  RiBillLine,
  RiImageLine,
  RiLogoutBoxRLine,
  RiCashLine,
  RiMegaphoneLine,
  RiNotification3Line,
  RiSearchLine,
  RiShoppingBag3Line,
  RiStore2Line,
} from '@remixicon/react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth';

const NAV = [
  { to: '/pos', label: 'ขายหน้าร้าน', Icon: RiCashLine },
  { to: '/products', label: 'สินค้า', Icon: RiStore2Line },
  { to: '/broadcast', label: 'ประกาศ', Icon: RiMegaphoneLine },
  { to: '/banners', label: 'แบนเนอร์', Icon: RiImageLine },
  { to: '/orders', label: 'ออเดอร์', Icon: RiShoppingBag3Line },
  { to: '/payments', label: 'ตรวจสลิป', Icon: RiBillLine },
];

export function Layout() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to))?.label ?? '';
  const initials = (profile?.displayName || 'A').trim().slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-tremor-brand text-white grid place-items-center font-semibold">
            อ
          </div>
          <span className="font-semibold text-[15px]">
            อู้ฟู่ <span className="text-gray-400 font-light">แอดมิน</span>
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ' +
                (isActive
                  ? 'bg-tremor-brand-faint text-tremor-brand-emphasis font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')
              }>
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800">
            <RiLogoutBoxRLine className="w-[18px] h-[18px]" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white border-b border-gray-100 flex items-center gap-4 px-7">
          <div className="text-sm text-gray-400">
            ร้าน อู้ฟู่ <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-gray-800 font-medium">{current}</span>
          </div>
          <div className="flex-1 max-w-md ml-4 relative hidden md:block">
            <RiSearchLine className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-tremor-brand-muted"
              placeholder="ค้นหา…"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="w-9 h-9 grid place-items-center rounded-xl text-gray-500 hover:bg-gray-50">
              <RiNotification3Line className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-tremor-brand-emphasis text-white grid place-items-center text-xs font-semibold">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
