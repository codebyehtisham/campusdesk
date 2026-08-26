import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { ADMIN_BASE } from '../admin/paths';

const adminReq = { authScope: 'admin' as const };

export default function AdminAttendanceSessions({ date }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/attendance/sessions', { ...adminReq, params: { date } })
      .then((res) => setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return null;

  return (
    <section className="mt-6">
      <span className="eyebrow">Class attendance</span>
      <h2 className="mb-2 text-2xl">Sessions by class & instructor</h2>
      <p className="mb-5 max-w-2xl text-sm text-text-muted">
        View-only for org admins. Open a session to see QR, location, and final marks per student.
      </p>

      {sessions.length === 0 ? (
        <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No class sessions on this date.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <article key={session.id} className="glass rounded-[1.4rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong className="block text-ink">{session.className}</strong>
                  <small className="text-text-muted">
                    {session.date} · Instructor: {session.teacherName} · {session.markCount} marks · {session.status}
                  </small>
                </div>
                <Link
                  to={`${ADMIN_BASE}/attendance/sessions/${session.id}`}
                  className="text-sm font-semibold text-cardinal hover:underline"
                >
                  View roster
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
