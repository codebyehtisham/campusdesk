import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Magnetic from '../../components/Magnetic';
import CampusDeskMark from '../../components/CampusDeskMark';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signInPlatform } from '../../auth/platformSession';
import api from '../../api/client';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function PlatformLogin() {
  const navigate = useNavigate();
  const existing = getPlatform();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (existing) {
    return <Navigate to={`${SUPER_BASE}/dashboard`} replace />;
  }

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
    <div className="relative min-h-svh overflow-hidden bg-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="hero-dots" aria-hidden="true" />
      <div className="orb top-16 left-[6%] h-72 w-72 bg-cardinal/25" />
      <div className="orb right-[8%] bottom-[10%] h-80 w-80 bg-cardinal-light/30" />

      <div className="relative z-1 grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden lg:block">
          <img
            src="/images/campus/photos/campus-main-building.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f2f8f8] via-[#f2f8f8]/90 to-[#f2f8f8]/65" />
          <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <CampusDeskMark size={48} />
              <div className="leading-tight">
                <strong className="font-serif text-sm font-bold tracking-tight text-ink">Campus Desk</strong>
                <p className="m-0 text-[0.7rem] font-medium text-text-muted">Platform console</p>
              </div>
            </div>
            <div>
              <span className="eyebrow">Super admin</span>
              <h1 className="max-w-xl text-[clamp(2.4rem,5vw,4.4rem)]">
                One control plane.
                <br />
                <span className="text-cardinal">Every campus.</span>
              </h1>
              <p className="max-w-md text-lg text-text-muted">
                Provision institutes, enable modules, manage billing, and monitor platform health.
              </p>
            </div>
            <p className="m-0 text-sm text-text-muted">Restricted to platform operators only</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-16 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="glass glow-border w-full max-w-md rounded-[1.8rem] p-8 md:p-10"
          >
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <CampusDeskMark size={48} />
              <div className="leading-tight">
                <strong className="font-serif text-sm font-bold tracking-tight text-ink">Campus Desk</strong>
                <p className="m-0 text-[0.7rem] font-medium text-text-muted">Platform console</p>
              </div>
            </div>

            <span className="eyebrow">Platform admin</span>
            <h2 className="text-[1.9rem] md:text-[2.2rem]">Sign in</h2>
            <p className="mb-7 text-text-muted">
              Organisation admins use their own portal — this login is for Campus Desk operators only.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className={labelClass}>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cardinal" />
                  Operator email
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="platform@explore.app"
                  className="field"
                  autoComplete="username"
                />
              </label>
              <label className={labelClass}>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson" />
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="At least 6 characters"
                    className="field w-full pr-20"
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
              </label>

              {error ? (
                <p className="m-0 rounded-2xl bg-crimson-pale px-3 py-2.5 text-sm font-bold text-crimson-dark">{error}</p>
              ) : null}

              <Magnetic>
                <button type="submit" className="btn btn-primary mt-1 w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Enter platform console'}
                </button>
              </Magnetic>
            </form>

            <p className="mt-6 mb-0 text-center text-sm text-text-muted">
              This screen is not linked from the public site.
            </p>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
