import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { HR_PORTAL_BASE } from '../../admin/paths';
import { roleLabel } from '../../data/roles';
import LeaveBalanceCards from '../leave/LeaveBalanceCards';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_ORDER, leaveStatusClass } from '../leave/leaveShared';

const staffReq = { authScope: 'staff' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

function LeaveHistorySection({ title, items }) {
  return (
    <section className="glass rounded-[1.4rem] p-5">
      <h3 className="mt-0 text-lg">{title}</h3>
      {items.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">No requests recorded.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-sm font-bold text-ink">
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
    </section>
  );
}

export default function HrLeaveReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const res = await api.get(`/staff/hr/leaves/${id}`, staffReq);
      setData(res.data);
      setReviewNotes(res.data?.leave?.reviewNotes || '');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOutStaff();
        navigate(HR_PORTAL_BASE, { replace: true });
        return;
      }
      if (err.response?.status === 404) {
        navigate(`${HR_PORTAL_BASE}/leaves`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const decide = async (decision) => {
    setSaving(true);
    try {
      await api.put(`/staff/hr/leaves/${id}/decision`, { decision, reviewNotes }, staffReq);
      setNotice(decision === 'approved' ? 'Leave approved.' : 'Leave rejected.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not update leave request.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading leave request…</div>;
  }

  if (!data?.leave) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Leave request not found.</div>;
  }

  const { leave, employee, balance, historyByType } = data;

  return (
    <div>
      <Link to={`${HR_PORTAL_BASE}/leaves`} className="mb-4 inline-flex text-sm font-bold text-cardinal no-underline">
        ← Back to leave requests
      </Link>

      <div className="mb-8">
        <span className="eyebrow">HR</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Review leave request</h1>
        <p className="m-0 max-w-2xl text-text-muted">
          {employee?.name} · {roleLabel(employee?.role)} · <span className="capitalize">{leave.type}</span> leave
        </p>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass rounded-[1.4rem] p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="mt-0 text-xl capitalize">{leave.type} leave</h2>
              <p className="m-0 text-sm text-text-muted">
                {leave.startDate} → {leave.endDate}
              </p>
              <p className="m-0 mt-1 text-sm text-text-muted">{employee?.email}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${leaveStatusClass(leave.status)}`}>
              {leave.status}
            </span>
          </div>

          {leave.reason ? (
            <div className="mb-4 rounded-2xl bg-bg-alt p-4">
              <p className="m-0 text-xs font-bold tracking-wide text-text-muted uppercase">Reason</p>
              <p className="m-0 mt-2 text-sm">{leave.reason}</p>
            </div>
          ) : null}

          {leave.status === 'pending' ? (
            <>
              <label className={labelClass}>
                Notes for employee
                <textarea
                  className="field resize-y"
                  rows="3"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Optional message when approving or rejecting"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => decide('approved')}>
                  Approve
                </button>
                <button type="button" className="btn btn-outline" disabled={saving} onClick={() => decide('rejected')}>
                  Reject
                </button>
              </div>
            </>
          ) : leave.reviewNotes ? (
            <p className="m-0 text-sm text-text-muted">HR notes: {leave.reviewNotes}</p>
          ) : null}
        </section>

        <section>
          <h2 className="text-xl">Current balance ({balance?.year})</h2>
          <LeaveBalanceCards balance={balance} compact />
        </section>
      </div>

      <div className="mb-4">
        <h2 className="text-xl">Leave history</h2>
        <p className="m-0 text-sm text-text-muted">Previous requests for this employee, grouped by leave type.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {LEAVE_TYPE_ORDER.map((type) => (
          <LeaveHistorySection
            key={type}
            title={LEAVE_TYPE_LABELS[type]}
            items={(historyByType?.[type] || []).filter((item) => item.id !== leave.id)}
          />
        ))}
      </div>

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
