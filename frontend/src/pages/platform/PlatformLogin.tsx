import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import CampusDeskMark from '../../components/CampusDeskMark';
import { SUPER_BASE } from '../../admin/paths';
import { getPlatform, signInPlatform } from '../../auth/platformSession';
import api from '../../api/client';
import { easeOut } from './motion';
import { Pulse } from './ui';

const LOG_LINES = [
  '> boot campus_desk_control_plane v2.4',
  '> scanning tenant fleet...',
  '> module catalog: synced',
  '> awaiting operator credentials_',
];

export default function PlatformLogin() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const existing = getPlatform();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [line, setLine] = useState(0);

  if (existing) {
    return <Navigate to={`${SUPER_BASE}/dashboard`} replace />;
  }

  useEffect(() => {
    const id = window.setInterval(() => setLine((n) => (n + 1) % LOG_LINES.length), 2200);
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
    <div className="px-gate">
      <div className="px-gate-bg" aria-hidden="true">
        <div className="px-gate-hex" />
        <div className="px-gate-vignette" />
        <div className="px-backdrop-orb is-a" />
        <div className="px-backdrop-orb is-b" />
      </div>

      <motion.div
        className="px-gate-terminal"
        key={line}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span>{LOG_LINES[line]}</span>
      </motion.div>

      <motion.div
        className="px-gate-card"
        initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: easeOut }}
      >
        <div className="px-gate-brand">
          <CampusDeskMark size={48} />
          <div>
            <strong>Campus Desk</strong>
            <small>Platform control plane</small>
          </div>
        </div>

        <p className="px-gate-badge">
          <Pulse on tone="warn" />
          Restricted operator gate
        </p>

        <h1 className="px-gate-title">Authenticate</h1>
        <p className="px-gate-sub">
          This console is not linked from the public site. Org admins use their own portal — only Campus Desk operators
          enter here.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="px-gate-label">
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

          <label className="px-gate-label">
            Access key
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                minLength={6}
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                className="field w-full pr-20"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-cardinal"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error ? <p className="px-gate-error">{error}</p> : null}

          <motion.button
            type="submit"
            className="btn btn-primary px-gate-submit"
            disabled={loading}
            whileTap={reduce ? undefined : { scale: 0.98 }}
          >
            {loading ? 'Verifying credentials…' : 'Enter control plane →'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
