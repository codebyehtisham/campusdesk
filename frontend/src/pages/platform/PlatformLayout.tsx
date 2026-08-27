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

  return (
    <div className="platform-shell min-h-svh">
      <PlatformBackdrop />
      <div className="relative z-10 flex min-h-svh w-full">
        <AnimatePresence>
          {open ? (
            <motion.button
              type="button"
              className="fixed inset-0 z-30 bg-black/70 backdrop-blur-md md:hidden"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <div
          className={`pc-spine-shell fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-out md:static md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <PlatformSidebar
            email={account?.email}
            pathname={location.pathname}
            onNavigate={() => setOpen(false)}
            onSignOut={handleSignOut}
          />
        </div>

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
