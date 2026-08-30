import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import Magnetic from '../../components/Magnetic';
import CampusDeskMark from '../../components/CampusDeskMark';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signInPlatform } from '../../auth/platformSession';
import api from '../../api/client';
import { PlatformLoginBackdrop, RevealLines, ease, easeOut } from './motion';
import { Pulse } from './ui';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

const fieldVariants = {
  hidden: { opacity: 0, x: 18 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.4 + i * 0.09, duration: 0.48, ease: easeOut },
  }),
};

const TICKERS = ['Tenant fleet', 'Module catalog', 'Billing & MRR', 'Live telemetry', 'Audit trail'];

export default function PlatformLogin() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const existing = getPlatform();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticker, setTicker] = useState(0);

  if (existing) {
    return <Navigate to={`${SUPER_BASE}/dashboard`} replace />;
  }

  useEffect(() => {
    const id = window.setInterval(() => setTicker((n) => (n + 1) % TICKERS.length), 2800);
    return () => window.clearInterval(id);
  }, []);

  const handleChange = (e: { target: { name: string; value: string } }) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!form.email.trim() || form.password.length < 6) {
      setError('Enter the platform email and a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/platform/login', {
        email: form.email.trim(),
        password: form.password.trim(),
      });
      signInPlatform({
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
        role: res.data.user.role,
        token: res.data.token,
      });
      navigate(`${SUPER_BASE}/dashboard`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="platform-login-page relative min-h-svh overflow-hidden bg-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="hero-dots" aria-hidden="true" />
      <div className="orb top-16 left-[6%] h-72 w-72 bg-cardinal/25 platform-orb-drift" />
      <div className="orb right-[8%] bottom-[10%] h-80 w-80 bg-cardinal-light/30 platform-orb-drift is-slow" />

      <div className="relative z-1 grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden lg:block">
          <PlatformLoginBackdrop />
          <div className="absolute inset-0 bg-gradient-to-br from-[#e6f4f4] via-[#f2f8f8]/95 to-[#d4ecec]/80" />
          <div className="platform-login-shimmer" aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
            <motion.div
              className="flex items-center gap-3"
              initial={reduce ? false : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease }}
            >
              <CampusDeskMark size={48} className="platform-mark-float ring-2 ring-cardinal/15" />
              <div className="leading-tight">
                <strong className="font-serif text-sm font-bold tracking-tight text-ink">Campus Desk</strong>
                <p className="m-0 text-[0.7rem] font-medium text-text-muted">Platform control plane</p>
              </div>
            </motion.div>

            <div>
              <motion.p
                className="platform-login-badge mb-4 inline-flex items-center gap-2 rounded-full border border-cardinal/20 bg-cardinal-pale px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-cardinal"
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4, ease }}
              >
                <Pulse on tone="live" />
                Operator access only
              </motion.p>

              <RevealLines
                className="max-w-xl font-serif text-[clamp(2.2rem,4.5vw,3.6rem)] font-bold leading-[1.02] tracking-tight text-ink"
                lines={[
                  { text: 'Fleet command.' },
                  { text: 'Every campus,', accent: true },
                  { text: 'one console.' },
                ]}
              />

              <motion.p
                className="mt-5 max-w-md text-lg text-text-muted"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.45, ease }}
              >
                Provision tenants, ship modules, and watch billing — the same Campus Desk look, built for platform operators.
              </motion.p>

              <motion.p
                className="mt-6 font-mono text-xs font-semibold uppercase tracking-widest text-text-muted"
                key={ticker}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease }}
              >
                {TICKERS[ticker]}
              </motion.p>
            </div>

            <p className="m-0 text-sm text-text-muted">Restricted · not linked from public site</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-16 sm:px-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="platform-login-card glass glow-border w-full max-w-md rounded-[1.8rem] p-8 md:p-10"
          >
            <div className="platform-login-card-glow" aria-hidden="true" />

            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <CampusDeskMark size={48} />
              <div className="leading-tight">
                <strong className="font-serif text-sm font-bold text-ink">Campus Desk Platform</strong>
                <p className="m-0 text-[0.7rem] font-medium text-text-muted">Super admin</p>
              </div>
            </div>

            <motion.div
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-amber-800"
              custom={0}
              variants={fieldVariants}
              initial="hidden"
              animate="show"
            >
              <Pulse on tone="warn" />
              Platform gate
            </motion.div>

            <motion.h2 className="mb-2 font-serif text-2xl font-bold text-ink" custom={1} variants={fieldVariants} initial="hidden" animate="show">
              Sign in
            </motion.h2>
            <motion.p className="mb-6 text-sm text-text-muted" custom={2} variants={fieldVariants} initial="hidden" animate="show">
              Org admins use their own portal. This sign-in is for Campus Desk operators only.
            </motion.p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <motion.label className={labelClass} custom={3} variants={fieldVariants} initial="hidden" animate="show">
                Operator email
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="platform@explore.app"
                  className="field platform-login-field"
                  autoComplete="username"
                />
              </motion.label>

              <motion.label className={labelClass} custom={4} variants={fieldVariants} initial="hidden" animate="show">
                Password
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="At least 6 characters"
                    className="field platform-login-field w-full pr-20"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold text-cardinal"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </motion.label>

              {error ? (
                <motion.p
                  className="m-0 rounded-2xl bg-crimson-pale px-3 py-2.5 text-sm font-bold text-crimson-dark"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {error}
                </motion.p>
              ) : null}

              <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="show">
                <Magnetic>
                  <button type="submit" className="btn btn-primary platform-login-submit w-full" disabled={loading}>
                    {loading ? (
                      <span className="platform-login-loading">
                        <span className="platform-login-spinner" aria-hidden="true" />
                        Verifying…
                      </span>
                    ) : (
                      'Enter platform'
                    )}
                  </button>
                </Magnetic>
              </motion.div>
            </form>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
