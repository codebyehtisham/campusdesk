import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import CampusDeskMark from '../../components/CampusDeskMark';
import PlatformSidebar from './PlatformSidebar';

export function RequirePlatform() {
  const account = getPlatform();
  if (!account?.token || account.role !== 'superadmin') return <Navigate to={SUPER_BASE} replace />;
  return <Outlet />;
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
    <div className="staff-shell platform-shell min-h-svh bg-bg-alt">
      <div className="noise" aria-hidden="true" />
      <div className="relative z-1 flex min-h-svh w-full">
        <aside
          className={`staff-rail fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-5 text-white transition-transform md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <PlatformSidebar
            email={account?.email}
            name={account?.name}
            onNavigate={() => setOpen(false)}
            onSignOut={handleSignOut}
          />
        </aside>

        {open ? (
          <button
            type="button"
            className="staff-mobile-scrim fixed inset-0 z-30 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-5 py-3 backdrop-blur-xl md:px-8 lg:px-10">
            <button
              type="button"
              className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-ink md:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <CampusDeskMark size={28} />
              <p className="m-0 truncate text-sm font-semibold text-ink">Campus Desk Platform</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-border bg-paper px-3 py-1 text-xs font-semibold text-text-muted sm:inline">
                Super admin
              </span>
              <button type="button" className="btn btn-outline py-2.5 text-sm max-md:hidden" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-8 md:px-8 md:py-10 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
