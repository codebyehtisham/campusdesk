import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin } from '../../auth/adminSession';
import { signOutStaff } from '../../auth/staffSession';
import { ADMIN_BASE, HR_PORTAL_BASE } from '../../admin/paths';
import { ATTENDANCE_STATUSES, STAFF_TITLES, STUDENT_PROGRAMMES, todayStamp } from '../../data/attendance';
import AdminAttendanceSessions from '../../components/AdminAttendanceSessions';

const emptyForm = { name: '', title: '', email: '', unitId: '' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function AdminAttendance({ kind, authScope = 'admin', apiBase = '/admin' }) {
  const navigate = useNavigate();
  const isStaff = kind === 'staff';
  const authReq = { authScope };
  const attendancePath = `${apiBase}/attendance`;
  const schemePath = apiBase === '/admin' ? '/admin/scheme' : `${apiBase}/scheme`;
  const [scheme, setScheme] = useState({
    kind: 'education',
    staffTitles: STAFF_TITLES,
    rosterTitles: STUDENT_PROGRAMMES,
    rosterLabels: { student: 'Students', staff: 'Staff' },
    units: [],
  });
  const titles = isStaff ? scheme.staffTitles : scheme.rosterTitles;
  const peopleLabel = isStaff ? scheme.rosterLabels.staff : scheme.rosterLabels.student;
  const [date, setDate] = useState(todayStamp);
  const [people, setPeople] = useState([]);
  const [summary, setSummary] = useState({ total: 0, marked: 0, present: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    if (authScope === 'staff') {
      signOutStaff();
      navigate(HR_PORTAL_BASE, { replace: true });
      return;
    }
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  const load = async (nextDate = date) => {
    try {
      const [res, schemeRes] = await Promise.all([
        api.get(attendancePath, { authScope, params: { kind, date: nextDate } }),
        api.get(schemePath, authReq),
      ]);
      setPeople(Array.isArray(res.data?.people) ? res.data.people : []);
      setSummary({
        total: res.data?.total || 0,
        marked: res.data?.marked || 0,
        present: res.data?.present || 0,
      });
      setScheme({
        kind: schemeRes.data?.kind || 'education',
        staffTitles: schemeRes.data?.staffTitles?.length ? schemeRes.data.staffTitles : STAFF_TITLES,
        rosterTitles: schemeRes.data?.rosterTitles?.length ? schemeRes.data.rosterTitles : STUDENT_PROGRAMMES,
        rosterLabels: schemeRes.data?.rosterLabels || { student: 'Students', staff: 'Staff' },
        units: Array.isArray(schemeRes.data?.units) ? schemeRes.data.units.filter((item) => item.active !== false) : [],
      });
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not load attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
  }, [kind, date]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const setStatus = (id, status) => {
    setPeople((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));
  };

  const saveDay = async () => {
    setSaving(true);
    try {
      await api.put(
        attendancePath,
        {
          kind,
          date,
          marks: people.filter((row) => row.active).map((row) => ({ personId: row.id, status: row.status || 'present' })),
        },
        authReq
      );
      setNotice('Attendance saved for this date.');
      await load(date);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setForm({ ...emptyForm, title: titles[0] });
    setPanel({ mode: 'create' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`${attendancePath}/people`, { ...form, kind }, authReq);
      setNotice(isStaff ? 'Staff member added to the register.' : `${peopleLabel.replace(/s$/, '')} added to the register.`);
      setPanel(null);
      setForm(emptyForm);
      await load(date);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not add this person.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`${attendancePath}/people/${pendingDelete.id}`, authReq);
      setNotice(`Removed ${pendingDelete.name}.`);
      setPendingDelete(null);
      await load(date);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not remove this person.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Attendance</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">{peopleLabel} register</h1>
          <p className="m-0 max-w-xl text-text-muted">
            {isStaff
              ? `Mark daily attendance for ${peopleLabel.toLowerCase()} on this register.`
              : 'View class attendance by instructor. Student marks come from faculty QR sessions — org admins cannot edit them here.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-semibold text-ink">
            Date
            <input
              type="date"
              className="border-0 bg-transparent p-0 text-sm font-semibold text-ink outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-outline" onClick={openCreate}>
            {isStaff ? `Add ${peopleLabel.toLowerCase()}` : `Add ${peopleLabel.toLowerCase().replace(/s$/, '')}`}
          </button>
          {isStaff && (
            <button type="button" className="btn btn-primary" onClick={saveDay} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save day'}
            </button>
          )}
          {!isStaff && (
            <Link to={`${ADMIN_BASE}/attendance/location`} className="btn btn-outline">
              Campus location
            </Link>
          )}
        </div>
      </div>

      {!isStaff && <AdminAttendanceSessions date={date} />}

      <div className="mb-5 flex flex-wrap gap-2">
        {isStaff ? (
          <>
            <span className="rounded-full bg-cardinal-pale px-3 py-1.5 text-xs font-bold text-cardinal">
              Present {summary.present}/{summary.total}
            </span>
            <span className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-ink">
              Marked {summary.marked}
            </span>
          </>
        ) : (
          <span className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-ink">
            {summary.total} on roster
          </span>
        )}
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading register…</div>
      ) : people.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No {peopleLabel.toLowerCase()} on the register</h3>
          <p className="mb-6 text-text-muted">
            Add the first {peopleLabel.toLowerCase().replace(/s$/, '')} to start taking attendance.
          </p>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add the first {peopleLabel.toLowerCase().replace(/s$/, '')}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {people.map((person) => (
            <article key={person.id} className={`glass rounded-[1.4rem] p-5 ${person.active ? '' : 'opacity-60'}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="mt-0 mb-1 text-xl">{person.name}</h3>
                  <p className="m-0 text-sm text-text-muted">
                    {person.title || (isStaff ? 'Staff' : peopleLabel.replace(/s$/, ''))}
                    {person.unitName ? ` · ${person.unitName}` : ''}
                    {person.email ? ` · ${person.email}` : ''}
                    {person.active ? '' : ' · inactive'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isStaff &&
                    ATTENDANCE_STATUSES.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        disabled={!person.active}
                        onClick={() => setStatus(person.id, item.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                          person.status === item.key
                            ? item.key === 'absent'
                              ? 'border-crimson bg-crimson-pale text-crimson'
                              : 'border-cardinal bg-cardinal-pale text-cardinal'
                            : 'border-border bg-white text-ink'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  <button
                    type="button"
                    className="text-xs font-bold text-crimson"
                    title="Removes this person from the campus attendance roster (not from class enrollment)"
                    onClick={() => setPendingDelete(person)}
                  >
                    Remove from roster
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {notice ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-6 bottom-6 z-40 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
          >
            {notice}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form
              onSubmit={handleSubmit}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="w-full max-w-lg rounded-[1.6rem] bg-white p-6"
            >
              <h2 className="mt-0">{isStaff ? 'Add staff member' : `Add ${peopleLabel.toLowerCase().replace(/s$/, '')}`}</h2>
              <div className="grid gap-3">
                <label className={labelClass}>
                  Name
                  <input required className="field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </label>
                <label className={labelClass}>
                  {isStaff ? 'Role' : 'Programme'}
                  <select className="field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}>
                    {titles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                {scheme.units.length > 0 && (
                  <label className={labelClass}>
                    Department
                    <select className="field" value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}>
                      <option value="">Unassigned</option>
                      {scheme.units.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={labelClass}>
                  Email
                  <input className="field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPanel(null)}>
                  Cancel
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-md rounded-[1.6rem] bg-white p-6">
              <h2 className="mt-0">Remove {pendingDelete.name} from roster?</h2>
              <p className="text-text-muted">
                This removes them from the campus attendance register and deletes their daily attendance history. It does
                not remove class enrollments — use Classes to unenroll a student from a course.
              </p>
              <div className="mt-5 flex gap-2">
                <button type="button" className="btn btn-primary flex-1" onClick={confirmDelete} disabled={saving}>
                  Remove
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPendingDelete(null)}>
                  Keep
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
