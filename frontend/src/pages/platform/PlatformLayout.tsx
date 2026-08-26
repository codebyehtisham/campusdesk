import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import {
  IconBuildings,
  IconCard,
  IconDashboard,
  IconKey,
  IconPulse,
  IconSwitches,
} from '../../components/nav/ConsoleIcons';
import { Pulse } from './ui';

export function RequirePlatform() {
  const account = getPlatform();
  if (!account?.token || account.role !== 'superadmin') return <Navigate to={SUPER_BASE} replace />;
  return <Outlet />;
}

const navGroups = [
  {
    title: 'Platform',
    items: [
      { to: `${SUPER_BASE}/dashboard`, label: 'Control', icon: IconDashboard },
      { to: `${SUPER_BASE}/organizations`, label: 'Tenants', icon: IconBuildings },
      { to: `${SUPER_BASE}/modules`, label: 'Catalog', icon: IconSwitches },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: `${SUPER_BASE}/billing`, label: 'Billing', icon: IconCard },
      { to: `${SUPER_BASE}/audit`, label: 'Traffic', icon: IconPulse },
    ],
  },
  {
    title: 'Account',
    items: [{ to: `${SUPER_BASE}/settings`, label: 'Access', icon: IconKey }],
  },
];

function initials(email?: string) {
  const source = email || 'SA';
  return source.slice(0, 2).toUpperCase();
}

export default function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState(() => getPlatform());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setAccount(getPlatform());
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleSignOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  const sidebar = (
    <>
      <Link to={`${SUPER_BASE}/dashboard`} className="mb-6 flex items-center gap-3" onClick={() => setOpen(false)}>
        <span className="pc-mark" aria-hidden="true">
          <IconDashboard />
        </span>
        <span className="pc-brand-meta leading-tight">
          <strong>Control plane</strong>
          <small className="text-[0.62rem] font-medium tracking-[0.12em] text-[var(--pc-muted)] uppercase">
            Superuser
          </small>
        </span>
      </Link>

      <p className="pc-rail-live mb-5">
        <Pulse on />
        System live
      </p>

      <div className="pc-nav-scroll">
        {navGroups.map((group) => (
          <div key={group.title} className="pc-nav-group">
            <p className="pc-nav-label">{group.title}</p>
            <nav className="pc-nav">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  <span className="pc-nav-icon">
                    <item.icon />
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="pc-rail-foot">
        <div className="pc-rail-user">
          <span className="pc-rail-avatar" aria-hidden="true">
            {initials(account?.email)}
          </span>
          <div className="pc-rail-user-meta">
            <strong>{account?.email || 'platform'}</strong>
            <small>Restricted access</small>
          </div>
        </div>
        <button type="button" className="pc-rail-signout" onClick={handleSignOut}>
          Sign out
        </button>
        <p className="pc-rail-note">
          Global departments and tenant entitlements. Campus consoles stay on their own theme.
        </p>
      </div>
    </>
  );

  return (
    <div className="platform-shell min-h-svh">
      <div className="relative z-1 flex min-h-svh w-full">
        <aside
          className={`pc-rail fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-5 transition-transform md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebar}
        </aside>

        {open && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pc-topbar sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 md:px-8">
            <button
              type="button"
              className="rounded-[10px] border border-[var(--pc-line)] px-3 py-2 text-sm font-semibold text-[var(--pc-text)] md:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <p className="m-0 hidden truncate font-mono text-[0.72rem] tracking-wide text-[var(--pc-muted)] md:block">
              {account?.email || 'platform'} · restricted
            </p>
            <button type="button" className="btn btn-outline py-2 text-sm max-md:hidden" onClick={handleSignOut}>
              Sign out
            </button>
          </header>
          <main className="flex-1 px-5 py-7 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
