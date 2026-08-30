import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin, getAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import { adminScreensForOrg, delegatedPortalsForOrg } from '../../data/adminOwnership';
import { roleLabel } from '../../data/roles';

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
  const portals = delegatedPortalsForOrg(modules);
  const adminScreens = adminScreensForOrg(modules);
  const showAdmissions = modules.includes('admissions');
  const showFaculty = modules.includes('faculty');
  const showStudentAttendance = modules.includes('student-attendance');
  const showStaffAttendance = modules.includes('staff-attendance');
  const showCareers = modules.includes('careers');
  const attendance = data.attendance || empty.attendance;
  const teaching = data.teaching || { classes: 0, teachers: 0 };
  const hrPortal = portals.find((portal) => portal.key === 'hr');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Overview</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Dashboard</h1>
          <p className="m-0 max-w-2xl text-text-muted">
            {data.organization?.name || 'Your organisation'} · set up structure here, run daily work in team portals.
          </p>
        </div>
        <button type="button" className="btn btn-outline shrink-0 py-2.5 text-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="m-0 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      <section className="glass rounded-[1.8rem] p-6 md:p-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="m-0 text-[1.35rem]">Team portals</h2>
            <p className="m-0 mt-1 text-sm text-text-muted">Operational work is handled by role owners in their portals.</p>
          </div>
          <Link to={`${ADMIN_BASE}/portals`} className="text-sm font-semibold text-cardinal">
            View all portals →
          </Link>
        </div>
        {portals.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">No staff portals are active for this subscription.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portals.map((portal) => (
              <article key={portal.key} className="rounded-[1.3rem] border border-border bg-white/80 p-4">
                <h3 className="m-0 text-base">{portal.label}</h3>
                <p className="m-0 mt-1 text-sm text-text-muted">{portal.roles.map((role) => roleLabel(role)).join(' · ')}</p>
                <code className="mt-3 block text-xs font-mono text-ink">{portal.path}</code>
                <a href={portal.path} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-cardinal">
                  Open sign-in →
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminScreens.slice(0, 4).map((screen) => (
          <Link
            key={screen.key}
            to={screen.to}
            className="glass block rounded-[1.3rem] p-4 no-underline text-inherit transition hover:shadow-[0_12px_32px_rgba(26,79,214,0.08)]"
          >
            <p className="m-0 text-xs font-bold tracking-wide text-text-muted uppercase">{screen.group}</p>
            <p className="m-0 mt-2 font-semibold text-ink">{screen.label}</p>
          </Link>
        ))}
      </div>

      {showAdmissions && (
        <section className="glass rounded-[1.8rem] p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="m-0 text-[1.35rem]">Admissions pipeline</h2>
              <p className="m-0 mt-1 text-sm text-text-muted">You manage settings here; review happens in the admissions portal.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={`${ADMIN_BASE}/admissions`} className="text-sm font-semibold text-cardinal">
                Settings →
              </Link>
              {portals.find((portal) => portal.key === 'admissions') ? (
                <a
                  href={portals.find((portal) => portal.key === 'admissions')?.path}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-cardinal"
                >
                  Admissions portal →
                </a>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Applicants" value={admissions.applicants} />
            <StatCard label="Submitted" value={admissions.submitted} />
            <StatCard label="Accepted" value={admissions.accepted} accent="blue" />
            <StatCard label="Rejected" value={admissions.rejected} accent="red" />
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {showCareers && hrPortal && (
          <section className="glass rounded-[1.8rem] p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-[1.35rem]">HR · Careers</h2>
                <p className="m-0 mt-1 text-sm text-text-muted">Managed in the HR portal by HR managers.</p>
              </div>
              <a href={hrPortal.path} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cardinal">
                HR portal →
              </a>
            </div>
            <StatCard label="Open roles" value={data.careers.openings} accent="blue" />
          </section>
        )}

        {(showStudentAttendance || showStaffAttendance) && (
          <section className="glass rounded-[1.8rem] p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="m-0 text-[1.35rem]">Attendance today</h2>
                <p className="m-0 mt-1 text-sm text-text-muted">
                  {showStudentAttendance ? 'Student register stays in org admin.' : ''}
                  {showStudentAttendance && showStaffAttendance ? ' ' : ''}
                  {showStaffAttendance ? 'Staff attendance is in the HR portal.' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {showStudentAttendance && (
                  <Link to={`${ADMIN_BASE}/attendance/students`} className="text-sm font-semibold text-cardinal">
                    Students →
                  </Link>
                )}
                {showStaffAttendance && hrPortal && (
                  <a href={hrPortal.path} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cardinal">
                    HR portal →
                  </a>
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
              <div>
                <h2 className="m-0 text-[1.35rem]">Teaching structure</h2>
                <p className="m-0 mt-1 text-sm text-text-muted">You set up classes and timetable; teachers work in the faculty portal.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={`${ADMIN_BASE}/classes`} className="text-sm font-semibold text-cardinal">
                  Classes →
                </Link>
                {portals.find((portal) => portal.key === 'faculty') ? (
                  <a
                    href={portals.find((portal) => portal.key === 'faculty')?.path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-cardinal"
                  >
                    Faculty portal →
                  </a>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Classes" value={teaching.classes} accent="blue" />
              <StatCard label="Faculty members" value={teaching.teachers} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
