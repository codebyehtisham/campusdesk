import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin, getAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import { roleLabel } from '../../data/roles';
import ChangePasswordForm from '../../components/ChangePasswordForm';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
];

export default function AdminAccess() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordUser, setPasswordUser] = useState(null);
  const [pendingBlock, setPendingBlock] = useState(null);

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
      setError(err.response?.data?.message || 'Could not load faculty access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (filter === 'blocked') return users.filter((user) => user.blocked);
    if (filter === 'active') return users.filter((user) => !user.blocked);
    return users;
  }, [users, filter]);

  const setBlocked = async (user, blocked) => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${user.id}/block`, { blocked }, { authScope: 'admin' });
      setNotice(blocked ? `${user.name} is blocked.` : `${user.name} can sign in again.`);
      setPendingBlock(null);
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not update access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <span className="eyebrow">Access</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Faculty access</h1>
      <p className="mb-8 max-w-2xl text-text-muted">
        Block or unblock faculty accounts, and set a new password with the same checks used on the Password page.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`filter-btn ${filter === item.key ? 'filter-btn-on' : 'filter-btn-off'}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading access…</div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>{users.length === 0 ? 'No faculty users yet' : 'No accounts in this list'}</h3>
          <p className="m-0 text-text-muted">
            {users.length === 0 ? 'Add a Reader, Officer, or Faculty member from Users first.' : 'Try another filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((user) => (
            <article key={user.id} className="glass rounded-[1.6rem] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag tag-allied">{roleLabel(user.role, getAdmin()?.organization?.kind)}</span>
                    <span className={`tag ${user.blocked ? 'tag-nursing' : 'tag-allied'}`}>
                      {user.blocked ? 'Blocked' : 'Active'}
                    </span>
                  </div>
                  <h3 className="mt-3 mb-1">{user.name}</h3>
                  <p className="m-0 text-text-muted">{user.email}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={() => setPasswordUser(user)}>
                    Change password
                  </button>
                  {user.blocked ? (
                    <button type="button" className="btn btn-primary py-2.5 text-sm" onClick={() => setPendingBlock(user)}>
                      Unblock
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson"
                      onClick={() => setPendingBlock(user)}
                    >
                      Block
                    </button>
                  )}
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
        {passwordUser && (
          <motion.div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-white/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="flex-1" aria-label="Close" onClick={() => setPasswordUser(null)} />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              className="h-full w-full max-w-3xl overflow-y-auto border-l border-border bg-white p-7 md:p-9"
            >
              <span className="eyebrow">Password</span>
              <h2 className="text-[1.8rem]">Set a new password</h2>
              <p className="mb-6 text-text-muted">
                This resets the password for {passwordUser.name}. They can sign in with it right away.
              </p>
              <ChangePasswordForm
                requireCurrent={false}
                accountName={passwordUser.name}
                accountEmail={passwordUser.email}
                note="The current password is not required. Share the new password with this faculty member directly."
                submitLabel="Set password"
                onSubmit={async ({ newPassword }) => {
                  const res = await api.put(
                    `/admin/users/${passwordUser.id}/password`,
                    { newPassword },
                    { authScope: 'admin' }
                  );
                  return res.data?.message || 'Password updated.';
                }}
                onAuthError={kickOut}
              />
              <button type="button" className="btn btn-outline mt-6" onClick={() => setPasswordUser(null)}>
                Close
              </button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingBlock && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/65 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass glow-border w-full max-w-md rounded-[1.6rem] p-8">
              <h3>{pendingBlock.blocked ? 'Unblock this user?' : 'Block this user?'}</h3>
              <p className="text-text-muted">
                {pendingBlock.blocked
                  ? `“${pendingBlock.name}” will be able to sign in to the faculty portal again.`
                  : `“${pendingBlock.name}” will be signed out and cannot open the faculty portal until you unblock them.`}
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={saving}
                  onClick={() => setBlocked(pendingBlock, !pendingBlock.blocked)}
                >
                  {pendingBlock.blocked ? 'Unblock' : 'Block user'}
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPendingBlock(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
