import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Magnetic from './Magnetic';
import { getApplicant, signInApplicant, signOutApplicant } from '../auth/session';
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

export default function ApplicantLogin({
  institute = '',
  instituteLabel = '',
  onAuthenticated,
}) {
  const existing = getApplicant();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const instituteSlug = String(institute || '').trim().toLowerCase();
  const instituteName = String(instituteLabel || instituteSlug).trim();

  const finish = (payload) => {
    signInApplicant({
      id: payload.user.id,
      name: payload.user.name,
      email: payload.user.email,
      token: payload.token,
      organization: payload.organization,
    });
    onAuthenticated?.(payload);
  };

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
              email: form.email.trim().toLowerCase(),
              password: form.password.trim(),
              ...(instituteSlug ? { institute: instituteSlug } : {}),
            }
          : {
              email: form.email.trim().toLowerCase(),
              password: form.password.trim(),
              ...(instituteSlug ? { institute: instituteSlug } : {}),
            };
      const res = await api.post(path, payload);
      finish(res.data);
    } catch (err) {
      if (isSuspendedError(err)) {
        onAuthenticated?.({ suspended: true });
        return;
      }
      const message = err.response?.data?.message || 'Could not sign in. Try again.';
      if (err.response?.status === 409) {
        setMode('login');
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (existing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[1.8rem] p-8 md:p-10"
      >
        <span className="eyebrow">Admissions</span>
        <h3>Welcome back</h3>
        <p className="mb-6 text-text-muted">
          Continue
          {existing.name ? ` as ${existing.name}` : ''}
          {existing.organization?.title || existing.organization?.name
            ? ` · ${existing.organization.title || existing.organization.name}`
            : ''}
          .
        </p>
        <Magnetic>
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              if (isLockedOrg(existing.organization)) {
                onAuthenticated?.({ suspended: true, organization: existing.organization });
                return;
              }
              onAuthenticated?.({
                token: existing.token,
                user: existing,
                organization: existing.organization,
              });
            }}
          >
            Continue
          </button>
        </Magnetic>
        <button
          type="button"
          className="mt-4 w-full text-sm font-bold text-cardinal"
          onClick={() => {
            signOutApplicant();
            setError('');
            setMode('login');
          }}
        >
          Use a different account
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-[1.8rem] p-8 md:p-10"
    >
      <span className="eyebrow">{mode === 'login' ? 'Admissions login' : 'New applicant'}</span>
      <h3>{mode === 'login' ? 'Sign in to apply' : 'Create your account'}</h3>
      <p className="mb-6 text-text-muted">
        {mode === 'login'
          ? 'Use your applicant email and password. Your account is saved for next time.'
          : 'Create an account once — you can sign back in anytime.'}
        {instituteSlug ? (
          <>
            {' '}
            Applying to <strong className="text-ink">{instituteName}</strong>.
          </>
        ) : (
          <> You will choose your institute after signing in.</>
        )}
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
