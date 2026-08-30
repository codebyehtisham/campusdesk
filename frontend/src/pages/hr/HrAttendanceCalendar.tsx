import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { HR_PORTAL_BASE } from '../../admin/paths';

const staffReq = { authScope: 'staff' };

const statusClass = {
  present: 'is-present',
  absent: 'is-absent',
  late: 'is-late',
  leave: 'is-leave',
  unmarked: 'is-unmarked',
};

export default function HrAttendanceCalendar() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ days: [], employees: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/staff/hr/attendance/calendar', { ...staffReq, params: { month } })
      .then((res) => setData(res.data || { days: [], employees: [] }))
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOutStaff();
          navigate(HR_PORTAL_BASE, { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [month, navigate]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(next.toISOString().slice(0, 7));
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="eyebrow">HR</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Staff attendance calendar</h1>
          <p className="m-0 max-w-2xl text-text-muted">Monthly view of present, absent, late, and approved leave for every employee.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-outline py-2" onClick={() => shiftMonth(-1)}>
            ←
          </button>
          <input className="field" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button type="button" className="btn btn-outline py-2" onClick={() => shiftMonth(1)}>
            →
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs font-bold">
        <span className="hr-cal-legend is-present">Present</span>
        <span className="hr-cal-legend is-absent">Absent</span>
        <span className="hr-cal-legend is-late">Late</span>
        <span className="hr-cal-legend is-leave">Leave</span>
        <span className="hr-cal-legend is-unmarked">Unmarked</span>
      </div>

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading calendar…</div>
      ) : (
        <div className="glass overflow-x-auto rounded-[1.4rem] p-4">
          <table className="hr-cal-table min-w-full">
            <thead>
              <tr>
                <th>Employee</th>
                {(data.days || []).map((day) => (
                  <th key={day}>{Number(day.slice(8))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.employees || []).map((emp) => (
                <tr key={emp.userId}>
                  <td>
                    <strong>{emp.name}</strong>
                    <div className="text-xs text-text-muted">{emp.email}</div>
                  </td>
                  {(data.days || []).map((day) => (
                    <td key={day}>
                      <span className={`hr-cal-cell ${statusClass[emp.days?.[day]] || 'is-unmarked'}`} title={emp.days?.[day] || 'unmarked'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
