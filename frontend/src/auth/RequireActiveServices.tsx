import { Navigate, Outlet } from 'react-router-dom';
import { getAdmin } from '../auth/adminSession';
import { getStaff } from '../auth/staffSession';
import { getApplicant } from '../auth/session';
import { isLockedOrg } from '../auth/serviceLock';
import { ADMIN_BASE, FACULTY_BASE } from '../admin/paths';

export function RequireActiveAdmin() {
  const admin = getAdmin();
  if (isLockedOrg(admin?.organization)) return <Navigate to={`${ADMIN_BASE}/suspended`} replace />;
  return <Outlet />;
}

export function RequireActiveStaff() {
  const staff = getStaff();
  if (isLockedOrg(staff?.organization)) return <Navigate to={`${FACULTY_BASE}/suspended`} replace />;
  return <Outlet />;
}

export function RequireActiveApplicant({ children }) {
  const applicant = getApplicant();
  if (isLockedOrg(applicant?.organization)) return <Navigate to="/apply/suspended" replace />;
  return children;
}
