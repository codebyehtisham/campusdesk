import { useNavigate } from 'react-router-dom';
import { signOutStaff } from '../../auth/staffSession';
import { LIBRARY_PORTAL_BASE } from '../../admin/paths';

export const staffReq = { authScope: 'staff' };
export const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export function useLibraryKickOut() {
  const navigate = useNavigate();
  return () => {
    signOutStaff();
    navigate(LIBRARY_PORTAL_BASE, { replace: true });
  };
}
