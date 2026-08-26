import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import { TIME_OPTIONS, WEEKDAYS, weekdayLabel } from '../../data/teaching';

const emptyForm = { classId: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:30', room: '' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const adminReq = { authScope: 'admin' };

export default function AdminTimetable() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const res = await api.get('/admin/teaching', adminReq);
      setClasses(Array.isArray(res.data?.classes) ? res.data.classes : []);
      setSlots(Array.isArray(res.data?.slots) ? res.data.slots : []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not load the timetable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const byDay = useMemo(
    () => WEEKDAYS.map((day) => ({ ...day, slots: slots.filter((slot) => slot.dayOfWeek === day.value) })),
    [slots]
  );

  const openCreate = (dayOfWeek = '1') => {
    setForm({ ...emptyForm, dayOfWeek: String(dayOfWeek), classId: classes[0]?.id || '' });
    setPanel({ mode: 'create' });
  };

  const openEdit = (slot) => {
    setForm({
      classId: slot.classId,
      dayOfWeek: String(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || '',
    });
    setPanel({ mode: 'edit', id: slot.id });
  };

  const closePanel = () => {
    setPanel(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.classId) return;
    setSaving(true);
    try {
      const payload = {
        classId: form.classId,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room.trim(),
      };
      if (panel?.mode === 'edit') {
        await api.put(`/admin/timetable/${panel.id}`, payload, adminReq);
        setNotice('Timetable slot updated.');
      } else {
        await api.post('/admin/timetable', payload, adminReq);
        setNotice('Slot added to the week.');
      }
      closePanel();
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not save this slot.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/timetable/${pendingDelete.id}`, adminReq);
      setNotice('Slot removed.');
      setPendingDelete(null);
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not remove this slot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Teaching</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Timetable</h1>
          <p className="m-0 max-w-xl text-text-muted">
            Weekly slots for each class. Faculty members open attendance from the matching class on their timetable.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`${ADMIN_BASE}/classes`} className="btn btn-outline">
            Classes
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => openCreate()} disabled={classes.length === 0}>
            Add slot
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading timetable…</div>
      ) : classes.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>Create a class first</h3>
          <p className="mb-6 text-text-muted">Timetable slots belong to a teaching class.</p>
          <Link to={`${ADMIN_BASE}/classes`} className="btn btn-primary">
            Open classes
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {byDay.map((day) => (
            <section key={day.value} className="glass rounded-[1.6rem] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="m-0 text-[1.2rem]">{day.label}</h2>
                <button type="button" className="text-sm font-semibold text-cardinal" onClick={() => openCreate(day.value)}>
                  Add
                </button>
              </div>
              {day.slots.length === 0 ? (
                <p className="m-0 text-sm text-text-muted">No classes on {day.short}.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {day.slots.map((slot) => (
                    <article key={slot.id} className="rounded-2xl border border-border px-4 py-3">
                      <p className="m-0 text-sm font-bold text-cardinal">
                        {slot.startTime}–{slot.endTime}
                      </p>
                      <h3 className="mt-1 mb-1 text-base">{slot.className}</h3>
                      <p className="m-0 text-sm text-text-muted">
                        {slot.teacher?.name || 'Unassigned'}
                        {slot.room ? ` · ${slot.room}` : ''}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="btn btn-outline py-2 text-sm" onClick={() => openEdit(slot)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-crimson/25 bg-crimson-pale px-4 py-2 text-sm font-bold text-crimson"
                          onClick={() => setPendingDelete(slot)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(26,79,214,0.28)]"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <motion.div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-white/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="flex-1" aria-label="Close" onClick={closePanel} />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-white p-7 md:p-9"
            >
              <span className="eyebrow">{panel.mode === 'edit' ? 'Edit slot' : 'New slot'}</span>
              <h2 className="text-[1.8rem]">{panel.mode === 'edit' ? 'Update this period' : 'Add a period'}</h2>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className={labelClass}>
                  Class
                  <select name="classId" required value={form.classId} onChange={handleChange} className="field">
                    <option value="">Choose a class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Day
                  <select name="dayOfWeek" value={form.dayOfWeek} onChange={handleChange} className="field">
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    Starts
                    <select name="startTime" value={form.startTime} onChange={handleChange} className="field">
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Ends
                    <select name="endTime" value={form.endTime} onChange={handleChange} className="field">
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={labelClass}>
                  Room
                  <input name="room" value={form.room} onChange={handleChange} className="field" />
                </label>
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                    {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save slot' : 'Add slot'}
                  </button>
                  <button type="button" className="btn btn-outline flex-1" onClick={closePanel}>
                    Cancel
                  </button>
                </div>
              </form>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/65 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass glow-border w-full max-w-md rounded-[1.6rem] p-8">
              <h3>Remove this slot?</h3>
              <p className="text-text-muted">
                {weekdayLabel(pendingDelete.dayOfWeek)} {pendingDelete.startTime}–{pendingDelete.endTime} for “
                {pendingDelete.className}” will be removed from the week.
              </p>
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={confirmDelete}>
                  Remove slot
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPendingDelete(null)}>
                  Keep it
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
