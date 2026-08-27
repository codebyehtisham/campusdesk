import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import { PlatformBackdrop, ease } from './motion';
import PlatformSidebar from './PlatformSidebar';

export function RequirePlatform() {
  const account = getPlatform();
  if (!account?.token || account.role !== 'superadmin') return <Navigate to={SUPER_BASE} replace />;
  return <Outlet />;
}

function initials(email?: string, name?: string) {
  const source = (name || email || 'SA').split('@')[0];
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
  const [query, setQuery] = useState('');

  useEffect(() => {
    setAccount(getPlatform());
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleSignOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  const handleSearch = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    if (q.includes('bill') || q.includes('invoice') || q.includes('mrr')) {
      navigate(`${SUPER_BASE}/billing`);
    } else if (q.includes('module') || q.includes('catalog')) {
      navigate(`${SUPER_BASE}/modules`);
    } else if (q.includes('audit') || q.includes('traffic') || q.includes('log')) {
      navigate(`${SUPER_BASE}/audit`);
    } else if (q.includes('access') || q.includes('password') || q.includes('setting')) {
      navigate(`${SUPER_BASE}/settings`);
    } else {
      navigate(`${SUPER_BASE}/organizations`);
    }
    setQuery('');
  };

  return (
    <div className="platform-shell min-h-svh">
      <PlatformBackdrop />
      <div className="relative z-10 flex min-h-svh w-full">
        <AnimatePresence>
          {open ? (
            <motion.button
              type="button"
              className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm md:hidden"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <div
          className={`pc-nav-shell fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-out md:static md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <PlatformSidebar
            email={account?.email}
            name={account?.name}
            pathname={location.pathname}
            onNavigate={() => setOpen(false)}
            onSignOut={handleSignOut}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pc-topbar">
            <div className="pc-topbar-left">
              <button
                type="button"
                className="pc-topbar-icon-btn md:hidden"
                aria-label="Open menu"
                onClick={() => setOpen(true)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              </button>
              <form className="pc-topbar-search" onSubmit={handleSearch}>
                <svg viewBox="0 0 24 24" className="pc-topbar-search-icon" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tenants, billing, modules…"
                  aria-label="Search platform"
                />
                <kbd className="pc-topbar-kbd">⌘K</kbd>
              </form>
            </div>

            <div className="pc-topbar-right">
              <span className="pc-topbar-chip max-md:hidden">Restricted</span>
              <button type="button" className="pc-topbar-icon-btn" title="Notifications" aria-label="Notifications">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
                </svg>
                <span className="pc-topbar-dot" />
              </button>
              <button type="button" className="pc-topbar-icon-btn max-md:hidden" title="Settings" onClick={() => navigate(`${SUPER_BASE}/settings`)}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="pc-topbar-user" onClick={handleSignOut} title="Sign out">
                <span className="pc-topbar-avatar">{initials(account?.email, account?.name)}</span>
              </button>
            </div>
          </header>

          <main className="pc-main flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease }}
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
