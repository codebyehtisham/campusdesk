import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_BASE } from '../../admin/paths';
import { getAdmin, signInAdmin, signOutAdmin } from '../../auth/adminSession';
import { isLockedOrg, isSuspendedError } from '../../auth/serviceLock';
import { orgAdminNav } from '../../data/modules';
import api from '../../api/client';
import BrandMark from '../../components/BrandMark';
import CampusDeskMark from '../../components/CampusDeskMark';

export function RequireAdmin() {
  const admin = getAdmin();
  if (!admin?.token || admin.role !== 'admin') return <Navigate to={ADMIN_BASE} replace />;
  return <Outlet />;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(() => getAdmin());
  const [open, setOpen] = useState(false);
  const nav = orgAdminNav(admin?.modules || [], admin?.organization?.kind || 'education');

  useEffect(() => {
    setAdmin(getAdmin());
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;
    api
      .get('/admin/me', { authScope: 'admin' })
      .then((res) => {
        if (ignore || !res.data?.organization) return;
        const current = getAdmin();
        if (!current) return;
        signInAdmin({ ...current, organization: res.data.organization, modules: res.data.organization.modules || [] });
        setAdmin(getAdmin());
        if (isLockedOrg(res.data.organization)) {
          navigate(`${ADMIN_BASE}/suspended`, { replace: true });
        }
      })
      .catch((err) => {
        if (isSuspendedError(err)) {
          navigate(`${ADMIN_BASE}/suspended`, { replace: true });
          return;
        }
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOutAdmin();
          navigate(ADMIN_BASE, { replace: true });
        }
      });
    return () => {
      ignore = true;
    };
  }, [navigate]);

  const handleSignOut = () => {
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  return (
    <div className="min-h-svh bg-bg-alt">
      <div className="noise" aria-hidden="true" />
      <div className="relative z-1 mx-auto flex min-h-svh max-w-[1400px]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-[#0f5c5c] p-6 text-white transition-transform md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Link to={`${ADMIN_BASE}/dashboard`} className="mb-8 flex items-center gap-3">
            <CampusDeskMark size={48} className="ring-2 ring-white/20" />
            <span className="leading-tight">
              <strong className="block font-serif text-sm font-bold tracking-tight text-white">
                Campus Desk
              </strong>
              <small className="text-[0.65rem] font-medium text-white/70">
                {admin?.organization?.title || admin?.organization?.name || 'Admin console'}
              </small>
            </span>
          </Link>

          <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.18em] text-white/55 uppercase">Desk</p>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white text-[#0f5c5c]' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {open && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-[#0a3d3d]/45 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-5 py-3 backdrop-blur-xl md:px-8">
            <button
              type="button"
              className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-ink md:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <BrandMark org={admin?.organization} size={28} />
              <p className="m-0 truncate text-sm font-semibold text-ink">
                {admin?.organization?.title || admin?.email || 'Staff console'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {admin?.modules?.includes('careers') && (
                <a href="/careers" target="_blank" rel="noreferrer" className="hidden text-sm font-semibold text-cardinal sm:inline">
                  View public careers
                </a>
              )}
              <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 px-5 py-8 md:px-8 md:py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
