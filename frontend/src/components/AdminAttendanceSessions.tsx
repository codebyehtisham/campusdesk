import { useEffect, useState } from 'react';
import api from '../../api/client';
import LocationMatchBadge from './LocationMatchBadge';

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
  if (sessions.length === 0) return null;

  return (
    <section className="mt-10">
      <span className="eyebrow">QR sessions</span>
      <h2 className="mb-4 text-2xl">Class scans today</h2>
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
                  {session.date} · {session.teacherName} · {session.markCount} marks · {session.status}
                </small>
              </div>
              <span className="text-sm font-semibold text-cardinal">{activeId === session.id ? 'Hide' : 'View'}</span>
            </button>
            {activeId === session.id && detail?.roster && (
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                {detail.roster.map((person) => (
                  <div key={person.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <strong className="block text-ink">{person.name}</strong>
                      <small className="text-text-muted">{person.title || person.email}</small>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cardinal-pale px-2.5 py-1 text-xs font-bold text-cardinal">
                        {person.status || 'unmarked'}
                      </span>
                      <LocationMatchBadge location={person.location} status={person.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
