import { FINANCE_PORTAL_BASE } from '../../admin/paths';
import StaffPortalLayout from '../staff/StaffPortalLayout';

export default function FinancePortalLayout() {
  return (
    <StaffPortalLayout
      base={FINANCE_PORTAL_BASE}
      portalLabel="Finance portal"
      homePath={`${FINANCE_PORTAL_BASE}/home`}
      nav={[{ to: `${FINANCE_PORTAL_BASE}/home`, label: 'Fees & finance' }]}
    />
  );
}
