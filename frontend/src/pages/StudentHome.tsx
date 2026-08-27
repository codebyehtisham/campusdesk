import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CampusDeskMark from '../components/CampusDeskMark';
import BrandMark from '../components/BrandMark';
import { getApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import { CAMPUSDESK_NAME } from '../brand/product';
import api from '../api/client';

export default function StudentHome() {
  const navigate = useNavigate();
  const [applicant] = useState(() => getApplicant());
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = getApplicant();
    if (!current?.token) {
      navigate('/login', { replace: true });
      return;
    }
    if (isLockedOrg(current.organization)) {
      navigate('/apply/suspended', { replace: true });
      return;
    }
    api
      .get('/applications/me', { authScope: 'applicant' })
      .then((res) => setStatus(res.data?.status || ''))
      .catch((err) => {
        if (isSuspendedError(err)) {
          navigate('/apply/suspended', { replace: true });
          return;
        }
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOutApplicant();
          navigate('/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (!applicant?.token) return <Navigate to="/login" replace />;
  if (isLockedOrg(applicant.organization)) return <Navigate to="/apply/suspended" replace />;

  const org = applicant.organization || {};
  const accepted = status === 'accepted';

  const handleSignOut = () => {
    signOutApplicant();
    navigate('/login', { replace: true });
  };

  const tiles = [
    {
      to: '/student/attendance',
      title: 'Attendance',
      desc: accepted
        ? 'Mark presence and review your day status.'
        : 'Available after your admission is accepted.',
      locked: !accepted,
    },
    {
      to: '/student/courses',
      title: 'Courses & LMS',
      desc: accepted
        ? 'Class materials, timetable, and learning links.'
        : 'Available after your admission is accepted and you are placed in classes.',
      locked: !accepted,
    },
    {
      to: '/apply/form',
      title: 'Admissions',
      desc:
        status === 'submitted'
          ? 'Your application is with an admissions officer.'
          : status === 'accepted'
            ? 'You are accepted. Keep this link for your application record.'
            : 'Open or continue your admission application.',
      locked: false,
    },
  ];

  return (
    <div className="relative min-h-svh overflow-hidden bg-bg">
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
          {!loading && (
            <p className="m-0 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-semibold text-cardinal">
              Admission status · {status ? status.replace('_', ' ') : 'unknown'}
              {!accepted
                ? ' — LMS and attendance unlock after an officer accepts your application.'
                : ' — You can use attendance and LMS once your classes are assigned.'}
            </p>
          )}
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map((tile, index) => (
            <motion.div
              key={tile.to}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
            >
              {tile.locked ? (
                <div className="glass rounded-[1.4rem] p-6 opacity-70">
                  <h3 className="m-0 font-serif text-lg font-bold text-ink">{tile.title}</h3>
                  <p className="mt-2 mb-0 text-sm text-text-muted">{tile.desc}</p>
                  <p className="mt-3 mb-0 text-xs font-bold tracking-wide text-text-muted uppercase">Locked</p>
                </div>
              ) : (
                <Link
                  to={tile.to}
                  className="glass block rounded-[1.4rem] p-6 no-underline transition hover:-translate-y-0.5"
                >
                  <h3 className="m-0 font-serif text-lg font-bold text-ink">{tile.title}</h3>
                  <p className="mt-2 mb-0 text-sm text-text-muted">{tile.desc}</p>
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
