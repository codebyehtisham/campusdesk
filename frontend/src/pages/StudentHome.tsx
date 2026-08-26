import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CampusDeskMark from '../components/CampusDeskMark';
import BrandMark from '../components/BrandMark';
import { getApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg } from '../auth/serviceLock';
import { CAMPUSDESK_NAME } from '../brand/product';

const tiles = [
  {
    to: '/student/attendance',
    title: 'Attendance',
    desc: 'Mark presence and review your day status.',
  },
  {
    to: '/student/courses',
    title: 'Courses & LMS',
    desc: 'Class materials, timetable, and learning links.',
  },
  {
    to: '/apply/form',
    title: 'Admissions',
    desc: 'Open or continue your admission application.',
  },
];

export default function StudentHome() {
  const navigate = useNavigate();
  const applicant = getApplicant();

  if (!applicant?.token) return <Navigate to="/login" replace />;
  if (isLockedOrg(applicant.organization)) return <Navigate to="/apply/suspended" replace />;

  const org = applicant.organization || {};

  const handleSignOut = () => {
    signOutApplicant();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-white">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col px-5 py-10">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <CampusDeskMark size={48} />
            <div className="leading-tight">
              <strong className="font-serif text-sm font-bold tracking-tight text-ink">{CAMPUSDESK_NAME}</strong>
              <p className="m-0 text-[0.7rem] font-medium text-text-muted">Student portal</p>
            </div>
          </div>
          <button type="button" className="btn btn-outline py-2 text-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </header>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <BrandMark org={org} size={44} />
            <div>
              <p className="m-0 text-sm text-text-muted">Signed in as</p>
              <h1 className="m-0 font-serif text-2xl font-bold text-ink">{applicant.name || applicant.email}</h1>
              <p className="m-0 text-sm text-text-muted">{org.title || org.name || 'Your campus'}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map((tile, index) => (
            <motion.div
              key={tile.to}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
            >
              <Link
                to={tile.to}
                className="glass block rounded-[1.4rem] p-6 no-underline transition hover:-translate-y-0.5"
              >
                <h3 className="m-0 font-serif text-lg font-bold text-ink">{tile.title}</h3>
                <p className="mt-2 mb-0 text-sm text-text-muted">{tile.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
