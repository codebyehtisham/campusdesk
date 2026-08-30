import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FACULTY_BASE } from '../../admin/paths';
import { getStaff, signInStaff, signOutStaff } from '../../auth/staffSession';
import { isLockedOrg, isSuspendedError } from '../../auth/serviceLock';
import { roleLabel, isTeacher, staffHome } from '../../data/roles';
import api from '../../api/client';
import BrandMark from '../../components/BrandMark';
import NotificationBell from '../../components/NotificationBell';

export function RequireStaff() {
  const staff = getStaff();
  if (!staff?.token) return <Navigate to={FACULTY_BASE} replace />;
  return <Outlet />;
}

function initials(name?: string, email?: string) {
  const source = name || email || 'F';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const ease = [0.22, 1, 0.36, 1] as const;

function NavItem({ to, label, icon: Icon, onNavigate }: { to: string; label: string; icon: typeof IconAdmissions; onNavigate: () => void }) {
  const reduce = useReducedMotion();
  return (
    <NavLink to={to} onClick={onNavigate} className={({ isActive }) => (isActive ? 'is-active' : '')}>
      {({ isActive }) => (
        <>
          {isActive && !reduce ? (
            <motion.span layoutId="faculty-nav-active" className="staff-nav-active-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          ) : null}
          <span className="relative z-1 flex items-center gap-2">
            <span className="staff-nav-icon">
              <Icon />
            </span>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function IconAdmissions() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTimetable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCourses() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconAttendance() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 15h8M16 15v3M20 15v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function FacultyLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [staff, setStaff] = useState(() => getStaff());
  const [open, setOpen] = useState(false);
  const org = staff?.organization;

  useEffect(() => {
    setStaff(getStaff());
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;
    api
      .get('/staff/me', { authScope: 'staff' })
      .then((res) => {
        if (ignore || !res.data?.organization) return;
        const current = getStaff();
        if (!current) return;
        signInStaff({ ...current, organization: res.data.organization, modules: res.data.organization.modules || [] });
        setStaff(getStaff());
        if (isLockedOrg(res.data.organization)) {
          navigate(`${FACULTY_BASE}/suspended`, { replace: true });
        }
      })
      .catch((err) => {
        if (ignore) return;
        if (isSuspendedError(err)) {
          navigate(`${FACULTY_BASE}/suspended`, { replace: true });
          return;
        }
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOutStaff();
          navigate(FACULTY_BASE, { replace: true });
        }
      });
    return () => {
      ignore = true;
    };
  }, [navigate]);

  const handleSignOut = () => {
    signOutStaff();
    navigate(FACULTY_BASE, { replace: true });
  };

  const teaching = isTeacher(staff?.role);
  const home = staffHome(staff?.role, staff?.modules);
  const orgLabel = org?.title || org?.name || 'Faculty';

  const navItems = [
    ...(teaching
      ? [
          { to: `${FACULTY_BASE}/timetable`, label: 'Timetable', icon: IconTimetable },
          { to: `${FACULTY_BASE}/courses`, label: 'Courses', icon: IconCourses },
          { to: `${FACULTY_BASE}/attendance`, label: 'Attendance', icon: IconAttendance },
        ]
      : []),
    { to: `${FACULTY_BASE}/leave`, label: 'Leave', icon: IconAdmissions },
    { to: `${FACULTY_BASE}/password`, label: 'Password', icon: IconKey },
  ];

  const sidebar = (
    <>
      <Link to={home} className="staff-rail-brand" onClick={() => setOpen(false)}>
        <BrandMark org={org} size={48} className="ring-2 ring-white/20" />
        <span>
          <strong>{orgLabel}</strong>
          <small>Faculty portal</small>
        </span>
      </Link>

      <p className="faculty-rail-live mb-5">
        <span className="faculty-pulse" aria-hidden="true" />
        {roleLabel(staff?.role)} access
      </p>

      <div className="staff-nav-scroll">
        <div className="staff-nav-group">
          <p className="staff-nav-label">Workspace</p>
          <nav className="staff-nav">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={() => setOpen(false)} />
            ))}
          </nav>
        </div>
      </div>

      <div className="staff-rail-foot">
        <div className="staff-rail-user">
          <span className="staff-rail-avatar" aria-hidden="true">
            {initials(staff?.name, staff?.email)}
          </span>
          <div className="staff-rail-user-meta">
            <strong>{staff?.name || staff?.email || 'Staff'}</strong>
            <small>{roleLabel(staff?.role)}</small>
          </div>
        </div>
        <button type="button" className="staff-rail-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="staff-shell faculty-shell min-h-svh bg-bg-alt">
      <div className="faculty-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="relative z-1 flex min-h-svh w-full">
        <AnimatePresence>
          {open ? (
            <motion.button
              type="button"
              className="staff-mobile-scrim fixed inset-0 z-30 backdrop-blur-sm md:hidden"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <aside
          className={`staff-rail fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-5 transition-transform duration-300 ease-out md:static md:min-h-svh md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="faculty-topbar sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 md:px-8">
            <button
              type="button"
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-ink md:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <p className="m-0 hidden truncate text-sm font-semibold text-ink md:block">{orgLabel}</p>
            <div className="flex items-center gap-3">
              <NotificationBell authScope="staff" />
              <span className="hidden text-sm text-text-muted lg:block">
                {staff?.name || staff?.email} · {roleLabel(staff?.role, org?.kind)}
              </span>
              <button type="button" className="btn btn-outline py-2 text-sm max-md:hidden" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </header>

          <main className="flex-1 px-5 py-7 md:px-8 md:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
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
