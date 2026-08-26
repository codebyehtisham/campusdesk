import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FACULTY_BASE } from '../../admin/paths';
import { getStaff, signOutStaff, signInStaff } from '../../auth/staffSession';
import { isLockedOrg, isSuspendedError } from '../../auth/serviceLock';
import { roleLabel, isTeacher, staffHome } from '../../data/roles';
import api from '../../api/client';
import BrandMark from '../../components/BrandMark';

export function RequireStaff() {
  const staff = getStaff();
  if (!staff?.token) return <Navigate to={FACULTY_BASE} replace />;
  return <Outlet />;
}

export default function FacultyLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [staff, setStaff] = useState(() => getStaff());

  useEffect(() => {
    setStaff(getStaff());
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;
    api.get('/staff/me', { authScope: 'staff' }).then((res) => {
      if (ignore || !res.data?.organization) return;
      const current = getStaff();
      if (!current) return;
      signInStaff({ ...current, organization: res.data.organization, modules: res.data.organization.modules || [] });
      setStaff(getStaff());
      if (isLockedOrg(res.data.organization)) {
        navigate(`${FACULTY_BASE}/suspended`, { replace: true });
      }
    }).catch((err) => {
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

  const hasAdmissions = Boolean(staff?.modules?.includes('admissions')) && !isTeacher(staff?.role);
  const teaching = isTeacher(staff?.role);
  const home = staffHome(staff?.role, staff?.modules);

  return (
    <div className="min-h-svh bg-bg-alt">
      <div className="noise" aria-hidden="true" />
      <div className="relative z-1 mx-auto flex min-h-svh max-w-[1400px] flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-5 py-3 backdrop-blur-xl md:px-8">
          <Link to={home} className="flex items-center gap-3">
            <BrandMark org={staff?.organization} size={48} />
            <span className="leading-tight">
              <strong className="block font-serif text-sm font-bold tracking-tight text-ink">
                {staff?.organization?.title || staff?.organization?.name || 'Faculty'}
              </strong>
              <small className="text-[0.65rem] font-medium text-text-muted">
                {staff?.organization?.kind === 'hospital' ? 'Staff portal' : 'Faculty portal'}
              </small>
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {teaching && (
              <>
                <NavLink
                  to={`${FACULTY_BASE}/timetable`}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive ? 'bg-cardinal-pale text-cardinal' : 'text-text-muted'
                    }`
                  }
                >
                  Timetable
                </NavLink>
                <NavLink
                  to={`${FACULTY_BASE}/courses`}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive ? 'bg-cardinal-pale text-cardinal' : 'text-text-muted'
                    }`
                  }
                >
                  Courses
                </NavLink>
                <NavLink
                  to={`${FACULTY_BASE}/attendance`}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive ? 'bg-cardinal-pale text-cardinal' : 'text-text-muted'
                    }`
                  }
                >
                  Attendance
                </NavLink>
              </>
            )}
            {hasAdmissions && (
              <NavLink
                to={`${FACULTY_BASE}/admissions`}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold ${
                    isActive ? 'bg-cardinal-pale text-cardinal' : 'text-text-muted'
                  }`
                }
              >
                Admissions
              </NavLink>
            )}
            <NavLink
              to={`${FACULTY_BASE}/password`}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold ${
                  isActive ? 'bg-cardinal-pale text-cardinal' : 'text-text-muted'
                }`
              }
            >
              Password
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-text-muted md:block">
              {staff?.name || staff?.email} · {roleLabel(staff?.role, staff?.organization?.kind)}
            </span>
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
  );
}
