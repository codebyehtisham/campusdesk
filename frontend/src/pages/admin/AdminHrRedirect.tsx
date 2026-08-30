import { Navigate } from 'react-router-dom';
import { HR_PORTAL_BASE } from '../../admin/paths';

/** Legacy org-admin HR screens now live in the HR portal. */
export default function AdminHrRedirect() {
  return <Navigate to={HR_PORTAL_BASE} replace />;
}
