import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import PlatformSidebar from './PlatformSidebar';
import { AnimatePresence, LiveClock, PageEnter, PxBackdrop } from './motion';
import { Pulse } from './ui';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  organizations: 'Tenants',
  modules: 'Catalog',
  billing: 'Billing',
  audit: 'Traffic',
  settings: 'Access',
};

function breadcrumb(pathname: string) {
  const segment = pathname.replace(`${SUPER_BASE}/`, '').split('/')[0] || 'dashboard';
  return ROUTE_LABELS[segment] || 'Console';
}

export function RequirePlatform() {
  const account = getPlatform();
  if (!account?.token || account.role !== 'superadmin') return <Navigate to={SUPER_BASE} replace />;
  return <Outlet />;
}

export default function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState(() => getPlatform());
  const [drawer, setDrawer] = useState(false);
  const page = useMemo(() => breadcrumb(location.pathname), [location.pathname]);

  useEffect(() => {
    setAccount(getPlatform());
    setDrawer(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleSignOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  return (
    <div className="platform-console platform-shell">
      <PxBackdrop />
      <div className="px-shell">
        <PlatformSidebar
          email={account?.email}
          name={account?.name}
          onNavigate={() => setDrawer(false)}
          onSignOut={handleSignOut}
        />

        {drawer ? (
          <div className="px-mobile-drawer">
            <button type="button" className="flex-1" aria-label="Close menu" onClick={() => setDrawer(false)} />
            <aside>
              <PlatformSidebar
                mobile
                email={account?.email}
                name={account?.name}
                onNavigate={() => setDrawer(false)}
                onSignOut={handleSignOut}
              />
            </aside>
          </div>
        ) : null}

        <div className="px-stage">
          <header className="px-command-bar">
            <div className="px-command-left">
              <button type="button" className="px-mobile-menu" onClick={() => setDrawer(true)}>
                Menu
              </button>
              <p className="px-breadcrumb">
                campus desk / <strong>{page}</strong>
              </p>
              <span className="px-command-status max-sm:hidden">
                <Pulse on tone="live" />
                Online
              </span>
            </div>
            <div className="px-command-right">
              <span className="px-command-clock max-md:hidden">
                <LiveClock />
              </span>
              <span className="px-command-chip max-sm:hidden">Super admin</span>
            </div>
          </header>

          <main className="px-main">
            <AnimatePresence mode="wait">
              <PageEnter key={location.pathname}>
                <Outlet />
              </PageEnter>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
