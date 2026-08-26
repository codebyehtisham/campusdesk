import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { getStaff, signOutStaff } from '../../auth/staffSession';
import { FACULTY_BASE } from '../../admin/paths';
import { isTeacher, staffHome } from '../../data/roles';
import { ATTENDANCE_STATUSES } from '../../data/attendance';
import { weekdayLabel } from '../../data/teaching';
import LocationMatchBadge from '../../components/LocationMatchBadge';

const staffReq = { authScope: 'staff' };

const expiresLabel = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function FacultyAttendance() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const staff = getStaff();
  const [classes, setClasses] = useState([]);
  const [today, setToday] = useState({ date: '', dayOfWeek: 0 });
  const [canMark, setCanMark] = useState(true);
  const [classId, setClassId] = useState(params.get('classId') || '');
  const [slotId, setSlotId] = useState(params.get('slotId') || '');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutStaff();
    navigate(FACULTY_BASE, { replace: true });
  };

  const current = useMemo(() => classes.find((item) => item.id === classId), [classes, classId]);
  const todaySlots = (current?.slots || []).filter((slot) => slot.dayOfWeek === today.dayOfWeek);
  const expired = session && new Date(session.qrExpiresAt).getTime() < Date.now();

  useEffect(() => {
    if (!isTeacher(staff?.role)) {
      setLoading(false);
      return;
    }
    api
      .get('/staff/teaching', staffReq)
      .then((res) => {
        const next = Array.isArray(res.data?.classes) ? res.data.classes : [];
        setClasses(next);
        setToday(res.data?.today || { date: '', dayOfWeek: 0 });
        setCanMark(res.data?.canMarkAttendance !== false);
        const requested = params.get('classId');
        const nextId = requested && next.some((item) => item.id === requested) ? requested : next[0]?.id || '';
        setClassId(nextId);
        const nextClass = next.find((item) => item.id === nextId);
        const requestedSlot = params.get('slotId');
        const matching = (nextClass?.slots || []).find((slot) => slot.id === requestedSlot);
        setSlotId(matching?.id || '');
        setError('');
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          kickOut();
          return;
        }
        setError(err.response?.data?.message || 'Could not load classes.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const openSession = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      const res = await api.post(
        `/staff/classes/${classId}/sessions`,
        { slotId: slotId || undefined, date: today.date },
        staffReq
      );
      setSession(res.data);
      setNotice(res.status === 201 ? 'Attendance session opened.' : 'Existing session loaded.');
    } catch (err) {
      if (err.response?.status === 401) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not open attendance.');
    } finally {
      setSaving(false);
    }
  };

  const refreshQr = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const res = await api.put(`/staff/sessions/${session.id}/qr`, {}, staffReq);
      setSession(res.data);
      setNotice('QR code refreshed.');
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not refresh the QR code.');
    } finally {
      setSaving(false);
    }
  };

  const mark = async (personId, status) => {
    if (!session) return;
    try {
      const res = await api.put(`/staff/sessions/${session.id}/marks`, { personId, status }, staffReq);
      setSession(res.data);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save that mark.');
    }
  };

  const closeSession = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const res = await api.put(`/staff/sessions/${session.id}/close`, {}, staffReq);
      setSession(res.data);
      setNotice('Session closed.');
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not close this session.');
    } finally {
      setSaving(false);
    }
  };

  if (!isTeacher(staff?.role)) {
    return <Navigate to={staffHome(staff?.role, staff?.modules)} replace />;
  }

  return (
    <div>
      <span className="eyebrow">Teaching</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Class attendance</h1>
      <p className="mb-8 max-w-xl text-text-muted">
        Choose a class from your timetable, generate a QR code for the room, and mark the roster. Students scan the QR
        from the Campus Desk app — location badges show whether a present mark was on campus.
      </p>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading classes…</div>
      ) : classes.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No classes assigned</h3>
          <p className="m-0 text-text-muted">Ask an organisation admin to assign you a class and timetable.</p>
        </div>
      ) : !canMark ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>Student attendance is not enabled</h3>
          <p className="m-0 text-text-muted">Ask the organisation admin to include student attendance in the subscription.</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-6">
            <section className="glass rounded-[1.6rem] p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  Class
                  <select
                    className="field"
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setSlotId('');
                      setSession(null);
                    }}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  Today’s slot
                  <select className="field" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                    <option value="">Any / no slot</option>
                    {todaySlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.startTime}–{slot.endTime}
                        {slot.room ? ` · ${slot.room}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-4 mb-0 text-sm text-text-muted">
                {today.dayOfWeek ? weekdayLabel(today.dayOfWeek) : 'Today'}
                {today.date ? ` · ${today.date}` : ''}
                {current ? ` · ${current.studentCount} enrolled` : ''}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={saving || !classId} onClick={openSession}>
                  {saving ? 'Opening…' : session ? 'Reload session' : 'Open attendance + QR'}
                </button>
                {session?.status === 'open' && (
                  <button type="button" className="btn btn-outline" disabled={saving} onClick={closeSession}>
                    Close session
                  </button>
                )}
              </div>
            </section>

            {session && (
              <section className="glass rounded-[1.6rem] p-6">
                <h2 className="mt-0 mb-4 text-[1.25rem]">Roster</h2>
                {session.roster?.length === 0 ? (
                  <p className="m-0 text-sm text-text-muted">No students enrolled in this class yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {session.roster.map((person) => (
                      <article key={person.id} className="rounded-2xl border border-border px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <strong className="block text-ink">{person.name}</strong>
                            <small className="text-text-muted">{person.title || person.email}</small>
                            {person.status === 'present' && (
                              <div className="mt-2">
                                <LocationMatchBadge location={person.location} status={person.status} />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ATTENDANCE_STATUSES.map((status) => (
                              <button
                                key={status.key}
                                type="button"
                                disabled={session.status !== 'open'}
                                onClick={() => mark(person.id, status.key)}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                  person.status === status.key
                                    ? 'bg-cardinal text-white'
                                    : 'border border-border text-text-muted'
                                }`}
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {session && (
            <aside className="glass h-fit rounded-[1.6rem] p-6 text-center">
              <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">QR for class</p>
              <h3 className="mt-2 mb-4 text-lg">{session.className}</h3>
              <img src={session.qrImage} alt="Attendance QR code" width="220" height="220" className="mx-auto rounded-2xl" />
              <p className="mt-4 mb-1 text-sm text-text-muted">
                {session.status === 'closed'
                  ? 'Session closed'
                  : expired
                    ? 'QR expired'
                    : `Valid until ${expiresLabel(session.qrExpiresAt)}`}
              </p>
              <p className="m-0 break-all text-[0.7rem] text-text-muted">{session.qrPayload}</p>
              {session.status === 'open' && (
                <button type="button" className="btn btn-outline mt-4 w-full py-2.5 text-sm" disabled={saving} onClick={refreshQr}>
                  Refresh QR
                </button>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
