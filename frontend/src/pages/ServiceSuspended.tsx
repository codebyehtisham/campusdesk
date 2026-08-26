import { useNavigate } from 'react-router-dom';
import { ADMIN_BASE, FACULTY_BASE } from '../admin/paths';
import { getAdmin, signOutAdmin } from '../auth/adminSession';
import { getStaff, signOutStaff } from '../auth/staffSession';
import { getApplicant, signOutApplicant } from '../auth/session';
import { SUSPENDED_COPY } from '../auth/serviceLock';
import BrandMark from '../components/BrandMark';

export default function ServiceSuspended({ portal }) {
  const navigate = useNavigate();
  const organization =
    portal === 'admin' ? getAdmin()?.organization : portal === 'faculty' ? getStaff()?.organization : getApplicant()?.organization;
  const home = portal === 'faculty' ? FACULTY_BASE : portal === 'admin' ? ADMIN_BASE : '/admissions';

  const handleSignOut = () => {
    if (portal === 'admin') signOutAdmin();
    else if (portal === 'faculty') signOutStaff();
    else signOutApplicant();
    navigate(home, { replace: true });
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-white">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="flex min-h-svh items-center justify-center px-5 py-16">
        <div className="glass glow-border w-full max-w-lg rounded-[1.8rem] p-8 text-center md:p-12">
          <div className="mb-6 flex justify-center">
            <BrandMark org={organization} size={56} />
          </div>
          <span className="eyebrow">Access paused</span>
          <h1 className="mb-3 text-[clamp(1.8rem,4vw,2.6rem)]">Services suspended</h1>
          <p className="mb-2 text-lg font-semibold text-ink">{SUSPENDED_COPY}</p>
          <p className="mb-8 text-text-muted">
            {organization?.name ? `${organization.name} cannot use campus services until this is resolved.` : 'Campus services are paused until this is resolved.'}
            {organization?.email ? ` Reach the provider at ${organization.email}.` : ''}
          </p>
          <button type="button" className="btn btn-primary" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
