import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signInPlatform } from '../../auth/platformSession';
import api from '../../api/client';
import { PlatformBackdrop, ease } from './motion';
import { Pulse } from './ui';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

const fieldVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.08, duration: 0.4, ease } }),
};

export default function PlatformLogin() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
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
    <div className="platform-shell relative min-h-svh overflow-hidden">
      <PlatformBackdrop />
      <div className="relative z-1 flex min-h-svh items-center justify-center px-5 py-16">
        <motion.div
          className="pc-login-card pc-login-glow"
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease }}
        >
          <div className="pc-lock-strip">
            <span className="inline-flex items-center gap-2">
              <Pulse on tone="warn" />
              Restricted
            </span>
            <span>Superuser access</span>
          </div>
          <motion.div
            className="mb-6 flex items-center gap-3"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease }}
          >
            <span className="pc-mark pc-mark-glow" aria-hidden="true">
              <Pulse on />
            </span>
            <div className="leading-tight">
              <strong className="block text-[0.78rem] font-bold tracking-[0.16em] text-[var(--pc-text)] uppercase">
                Control plane
              </strong>
              <p className="m-0 text-[0.7rem] text-[var(--pc-muted)]">Enable and disable campus services</p>
            </div>
          </motion.div>
          <h1 className="mb-2 pc-title-gradient">Authenticate</h1>
          <p className="pc-hint mb-7">
            This console is for platform operators only. Organisation admins sign in at their own portal.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {[
              {
                key: 'email',
                label: 'Operator email',
                type: 'email' as const,
                placeholder: 'platform@explore.app',
                autoComplete: 'username',
              },
            ].map((field, i) => (
              <motion.label
                key={field.key}
                className={labelClass}
                custom={i}
                variants={fieldVariants}
                initial="hidden"
                animate="show"
              >
                {field.label}
                <input
                  type={field.type}
                  name={field.key}
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="field"
                  autoComplete={field.autoComplete}
                />
              </motion.label>
            ))}
            <motion.label className={labelClass} custom={1} variants={fieldVariants} initial="hidden" animate="show">
              Access key
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  className="field w-full pr-20"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold text-[var(--pc-accent)]"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </motion.label>
            {error ? (
              <motion.p className="pc-banner mb-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                {error}
              </motion.p>
            ) : null}
            <motion.button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              custom={2}
              variants={fieldVariants}
              initial="hidden"
              animate="show"
              whileHover={reduce ? undefined : { scale: 1.01 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
            >
              {loading ? 'Checking credentials…' : 'Enter control plane'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
