import { Navigate, Outlet } from 'react-router-dom';
import { getStaff } from '../../auth/staffSession';
import { portalPathForRole, PORTAL_META } from '../../data/roles';

export function StaffPortalGate({ portal }) {
  const staff = getStaff();
  const meta = PORTAL_META[portal];
  if (!staff?.token) return <Navigate to={meta.base} replace />;
  const expected = portalPathForRole(staff.role);
  if (!expected.startsWith(meta.base)) return <Navigate to={expected} replace />;
  return <Outlet />;
}
