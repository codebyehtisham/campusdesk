import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getStaff, signOutStaff } from '../../auth/staffSession';
import { roleLabel } from '../../data/roles';
import BrandMark from '../../components/BrandMark';
import NotificationBell from '../../components/NotificationBell';

function NavItem({ to, label, end, onNavigate }) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => (isActive ? 'is-active' : '')}>
      <span className="staff-nav-link-label">{label}</span>
    </NavLink>
  );
}

export default function StaffPortalLayout({ base, portalLabel, homePath, nav }) {
  const navigate = useNavigate();
  const staff = getStaff();
  const org = staff?.organization;
  const home = homePath || `${base}/home`;
  const [open, setOpen] = useState(false);
  const allNav = [...nav, { to: `${base}/leave`, label: 'Leave', end: true }, { to: `${base}/password`, label: 'Password', end: true }];

  const sidebar = (
    <>
      <Link to={home} className="staff-rail-brand" onClick={() => setOpen(false)}>
        <BrandMark org={org} size={48} className="ring-2 ring-white/20" />
        <span>
          <strong>{org?.title || org?.name || 'Campus'}</strong>
          <small>{portalLabel}</small>
        </span>
      </Link>
      <nav className="staff-nav mt-8">
        {allNav.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={() => setOpen(false)} />
        ))}
      </nav>
      <div className="staff-rail-foot mt-auto">
        <p className="m-0 text-sm text-white/90">{staff?.name}</p>
        <p className="m-0 text-xs text-white/70">{roleLabel(staff?.role)}</p>
        <button
          type="button"
          className="staff-rail-signout mt-3"
          onClick={() => {
            signOutStaff();
            navigate(base);
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="staff-shell staff-portal-simple min-h-svh bg-bg-alt">
      <div className="relative z-1 flex min-h-svh w-full">
        {open ? (
          <button type="button" className="staff-mobile-scrim fixed inset-0 z-30 backdrop-blur-sm md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />
        ) : null}
        <aside
          className={`staff-rail fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-5 text-white transition-transform md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="faculty-topbar sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 md:px-8">
            <button type="button" className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-ink md:hidden" onClick={() => setOpen(true)}>
              Menu
            </button>
            <p className="m-0 hidden truncate text-sm font-semibold text-ink md:block">{org?.title || org?.name || 'Campus'}</p>
            <div className="flex items-center gap-3">
              <NotificationBell authScope="staff" />
              <button type="button" className="btn btn-outline py-2 text-sm max-md:hidden" onClick={() => { signOutStaff(); navigate(base); }}>
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 px-5 py-8 md:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
