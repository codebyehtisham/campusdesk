import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_BASE } from '../../admin/paths';
import { getAdmin, signInAdmin, signOutAdmin } from '../../auth/adminSession';
import { isLockedOrg, isSuspendedError } from '../../auth/serviceLock';
import { orgAdminNavGroups } from '../../data/modules';
import { adminNavIcon } from '../../components/nav/ConsoleIcons';
import api from '../../api/client';
import BrandMark from '../../components/BrandMark';

export function RequireAdmin() {
  const admin = getAdmin();
  if (!admin?.token || admin.role !== 'admin') return <Navigate to={ADMIN_BASE} replace />;
  return <Outlet />;
}

function initials(email?: string, name?: string) {
  const source = name || email || 'A';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(() => getAdmin());
  const [open, setOpen] = useState(false);
  const navGroups = orgAdminNavGroups(admin?.modules || []);
  const org = admin?.organization;
  const orgLabel = org?.title || org?.name || 'Organisation';

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

  const sidebar = (
    <>
      <Link to={`${ADMIN_BASE}/dashboard`} className="staff-rail-brand" onClick={() => setOpen(false)}>
        <BrandMark org={org} size={48} className="ring-2 ring-white/20" />
        <span>
          <strong>{orgLabel}</strong>
          <small>Admin console</small>
        </span>
      </Link>

      <div className="staff-nav-scroll">
        {navGroups.map((group) => (
          <div key={group.title} className="staff-nav-group">
            <p className="staff-nav-label">{group.title}</p>
            <nav className="staff-nav">
              {group.items.map((item) => {
                const Icon = adminNavIcon(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => (isActive ? 'is-active' : '')}
                  >
                    <span className="staff-nav-icon">
                      <Icon />
                    </span>
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="staff-rail-foot">
        <div className="staff-rail-user">
          <span className="staff-rail-avatar" aria-hidden="true">
            {initials(admin?.email, orgLabel)}
          </span>
          <div className="staff-rail-user-meta">
            <strong>{admin?.email || 'Admin'}</strong>
            <small>Organisation admin</small>
          </div>
        </div>
        <button type="button" className="staff-rail-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="staff-shell min-h-svh bg-bg-alt">
      <div className="noise" aria-hidden="true" />
      <div className="relative z-1 flex min-h-svh w-full">
        <aside
          className={`staff-rail fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-5 text-white transition-transform md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebar}
        </aside>

        {open && (
          <button
            type="button"
            className="staff-mobile-scrim fixed inset-0 z-30 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        )}

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
              <BrandMark org={org} size={28} />
              <p className="m-0 truncate text-sm font-semibold text-ink">{orgLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to={`${ADMIN_BASE}/portals`} className="hidden text-sm font-semibold text-cardinal sm:inline">
                Team portals
              </Link>
              {admin?.modules?.includes('careers') && (
                <a
                  href="/careers"
                  target="_blank"
                  rel="noreferrer"
                  className="hidden text-sm font-semibold text-cardinal sm:inline"
                >
                  View public careers
                </a>
              )}
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
