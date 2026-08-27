import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import CampusDeskMark from '../components/CampusDeskMark';
import { getApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import { CAMPUSDESK_NAME } from '../brand/product';
import api from '../api/client';

const copy: Record<string, { title: string; body: string }> = {
  attendance: {
    title: 'Attendance',
    body: 'Student attendance check-in will open here. For now, your teachers mark class presence from the faculty portal.',
  },
  courses: {
    title: 'Courses & LMS',
    body: 'Course materials and timetable views for students will live here. Faculty already publish content from the campus LMS tools.',
  },
};

export default function StudentSection() {
  const { section } = useParams();
  const navigate = useNavigate();
  const applicant = getApplicant();
  const meta = copy[section || ''] || null;
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!applicant?.token) return;
    api
      .get('/applications/me', { authScope: 'applicant' })
      .then((res) => setAccepted(res.data?.status === 'accepted'))
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
      .finally(() => setReady(true));
  }, [applicant?.token, navigate]);

  if (!applicant?.token) return <Navigate to="/login" replace />;
  if (isLockedOrg(applicant.organization)) return <Navigate to="/apply/suspended" replace />;
  if (!meta) return <Navigate to="/student" replace />;
  if (ready && !accepted) return <Navigate to="/student" replace />;

  return (
    <div className="relative min-h-svh overflow-hidden bg-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5 py-16">
        <div className="mb-6 flex items-center gap-3">
          <CampusDeskMark size={44} />
          <div className="leading-tight">
            <strong className="font-serif text-sm font-bold text-ink">{CAMPUSDESK_NAME}</strong>
            <p className="m-0 text-[0.7rem] text-text-muted">Student portal</p>
          </div>
        </div>
        <div className="glass rounded-[1.8rem] p-8">
          <span className="eyebrow">Coming soon</span>
          <h3 className="mt-1">{meta.title}</h3>
          <p className="mb-6 text-text-muted">{meta.body}</p>
          <Link to="/student" className="btn btn-primary">
            Back to portal
          </Link>
        </div>
      </div>
    </div>
  );
}
