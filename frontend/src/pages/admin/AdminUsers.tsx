import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { roleLabel, rolesForKind, portalPathForRole } from '../../data/roles';
import { signOutAdmin, getAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import { CheckRow, PasswordField, StrengthMeter } from '../../components/ChangePasswordForm';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function AdminUsers() {
  const navigate = useNavigate();
  const orgModules = getAdmin()?.modules || [];
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: '' });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const roleOptions = useMemo(
    () => rolesForKind('education', orgModules, { includeRoles: panel?.mode === 'edit' ? [form.role] : [] }),
    [orgModules, panel?.mode, form.role]
  );

  const defaultRole = roleOptions[0]?.key || '';

  const kickOut = () => {
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const res = await api.get('/admin/users', { authScope: 'admin' });
      setUsers(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', confirmPassword: '', role: defaultRole });
    setPanel({ mode: 'create' });
  };

  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, password: '', confirmPassword: '', role: user.role });
    setPanel({ mode: 'edit', id: user.id });
  };

  const closePanel = () => {
    setPanel(null);
    setForm({ name: '', email: '', password: '', confirmPassword: '', role: defaultRole });
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.role) {
      setNotice('No staff roles are available. Enable a module for this organisation first.');
      return;
    }
    if (panel?.mode === 'create' && form.password !== form.confirmPassword) {
      setNotice('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      if (panel?.mode === 'edit') {
        await api.put(
          `/admin/users/${panel.id}`,
          { name: form.name, email: form.email, role: form.role },
          { authScope: 'admin' }
        );
        setNotice('User updated.');
      } else {
        await api.post(
          '/admin/users',
          { name: form.name, email: form.email, password: form.password, role: form.role },
          { authScope: 'admin' }
        );
        setNotice(`User created. They sign in at ${roleOptions.find((r) => r.key === form.role)?.portalPath || '/faculty-portal'}.`);
      }
      closePanel();
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save this user.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/users/${pendingDelete.id}`, { authScope: 'admin' });
      setNotice(`Removed ${pendingDelete.name}.`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not delete this user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Users</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Staff roles</h1>
          <p className="m-0 max-w-xl text-text-muted">
            Create accounts for each role owner. Daily work happens in their team portal — see{' '}
            <Link to={`${ADMIN_BASE}/portals`} className="font-semibold text-cardinal">
              Team portals
            </Link>{' '}
            for sign-in URLs.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`${ADMIN_BASE}/access`} className="btn btn-outline">
            Access
          </Link>
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!defaultRole}>
            New user
          </button>
        </div>
      </div>

      {!defaultRole && (
        <p className="mb-5 rounded-2xl bg-bg-alt px-4 py-3 text-sm font-semibold text-text-muted">
          Enable at least one staff module (faculty, admissions, careers, fees, examinations, library, etc.) before
          creating users. Roles only appear when their module is active on your subscription.
        </p>
      )}

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No staff users yet</h3>
          <p className="mb-6 text-text-muted">
            Assign a role and portal sign-in link for each person — faculty, admissions, HR, finance, exams, or library.
          </p>
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!defaultRole}>
            Add the first user
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <article key={user.id} className="glass rounded-[1.6rem] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag tag-allied w-fit">{roleLabel(user.role)}</span>
                    {user.blocked && <span className="tag tag-nursing">Blocked</span>}
                  </div>
                  <h3 className="mt-3 mb-1">{user.name}</h3>
                  <p className="m-0 text-text-muted">{user.email}</p>
                  <code className="mt-2 inline-block text-xs font-mono text-cardinal">{portalPathForRole(user.role)}</code>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={() => openEdit(user)}>
                    Edit
                  </button>
                  <button
                      type="button"
                      className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson"
                      onClick={() => setPendingDelete(user)}
                    >
                      Delete
                    </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(26,79,214,0.28)]"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <motion.div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-white/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="flex-1" aria-label="Close" onClick={closePanel} />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-white p-7 md:p-9"
            >
              <span className="eyebrow">{panel.mode === 'edit' ? 'Edit user' : 'New user'}</span>
              <h2 className="text-[1.8rem]">{panel.mode === 'edit' ? 'Update staff account' : 'Add staff account'}</h2>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className={labelClass}>
                  Full name
                  <input name="name" required value={form.name} onChange={handleChange} className="field" />
                </label>
                <label className={labelClass}>
                  Email
                  <input type="email" name="email" required value={form.email} onChange={handleChange} className="field" />
                </label>
                {panel.mode === 'create' && (
                  <>
                    <div>
                      <PasswordField
                        label="Password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
                      />
                      <StrengthMeter value={form.password} />
                    </div>
                    <PasswordField
                      label="Confirm password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Type the password again"
                      error={
                        form.confirmPassword && form.password !== form.confirmPassword
                          ? 'The two passwords do not match.'
                          : ''
                      }
                    />
                    <ul className="m-0 flex flex-col gap-2 text-sm font-semibold">
                      <CheckRow ok={form.password.length >= 6} label="At least 6 characters" />
                      <CheckRow
                        ok={Boolean(form.confirmPassword) && form.password === form.confirmPassword}
                        label="Confirmation matches"
                      />
                      <CheckRow
                        ok={/[A-Za-z]/.test(form.password) && /\d/.test(form.password)}
                        label="Letters and a number (recommended)"
                      />
                    </ul>
                  </>
                )}
                {panel.mode === 'edit' && (
                  <p className="m-0 rounded-2xl bg-bg-alt px-4 py-3 text-sm text-text-muted">
                    To reset this password or block the account, use{' '}
                    <Link to={`${ADMIN_BASE}/access`} className="font-semibold text-cardinal">
                      Access
                    </Link>
                    .
                  </p>
                )}
                <label className={labelClass}>
                  Role
                  <select name="role" value={form.role} onChange={handleChange} className="field" disabled={!roleOptions.length}>
                    {roleOptions.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  {roleOptions.length ? (
                    <span className="font-medium text-text-muted">
                      {roleOptions.find((role) => role.key === form.role)?.hint}
                      {roleOptions.find((role) => role.key === form.role)?.portalPath ? (
                        <>
                          {' '}
                          · Sign in at{' '}
                          <code className="font-mono text-xs">
                            {roleOptions.find((role) => role.key === form.role)?.portalPath}
                          </code>
                        </>
                      ) : null}
                    </span>
                  ) : (
                    <span className="font-medium text-text-muted">No roles available for your enabled modules.</span>
                  )}
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={
                      saving ||
                      !form.role ||
                      (panel.mode === 'create' &&
                        (form.password.length < 6 || form.password !== form.confirmPassword))
                    }
                  >
                    {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save changes' : 'Create user'}
                  </button>
                  <button type="button" className="btn btn-outline flex-1" onClick={closePanel}>
                    Cancel
                  </button>
                </div>
              </form>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/65 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass glow-border w-full max-w-md rounded-[1.6rem] p-8">
              <h3>Remove this user?</h3>
              <p className="text-text-muted">
                “{pendingDelete.name}” will no longer be able to sign in to the faculty portal.
              </p>
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={confirmDelete}>
                  Delete user
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPendingDelete(null)}>
                  Keep them
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
