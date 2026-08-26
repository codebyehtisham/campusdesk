import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signInPlatform } from '../../auth/platformSession';
import api from '../../api/client';
import { Pulse } from './ui';

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

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
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
    } catch (err) {
      setError(err.response?.data?.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="platform-shell relative min-h-svh overflow-hidden">
      <div className="flex min-h-svh items-center justify-center px-5 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="pc-login-card">
          <div className="pc-lock-strip">
            <span className="inline-flex items-center gap-2">
              <Pulse on tone="warn" />
              Restricted
            </span>
            <span>Superuser access</span>
          </div>
          <div className="mb-6 flex items-center gap-3">
            <span className="pc-mark" aria-hidden="true">
              <Pulse on tone="warn" />
            </span>
            <div className="leading-tight">
              <strong className="block text-[0.78rem] font-bold tracking-[0.16em] text-[var(--pc-text)] uppercase">
                Control plane
              </strong>
              <p className="m-0 text-[0.7rem] text-[var(--pc-muted)]">Enable and disable campus services</p>
            </div>
          </div>
          <h1 className="mb-2">Authenticate</h1>
          <p className="pc-hint mb-7">
            This console is for platform operators only. Organisation admins sign in at their own portal.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className={labelClass}>
              Operator email
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
            </label>
            {error && <p className="pc-banner mb-0">{error}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Checking credentials…' : 'Enter control plane'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
