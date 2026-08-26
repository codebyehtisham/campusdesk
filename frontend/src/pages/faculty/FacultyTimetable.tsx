import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getStaff, signOutStaff } from '../../auth/staffSession';
import { FACULTY_BASE } from '../../admin/paths';
import { isTeacher, staffHome } from '../../data/roles';
import { WEEKDAYS, weekdayLabel } from '../../data/teaching';

const staffReq = { authScope: 'staff' };

export default function FacultyTimetable() {
  const navigate = useNavigate();
  const staff = getStaff();
  const [slots, setSlots] = useState([]);
  const [today, setToday] = useState({ date: '', dayOfWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutStaff();
    navigate(FACULTY_BASE, { replace: true });
  };

  useEffect(() => {
    if (!isTeacher(staff?.role)) return undefined;
    api
      .get('/staff/teaching', staffReq)
      .then((res) => {
        setSlots(Array.isArray(res.data?.slots) ? res.data.slots : []);
        setToday(res.data?.today || { date: '', dayOfWeek: 0 });
        setError('');
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          kickOut();
          return;
        }
        setError(err.response?.data?.message || 'Could not load your timetable.');
      })
      .finally(() => setLoading(false));
    return undefined;
  }, []);

  const byDay = useMemo(
    () => WEEKDAYS.map((day) => ({ ...day, slots: slots.filter((slot) => slot.dayOfWeek === day.value) })),
    [slots]
  );

  if (!isTeacher(staff?.role)) {
    return <Navigate to={staffHome(staff?.role, staff?.modules)} replace />;
  }

  return (
    <div>
      <span className="eyebrow">Teaching</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Timetable</h1>
      <p className="mb-8 max-w-xl text-text-muted">
        Your weekly classes. Open attendance from a slot that matches today.
      </p>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading timetable…</div>
      ) : slots.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No classes assigned</h3>
          <p className="m-0 text-text-muted">Ask an organisation admin to assign you a class and timetable.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {byDay.map((day) => (
            <section
              key={day.value}
              className={`rounded-[1.6rem] border bg-white p-6 ${
                day.value === today.dayOfWeek ? 'border-cardinal/40' : 'border-border'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="m-0 text-[1.2rem]">{day.label}</h2>
                {day.value === today.dayOfWeek && (
                  <span className="rounded-full bg-cardinal-pale px-3 py-1 text-xs font-bold text-cardinal">Today</span>
                )}
              </div>
              {day.slots.length === 0 ? (
                <p className="m-0 text-sm text-text-muted">No class on {weekdayLabel(day.value)}.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {day.slots.map((slot) => (
                    <article key={slot.id} className="rounded-2xl border border-border px-4 py-3">
                      <p className="m-0 text-sm font-bold text-cardinal">
                        {slot.startTime}–{slot.endTime}
                      </p>
                      <h3 className="mt-1 mb-1 text-base">{slot.className}</h3>
                      <p className="m-0 text-sm text-text-muted">
                        {slot.classCode}
                        {slot.room ? ` · ${slot.room}` : ''}
                      </p>
                      {day.value === today.dayOfWeek && (
                        <Link
                          to={`${FACULTY_BASE}/attendance?classId=${slot.classId}&slotId=${slot.id}`}
                          className="mt-3 inline-block text-sm font-semibold text-cardinal"
                        >
                          Mark attendance →
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
