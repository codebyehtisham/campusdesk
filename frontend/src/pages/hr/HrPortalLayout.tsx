import { HR_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

const nav = [
  { to: `${HR_PORTAL_BASE}/careers`, label: 'Careers', end: false },
  { to: `${HR_PORTAL_BASE}/attendance`, label: 'Staff attendance', end: false },
  { to: `${HR_PORTAL_BASE}/leaves`, label: 'Leave requests', end: true },
  { to: `${HR_PORTAL_BASE}/calendar`, label: 'Attendance calendar', end: true },
];

export default function HrPortalLayout() {
  return <StaffPortalLayout base={HR_PORTAL_BASE} portalLabel="HR portal" homePath={`${HR_PORTAL_BASE}/careers`} nav={nav} />;
}
