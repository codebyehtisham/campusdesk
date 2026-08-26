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
  const org = staff?.organization;

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
      <div className="relative z-1 flex min-h-svh w-full flex-col">
        <header className="sticky top-0 z-20 flex w-full items-center justify-between gap-3 border-b border-white/10 bg-[#0f5c5c] px-5 py-3 text-white md:px-8 lg:px-10">
          <Link to={home} className="flex min-w-0 items-center gap-3">
            <BrandMark org={org} size={44} className="ring-2 ring-white/20" />
            <span className="min-w-0 leading-tight">
              <strong className="block truncate font-serif text-sm font-bold tracking-tight text-white">
                {org?.title || org?.name || 'Faculty'}
              </strong>
              <small className="text-[0.65rem] font-medium text-white/70">
                {org?.kind === 'hospital' ? 'Staff portal' : 'Faculty portal'}
              </small>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {teaching && (
              <>
                <NavLink
                  to={`${FACULTY_BASE}/timetable`}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive ? 'bg-white text-[#0f5c5c]' : 'text-white/75 hover:text-white'
                    }`
                  }
                >
                  Timetable
                </NavLink>
                <NavLink
                  to={`${FACULTY_BASE}/courses`}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive ? 'bg-white text-[#0f5c5c]' : 'text-white/75 hover:text-white'
                    }`
                  }
                >
                  Courses
                </NavLink>
                <NavLink
                  to={`${FACULTY_BASE}/attendance`}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive ? 'bg-white text-[#0f5c5c]' : 'text-white/75 hover:text-white'
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
                    isActive ? 'bg-white text-[#0f5c5c]' : 'text-white/75 hover:text-white'
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
                  isActive ? 'bg-white text-[#0f5c5c]' : 'text-white/75 hover:text-white'
                }`
              }
            >
              Password
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 xl:block">
              {staff?.name || staff?.email} · {roleLabel(staff?.role, org?.kind)}
            </span>
            <button
              type="button"
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-8 md:px-8 md:py-10 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
