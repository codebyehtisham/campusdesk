import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Magnetic from '../../components/Magnetic';
import { FACULTY_BASE } from '../../admin/paths';
import { getStaff, signInStaff } from '../../auth/staffSession';
import { isLockedOrg } from '../../auth/serviceLock';
import { staffHome } from '../../data/roles';
import api from '../../api/client';
import CampusDeskMark from '../../components/CampusDeskMark';
import usePublicBrand from '../../brand/usePublicBrand';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function FacultyLogin() {
  const navigate = useNavigate();
  const existing = getStaff();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const brand = usePublicBrand();

  if (existing) {
    if (isLockedOrg(existing.organization)) return <Navigate to={`${FACULTY_BASE}/suspended`} replace />;
    return <Navigate to={staffHome(existing.role, existing.modules)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/staff/login', {
        email: form.email.trim(),
        password: form.password.trim(),
      });
      signInStaff({
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
        role: res.data.user.role,
        token: res.data.token,
        organization: res.data.organization,
        modules: res.data.organization?.modules || [],
      });
      const modules = res.data.organization?.modules || [];
      navigate(
        isLockedOrg(res.data.organization)
          ? `${FACULTY_BASE}/suspended`
          : staffHome(res.data.user.role, modules),
        { replace: true }
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign in. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="flex min-h-svh items-center justify-center px-5 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass glow-border w-full max-w-md rounded-[1.8rem] p-8 md:p-10"
        >
          <div className="mb-8 flex items-center gap-3">
            <CampusDeskMark size={48} />
            <div className="leading-tight">
              <strong className="font-serif text-sm font-bold tracking-tight text-ink">Campus Desk</strong>
              <p className="m-0 text-[0.7rem] font-medium text-text-muted">
                {brand.title || brand.name || 'Faculty'} · Faculty portal
              </p>
            </div>
          </div>
          <span className="eyebrow">Faculty login</span>
          <h2 className="text-[1.9rem]">Sign in</h2>
          <p className="mb-7 text-text-muted">Sign in with the Reader, Officer, or Faculty member access your admin assigned.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className={labelClass}>
              Email
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="field"
                autoComplete="username"
              />
            </label>
            <label className={labelClass}>
              Password
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
            {error && (
              <p className="m-0 rounded-2xl bg-crimson-pale px-3 py-2.5 text-sm font-bold text-crimson-dark">{error}</p>
            )}
            <Magnetic>
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </Magnetic>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
