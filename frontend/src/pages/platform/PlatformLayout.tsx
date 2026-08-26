import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import { Pulse } from './ui';

export function RequirePlatform() {
  const account = getPlatform();
  if (!account?.token || account.role !== 'superadmin') return <Navigate to={SUPER_BASE} replace />;
  return <Outlet />;
}

const nav = [
  { to: `${SUPER_BASE}/dashboard`, label: 'Control', icon: IconGrid },
  { to: `${SUPER_BASE}/organizations`, label: 'Tenants', icon: IconBuildings },
  { to: `${SUPER_BASE}/modules`, label: 'Catalog', icon: IconSwitches },
  { to: `${SUPER_BASE}/billing`, label: 'Billing', icon: IconCard },
  { to: `${SUPER_BASE}/audit`, label: 'Traffic', icon: IconPulse },
  { to: `${SUPER_BASE}/settings`, label: 'Access', icon: IconKey },
];

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconBuildings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 14V5.5L8 2.5l5.5 3V14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconSwitches() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="4.2" rx="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11.2" cy="4.6" r="1.35" fill="currentColor" />
      <rect x="1.5" y="9.3" width="13" height="4.2" rx="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4.8" cy="11.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.4h13" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 10.2h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.5 8h3l1.4-3.5 2.4 7L10.2 6l1.3 2h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.4 8H14v2.2M11.2 8v2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
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

  return (
    <div className="platform-shell min-h-svh">
      <div className="relative z-1 mx-auto flex min-h-svh">
        <aside
          className={`pc-rail fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-5 transition-transform md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Link to={`${SUPER_BASE}/dashboard`} className="mb-6 flex items-center gap-3">
            <span className="pc-mark" aria-hidden="true">
              <IconGrid />
            </span>
            <span className="pc-brand-meta leading-tight">
              <strong className="block">Control plane</strong>
              <small className="text-[0.62rem] font-medium tracking-[0.12em] text-[var(--pc-muted)] uppercase">
                Superuser
              </small>
            </span>
          </Link>
          <p className="pc-rail-live mb-5">
            <Pulse on />
            System live
          </p>
          <nav className="pc-nav flex-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'is-active' : '')}
              >
                <item.icon />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <p className="m-0 pt-4 text-[0.65rem] leading-relaxed text-[var(--pc-muted)]">
            Global departments and tenant entitlements. Campus consoles stay on their own theme.
          </p>
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
            <button type="button" className="btn btn-outline py-2 text-sm" onClick={handleSignOut}>
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
