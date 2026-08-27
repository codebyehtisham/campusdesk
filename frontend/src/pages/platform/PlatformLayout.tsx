import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import { LiveClock, PlatformBackdrop, ease } from './motion';
import { Pulse } from './ui';

export function RequirePlatform() {
  const account = getPlatform();
  if (!account?.token || account.role !== 'superadmin') return <Navigate to={SUPER_BASE} replace />;
  return <Outlet />;
}

const ROUTES = [
  { to: `${SUPER_BASE}/dashboard`, label: 'Overview', hint: 'Mission control', icon: IconDashboard, key: '01', end: true },
  { to: `${SUPER_BASE}/organizations`, label: 'Tenants', hint: 'Orgs & campuses', icon: IconBuildings, key: '02' },
  { to: `${SUPER_BASE}/modules`, label: 'Catalog', hint: 'Modules & depts', icon: IconSwitches, key: '03' },
  { to: `${SUPER_BASE}/billing`, label: 'Billing', hint: 'Revenue & invoices', icon: IconCard, key: '04' },
  { to: `${SUPER_BASE}/audit`, label: 'Traffic', hint: 'API activity', icon: IconPulse, key: '05' },
  { to: `${SUPER_BASE}/settings`, label: 'Access', hint: 'Operator key', icon: IconKey, key: '06' },
];

function initials(email?: string) {
  const source = (email || 'SA').split('@')[0];
  const parts = source.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
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

  const activeIndex = ROUTES.findIndex((r) =>
    r.end ? location.pathname === r.to : location.pathname.startsWith(r.to)
  );

  const dock = (
    <div className="pc-dock">
      <div className="pc-dock-top">
        <Link to={`${SUPER_BASE}/dashboard`} className="pc-dock-brand" onClick={() => setOpen(false)}>
          <span className="pc-dock-logo" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="pc-dock-brand-text">
            <strong>Campus Desk</strong>
            <em>Operator</em>
          </span>
        </Link>

        <div className="pc-dock-signal">
          <span className="pc-dock-signal-dot">
            <Pulse on />
          </span>
          <div className="pc-dock-signal-copy">
            <strong>Systems online</strong>
            <LiveClock className="pc-dock-clock" />
          </div>
        </div>
      </div>

      <div className="pc-dock-nav-wrap">
        <p className="pc-dock-nav-title">Navigation</p>
        <nav className="pc-dock-nav" aria-label="Platform">
          {!reduce && activeIndex >= 0 ? (
            <motion.div
              className="pc-dock-active-glow"
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              style={{ top: `calc(${activeIndex} * (3.15rem + 0.4rem))` }}
            />
          ) : null}
          {ROUTES.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={Boolean(item.end)}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `pc-dock-link ${isActive ? 'is-active' : ''}`}
            >
              <span className="pc-dock-index">{item.key}</span>
              <span className="pc-dock-icon">
                <item.icon className="h-[1.05rem] w-[1.05rem]" />
              </span>
              <span className="pc-dock-link-copy">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
              <span className="pc-dock-arrow" aria-hidden="true">
                →
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="pc-dock-bottom">
        <Link to={`${SUPER_BASE}/organizations`} className="pc-dock-cta" onClick={() => setOpen(false)}>
          <span className="pc-dock-cta-plus">+</span>
          <span>
            <strong>New tenant</strong>
            <small>Provision org</small>
          </span>
        </Link>

        <div className="pc-dock-user">
          <span className="pc-dock-avatar">{initials(account?.email)}</span>
          <div className="pc-dock-user-meta">
            <strong title={account?.email || ''}>{account?.email || 'platform'}</strong>
            <small>Superuser clearance</small>
          </div>
          <button type="button" className="pc-dock-logout" onClick={handleSignOut} title="Sign out">
            ⎋
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="platform-shell min-h-svh">
      <PlatformBackdrop />
      <div className="relative z-10 flex min-h-svh w-full">
        <AnimatePresence>
          {open ? (
            <motion.button
              type="button"
              className="fixed inset-0 z-30 bg-black/65 backdrop-blur-md md:hidden"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <aside
          className={`pc-dock-shell fixed inset-y-0 left-0 z-40 w-[18.5rem] p-3 transition-transform duration-300 ease-out md:static md:min-h-svh md:translate-x-0 md:p-4 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <motion.div
            className="h-full"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            {dock}
          </motion.div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pc-topbar sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 md:px-8">
            <button
              type="button"
              className="rounded-xl border border-[var(--pc-line)] bg-[var(--pc-surface)] px-3 py-2 text-sm font-semibold text-[var(--pc-text)] md:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <p className="m-0 hidden truncate font-mono text-[0.68rem] tracking-[0.16em] text-[var(--pc-muted)] uppercase md:block">
              Restricted · {account?.email || 'platform'}
            </p>
            <button type="button" className="btn btn-outline py-2 text-sm max-md:hidden" onClick={handleSignOut}>
              Sign out
            </button>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
