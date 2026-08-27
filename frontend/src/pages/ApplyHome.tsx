import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApplicantLogin from '../components/ApplicantLogin';
import BrandMark from '../components/BrandMark';
import usePublicBrand from '../brand/usePublicBrand';
import { getApplicant, signInApplicant, signOutApplicant } from '../auth/session';
import { isLockedOrg } from '../auth/serviceLock';
import api from '../api/client';

function InstitutePicker({ institutes, onSelect, loading, error, selecting }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return institutes;
    return institutes.filter(
      (org) =>
        org.title?.toLowerCase().includes(q) ||
        org.name?.toLowerCase().includes(q) ||
        org.slug?.toLowerCase().includes(q) ||
        org.tagline?.toLowerCase().includes(q)
    );
  }, [institutes, query]);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
      <div className="mb-8 text-center">
        <span className="eyebrow">Almost there</span>
        <h1 className="mt-3 mb-3 text-[clamp(2rem,5vw,3.2rem)] tracking-tight text-ink">
          Where are you applying?
        </h1>
        <p className="mx-auto m-0 max-w-lg text-lg text-text-muted">
          Choose your institute to open their admission form.
        </p>
      </div>

      <div className="glass glow-border rounded-[1.8rem] p-5 sm:p-7">
        <label className="mb-5 flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Search institutes
          <input
            type="search"
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or programme"
            autoFocus
            disabled={selecting}
          />
        </label>

        {loading ? (
          <p className="m-0 py-10 text-center text-text-muted">Finding open institutes…</p>
        ) : error ? (
          <p className="m-0 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <h3 className="mb-2">No open institutes</h3>
            <p className="m-0 text-text-muted">
              {query
                ? 'Try another search. Admissions may be closed for that college right now.'
                : 'No institutes are accepting applications at the moment. Please check back soon.'}
            </p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {filtered.map((org, i) => (
              <motion.li
                key={org.id || org.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.24) }}
              >
                <button
                  type="button"
                  disabled={selecting}
                  onClick={() => onSelect(org.slug)}
                  className="group flex w-full items-center gap-4 rounded-[1.35rem] border border-border bg-white/80 p-4 text-left transition hover:border-cardinal/35 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(15,92,92,0.55)] disabled:opacity-60"
                >
                  <BrandMark org={org} size={56} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate font-serif text-lg text-ink">
                      {org.title || org.name}
                    </strong>
                    <span className="mt-0.5 block truncate text-sm text-text-muted">
                      {org.tagline || org.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-cardinal opacity-80 transition group-hover:opacity-100">
                    {selecting ? '…' : 'Continue →'}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

export default function ApplyHome() {
  const brand = usePublicBrand();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const institute = String(searchParams.get('institute') || '').trim().toLowerCase();
  const [admissionsOpen, setAdmissionsOpen] = useState(true);
  const [orgBrand, setOrgBrand] = useState(null);
  const [loaded, setLoaded] = useState(!institute);
  const [step, setStep] = useState('auth'); // auth | pick
  const [institutes, setInstitutes] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (!institute) {
      setLoaded(true);
      return undefined;
    }
    const ctrl = new AbortController();
    api
      .get('/settings', {
        params: { institute },
        signal: ctrl.signal,
      })
      .then((res) => {
        setAdmissionsOpen(res.data?.admissionsOpen !== false);
        setOrgBrand(res.data?.organization || null);
      })
      .catch(() => setAdmissionsOpen(true))
      .finally(() => setLoaded(true));
    return () => ctrl.abort();
  }, [institute]);

  const loadInstitutes = () => {
    setPickerLoading(true);
    setPickerError('');
    api
      .get('/institutes')
      .then((res) => setInstitutes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPickerError('Could not load institutes. Please try again.'))
      .finally(() => setPickerLoading(false));
  };

  const goForm = (organization) => {
    if (isLockedOrg(organization)) {
      navigate('/apply/suspended', { replace: true });
      return;
    }
    navigate('/apply/form', { replace: true });
  };

  const handleAuthenticated = (payload) => {
    if (payload?.suspended) {
      navigate('/apply/suspended', { replace: true });
      return;
    }
    const org = payload?.organization || getApplicant()?.organization || null;
    if (institute) {
      goForm(org);
      return;
    }
    if (org?.slug) {
      goForm(org);
      return;
    }
    setStep('pick');
    loadInstitutes();
  };

  const handleSelectInstitute = async (slug) => {
    setSelecting(true);
    setPickerError('');
    try {
      const res = await api.post('/auth/select-institute', { institute: slug }, { authScope: 'applicant' });
      signInApplicant({
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
        token: res.data.token,
        organization: res.data.organization,
      });
      goForm(res.data.organization);
    } catch (err) {
      setPickerError(err.response?.data?.message || 'Could not open that institute.');
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (!err.response?.data?.code) {
          signOutApplicant();
          setStep('auth');
        }
      }
    } finally {
      setSelecting(false);
    }
  };

  const shownBrand = orgBrand || brand;

  return (
    <div className="relative min-h-svh overflow-hidden bg-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="orb top-16 left-[8%] h-64 w-64 bg-cardinal/20" />
      <div className="orb right-[10%] bottom-[12%] h-72 w-72 bg-cardinal-light/25" />

      <div className="relative z-1 flex min-h-svh items-center justify-center px-5 py-16">
        {step === 'pick' ? (
          <InstitutePicker
            institutes={institutes}
            loading={pickerLoading}
            error={pickerError}
            selecting={selecting}
            onSelect={handleSelectInstitute}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg"
          >
            <div className="mb-6 flex items-center gap-3 px-1">
              <BrandMark org={shownBrand} size={48} />
              <div className="leading-tight">
                <strong className="font-serif text-sm font-bold tracking-tight text-ink">
                  {institute
                    ? shownBrand.title || shownBrand.name || 'Campus Desk'
                    : 'Campus Desk'}
                </strong>
                <p className="m-0 text-[0.7rem] font-medium text-text-muted">
                  {institute ? `Admissions apply · ${institute}` : 'Admissions apply'}
                </p>
              </div>
            </div>

            {!loaded ? (
              <div className="glass rounded-[1.8rem] p-8 md:p-10">
                <p className="m-0 text-text-muted">Checking admissions status…</p>
              </div>
            ) : institute && !admissionsOpen ? (
              <div className="glass glow-border rounded-[1.8rem] p-8 md:p-10">
                <span className="eyebrow">Admissions</span>
                <h3>Admissions are closed now</h3>
                <p className="m-0 text-text-muted">
                  Applications are not being taken at the moment. Please check back when the next intake opens.
                </p>
              </div>
            ) : (
              <ApplicantLogin
                institute={institute}
                instituteLabel={shownBrand.title || shownBrand.name || institute}
                onAuthenticated={handleAuthenticated}
              />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
