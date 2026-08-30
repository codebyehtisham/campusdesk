import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { HR_PORTAL_BASE } from '../../admin/paths';
import { roleLabel } from '../../data/roles';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_ORDER } from '../leave/leaveShared';

const staffReq = { authScope: 'staff' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function HrLeaveQuotas() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/staff/hr/leave-quotas', staffReq);
      const rows = Array.isArray(res.data?.employees) ? res.data.employees : [];
      setEmployees(rows);
      setYear(res.data?.year || new Date().getFullYear());
      const nextDrafts = {};
      rows.forEach((row) => {
        nextDrafts[row.user.id] = { ...row.quotas };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOutStaff();
        navigate(HR_PORTAL_BASE, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (userId) => {
    setSavingId(userId);
    try {
      const res = await api.put(`/staff/hr/leave-quotas/${userId}`, drafts[userId], staffReq);
      setEmployees((rows) =>
        rows.map((row) =>
          row.user.id === userId
            ? { ...row, quotas: res.data.quotas, balance: res.data.balance.types }
            : row
        )
      );
      setNotice('Leave allowances saved.');
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save allowances.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">HR</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Leave allowances</h1>
        <p className="m-0 max-w-2xl text-text-muted">
          Set annual, sick, casual, and maternity leave days for each employee. Balances reset each calendar year ({year}).
        </p>
      </div>

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading employees…</div>
      ) : employees.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">No staff accounts found.</div>
      ) : (
        <div className="grid gap-4">
          {employees.map((row) => (
            <article key={row.user.id} className="glass rounded-[1.4rem] p-5">
              <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="m-0">{row.user.name}</h3>
                  <p className="m-0 text-sm text-text-muted">
                    {row.user.email} · {roleLabel(row.user.role)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary py-2 text-sm"
                  disabled={savingId === row.user.id}
                  onClick={() => save(row.user.id)}
                >
                  {savingId === row.user.id ? 'Saving…' : 'Save allowances'}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {LEAVE_TYPE_ORDER.map((type) => (
                  <label key={type} className={labelClass}>
                    {LEAVE_TYPE_LABELS[type]}
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={drafts[row.user.id]?.[type] ?? row.quotas[type]}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.user.id]: {
                            ...(current[row.user.id] || row.quotas),
                            [type]: e.target.value,
                          },
                        }))
                      }
                    />
                    <span className="text-xs font-normal text-text-muted">
                      {row.balance?.[type]?.remaining ?? 0} remaining · {row.balance?.[type]?.used ?? 0} used
                    </span>
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {notice ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-5 bottom-5 z-50 m-0 rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white"
          >
            {notice}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
