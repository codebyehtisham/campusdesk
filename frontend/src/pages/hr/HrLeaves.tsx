import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { HR_PORTAL_BASE } from '../../admin/paths';
import { leaveStatusClass } from '../leave/leaveShared';

const staffReq = { authScope: 'staff' };

export default function HrLeaves() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/staff/hr/leaves', { ...staffReq, params: { status: filter || undefined } });
      setItems(Array.isArray(res.data) ? res.data : []);
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
    setLoading(true);
    load();
  }, [filter]);

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">HR</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Leave requests</h1>
        <p className="m-0 max-w-2xl text-text-muted">Open a request to review balances, see leave history, and approve or reject.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: '', label: 'All' },
        ].map((tab) => (
          <button
            key={tab.key || 'all'}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold ${filter === tab.key ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading requests…</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">No leave requests in this view.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`${HR_PORTAL_BASE}/leaves/${item.id}`}
              className="glass block rounded-[1.4rem] p-5 no-underline text-inherit transition hover:shadow-[0_12px_32px_rgba(26,79,214,0.08)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="m-0">{item.user?.name || 'Employee'}</h3>
                  <p className="m-0 text-sm text-text-muted">
                    {item.user?.email} · <span className="capitalize">{item.type}</span> · {item.startDate} → {item.endDate}
                  </p>
                  {item.reason ? <p className="m-0 mt-2 text-sm">{item.reason}</p> : null}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${leaveStatusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
