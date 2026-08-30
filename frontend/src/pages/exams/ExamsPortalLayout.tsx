import { EXAMS_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

export default function ExamsPortalLayout() {
  return (
    <StaffPortalLayout
      base={EXAMS_PORTAL_BASE}
      portalLabel="Exams portal"
      homePath={`${EXAMS_PORTAL_BASE}/home`}
      nav={[{ to: `${EXAMS_PORTAL_BASE}/home`, label: 'Exams & results' }]}
    />
  );
}
