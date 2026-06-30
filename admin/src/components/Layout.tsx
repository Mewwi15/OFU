import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth';

const NAV = [
  { to: '/products', label: 'สินค้า' },
  { to: '/banners', label: 'แบนเนอร์' },
  { to: '/orders', label: 'ออเดอร์' },
  { to: '/payments', label: 'ตรวจสลิป' },
];

export function Layout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          อู้ฟู่ <span>· แอดมิน</span>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="who">
          {profile?.displayName || 'แอดมิน'}
          {profile?.tier ? ` · ${profile.tier}` : ''}
        </div>
        <button className="nav-link" onClick={() => void signOut()}>
          ออกจากระบบ
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
