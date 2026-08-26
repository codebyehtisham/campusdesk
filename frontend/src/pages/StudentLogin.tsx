import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Magnetic from '../components/Magnetic';
import CampusDeskMark from '../components/CampusDeskMark';
import { getApplicant, signInApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import api from '../api/client';
import { CAMPUSDESK_NAME } from '../brand/product';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function StudentLogin() {
  const navigate = useNavigate();
  const existing = getApplicant();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (existing?.token) {
    return (
      <Navigate
        to={isLockedOrg(existing.organization) ? '/apply/suspended' : '/student'}
        replace
      />
    );
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || form.password.length < 6) {
      setError('Enter your email and a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', {
        email: form.email.trim(),
        password: form.password,
      });
      signInApplicant({
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
        token: res.data.token,
        organization: res.data.organization,
      });
      navigate(
        res.data.organization?.servicesLocked || res.data.organization?.status === 'suspended'
          ? '/apply/suspended'
          : '/student',
        { replace: true }
      );
    } catch (err) {
      if (isSuspendedError(err)) {
        navigate('/apply/suspended');
        return;
      }
      setError(err.response?.data?.message || 'Could not sign in. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-white">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="flex min-h-svh items-center justify-center px-5 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <CampusDeskMark size={64} className="mb-4 shadow-sm" />
            <strong className="font-serif text-2xl font-bold tracking-tight text-ink">{CAMPUSDESK_NAME}</strong>
            <p className="m-0 mt-1 text-sm text-text-muted">Student sign-in · attendance, courses, and campus tools</p>
          </div>

          <div className="glass rounded-[1.8rem] p-8 md:p-10">
            <span className="eyebrow">Student portal</span>
            <h3 className="mt-1">Sign in</h3>
            <p className="mb-6 text-text-muted">Use your campus email and password.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className={labelClass}>
                Email
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@college.edu"
                  className="field"
                  autoComplete="email"
                />
              </label>
              <label className={labelClass}>
                Password
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Your password"
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
              <Magnetic>
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </Magnetic>
              {error && (
                <p className="m-0 rounded-2xl bg-crimson-pale px-3 py-2.5 text-sm font-bold text-crimson-dark">
                  {error}
                </p>
              )}
            </form>

            <p className="mt-6 mb-0 text-center text-sm text-text-muted">
              Applying for admission?{' '}
              <Link to="/apply" className="font-bold text-cardinal">
                Open apply login
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
