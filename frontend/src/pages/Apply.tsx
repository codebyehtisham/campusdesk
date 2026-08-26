import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '../components/PageHero';
import Reveal from '../components/Reveal';
import { getApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import api from '../api/client';

const sections = [
  {
    n: '01',
    title: 'Personal information',
    desc: 'Name, CNIC, contacts, and guardian details.',
  },
  {
    n: '02',
    title: 'Program choice',
    desc: 'Nursing or allied health — diploma, degree, or bridging.',
  },
  {
    n: '03',
    title: 'Academic record',
    desc: 'Matric and FSc results or certificates.',
  },
  {
    n: '04',
    title: 'Documents',
    desc: 'Passport-size photo, CNIC, matric result/certificate, and FSc result/certificate.',
  },
];

export default function Apply() {
  const navigate = useNavigate();
  const [applicant, setApplicant] = useState(() => getApplicant());
  const [appStatus, setAppStatus] = useState('not_started');

  useEffect(() => {
    const current = getApplicant();
    if (!current?.token) {
      navigate('/apply', { replace: true });
      return;
    }
    if (isLockedOrg(current.organization)) {
      navigate('/apply/suspended', { replace: true });
      return;
    }
    setApplicant(current);
    api
      .get('/applications/me', { authScope: 'applicant' })
      .then((res) => {
        if (res.data?.status) setAppStatus(res.data.status);
      })
      .catch((err) => {
        if (isSuspendedError(err)) {
          navigate('/apply/suspended', { replace: true });
          return;
        }
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOutApplicant();
          navigate('/apply', { replace: true });
        }
      });
  }, [navigate]);

  if (!applicant) return null;

  const handleSignOut = () => {
    signOutApplicant();
    navigate('/apply');
  };

  return (
    <>
      <PageHero
        eyebrow="Admissions portal"
        title="Your admission application"
        subtitle="You are signed in. Complete each part when the form opens — your account is saved."
        image="/images/campus/photos/nursing-skills-lab.jpg"
      />

      <section className="section pt-0">
        <div className="container">
          <Reveal className="glass mb-10 flex flex-col justify-between gap-6 rounded-[1.8rem] p-8 md:flex-row md:items-center md:p-10">
            <div>
              <span className="eyebrow">Signed in</span>
              <h2 className="mb-2">{applicant.name || 'Applicant'}</h2>
              <p className="m-0 text-text-muted">{applicant.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-cardinal-pale px-4 py-2 text-sm font-bold text-cardinal">
                Status · {appStatus.replace('_', ' ')}
              </span>
              <button type="button" className="btn btn-outline-light" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </Reveal>

          <Reveal className="section-head">
            <span className="eyebrow">Application</span>
            <h2>Four parts. One seat.</h2>
            <p>Each section will open as a real form. For now this is the placeholder so you can see the student path after login.</p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {sections.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.06} className="glass rounded-[1.6rem] p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className={`font-serif text-4xl font-extrabold ${i % 2 === 0 ? 'text-crimson' : 'text-cardinal'}`}>
                    {s.n}
                  </span>
                  <span className="rounded-full border border-cardinal/20 px-3 py-1 text-xs font-bold tracking-wide text-text-muted uppercase">
                    Coming soon
                  </span>
                </div>
                <h3>{s.title}</h3>
                <p className="m-0 text-text-muted">{s.desc}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10 text-center">
            <button type="button" className="btn btn-primary px-10 py-4 text-base" disabled>
              Submit application — connecting soon
            </button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
