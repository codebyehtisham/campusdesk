import { ADMISSIONS_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

export default function AdmissionsPortalLayout() {
  return (
    <StaffPortalLayout
      base={ADMISSIONS_PORTAL_BASE}
      portalLabel="Admissions portal"
      homePath={`${ADMISSIONS_PORTAL_BASE}/admissions`}
      nav={[{ to: `${ADMISSIONS_PORTAL_BASE}/admissions`, label: 'Admissions' }]}
    />
  );
}
