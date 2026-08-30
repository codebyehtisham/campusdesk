import { HR_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

const nav = [
  { to: `${HR_PORTAL_BASE}/careers`, label: 'Careers' },
  { to: `${HR_PORTAL_BASE}/attendance`, label: 'Staff attendance' },
];

export default function HrPortalLayout() {
  return <StaffPortalLayout base={HR_PORTAL_BASE} portalLabel="HR portal" homePath={`${HR_PORTAL_BASE}/careers`} nav={nav} />;
}
