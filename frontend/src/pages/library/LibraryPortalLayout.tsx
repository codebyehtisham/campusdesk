import { LIBRARY_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

const nav = [
  { to: `${LIBRARY_PORTAL_BASE}/catalog`, label: 'Catalog', end: true },
  { to: `${LIBRARY_PORTAL_BASE}/issue`, label: 'Issue book', end: true },
  { to: `${LIBRARY_PORTAL_BASE}/loans`, label: 'Loans', end: true },
];

export default function LibraryPortalLayout() {
  return (
    <StaffPortalLayout
      base={LIBRARY_PORTAL_BASE}
      portalLabel="Library portal"
      homePath={`${LIBRARY_PORTAL_BASE}/catalog`}
      nav={nav}
    />
  );
}
