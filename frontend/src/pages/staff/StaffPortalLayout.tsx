import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getStaff, signOutStaff } from '../../auth/staffSession';
import { roleLabel } from '../../data/roles';
import BrandMark from '../../components/BrandMark';

export default function StaffPortalLayout({ base, portalLabel, homePath, nav }) {
  const navigate = useNavigate();
  const staff = getStaff();
  const org = staff?.organization;
  const home = homePath || `${base}/home`;

  return (
    <div className="staff-shell faculty-shell min-h-svh bg-bg-alt">
      <div className="relative z-1 flex min-h-svh w-full">
        <aside className="staff-rail hidden w-72 flex-col p-5 text-white md:flex">
          <Link to={home} className="staff-rail-brand">
            <BrandMark org={org} size={48} className="ring-2 ring-white/20" />
            <span>
              <strong>{org?.title || org?.name || 'Campus'}</strong>
              <small>{portalLabel}</small>
            </span>
          </Link>
          <nav className="staff-nav mt-8">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to={`${base}/password`} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              Password
            </NavLink>
          </nav>
          <div className="staff-rail-foot mt-auto">
            <p className="m-0 text-sm text-white/80">{staff?.name}</p>
            <p className="m-0 text-xs text-white/60">{roleLabel(staff?.role)}</p>
            <button
              type="button"
              className="staff-rail-signout mt-3"
              onClick={() => {
                signOutStaff();
                navigate(base);
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 px-5 py-8 md:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
