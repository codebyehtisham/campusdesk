import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import LeaveBalanceCards from '../leave/LeaveBalanceCards';
import { LEAVE_TYPE_LABELS, leaveStatusClass } from '../leave/leaveShared';

const staffReq = { authScope: 'staff' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const TYPES = [
  { key: 'sick', label: 'Sick leave' },
  { key: 'casual', label: 'Casual leave' },
  { key: 'maternity', label: 'Maternity leave' },
  { key: 'annual', label: 'Annual leave' },
];

export default function StaffLeavePage({ portalBase }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ type: 'sick', startDate: '', endDate: '', reason: '' });

  const kickOut = () => {
    signOutStaff();
    navigate(portalBase, { replace: true });
  };

  const load = async () => {
    try {
      const res = await api.get('/staff/leaves', staffReq);
      const payload = res.data;
      if (Array.isArray(payload)) {
        setItems(payload);
        const balanceRes = await api.get('/staff/leaves/balance', staffReq);
        setBalance(balanceRes.data);
      } else {
        setItems(Array.isArray(payload?.items) ? payload.items : []);
        setBalance(payload?.balance || null);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) kickOut();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedBalance = balance?.types?.[form.type];
  const selectedLabel = LEAVE_TYPE_LABELS[form.type] || 'Leave';

  const requestedDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(`${form.startDate}T00:00:00.000Z`);
    const end = new Date(`${form.endDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    const cursor = new Date(start);
    let days = 0;
    while (cursor <= end) {
      days += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }, [form.startDate, form.endDate]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff/leaves', form, staffReq);
      setForm({ type: 'sick', startDate: '', endDate: '', reason: '' });
      setNotice('Leave request submitted to HR.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not submit leave request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Leave</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Request time off</h1>
        <p className="m-0 max-w-2xl text-text-muted">Submit sick, casual, maternity, or annual leave. HR will approve or reject your request.</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl">Your balance {balance?.year ? `(${balance.year})` : ''}</h2>
        {loading ? (
          <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">Loading balances…</div>
        ) : (
          <LeaveBalanceCards balance={balance} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <form onSubmit={submit} className="glass rounded-[1.4rem] p-6">
          <h2 className="mt-0 text-xl">New request</h2>
          <div className="grid gap-3">
            <label className={labelClass}>
              Leave type
              <select className="field" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedBalance ? (
              <p className="m-0 rounded-2xl bg-bg-alt px-4 py-3 text-sm text-text-muted">
                {selectedLabel}: <strong className="text-ink">{selectedBalance.remaining}</strong> remaining
                {selectedBalance.pending ? ` · ${selectedBalance.pending} pending` : ''}
                {requestedDays > 0 ? ` · requesting ${requestedDays} day${requestedDays === 1 ? '' : 's'}` : ''}
              </p>
            ) : null}
            <label className={labelClass}>
              Start date
              <input className="field" type="date" required value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </label>
            <label className={labelClass}>
              End date
              <input className="field" type="date" required value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </label>
            <label className={labelClass}>
              Reason
              <textarea className="field resize-y" rows="4" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional notes for HR" />
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit for approval'}
          </button>
        </form>

        <div>
          <h2 className="text-xl">My requests</h2>
          {loading ? (
            <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No leave requests yet.</div>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <article key={item.id} className="glass rounded-[1.4rem] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="m-0 capitalize">{item.type} leave</h3>
                      <p className="m-0 mt-1 text-sm text-text-muted">
                        {item.startDate} → {item.endDate}
                      </p>
                      {item.reason ? <p className="m-0 mt-2 text-sm">{item.reason}</p> : null}
                      {item.reviewNotes ? <p className="m-0 mt-2 text-sm text-text-muted">HR: {item.reviewNotes}</p> : null}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${leaveStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {notice ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white"
          >
            {notice}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
