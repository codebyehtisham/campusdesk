import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Magnetic from './Magnetic';
import { getApplicant, signInApplicant } from '../auth/session';
import { isLockedOrg, isSuspendedError } from '../auth/serviceLock';
import api from '../api/client';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

function RequiredLabel({ children }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-crimson" />
      {children}
    </span>
  );
}

export default function ApplicantLogin({ institute = '', instituteLabel = '' }) {
  const navigate = useNavigate();
  const existing = getApplicant();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const instituteSlug = String(institute || '').trim().toLowerCase();
  const instituteName = String(instituteLabel || instituteSlug).trim();

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const payload =
        mode === 'register'
          ? {
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
              ...(instituteSlug ? { institute: instituteSlug } : {}),
            }
          : {
              email: form.email.trim(),
              password: form.password,
              ...(instituteSlug ? { institute: instituteSlug } : {}),
            };
      const res = await api.post(path, payload);
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
          : '/apply/form'
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

  if (existing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass rounded-[1.8rem] p-8 md:p-10"
      >
        <span className="eyebrow">Admissions</span>
        <h3>You are signed in</h3>
        <p className="mb-6 text-text-muted">
          Continue to your admission application
          {existing.name ? ` as ${existing.name}` : ''}.
        </p>
        <Magnetic>
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() =>
              navigate(isLockedOrg(existing.organization) ? '/apply/suspended' : '/apply/form')
            }
          >
            Continue application
          </button>
        </Magnetic>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-[1.8rem] p-8 md:p-10"
    >
      <span className="eyebrow">{mode === 'login' ? 'Admissions login' : 'New applicant'}</span>
      <h3>{mode === 'login' ? 'Sign in to apply' : 'Create your account'}</h3>
      <p className="mb-6 text-text-muted">
        {mode === 'login'
          ? 'Use your applicant email and password to open the admission form.'
          : 'A few details now. Your application opens right after.'}
        {instituteSlug ? (
          <>
            {' '}
            Applying to <strong className="text-ink">{instituteName}</strong>.
          </>
        ) : null}
      </p>

      <AnimatePresence mode="wait">
        <motion.form
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {mode === 'register' && (
            <label className={labelClass}>
              <RequiredLabel>Full name</RequiredLabel>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
                className="field"
                autoComplete="name"
              />
            </label>
          )}
          <label className={labelClass}>
            <RequiredLabel>Email</RequiredLabel>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="field"
              autoComplete="email"
            />
          </label>
          <label className={labelClass}>
            <RequiredLabel>Password</RequiredLabel>
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </Magnetic>
          {error && (
            <p className="m-0 rounded-2xl bg-crimson-pale px-3 py-2.5 text-sm font-bold text-crimson-dark">
              {error}
            </p>
          )}
        </motion.form>
      </AnimatePresence>

      <p className="mt-5 mb-0 text-center text-sm text-text-muted">
        {mode === 'login' ? 'New applicant?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="font-bold text-cardinal"
          onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
      <p className="mt-3 mb-0 text-center text-sm text-text-muted">
        Already enrolled?{' '}
        <Link to="/login" className="font-bold text-cardinal">
          Student portal login
        </Link>
      </p>
    </motion.div>
  );
}
