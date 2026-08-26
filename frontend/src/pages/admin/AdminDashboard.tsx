import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin, getAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';

const empty = {
  admissions: { applicants: 0, notStarted: 0, inProgress: 0, submitted: 0, accepted: 0, rejected: 0 },
  careers: { openings: 0, byType: [] },
  attendance: { students: 0, staff: 0, presentStudents: 0, presentStaff: 0 },
  teaching: { classes: 0, teachers: 0 },
  organization: { name: '', modules: [] },
};

function StatCard({ label, value, accent }) {
  return (
    <div
      className={`rounded-[1.4rem] border bg-white p-5 ${
        accent === 'blue'
          ? 'border-cardinal/35'
          : accent === 'red'
            ? 'border-crimson/35'
            : 'border-border'
      }`}
    >
      <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">{label}</p>
      <p className="mt-3 mb-0 font-serif text-4xl font-extrabold tracking-tight text-ink">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/admin/dashboard', { authScope: 'admin' });
      setData({ ...empty, ...res.data });
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOutAdmin();
        navigate(ADMIN_BASE, { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const admissions = data.admissions;
  const modules = data.organization?.modules || getAdmin()?.modules || [];
  const showAdmissions = modules.includes('admissions');
  const showCareers = modules.includes('careers');
  const showFaculty = modules.includes('faculty');
  const showStudentAttendance = modules.includes('student-attendance');
  const showStaffAttendance = modules.includes('staff-attendance');
  const attendance = data.attendance || empty.attendance;
  const teaching = data.teaching || { classes: 0, teachers: 0 };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Overview</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Dashboard</h1>
          <p className="m-0 max-w-xl text-text-muted">
            {data.organization?.name || 'Your organisation'} · services follow the modules in this subscription.
          </p>
        </div>
        <button type="button" className="btn btn-outline shrink-0 py-2.5 text-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="m-0 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {showAdmissions && (
      <section className="glass rounded-[1.8rem] p-6 md:p-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="m-0 text-[1.35rem]">Admissions pipeline</h2>
          <Link to={`${ADMIN_BASE}/admissions`} className="text-sm font-semibold text-cardinal">
            Open admissions →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Applicants" value={admissions.applicants} />
          <StatCard label="Submitted" value={admissions.submitted} />
          <StatCard label="Accepted" value={admissions.accepted} accent="blue" />
          <StatCard label="Rejected" value={admissions.rejected} accent="red" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-cardinal-pale px-3 py-1.5 text-xs font-bold text-cardinal">
            In progress: {admissions.inProgress}
          </span>
          <span className="rounded-full bg-crimson-pale px-3 py-1.5 text-xs font-bold text-crimson">
            Not started: {admissions.notStarted}
          </span>
        </div>
      </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {showCareers && (
        <section className="glass rounded-[1.8rem] p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[1.35rem]">HR · Careers</h2>
            <Link to={`${ADMIN_BASE}/careers`} className="text-sm font-semibold text-cardinal">
              Manage openings →
            </Link>
          </div>
          <StatCard label="Open roles" value={data.careers.openings} accent="blue" />
          <div className="mt-4 flex flex-wrap gap-2">
            {(data.careers.byType || []).length === 0 ? (
              <p className="m-0 text-sm text-text-muted">No openings published yet.</p>
            ) : (
              data.careers.byType.map((row) => (
                <span key={row.type} className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-ink">
                  {row.type}: {row.count}
                </span>
              ))
            )}
          </div>
        </section>
        )}

        {(showStudentAttendance || showStaffAttendance) && (
        <section className="glass rounded-[1.8rem] p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[1.35rem]">Attendance today</h2>
            <div className="flex flex-wrap gap-3">
              {showStudentAttendance && (
                <Link to={`${ADMIN_BASE}/attendance/students`} className="text-sm font-semibold text-cardinal">
                  Students →
                </Link>
              )}
              {showStaffAttendance && (
                <Link to={`${ADMIN_BASE}/attendance/staff`} className="text-sm font-semibold text-cardinal">
                  Staff →
                </Link>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {showStudentAttendance && (
              <StatCard label="Students present" value={`${attendance.presentStudents}/${attendance.students}`} accent="blue" />
            )}
            {showStaffAttendance && (
              <StatCard label="Staff present" value={`${attendance.presentStaff}/${attendance.staff}`} />
            )}
          </div>
        </section>
        )}

        {showFaculty && (
        <section className="glass rounded-[1.8rem] p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[1.35rem]">Teaching</h2>
            <div className="flex flex-wrap gap-3">
              <Link to={`${ADMIN_BASE}/classes`} className="text-sm font-semibold text-cardinal">
                Classes →
              </Link>
              <Link to={`${ADMIN_BASE}/timetable`} className="text-sm font-semibold text-cardinal">
                Timetable →
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Classes" value={teaching.classes} accent="blue" />
            <StatCard label="Faculty members" value={teaching.teachers} />
          </div>
        </section>
        )}

        <section className="glass rounded-[1.8rem] p-6 md:p-8">
          <h2 className="mb-6 text-[1.35rem]">Subscribed modules</h2>
          {modules.length === 0 ? (
            <p className="m-0 text-sm text-text-muted">No modules assigned yet. Ask the platform team to enable services.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {modules.map((slug) => (
                <span key={slug} className="tag tag-allied">
                  {slug}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
