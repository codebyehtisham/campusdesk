import { useEffect, useState } from 'react';
import api from '../api/client';
import AttendanceRecordRow, { AttendanceRecordHeader } from './AttendanceRecordRow';

const adminReq = { authScope: 'admin' as const };

export default function AdminAttendanceSessions({ date }) {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/attendance/sessions', { ...adminReq, params: { date } })
      .then((res) => setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []))
      .finally(() => setLoading(false));
  }, [date]);

  const openSession = async (id) => {
    if (activeId === id) {
      setActiveId('');
      setDetail(null);
      return;
    }
    setActiveId(id);
    const res = await api.get(`/admin/attendance/sessions/${id}`, adminReq);
    setDetail(res.data);
  };

  if (loading) return null;

  return (
    <section className="mt-6">
      <span className="eyebrow">Class attendance</span>
      <h2 className="mb-2 text-2xl">Sessions by class & instructor</h2>
      <p className="mb-5 max-w-2xl text-sm text-text-muted">
        View-only for org admins. Faculty mark attendance from their timetable. Final present counts only when QR is
        present and the student is onsite (when campus location is enabled).
      </p>

      {sessions.length === 0 ? (
        <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No class sessions on this date.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <article key={session.id} className="glass rounded-[1.4rem] p-5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => openSession(session.id)}
              >
                <div>
                  <strong className="block text-ink">{session.className}</strong>
                  <small className="text-text-muted">
                    {session.date} · Instructor: {session.teacherName} · {session.markCount} marks · {session.status}
                  </small>
                </div>
                <span className="text-sm font-semibold text-cardinal">{activeId === session.id ? 'Hide' : 'View roster'}</span>
              </button>
              {activeId === session.id && detail?.roster && (
                <div className="mt-4 border-t border-border pt-4">
                  <AttendanceRecordHeader locationEnabled={Boolean(detail.attendanceLocationEnabled)} />
                  {detail.roster.map((person) => (
                    <AttendanceRecordRow
                      key={person.id}
                      person={person}
                      locationEnabled={Boolean(detail.attendanceLocationEnabled)}
                    />
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
