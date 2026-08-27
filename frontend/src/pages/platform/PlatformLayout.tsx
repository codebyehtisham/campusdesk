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

const navGroups = [
  {
    title: 'Platform',
    items: [
      { to: `${SUPER_BASE}/dashboard`, label: 'Command', hint: 'Live ops hub', icon: IconDashboard },
      { to: `${SUPER_BASE}/organizations`, label: 'Tenants', hint: 'Campuses & hospitals', icon: IconBuildings },
      { to: `${SUPER_BASE}/modules`, label: 'Catalog', hint: 'Departments & modules', icon: IconSwitches },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: `${SUPER_BASE}/billing`, label: 'Billing', hint: 'MRR & invoices', icon: IconCard },
      { to: `${SUPER_BASE}/audit`, label: 'Traffic', hint: 'API request log', icon: IconPulse },
    ],
  },
  {
    title: 'Account',
    items: [{ to: `${SUPER_BASE}/settings`, label: 'Access', hint: 'Operator password', icon: IconKey }],
  },
];

function initials(email?: string) {
  const source = email || 'SA';
  return source.slice(0, 2).toUpperCase();
}

function NavItem({ item, onNavigate }: { item: (typeof navGroups)[0]['items'][0]; onNavigate: () => void }) {
  const reduce = useReducedMotion();

  return (
    <NavLink to={item.to} onClick={onNavigate} className={({ isActive }) => `pc-nav-link ${isActive ? 'is-active' : ''}`}>
      {({ isActive }) => (
        <>
          {isActive && !reduce ? (
            <motion.span layoutId="pc-nav-active" className="pc-nav-active-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          ) : null}
          <span className="pc-nav-icon">
            <item.icon />
          </span>
          <span className="pc-nav-copy">
            <strong>{item.label}</strong>
            <small>{item.hint}</small>
          </span>
          <span className="pc-nav-chevron" aria-hidden="true">
            ›
          </span>
        </>
      )}
    </NavLink>
  );
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

  const sidebar = (
    <>
      <Link to={`${SUPER_BASE}/dashboard`} className="pc-rail-brand" onClick={() => setOpen(false)}>
        <motion.span
          className="pc-mark pc-mark-glow"
          aria-hidden="true"
          whileHover={reduce ? undefined : { rotate: 6, scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          <IconDashboard />
        </motion.span>
        <span className="pc-brand-meta leading-tight">
          <strong>Campus Desk</strong>
          <small>Control plane</small>
        </span>
      </Link>

      <div className="pc-rail-status">
        <span className="pc-rail-status-pill is-live">
          <Pulse on />
          Systems live
        </span>
        <LiveClock className="pc-rail-clock" />
      </div>

      <div className="pc-nav-scroll">
        {navGroups.map((group, gi) => (
          <motion.div
            key={group.title}
            className="pc-nav-group"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + gi * 0.06, duration: 0.35, ease }}
          >
            <p className="pc-nav-label">{group.title}</p>
            <nav className="pc-nav">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          </motion.div>
        ))}
      </div>

      <div className="pc-rail-foot">
        <div className="pc-rail-user">
          <span className="pc-rail-avatar" aria-hidden="true">
            {initials(account?.email)}
          </span>
          <div className="pc-rail-user-meta">
            <strong>{account?.email || 'platform'}</strong>
            <small>Superuser · restricted</small>
          </div>
        </div>
        <div className="pc-rail-actions">
          <Link to={`${SUPER_BASE}/organizations`} className="pc-rail-action" onClick={() => setOpen(false)}>
            + Tenant
          </Link>
          <button type="button" className="pc-rail-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="platform-shell min-h-svh">
      <PlatformBackdrop />
      <div className="relative z-10 flex min-h-svh w-full">
        <AnimatePresence>
          {open ? (
            <motion.button
              type="button"
              className="fixed inset-0 z-30 bg-black/55 backdrop-blur-md md:hidden"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <aside
          className={`pc-rail pc-rail-premium fixed inset-y-0 left-0 z-40 flex w-[17.5rem] flex-col p-4 transition-transform duration-300 ease-out md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pc-topbar sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 md:px-8">
            <button
              type="button"
              className="rounded-[10px] border border-[var(--pc-line)] px-3 py-2 text-sm font-semibold text-[var(--pc-text)] md:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
              <p className="m-0 truncate font-mono text-[0.72rem] tracking-wide text-[var(--pc-muted)]">
                {account?.email || 'platform'} · restricted
              </p>
              <LiveClock className="pc-live-clock" />
            </div>
            <button type="button" className="btn btn-outline py-2 text-sm max-md:hidden" onClick={handleSignOut}>
              Sign out
            </button>
          </header>
          <main className="flex-1 px-5 py-7 md:px-8 md:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease }}
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
