import { LIBRARY_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

export default function LibraryPortalLayout() {
  return (
    <StaffPortalLayout
      base={LIBRARY_PORTAL_BASE}
      portalLabel="Library portal"
      homePath={`${LIBRARY_PORTAL_BASE}/home`}
      nav={[{ to: `${LIBRARY_PORTAL_BASE}/home`, label: 'Library' }]}
    />
  );
}
