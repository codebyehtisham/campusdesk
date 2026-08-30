import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { FINANCE_PORTAL_BASE } from '../../admin/paths';
import { formatMoney, rupeesToCents } from '../../lib/money';

const staffReq = { authScope: 'staff' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function FinanceHome() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [plans, setPlans] = useState([]);
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [planForm, setPlanForm] = useState({ name: '', amount: '' });
  const [feeForm, setFeeForm] = useState({ personId: '', planId: '', label: '', amount: '', dueAt: '' });
  const [paymentForm, setPaymentForm] = useState({ studentFeeId: '', amount: '', method: 'cash', notes: '' });

  const kickOut = () => {
    signOutStaff();
    navigate(FINANCE_PORTAL_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const [overviewRes, plansRes, feesRes, studentsRes] = await Promise.all([
        api.get('/staff/finance/overview', staffReq),
        api.get('/staff/finance/plans', staffReq),
        api.get('/staff/finance/fees', staffReq),
        api.get('/staff/finance/students', staffReq),
      ]);
      setOverview(overviewRes.data);
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
      setFees(Array.isArray(feesRes.data) ? feesRes.data : []);
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) kickOut();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const createPlan = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff/finance/plans', { name: planForm.name, amountCents: rupeesToCents(planForm.amount) }, staffReq);
      setPlanForm({ name: '', amount: '' });
      setNotice('Fee plan saved.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save plan.');
    } finally {
      setSaving(false);
    }
  };

  const assignFee = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(
        '/staff/finance/fees',
        {
          personId: feeForm.personId,
          planId: feeForm.planId || undefined,
          label: feeForm.label,
          amountDueCents: feeForm.planId ? undefined : rupeesToCents(feeForm.amount),
          dueAt: feeForm.dueAt || undefined,
        },
        staffReq
      );
      setFeeForm({ personId: '', planId: '', label: '', amount: '', dueAt: '' });
      setNotice('Fee assigned to student.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not assign fee.');
    } finally {
      setSaving(false);
    }
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(
        '/staff/finance/payments',
        {
          studentFeeId: paymentForm.studentFeeId,
          amountCents: rupeesToCents(paymentForm.amount),
          method: paymentForm.method,
          notes: paymentForm.notes,
        },
        staffReq
      );
      setPaymentForm({ studentFeeId: '', amount: '', method: 'cash', notes: '' });
      setNotice('Payment recorded.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading finance workspace…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Finance</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Fees & accounts</h1>
        <p className="m-0 max-w-2xl text-text-muted">Manage fee plans, student accounts, and record payments.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'plans', label: 'Fee plans' },
          { key: 'fees', label: 'Student fees' },
          { key: 'payments', label: 'Record payment' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item.key ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active plans', value: overview.activePlans },
            { label: 'Student accounts', value: overview.studentAccounts },
            { label: 'Outstanding', value: formatMoney(overview.outstandingCents) },
            { label: 'Defaulters', value: overview.defaulters },
          ].map((card) => (
            <article key={card.label} className="glass rounded-[1.4rem] p-5">
              <p className="m-0 text-sm text-text-muted">{card.label}</p>
              <p className="m-0 mt-2 text-2xl font-bold text-ink">{card.value}</p>
            </article>
          ))}
        </div>
      )}

      {tab === 'plans' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createPlan} className="glass rounded-[1.4rem] p-6">
            <h2 className="mt-0 text-xl">New fee plan</h2>
            <div className="grid gap-3">
              <label className={labelClass}>
                Plan name
                <input className="field" required value={planForm.name} onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className={labelClass}>
                Amount (PKR)
                <input className="field" type="number" min="0" step="0.01" required value={planForm.amount} onChange={(e) => setPlanForm((f) => ({ ...f, amount: e.target.value }))} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </form>
          <div className="grid gap-3">
            {plans.length === 0 ? (
              <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No fee plans yet.</div>
            ) : (
              plans.map((plan) => (
                <article key={plan.id} className="glass rounded-[1.4rem] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="m-0">{plan.name}</h3>
                      <p className="m-0 mt-1 text-sm text-text-muted">{formatMoney(plan.amountCents, plan.currency)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${plan.active ? 'bg-cardinal-pale text-cardinal' : 'bg-bg-alt text-text-muted'}`}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'fees' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={assignFee} className="glass rounded-[1.4rem] p-6">
            <h2 className="mt-0 text-xl">Assign fee</h2>
            <div className="grid gap-3">
              <label className={labelClass}>
                Student
                <select className="field" required value={feeForm.personId} onChange={(e) => setFeeForm((f) => ({ ...f, personId: e.target.value }))}>
                  <option value="">Choose student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Fee plan (optional)
                <select className="field" value={feeForm.planId} onChange={(e) => setFeeForm((f) => ({ ...f, planId: e.target.value }))}>
                  <option value="">Custom amount</option>
                  {plans.filter((plan) => plan.active).map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {formatMoney(plan.amountCents)}
                    </option>
                  ))}
                </select>
              </label>
              {!feeForm.planId && (
                <label className={labelClass}>
                  Amount (PKR)
                  <input className="field" type="number" min="0" step="0.01" required value={feeForm.amount} onChange={(e) => setFeeForm((f) => ({ ...f, amount: e.target.value }))} />
                </label>
              )}
              <label className={labelClass}>
                Label
                <input className="field" value={feeForm.label} onChange={(e) => setFeeForm((f) => ({ ...f, label: e.target.value }))} placeholder="Tuition — Spring 2026" />
              </label>
              <label className={labelClass}>
                Due date
                <input className="field" type="date" value={feeForm.dueAt} onChange={(e) => setFeeForm((f) => ({ ...f, dueAt: e.target.value }))} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
              {saving ? 'Saving…' : 'Assign fee'}
            </button>
          </form>
          <div className="grid gap-3">
            {fees.length === 0 ? (
              <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No student fee accounts yet.</div>
            ) : (
              fees.map((fee) => (
                <article key={fee.id} className="glass rounded-[1.4rem] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="m-0">{fee.person?.name}</h3>
                      <p className="m-0 text-sm text-text-muted">{fee.label || fee.plan?.name || 'Fee account'}</p>
                    </div>
                    <div className="text-sm font-bold text-ink">
                      {formatMoney(fee.amountPaidCents)} / {formatMoney(fee.amountDueCents)}
                      <span className="ml-2 rounded-full bg-bg-alt px-2 py-0.5 text-xs uppercase">{fee.status}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <form onSubmit={recordPayment} className="glass max-w-xl rounded-[1.4rem] p-6">
          <h2 className="mt-0 text-xl">Record payment</h2>
          <div className="grid gap-3">
            <label className={labelClass}>
              Student fee account
              <select className="field" required value={paymentForm.studentFeeId} onChange={(e) => setPaymentForm((f) => ({ ...f, studentFeeId: e.target.value }))}>
                <option value="">Choose account</option>
                {fees
                  .filter((fee) => fee.amountPaidCents < fee.amountDueCents)
                  .map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.person?.name} — {fee.label || fee.plan?.name} (due {formatMoney(fee.amountDueCents - fee.amountPaidCents)})
                    </option>
                  ))}
              </select>
            </label>
            <label className={labelClass}>
              Amount (PKR)
              <input className="field" type="number" min="0" step="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
            <label className={labelClass}>
              Method
              <select className="field" value={paymentForm.method} onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank">Bank transfer</option>
                <option value="card">Card</option>
              </select>
            </label>
            <label className={labelClass}>
              Notes
              <input className="field" value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </form>
      )}

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(26,79,214,0.28)]"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
